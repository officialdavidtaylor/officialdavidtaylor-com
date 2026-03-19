FROM node:22-bookworm-slim AS build

ENV CI=1

ARG STRAPI_URL
ARG STRAPI_PUBLIC_URL
ARG STRAPI_API_TOKEN
ARG STRAPI_FETCH_RETRIES=3

ENV STRAPI_URL=$STRAPI_URL
ENV STRAPI_PUBLIC_URL=$STRAPI_PUBLIC_URL
ENV STRAPI_API_TOKEN=$STRAPI_API_TOKEN
ENV STRAPI_FETCH_RETRIES=$STRAPI_FETCH_RETRIES

RUN corepack enable

WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
COPY apps/strapi-cms/package.json ./apps/strapi-cms/package.json

RUN yarn install --immutable

COPY . .

RUN yarn build

FROM nginx:1.27-alpine AS runtime

COPY docker/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
