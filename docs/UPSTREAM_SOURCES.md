# Upstream sources and asset provenance

Inspected on 2026-10-27. The complete per-file source URL, byte count, and SHA-256 inventory is `assets/microduck/manifest.json` (87 original files). `npm run test:physics` checks every recorded file hash.

| Source | Pinned revision | Use |
|---|---|---|
| [Official browser simulator](https://huggingface.co/spaces/pollen-robotics/microduck-simulator/tree/ad9d41a763f30dc770817c33d92dcfec0205db1e) | `ad9d41a763f30dc770817c33d92dcfec0205db1e` | Original GLB, kinematics, collision description, policy binaries, robot rig loader, material definitions, controller reference |
| [Microduck](https://github.com/pollen-robotics/microduck/tree/96b89d8613f06722c1d64ce75ab0d7124fed9d8f) | `96b89d8613f06722c1d64ce75ab0d7124fed9d8f` | Hardware/source reference, robot MJCF, licensing |
| [Microduck RL](https://github.com/pollen-robotics/microduck_rl/tree/1e79c29c97d8b38aee9eefde77a545860ba7658e) | `1e79c29c97d8b38aee9eefde77a545860ba7658e` | Controller/observation/actuator reference, collision comparison, license notice. Training is outside current game scope. |
| [Policy repository](https://huggingface.co/pollen-robotics/microduck-policies/tree/665ae4eb20bfe13bca1ef4ea6d4bb6b4a096e448) | `665ae4eb20bfe13bca1ef4ea6d4bb6b4a096e448` | Policy provenance comparison |
| [trymicroduck.com](https://trymicroduck.com/) | Live page, not vendored | Inspected as an unofficial fan simulator. No UI or assets copied from it. |
| [Pollen Robotics product page](https://pollen-robotics.com/microduck/) | Live page, not vendored | Hardware identity/reference. No product photographs copied. |

## Exact representative asset hashes

- `microduck.glb`: `ad0b8d1c886a857fd09d337be11e731f4ac72bf099b0af63081031f97ed6eadb`, 1,279,444 bytes.
- `robot_allcollisions.xml`: `7a6fdf437f5a80c7348ad801f43f906b997a834389cb70cca5e1e8517ba38044`.
- `BEST_alpha_walking.onnx`: `e36332d383997d51401897734cd3e79cf5038406feddb18b4d57ecfb141daa6c`.
- `BEST_alpha_sitstand.onnx`: `c6c40e35e726eabd803d633e090d112994f469921152448367953fbaf9799bc8`.

The Space's sit/stand binary differs from the newer policy repository's sit/stand binary. The game retains the exact compatible Space binary instead of silently mixing versions.

## Reused, adapted, new

Original visual meshes remain in `apps/web/public/robot/mjlab/meshes`; the official GPU-friendly GLB is used without replacing the robot's geometry. The Apache-licensed rig and material source is retained in `packages/simulation-core/upstream`, with its license. `signed.js` was adapted to same-origin static public files; no upstream authentication token is propagated.

`scene_ducklab.xml` removes noncolliding visual geoms from the physics copy (inertias remain explicit), adds a floor and three real free-body props, and retains original servos/collision geoms. `scripts/build-browser-collision-meshes.mjs` reproduces the official browser GLB-to-STL conversion, keeping full original STL files untouched. New course walls, pylons and gates are generated from `packages/game-core/src/course.js` for both MuJoCo and Three.js. They are ordinary original geometric environment design, not substitute robot meshes.

The worker/renderer separation, timer, course, static UI, result image and wallet balance gate are new DUCKLAB code. Physics actions and observation semantics are adapted from verified upstream code.

`robot_walk.xml` exists and was inspected alongside `robot_allcollisions.xml`. The latter retains body/head collision geometry needed for pushes, rolls and obstacles. `robot_groundcontact.xml` does **not** exist in the pinned current source inventories; it was not fabricated or silently substituted.

## Licensing and commercial authorization

Software and published policies identify Apache 2.0 licensing. **The pinned RL README, lines 190–191, explicitly says hardware design files are Creative Commons BY-SA-NC.** A top-level Apache license must not be assumed to override that separate geometry restriction. Original notices are retained under `assets/upstream` and in the provenance manifest.

No separately required commercial geometry authorization has been supplied. The project retains assets for local development/validation; no public commercial deployment has been made. The project owner must obtain appropriate authorization before commercial distribution/hosting of restricted geometry. Names and upstream branding remain their owners' property; DUCKLAB is independent.

## Runtime versions

MuJoCo WASM `3.11.0`, ONNX Runtime Web `1.27.0`, Three.js `0.164.1` match the verified simulator dependencies. React/Vite and all other exact resolved dependencies are recorded in `package-lock.json`. Font packages are locally bundled with their upstream licenses; no external font service is used at runtime.
