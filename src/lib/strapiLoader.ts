import { vinylEntrySchema } from 'interfaces/VinylEntry';

/**
 * Fetches data from the Strapi API
 * @param path The API endpoint path
 * @param params Optional query parameters
 * @returns The JSON response from the API
 */
export async function strapiLoader<T = any>(
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(path, import.meta.env.STRAPI_URL);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  try {
    const response = await fetch(url.href, {
      headers: { Authorization: `Bearer ${import.meta.env.STRAPI_API_TOKEN}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from Strapi: ${response.statusText}`);
    }

    const { data } = await response.json();

    return data;
  } catch (error) {
    console.error(`Error fetching from Strapi: ${(error as Error).message}`);
    throw error; // Re-throw the error for the caller to handle
  }
}

// Ensure the required environment variable is set
function checkEnvironmentVariables() {
  if (!import.meta.env.STRAPI_URL) {
    throw new Error('STRAPI_URL environment variable is not set');
  }
}

// Ensure environment variables are set before proceeding
checkEnvironmentVariables();
