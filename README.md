# DUCKLAB

**Small duck. Big chaos.** An authentic Microduck physics game with a six-stage obstacle circuit, simulation-time racing, verified replay leaderboard and optional $QUACK cosmetics on Solana.

The current specification is [REVISION_BRIEF.md](docs/REVISION_BRIEF.md). Original geometry, joint structure and official ONNX policies are preserved. The old robotics platform is archived outside the active application.

## Run

Node 22.13+ and npm are required.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. Routes: `/`, `/playground`, `/time-trial`, `/customize`, `/leaderboard`, `/token`, `/about`.

Free gameplay, local records and cosmetics do not need a backend. For the verified leaderboard, create a PostgreSQL database and start the small service in a second terminal:

```sh
DATABASE_URL=postgresql://localhost/ducklab npm run dev:leaderboard
```

Vite forwards `/api` to port 8787. The API creates its schema on startup. It starts with no scores; there are no hardcoded records. See [leaderboard architecture](docs/LEADERBOARD.md) and [deployment](docs/DEPLOYMENT.md).

## Play

- **W / arrows:** walk; **A/D:** steer. Right turns work best while walking. **S:** reverse command, which can hesitate from rest.
- **Q/E:** left/right kick. **R:** sit/stand. **F:** forward roll. **G:** ground pick. **H:** recovery.
- **Space:** start or pause/resume. **Backspace:** restart.
- Drag to orbit, scroll to zoom; camera follow, touch controls and gamepad movement are included.
- Free Playground → Play tools → **Roller mode** loads the original roller model/drive policy in a fresh playground. **C:** crouch glide. Rollers cannot enter the timed course.

The circuit requires a slalom, a physically kicked football goal, a cube settled in its target, a real seated pose on the platform, an upright landing after a roll, and final navigation. Locked exits open only after checked physical objectives. Assistance is explicit: ball/cube reset **+10 seconds**, robot rescue **+30 seconds**. All penalties are included in both personal and official times.

Personal bests are saved immediately per course and physics configuration. After finishing, enter a nickname to submit the step-indexed input log. The server reconstructs and replays the run, computes its own time and publishes only verified completions. Nicknames are self-selected; no wallet identity, human-only authorship or financial reward is implied.

## Optional token configuration

Copy `.env.example` to `.env`. Set the real `VITE_QUACK_TOKEN_MINT`, RPC, threshold and official project links when available. Empty configuration shows **COMING SOON** and disables only gated cosmetics. No contract address, community links or market statistics are invented.

Wallet Standard connection and finalized read-only SPL balance checks unlock optional colors. No signatures, purchases, staking or transfers are requested. Public `VITE_` values are embedded in the bundle; database credentials and `RATE_LIMIT_SECRET` must remain server-only.

## Validation

```sh
npm run typecheck
npm test
npm run test:browser                 # Chrome; local dev server running
npm run test:browser:course          # Complete browser physics run + replay/PNG/PB
TEST_DATABASE_URL=postgresql://localhost/ducklab_test npm run test:leaderboard
npm run build
```

The database test only clears a database whose name ends in `test`. Full browser replay uses test-only instrumentation to capture the existing simulation API; it never changes physical state or objective flags. See [TESTING.md](docs/TESTING.md) for actual executed results and boundaries.

Gameplay files are content-pinned. After intentional physics/course changes run `npm run pin:gameplay`, regenerate the physical reference and repeat verification. Both production build and API startup reject hash drift. A new configuration gets a separate personal best and leaderboard.

## Structure

```text
apps/web/                 React/Vite game, original robot assets, dark UI
apps/leaderboard/         Minimal PostgreSQL API and isolated replay worker
packages/game-core/       Shared level, physical objectives, timer and input-log validation
packages/simulation-core/ Shared MuJoCo/ONNX engine, browser transport, renderer and headless runtime
packages/solana/          Exact integer token arithmetic and read-only mint/balance validation
assets/                   Pinned upstream provenance, originals and license references
tests/artifacts/          Physical traces, browser evidence and screenshots
infra/                    Static hosting and optional Node/PostgreSQL/Caddy deployment
archive/platform/         Preserved obsolete work, excluded from the active application
```

Commercial geometry authorization remains outstanding: upstream software/policies identify Apache 2.0, while the pinned RL README identifies hardware design files as CC BY-SA-NC. See [UPSTREAM_SOURCES.md](docs/UPSTREAM_SOURCES.md). No public deployment or token launch has been performed.
