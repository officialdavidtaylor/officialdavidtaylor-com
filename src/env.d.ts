interface ImportMetaEnv {
  readonly STRAPI_URL: string;
  readonly STRAPI_API_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
