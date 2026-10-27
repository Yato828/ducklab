# IMPORTANT: DUCKLAB PROJECT SCOPE CHANGE — READ BEFORE CONTINUING

The original DUCKLAB specification has changed significantly.

**This message overrides the previous master prompt wherever the requirements conflict.**

You have already started developing the original project. Do not start over, delete the repository, or rebuild everything from scratch.

First, inspect the current implementation, identify what has already been completed, and preserve all reusable functionality.

We are simplifying DUCKLAB into a polished, single-player Microduck obstacle-course game with real physics, a stopwatch, and lightweight Solana integration.

The new priority is to complete a smaller, genuinely working product instead of building an unnecessarily complex platform.

## 1. STOP DEVELOPING THESE FEATURES

Immediately stop implementing the following systems from the previous specification:

- Multiplayer and online matches.
- PvP battles.
- Matchmaking.
- Global competitive leaderboards.
- Server-hosted tournaments.
- Prize pools and reward distribution.
- GPU training.
- Reinforcement-learning training infrastructure.
- Custom neural-network training.
- GPU workers.
- AI-generated movements.
- AI coding assistants.
- Complex Code Studio.
- Monaco code editor.
- User scripting marketplace.
- Paid movement packs.
- Creator royalties.
- NFT functionality.
- Movement publishing and sales.
- Solana marketplace smart contracts.
- Anchor marketplace programs.
- Payment reconciliation infrastructure.
- Advanced creator profiles.
- Complex user dashboards.
- Extensive administrator dashboards.
- Excessive backend microservices.
- Unnecessary databases and queues.

**These features are no longer part of the MVP.**

If you have already implemented some of them, do not recklessly delete working code.

First evaluate dependencies.

Remove unfinished functionality from the user-facing product and safely eliminate unused complexity.

Preserve reusable UI components, simulation code, asset loaders, wallet integration, and other useful infrastructure.

If a partially built system can be isolated without affecting the game, keep it outside the active application rather than spending significant time rebuilding or removing it.

Do not use destructive git operations or overwrite unrelated existing work.

## 2. NEW PRODUCT DEFINITION

DUCKLAB is now a single-player browser game featuring an authentic Microduck robot.

The user opens the website and can immediately interact with the robot.

There are two main modes:

### Mode A — Free Playground

Users can freely control Microduck and interact with the environment.

Features:

- Authentic 3D Microduck.
- Real MuJoCo physics.
- Existing official ONNX movement policies.
- Keyboard controls.
- Walking and turning.
- Other verified supported robot actions.
- Falling and recovering.
- Camera controls.
- Physics-based objects.
- Reset.

No wallet or registration required.

### Mode B — Obstacle Course

The user controls Microduck through a predefined obstacle course.

The goal is simple:

**Reach the finish line as quickly as possible.**

This should feel like a real, enjoyable game rather than a robotics demonstration.

The obstacle course is the new primary feature.

## 3. BUILD A COMPLETE OBSTACLE COURSE

Create a carefully designed 3D obstacle course using the existing simulation engine.

The course should contain:

1. Starting area.
2. First checkpoint.
3. Slalom section.
4. Narrow corridor.
5. Section with physical obstacles.
6. A controlled turning challenge.
7. Final checkpoint.
8. Finish line.

The course should have approximately five mandatory checkpoints.

Use physical geometry and real MuJoCo collision handling.

Important:

The course must be realistically traversable using the existing Microduck capabilities.

Do not implement unrealistic jumps, flying, teleportation, or invented robot abilities.

Do not fake collision physics.

Do not directly animate the rendered robot through obstacles.

The robot must actually move using its supported policies and simulated physical state.

Test the entire course from start to finish.

If obstacles are too difficult or incompatible with the robot, adjust the course geometry rather than inventing movement capabilities.

## 4. IMPLEMENT A REAL STOPWATCH

The timer is the main gameplay mechanic.

Add a clean, always-visible HUD showing:

- Current time.
- Personal best.
- Current checkpoint.
- Total checkpoints.
- Restart.

Timer behavior:

- Start from 00:00.00.
- Begin only when the run officially starts.
- Measure elapsed simulation time.
- Show hundredths of a second.
- Stop when the robot crosses the finish line after passing every required checkpoint.
- Do not allow checkpoints to be skipped.
- Ignore accidental repeated checkpoint activation.
- Reset completely when restarting.
- Pause correctly when the simulation is paused.
- Avoid timing bugs when browser rendering FPS changes.

A run finishes only when all checkpoints are completed in the correct order.

Save the personal best locally using localStorage.

Personal records should persist after refreshing the website.

No database, authentication, or global leaderboard is needed for personal records.

Do not award cryptocurrency for locally recorded times.

## 5. FINISH SCREEN

When the user completes the course, show a polished result screen.

Example:

DUCKLAB

COURSE COMPLETED

YOUR TIME
00:42.81

PERSONAL BEST
00:38.26

Buttons:

- Try Again
- Free Playground
- Share Result

If the player achieves a new personal record, show a subtle celebration.

Avoid excessive particle effects.

Allow exporting a screenshot of the result and sharing it to X.

Do not claim a local time is an independently verified world record.

## 6. KEEP THE AUTHENTIC MICRODUCK

This requirement has NOT changed.

The robot must remain an accurate representation of the original Pollen Robotics Microduck.

Preserve:

- Original geometry.
- Correct proportions.
- Real joint structure.
- Actual MJCF physics.
- Existing ONNX policies.
- Real joint-driven rendering.
- Collision and recovery behavior.

Reuse the authentic upstream simulator assets where authorized.

