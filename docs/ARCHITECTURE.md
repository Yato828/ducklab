# Architecture

React/Vite supplies the homepage, free playground, six-stage time trial, customization, token details and verified leaderboard. Three.js renders the original joint hierarchy; cosmetic changes affect materials only. Wallet Standard and finalized SPL RPC reads are independent of gameplay.

`packages/game-core/src/course.js` defines physical boundaries, puzzle dimensions, checkpoints, exits and assistance penalties. MuJoCo XML and Three.js geometry consume this shared definition. `TimeTrial` evaluates actual root/ball/cube state, controller mode, kick contact, pose and stability on fixed control ticks. It rejects skipped/ordered objectives and measures simulation time plus assistance penalties.

`PhysicsEngine` owns MuJoCo data, original policy observations/inference, mode switching, recovery, resets, gate state and input logging. Browser worker scheduling and rendering never determine physics dt. The worker applies every input between ticks. The Node headless runtime loads the same WASM/policy bytes; authoritative replay does not trust browser positions, elapsed time or flags.

Only completed runs may be submitted. The small Node HTTP API bounds requests, persists jobs and quotas in PostgreSQL, and starts isolated verification children. A shared database advisory lock limits global verification concurrency. Only independently finished replays become verified records. Content-hashed configuration IDs prevent comparing different physics versions.

The renderer, worker and policies load lazily; the homepage uses one simulation. Official roller physics/kinematics are a separate Free Playground variant that resets on switching. Mandatory stages always use the normal legged robot. Render quality, UI settings and token cosmetics cannot enter the ranked physics log.

Public hosting is optional and not provisioned here. See DEPLOYMENT.md, LEADERBOARD.md, SECURITY.md and TESTING.md for operation, guarantees and measured limits. Archived marketplace/training services are not dependencies.
