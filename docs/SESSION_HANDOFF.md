# DUCKLAB — current handoff

Updated **2026-10-29 (Europe/Minsk)**. The earlier WIP checkpoint `7d30215` has been continued into the implemented six-stage revision. Read `REVISION_BRIEF.md` for requirements and `TESTING.md` for executed evidence. Do not restart the project or revive the archived marketplace/training platform.

## Implemented

- Shared original MuJoCo/ONNX `PhysicsEngine` now drives both the browser and authoritative Node replay. Input application is serialized between ticks. Geometry and authentic source hashes remain preserved.
- Six physical stages: slalom; real kick-contact football goal; stable box target; actual seated pose using sitstand; roll/tilt/upright hold; final corridor/turn/finish. Physical exit locks follow objective state.
- Simulation stopwatch, ordered progression, assistance (+10s ball/cube; +30s rescue), reset, pause, per-course/config local best, result PNG/X sharing.
- Real keyboard/touch action UI (Q/E/R/F/G/H), expandable guide and settings. Official roller/drive/crouch model is a separate resettable Free Playground variant; C crouch. Ranked mode cannot switch to rollers.
- Dark palette across UI and Three.js, requested hero and configurable project/$QUACK identity, Token and Leaderboard pages, real/empty contract/link states and preserved read-only wallet cosmetics.
- Minimal Node HTTP + PostgreSQL service: durable verification jobs/quotas/results, bounded logs, isolated child verifier, one global worker, timeout, deduplication, top ten/world best/status. Only successful replay counts; no client time or completion flags accepted.
- Gameplay SHA-256 configuration: `76ff92724f643707dda91077c4320fde56e883bb82964dd9a34ccb6d7f736fbb`. `npm run pin:gameplay` generates it. Build and API startup reject drift.
- Static frontend and optional Node/PostgreSQL/Caddy container deployment configuration. No public deployment performed.

## Evidence

- Typecheck and production build passed.
- 40 game/token/real-physics tests passed.
- 2 real PostgreSQL/backend tests passed, including verified score persistence across API restart, hostile submission rejection, timeout and concurrent queue cap.
- 4 Playwright scenarios passed (33.8 s final suite).
- Complete actual browser physics run and replay: 9,515 ticks / **190.30 simulation seconds** / zero final root-position difference. PNG export, local best reload, real form submission, server verification and rank/world-best UI passed with a dedicated test database.
- Production wallet test passed with explicit Wallet Standard/RPC fixtures: enough/insufficient/wrong-mint balance, disconnect, contract copy, no invented links, zero signature/transfer calls.
- Original 87-file hash verification passed.

The reference route is automated, not a human first-play benchmark. Live wallet extensions/real QUACK holdings, physical phones, Safari/Firefox, production hosting and Docker execution are not claimed as tested. See TESTING.md.

## Useful commands

```sh
npm run dev
DATABASE_URL=postgresql://localhost/ducklab npm run dev:leaderboard
npm run typecheck
npm test
npm run test:browser
npm run test:browser:course
TEST_DATABASE_URL=postgresql://localhost/ducklab_test npm run test:leaderboard
npm run build
```

The full browser replay harness supports `--submit` when an API backed by a dedicated test DB is running. The harness obtains the existing simulation API through test-only interception, without modifying physical state, policies or objectives. `scripts/tune-challenges.mjs` contains isolated initial-placement experiments; it is not a valid ranked run and is not shipped.

## Local workspace/process context

Workspace `/Users/yato/duck`. Repository `https://github.com/Yato828/ducklab.git`, branch `main`. Original checkpoint was pushed by explicit user request. Review git status before further work; preserve user changes.

Existing frontend is at http://127.0.0.1:5173 (PID 91713 at the last inspection; not owned by the current QA session). PostgreSQL test/local cluster is `/private/tmp/ducklab-leaderboard-pg`, listening only on 127.0.0.1:55439. Separate databases: `ducklab_revision_test` (disposable tests only) and `ducklab_local` (local game records). Temporary production wallet preview at 4174 and test-DB API are stopped after QA; test rows are cleared. Do not clear the local/user database.

## External configuration / next work if requested

- Real project token mint, official X/Telegram/Pump.fun/Dexscreener links and final hosting details have not been supplied. Empty values intentionally display COMING SOON. Do not invent them or launch a token/mainnet transaction.
- Commercial geometry authorization remains outstanding; source software/policies identify Apache 2.0 and pinned hardware files identify CC BY-SA-NC. Keep attribution and resolve rights before commercial publication.
- Production HTTPS host and durable PostgreSQL credentials are deployment work, not blockers for the implemented local game. Deploy matching frontend/API hashes and run final-host wallet checks before release.
- Human playtesting can refine difficulty. Physics/geometry changes require a new configuration and separate records, plus new full replay evidence.
- No new subagents without explicit user/applicable instructions. Earlier platform agents are inactive.
