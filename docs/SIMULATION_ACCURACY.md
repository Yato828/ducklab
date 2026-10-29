# Simulation fidelity and measured gameplay

The robot remains the original Microduck GLB and kinematic hierarchy, with the original MJCF inertias, limits and 14 actuators. Original source files are pinned in `assets/microduck/manifest.json`; all 87 hashes are regression-tested. Browser collision meshes follow the official GLB-to-binary-STL conversion. No prerecorded animation or renderer motion drives gameplay.

MuJoCo 3.11.0 runs four 5 ms substeps per control tick. ONNX Runtime Web 1.27.0 uses a single-threaded WASM execution provider, with the original 61-value observation and fourteen joint outputs. Node replay uses the same engines. Walk/recovery load at boot; other policies load on first use. Render FPS does not enter simulation time.

The official controller has asymmetric behavior: forward motion and left turns track well in the tested setup; right turns are useful while walking, while reverse and right turns from rest can hesitate. These limitations are retained and explained in the controls guide. Sit/stand, both kicks, forward roll, ground pick, automatic recovery and the separate official roller drive/crouch variant are physically exercised by tests.

The current `chaos-lab-v2` reference run completes all six mandatory stages and the finish in **190.30 simulation seconds** without assistance. It only sends supported velocity commands and actions. It does not write robot, ball or cube positions after initialization. Splits: 26.14, 73.68, 103.56, 124.98, 142.74, 183.20 seconds. The ball is actually struck by a kicking robot contact; the cube is actually pushed; sitting and roll are checked from physical state.

The reference controller is automated, so 190.30 seconds is not a measured first-time human benchmark. The 2–4 minute first-player target remains a design goal; human playtesting is still useful for balancing. The same input log reproduced exact final qpos in Node and zero final root-position difference between the tested Chrome and Node runtimes. Cross-platform tolerances and honest rejection behavior are described in LEADERBOARD.md.

Assisted resets are the only in-run position resets. They are explicit UI actions, visible penalties and recorded replay events. Resetting the whole course restores all physics state, objects, gates and progression. A seated objective also requires the actual sit/stand controller; pressing R alone is insufficient. A roll requires a measured tilt inside the zone followed by an upright hold.

This is a browser simulation, not a claim of perfect equivalence to physical robot hardware. No fictitious abilities, jumps or competitive physics boosts are added.
