# Local setup

1. Install Node 22.13+ and npm.
2. Run `npm ci` in the repository root.
3. Run `npm run dev`; open `http://127.0.0.1:5173`.
4. Run `npm run typecheck`, `npm test`, and `npm run build` to validate.

No wallet, database, GPU or server API is required. All original robot assets needed by the game are included. `node scripts/fetch-upstream.mjs` checks their pinned hashes and restores missing/mismatched originals from exact source revisions. `scripts/build-robot-scene.py` creates the derived physics scene, then `node scripts/build-browser-collision-meshes.mjs` recreates the official browser collision representation. Re-run physics tests after regenerating assets.

Optional token cosmetics: copy `.env.example` to `.env`; configure a real legacy SPL token mint, public browser-appropriate RPC URL, intended cluster, token symbol and threshold. Mint decimals are read from the chain. Values starting `VITE_` are public and are included at build time. Restart Vite or rebuild after changing them. No keypair, signature or funded treasury is needed.

Use a current browser with WebGL2 and WebAssembly. The first visit downloads the local physics runtimes and original assets; subsequent visits use normal browser caching. Walking/recovery load first; other policies load only when requested. Automatic rendering quality can reduce shadows/resolution; it never changes physics.

If the browser reports a missing asset, preserve the error filename and run the provenance check. If recovery gets stuck, use Restart. If token RPC access fails or a mint is unconfigured, the original/free colors and full game continue working.
