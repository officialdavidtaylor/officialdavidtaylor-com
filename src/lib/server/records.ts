import type { LiveDataCollection, LiveDataEntry } from 'astro';
import type { LiveLoader } from 'astro/loaders';

import qs from 'qs';
import { z } from 'astro/zod';

const DEFAULT_RETRY_ATTEMPTS = 3;
const PAGE_SIZE = 100;
const RECORDS_COLLECTION_TAG = 'records';

const strapiRecordSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  updatedAt: z.coerce.date(),
  artist: z.object({
    name: z.string().min(1),
  }),
  coverArt: z.object({
    url: z.string().min(1),
  }),
  giver: z.string().nullable(),
  receivedOn: z.coerce.date(),
});

const strapiRecordsPageSchema = z.object({
  data: z.array(strapiRecordSchema),
  meta: z.object({
    pagination: z.object({
      page: z.number().int().positive(),
      pageCount: z.number().int().nonnegative(),
    }),
  }),
});

export type RecordData = {
  artistName: string;
  coverUrl: string;
  giver: string | null;
  receivedOn: Date;
  slug: string;
  title: string;
};

type RuntimeConfig = {
  retryAttempts: number;
  strapiApiToken: string;
  strapiPublicUrl: string;
  strapiUrl: string;
};

type StrapiRecord = z.infer<typeof strapiRecordSchema>;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  envName: string
): number {
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${envName} must be a positive number when set`);
  }

  return Math.floor(parsed);
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }

  return value;
}

function getRuntimeConfig(): RuntimeConfig {
  const strapiUrl = requireEnv('STRAPI_URL');
  const strapiPublicUrl = process.env.STRAPI_PUBLIC_URL?.trim() || strapiUrl;

  return {
    retryAttempts: parsePositiveInt(
      process.env.STRAPI_FETCH_RETRIES,
      DEFAULT_RETRY_ATTEMPTS,
      'STRAPI_FETCH_RETRIES'
    ),
    strapiApiToken: requireEnv('STRAPI_API_TOKEN'),
    strapiPublicUrl,
    strapiUrl,
  };
}

function sortRecords(
  recordA: LiveDataEntry<RecordData>,
  recordB: LiveDataEntry<RecordData>
): number {
  let artistA = recordA.data.artistName;
  if (artistA.toLocaleLowerCase().startsWith('the ')) {
    artistA = artistA.substring(4);
  }

  let artistB = recordB.data.artistName;
  if (artistB.toLocaleLowerCase().startsWith('the ')) {
    artistB = artistB.substring(4);
  }

  return artistA.localeCompare(artistB);
}

function toPublicAssetUrl(assetUrl: string, publicBaseUrl: string): string {
  if (/^https?:\/\//.test(assetUrl)) {
    return assetUrl;
  }

  return new URL(assetUrl, publicBaseUrl).toString();
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toLiveRecordEntry(
  record: StrapiRecord,
  config: RuntimeConfig
): LiveDataEntry<RecordData> {
  return {
    id: record.slug,
    data: {
      artistName: record.artist.name,
      coverUrl: toPublicAssetUrl(record.coverArt.url, config.strapiPublicUrl),
      giver: record.giver,
      receivedOn: record.receivedOn,
      slug: record.slug,
      title: record.title,
    },
    cacheHint: {
      lastModified: record.updatedAt,
      tags: [
        RECORDS_COLLECTION_TAG,
        `${RECORDS_COLLECTION_TAG}:${record.slug}`,
      ],
    },
  };
}

function toCollectionCacheHint(
  entries: Array<LiveDataEntry<RecordData>>
): LiveDataCollection<RecordData>['cacheHint'] {
  const lastModified = entries.reduce<Date | undefined>((latest, entry) => {
    const candidate = entry.cacheHint?.lastModified;
    if (!candidate) {
      return latest;
    }

    return !latest || candidate > latest ? candidate : latest;
  }, undefined);

  return {
    ...(lastModified ? { lastModified } : {}),
    tags: [RECORDS_COLLECTION_TAG],
  };
}

async function fetchJsonWithRetries(
  url: string,
  headers: HeadersInit,
  retryAttempts: number
): Promise<unknown> {
  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    let response: Response;

    try {
      response = await fetch(url, { headers });
    } catch (error) {
      if (attempt < retryAttempts) {
        await delay(1000 * 2 ** (attempt - 1));
        continue;
      }

      throw error;
    }

    if (!response.ok) {
      const isRetryable =
        response.status === 408 ||
        response.status === 429 ||
        response.status >= 500;

      if (isRetryable && attempt < retryAttempts) {
        await delay(1000 * 2 ** (attempt - 1));
        continue;
      }

      throw new Error(
        `Failed to fetch Strapi records: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  throw new Error('Failed to fetch Strapi records after retries');
}

async function fetchRecordsPage(
  page: number,
  config: RuntimeConfig,
  slug?: string
): Promise<z.infer<typeof strapiRecordsPageSchema>> {
  const query = qs.stringify(
    {
      filters: slug
        ? {
            slug: {
              $eq: slug,
            },
          }
        : undefined,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
      },
      populate: ['artist', 'coverArt'],
    },
    { encodeValuesOnly: true }
  );

  const url = new URL(`/api/records?${query}`, config.strapiUrl);
  const json = await fetchJsonWithRetries(
    url.toString(),
    {
      Authorization: `Bearer ${config.strapiApiToken}`,
    },
    config.retryAttempts
  );

  return strapiRecordsPageSchema.parse(json);
}

async function fetchAllRecords(
  config: RuntimeConfig
): Promise<Array<LiveDataEntry<RecordData>>> {
  const records: Array<LiveDataEntry<RecordData>> = [];
  let page = 1;
  let pageCount = 1;

  while (page <= pageCount) {
    const response = await fetchRecordsPage(page, config);
    pageCount = response.meta.pagination.pageCount;

    records.push(
      ...response.data.map((record) => toLiveRecordEntry(record, config))
    );

    page += 1;
  }

  return records.sort(sortRecords);
}

async function fetchRecordBySlug(
  slug: string,
  config: RuntimeConfig
): Promise<LiveDataEntry<RecordData> | undefined> {
  const response = await fetchRecordsPage(1, config, slug);
  const record = response.data[0];

  return record ? toLiveRecordEntry(record, config) : undefined;
}

export function recordsLoader(): LiveLoader<RecordData> {
  return {
    name: 'strapi-records-loader',
    loadCollection: async () => {
      try {
        const config = getRuntimeConfig();
        const entries = await fetchAllRecords(config);

        return {
          cacheHint: toCollectionCacheHint(entries),
          entries,
        };
      } catch (error) {
        return {
          error: new Error(
            `Unable to load records collection: ${toErrorMessage(error)}`
          ),
        };
      }
    },
    loadEntry: async ({ filter }) => {
      try {
        const config = getRuntimeConfig();
        return await fetchRecordBySlug(filter.id, config);
      } catch (error) {
        return {
          error: new Error(`Unable to load record: ${toErrorMessage(error)}`),
        };
      }
    },
  };
}
