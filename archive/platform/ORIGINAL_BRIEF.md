# MASTER BUILD PROMPT — DUCKLAB

## Your role and mission

You are a senior full-stack engineer, robotics simulation engineer, WebGL developer, Solana smart contract engineer, security engineer, and product designer.

Build **DUCKLAB**, a production-oriented Web3 robotics playground where users can interact with an accurate digital twin of the real Pollen Robotics Microduck, program custom behaviors, develop new movement policies, and trade user-created movement packs using a Solana SPL token.

This must be a real, executable product, not a mockup, landing page, static prototype, or collection of disconnected components.

**Working brand:** DUCKLAB  
**Working token:** $QUACK  
**Blockchain:** Solana  
**Website language:** English  
**Target:** Desktop-first, fully responsive web application  
**Visual direction:** Premium, minimal, modern robotics laboratory

The product philosophy:

> Don't buy a robot to experiment with it. Open your browser, program a real digital twin, teach it something new, and share your creations with the world.

The platform must combine five genuinely functional systems:

1. An accurate Microduck physics simulator.
2. A programmable robotics studio.
3. An AI-assisted movement creation interface.
4. A Solana-powered movement marketplace.
5. A secure backend, user system, training infrastructure, and administration dashboard.

All systems must share the same user identity, robot simulation, database, and asset pipeline.

Do not implement fake blockchain purchases, decorative code editors, scripted animation pretending to be physics, hardcoded fake statistics, or buttons without working behavior.

---

# 1. FIRST: ANALYZE EXISTING TECHNOLOGY

Before implementing anything, investigate these sources:

- https://trymicroduck.com/
- https://github.com/pollen-robotics/microduck
- https://github.com/pollen-robotics/microduck_rl
- https://huggingface.co/spaces/pollen-robotics/microduck-simulator/tree/main
- https://huggingface.co/pollen-robotics/microduck-policies
- https://pollen-robotics.com/microduck/

Use the real upstream repositories and their current source files.

Do not rely only on screenshots, README summaries, or assumed APIs.

Study:

- Original robot geometry.
- STL meshes and mesh hierarchy.
- MJCF and XML robot definitions.
- Kinematic and joint structures.
- Joint limits, actuator configuration, and masses.
- Physics collision models.
- Original ONNX movement policies.
- Observation and action interfaces.
- MuJoCo simulation implementation.
- Rendering and transformation pipeline.
- Policy switching and robot recovery.
- Movement training and export process.
- Existing browser simulator architecture.

Record exact upstream commit hashes, downloaded asset hashes, dependency versions, and file provenance.

Create `docs/UPSTREAM_SOURCES.md` documenting what was reused, adapted, or newly implemented.

Reuse verified source code and assets when appropriate. Do not recreate complex robotics behavior from guesses.

Respect third-party attribution and document the commercial rights/authorization associated with the exact visual assets being included.

The project owner is responsible for providing any separately required commercial authorization for restricted assets.

## Existing simulator requirements

The existing official browser simulation demonstrates that Microduck can run using:

- MuJoCo compiled to WebAssembly.
- ONNX Runtime Web.
- Three.js rendering.
- Real reinforcement-learning policies.
- A 50 Hz policy control loop.

Preserve these capabilities while creating an entirely new, improved user-facing product.

The official simulator is a technical foundation, not a UI design template.

---

# 2. ABSOLUTE REQUIREMENT: ACCURATE 1:1 MICRODUCK

This is the highest-priority technical requirement.

The displayed robot must accurately represent the real Microduck.

Do not generate a generic cartoon duck.

Do not substitute an approximate model from a marketplace.

Do not construct the robot from primitive spheres and cylinders.

Do not implement walking using keyframe animations disguised as robotics.

Use the original robot geometry available in the authorized upstream assets.

## Geometry requirements

Import the real geometry preserving:

- Original proportions.
- Head shape.
- Beak geometry.
- Shell and body shape.
- Legs and feet.
- Motor housing geometry.
- Joint pivots.
- Hierarchical transformations.
- Coordinate orientation.
- Robot scale.
- Original recognizable color scheme.

Preserve original full-detail meshes as a reference. Generate optimized browser assets from those meshes without visually altering the robot.

Use GLB or another appropriate GPU-friendly delivery format for rendering, while retaining MJCF and original source meshes for validation.

If generating reduced-poly variants, compare them against the original and keep the default desktop visual model as faithful as possible.

Do not silently substitute missing meshes.

If any essential model files are missing, identify the exact missing files and expose a clear asset validation error.

## Physics requirements

Use the actual MuJoCo robot description as the source of truth.

Preserve, wherever available:

- Joint constraints.
- Inertial properties.
- Gravity.
- Actuator behavior.
- Torque and position limits.
- Collision geometry.
- Ground friction.
- Physical contact behavior.
- Robot recovery mechanics.
- Original trained policies.

Inspect the differences between `robot_walk.xml`, `robot_groundcontact.xml`, and `robot_allcollisions.xml`.

Choose the appropriate collision model per interaction mode and document the reasons. Do not substitute a simplified model merely because it is easier to render.

The official RL interface uses a 61-dimensional observation vector and 14 policy-controlled servo joints. Do not assume that the published robot motor count maps directly to the policy output size.

Derive all names, arrays, commands, limits, and model metadata from upstream sources.

The real robot's motion is the reference behavior, not an arbitrary animation style.

## Simulation architecture

Create distinct modules:

- `RobotAssetLoader`
- `PhysicsEngine`
- `RobotController`
- `PolicyInferenceEngine`
- `PolicyManager`
- `BehaviorScheduler`
- `JointStateBridge`
- `SimulationRecorder`
- `SimulationDiagnostics`

