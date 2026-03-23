const parseOrigin = (value?: string) => {
  if (!value) return undefined;

  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
};

const withOptional = (items: string[], value?: string) =>
  value ? [...items, value] : items;

const parseCorsOrigins = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(
      'CORS_ORIGIN must be a JSON array of origin strings when set'
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      'CORS_ORIGIN must be a JSON array of origin strings when set'
    );
  }

  return parsed
    .map((item) => {
      const origin = parseOrigin(String(item).trim());
      if (!origin) {
        throw new Error('CORS_ORIGIN entries must be valid origins');
      }

      return origin;
    })
    .filter(Boolean);
};

export default ({ env }) => {
  const isProduction = env('NODE_ENV', 'development') === 'production';
  const mediaOrigin =
    parseOrigin(env('S3_PUBLIC_URL', '')) ||
    parseOrigin(env('S3_ENDPOINT', ''));
  const corsOrigins = parseCorsOrigins(env('CORS_ORIGIN', ''));

  if (isProduction && corsOrigins.length === 0) {
    throw new Error(
      'CORS_ORIGIN must be set to a JSON array of allowed origins when NODE_ENV=production'
    );
  }

  return [
    'strapi::logger',
    'strapi::errors',
    {
      name: 'strapi::security',
      config: {
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            'img-src': withOptional(["'self'", 'data:', 'blob:'], mediaOrigin),
            'media-src': withOptional(
              ["'self'", 'data:', 'blob:'],
              mediaOrigin
            ),
            'connect-src': withOptional(["'self'", 'https:'], mediaOrigin),
          },
        },
      },
    },
    {
      name: 'strapi::cors',
      config: {
        origin: corsOrigins.length > 0 ? corsOrigins : '*',
        credentials: env.bool('CORS_CREDENTIALS', true),
      },
    },
    'strapi::poweredBy',
    'strapi::query',
    'strapi::body',
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];
};
