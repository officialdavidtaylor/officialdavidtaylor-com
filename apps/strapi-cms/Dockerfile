FROM node:22-bookworm-slim AS base

ENV CI=1

RUN corepack enable

WORKDIR /app

FROM base AS manifests

COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/strapi-cms/package.json ./apps/strapi-cms/package.json

FROM manifests AS deps-production

RUN yarn install --immutable
RUN yarn workspaces focus strapi-cms --production

FROM deps-production AS build

COPY apps/strapi-cms ./apps/strapi-cms

RUN yarn workspace strapi-cms build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/yarn.lock ./yarn.lock
COPY --from=build --chown=node:node /app/.yarnrc.yml ./.yarnrc.yml
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/strapi-cms/package.json ./apps/strapi-cms/package.json
COPY --from=build --chown=node:node /app/apps/strapi-cms/dist ./apps/strapi-cms/dist
COPY --from=build --chown=node:node /app/apps/strapi-cms/public ./apps/strapi-cms/public
COPY --from=build --chown=node:node /app/apps/strapi-cms/database ./apps/strapi-cms/database
COPY --from=build --chown=node:node /app/apps/strapi-cms/favicon.png ./apps/strapi-cms/favicon.png

WORKDIR /app/apps/strapi-cms

USER node

EXPOSE 1337

CMD ["node", "/app/node_modules/@strapi/strapi/bin/strapi.js", "start"]
