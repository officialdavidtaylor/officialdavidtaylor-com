FROM node:22-bookworm-slim AS build

ENV CI=1

RUN corepack enable

WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
COPY apps/strapi-cms/package.json ./apps/strapi-cms/package.json

RUN yarn install --immutable

COPY apps/strapi-cms ./apps/strapi-cms

RUN yarn workspace strapi-cms build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

RUN corepack enable

WORKDIR /app

COPY --from=build /app /app

RUN chown -R node:node /app

USER node

EXPOSE 1337

CMD ["yarn", "workspace", "strapi-cms", "start"]
