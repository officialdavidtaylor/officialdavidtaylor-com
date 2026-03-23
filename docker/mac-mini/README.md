# Mac Mini Deployment

This deployment bundle is the recommended production path when all CMS services run on a single Mac Mini.

This is a registry-mode deployment. The Mac Mini does not build the `web` or `strapi` images locally; it pulls prebuilt images from your personal registry.

Files:

- `docker-compose.production.yml`
- `.env.mac-mini.example`
- `cloudflared/config.yml.example`
- `cloudflared/credentials/`

Why Compose instead of Swarm:

- this is a single-node deployment, so Swarm does not add useful scheduling or failover
- Compose is simpler to operate, debug, back up, and restore on a personal host
- `cloudflared`, Postgres, MinIO, and Strapi all fit cleanly into one stack without overlay networking or Swarm secrets

Registry mode:

- build and push `web` and `strapi` images from your development machine
- pin immutable semver tags in `.env.mac-mini`
- let the Mac Mini only `pull` and restart containers
- release tooling supports targeted image builds: `yarn docker:build:release strapi` or `yarn docker:build:release web`

Prerequisites:

- Docker Desktop or Docker Engine running on the Mac Mini
- access to `registry.emfsoft.com` from both your development machine and the Mac Mini
- a Cloudflare named tunnel with credentials JSON available for the Mac Mini
- a valid Strapi read-only API token for the `web` runtime

Recommended stack on the Mac Mini:

- `web`
- `postgres`
- `minio`
- `minio-init`
- `strapi`
- `cloudflared`

Bootstrap flow

This is the recommended first-time deployment order.

### 1. Build and publish `strapi` from your development machine

From the repo root on your development machine:

```bash
docker login registry.emfsoft.com
yarn docker:build:release strapi
yarn docker:push:release strapi
```

This tags the `strapi` image as `<semver>` and `latest`, using the root `package.json` version as the source of truth.

### 2. Prepare the Mac Mini

On the Mac Mini:

```bash
git clone <repo-url>
cd officialdavidtaylor-com/docker/mac-mini
docker login registry.emfsoft.com
cp .env.mac-mini.example .env.mac-mini
cp cloudflared/config.yml.example cloudflared/config.yml
```

Then:

1. set `STRAPI_IMAGE` in `.env.mac-mini` to the tag you just pushed
2. fill in the Postgres, MinIO, and Strapi secret values
3. place the named tunnel credentials JSON in `cloudflared/credentials/`

### 3. Start the CMS-side services on the Mac Mini

Start everything except `web` first:

```bash
docker compose -f docker-compose.production.yml --env-file .env.mac-mini pull strapi
docker compose -f docker-compose.production.yml --env-file .env.mac-mini up -d postgres minio minio-init strapi cloudflared
```

Then verify:

- local CMS admin: `http://127.0.0.1:1337/admin`
- local MinIO console: `http://127.0.0.1:9001`
- Cloudflare routes for `cms.officialdavidtaylor.com` and `media.officialdavidtaylor.com`

### 4. Create the first Strapi admin, issue a read-only API token, and configure the webhook

After Strapi is up on the Mac Mini:

1. open `http://127.0.0.1:1337/admin`
2. create the first administrator account
3. create a read-only API token for the `web` runtime
4. put that token into `WEB_STRAPI_API_TOKEN` in `.env.mac-mini`
5. set `WEB_RECORDS_INVALIDATE_SECRET` in `.env.mac-mini`
6. create a Strapi webhook that `POST`s to `http://web:4321/api/invalidate/records`
7. include the header `x-records-invalidate-secret: <WEB_RECORDS_INVALIDATE_SECRET>`

### 5. Build and publish `web` from your development machine

From the repo root on your development machine:

```bash
yarn docker:build:release web
yarn docker:push:release web
```

This tags the `web` image as `<semver>` and `latest`, using the same release version as `strapi`. Record data is fetched at runtime, not baked into the image.

### 6. Start `web` on the Mac Mini

Update `WEB_IMAGE` in `.env.mac-mini`, then:

```bash
docker compose -f docker-compose.production.yml --env-file .env.mac-mini pull web
docker compose -f docker-compose.production.yml --env-file .env.mac-mini up -d web
```

Final checks:

- `officialdavidtaylor.com` and `www.officialdavidtaylor.com` resolve to the `web` container
- `cms.officialdavidtaylor.com` resolves to Strapi
- `media.officialdavidtaylor.com` resolves to MinIO
- local verification still works on `http://127.0.0.1:4321`, `http://127.0.0.1:1337/admin`, and `http://127.0.0.1:9001`

Operational notes:

- `cloudflared/config.yml` expects a named tunnel credentials JSON under `cloudflared/credentials/`
- the tunnel config routes `officialdavidtaylor.com` and `www.officialdavidtaylor.com` to the internal `web` service
- the tunnel config routes `cms.officialdavidtaylor.com` to the internal `strapi` service and `media.officialdavidtaylor.com` to the internal `minio` service
- Postgres stays private inside the Compose network
- the `web`, `strapi`, and MinIO console ports are bound to `127.0.0.1` on the host for local troubleshooting without exposing them on the LAN
- `/my-record-collection` is server-rendered on demand and uses a process-local cache inside the `web` container
- record updates should trigger the Strapi webhook so the `web` cache is cleared and rewarmed immediately

Build and publish flow on your development machine:

1. If this repo has no release tags yet, seed the initial baseline once:
   `yarn version:init`
2. Check the next semver bump from conventional commits:
   `yarn version:check`
3. Apply the bump to `package.json` files:
   `yarn version:bump`
4. Build and push `strapi` first:
   `yarn docker:build:release strapi && yarn docker:push:release strapi`
5. Build and push `web`:
   `yarn docker:build:release web && yarn docker:push:release web`

Update flow:

1. On your development machine, use conventional commits so the next bump is derived from commit prefixes
2. Run `yarn version:check`, then `yarn version:bump` when you are ready to cut a release
3. Build and push the new semver-tagged images from your development machine
4. On the Mac Mini, `git pull` if the deployment config changed
5. Update image tags in `.env.mac-mini`
6. Pull before restart: `docker compose -f docker-compose.production.yml --env-file .env.mac-mini pull web strapi`
7. Restart CMS only if its image changed: `docker compose -f docker-compose.production.yml --env-file .env.mac-mini up -d --no-deps strapi`
8. Restart the main site only if its image changed: `docker compose -f docker-compose.production.yml --env-file .env.mac-mini up -d --no-deps web`
9. If infrastructure config changed, run `docker compose -f docker-compose.production.yml --env-file .env.mac-mini up -d` for the full stack

This is the recommended minimal-downtime path for the Mac Mini setup. It does not provide true zero-downtime, but it keeps restarts scoped to the app containers while Postgres, MinIO, and `cloudflared` stay up.

One important operational consequence:

- changes in Strapi record content should appear without rebuilding `web`
- the supported fast path is: Strapi webhook -> `/api/invalidate/records` -> cache clear + synchronous rewarm
- if the webhook is unavailable, the records cache will eventually refresh when its TTL expires
