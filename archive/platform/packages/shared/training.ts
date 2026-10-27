export const TRAINING_UPSTREAM_COMMIT = '1e79c29c97d8b38aee9eefde77a545860ba7658e';
export const TRAINING_QUEUE = 'ducklab-training';
export const APPROVED_TRAINING_TASKS = Object.freeze({
  walk: { taskId: 'Mjlab-Velocity-Flat-MicroDuck', experiment: 'velocity', description: 'Official velocity-tracking PPO reward template.' },
  recovery: { taskId: 'Mjlab-StandUp-Flat-MicroDuck', experiment: 'microduck_stand', description: 'Official stand-up PPO reward template.' },
  sitstand: { taskId: 'Mjlab-SitStand-Flat-MicroDuck', experiment: 'microduck_sitstand', description: 'Official commanded sit/stand PPO reward template.' },
  groundPick: { taskId: 'Mjlab-GroundPick-Flat-MicroDuck', experiment: 'ground_pick', description: 'Official phased ground-pick PPO reward template.' },
  kick: { taskId: 'Mjlab-BallKick-Flat-MicroDuck', experiment: 'ball_kick_right', description: 'Official right-foot ball-kick PPO reward template.' },
});
export type TrainingTask = keyof typeof APPROVED_TRAINING_TASKS;
export interface TrainingRequest { task: TrainingTask; iterations: number; numEnvs: number; maxDurationSeconds: number }
export interface TrainingQueueJob extends TrainingRequest { jobId: string; userId: string }
export function validateTrainingRequest(input: unknown): TrainingRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('A training configuration is required.');
  const value = input as Record<string, unknown>;
  for (const key of Object.keys(value)) if (!['task', 'iterations', 'numEnvs', 'maxDurationSeconds'].includes(key)) throw new Error(`Unsupported training parameter: ${key}`);
  if (typeof value.task !== 'string' || !Object.hasOwn(APPROVED_TRAINING_TASKS, value.task)) throw new Error('Select an approved Microduck training task.');
  const iterations = value.iterations ?? 1000;
  const numEnvs = value.numEnvs ?? 1024;
  const maxDurationSeconds = value.maxDurationSeconds ?? 3600;
  if (!Number.isInteger(iterations) || Number(iterations) < 100 || Number(iterations) > 4000) throw new Error('Training iterations must be an integer from 100 to 4,000.');
  if (!Number.isInteger(numEnvs) || Number(numEnvs) < 128 || Number(numEnvs) > 4096 || (Number(numEnvs) & (Number(numEnvs) - 1)) !== 0) throw new Error('Parallel environments must be a power of two between 128 and 4,096.');
  if (!Number.isInteger(maxDurationSeconds) || Number(maxDurationSeconds) < 60 || Number(maxDurationSeconds) > 7200) throw new Error('Training duration must be an integer from 60 to 7,200 seconds.');
  return { task: value.task as TrainingTask, iterations: Number(iterations), numEnvs: Number(numEnvs), maxDurationSeconds: Number(maxDurationSeconds) };
}
export function trainingCommand(config: TrainingRequest, jobId: string): string[] {
  const checked = validateTrainingRequest(config);
  if (!/^[a-f0-9-]{36}$/.test(jobId)) throw new Error('Training job ID must be a UUID.');
  // Exact train entrypoint and flags verified in the pinned train_cli.py and README.
  return ['train', APPROVED_TRAINING_TASKS[checked.task].taskId, '--env.scene.num-envs', String(checked.numEnvs), '--agent.max_iterations', String(checked.iterations), '--agent.run-name', `ducklab_${jobId}`];
}