Use a fixed physics timestep.

Maintain an accurate 50 Hz policy update loop for compatible official policies.

Decouple physics stepping from visual rendering.

The simulation must continue consistently if display FPS fluctuates.

Use Web Workers where supported to keep simulation processing off the main UI thread.

Use transferable buffers or SharedArrayBuffer only where browser isolation requirements are satisfied.

Synchronize the rendered skeleton directly with MuJoCo joint states.

Support deterministic reset, fixed-seed test scenarios, pause, resume, single-step debugging, and recovery.

Implement an internal diagnostics overlay showing actual:

- Simulation FPS.
- Renderer FPS.
- Policy inference time.
- Physics step time.
- Loaded robot and policy version.
- Joint states.
- Contact state.
- Memory usage when available.

Never display invented performance values.

## Visual and physical validation

Implement automated validations for:

- Robot height and scale.
- Joint order and joint limits.
- Kinematic hierarchy.
- Mesh completeness.
- Pose transformations.
- Official standing pose.
- Walking behavior.
- Sitting and standing.
- Rolling.
- Recovery after falling.
- Collisions with objects.
- Known reference behavior.

Generate comparison screenshots of the imported model alongside authorized upstream reference renders.

Document any simulation-to-hardware differences.

Do not claim mathematically perfect real-world equivalence merely because the original assets are used.

---

# 3. BASE ROBOT ABILITIES

On first opening the playground, the user should be able to interact with the robot without connecting a wallet.

Load verified official movement policies.

Implement every compatible available base movement, including:

- Walking forward.
- Walking backward.
- Turning.
- Strafing where supported.
- Standing.
- Sitting.
- Recovering after falling.
- Rolling.
- Kicking.
- Interacting with compatible physical objects.
- Ground pick or grab behavior when supported.

Do not expose a movement button unless the corresponding action has a working implementation.

If an action is only supported by a particular policy or model version, reflect this in the UI.

Add:

- WASD keyboard control.
- Gamepad support.
- Touch joystick.
- Camera orbit.
- Zoom.
- Follow-camera mode.
- Reset button.
- Physics pause button.
- Movement speed controls within supported limits.
- Robot state indicator.

Include an interactive laboratory environment with:

- Realistic floor.
- Small physical ball.
- Moveable blocks.
- Ramps.
- Lightweight obstacles.
- Adjustable obstacle course.

Objects must have real physics interactions.

An object should move because the robot physically contacts it, not because a prewritten UI animation is triggered.

---

# 4. FRONTEND DESIGN — PREMIUM ROBOTICS PRODUCT

The interface must look like a serious and beautifully designed technology product.

Do not imitate the appearance of trymicroduck.com.

Keep its good idea of an immediately accessible robot playground, but build an entirely different visual experience.

## Design identity

Use:

- Warm off-white: `#F7F7F2`
- Graphite: `#181A1B`
- Neutral gray: `#858A8C`
- Soft yellow: `#F5D66F`
- Soft borders: `#E5E6E2`

Typography: Inter or Geist, with excellent readability.

Use tasteful monospaced typography for technical metadata.

Design principles:

- Minimal.
- Premium.
- Friendly but technical.
- Spacious.
- Confident typography.
- Smooth transitions.
- Clear hierarchy.
- Focus on the 3D robot.
- Few decorative elements.

Avoid:

- Neon cyberpunk.
- Excessive gradients.
- Generic AI-generated dashboard aesthetics.
- Glassmorphism everywhere.
- Crypto casino aesthetics.
- Random glowing particles.
- Emoji-heavy UI.
- Overloaded interfaces.

The visual experience must feel like an elegant robotics IDE mixed with a consumer-facing creative platform.

## Landing page

Navigation:

`DUCKLAB | Playground | Studio | Marketplace | Academy | Connect Wallet`

Hero:

**A real robot.  
An infinite playground.**

Subheading:

"Program, train, and experiment with Microduck directly in your browser. Create new behaviors and share them on Solana."

Primary CTA: `Enter Playground`

Secondary CTA: `Explore Movements`

Place a large interactive 3D Microduck directly in the hero.

The robot must be the centerpiece of the landing page.

The hero can preload a lightweight visual representation, while the complete physics engine loads when requested.

Build a premium loading experience showing real loading progress.

Below the hero:

- How it works.
- Featured community movements.
- Explore marketplace.
- How movement creation works.
- Create and publish.
- Community creations.
- Footer.

Do not fill the website with fake testimonials or placeholder users.

If community content does not exist, show a well-designed empty state and verified starter content.

---

# 5. PLAYGROUND EXPERIENCE

Route: `/playground`

This must be a full application, not a marketing section.

Layout:

**Top bar**

- DUCKLAB branding.
- Current robot.
- Simulation mode.
- Network indicator.
- Wallet connection.
- Settings.

**Center**

Large 3D simulation viewport taking most of the available screen.

**Left sidebar**

Collapsible sections:

- Basic controls.
- Movement library.
- Objects.
- Environments.
- Robot settings.

**Right sidebar**

Context-sensitive information:

- Current movement.
- Robot state.
- Installed movement packs.
- Selected object properties.
- Simulation diagnostics.

**Bottom toolbar**

- Play/pause.
- Reset.
- Camera.
- Record.
- Screenshot.
- Physics options.
- Open Studio.

Users must be able to collapse both sidebars and use the simulation in fullscreen.

On mobile, convert sidebars into accessible bottom sheets.

## Recording and sharing

Allow users to:

- Record simulation footage.
- Export compatible video.
- Save screenshots.
- Save a movement sequence.
- Generate a shareable result page.
- Share to X.

Prefer local browser recording when supported.

