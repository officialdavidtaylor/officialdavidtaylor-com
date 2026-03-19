# Strapi CMS

This workspace contains the Strapi CMS for `officialdavidtaylor.com`.

The intended production topology is a distributed home-lab deployment:

- `Strapi` on one device
- `MinIO` on a separate device
- `Postgres` on a separate device
- `Cloudflare Tunnel` exposing public HTTP(S) entrypoints (`cms`, optionally `media`)

## Local Development

Start Strapi with hot reload:

```bash
yarn develop
```

Build the admin panel:

```bash
yarn build
```

Start in production mode:

```bash
yarn start
```

## Production Deployment

### Recommended: Single Mac Mini Host

If `Strapi`, `Postgres`, `MinIO`, and `cloudflared` will all run on the same Mac Mini, use the single-host deployment bundle:

- `docker/mac-mini/README.md`
- `docker/mac-mini/docker-compose.production.yml`
- `docker/mac-mini/.env.mac-mini.example`
- `docker/mac-mini/cloudflared/config.yml.example`

Use `docker compose`, not Docker Swarm, for this setup. On a single Mac Mini, Swarm adds orchestration overhead without adding meaningful resilience or scheduling value.

The Mac Mini deployment is designed for registry mode: build and push `web` and `strapi` images elsewhere, then have the Mac Mini pull and run them.

The Mac Mini stack can route:

- `officialdavidtaylor.com` and `www.officialdavidtaylor.com` -> Astro web container
- `cms.officialdavidtaylor.com` -> Strapi
- `media.officialdavidtaylor.com` -> MinIO

Because the Astro site is statically built, the published `web` image is a CMS-backed content snapshot. The Mac Mini deployment guide documents the registry-based publish, pull, and restart flow.

### Alternative: Distributed Devices

### Architecture

- `Strapi` should be deployed as a custom image (your app code + content types + plugins + config), ideally pushed to your personal Docker registry.
- `Postgres` is an external dependency from the Strapi host's perspective.
- `MinIO` is an external dependency from the Strapi host's perspective.
- `Cloudflare Tunnel` should expose only HTTP(S) services. Do not expose Postgres publicly.

Recommended DNS / hostnames (LAN):

- `strapi.lan` (or static IP) for the Strapi device
- `minio.lan` for the MinIO API/console device
- `pg.lan` for the Postgres device

Use DHCP reservations or static IPs for all three devices.

### Per-Device Deployment Layout

`docker compose` is per-device in this topology. It will not coordinate startup ordering across hosts, so `restart` policies and dependency health on the Strapi host matter.

#### Device A: Strapi Host

Production template:

- repo root: `docker/strapi/docker-compose.production.yml`
- env template: `docker/strapi/.env.strapi.production.example`

Example usage on the Strapi device:

```bash
docker compose -f docker-compose.production.yml --env-file .env.strapi.production up -d
```

Notes:

- Use immutable image tags (`2026-02-23`, git SHA, etc.), not `latest`.
- Because Postgres and MinIO are remote, avoid `depends_on` assumptions for them.
- Ensure the Strapi container has a restart policy (`unless-stopped`) so it recovers if Postgres/MinIO boot later.

#### Device B: MinIO Host

Production template:

- repo root: `docker/minio/docker-compose.production.yml`
- env template: `docker/minio/.env.minio.production.example`

Example usage on the MinIO device:

```bash
docker compose -f docker-compose.production.yml --env-file .env.minio.production up -d
```

MinIO host requirements:

- Persist `/data` on reliable storage.
- Keep the MinIO console (`:9001`) private or behind Cloudflare Access.
- Decide bucket policy early:
  - public bucket for simpler portfolio media delivery
  - private bucket + signed URLs for tighter access control

#### Device C: Postgres Host (Assumptions / Requirements)

Postgres can run in Docker or directly on the OS, but the Strapi host should treat it as an external service.

Minimum requirements:

- Postgres version pinned (for example, `16.x`)
- Dedicated database for Strapi (for example, `strapi`)
- Dedicated DB user with least privilege for that database only
- Firewall rule allowing `5432` only from the Strapi host IP
- `pg_hba.conf` restricted to the Strapi host/user/database
- Backups scheduled on the Postgres host (and restore-tested)
- Time sync (NTP)

Strongly recommended:

- Private network path (LAN/VLAN/WireGuard/Tailscale)
- TLS enabled for Postgres if traffic crosses less-trusted segments
- Connection limit planning (`DATABASE_POOL_MAX` in Strapi; consider PgBouncer later if needed)

#### Optional Device D: Dedicated Cloudflare Tunnel Host

Use this if you want a single `cloudflared` instance routing multiple services (`cms`, `media`) instead of running `cloudflared` alongside Strapi/MinIO.

Templates:

- compose: `docker/cloudflared/docker-compose.production.yml`
- env: `docker/cloudflared/.env.cloudflared.production.example`
- tunnel config: `docker/cloudflared/config.yml.example`

Example usage on the tunnel host:

```bash
docker compose -f docker-compose.production.yml --env-file .env.cloudflared.production up -d
```

## Strapi Production `.env` Checklist (Remote Postgres + Remote MinIO)

Store this on the Strapi host (not committed to git). The current Strapi config in this repo already consumes the database and auth secret variables below.

Reference template: `docker/strapi/.env.strapi.production.example`

