/**
 * Fetches data from the Strapi API
 * @param path The API endpoint path
 * @param params Optional query parameters
 * @returns The JSON response from the API
 */
const DEFAULT_RETRY_ATTEMPTS = 3;
const INITIAL_BACKOFF_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseRetryAttempts(raw: string | undefined): number {
  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_RETRY_ATTEMPTS;
  }

  return Math.floor(parsed);
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export async function strapiLoader<T = any>(
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(path, import.meta.env.STRAPI_URL);
  const maxAttempts = parseRetryAttempts(import.meta.env.STRAPI_FETCH_RETRIES);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response: Response;

    try {
      response = await fetch(url.href, {
        headers: {
          Authorization: `Bearer ${import.meta.env.STRAPI_API_TOKEN}`,
        },
      });
    } catch (error) {
      if (attempt < maxAttempts) {
        const backoffMs = INITIAL_BACKOFF_MS * 2 ** (attempt - 1);
        await delay(backoffMs);
        continue;
      }

      console.error(`Error fetching from Strapi: ${(error as Error).message}`);
      throw error;
    }

    if (!response.ok) {
      const error = new Error(
        `Failed to fetch from Strapi: ${response.status} ${response.statusText}`
      );

      if (attempt < maxAttempts && isRetryableStatus(response.status)) {
        const backoffMs = INITIAL_BACKOFF_MS * 2 ** (attempt - 1);
        await delay(backoffMs);
        continue;
      }

      console.error(`Error fetching from Strapi: ${error.message}`);
      throw error;
    }

    const { data } = await response.json();
    return data;
  }

  throw new Error('Failed to fetch from Strapi after retries');
}

// Ensure the required environment variable is set
function checkEnvironmentVariables() {
  if (!import.meta.env.STRAPI_URL) {
    throw new Error('STRAPI_URL environment variable is not set');
  }
}

// Ensure environment variables are set before proceeding
checkEnvironmentVariables();