Provide a robust export fallback when direct MP4 encoding is unavailable.

Do not falsely label WebM as MP4.

Optional server-side transcoding must happen in a resource-constrained worker.

Videos may contain a subtle DUCKLAB watermark.

---

# 6. CODE STUDIO

Route: `/studio`

The user must be able to create, edit, test, save, and publish movements.

## Main layout

Left section:

Monaco code editor.

Right section:

Live 3D Microduck simulation.

Bottom section:

Console, execution results, timeline, errors, and diagnostics.

Include:

- Syntax highlighting.
- Intelligent autocomplete.
- API documentation.
- Error annotations.
- Script formatting.
- Run.
- Stop.
- Reset.
- Save draft.
- Version history.
- Publish movement.

## Movement scripting interface

Provide a simple JavaScript-like scripting syntax.

Example user-facing code:

    await duck.walk({ distance: 1.5 });
    await duck.turn({ degrees: 90 });
    await duck.sit();
    await duck.stand();
    await duck.kick({ side: "left" });

These are proposed DUCKLAB APIs and must be implemented as real, validated commands.

The underlying implementations must call actual movement controllers or compatible official policies.

They must not manipulate rendered meshes directly.

If a requested action is physically unavailable, report it clearly.

## Extremely important: secure execution

Do not run arbitrary user JavaScript using `eval`, `new Function`, or unrestricted execution.

Build a safe movement DSL.

Use an AST parser accepting only an explicitly allowlisted subset of syntax.

Compile scripts to a typed movement instruction representation.

Reject:

- Arbitrary imports.
- Network access.
- Filesystem access.
- DOM access.
- Reflection.
- Dynamic code evaluation.
- Unbounded loops.
- Unsupported functions.
- Excessive nesting.
- Oversized programs.

Execution must enforce:

- Maximum instruction count.
- Maximum duration.
- Maximum loop iterations.
- Maximum queued movements.
- Cancellation.
- Per-command timeouts.
- Robot-specific physical limits.

User scripts must not control Solana transactions or browser wallets.

Implement robust parse errors and human-readable diagnostics.

## Visual Movement Builder

Also create a node-based or timeline-based movement editor.

Users should be able to compose existing skills without writing code.

Support:

- Drag-and-drop movement blocks.
- Sequential movements.
- Timed movement steps.
- Conditional transitions based on permitted simulation state.
- Repetitions with hard limits.
- Named reusable sequences.
- Preview and editing.

The visual builder and scripting interface should compile to the same underlying movement representation.

---

# 7. TEACH THE DUCK NEW MOVEMENTS

Users must be able to extend the robot's capabilities beyond the default library.

This requires distinguishing two different creation methods.

## Method A: Skill composition

Users combine existing physical movements to create routines.

Examples:

- Walk in a circle.
- Turn and kick a ball.
- Sit, recover, and walk away.
- Navigate a simple obstacle course.
- Perform a timed movement routine.

These can run immediately in the browser.

The resulting movement pack contains a validated script, metadata, and the exact required policy versions.

## Method B: Actual new movement policy training

Users can teach new physically feasible behaviors that cannot be produced solely by combining existing movement commands.

Examples:

- A different walking gait.
- A custom balancing behavior.
- A new recovery strategy.
- A specialized obstacle traversal policy.
- A new coordinated movement within the robot's mechanical limits.

Do not fake trained behaviors by attaching visual animation clips.

Use the actual Microduck RL environment, MuJoCo training stack, and a compatible reinforcement-learning workflow.

Create a separate training pipeline with:

- Configurable approved training tasks.
- Training parameters.
- Supported reward templates.
- Experiment configuration.
- Training progress.
- Checkpoint management.
- Evaluation.
- Export to ONNX.
- Model validation.
- Deployment to the simulator.

Do not expose unrestricted Python execution in public training jobs.

Prefer vetted reward components and configuration-based training tasks.

Use isolated GPU workers for model training.

Training workers must be provisioned separately from the application API.

Use a queue-based architecture with:

- Explicit job status.
- Job budgets.
- Per-user quotas.
- Maximum training duration.
- Cancellation.
- Failed-job handling.
- Resource utilization accounting.

Do not start expensive GPU training automatically for every free user.

The frontend must clearly differentiate:

- Free local scripting.
- Free movement composition.
- Pretrained movements.
- Actual computational training jobs.

If an external GPU provider is not configured, the training interface must display an honest unavailable/configuration-required state.

Implement the actual training integration and provisioning documentation instead of pretending that a model has been trained.

## ONNX compatibility

For newly generated policies:

- Match the upstream observation schema.
- Match expected output dimensions.
- Validate model inputs and outputs.
- Reject NaN and infinity.
- Check joint target ranges.
- Enforce inference-time limits.
- Test stability in multiple scenarios.
- Track the exact upstream model version.

Use the official exporter as the reference implementation.

Store evaluation results and compatibility metadata.

New policy packs must pass validation before public marketplace publication.

---

# 8. AI MOVEMENT ASSISTANT

Integrate a real AI assistant into Code Studio.

The user can type:

"Make my duck walk around the ball, turn around, then kick it."

The assistant should:

1. Understand the request.
2. Identify available robot skills.
3. Generate a valid movement script.
4. Check it against the DSL schema.
5. Explain unavailable actions when necessary.
6. Offer the generated script for user review.
7. Allow the user to run it in the simulator.

The AI is not permitted to directly bypass scripting restrictions.

Use a server-side AI adapter compatible with an OpenAI API key.

Do not hardcode API keys in frontend code.

AI responses must use structured output where supported.

Validate every generated movement against the same compiler used for manually written code.

Prevent prompt injection from marketplace descriptions or third-party movement metadata.

