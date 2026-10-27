# Executed validation

> **Historical results for the previous five-gate release.** They do not describe the current WIP. See [SESSION_HANDOFF.md](SESSION_HANDOFF.md) for the new six-stage headless pass (190.30 s), current typecheck failures, outdated test failures and remaining browser/replay verification.

Executed locally on 2026-10-27. Results describe the revised static game, not archived platform work.

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm test` | 36 tests passed: 17 game/token arithmetic and RPC validation, 19 genuine physics/geometry/course checks |
| `npm run build` | Passed; static output `dist/web` |
| `npm run test:browser` | 3 Playwright acceptance scenarios passed in desktop Chrome, including mobile-sized viewports |
| `node scripts/fetch-upstream.mjs` | Verified all 87 pinned originals; no restoration required |
| Isolated production wallet check | Passed bundled WASM/real walking, isolation headers, Wallet Standard connection, token threshold unlock/relock, wrong-mint rejection and disconnect |

## Browser acceptance scenarios actually executed

1. Original geometry renders in one WebGL canvas; keyboard walking changes physical position; pause freezes simulation time; reset returns the robot; a physical ball can be added; sit-to-stand returns the controller to walking. No page JavaScript errors.
2. Start a course from 00:00.00, drive using keyboard input through all five actual gates, cross finish, freeze the timer, persist local personal best, export the result PNG, try again, restart to zero, reload the browser, recover the saved best and verify pause. The captured browser run finished in **41.70 simulation seconds**; input timing can change this value on subsequent runs.
3. Mobile layouts at 390 × 844 have no horizontal page overflow; free Graphite cosmetic and render quality persist after reload; unconfigured token colors remain locked; the wallet dialog handles no installed extension; the course HUD is visible.

The separate headless physics reference run completes the course in 38.82 simulation seconds. It sends only supported controller velocities; it never moves the rendered model or writes robot qpos after initialization. The ordered checkpoint trace is `tests/artifacts/course-physics.json`.

The first browser pass exposed a real start/held-key race and a missing accessible label on the mobile wallet icon. Both were corrected, and the complete suite passed afterward.

## Test artifacts

- `tests/artifacts/home-desktop.png`, `home-mobile.png`
- `tests/artifacts/course-ready.png`, `course-mobile.png`, `course-result.png`
- `tests/artifacts/customize-mobile.png`
- `tests/artifacts/shared-result.png` — actual exported result artwork
- `tests/artifacts/wallet-colors-configured.png` — explicitly isolated wallet/RPC fixture
- `tests/artifacts/course-physics.json` — physical course trace

## Repeat locally

```sh
npm ci
npm run dev
# In a second terminal:
npm run typecheck
npm test
npm run test:browser
npm run build
```

The Playwright configuration uses installed Google Chrome (`channel: chrome`). If Chrome is unavailable, install an appropriate Playwright Chromium and change the test channel to match. No browser download was needed in this environment. `DUCKLAB_TEST_URL` can target another local server.

## Configured-wallet production test

This deliberately builds into a separate directory. The main game remains unconfigured by default.

```sh
VITE_QUACK_TOKEN_MINT=So11111111111111111111111111111111111111112 \
VITE_QUACK_COSMETIC_THRESHOLD=100 \
VITE_SOLANA_RPC_URL=https://rpc.ducklab.test \
npm run build -- --outDir /private/tmp/ducklab-wallet-fixture
npm run preview -- --outDir /private/tmp/ducklab-wallet-fixture --port 4174
# Second terminal:
node scripts/browser-wallet-check.mjs
```

The wrapped-SOL address here is a **test configuration**, not a QUACK production mint. The test injects a named Wallet Standard fixture and controlled RPC responses; it proves application wiring and adversarial response handling, not an actual Phantom/Solflare/Backpack extension session or live QUACK holdings. It verifies no signature/transaction methods are invoked. The fixture files are not part of the app build.

## Remaining verification boundaries

No real QUACK mint was supplied. Actual wallet extensions and a live configured token should be manually checked on the final HTTPS host. Docker and Vercel publication were not executed. No funds were moved. Commercial model authorization has not been supplied. Mobile-sized Chrome was tested; physical phones, Safari and Firefox were not tested.

The build reports an expected large Three.js chunk and MuJoCo's Node-only `module` branch externalization. The actual production WASM/worker path was tested successfully; these are not compile failures. Performance values shown in the UI are measured on the current device rather than copied from these tests.
