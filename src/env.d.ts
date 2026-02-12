interface ImportMetaEnv {
  readonly STRAPI_URL: string;
  readonly STRAPI_PUBLIC_URL?: string;
  readonly STRAPI_API_TOKEN: string;
  readonly STRAPI_FETCH_RETRIES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