Apply:

- Request quotas.
- Token budgets.
- Rate limits.
- Usage accounting.
- Error handling.
- Provider timeout handling.
- Abuse prevention.

Include optional streaming responses.

Never present a generated movement as physically valid until it passes simulation validation.

The user must retain final control over running AI-generated behavior.

---

# 9. SOLANA WALLET INTEGRATION

Crypto functionality is a native part of the product from the beginning.

Use Solana mainnet for production and devnet for development.

Support modern Wallet Standard integrations where possible.

Support common wallets such as:

- Phantom.
- Solflare.
- Backpack.
- Other compatible Solana wallets.

Users must be able to:

- Connect a wallet.
- Authenticate by signing a message.
- View their token balance.
- Browse owned movement packs.
- Purchase new movement packs.
- Publish their own work.
- Receive sales revenue.
- Review transaction history.
- Disconnect safely.

## Authentication

Implement Sign-In With Solana.

Generate a server-side challenge including:

- Domain.
- Nonce.
- Wallet address.
- Issued-at timestamp.
- Expiration.
- Relevant sign-in statement.

Verify signatures on the server.

Enforce single-use nonces and replay protection.

Use secure session management.

Never request seed phrases or private keys.

Never store user private keys.

A wallet connection alone must not be treated as authenticated authorization.

---

# 10. $QUACK TOKEN INTEGRATION

Use a configurable Solana SPL token mint.

The token name and ticker are working identifiers and must remain configurable.

Environment configuration:

- `SOLANA_CLUSTER`
- `SOLANA_RPC_URL`
- `SOLANA_WS_URL`
- `QUACK_TOKEN_MINT`
- `QUACK_TOKEN_PROGRAM`
- `MARKETPLACE_PROGRAM_ID`
- `MARKETPLACE_TREASURY_ADDRESS`

Read token decimals and mint metadata from the blockchain.

Never assume decimals without validation.

Use integer base units for all payment calculations.

Do not use floating-point arithmetic for onchain prices or balances.

Do not generate a fake production token mint.

A local or devnet development token may be created by an explicit documented setup script.

Mainnet purchases must remain unavailable until real contract addresses and token configuration are supplied.

## Core economy

The user can:

- Play without holding tokens.
- Program basic movements for free.
- Save drafts for free.
- Buy premium community movement packs with $QUACK.
- Sell original movement packs for $QUACK.
- Tip creators.
- Use purchased movements in the studio.

Do not require users to buy tokens simply to open the playground.

All purchase confirmations must display:

- Exact token amount.
- Token mint identity.
- Recipient information.
- Estimated Solana transaction fee.
- Marketplace commission.
- Wallet confirmation status.

No hidden wallet transactions.

---

# 11. ONCHAIN MARKETPLACE SMART CONTRACT

Create a real marketplace implementation using Anchor and Rust.

Do not use fake purchase buttons or frontend-only ownership flags.

Marketplace parameters:

- Payment token: $QUACK.
- Creator payout: 90%.
- Platform commission: 10%.
- Fees configurable only through authorized governance/admin procedures and disclosed to users.

Use secure SPL token transfers.

Use checked token transfer instructions.

Implement transaction atomicity.

## Marketplace program responsibilities

Implement:

- Marketplace configuration.
- Authorized publisher identity.
- Immutable listing versions.
- Product manifest hash.
- Seller wallet.
- Price.
- Token mint validation.
- Platform fee rules.
- Purchase receipts.
- Purchase uniqueness.
- Delisting.
- Relevant onchain purchase events.

Use Program Derived Addresses where appropriate.

Ensure seller and platform token destinations are validated.

Do not trust arbitrary recipient accounts supplied by frontend clients.

The program must prevent:

- Repeated unintended purchases.
- Payment mint substitution.
- Incorrect payout recipients.
- Unauthorized price changes.
- Forged purchase receipts.
- Integer overflow.
- Unauthorized listing updates.
- Malicious account substitution.

Marketplace publication can require a platform validation signature after content review.

This prevents unvalidated binaries or scripts from being immediately sold.

Once published, a purchased product version must remain identifiable by its immutable manifest hash.

A seller may delist new sales, but existing buyers must retain their purchased entitlements.

## Payment lifecycle

Implement the following flow:

1. User opens a movement pack.
2. Backend returns a verified listing and immutable price.
3. User connects and authenticates their wallet.
4. UI prepares the transaction from verified program accounts.
5. User reviews and signs.
6. Solana processes the atomic payment.
7. Backend verifies program ID, expected receipt, token mint, buyer, seller, amount, and finalized transaction status.
8. Backend grants or reconciles access to the exact purchased version.
9. User can install the purchased movement.

Never grant access based solely on a frontend success callback.

Use an idempotent backend reconciliation process.

If onchain payment succeeds but the API or database fails, recover access automatically from the onchain receipt.

Handle chain reorganization/finality and transaction expiry appropriately.

Do not create duplicate entitlements.

Implement retries, reconciliation workers, and an admin repair workflow based on genuine onchain data.

Cryptocurrency payments are not automatically reversible. Do not promise an automatic refund capability unless an explicitly funded refund mechanism exists.

---

# 12. MOVEMENT MARKETPLACE

Route: `/marketplace`

Build a polished digital storefront.

## Marketplace listing

Every listing must include:

- Movement name.
- Creator.
- Preview.
- Description.
- Category.
- Supported robot version.
- Movement type.
- Pack version.
- Price in $QUACK.
- Purchase count.
- Rating when enough verified ratings exist.
- Update history.
- Safety validation status.

Categories:

- Walking.
- Balance.
- Tricks.
- Recovery.
- Navigation.
- Interaction.
- Dance.
- Experimental.

