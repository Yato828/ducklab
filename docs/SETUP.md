# Setup and asset reproduction

Install Node 22.13+ and run `npm ci`. `npm run dev` starts the frontend. Optional PostgreSQL records use `DATABASE_URL=… npm run dev:leaderboard`; no server is required for free gameplay. See README.md and LEADERBOARD.md.

The repository includes original robot GLB, kinematic JSON, source collision meshes and ONNX policies. `node scripts/fetch-upstream.mjs` checks the pinned 87-file manifest and restores missing originals from their pinned sources. Asset URLs, revisions, hashes and license notes are in UPSTREAM_SOURCES.md.

Rebuild derived scenes without modifying original robot source:

```sh
python3 scripts/build-robot-scene.py
node scripts/build-browser-collision-meshes.mjs
python3 scripts/build-robot-scene.py --rollers
node scripts/build-browser-collision-meshes.mjs --rollers
npm run pin:gameplay
npm test
```

The roller scene includes its four passive wheel joints, the original roller geometry and the original drive/crouch policies. It is only available in a separate Free Playground simulation. Course geometry/contact tuning is generated from game-core, while the robot's original dynamics remain unchanged.

`npm run build` checks the gameplay content hash before writing `dist/web`. Changing course/physics source intentionally requires a new pin and fresh replay evidence. Do not edit version.js manually to retain a previous leaderboard identity.

Copy `.env.example` to `.env` for optional configuration. `VITE_` values are public; use them only for branding, token mint/RPC, official links and public API origin. Keep database credentials and rate-limit secret server-only. Never put a private key or seed phrase in configuration.
