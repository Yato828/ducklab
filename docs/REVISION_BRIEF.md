# DUCKLAB — MAJOR GAMEPLAY AND DESIGN REVISION

## IMPORTANT: THIS IS A CORRECTION TO THE EXISTING PROJECT

The current DUCKLAB implementation is not meeting the intended gameplay and product requirements.

You have already built the website, integrated the robot, and created a basic obstacle course.

**Do not restart the project. Work with the existing codebase.**

The current obstacle course is too short, takes approximately 15 seconds to complete, contains almost no meaningful obstacles, and does not encourage replayability.

The site also lacks a recognizable memecoin identity and proper competitive time tracking.

We need to transform the existing implementation into a genuinely entertaining physics-based obstacle challenge with a polished dark Web3 design.

This request overrides conflicting requirements from earlier prompts.

Do not rebuild existing working features unnecessarily.

Inspect the current project and implement the following changes.

---

# 1. COMPLETELY REWORK THE OBSTACLE COURSE

The current course is unacceptable as the final game.

Replace the short walking route with a much larger, multi-stage obstacle course.

The course should take approximately 2–4 minutes for a first-time player, depending on skill.

An experienced player should be able to improve their time significantly through practice.

It must contain real challenges, not simply a longer walking path.

Use the authentic Microduck robot, original ONNX policies, and MuJoCo physics already integrated into the project.

The obstacle course should be challenging, entertaining, and replayable.

## Stage 1 — Starting Zone and Slalom

The player starts behind a clearly marked starting line.

Pressing Start begins the run.

Create a proper slalom section containing physical barriers and tight turns.

The user must maneuver the robot around the obstacles without getting stuck.

Include clear visual guidance showing the direction of the course.

Use real MuJoCo collision geometry.

## Stage 2 — DUCK FOOTBALL

This is a mandatory physical puzzle.

Create:

- A realistic physics-enabled ball.
- A small football goal.
- A marked shooting area.
- A locked exit gate.
- A visible objective indicator.

Display:

**OBJECTIVE: SCORE A GOAL**

The player must move Microduck into position and kick the ball into the goal.

Use the existing official left-kick and right-kick policies.

Do not make the ball move automatically when a key is pressed.

The ball must move due to physical contact with the robot.

A goal is valid only when the simulated ball genuinely crosses the goal line inside the goal area.

Implement proper detection using the ball's MuJoCo position and collision geometry.

When the player successfully scores:

- Show GOAL!
- Play a short sound effect.
- Update the objective.
- Open the exit gate.
- Allow progression.

The gate must not open unless the goal condition is actually satisfied.

Provide a way to reset the ball without restarting the entire run. Apply a clearly disclosed time penalty for this assisted reset.

Tune the ball mass, friction, goal dimensions, and available space so scoring is realistically achievable using the existing kick policies.

Test successful scoring in the actual simulator.

## Stage 3 — PUSH THE BOX

Create a second mandatory puzzle.

Display:

**OBJECTIVE: MOVE THE BOX INTO THE TARGET**

The arena contains:

- One movable physical cube.
- A clearly highlighted target area.
- Surrounding physical boundaries.
- A locked exit.

The player must physically push the cube into the designated target.

Use real physics.

The cube should respond to contact with Microduck.

Do not teleport or animate the cube into position.

The puzzle is complete only when the cube's actual physical position is inside the target, with an appropriate stability check.

Use a lightweight, appropriately sized cube that Microduck can realistically move.

Tune mass, friction, and geometry carefully.

After completion, unlock the next section.

Provide a cube reset option with a time penalty.

## Stage 4 — SIT TO UNLOCK

Use Microduck's existing sit/stand policy.

Create a marked pressure platform.

Display:

**OBJECTIVE: SIT ON THE PLATFORM**

The user must position Microduck on the platform and activate the real sit movement.

The platform must detect the robot's actual physical position and pose.

Do not trigger success merely because the user presses the sit button.

Only unlock the next gate when the duck actually reaches and briefly holds the required pose on the platform.

Use tolerances that make the task practical rather than frustrating.

After completion, the player must stand up and continue.

## Stage 5 — PHYSICAL ACTION CHALLENGE

Create an area that requires another original Microduck ability.

Use one of the following verified policies:

- Forward roll.
- Ground pick.
- Additional kicking.
- Recovery from falling.

Prefer a physically measurable challenge involving the real forward-roll policy or contact with a target object.

Examples:

- Complete a controlled roll inside a designated zone.
- Knock a lightweight object from a platform.
- Interact with a ground object using the existing ground-pick motion.

Important:

Do not fake movement capabilities.

Inspect which policies are actually implemented and working in the current simulator.

Choose a challenge that can be completed reliably with those policies.

