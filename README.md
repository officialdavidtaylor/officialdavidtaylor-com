# Welcome

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

The containerized deployment plan lives in:

- `apps/strapi-cms/README.md`
- `docker/mac-mini/README.md` for the single-host Mac Mini deployment path

The `web` service now runs Astro in Node standalone mode. Most pages remain statically prerendered, while `/my-record-collection` is server-rendered on demand from Strapi with an in-memory TTL cache plus a webhook-driven rewarm route.

## Release Workflow

This repo now uses conventional commits plus GitHub Actions-driven releases.

- pushes to `main` run `semantic-release`, which calculates the next semver tag from conventional commits and creates the matching GitHub release
- new `v*` tags trigger the image workflow, which builds and pushes both the `web` and `strapi-cms` images to the registry
- the `web` image no longer bakes record data in at build time; runtime Strapi access and cache invalidation are configured through environment variables on the deployed container

Conventional commit enforcement is installed via Husky on `yarn install`.

### Local Workflow Iteration

Install the local workflow tooling once:

```bash
brew install act actionlint
```

Useful local commands:

- `yarn workflow:lint` validates the workflow files with `actionlint`
- `yarn release:dry-run` runs `semantic-release` locally without creating tags or releases
- `yarn workflow:release-tag:local` runs the release-tag workflow through `act` using `.github/act-secrets.local`
- `yarn workflow:release-images:local` runs the image workflow through `act` using `.github/act-secrets.local`

Use the repo's `.nvmrc` first so the host Node version matches the release workflow expectation. `semantic-release` currently requires Node `22.14+` or `24.10+`, and the GitHub workflows are pinned to Node `22`.

Repo fixtures for local Actions runs:

- `.actrc` pins the local runner image for `act`
- `.github/events/main-push.json` simulates a push to `main`
- `.github/events/tag-push.json` simulates a `v*` tag push
- `.github/act-secrets.example` shows the secrets file shape for `act --secret-file`

Typical local loop:

```bash
nvm use
cp .github/act-secrets.example .github/act-secrets.local
yarn workflow:lint
yarn release:dry-run
act push -W .github/workflows/release-tag.yml \
  -e .github/events/main-push.json \
  --secret-file .github/act-secrets.local
```

For the image workflow, use the same `--secret-file` and swap in `.github/events/tag-push.json`.

## Local Development

### Yarn

Create a root `.env` from `.env.example` and set a valid Strapi API token plus a cache invalidation secret before starting the web app.

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

The local `web` container expects:

- `STRAPI_API_TOKEN`
- `RECORDS_INVALIDATE_SECRET`

The records cache can be refreshed manually with:

```bash
curl -X POST \
  -H "x-records-invalidate-secret: <your-secret>" \
  http://127.0.0.1:4321/api/invalidate/records
```

## Records Cutover

The legacy markdown record source now lives under `scripts/records-import/source`.

Import it into Strapi with:

```bash
yarn records:import
```

Required environment variables for the import script:

- `STRAPI_URL`
- `STRAPI_API_TOKEN`