All data must come from the database and verified purchase records.

Do not fabricate sales activity.

## Listing page

Route: `/marketplace/[slug]`

Include:

- Real movement preview.
- Creator profile.
- Description.
- Requirements.
- Compatibility.
- Version history.
- Price.
- Buy button.
- Reviews from verified buyers.
- Report button.
- Creator's other packs.

Public previews must not leak paid full-source behavior.

Use a genuinely limited demonstration or previously generated preview video.

Do not deliver the complete protected pack to unauthenticated users.

After purchase, users can access the movement files needed for local execution.

Recognize that downloadable scripts and neural models cannot be perfectly protected from copying. Build proper access control and licensing, but do not claim impossible DRM guarantees.

## Pack creation

Creators need a publishing workflow:

1. Choose a saved movement.
2. Add name and description.
3. Add preview video.
4. Select category.
5. Set price.
6. Confirm authorship and publication rights.
7. Run compatibility tests.
8. Submit for automated validation.
9. Submit for moderation if required.
10. Publish an immutable pack version.
11. Create the onchain listing.
12. Share the listing URL.

Creators must be able to:

- View sales.
- Track revenue.
- Publish new versions.
- Respond to reviews.
- Delist products.
- See purchase history.

Existing customers must retain access to purchased versions.

Do not automatically charge existing customers for updates.

---

# 13. USER LIBRARY AND PROFILES

Routes:

- `/library`
- `/profile/[wallet]`
- `/dashboard`

Users have:

- Display name.
- Wallet address.
- Avatar.
- Public profile.
- Created movements.
- Purchased movements.
- Saved drafts.
- Favorite movements.
- Sales history.
- Purchase history.
- Public creator statistics.

The personal library must separate:

- Built-in robot abilities.
- User-created movements.
- Purchased packs.
- Saved experiments.
- Trained policies.

Allow an authenticated user to install an owned movement with one click.

Enforce compatibility before activating a movement pack.

Add version rollback where compatible.

Use PostgreSQL to store user profiles and access metadata, with actual blockchain verification remaining authoritative for onchain purchases.

---

# 14. APPLICATION ARCHITECTURE

Use a maintainable monorepo.

Recommended technologies:

**Frontend**
- Next.js with TypeScript.
- React.
- Tailwind CSS.
- shadcn/ui where useful.
- Zustand.
- Three.js.
- React Three Fiber when compatible with the physics rendering architecture.
- Monaco Editor.
- TanStack Query.

**Simulation**
- MuJoCo WebAssembly.
- ONNX Runtime Web.
- Original Microduck MJCF.
- Original compatible policies.
- Web Workers.

**Backend**
- Node.js.
- Fastify with TypeScript.
- Zod input validation.
- Prisma or an equivalent strongly typed PostgreSQL access layer.
- PostgreSQL.
- Redis.
- BullMQ.
- S3-compatible object storage.

**Blockchain**
- Solana.
- Wallet Standard.
- Current supported Solana TypeScript SDK.
- Anchor.
- Rust.
- SPL Token Program.

**Training**
- Python.
- Official Microduck RL tooling.
- MuJoCo/mjlab.
- PyTorch where needed.
- GPU worker containers.
- ONNX export pipeline.

**Infrastructure**
- Docker.
- Docker Compose.
- Nginx or Caddy.
- S3-compatible object storage.
- CDN.
- CI/CD.
- OpenTelemetry-compatible monitoring.

Verify current stable dependency versions before implementation.

Avoid deprecated wallet APIs and abandoned packages.

## Monorepo structure

Use a clean architecture similar to:

    apps/
      web/
      api/
      worker/
      training-worker/
    packages/
      ui/
      shared/
      database/
      simulation-core/
      movement-dsl/
      solana/
      validation/
    programs/
      marketplace/
    assets/
      microduck/
    infra/
    scripts/
    tests/
    docs/

Keep frontend, physics engine, blockchain logic, and backend services independently testable.

Avoid a giant monolithic React component.

Generate typed contracts between services.

---

# 15. DATABASE DESIGN

Create real database migrations.

Required domain models:

- User.
- WalletIdentity.
- AuthenticationSession.
- CreatorProfile.
- Movement.
- MovementVersion.
- MovementPack.
- MarketplaceListing.
- Purchase.
- OwnershipEntitlement.
- OnchainReceipt.
- Review.
- Favorite.
- SimulationProject.
- SavedScript.
- TrainingJob.
- TrainingArtifact.
- ValidationResult.
- MediaAsset.
- ContentReport.
- ModerationAction.
- AdminAuditLog.
- SystemConfiguration.

Add:

- Proper foreign keys.
- Unique constraints.
- Useful indexes.
- Transactional writes.
- Cursor pagination.
- Soft deletion only where appropriate.
- Immutable purchase records.
- Explicit payment state machines.

Prevent double granting of entitlements with unique database constraints.

Use numeric amounts stored as integer base units or exact database numeric types.

Do not use JavaScript floating-point arithmetic for financial values.

---

# 16. STORAGE AND ASSET SECURITY

Store public and private assets separately.

Public assets:

- Approved preview videos.
- Public thumbnails.
- Free movement packs.
- Public product metadata.

Private assets:

- Purchased paid movement files.
- Private drafts.
- Training checkpoints.
- Unpublished ONNX models.
- Internal validation outputs.

Use S3-compatible object storage such as Cloudflare R2 or MinIO.

Protect private assets with authenticated, short-lived, entitlement-checked access.

Use expiring signed URLs where appropriate.

Never rely on hidden frontend URLs as authorization.

Apply file size limits and strict content-type validation.

