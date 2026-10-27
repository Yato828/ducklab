# DUCKLAB

> **WIP checkpoint — 2026-10-27:** the six-stage dark-game revision is in progress. The new headless course completes, but browser integration, UI, leaderboard and updated tests are unfinished. Start with [SESSION_HANDOFF](docs/SESSION_HANDOFF.md) and [current brief](docs/REVISION_BRIEF.md). The guide below describes the previous static release.

A static, single-player Microduck physics game. Play freely, run the five-checkpoint obstacle course, beat a local personal best, and optionally connect a Solana wallet for cosmetic colors.

The original robotics-platform scope has been replaced by `docs/GAME_BRIEF.md`. Earlier editor, marketplace, API and training work is preserved under `archive/platform/` and is excluded from the game.

## Run

Requires Node 22.13+ and npm. No backend, database or GPU service is needed.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. Routes: `/`, `/playground`, `/time-trial`, `/customize`, `/about`.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

`npm run test:browser` runs Playwright against the dev server and uses locally installed Chrome. See `docs/TESTING.md` for executed checks and browser prerequisites.

## Play

- **W / ↑:** walk forward. **A/D / ←/→:** steer; right turns work best with forward motion.
- **S / ↓:** reverse command (the official policy can hesitate from rest).
- **Space:** start the course or pause/resume. **R:** restart.
- Drag to orbit, scroll to zoom, or use the camera-follow control. Touch pad and gamepad movement are supported.
- Free Playground's Play tools expose official actions, real physical props and a recovery push test.

Time Trial starts only when you press Start. Gates must be crossed in order and in the correct direction. The clock uses simulation time, freezes with physics, and stops after the final finish crossing. Personal bests are stored per course version in localStorage. There is no leaderboard, cryptocurrency reward or verified-world-record claim.

## Optional Solana configuration

Copy `.env.example` to `.env` and set `VITE_QUACK_TOKEN_MINT`, `VITE_SOLANA_RPC_URL`, cluster and cosmetic threshold. Vite settings are public build-time values: never put secrets or private keys in them.

Wallet Standard discovers compatible Phantom, Solflare and Backpack wallets. Read-only finalized RPC queries validate the SPL mint owner/decimals and every returned token account before adding integer balances. Cream and Graphite are free; Lavender and Sky blue require the configured balance. Unconfigured or failed balance checks leave token colors locked and the game fully playable. No signatures or transactions are requested.

## Structure

```text
apps/web/                       Static React/Vite game and original public robot assets
packages/simulation-core/       MuJoCo/ONNX worker, Three.js rig renderer, physics tests
packages/game-core/             Shared physical course, ordered gates, stopwatch, records
packages/solana/                Read-only token checks and exact integer amounts
assets/microduck/manifest.json  Source revisions, URLs and SHA-256 hashes
assets/upstream/                Original source/license references
scripts/                       Reproducible asset preparation and QA tools
tests/                         Browser acceptance tests and recorded evidence
infra/                         Optional static Caddy container
archive/platform/              Preserved obsolete work, outside the active application
```

## Hosting and rights

`npm run build` outputs `dist/web`. Vercel configuration and generic static-host headers/route rules are included; see `docs/DEPLOYMENT.md`. WASM is hosted on the same origin with COOP/COEP headers. No cloud service has been deployed.

**Commercial asset authorization is still required.** Upstream software/policies identify Apache 2.0, while the pinned RL README separately identifies hardware design files as CC BY-SA-NC. No separate commercial geometry authorization was supplied. See `docs/UPSTREAM_SOURCES.md` before distributing a commercial site.

See `docs/SIMULATION_ACCURACY.md` for actual behavior, measured course completion and policy limitations. The renderer is authentic and joint-driven; original assets do not imply perfect hardware equivalence.
