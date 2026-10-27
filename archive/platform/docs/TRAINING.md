# Actual policy training and validation

DUCKLAB keeps local movement composition separate from GPU training. Scripting and the visual builder compile to the same bounded instruction representation and run free in the browser. They do not train a neural network. GPU jobs run in a separate BullMQ worker, never in the frontend or API process.

## Implemented integration

The worker uses Pollen Robotics `microduck_rl` commit `1e79c29c97d8b38aee9eefde77a545860ba7658e`. The task IDs, train entrypoint and exporter flags were read from that exact source revision, including `train_cli.py`, `tasks/__init__.py`, the five approved task configurations, `scripts/export.py`, `pyproject.toml` and README. This revision requires Python 3.12, `mjlab==1.3.0`, `warp-lang==1.12.0` and a CUDA GPU. The full dependency graph comes from its `uv.lock`; do not replace it with guessed dependency versions.

`packages/shared/training.ts` accepts only these upstream reward templates:

| API task | Upstream registry ID | Behavior |
| --- | --- | --- |
| `walk` | `Mjlab-Velocity-Flat-MicroDuck` | Velocity tracking |
| `recovery` | `Mjlab-StandUp-Flat-MicroDuck` | Stand up after a fall |
| `sitstand` | `Mjlab-SitStand-Flat-MicroDuck` | Commanded sit and stand |
| `groundPick` | `Mjlab-GroundPick-Flat-MicroDuck` | Phase-driven ground pick |
| `kick` | `Mjlab-BallKick-Flat-MicroDuck` | Right-foot ball kick |

Public requests cannot supply Python, module names, shell commands, arbitrary flags, custom rewards, checkpoint paths or ONNX output locations. Iterations are bounded to 100–4,000, parallel environments to powers of two from 128–4,096, and wall time to 60–7,200 seconds. The API permits one active job per user and atomically reserves daily budgets in PostgreSQL. The default user GPU budget is zero. An administrator must explicitly allocate it. There is no automatic GPU rental or funded provider integration.

`apps/training-worker/src/worker.ts` consumes `ducklab-training` with concurrency one per worker. It verifies the checkout revision and CUDA availability before taking jobs. A PostgreSQL row claim prevents replaying an already running job. The worker launches the audited `uv run train` entrypoint using an argument array with `shell:false` in a private job directory, records actual reported PPO iterations, and imposes a process-group deadline. Cancellation uses the Redis key `ducklab:training:cancel:<UUID>` and terminates the child process group. Queue status, completion/failure, allocated GPU seconds, artifacts and offline validation reports persist in PostgreSQL.

On successful training the worker selects a real checkpoint generated in that job's `logs/rsl_rl/<experiment>` directory, then calls the official `scripts/export.py` with `--checkpoint-file` and `--onnx-file`. The exporter embeds observation normalization in the ONNX graph. Do not manually convert a PyTorch state dictionary or omit that normalizer. An actual missing checkpoint or failed export is a failed job, never a synthetic success.

Artifacts are private: each UUID directory contains the approved configuration, genuine upstream checkpoints, exported `policy.onnx`, validation report and an immutable content hash. When private S3/R2 storage is configured, the validated model is uploaded under its immutable user/job/content-hash key and the private storage key is persisted. Failed jobs keep a bounded private log. The worker does not upload a model to the public marketplace. Both successful exports and externally supplied models still need MuJoCo scenario evaluation and moderation before publication.

## Provisioning an isolated GPU worker

Use a dedicated Linux CUDA container/VM under a non-root user. Mount only the audited checkout, private training artifact storage and the application worker source. Do not mount application secrets, Docker sockets, cloud metadata credentials or user data. Use supervisor/container limits: one GPU, bounded CPU cores, at least the GPU memory required by the chosen environment count, a finite memory limit, PID limit, and a finite private disk quota. Keep training credentials and network access separate from the API. This repository does not provision a paid cloud GPU automatically.

Install Node 22+, npm dependencies (`npm ci` in this repository), Git, CUDA drivers, Python 3.12 support and `uv`. Set:

```sh
export MICRODUCK_RL_PATH=/opt/ducklab/microduck_rl
export TRAINING_ARTIFACT_ROOT=/var/lib/ducklab/private-training
sh apps/training-worker/provision.sh
```

The explicit provisioning script fetches the pinned checkout, uses its frozen lock, checks `torch.cuda.is_available()` and prints the real task registry. It starts no job. A different existing checkout is rejected; the script does not reset it. Review upstream model rights and the attached licenses before commercial use.

Provide these server-side variables to the worker using your secret manager:

```dotenv
TRAINING_ENABLED=true
MICRODUCK_RL_PATH=/opt/ducklab/microduck_rl
TRAINING_ARTIFACT_ROOT=/var/lib/ducklab/private-training
DATABASE_URL=postgresql://<restricted-worker-role>@<database>/ducklab
REDIS_URL=redis://<private-queue>:6379
CUDA_VISIBLE_DEVICES=0
```

Start the queue consumer from this repository:

```sh
node --import tsx apps/training-worker/src/worker.ts
```