Validate actual file signatures instead of trusting extensions.

Avoid untrusted SVG or HTML execution.

Sanitize displayed user-generated content.

Use content hashing and immutable versioned storage paths.

---

# 17. SECURITY REQUIREMENTS

Treat the platform as security-sensitive because it combines:

- User-generated programs.
- AI-generated programs.
- Uploaded neural-network models.
- Cryptocurrency payments.
- Public user accounts.
- Marketplace transactions.

Implement security from the beginning.

## Application security

- Validate all API inputs.
- Enforce authorization on every protected endpoint.
- Use secure sessions.
- Protect against CSRF where applicable.
- Restrict CORS.
- Use security headers and a carefully configured CSP.
- Escape user-generated content.
- Prevent stored XSS.
- Prevent IDOR.
- Prevent mass assignment.
- Prevent arbitrary file access.
- Protect against path traversal.
- Never expose server-side environment secrets.
- Use least-privilege database accounts.
- Use parameterized queries.

Do not log secrets, authentication tokens, private user content, or full wallet signature payloads unnecessarily.

## Movement execution security

Never execute unrestricted code submitted by users.

All movement scripts must compile to validated instructions.

Use a strictly defined instruction runtime.

Implement resource limits, timeouts, and cancellation.

Keep robot command execution isolated from application authentication and wallet operations.

## Untrusted ONNX models

Uploaded models must not immediately run in other users' browsers.

Implement:

- File structure validation.
- Model format validation.
- Operator allowlisting.
- Tensor dimension validation.
- External data reference rejection or tightly constrained handling.
- Model size limits.
- Computational complexity limits.
- Memory limits.
- Numerical output checks.
- Offline inference tests.
- Simulation safety tests.

Run validation and inference checks in isolated workers with restricted network access and resource limits.

Only approved artifacts may be published to the marketplace.

## Wallet security

- No wallet custody.
- No private-key storage.
- No hidden approvals.
- No arbitrary wallet transaction requests.
- Validate cluster and token mint.
- Validate program IDs and recipient accounts.
- Display all purchase details before signature.
- Use finality-aware payment reconciliation.
- Never treat transaction submission as settlement.

## Abuse prevention

Implement rate limiting for:

- Authentication.
- AI generation.
- Uploads.
- Pack publication.
- Training jobs.
- Search.
- Reviews.
- Reports.

Protect expensive endpoints from resource exhaustion.

Use shared Redis-backed limits for multiple API instances.

Include account-level quotas and IP-level limits with sensible handling of shared networks.

Add moderation tools and suspicious activity logs.

---

# 18. SCALABILITY AND PERFORMANCE

Design the application so normal 3D interaction does not require continuous simulation requests to the backend.

## Critical architecture decision

**Run standard physics simulation and compatible ONNX inference locally in the user's browser.**

Do not stream every robot frame from a central server.

Do not create one backend physics process per visitor.

This would be unnecessarily expensive and would not scale efficiently.

The server is primarily responsible for:

- Authentication.
- User data.
- Marketplace operations.
- Purchases.
- Content storage.
- AI requests.
- Training-job orchestration.
- Publishing and validation.
- Moderation.

GPU-based model training runs separately.

## Performance requirements

Target:

- Smooth rendering on supported desktop hardware.
- Fixed 50 Hz compatible policy execution.
- 60 FPS rendering target on capable desktops.
- Reduced rendering settings for weaker devices.
- 30 FPS rendering fallback on mobile when necessary.
- Responsive interactions while loading assets.
- Fast cached marketplace browsing.
- Predictable API latency.
- Controlled GPU and AI spending.

These are engineering targets, not guaranteed results on every device.

## Optimization

Implement:

- Lazy loading.
- Asset compression.
- CDN distribution.
- Immutable content hashes.
- Browser asset caching.
- Web Worker simulation.
- Adaptive rendering resolution.
- Conservative shadow quality.
- Efficient scene updates.
- Frustum culling.
- Memory cleanup.
- Asset unloading.
- WebGL context recovery.
- Pausing simulation when appropriate.
- Reduced quality on mobile.

Do not download every ONNX policy on initial landing-page load.

Load only assets needed for the currently selected mode.

Use CDN caching for immutable robot geometry and policy weights.

## API scalability

Build the API so that multiple instances can run behind a load balancer.

Use stateless application servers.

Keep shared sessions, rate limits, and job coordination in external services.

Use:

- PostgreSQL connection pooling.
- Database indexes.
- Redis caching.
- Bounded queues.
- Exponential backoff.
- Idempotent jobs.
- Request timeouts.
- Health and readiness endpoints.

Avoid synchronous expensive computation inside API requests.

## Load testing

Provide reproducible k6 or equivalent load tests.

Test scenarios for:

- 1,000 concurrent browsing sessions.
- 100 concurrent authenticated marketplace users.
- Bursts of wallet authentication attempts.
- Simultaneous purchase reconciliation events.
- Large asset downloads through the CDN.
- Training-job queue saturation.

Document measured results and infrastructure requirements.

Do not report invented benchmark results.

---

# 19. TRAINING COST CONTROLS

GPU training can be expensive.

Treat training as a separate billable or quota-controlled workload.

Implement:

- Per-user training quotas.
- Concurrent-job limits.
- Cost estimation before starting.
- Maximum GPU runtime.
- Training-job cancellation.
- Admin configuration of limits.
- Daily and monthly global budgets.
- Job status tracking.
- Failed job cleanup.
- Automatic shutdown of idle workers.
- Protection against recursive job creation.

Do not allow anonymous users to create unlimited GPU jobs.

Do not make the base playground depend on GPU training availability.

Support a provider abstraction for external GPU infrastructure.

