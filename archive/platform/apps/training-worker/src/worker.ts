import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile, realpath } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRAINING_UPSTREAM_COMMIT, TRAINING_QUEUE, APPROVED_TRAINING_TASKS, trainingCommand, validateTrainingRequest, type TrainingQueueJob } from '../../../packages/shared/training.js';
import { storageConfigured, uploadPrivateArtifact } from '../../../packages/storage/src/index.js';

const upstream = process.env.MICRODUCK_RL_PATH;
const artifactRoot = process.env.TRAINING_ARTIFACT_ROOT;
if (!upstream || !artifactRoot || !process.env.REDIS_URL || !process.env.DATABASE_URL || process.env.TRAINING_ENABLED !== 'true') throw new Error('Training worker requires TRAINING_ENABLED=true, MICRODUCK_RL_PATH, TRAINING_ARTIFACT_ROOT, REDIS_URL, DATABASE_URL and a separately provisioned CUDA GPU.');
const checkout = await realpath(upstream);
const revision = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (revision !== TRAINING_UPSTREAM_COMMIT) throw new Error(`Training checkout must equal audited revision ${TRAINING_UPSTREAM_COMMIT}.`);
execFileSync('nvidia-smi', ['--query-gpu=name,memory.total', '--format=csv,noheader'], { stdio: 'inherit' });
const redis = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const database = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const uv = process.env.UV_PATH || 'uv';
const validator = fileURLToPath(new URL('../../../packages/validation/validate_onnx.py', import.meta.url));
const manifest = fileURLToPath(new URL('../../../packages/validation/policy-compatibility.json', import.meta.url));
let activeJobId: string | undefined;

async function findCheckpoints(root: string): Promise<string[]> {
  const found: string[] = [];
  async function visit(directory: string, depth: number) {
    if (depth > 6) return;
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) await visit(join(directory, entry.name), depth + 1);
      else if (/^model_\d+\.pt$/.test(entry.name)) found.push(join(directory, entry.name));
    }
  }
  await visit(root, 0);
  return found.sort((a, b) => Number(b.match(/model_(\d+)\.pt$/)?.[1]) - Number(a.match(/model_(\d+)\.pt$/)?.[1]));
}

