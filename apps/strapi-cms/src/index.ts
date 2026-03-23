import type { Core } from '@strapi/strapi';

const INVALIDATE_SECRET_HEADER = 'x-records-invalidate-secret';
const INVALIDATE_TIMEOUT_MS = 5000;
const INVALIDATED_MODELS = ['api::record.record', 'api::artist.artist'] as const;
const INVALIDATED_MODEL_SET = new Set<string>(INVALIDATED_MODELS);
const INVALIDATED_ACTIONS = new Set([
  'create',
  'update',
  'delete',
  'publish',
  'unpublish',
  'discardDraft',
]);

type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

type InvalidateFn = (reason: string) => Promise<void>;

const getOptionalEnv = (name: string) => {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
};

const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const createRecordsCacheInvalidator = ({
  invalidateUrl,
  invalidateSecret,
  logger,
  fetchImpl = fetch,
}: {
  invalidateUrl?: string;
  invalidateSecret?: string;
  logger: Logger;
  fetchImpl?: typeof fetch;
}): InvalidateFn | null => {
  if (!invalidateUrl && !invalidateSecret) {
    logger.info(
      'Records cache invalidation is disabled; set RECORDS_INVALIDATE_URL and RECORDS_INVALIDATE_SECRET to enable it'
    );
    return null;
  }

  if (!invalidateUrl || !invalidateSecret) {
    logger.warn(
      'Records cache invalidation is partially configured; set both RECORDS_INVALIDATE_URL and RECORDS_INVALIDATE_SECRET'
    );
    return null;
  }

  let inflight: Promise<void> | null = null;

  return async (reason: string) => {
    if (inflight) {
      return inflight;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), INVALIDATE_TIMEOUT_MS);

    inflight = fetchImpl(invalidateUrl, {
      method: 'POST',
      headers: {
        [INVALIDATE_SECRET_HEADER]: invalidateSecret,
      },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new Error(
            `Cache rewarm failed with ${response.status} ${response.statusText}${body ? `: ${body}` : ''}`
          );
        }

        logger.info(`Rewarmed records cache after ${reason}`);
      })
      .catch((error) => {
        logger.warn(
          `Unable to rewarm records cache after ${reason}: ${toErrorMessage(error)}`
        );
      })
      .finally(() => {
        clearTimeout(timeout);
        inflight = null;
      });

    return inflight;
  };
};

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap({ strapi }: { strapi: Core.Strapi }) {
    const invalidateRecordsCache = createRecordsCacheInvalidator({
      invalidateUrl: getOptionalEnv('RECORDS_INVALIDATE_URL'),
      invalidateSecret: getOptionalEnv('RECORDS_INVALIDATE_SECRET'),
      logger: strapi.log,
    });

    if (!invalidateRecordsCache) {
      return;
    }

    strapi.documents.use(async (ctx, next) => {
      const result = await next();

      if (
        INVALIDATED_MODEL_SET.has(ctx.uid) &&
        INVALIDATED_ACTIONS.has(ctx.action)
      ) {
        await invalidateRecordsCache(`${ctx.uid} ${ctx.action}`);
      }

      return result;
    });

    strapi.log.info('Records cache invalidation document middleware is enabled');
  },
};
