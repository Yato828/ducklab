import test from 'node:test';
import assert from 'node:assert/strict';
import { trainingCommand, validateTrainingRequest, TRAINING_UPSTREAM_COMMIT } from './training.js';
test('approved worker command is derived from pinned upstream CLI and fixed task registry', () => {
  const config=validateTrainingRequest({task:'walk',iterations:100,numEnvs:128,maxDurationSeconds:60});
  assert.deepEqual(trainingCommand(config,'11111111-1111-1111-1111-111111111111'),['train','Mjlab-Velocity-Flat-MicroDuck','--env.scene.num-envs','128','--agent.max_iterations','100','--agent.run-name','ducklab_11111111-1111-1111-1111-111111111111']);
  assert.equal(TRAINING_UPSTREAM_COMMIT,'1e79c29c97d8b38aee9eefde77a545860ba7658e');
});
for(const config of [
  {task:'arbitrary-python'}, {task:'walk',python:'print(1)'}, {task:'walk',iterations:1e8},
  {task:'walk',iterations:1.5}, {task:'walk',numEnvs:1000}, {task:'walk',maxDurationSeconds:7201},
  {task:'walk',reward:'eval(input())'}, {task:'__proto__'},
]) test(`training configuration rejects ${JSON.stringify(config)}`,()=>assert.throws(()=>validateTrainingRequest(config)));
test('worker never interpolates untrusted user data into shell commands',()=>assert.throws(()=>trainingCommand(validateTrainingRequest({task:'walk'}),'../../../etc/passwd'),/UUID/));
