# DUCKLAB — revised single-player game plan

The authoritative scope is `GAME_BRIEF.md`, superseding the original platform brief.

## Existing work inspected

- Keep: original GLB/kinematic hierarchy, pinned MJCF/collision assets, 50 Hz ONNX/MuJoCo worker, camera/renderer, real physics and geometry tests, hashes and provenance.
- Reuse and simplify: React viewport/loading/error component, brand, Wallet Standard connection, token integer arithmetic.
- Isolate outside the active build: unfinished Studio/Monaco, marketplace/Anchor, Fastify/Postgres, S3, Redis, AI and GPU workers. These systems are no longer product requirements.
- Frontend was still in development: no application entry point or complete stylesheet existed at the scope change. Finish those around gameplay rather than the original routes.

## Execution

1. Preserve obsolete work in `archive/platform/`; remove its runtime dependencies, scripts, routing and service requirements from the game.
2. Verify controller direction behavior, then build one traversable course from shared physical/visual geometry with five ordered checkpoint gates and a finish line.
3. Run stopwatch/checkpoint state on physics ticks; pause/reset atomically, persist course-versioned personal records locally.
4. Finish Playground, Time Trial and Customize routes, keyboard/touch/gamepad controls, responsive game HUD, result screenshot and X sharing.
5. Replace wallet authentication with optional Wallet Standard connection and real read-only SPL mint/balance checks. Cosmetics change materials only.
6. Test full physical course completion, timer edge cases, browser rendering, local records, restart, and static production build. Record exact results and remaining external configuration.

No server, database, paid transaction, GPU service, leaderboard or prize system is required. Do not claim commercial geometry rights without authorization.

## Verified outcome

The revised static game is implemented. All original asset hashes validate. The real MuJoCo/ONNX course test completes all five gates and the finish. The full browser run, personal-best persistence, screenshot export, restart, mobile layout, and the isolated production wallet balance gate have executed successfully. Current validation details and limits are in `TESTING.md`.

External items remaining are optional real token configuration, manual final-host wallet-extension compatibility checks, and commercial geometry authorization before a commercial public release. No obsolete platform service is needed for the game; the isolated old PostgreSQL test process was stopped.