Completion must be validated from robot state and physical interaction, not simply the keypress.

## Stage 6 — FINAL COURSE

Create a final navigation challenge containing:

- Tight turns.
- Multiple physical obstacles.
- Narrow passages.
- Clear route markers.
- Final checkpoint.
- Finish gate.

The user must complete all previous mandatory objectives before reaching the finish line.

Crossing the finish line should immediately stop the timer and trigger the results screen.

## Level design requirements

The level must look like a real designed game.

Use:

- Clear stage boundaries.
- Directional arrows.
- Floor markings.
- Checkpoint signage.
- Visible objective text.
- Highlighted interactive objects.
- Progress indicators.
- Distinct challenge areas.

Keep the entire environment consistent with the new dark visual identity.

Use appropriate lighting so objects remain clearly visible.

Do not simply place a few randomly scattered boxes in an empty room.

---

# 2. MAKE THE ORIGINAL MICRODUCK MOVEMENTS USEFUL

The existing robot abilities should be part of the gameplay.

Inspect the currently integrated ONNX policies and preserve their real behavior.

The official simulator includes:

- Walking.
- Turning.
- Sitting and standing.
- Left kick.
- Right kick.
- Forward roll.
- Ground pick.
- Roller mode.
- Recovery behavior.

Make the appropriate available actions accessible in the game.

Implement a compact controls panel with real keyboard shortcuts.

Show contextual control hints during relevant challenges.

For example:

During Duck Football:

**Q — LEFT KICK**
**E — RIGHT KICK**

During Sit to Unlock:

**R — SIT / STAND**

During physical action sections, show the corresponding verified controls.

Provide an expandable guide listing all currently available robot abilities.

Do not remove original supported features just because they were not used in the first obstacle course.

If switching into roller mode resets or reconstructs the simulation, make sure it cannot destroy the active run or bypass progression.

Roller mode can remain available in Free Playground if it cannot be safely integrated into the timed course.

The same principle applies to other optional abilities.

All mandatory stages must be completable with the normal supported robot setup.

---

# 3. IMPLEMENT REAL COMPETITION WITHOUT MULTIPLAYER

We do not want real-time multiplayer.

No matchmaking.

No live PvP.

No simultaneous synchronized physics.

However, the game must have competitive replayability.

Implement two persistent records:

**YOUR BEST**

The current user's personal fastest completed time.

**WORLD BEST**

The fastest verified completed time among all submitted players for the same course version.

Display both prominently in the game HUD.

Example:

YOUR BEST: 01:42.38
WORLD BEST: 01:19.72

These numbers are examples only. Never hardcode them as actual results.

When the database contains no verified record, display a proper empty state such as `--:--.--`.

## Personal best

Store local personal records immediately.

Use localStorage for guest users.

Records must survive page refreshes.

Only completed runs count.

Include course version and gameplay configuration in the record.

## Global best

A real global leaderboard requires a small backend.

Implement only the necessary infrastructure:

- Persistent database.
- Minimal leaderboard API.
- Run submission endpoint.
- Verification worker.
- Leaderboard query.
- Basic anti-abuse protection.

Use the existing backend infrastructure if it is already available.

Otherwise use a lightweight Node.js service and PostgreSQL.

Avoid rebuilding the whole application as an enterprise backend.

The leaderboard must persist across users, devices, and server restarts.

Provide:

- Global best time.
- Player nickname or shortened wallet address.
- Top 10 leaderboard.
- Verified status.
- Course version.

## Security requirements for global scores

Never trust a client-submitted completion time.

Never trust client-submitted checkpoint flags.

Never grant a world record just because the browser reports a fast time.

The browser is not an authoritative source.

Implement a verifiable run-submission system.

For ranked runs:

1. Create a fixed course version.
2. Lock the physics assets and policy versions.
3. Use a reproducible initial world state.
4. Record player control commands indexed by simulation step.
5. Include all movement actions and explicit reset requests.
6. Submit a bounded run log after completion.
7. Re-run the recorded inputs in an isolated authoritative verification worker using the matching simulation and policy versions.
8. Independently check physics interactions, mandatory objectives, checkpoint order, and finish crossing.
9. Compute the official time from validated physics simulation steps.
10. Insert the result into the leaderboard only after successful verification.

Document and test replay determinism and acceptable numerical tolerances.

If headless replay cannot be made sufficiently reliable, do not silently accept unverified scores as official world records.

Instead, keep the honest personal record system and clearly label provisional community submissions until authoritative verification is implemented.

Do not fake anti-cheat protection using frontend checks alone.

Rate-limit run submissions and bound verification CPU usage.

The global record must be genuinely competitive.

---

# 4. NEW FULL DARK THEME

The previous light design must be replaced.

