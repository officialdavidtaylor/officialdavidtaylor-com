FROM node:22-bookworm-slim AS base

ENV CI=1
ENV HUSKY=0

RUN corepack enable

WORKDIR /app

FROM base AS manifests

COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/strapi-cms/package.json ./apps/strapi-cms/package.json

FROM manifests AS deps

RUN yarn install --immutable

FROM deps AS deps-production

RUN yarn workspaces focus --production

FROM deps AS build-dev

COPY . .

RUN yarn build

FROM deps-production AS build-prod

COPY . .

RUN yarn build

FROM node:22-bookworm-slim AS runtime-dev

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
ENV HUSKY=0

RUN corepack enable

WORKDIR /app

COPY --from=build-dev /app/package.json ./package.json
COPY --from=build-dev /app/yarn.lock ./yarn.lock
COPY --from=build-dev /app/.yarnrc.yml ./.yarnrc.yml
COPY --from=build-dev /app/node_modules ./node_modules
COPY --from=build-dev /app/dist ./dist

RUN chown -R node:node /app

USER node

EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]

FROM node:22-bookworm-slim AS runtime-prod

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

WORKDIR /app

COPY --from=build-prod --chown=node:node /app/dist ./dist

USER node

EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]
