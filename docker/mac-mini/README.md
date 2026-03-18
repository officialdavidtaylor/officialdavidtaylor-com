# Mac Mini Deployment

This deployment bundle is the recommended production path when all CMS services run on a single Mac Mini.

Files:

- `docker-compose.production.yml`
- `.env.mac-mini.example`
- `cloudflared/config.yml.example`
- `cloudflared/credentials/`

Why Compose instead of Swarm:

- this is a single-node deployment, so Swarm does not add useful scheduling or failover
- Compose is simpler to operate, debug, back up, and restore on a personal host
- `cloudflared`, Postgres, MinIO, and Strapi all fit cleanly into one stack without overlay networking or Swarm secrets

Recommended stack on the Mac Mini:

- `postgres`
- `minio`
- `minio-init`
- `strapi`
- `cloudflared`

Bring-up flow:

1. Create `docker/mac-mini/.env.mac-mini` from `docker/mac-mini/.env.mac-mini.example`
2. Create `docker/mac-mini/cloudflared/config.yml` from `docker/mac-mini/cloudflared/config.yml.example`
3. Place the named tunnel credentials JSON in `docker/mac-mini/cloudflared/credentials/`
4. `yarn install`
5. Build the Strapi image with the stack: `docker compose -f docker-compose.production.yml --env-file .env.mac-mini build strapi`
6. Start the stack: `docker compose -f docker-compose.production.yml --env-file .env.mac-mini up -d`
7. Verify local admin access on `http://127.0.0.1:1337/admin`
8. Verify the MinIO console on `http://127.0.0.1:9001`
9. Confirm the Cloudflare tunnel is routing `cms.example.com` and `media.example.com` as expected

Operational notes:

- `cloudflared/config.yml` expects a named tunnel credentials JSON under `cloudflared/credentials/`
- the tunnel config routes `cms.example.com` to the internal `strapi` service and `media.example.com` to the internal `minio` service
- Postgres stays private inside the Compose network
- Strapi is bound to `127.0.0.1` on the host for local troubleshooting without exposing it on the LAN
