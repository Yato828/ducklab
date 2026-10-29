# Authoritative run verification

The browser records command changes, official movement actions and explicit assistance requests at integer 50 Hz control-step indexes. Pauses have no simulation steps. Inputs are applied between inference ticks in the shared `PhysicsEngine`. No submitted time, checkpoint flags, positions, policy outputs, model URL or executable code is accepted.

`configId` is SHA-256 over gameplay/verification source, robot XML and collision meshes, all policy bytes, MuJoCo WASM/loader, ORT WASM and exact runtime package versions. `npm run pin:gameplay` creates it; `npm run check:gameplay` and API startup reject drift. Geometry, contact tuning, pose thresholds or controller changes require regeneration, fresh validation, and therefore a separate leaderboard. The pinned original-source manifest remains independently checked.

POST `/api/runs` accepts only `{nickname, run}`. Runs are bounded to 1.5 MB JSON, 20,000 events, 24 events per tick and 45,000 ticks (15 simulation minutes), with strict command/action schemas. A PostgreSQL transaction applies persistent limits of three submissions per ten-minute window and thirty per day per HMAC-hashed client address; duplicate submissions consume quota. A global queue holds at most 16 jobs. Only configured origins may send browser requests. SQL values are parameterized.

A database advisory lock permits one active verifier across service instances. Each job starts an isolated child process using the same WASM runtime and official ONNX bytes, without database credentials or application secrets. It reconstructs the initial world, runs every input, independently detects physical objectives, and computes time as `ticks × 20 ms + validated assistance penalties`. A child has a 25-second wall-time limit and 256 MB JavaScript heap limit; the provided container additionally bounds total memory, processes and CPU. WASM allocations are outside the JavaScript heap, so the deployment memory limit matters.

Only a successful six-stage replay is marked `verified` and considered for WORLD BEST / top ten. Rejected/queued/verifying rows never participate. Client time is not stored as official time. Jobs survive API restart; interrupted jobs are retried at most twice. Input payloads are deleted after verification/rejection; the digest, verified result, nickname, timestamps and version remain. Quota hashes expire after one day.

GET `/api/leaderboard` returns the current course/configuration only, with an empty `worldBest: null` when no verified result exists. GET `/api/runs/:id` reports queue/verification status and computes rank from verified rows. Nicknames are self-selected, not authenticated identities. Identical input logs are deduplicated. There are no wallet ownership claims, prizes, wagering or financial rewards. This verifies physically valid control sequences, not that a human rather than a scripted controller produced them.

## Numerical policy

A same-runtime Node reference run must reproduce the entire final qpos exactly. The browser run must finish in the same number of ticks and its final root position must agree within 1e-6 metres in the tested environment. The server's own finish tick and objective state are always decisive; there is no time/flag tolerance that permits an incomplete replay. Untested browser/CPU combinations may fail verification; the UI preserves their local personal best and reports rejection rather than silently publishing an official record.

## Run locally

```sh
DATABASE_URL=postgresql://localhost/ducklab npm run dev:leaderboard
npm run dev
```

Vite proxies `/api` to localhost:8787. For separate hosting set the public `VITE_LEADERBOARD_API_URL` to your HTTPS API's `/api` path and configure `ALLOWED_ORIGINS` on the server. Database credentials and `RATE_LIMIT_SECRET` belong only on the server. Production startup requires a private random rate-limit secret of at least 32 characters.

Use `TRUST_PROXY=1` only when direct access to the API is prevented and the last proxy overwrites/appends the real client IP. Otherwise the default socket address is authoritative. Apply ingress request limits at the host as well; application submission limits do not replace a network DDoS service.

## References

Parameterized SQL follows [node-postgres query documentation](https://node-postgres.com/features/queries). The worker uses [Node child processes](https://nodejs.org/api/child_process.html); durable job claiming uses [PostgreSQL row locking](https://www.postgresql.org/docs/current/sql-select.html). These describe mechanisms, not an independent security audit of DUCKLAB.