Do not simplify the robot into a cartoon character.

Do not replace the physical simulation with prerecorded animations.

The simulation should continue running locally in the browser.

No GPU server is needed.

The current working simulation must be preserved during refactoring.

Do not introduce licensing-restricted commercial assets without the required authorization.

## 7. SIMPLIFY THE WEBSITE

Remove the excessive dashboard structure from the previous design.

The new navigation should contain:

- Playground
- Time Trial
- Customize
- Connect Wallet

Keep the existing premium visual identity if already implemented successfully.

Use:

- Warm white backgrounds.
- Dark graphite typography.
- Minimal yellow accents.
- Large 3D viewport.
- Clean controls.
- Smooth but subtle animations.

The robot and its environment should visually dominate the experience.

Do not redesign working components unnecessarily.

Make the Time Trial easily accessible from the homepage.

Users should understand how to play immediately.

## 8. KEEP SOLANA, BUT SIMPLIFY ITS ROLE

DUCKLAB remains a crypto-related product.

Do not remove Solana integration completely.

However, remove the complicated token marketplace and onchain financial systems.

Keep:

- Wallet connection.
- Phantom compatibility.
- Solflare compatibility.
- Backpack compatibility where supported.
- Configurable $QUACK SPL token mint.
- Token balance display.
- Optional token-gated cosmetic items.

Example:

All users get the original robot appearance for free.

A connected wallet holding a specified amount of $QUACK can unlock additional cosmetic appearances.

Possible cosmetic items:

- Alternative robot body colors.
- Small hats.
- Glasses.
- Decorative accessories.
- Alternative environment themes.

Cosmetics must not modify physics, collision shapes, speed, or competitive ability.

The cosmetics system must validate the correct SPL token mint and the wallet's real token balance.

For the MVP, token-gated cosmetics should work through balance checks.

No marketplace purchases, token transfers, staking, reward payouts, or custom Solana contracts are required.

The threshold for cosmetic access must be configurable.

If the token mint is not configured, disable token-gated cosmetics gracefully and keep the main game fully playable.

Wallet connection must never be required for free gameplay.

## 9. REMOVE UNNECESSARY BACKEND COMPLEXITY

The previous specification included PostgreSQL, Redis, workers, training services, marketplace APIs, and other infrastructure.

Most of these are no longer necessary.

Prioritize a static frontend architecture:

- React.
- TypeScript.
- Vite.
- Three.js.
- MuJoCo WASM.
- ONNX Runtime Web.
- Tailwind CSS.
- Zustand.
- Solana wallet integration.

Use the existing working architecture where practical.

Do not rewrite the entire application only to change frameworks.

Run physics and ONNX inference in the user's browser.

Store game records and settings locally.

Only introduce a backend endpoint when a real security or functional requirement justifies it.

Keep hosting requirements minimal.

The final game should be deployable to Vercel or another static hosting service, provided the required WebAssembly assets and browser isolation headers are correctly configured.

## 10. PERFORMANCE AND STABILITY

Prioritize a smooth gaming experience.

Implement:

- Efficient asset loading.
- Lazy loading of unnecessary robot policies.
- Physics execution independent of rendering FPS.
- Camera-follow mode.
- Adaptive rendering quality.
- Clean WebGL resource management.
- Safe restart behavior.
- Robust physics reset.
- Proper browser resize handling.
- Loading progress.
- Helpful error messages.

Target smooth gameplay on modern desktop browsers.

Do not render multiple expensive robot simulations unnecessarily.

Do not send physics updates to a server.

Avoid excessive network requests.

## 11. WHAT TO DO WITH THE EXISTING WORK

Before making changes:

1. Inspect the entire current repository.
2. Identify completed modules.
3. Identify modules that are still in development.
4. Identify obsolete functionality from the old master prompt.
5. Determine which pieces can be reused.
6. Preserve the working Microduck simulation.
7. Preserve useful styling and components.
8. Simplify routing and navigation.
9. Remove unused dependencies where safe.
10. Implement the new obstacle-course experience.

Create a brief updated implementation plan based on the existing codebase.

Then continue coding.

**Do not respond with only another plan. Execute the changes.**

Do not restart from an empty application.

Do not waste time recreating functionality that is already working.

## 12. ACCEPTANCE CRITERIA

The updated MVP is complete when:

1. The website launches successfully.
2. The authentic Microduck model appears correctly.
3. The robot moves using genuine physics.
4. Users can control it with their keyboard.
5. Free Playground works.
6. Time Trial loads a complete obstacle course.
7. The stopwatch works accurately.
8. All checkpoints detect the robot correctly.
9. The robot can complete the entire course.
10. The finish line stops the timer.
11. Personal best is saved locally.
12. Restart resets everything correctly.
13. The result screen works.
14. Wallet connection works when configured.
15. Token-gated cosmetic items work when configured.
16. The UI is polished and responsive.
17. The application builds successfully.
18. The main game can run without a backend or GPU server.

Use actual automated and browser tests.

Do not fabricate successful test results.

## FINAL PRIORITY

The old version of DUCKLAB was too complicated.

We no longer need a large robotics platform with AI training, marketplaces, online competitions, or custom blockchain programs.

We want a focused, addictive, single-player robotics game.

The most important experience is:

**Open DUCKLAB → Control the real Microduck → Enter the obstacle course → Beat your personal record → Try again.**

Solana should be integrated naturally through optional wallet connectivity and cosmetic customization.

Complete this revised product using as much of the existing working implementation as possible.

Do not return to the original complex roadmap unless explicitly requested.

**Now inspect the current implementation, adapt the existing codebase to these requirements, and finish the working game.**