DUCKLAB should now have a recognizable dark memecoin aesthetic.

Use the following palette:

Main background: `#090909`
Secondary background: `#121212`
Panels: `#181818`
Borders: `#292929`
Primary text: `#F5F5F5`
Secondary text: `#858585`
Duck accent yellow: `#F5D65B`
Success green: `#79D8A5`

The overall appearance should be:

- Dark.
- Minimal.
- Premium.
- Modern.
- Clean.
- Slightly playful.
- Clearly related to crypto culture.

Avoid:

- Bright white pages.
- Generic corporate SaaS appearance.
- Excessive glassmorphism.
- Huge colorful gradients.
- Random glowing decorations.
- Overloaded dashboards.
- Generic AI-looking card layouts.

The website must feel like an actual indie crypto game.

Use strong typography and generous spacing.

The real 3D Microduck should remain the primary visual element.

## Gameplay environment

Also redesign the 3D environment.

Use:

- Dark matte floors.
- Graphite walls.
- Soft overhead lighting.
- Yellow checkpoint markings.
- Yellow interactive highlights.
- High-contrast physical objects.
- Minimal futuristic signage.

The environment should be visually interesting but not distract from gameplay.

Avoid making everything so dark that obstacles are difficult to see.

---

# 5. DUCKLAB MUST LOOK LIKE A MEMECOIN PROJECT

This is a critical missing part of the current website.

The previous implementation barely mentions cryptocurrency.

That must change.

DUCKLAB is not only a robotics game.

It is a Solana memecoin project with a real browser game attached to it.

The website must communicate this identity immediately.

Use the working token identity:

PROJECT: DUCKLAB
TOKEN: $QUACK
BLOCKCHAIN: SOLANA

Keep the project name and ticker configurable.

## Main navigation

Include:

DUCKLAB
PLAY
CHALLENGES
LEADERBOARD
TOKEN
CONNECT WALLET

## Homepage hero

Use a large interactive Microduck visual and bold typography.

Main headline:

**SMALL DUCK.
BIG CHAOS.**

Subheading:

"A real robot. A ridiculous obstacle course. One mission: beat the clock."

Add a smaller token identity line:

**POWERED BY $QUACK ON SOLANA**

Primary button:

**PLAY NOW**

Secondary button:

**ABOUT $QUACK**

Make the homepage immediately recognizable as a crypto-native game, not a generic robotics research platform.

## Token section

Create a dedicated $QUACK section.

Display:

- Token name.
- Ticker.
- Blockchain.
- Official contract address.
- Copy Contract Address button.
- Connect Wallet button.
- Verified token balance.
- Relevant official community links.

Include configurable links for:

- X.
- Telegram.
- Pump.fun.
- Dexscreener.

Use the project's real configured links.

Do not invent social media URLs or contract addresses.

If the token has not yet launched, show `COMING SOON` instead of displaying a fake contract.

Do not invent liquidity, market capitalization, holders, circulating supply, or transaction statistics.

Optional onchain or market data should only appear when a real integration is configured.

## Token utility

Make token utility simple and understandable.

$QUACK holders can unlock optional cosmetics such as:

- Special duck colors.
- A black-and-yellow duck appearance.
- Decorative accessories.
- Different laboratory themes.
- Cosmetic finish-line effects.

Use real Solana wallet integration and verified token balances.

Gameplay must remain free.

Do not implement pay-to-win boosts.

Do not give token holders faster movement or better physics.

Do not add wagering or financial rewards for fastest runs.

Users compete for times, recognition, and bragging rights.

Do not implement a new token launch or mainnet transaction without explicit authorization.

---

# 6. REWORK THE IN-GAME HUD

The current game interface should be redesigned.

Place the following information around the simulation viewport:

Top left:

DUCKLAB
TIME TRIAL

Top center:

CURRENT OBJECTIVE

Top right:

TIME
YOUR BEST
WORLD BEST

Bottom left:

CONTROL HINTS

Bottom center:

CURRENT CHECKPOINT / OBJECTIVE PROGRESS

Bottom right:

RESTART
PAUSE
SETTINGS

Make this information readable without covering the robot.

Highlight the current mandatory objective clearly.

For example:

**STAGE 2 / 6**
**SCORE A GOAL**
Kick the ball into the goal to unlock the next gate.

Once completed, display a short success animation and automatically update to the next objective.

The HUD must remain consistent throughout the course.

---

# 7. IMPROVE THE END-OF-RUN SCREEN

After finishing the entire course, display:

**COURSE COMPLETED**

YOUR TIME

PERSONAL BEST

WORLD RECORD

CURRENT RANK — if the submitted score has been verified and ranked

Also show:

- Total stages completed.
- Time penalties.
- Whether a new personal best was achieved.
- Whether a new verified world record was achieved.

