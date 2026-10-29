# Dark challenge revision

The current React/Vite, original Microduck rig, MuJoCo WASM, seven working ONNX actions, wallet reader and local record storage are retained. The old short course and light presentation are superseded by REVISION_BRIEF.md. Earlier platform services remain archived.

1. Expand shared course geometry into six physical challenge rooms. Add state-based football, box, sitting and roll objectives, moving exit barriers, explicit assistance penalties, and full physical completion tests.
2. Extract the existing controller into a shared headless/browser runtime. Record step-indexed input changes and actions. Pin the complete gameplay configuration and replay it in bounded isolated server workers.
3. Add only a PostgreSQL leaderboard service: durable verification jobs, rate-limited bounded submissions, verified top ten and world best, and status queries. Reject incomplete or incompatible replays; never use a submitted time.
4. Rework the existing pages/HUD/environment into the requested dark palette, add token and leaderboard routes, configurable identity/official links, contextual action controls and dark result exports.
5. Verify real physical puzzle interactions and full completion, replay determinism, database restart persistence, hostile submissions, production build and desktop/mobile browser flows. Report measured times separately from first-player design targets.

No token launch or money movement is authorized or needed. No production hosting/database credentials or real project links/mint have been supplied; local service tests and deployable configuration will be provided without inventing them.

## Implemented outcome

The shared browser/verifier engine, all six physical objectives, penalties, persistent authoritative leaderboard, dark UI/environment, token details and official roller playground are implemented. The full browser run and authoritative replay complete in 190.30 simulation seconds, with verified submission/UI and persistent database checks. See TESTING.md for precise results and untested external conditions. Final real token/links, hosting credentials, commercial geometry authorization and human balancing remain external release work.
