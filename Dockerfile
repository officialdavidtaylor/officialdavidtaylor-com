FROM node:22-bookworm-slim AS build

ENV CI=1
ENV HUSKY=0

RUN corepack enable

WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
COPY apps/strapi-cms/package.json ./apps/strapi-cms/package.json

RUN yarn install --immutable

COPY . .

RUN yarn build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
ENV HUSKY=0

RUN corepack enable

WORKDIR /app

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/yarn.lock ./yarn.lock
COPY --from=build /app/.yarnrc.yml ./.yarnrc.yml
COPY --from=build /app/.yarn ./.yarn
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

RUN chown -R node:node /app

USER node

EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]