Do not hardcode any GPU cloud API keys.

---

# 20. ADMIN DASHBOARD

Route: `/admin`

Create an actual protected administrator interface.

Admin access must be explicitly allowlisted and authenticated, with server-side checks.

Never grant admin access based on frontend state alone.

Modules:

**Overview**
- Registered users.
- Active users.
- Real transaction counts.
- Marketplace revenue.
- Published movements.
- Training jobs.
- System health.

**Users**
- Search users.
- Inspect account status.
- Restrict abuse.
- View relevant moderation history.

**Marketplace**
- Review submissions.
- Approve or reject packs.
- Delist dangerous or infringing content.
- Inspect sales.
- Review payment discrepancies.

**Training**
- Monitor GPU jobs.
- Cancel jobs.
- Configure quotas.
- Inspect resource usage.

**Finance**
- Platform fee reporting.
- Verified onchain transactions.
- Treasury balances.
- Reconciliation status.

**System**
- Application settings.
- Supported robot model versions.
- Feature flags.
- Queue health.
- Worker health.
- Error logs.

Record all administrative actions in an audit log.

Do not expose private secrets in the dashboard.

Include safeguards for irreversible blockchain-related operations.

---

# 21. USER EXPERIENCE DETAILS

The application should feel polished and trustworthy.

Include:

- Real loading progress.
- Friendly error messages.
- Toast notifications.
- Skeleton loading states.
- Useful empty states.
- Confirmation dialogs.
- Transaction progress.
- Failed transaction recovery.
- Wallet rejection handling.
- Network outage handling.
- Clear pricing.
- Responsive design.
- Accessible keyboard navigation.
- Reduced-motion support.

No dead-end buttons.

No invisible controls.

No placeholder pages presenting themselves as completed features.

No fake AI responses.

No simulated purchase success in production.

---

# 22. ROUTES

Implement the following application routes:

- `/`
- `/playground`
- `/studio`
- `/marketplace`
- `/marketplace/[slug]`
- `/library`
- `/dashboard`
- `/profile/[wallet]`
- `/academy`
- `/settings`
- `/admin`
- `/terms`
- `/privacy`
- `/licenses`

The Academy should teach users how to control the robot, create scripts, understand the physics, and publish movements.

Include real documentation and examples.

---

# 23. API DESIGN

Create versioned APIs with documented schemas.

Example API groups:

Authentication:
- Create challenge.
- Verify signed challenge.
- Read current session.
- Sign out.

Users:
- Read profile.
- Update profile.
- Read creator statistics.

Movements:
- Create draft.
- Update draft.
- Save versions.
- Validate movement.
- Read movement.
- Execute local-compatible movement.
- Publish movement.

Marketplace:
- List products.
- Read product.
- Create listing.
- Read quote.
- Build or validate purchase transaction.
- Submit transaction reference.
- Read purchase status.
- Read owned packs.

AI:
- Generate movement script.
- Explain script.
- Validate generated script.

Training:
- Create job.
- Read status.
- Cancel job.
- Read artifacts.
- Submit artifact for validation.

Administration:
- Review submissions.
- Moderate content.
- Read metrics.
- Inspect transaction reconciliation.
- Manage training quotas.

Generate OpenAPI documentation.

Use shared TypeScript types where appropriate.

Never make the client authoritative for prices, ownership, or permissions.

---

# 24. AUTOMATED TESTING

Testing is mandatory.

## Unit tests

Cover:

- Movement DSL parsing.
- Movement validation.
- Command timing and cancellation.
- Price calculations.
- Fee calculations.
- Integer token arithmetic.
- Wallet challenge verification.
- Ownership checks.
- Pack version handling.

## Integration tests

Cover:

- Authentication.
- Pack publication.
- Purchase workflow.
- Payment verification.
- Entitlement creation.
- Transaction reconciliation.
- Private asset delivery.
- Training job lifecycle.

## Blockchain tests

Use local Solana validator or appropriate Anchor testing tools.

Test:

- Valid purchases.
- Wrong token mint.
- Wrong buyer.
- Wrong seller token account.
- Incorrect price.
- Duplicate receipt.
- Unauthorized listing modification.
- Delisted products.
- Integer edge cases.
- Fee rounding.
- Uninitialized associated token accounts where supported.
- Replay attempts.

## Browser tests

Use Playwright.

Cover:

- Homepage loads.
- Simulator initializes.
- Real Microduck geometry renders.
- Robot walks.
- Robot falls and recovers.
- Script runs.
- Script errors are handled safely.
- Script saves.
- Wallet connects in supported test environment.
- Marketplace loads.
- Purchase completes on devnet/local validator.
- Purchased movement installs.
- Protected content cannot be accessed by an unauthorized wallet.

Include screenshots for desktop and mobile layout validation.

---

# 25. DEPLOYMENT AND DEVOPS

Create a full local development environment.

Include:

- `.env.example`
- `docker-compose.yml`
- Database migrations.
- Database seed scripts.
- Development startup scripts.
- Production build scripts.
- Training worker setup.
- Solana local validator instructions.
- Devnet deployment process.
- Mainnet deployment checklist.

Support a deployment architecture such as:

- Vercel or container-hosted Next.js frontend.
- Container-hosted Fastify API.
- Managed PostgreSQL.
- Managed Redis.
- Cloudflare R2 or equivalent.
- Cloudflare CDN and protection.
- Dedicated background workers.
- Separate on-demand GPU workers.
- Reliable Solana RPC provider.

Do not assume Vercel serverless functions are suitable for persistent GPU training or long-running physics jobs.

Provide an alternative fully containerized VPS deployment guide.

## Monitoring

Implement:

