type EnvFn = {
  (key: string, defaultValue?: string): string;
  int: (key: string, defaultValue?: number) => number;
  bool: (key: string, defaultValue?: boolean) => boolean;
};

const getOptional = (env: EnvFn, key: string) => {
  const value = env(key, '');
  return value.trim() ? value : undefined;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const normalizePublicUrl = ({
  publicUrl,
  bucket,
  forcePathStyle,
}: {
  publicUrl?: string;
  bucket: string;
  forcePathStyle: boolean;
}) => {
  if (!publicUrl) {
    return undefined;
  }

  const trimmed = trimTrailingSlash(publicUrl);

  if (!forcePathStyle) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const bucketPath = `/${bucket}`;

    if (
      url.pathname === bucketPath ||
      url.pathname.startsWith(`${bucketPath}/`)
    ) {
      return trimmed;
    }

    if (url.pathname && url.pathname !== '/') {
      return trimmed;
    }

    return `${trimmed}${bucketPath}`;
  } catch {
    return trimmed;
  }
};

export default ({ env }) => {
  const endpoint = getOptional(env, 'S3_ENDPOINT');
  const accessKeyId = getOptional(env, 'S3_ACCESS_KEY_ID');
  const secretAccessKey = getOptional(env, 'S3_SECRET_ACCESS_KEY');
  const bucket = getOptional(env, 'S3_BUCKET');

  // Fall back to Strapi's default local provider when S3/MinIO env vars are not set.
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    return {};
  }

  const forcePathStyle = env.bool('S3_FORCE_PATH_STYLE', true);
  const publicUrl = normalizePublicUrl({
    publicUrl: getOptional(env, 'S3_PUBLIC_URL'),
    bucket,
    forcePathStyle,
  });
  const rootPath = getOptional(env, 'S3_ROOT_PATH');
  const acl = getOptional(env, 'S3_ACL');

  return {
    upload: {
      config: {
        provider: 'aws-s3',
        providerOptions: {
          ...(publicUrl ? { baseUrl: publicUrl } : {}),
          ...(rootPath ? { rootPath } : {}),
          s3Options: {
            endpoint,
            region: env('S3_REGION', 'us-east-1'),
            forcePathStyle,
            credentials: {
              accessKeyId,
              secretAccessKey,
            },
            params: {
              Bucket: bucket,
              ...(acl ? { ACL: acl } : {}),
              ...(env.bool('S3_USE_SIGNED_URLS', false)
                ? {
                    signedUrlExpires: env.int('S3_SIGNED_URL_EXPIRES', 900),
                  }
                : {}),
            },
          },
        },
      },
    },
  };
};