### Core / Runtime

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=1337
PUBLIC_URL=https://cms.example.com
TRUST_PROXY=true
CORS_ORIGIN=https://officialdavidtaylor.com
CORS_CREDENTIALS=true
```

### Required Strapi Secrets (persist these)

If these change between deploys, sessions/tokens/admin auth can break.

```dotenv
APP_KEYS=comma-separated,key2,key3,key4
API_TOKEN_SALT=replace-me
ADMIN_JWT_SECRET=replace-me
TRANSFER_TOKEN_SALT=replace-me
ENCRYPTION_KEY=replace-me
JWT_SECRET=replace-me
```

Notes:

- `JWT_SECRET` is used by `users-permissions` and is required in production even though it is not referenced in `config/admin.ts`.
- Generate long random values and store them securely.

### Remote Postgres

This repo's `config/database.ts` supports either `DATABASE_URL` or explicit fields.

```dotenv
DATABASE_CLIENT=postgres

# Option A: single URL
# DATABASE_URL=postgres://strapi:<password>@pg.lan:5432/strapi

# Option B: explicit fields
DATABASE_HOST=pg.lan
DATABASE_PORT=5432
DATABASE_NAME=strapi
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=replace-me
DATABASE_SCHEMA=public

DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_CONNECTION_TIMEOUT=60000
```

### Remote Postgres TLS (optional but recommended across untrusted segments)

Only set these if TLS is enabled on the Postgres server.

```dotenv
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=true
# DATABASE_SSL_CA=-----BEGIN CERTIFICATE-----... (or mounted file contents)
# DATABASE_SSL_CERT=
# DATABASE_SSL_KEY=
```

### Remote MinIO (S3-Compatible Uploads)

This repo is configured to use the Strapi AWS S3 upload provider against MinIO when the required `S3_*` variables are present. If they are omitted, Strapi falls back to the default local upload provider.

Relevant config files:

- `config/plugins.ts` (upload provider wiring)
- `config/middlewares.ts` (CSP allowlist for media origin used by the admin)

Recommended variable set for a MinIO-backed upload provider:

```dotenv
S3_ENDPOINT=http://minio.lan:9000
S3_ACCESS_KEY_ID=replace-me
S3_SECRET_ACCESS_KEY=replace-me
S3_BUCKET=strapi-uploads
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true

# Optional provider settings
# S3_ROOT_PATH=portfolio
# S3_ACL=public-read
S3_USE_SIGNED_URLS=false
S3_SIGNED_URL_EXPIRES=900

# Public media base URL (if exposing MinIO via Cloudflare / reverse proxy)
S3_PUBLIC_URL=https://media.example.com
```

Implementation notes:

- This repo uses `@strapi/provider-upload-aws-s3` (MinIO via S3 compatibility).
- Run `yarn install` after pulling these changes so the provider package is available.
- MinIO commonly requires path-style requests.
- `S3_PUBLIC_URL` is strongly recommended when media is exposed via Cloudflare/reverse proxy.
- If media remains private, enable `S3_USE_SIGNED_URLS=true` instead of using `S3_PUBLIC_URL`.

### CORS / Public URL / Proxy Awareness

These settings are wired in this repo and should be set explicitly in production.

What is already handled:

- `PUBLIC_URL` and `TRUST_PROXY` in `config/server.ts`
- env-driven CORS origin allowlist in `config/middlewares.ts` via `CORS_ORIGIN` / `CORS_CREDENTIALS`
- media-domain CSP allowlisting in `config/middlewares.ts` (derived from `S3_PUBLIC_URL` or `S3_ENDPOINT`)

## Cloudflare Subdomain + Tunnel Plan

### Recommended Public Endpoints

- `cms.example.com` -> Strapi (`http://strapi.lan:1337`)
- `media.example.com` -> MinIO API or a reverse proxy in front of MinIO (`http://minio.lan:9000`) (optional)

Do not expose:

- Postgres (`5432`)
- MinIO console (`9001`) unless protected and intentionally published

### Tunnel Placement Options

Pick one of these patterns:

1. `cloudflared` on each service host
   - Strapi host tunnel serves `cms.example.com`
   - MinIO host tunnel serves `media.example.com` (if needed)
2. One tunnel host for multiple services
   - Single `cloudflared` routes to `strapi.lan:1337` and `minio.lan:9000`
   - Simpler operationally, but creates a single routing dependency

### Admin Protection (`cms.example.com/admin`)

Protect Strapi admin with Cloudflare Access:

- Create a Cloudflare Access application for `https://cms.example.com/admin*`
- Require identity login (email allowlist / IdP)
- Optionally add device posture or IP restrictions

Keep public API routes accessible as needed:

- `https://cms.example.com/api/*`
- `https://cms.example.com/uploads/*` (if you ever use local uploads temporarily)

### Caching / Proxy Behavior

- Bypass cache for Strapi admin and API routes unless explicitly designed otherwise.
- If `media.example.com` serves immutable assets, caching is appropriate there.
- Consider a reverse proxy in front of MinIO for cleaner cache-control headers and URL normalization.

### Example Tunnel Ingress (Single Tunnel Host Pattern)

Reference template: `docker/cloudflared/config.yml.example`

```yaml
tunnel: <tunnel-id>
credentials-file: /etc/cloudflared/<tunnel-id>.json

ingress:
  - hostname: cms.example.com
    service: http://strapi.lan:1337
  - hostname: media.example.com
    service: http://minio.lan:9000
  - service: http_status:404
```

### Example Tunnel Ingress (Strapi Host Only)

```yaml
tunnel: <tunnel-id>
credentials-file: /etc/cloudflared/<tunnel-id>.json

ingress:
  - hostname: cms.example.com
    service: http://localhost:1337
  - service: http_status:404
```

## Production Checklist (Do Not Skip)

- Backups for Postgres and MinIO (with restore test)
- Static IPs or DHCP reservations for all devices
- Firewall rules between devices (least privilege)
- Monitoring / uptime checks (Strapi, MinIO, Postgres, disk space)
- Version pinning for Strapi, Postgres, MinIO, and `cloudflared`
- Reboot recovery test (power cycle each device and verify service return)
