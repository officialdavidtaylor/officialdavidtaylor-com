FROM node:22-bookworm-slim AS base

ENV CI=1
ENV HUSKY=0

RUN corepack enable

WORKDIR /app

FROM base AS manifests

COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/strapi-cms/package.json ./apps/strapi-cms/package.json

FROM manifests AS deps-production

RUN yarn install --immutable
RUN yarn workspaces focus --production

FROM deps-production AS build

COPY . .

RUN yarn build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

WORKDIR /app

COPY --from=deps-production --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

USER node

EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]
