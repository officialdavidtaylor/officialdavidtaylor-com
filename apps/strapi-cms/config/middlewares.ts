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

const parseCsv = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export default ({ env }) => {
  const mediaOrigin =
    parseOrigin(env('S3_PUBLIC_URL', '')) || parseOrigin(env('S3_ENDPOINT', ''));
  const corsOrigins = parseCsv(env('CORS_ORIGIN', ''));

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
