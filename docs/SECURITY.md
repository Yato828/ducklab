# Game security boundaries

The active product is static and does not accept user code, model uploads, purchases or server jobs. The worker runs only pinned bundled official policies. There is no `eval`/dynamic execution of user programs, signing request, token-transfer instruction, marketplace authority, seed phrase or private-key storage.

Wallet metadata is rendered as React text. Wallet Standard provides explicit connection/disconnection and account-change notifications. Balance checks are aborted/replaced on account changes, refreshed periodically while visible, and fail closed for gated colors. Mint owner, initialization, decimals, token account owner/mint, amount, slot and integer threshold are validated. RPC is still a configured external trust source; use a reputable provider and the correct network.

All balances are bigint base units; floating-point prices do not exist. A missing/invalid mint or failed RPC response cannot unlock a gated color. Free gameplay and free colors are independent of the wallet. Client-side colors are not secure DRM and confer no physical or competitive advantage.

Local records are intentionally user-controlled. They are not authenticated, globally ranked or eligible for monetary rewards. Clearing browser storage removes records. The result screen describes them as local personal times.

Physics mutation messages are serialized at policy-tick boundaries. Policy observations, outputs and joint target ranges reject non-finite/unsafe states. Errors pause with a recovery/reset message. Rendering quality and cosmetics never mutate physics geometry or actuator parameters. The fixed course cannot be modified through the game UI during a timed run.

Static hosting requires the documented browser isolation headers. Do not put credentials in `VITE_` variables. Archived platform source is excluded from application routes and imports and must not be deployed as a functioning backend.
