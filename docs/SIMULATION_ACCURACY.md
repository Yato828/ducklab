# Simulation accuracy and course validation

The original Microduck GLB/kinematics render the robot. The 14 servo hinges are driven by MuJoCo state, not animation clips. Geometry tests verify every referenced mesh, hierarchy, joint range and standing scale: the imported standing bounding box is approximately 0.12269 × 0.27450 × 0.14364 metres (Three.js Y-up).

The worker uses the original all-collisions MJCF with 5 ms fixed steps and four steps per policy update. The 61-dimensional observation is gyro 3, projected gravity 3, joint offset 14, joint velocity 14, previous action 14, and command 13. Policy output contains 14 actuator offsets. Gravity projection uses the inverse trunk quaternion. Actuator ranges and finite values are checked before motor targets are applied.

Physics and inference run in a dedicated worker. Rendering uses transferable state buffers and never advances physics. A slow device can progress simulation time more slowly than wall time; the stopwatch follows simulation ticks. Visibility changes pause the game. State mutations (reset, pause, action and start) execute at control-step boundaries, preventing an old asynchronous inference from corrupting a reset.

Walking and recovery policies load at boot. Sitting, rolling, kicks and ground-pick load on first use. The original free-body ball, block and wedge use real contacts. The Time Trial's fixed layout uses the same geometry records for collision and rendering, including gates, slalom pylons and corridor walls. Restart restores all props and robot state.

## Executed evidence

The headless physical course test drives only velocity commands through ONNX/MuJoCo, never writes the robot's pose after reset, and passes all five ordered gates plus the finish. The deterministic reference run completed in **38.82 simulation seconds**, with checkpoint splits **5.00, 12.14, 18.02, 30.76, 35.22**. This is a test run, not a world record or gameplay statistic. The full trace is saved at `tests/artifacts/course-physics.json`.

Physics tests also cover standing/floor contact, forward walking, positive turning, clockwise steering while walking, sit-to-stand, rolling and returning upright, two fallen orientations recovering, both kicks, ground pick, ball-floor collision, and deterministic reset. Browser test results are listed separately in `TESTING.md`; a headless engine test alone is not a browser acceptance result.

## Controller limits retained honestly

- Forward command +0.25 m/s moves about 0.50 m in 5 s and 1.06 m in 10 s under this nominal model.
- Positive yaw command +1 rad/s produces about +1.87 radians in 5 s.
- Negative yaw with forward +0.25 creates a genuine clockwise arc. Negative yaw from rest can stall after a small initial turn.
- Reverse -0.2 from rest and lower forward commands can produce very weak translation. The UI instructs users to steer while walking; reverse is not advertised as a reliable navigation strategy.
- Ground pick is a physical motion, not guaranteed grasping of an arbitrary object.
- Recovery can fail in awkward contacts. The worker pauses after its recovery timeout with an actionable reset message.

The course was designed around these verified capabilities, with no jumps, flight, mesh animation or teleportation. Actual robot hardware differs through friction, actuator dynamics, sensor errors and manufacturing tolerances. Original assets do not establish mathematically perfect sim-to-real equivalence.
