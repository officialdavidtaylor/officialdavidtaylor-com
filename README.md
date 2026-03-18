# Welcome

[![Build Status](https://api.netlify.com/api/v1/badges/134d63c6-bf04-4155-b8d1-41d144cd7f2b/deploy-status)](https://app.netlify.com/sites/odt-personal-site/deploys)

This is the repo behind my [personal website](https://officialdavidtaylor.com).

The goal of this site is to build a digital space that I can use for self expression; a site that I can cultivate to better express and refine my own thoughts. (also, it will hopefully become a portfolio piece I'm proud of)

## Goals

- [ ] Essay repository -- _I want to write more... and what better place to do that than in public 😵‍💫_
- [ ] Recipe functionality -- _initially just rendered markdown files, eventually a culinary experimentation platform_
- [ ] Social feed -- _A place to serve photo and text content that isn't mediated by social media megacorps_
- [ ] ...

## Stack

It's a modern TS frontend web app stack:

- **Astro** → using TypeScript
- **tailwindcss** → because it just clicks in my brain somehow

## Monorepo

This repository now runs as a Yarn 4 workspace monorepo:

- `officialdavidtaylor-com` (Astro web app, repo root)
- `apps/strapi-cms` (Strapi CMS)

## Deployment Notes

The Strapi CMS deployment plan (distributed devices, remote Postgres + MinIO, Cloudflare Tunnel layout, and production `.env` checklist) lives in:

- `apps/strapi-cms/README.md`
- `docker/mac-mini/README.md` for the single-host Mac Mini deployment path

## Local Development

### Yarn

Start the CMS:

```bash
yarn dev:cms
```

Start the web app:

```bash
yarn dev
```

### Docker Compose

Spin up the full local stack (web + cms + postgres + minio):

```bash
yarn docker:up
```

Tear it down:

```bash
yarn docker:down
```
