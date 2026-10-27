#!/bin/sh
set -eu
# Run explicitly on an isolated, already allocated Linux CUDA worker.
# This never rents a GPU or submits a training job.
: "${MICRODUCK_RL_PATH:?Set MICRODUCK_RL_PATH to the desired isolated upstream checkout directory}"
: "${TRAINING_ARTIFACT_ROOT:?Set TRAINING_ARTIFACT_ROOT to private persistent storage}"
command -v nvidia-smi >/dev/null
command -v uv >/dev/null
command -v git >/dev/null
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
if [ ! -d "$MICRODUCK_RL_PATH" ]; then
  git clone https://github.com/pollen-robotics/microduck_rl.git "$MICRODUCK_RL_PATH"
  git -C "$MICRODUCK_RL_PATH" checkout 1e79c29c97d8b38aee9eefde77a545860ba7658e
fi
ducklab_revision=$(git -C "$MICRODUCK_RL_PATH" rev-parse HEAD)
if [ "$ducklab_revision" != '1e79c29c97d8b38aee9eefde77a545860ba7658e' ]; then
  echo 'Existing training checkout differs from the audited revision; use a new empty directory.' >&2
  exit 1
fi
uv sync --frozen --project "$MICRODUCK_RL_PATH" --python 3.12
uv run --frozen --project "$MICRODUCK_RL_PATH" python -c 'import sys,torch; assert sys.version_info[:2] == (3,12); assert torch.cuda.is_available(), "CUDA is unavailable"; print(torch.cuda.get_device_name(0))'
uv run --frozen --project "$MICRODUCK_RL_PATH" list-envs
mkdir -p "$TRAINING_ARTIFACT_ROOT"
chmod 700 "$TRAINING_ARTIFACT_ROOT"
echo 'Upstream checkout and CUDA runtime verified. No training job has been started.'