Buttons:

- PLAY AGAIN
- VIEW LEADERBOARD
- SHARE ON X
- BACK TO PLAYGROUND

Do not label a client-only record as a verified world record.

Allow the user to share a screenshot of their completed run.

Use clean dark visuals and the DUCKLAB branding.

---

# 8. COURSE BALANCING

The course should be genuinely challenging but not frustrating.

Target first-time completion time:

Approximately 2–4 minutes.

Target experienced completion time:

Meaningfully faster, depending on actual testing.

These are design goals, not fake benchmark claims.

Important:

- Every obstacle must be physically completable.
- Avoid excessive difficulty spikes.
- Avoid getting the robot permanently stuck.
- Add safe reset options.
- Preserve timer accuracy.
- Apply a visible penalty for assistance.
- Make objective locations obvious.
- Never require unavailable movements.

Tune the actual course using the real robot physics.

Do not claim that a challenge is playable merely because the geometry renders correctly.

Test realistic approaches to each obstacle.

---

# 9. PRESERVE EXISTING WORK

Before modifying the application:

1. Inspect the current repository.
2. Identify the actual simulator implementation.
3. Identify already working features.
4. Inspect the current course implementation.
5. Identify how physics objects are created.
6. Identify how robot movement policies are connected.
7. Identify the current styling system.
8. Identify existing wallet and token integrations.
9. Reuse existing components wherever possible.
10. Implement improvements directly into the current application.

Do not discard the existing authentic Microduck model.

Do not replace MuJoCo with a simpler fake physics engine.

Do not rebuild working wallet functionality.

Do not reimplement the whole website from scratch if the current architecture is usable.

Do not stop after creating a plan. Execute the changes.

---

# 10. TESTING REQUIREMENTS

The new implementation must pass the following tests.

### Gameplay

- Real Microduck model loads.
- Walking works.
- Both available kicks work.
- Sit/stand works.
- Other supported motions remain accessible.
- Physics objects respond to collision.
- Football goal can genuinely be scored.
- Cube can be physically moved into its target.
- Sit platform checks actual pose.
- Every stage is completable.
- Objectives unlock correctly.
- Mandatory objectives cannot be skipped.
- The entire course can be completed.

### Timing

- Timer starts correctly.
- Timer stops correctly.
- Pausing works.
- Restart resets the timer and physical objects.
- Local personal best persists.
- Global best loads from persistent storage.
- Verified scores are the only scores eligible for official world-best status.

### Cryptocurrency

- Solana wallet connection works.
- Token balance is read from the correct mint.
- Contract address copy works.
- Official links are correctly configured.
- Token-gated cosmetics work when enabled.
- Free gameplay works without a wallet.

### Design

- Homepage uses the dark theme.
- Playground uses the dark theme.
- Course uses the dark theme.
- Leaderboard uses the dark theme.
- Token section is visible and functional.
- Desktop layout works.
- Mobile and tablet layouts degrade gracefully.

---

# 11. IMPLEMENTATION PRIORITIES

Implement in this order:

**Priority 1 — Real gameplay**

Replace the short course with properly working physical challenges.

Football, cube puzzle, pressure platform, and final navigation are the most important features.

**Priority 2 — Timing and competition**

Create personal best tracking, verified global leaderboard, and clear result screens.

**Priority 3 — Dark visual redesign**

Update the entire site and simulation environment to the new dark identity.

**Priority 4 — Memecoin integration**

Make $QUACK clearly visible across the site. Implement token details, community links, wallet connectivity, and cosmetic token utility.

**Priority 5 — Final polish**

Fix bugs, balance the course, test performance, and verify complete end-to-end gameplay.

---

# FINAL INSTRUCTION

The current project feels like a short robotics demonstration.

Transform it into a genuinely replayable crypto-native game.

The goal is not to create a technically impressive empty simulation.

The goal is to create a game that people actually want to play repeatedly.

A player should:

1. Open DUCKLAB.
2. Immediately recognize the $QUACK Solana memecoin identity.
3. Enter an attractive dark 3D environment.
4. Control a real Microduck.
5. Kick a ball into a goal.
6. Push a cube into a target.
7. Use the robot's other physical abilities.
8. Complete a challenging obstacle course.
9. See their completion time.
10. Compare their personal best with the verified world record.
11. Try again to improve their time.
12. Share their achievement.

**No multiplayer. No GPU training. No paid movement marketplace. No fake physics. No fake leaderboard records.**

Preserve the authentic robot simulator and existing working code.

Implement these changes directly in the current repository.

Run the application, test the complete course, fix the problems, and report what has actually been verified.

**Do not stop after changing the homepage. The gameplay itself must be significantly improved.**