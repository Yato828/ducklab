# Security boundaries

The browser is untrusted for official records. Leaderboard submissions contain only bounded step-indexed control inputs; no client time, checkpoint flags, root positions or policy outputs are accepted. The server uses pinned local physics/policy assets and independently checks the entire run. Only successful replay results populate world best and top ten. Self-selected nicknames are not verified identities, and scripted control sequences are not excluded by this verifier.

PostgreSQL persists jobs, results and quotas. Parameterized SQL, explicit origin rules, input schemas, 1.5 MB request bounds, tick/event limits, a 16-job queue, database-global verification concurrency and isolated child-process time limits bound abuse. Children receive no server credentials. Production containers additionally bound total CPU and memory. Public deployment should use HTTPS and ingress rate limiting; these controls are not an independent security audit or blanket DDoS guarantee.

Wallet Standard connection shares only the chosen public account. Finalized RPC checks validate the configured legacy SPL mint, program owner, initialization, decimals and every returned token account's mint/owner/state. All arithmetic is integer-based. RPC failures, account changes and disconnect revoke eligibility. No signing/transaction methods, seed phrases, token transfers or contracts are used. Client cosmetics are visual access rules, not financial DRM.

Vite configuration is public and contains no private server secrets. `DATABASE_URL` and `RATE_LIMIT_SECRET` are server-only. Token and official social configuration is empty by default; the app does not invent launch details. Preferences and personal times remain in localStorage. User-submitted logs are retained only until verified/rejected; nicknames, digests, versions, timestamps and verified results remain. HMAC quota identifiers expire after a day.

No public host, real token or live wallet-extension environment was configured during development. See TESTING.md for the precise scope of exercised integrations. Commercial model distribution still requires the authorization described in UPSTREAM_SOURCES.md.
