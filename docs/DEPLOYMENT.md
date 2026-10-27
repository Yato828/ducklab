# Static deployment

## Local production build

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run preview
```

Output: `dist/web`. The game has no API, database, authentication service, worker server or GPU service. Physics workers are browser Web Workers bundled by Vite.

## Vercel

Import this repository with project root at the repository root. Use `npm run build` and output `dist/web`; the included `vercel.json` supplies static route rewrites and browser isolation headers. Set optional public `VITE_` variables before building, then rebuild after configuration changes. Leave the mint blank to disable only gated colors.

Do not deploy archived platform code. Do not deploy a commercial game with restricted geometry until the owner has appropriate asset authorization (`UPSTREAM_SOURCES.md`). No deployment has been performed by this implementation session.

## Other static hosts

Serve `.wasm` as `application/wasm`, `.js` as JavaScript, and JSON/GLB/ONNX files as binary or their appropriate media types. Return original files for `/assets`, `/robot`, `/policies`; do not rewrite missing binary assets to HTML. Rewrite only application routes to `index.html`.

Required response headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

The build includes `_headers` and `_redirects` for hosts that support them. Vercel uses `vercel.json`. Use HTTPS outside local development. Serve hashed `/assets` files with a long immutable cache, but revalidate HTML and non-hashed `/robot` and `/policies` files when releasing changed upstream assets. Asset compression reduces initial WASM transfer size substantially.

If adding a Content Security Policy, allow same-origin scripts, workers, fonts, models and WASM (`wasm-unsafe-eval`), blob URLs for image exports, and the configured HTTPS Solana RPC endpoint under `connect-src`. No external font CDN is required.

## Optional single-container static host

```sh
docker build -f infra/Dockerfile.web -t ducklab .
docker run --rm -p 8080:8080 ducklab
```

Use build arguments to supply public `VITE_` token settings if needed. The container serves files through Caddy; it does not run a Node API. Docker execution has not been verified in this environment; the same static build is verified locally.

## Release checks

Run the physical course test, browser full-run/restart test, and responsive screenshots. Verify the actual hosting response headers, static route reloads, correct WASM MIME type, and wallet extension compatibility on HTTPS. Verify token configuration against the intended cluster/mint without requesting transfers. Retain source attribution and asset hashes. Local personal records are not authoritative competition data.