Run the API background worker separately to pump durable queued jobs to Redis. Through an authenticated admin session, allocate a budget with `POST /api/v1/admin/training/quotas` and `{ "userId": "<UUID>", "maxSecondsPerDay": 3600 }`. Only then submit a job through `POST /api/v1/training/jobs` with e.g. `{ "task": "walk", "iterations": 100, "numEnvs": 128, "maxDurationSeconds": 3600 }`. Enqueuing is an explicit request that can consume the operator's configured GPU resources.

`GET /api/v1/training/jobs` returns the caller's actual database job states; `POST /api/v1/training/jobs/:id/cancel` requests cancellation. The artifact endpoint exposes content hashes and IDs, not private filesystem paths. Authenticated owner downloads use 60-second signed private object URLs when storage is configured. A local fallback requires an explicitly configured private artifact root and verifies the file content hash. Configure `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PRIVATE_BUCKET` and, when needed, `S3_REGION`/`S3_FORCE_PATH_STYLE` on the worker/API. These integrations have not been exercised against a live object store in this session.

If a worker is killed without cleanup, its database job stays running. Inspect the host and child processes, ensure the training process has stopped, then resolve the job and billing record operationally. Do not automatically run another paid job under the same UUID. Existing output directories are not overwritten. No worker retry is allowed to silently incur a second GPU budget.

## ONNX safety checks

`packages/validation/validate_onnx.py` performs actual CPU inference after a strict structural inspection. Run it only in an isolated resource-limited worker, never in a request handler:

```sh
python3.12 -m venv /tmp/ducklab-validation
/tmp/ducklab-validation/bin/pip install -r packages/validation/requirements.txt
/tmp/ducklab-validation/bin/python packages/validation/validate_onnx.py \
  /private/path/policy.onnx \
  --manifest packages/validation/policy-compatibility.json \
  --output /private/path/validation.json
```

The pinned manifest records the actual 14-joint actuator order, 61-observation schema, default standing pose, action scale, anatomical ranges and actuator target ranges derived from the MJCF. The observation order is angular velocity (3), projected gravity (3), relative joint positions (14), joint velocities (14), previous actions (14), then commands (13). The policy loop is 50 Hz.

Validation rejects external tensor references, custom domains/functions, nested graphs, training graphs, unapproved operators, oversized files/graphs/tensors, invalid float tensor dimensions, nonfinite weights or outputs, wrong joint metadata, targets outside actual actuator control limits, and CPU inference exceeding 20 ms after warmup. Thirty-two seeded observations exercise the real model. Linux resource limits add a 15-second CPU budget, 2 GiB address-space limit and bounded file descriptors; container limits remain required for native-code isolation.

The original controller uses `default_pose + action * 1.0` as position-actuator targets. Its actuator target range is ±10 rad while anatomical hinge ranges are much narrower. Some official models request anatomical-range excursions, which are resolved by MuJoCo joint constraints; the validator reports those excursions without silently rewriting the original controller. A model that passes offline validation still has `physicsValidated:false` and `publicationStatus:"requires-simulation-review"`. Offline samples cannot prove walking, recovery, mechanical safety or sim-to-hardware equivalence.

## Executed verification and limits

The local host has Python 3.9 and no CUDA/`uv`; no GPU job, PPO training, checkpoint export, remote provider provisioning or training deployment was executed. The command builder and configuration limits passed 10 TypeScript tests against source-verified CLI flags. The worker TypeScript was typechecked separately.

For actual CPU model inspection, an isolated temporary environment used ONNX 1.19.1 and ONNX Runtime 1.19.2 (the available Python 3.9 wheels). All nine bundled official policies passed the 32-sample offline inspection. Real hashes, tensor names, operators and measured inference times are saved under `packages/validation/reports/`. These are measurements on this host, not performance promises. The production Python 3.12 validation requirements pin the audited upstream dependency floor (ONNX 1.20.1 and ORT 1.24.4), which still needs deployment-host verification.

Seven Python tests generated and executed a compatible 61→14 model and checked wrong dimensions, NaN weights, actuator overflow, unapproved operators, external data references and wrong joint order. They passed:

```sh
node --import tsx --test packages/shared/training.test.ts
python -m unittest discover -s packages/validation -p 'test_*.py' -v
```

No trained model has been presented as a new community movement. Unconfigured training is explicitly unavailable in the UI/API.

## AI composition

`packages/shared/ai.ts` uses the real OpenAI Responses API with strict `text.format` JSON Schema and server-only `OPENAI_API_KEY`/`OPENAI_MODEL`. The API requires wallet authentication, reserves persistent daily/minute quotas and records provider token usage. The adapter has a supplementary per-process guard, response size limit, output-token budget and provider deadline. See [OpenAI structured output documentation](https://developers.openai.com/api/docs/guides/structured-outputs).

No marketplace text is supplied as trusted instructions. Returned source is compiled through the same movement DSL as user input and is offered for review with `physics:false`; it never runs automatically. Unsupported navigation/perception requests are explained. Provider keys are absent here; executed AI tests use a clearly mocked HTTP provider to test the structured request and malicious-output rejection, not fabricated live assistant responses.