const worker = new Worker<TrainingQueueJob>(TRAINING_QUEUE, async job => {
  const { jobId, userId, ...rawConfig } = job.data;
  const config = validateTrainingRequest(rawConfig);
  if (!/^[a-f0-9-]{36}$/.test(jobId) || typeof userId !== 'string' || userId.length > 200) throw new Error('Invalid queue job identity.');
  const claim = await database.query("UPDATE training_jobs SET status='running',started_at=now() WHERE id=$1 AND user_id=$2 AND status='queued' RETURNING id", [jobId,userId]);
  if (!claim.rowCount) {
    await database.query("UPDATE training_jobs SET status='cancelled',completed_at=now() WHERE id=$1 AND user_id=$2 AND status='cancelling'", [jobId,userId]);
    throw new Error('Training job is no longer queued. Interrupted training requires explicit operator review; it will not be billed twice automatically.');
  }
  activeJobId=jobId;
  const directory = resolve(artifactRoot, jobId);
  const startedAt = Date.now();
  const cancelKey = `ducklab:training:cancel:${jobId}`;
  let lastOutput = '';
  let cancelled = false;
  const deadline = startedAt + config.maxDurationSeconds * 1000;
  const environment: NodeJS.ProcessEnv = {
    PATH: process.env.PATH, UV_CACHE_DIR: process.env.UV_CACHE_DIR, XDG_CACHE_HOME: join(directory, '.cache'),
    CUDA_VISIBLE_DEVICES: process.env.CUDA_VISIBLE_DEVICES ?? '0', WANDB_MODE: 'offline',
    PYTHONUNBUFFERED: '1', OMP_NUM_THREADS: '4', MUJOCO_GL: 'egl',
  };
  const run = async (args: string[]) => {
    if (Date.now() >= deadline) throw new Error('Training job budget exhausted.');
    await new Promise<void>((resolveRun, reject) => {
      const child = spawn(uv, ['run', '--frozen', '--project', checkout, ...args], { cwd: directory, shell: false, detached: true, env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
      const stop = () => { if (child.pid) { try { process.kill(-child.pid, 'SIGTERM'); } catch {} setTimeout(() => { try { process.kill(-child.pid!, 'SIGKILL'); } catch {} }, 3000).unref(); } };
      const consume = (chunk: Buffer) => {
        const output = chunk.toString('utf8');
        lastOutput = (lastOutput + output).slice(-16000);
        const matches = [...output.matchAll(/Learning iteration\s+(\d+)\s*\/\s*(\d+)/g)];
        const latest = matches.at(-1);
        if (latest) void job.updateProgress({ phase: 'training', iteration: Number(latest[1]), totalIterations: Number(latest[2]), elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000) });
      };
      child.stdout?.on('data', consume); child.stderr?.on('data', consume);
      const timer = setTimeout(stop, Math.max(1, deadline - Date.now()));
      const interval = setInterval(() => { void redis.get(cancelKey).then(value => { if (value) { cancelled = true; stop(); } }).catch(stop); }, 1000);
      child.once('error', error => { clearTimeout(timer); clearInterval(interval); reject(error); });
      child.once('exit', (code, signal) => { clearTimeout(timer); clearInterval(interval); if (code === 0 && !cancelled && Date.now() <= deadline) resolveRun(); else reject(new Error(cancelled ? 'Training cancelled.' : `Training process stopped (${signal ?? code}); inspect the private worker log.`)); });
    });
  };
  const provenance = { jobId, userId, config, upstreamCommit: revision, startedAt: new Date(startedAt).toISOString() };
  try {
    await mkdir(directory, { recursive: false, mode: 0o700 });
    await writeFile(join(directory, 'configuration.json'), JSON.stringify(provenance, null, 2), { mode: 0o600 });
    if (await redis.get(cancelKey)) throw new Error('Training cancelled before execution.');
    await job.updateProgress({ phase: 'training', iteration: 0, totalIterations: config.iterations });
    await run(trainingCommand(config, jobId));
    const checkpoints = await findCheckpoints(join(directory, 'logs', 'rsl_rl', APPROVED_TRAINING_TASKS[config.task].experiment));
    if (!checkpoints.length) throw new Error('The upstream trainer completed without an actual model checkpoint.');
    const onnxPath = join(directory, 'policy.onnx');
    await job.updateProgress({ phase: 'exporting', checkpoint: checkpoints[0].split('/').pop() });
    await run([join(checkout, 'scripts', 'export.py'), APPROVED_TRAINING_TASKS[config.task].taskId, '--checkpoint-file', checkpoints[0], '--onnx-file', onnxPath, '--num-envs', '1', '--device', 'cuda:0']);
    await job.updateProgress({ phase: 'validating' });
    await run(['python', validator, onnxPath, '--manifest', manifest, '--output', join(directory, 'validation.json')]);
    const report = JSON.parse(await readFile(join(directory, 'validation.json'), 'utf8'));
    if (!report.accepted) throw new Error('Exported policy failed offline compatibility validation.');
    const sha256 = createHash('sha256').update(await readFile(onnxPath)).digest('hex');
    if(await redis.get(cancelKey)){cancelled=true;throw new Error('Training cancelled before artifact acceptance.');}
    const storage=storageConfigured()?await uploadPrivateArtifact(`private/training/${userId}/${jobId}/${sha256}.onnx`,await readFile(onnxPath),sha256):undefined;
    const result = { ...provenance, completedAt: new Date().toISOString(), elapsedSeconds: (Date.now() - startedAt) / 1000, artifactSha256: sha256, artifactPath: onnxPath, storageKey:storage?.storageKey, validation: report, publicationStatus: 'requires-simulation-review' };
    await writeFile(join(directory, 'result.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
    const client=await database.connect();
    try {
      await client.query('BEGIN');
      const artifactId=randomUUID();
      await client.query("UPDATE training_jobs SET status='succeeded',completed_at=now(),gpu_seconds_used=$2 WHERE id=$1",[jobId,result.elapsedSeconds]);
      await client.query('INSERT INTO training_artifacts(id,job_id,asset_hash,metadata) VALUES($1,$2,$3,$4)',[artifactId,jobId,sha256,JSON.stringify(result)]);
      await client.query("INSERT INTO validation_results(id,artifact_id,kind,passed,details) VALUES($1,$2,'onnx-offline',true,$3)",[randomUUID(),artifactId,JSON.stringify(report)]);
      await client.query('COMMIT');
    } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    await job.updateProgress({ phase: 'awaiting-simulation-review' });
    return result;
  } catch (error) {
    const elapsedSeconds=(Date.now()-startedAt)/1000;
    cancelled=cancelled||Boolean(await redis.get(cancelKey));
    await database.query('UPDATE training_jobs SET status=$2,completed_at=now(),gpu_seconds_used=$3,error=$4 WHERE id=$1',[jobId,cancelled?'cancelled':'failed',elapsedSeconds,(error instanceof Error ? error.message : 'Training failed.').slice(0,1000)]);
    await writeFile(join(directory, 'worker.log'), lastOutput, { mode: 0o600 }).catch(()=>{});
    await writeFile(join(directory, 'failure.json'), JSON.stringify({ error: error instanceof Error ? error.message : 'Training failed.', cancelled, elapsedSeconds }), { mode: 0o600 }).catch(()=>{});
    throw error;
  } finally { activeJobId=undefined; await redis.del(cancelKey); }
}, { connection: redis as any, concurrency: 1, lockDuration: 120000, stalledInterval: 30000 });
worker.on('failed', (job, error) => console.error(JSON.stringify({ event: 'training.failed', jobId: job?.id, error: error.message })));
worker.on('completed', job => console.log(JSON.stringify({ event: 'training.completed', jobId: job.id })));
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => { void (async()=>{ if(activeJobId)await redis.set(`ducklab:training:cancel:${activeJobId}`,'1','EX',86400); await worker.close(); await database.end(); await redis.quit(); process.exit(0); })(); });
