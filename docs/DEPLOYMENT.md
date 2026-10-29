# Deployment

Free gameplay, local records, token cosmetics and graphics run in the browser. The verified global leaderboard adds one small Node service and PostgreSQL. No GPU, Redis, training service or onchain program is required.

## Local development

`npm ci`, `npm run dev`. The frontend listens on 127.0.0.1:5173. For records, set server-only DATABASE_URL and run `npm run dev:leaderboard`; Vite forwards `/api` to port 8787. Without the API, the game still works, WORLD BEST stays empty and submission reports the unavailable service.

## Static frontend

`npm run build` outputs `dist/web`. Vercel/static-host route fallback and COOP/COEP headers are included. Serve WASM/assets from the same origin. Do not cache index.html as immutable; Vite-hashed assets may be cached. The optional `VITE_LEADERBOARD_API_URL` must be configured at build time when the API is on a separate host. The Node verifier is not a Vercel edge function; it needs persistent process execution and PostgreSQL.

## Container deployment

`infra/docker-compose.yml` provides web/Caddy, the Node verifier and PostgreSQL with a persistent volume. Set POSTGRES_PASSWORD, RATE_LIMIT_SECRET and ALLOWED_ORIGINS using private deployment configuration. Optional public token/project settings are build arguments. Run `docker compose -f infra/docker-compose.yml up --build -d` on your selected host. Place HTTPS ingress in front of port 8080. No database port is exposed.

The verifier container has 1 CPU, a 768 MB memory limit and a process limit. Replay children additionally have a 256 MB JavaScript heap bound and 25-second wall timeout. Caddy proxies `/api`, and the frontend/API share one origin. Back up the PostgreSQL volume; never use `down -v` as a routine restart.

Both frontend and API must deploy the same generated configId. API startup checks source/asset hash drift and refuses to start on a mismatch. Re-run physical/replay tests before pinning a changed configuration. Old versions remain in the database but cannot become the current course's world best.

No public hosting or production database has been provisioned by this task. Container configuration is supplied separately from locally executed browser/Node/PostgreSQL validation; see TESTING.md for exact checks. Resolve the documented commercial geometry rights before commercial publication.
