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

  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      throw new Error('CORS_ORIGIN must be a JSON array when using JSON syntax');
    }

    return parsed
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  return [trimmed];
};

export default ({ env }) => {
  const mediaOrigin =
    parseOrigin(env('S3_PUBLIC_URL', '')) || parseOrigin(env('S3_ENDPOINT', ''));
  const corsOrigins = parseCorsOrigins(env('CORS_ORIGIN', ''));

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
            'media-src': withOptional(["'self'", 'data:', 'blob:'], mediaOrigin),
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
