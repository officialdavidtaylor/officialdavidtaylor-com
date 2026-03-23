type EnvFn = {
  (key: string, defaultValue?: string): string;
  int: (key: string, defaultValue?: number) => number;
  bool: (key: string, defaultValue?: boolean) => boolean;
};

const getOptional = (env: EnvFn, key: string) => {
  const value = env(key, '');
  return value.trim() ? value : undefined;
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

  const publicUrl = getOptional(env, 'S3_PUBLIC_URL');
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
            forcePathStyle: env.bool('S3_FORCE_PATH_STYLE', true),
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