- Structured logging.
- Error tracking.
- Request metrics.
- Queue metrics.
- Database health.
- RPC endpoint health.
- Payment reconciliation monitoring.
- Training cost monitoring.
- Alerting configuration.

Provide operational documentation for backups, recovery, security incidents, and failed transaction reconciliation.

---

# 26. CONFIGURATION AND DEPLOYMENT HONESTY

Some real external resources cannot be fabricated by a coding agent.

Examples:

- Production Solana token mint.
- Wallet-funded treasury.
- Mainnet program deployment authority.
- Commercial authorization for restricted model assets.
- AI provider credentials.
- GPU service credentials.
- Cloud deployment secrets.

Implement complete integrations and provide precise setup instructions.

Do not insert fake production keys.

Do not claim mainnet is live until the contract is really deployed and configured.

Use explicit local/devnet configuration to test end-to-end functionality.

For production, fail closed when essential financial configuration is missing.

The result must be an executable, testable product rather than a collection of placeholder integrations.

---

# 27. IMPLEMENTATION ORDER

Implement in the following order.

## Stage 1: Foundation

Create the monorepo, dependency setup, database, shared packages, development infrastructure, and design system.

## Stage 2: Authentic robot simulator

Import and validate the actual robot model.

Implement MuJoCo, ONNX, input controls, collision handling, camera, and robot state.

This is the most important stage.

Do not proceed with an unrelated marketing-heavy frontend while the core simulator is fake or broken.

## Stage 3: Studio

Create the Monaco editor, secure scripting DSL, movement scheduler, timeline builder, local execution, saving, and version history.

## Stage 4: Identity and marketplace

Implement real wallets, authentication, database identity, marketplace contracts, devnet purchases, purchase verification, entitlements, and creator workflows.

## Stage 5: AI

Implement real AI-assisted script creation with strict validation.

## Stage 6: Training

Integrate the official Microduck RL training pipeline, separate GPU workers, model export, compatibility tests, resource limits, and publication review.

## Stage 7: Administration

Build the actual admin dashboard, finance monitoring, moderation, and training controls.

## Stage 8: Production hardening

Implement load tests, security tests, observability, failure recovery, responsive polish, and deployment documentation.

Stages are implementation milestones, not permission to leave earlier components permanently unfinished.

---

# 28. DEFINITION OF DONE

The project is complete only when the following scenarios work.

**Scenario A — Free visitor**

A user visits the website and opens the Playground without a wallet.

The actual Microduck model loads.

The user can control it.

The robot physically walks and interacts with objects.

The simulation can be paused and reset.

**Scenario B — Coding**

A user opens Studio, writes a valid movement script, and runs it.

The robot performs the movement through the simulator.

Invalid code produces a meaningful error.

The user can save the script.

**Scenario C — Creator**

A wallet-authenticated user creates a movement pack.

The system validates it.

The creator publishes it.

The product appears in the marketplace.

**Scenario D — Buyer**

A second user connects a wallet on devnet.

The user buys the movement pack with the configured test SPL token.

The actual blockchain transaction succeeds.

The server verifies the purchase.

The buyer receives access.

The buyer installs and runs the pack.

**Scenario E — Security**

A user who has not purchased a premium pack cannot retrieve its protected full files through direct API requests.

A forged purchase response does not grant ownership.

A malicious script cannot access browser wallets, network resources, or the filesystem.

**Scenario F — Custom policy**

A valid compatible custom ONNX policy can be validated, loaded, and executed safely.

An invalid model is rejected.

A GPU training job, when infrastructure is configured, can run and produce a real exportable artifact.

**Scenario G — Operations**

An administrator can inspect users, marketplace activity, transaction issues, and training jobs.

Health checks work.

Error logs are meaningful.

The application can be restarted without losing transactional integrity.

---

# 29. REQUIRED DOCUMENTATION

Generate:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/SETUP.md`
- `docs/DEPLOYMENT.md`
- `docs/SECURITY.md`
- `docs/UPSTREAM_SOURCES.md`
- `docs/SIMULATION_ACCURACY.md`
- `docs/MARKETPLACE.md`
- `docs/SMART_CONTRACT.md`
- `docs/TRAINING.md`
- `docs/TESTING.md`
- `docs/OPERATIONS.md`

Documentation must match the implemented code.

---

# 30. FINAL EXECUTION INSTRUCTIONS

You are not being asked to merely propose an architecture.

**You are being asked to implement the application.**

Work directly in the repository.

Begin by inspecting existing files and the upstream projects.

Create a development plan in the repository, then execute it.

Make real code changes.

Run commands.

Install dependencies.

Fetch permitted source assets.

Build the application.

Fix compile errors.

Run tests.

Verify major user flows.

Continue through the implementation stages instead of stopping after scaffolding.

Prioritize technical correctness over decorative complexity.

If a subsystem is blocked by genuinely unavailable credentials or infrastructure, implement the real integration, test the available parts, document the exact blocker, and continue working on the rest of the application.

Do not silently replace unfinished functionality with a mock implementation.

Do not claim functionality works without executing the corresponding tests.

Do not claim an exact simulation match without documented verification.

Do not deploy contracts to mainnet or spend real funds without explicit authorization.

At the end provide:

1. The implemented repository structure.
2. Running instructions.
3. Successfully executed tests.
4. Actual implementation status of each subsystem.
5. Exact external configuration still required.
6. Known issues and limitations.
7. Production deployment instructions.

**Build DUCKLAB as a genuine robotics programming platform and Solana marketplace, not as a superficial memecoin website.**

The single most important thing is this:

**The duck must be real in its geometry, physically simulated in its behavior, freely programmable by users, and genuinely connected to a functioning cryptocurrency marketplace.**