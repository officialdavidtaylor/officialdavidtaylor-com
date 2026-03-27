# Mac Mini Deployment

This deployment bundle is the recommended production path when all CMS services run on a single Mac Mini.

This is a registry-mode deployment. The Mac Mini does not build the `web` or `strapi` images locally; it pulls prebuilt images from GitHub Container Registry (`ghcr.io`).

Files:

- `docker-compose.production.yml`
- `.env.mac-mini.example`

This stack is designed to run with `docker compose` on the Mac Mini.

Registry mode:

- let GitHub Actions build and push `web` and `strapi` images after release tags are created
- pin immutable semver tags in `.env.mac-mini`
- let the Mac Mini only `pull` and restart containers

Prerequisites:

- Docker Desktop or Docker Engine running on the Mac Mini
- access to `ghcr.io` from both your development machine and the Mac Mini
- a GitHub username plus a token that can pull GHCR images (for example, a PAT with `read:packages`) if the packages remain private
- a remote-managed Cloudflare Tunnel token for the Mac Mini tunnel
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

### 1. Prepare release automation

Merge the release-enabled branch into `main`, then let GitHub Actions:

- calculate the next semantic version from conventional commits
- create the matching `v<semver>` git tag
- chain into the image workflow, which builds and pushes `strapi-cms` and `web` for that tag

Wait for the release workflows to publish the first image tags before continuing.

### 2. Prepare the Mac Mini

On the Mac Mini:

```bash
git clone <repo-url>
cd officialdavidtaylor-com/docker/mac-mini
echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-username> --password-stdin
cp .env.mac-mini.example .env.mac-mini
```

Then:

1. set `STRAPI_IMAGE` in `.env.mac-mini` to the published release tag
2. fill in the Postgres, MinIO, and Strapi secret values
3. paste the remote-managed tunnel token into `CLOUDFLARED_TUNNEL_TOKEN`

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

### 4. Create the first Strapi admin and issue a read-only API token

After Strapi is up on the Mac Mini:

1. open `http://127.0.0.1:1337/admin`
2. create the first administrator account
3. create a read-only API token for the `web` runtime
4. put that token into `WEB_STRAPI_API_TOKEN` in `.env.mac-mini`

### 5. Wait for the `web` image to be published

The release-image workflow publishes `web` for the same release tag as `strapi`. Record data is fetched at runtime, not baked into the image.

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

- configure the remote-managed tunnel's public hostnames in Cloudflare:
- `officialdavidtaylor.com` and `www.officialdavidtaylor.com` -> `http://web:4321`
- `cms.officialdavidtaylor.com` -> `http://strapi:1337`
- `media.officialdavidtaylor.com` -> `http://minio:9000`
- the container only needs `CLOUDFLARED_TUNNEL_TOKEN`; it does not mount a local config or tunnel credentials JSON
- Postgres stays private inside the Compose network
- the `web`, `strapi`, and MinIO console ports are bound to `127.0.0.1` on the host for local troubleshooting without exposing them on the LAN
- `/my-record-collection` is server-rendered on demand from Strapi through Astro live content collections
- Astro route caching keeps `/my-record-collection` fresh for 5 minutes and serves stale content for up to 1 minute while revalidating

Release flow:

1. merge conventional-commit PRs into `main`
2. let the release-tag workflow create the next `v<semver>` tag
3. let the release-images workflow run after the successful release-tag workflow and push the matching `strapi-cms` and `web` images to GHCR
4. update image tags in `.env.mac-mini`
5. pull and restart only the services whose image tags changed

Update flow:

1. Merge conventional-commit PRs into `main`
2. Wait for GitHub Actions to publish the new semver-tagged images
3. On the Mac Mini, `git pull` if the deployment config changed
4. Update image tags in `.env.mac-mini`
5. Pull before restart: `docker compose -f docker-compose.production.yml --env-file .env.mac-mini pull web strapi`
6. Restart CMS only if its image changed: `docker compose -f docker-compose.production.yml --env-file .env.mac-mini up -d --no-deps strapi`
7. Restart the main site only if its image changed: `docker compose -f docker-compose.production.yml --env-file .env.mac-mini up -d --no-deps web`
8. If infrastructure config changed, run `docker compose -f docker-compose.production.yml --env-file .env.mac-mini up -d` for the full stack

Local rehearsal for the release workflows now lives in the repo root docs. Use `act`, `actionlint`, and `yarn release:dry-run` before relying on the GitHub-hosted runs.

This is the recommended minimal-downtime path for the Mac Mini setup. It does not provide true zero-downtime, but it keeps restarts scoped to the app containers while Postgres, MinIO, and `cloudflared` stay up.

One important operational consequence:

- changes in Strapi record content should appear without rebuilding `web`
- the record collection page is cached in the Astro runtime instead of through a custom rewarm endpoint
- expect updates to appear within the 5 minute freshness window, with up to 1 minute of stale-while-revalidate during refresh
