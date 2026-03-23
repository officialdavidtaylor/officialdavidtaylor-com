import qs from 'qs';
import { z } from 'astro/zod';

const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_CACHE_TTL_SECONDS = 60 * 60;
const PAGE_SIZE = 100;
const INVALIDATE_SECRET_HEADER = 'x-records-invalidate-secret';

const strapiRecordSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
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

export type RecordEntry = {
  artistName: string;
  coverUrl: string;
  giver: string | null;
  receivedOn: Date;
  slug: string;
  title: string;
};

type RuntimeConfig = {
  cacheTtlMs: number;
  invalidateSecret: string | undefined;
  retryAttempts: number;
  strapiApiToken: string;
  strapiPublicUrl: string;
  strapiUrl: string;
};

type CacheEntry = {
  expiresAt: number;
  value: RecordEntry[];
};

let cache: CacheEntry | null = null;
let inflight: Promise<RecordEntry[]> | null = null;

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
    cacheTtlMs:
      parsePositiveInt(
        process.env.RECORDS_CACHE_TTL_SECONDS,
        DEFAULT_CACHE_TTL_SECONDS,
        'RECORDS_CACHE_TTL_SECONDS'
      ) * 1000,
    invalidateSecret: process.env.RECORDS_INVALIDATE_SECRET?.trim(),
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

function sortRecords(recordA: RecordEntry, recordB: RecordEntry): number {
  let artistA = recordA.artistName;
  if (artistA.toLocaleLowerCase().startsWith('the ')) {
    artistA = artistA.substring(4);
  }

  let artistB = recordB.artistName;
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
  config: RuntimeConfig
): Promise<z.infer<typeof strapiRecordsPageSchema>> {
  const query = qs.stringify(
    {
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

async function fetchAllRecords(config: RuntimeConfig): Promise<RecordEntry[]> {
  const records: RecordEntry[] = [];
  let page = 1;
  let pageCount = 1;

  while (page <= pageCount) {
    const response = await fetchRecordsPage(page, config);
    pageCount = response.meta.pagination.pageCount;

    records.push(
      ...response.data.map((record) => ({
        artistName: record.artist.name,
        coverUrl: toPublicAssetUrl(record.coverArt.url, config.strapiPublicUrl),
        giver: record.giver,
        receivedOn: record.receivedOn,
        slug: record.slug,
        title: record.title,
      }))
    );

    page += 1;
  }

  return records.sort(sortRecords);
}

async function populateCache(): Promise<RecordEntry[]> {
  if (inflight) {
    return inflight;
  }

  inflight = (async () => {
    const config = getRuntimeConfig();
    const records = await fetchAllRecords(config);
    cache = {
      expiresAt: Date.now() + config.cacheTtlMs,
      value: records,
    };

    return records;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

export async function getRecords(): Promise<RecordEntry[]> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.value;
  }

  return populateCache();
}

export async function refreshRecordsCache(): Promise<RecordEntry[]> {
  cache = null;
  inflight = null;

  return populateCache();
}

export function getInvalidateSecretHeader(): string {
  return INVALIDATE_SECRET_HEADER;
}

export function isInvalidateSecretValid(secret: string | null): boolean {
  const configuredSecret = getRuntimeConfig().invalidateSecret;
  if (!configuredSecret) {
    throw new Error('RECORDS_INVALIDATE_SECRET environment variable is not set');
  }

  return secret === configuredSecret;
}
