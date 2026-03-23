export const prerender = false;

import {
  getInvalidateSecretHeader,
  isInvalidateSecretValid,
  refreshRecordsCache,
} from 'lib/server/records';

function methodNotAllowed(): Response {
  return new Response('Method Not Allowed', {
    headers: {
      Allow: 'POST',
    },
    status: 405,
  });
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;

export async function POST({ request }: { request: Request }): Promise<Response> {
  const secret = request.headers.get(getInvalidateSecretHeader());

  try {
    if (!isInvalidateSecretValid(secret)) {
      return new Response('Unauthorized', { status: 401 });
    }

    await refreshRecordsCache();
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Failed to invalidate and repopulate records cache', error);
    return new Response('Unable to refresh records cache', { status: 500 });
  }
}
