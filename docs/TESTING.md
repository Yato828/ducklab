# Executed validation — six-stage revision

Validated locally through **2026-10-29 (Europe/Minsk)**. These results supersede the old five-gate light-theme acceptance report. The pinned gameplay ID is exported by `packages/game-core/src/version.js`.

| Check | Actual result |
|---|---|
| `npm run typecheck` | Passed |
| `npm test` | 40 passed: 19 game/input/token checks and 21 real physics/geometry/replay checks |
| `npm run test:browser` | 4 Playwright scenarios passed, 33.8 s on the final run |
| `node scripts/browser-course-replay.mjs --submit` | Full browser course, authoritative replay, result UI, PNG export, PB reload, API submission and verified ranking passed |
| `TEST_DATABASE_URL=… npm run test:leaderboard` | 2 passed with real PostgreSQL, not an in-memory database |
| Production wallet/token check | Bundled WASM, walking, Wallet Standard fixtures, exact threshold unlock/relock, wrong-mint rejection, disconnect, contract copy and missing-link states passed |
| `npm run build` | Passed, including automatic gameplay content-hash verification |
| `node scripts/fetch-upstream.mjs` | All 87 original source/asset hashes verified; restored 0 |

## Physical gameplay evidence

The real MuJoCo/official ONNX controller completed all six mandatory stages without assistance in **190.30 simulation seconds (03:10.30)**. The reference path includes slalom navigation, a ball struck during the original left-kick policy into the goal, a physically pushed and stabilized cube, seated pose validation, a measured roll/upright landing, corridor/turn/final gate.

The full reference controller only sends velocities and official actions. It never sets robot/prop positions after initialization. Same-runtime replay reproduces every final qpos exactly. Chrome's browser worker completed the same 9,515 control ticks; the server replay of its recorded inputs returned 190,300 ms with **zero measured root-position difference**. The accepted test threshold is 1e-6 m; finish time remains the authoritative server tick, with no client time tolerance.

The browser harness uses test-only interception of the served component to obtain its existing public simulation API. It feeds the bounded input log and single-steps actual physics through the normal worker. It does not replace state, policies, objectives, contacts or timer values. Separate Playwright tests exercise real-time keyboard input and pause/resume. This is automated reference evidence, not a measured first-time-human benchmark.

`tests/artifacts/chaos-course.json` contains input log, trace, final qpos and splits. `tests/artifacts/browser-replay.json` contains browser diagnostics and authoritative result.

## Browser acceptance

1. Dark homepage, one original robot canvas, keyboard walking, both Q/E kicks, R sit/stand, pause freezing the clock, prop creation and reset.
2. Course starts at zero, pause is stable, Rescue adds +30 seconds, restart resets time/progress/penalties and returns to ready state.
3. Mobile 390 × 844 and tablet 820 × 1180 layouts, navigation, saved free cosmetic/quality, locked unconfigured token colors, no-extension wallet state, token COMING SOON and readable course HUD without horizontal overflow.
4. Original roller model loads only in Free Playground; real drive translates, C runs crouch glide, and switching back resets the unranked playground.
5. Separate full browser course: all stages, result screen, local PB persistence, PNG download, submission through the actual form, server verification and verified world-best/rank display in the isolated test database. No QA score was seeded or hardcoded; it was computed from the replay. Test rows are removed after validation.

Testing caught and fixed a real first-action-after-Resume race: the action shortcut now checks the simulator's immediate pause state instead of waiting for React telemetry to update.

## Backend/abuse checks

Real PostgreSQL tests cover empty world best, rejection of client time/flags and mismatched versions, forbidden origins, request size bounds, duplicate logs, persistent per-address quotas, uncompleted replay rejection, isolated verifier timeout, queue cap under concurrent submission, successful official time, and persistence after service restart. Only verified records enter the leaderboard. Tests use a dedicated database whose name ends in `test`; they refuse to clear another database.

## Token verification boundaries

The configured production test uses an explicitly named Wallet Standard fixture, controlled RPC responses, and wrapped SOL as a test-only mint. It is not an actual QUACK launch or installed Phantom/Solflare/Backpack extension session. It verifies application integration, zero signing/transaction requests, exact integer threshold logic, failure handling, and clipboard behavior. No fixture is imported by the production app. Main configuration remains empty until real details are supplied.

## Reproduce

```sh
npm ci
npm run dev
# Additional terminal(s):
npm run typecheck
npm test
npm run test:browser
npm run test:browser:course
TEST_DATABASE_URL=postgresql://localhost/ducklab_test npm run test:leaderboard
npm run build
```

For the full form submission check, run the API against a dedicated test database on port 8787, then `node scripts/browser-course-replay.mjs --submit`. Remove the test database's QA rows afterward. The ordinary local/production database starts empty.

For wallet fixtures, build a separate directory with `VITE_QUACK_TOKEN_MINT=So11111111111111111111111111111111111111112 VITE_SOLANA_RPC_URL=https://rpc.ducklab.test VITE_QUACK_COSMETIC_THRESHOLD=100 npm run build -- --outDir /private/tmp/ducklab-wallet-fixture`, serve it with `npm run preview -- --outDir /private/tmp/ducklab-wallet-fixture --port 4174`, then run `node scripts/browser-wallet-check.mjs`.

## Remaining external checks

No production host, actual token mint/community links or commercial geometry authorization was provided. Live wallet-extension compatibility on the final HTTPS host, physical mobile devices, Safari/Firefox and human balancing are not claimed as tested. Docker/Vercel publication was not executed. Container configuration is supplied, not presented as a successful deployment.

The build has the expected large Three.js chunk warning and MuJoCo Node-only `module` externalization notice. Bundled browser WASM has been exercised successfully. No funds were moved.

Current dark screenshots use `tests/artifacts/dark-*.png`; configured token screenshots explicitly use fixtures. Older screenshots without that prefix and `course-physics.json` document the superseded light/five-gate version.
