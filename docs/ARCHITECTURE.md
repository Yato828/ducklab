# Static game architecture

React/Vite owns three experiences: Free Playground (also the homepage), Time Trial, and Customize. A single `SimulationViewport` is mounted per route. Customize loads only the original rig/standing pose; gameplay additionally starts a dedicated physics worker.

`packages/simulation-core/src/physics.worker.js` owns MuJoCo data, the fixed timestep, ONNX sessions, controller actions, recovery, physical objects and Time Trial state. Operations that mutate/reset physics are queued between inference steps. Rendering never changes robot qpos. The renderer receives transferable state arrays and applies original joint transforms to the original rig. The course's shared geometry feeds both the MJCF augmentation and Three.js environment meshes.

`packages/game-core/src/trial.js` detects positive-direction segment crossings for only the next expected gate, then the finish. The elapsed time is derived from simulation time, independent of display FPS. Paused workers produce no new simulation ticks. The browser saves a completed best by course version. Change the course ID when geometry, robot dynamics or policies change enough to invalidate comparisons.

Cosmetics change only visual materials. Wallet Standard connection is optional. `packages/solana/src/balance.ts` performs finalized read-only RPC calls, validates the configured mint and token accounts, and compares bigint base units against a decimal-aware threshold. No account authentication, backend entitlement, token transfer, staking or financial contract exists in the active app. Client-side cosmetic gating is a convenience, not DRM or an authoritative competitive permission system.

Original software, assets, licenses and hashes are retained. Prior platform work is in `archive/platform` with no runtime imports or build routes. The game is hosted as static files with WASM-compatible MIME types and isolation headers.
