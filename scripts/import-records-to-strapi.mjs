import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import qs from 'qs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(repoRoot, 'scripts/records-import/source');

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }

  return value;
}

function getApiBaseUrl() {
  return requireEnv('STRAPI_URL');
}

function getApiToken() {
  return requireEnv('STRAPI_API_TOKEN');
}

async function strapiRequest(pathname, { body, headers, method = 'GET' } = {}) {
  const url = new URL(pathname, getApiBaseUrl());
  const response = await fetch(url, {
    body,
    headers: {
      Authorization: `Bearer ${getApiToken()}`,
      ...headers,
    },
    method,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Strapi request failed (${method} ${url.pathname}): ${response.status} ${response.statusText}\n${errorText}`
    );
  }

  return response.json();
}

async function getMarkdownRecordFiles() {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => path.join(sourceDir, entry.name))
    .sort();
}

function slugifyFileName(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

async function parseMarkdownRecord(filePath) {
  const fileContents = await fs.readFile(filePath, 'utf8');
  const { data } = matter(fileContents);

  if (
    typeof data.title !== 'string' ||
    typeof data.artist !== 'string' ||
    typeof data.cover !== 'string' ||
    !data.title ||
    !data.artist ||
    !data.cover
  ) {
    throw new Error(`Invalid frontmatter in ${filePath}`);
  }

  const receivedOn = new Date(String(data.dateReceived));
  if (Number.isNaN(receivedOn.valueOf())) {
    throw new Error(`Invalid dateReceived in ${filePath}`);
  }

  return {
    artistName: data.artist,
    coverPath: path.resolve(path.dirname(filePath), data.cover),
    giver: typeof data.giver === 'string' ? data.giver : null,
    receivedOn: receivedOn.toISOString(),
    slug: slugifyFileName(filePath),
    title: data.title,
  };
}

async function findArtistDocumentId(artistName) {
  const query = qs.stringify(
    {
      filters: {
        name: {
          $eq: artistName,
        },
      },
      pagination: {
        page: 1,
        pageSize: 1,
      },
    },
    { encodeValuesOnly: true }
  );

  const response = await strapiRequest(`/api/artists?${query}`);
  return response.data[0]?.documentId ?? null;
}

async function createArtist(artistName) {
  const response = await strapiRequest('/api/artists', {
    body: JSON.stringify({
      data: {
        name: artistName,
      },
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  return response.data.documentId;
}

async function getOrCreateArtistDocumentId(artistName) {
  return (await findArtistDocumentId(artistName)) ?? createArtist(artistName);
}

async function findExistingRecordDocumentId(slug) {
  const query = qs.stringify(
    {
      filters: {
        slug: {
          $eq: slug,
        },
      },
      pagination: {
        page: 1,
        pageSize: 1,
      },
    },
    { encodeValuesOnly: true }
  );

  const response = await strapiRequest(`/api/records?${query}`);
  return response.data[0]?.documentId ?? null;
}

async function uploadCoverAsset(coverPath) {
  const fileName = path.basename(coverPath);
  const fileBuffer = await fs.readFile(coverPath);
  const formData = new FormData();
  formData.append('files', new Blob([fileBuffer]), fileName);

  const response = await strapiRequest('/api/upload', {
    body: formData,
    method: 'POST',
  });

  const uploadedAsset = response[0];
  if (!uploadedAsset?.id) {
    throw new Error(`Upload did not return an asset id for ${coverPath}`);
  }

  return uploadedAsset.id;
}

async function createRecord(record, artistDocumentId, coverAssetId) {
  await strapiRequest('/api/records', {
    body: JSON.stringify({
      data: {
        artist: artistDocumentId,
        coverArt: coverAssetId,
        giver: record.giver,
        receivedOn: record.receivedOn,
        slug: record.slug,
        title: record.title,
      },
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
}

async function importRecord(filePath) {
  const record = await parseMarkdownRecord(filePath);
  const existingDocumentId = await findExistingRecordDocumentId(record.slug);

  if (existingDocumentId) {
    console.log(`Skipping ${record.slug}; record already exists (${existingDocumentId}).`);
    return;
  }

  const artistDocumentId = await getOrCreateArtistDocumentId(record.artistName);
  const coverAssetId = await uploadCoverAsset(record.coverPath);
  await createRecord(record, artistDocumentId, coverAssetId);

  console.log(`Imported ${record.slug}.`);
}

async function main() {
  const files = await getMarkdownRecordFiles();

  if (files.length === 0) {
    throw new Error(`No markdown records found in ${sourceDir}`);
  }

  for (const filePath of files) {
    await importRecord(filePath);
  }

  console.log(`Imported ${files.length} records from ${sourceDir}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
