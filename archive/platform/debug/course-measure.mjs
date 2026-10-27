import test from 'node:test';
import {COURSE,withCourse} from '../../game-core/src/course.js';
import {TimeTrial} from '../../game-core/src/trial.js';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import loadMujoco from '@mujoco/mujoco';
import * as ort from 'onnxruntime-web/wasm';
import { JOINT_NAMES, DEFAULT_POSE, POLICIES } from '../upstream/constants.js';
import { buildObservation,projectedGravity } from '../src/observation.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const asset=path.join(root,'apps/web/public');
const robot=path.join(asset,'robot/mjlab');
ort.env.wasm.numThreads=1;
const mj=await loadMujoco();const meta=JSON.parse(await fs.readFile(path.join(robot,'physics-assets.json'),'utf8'));
const vfs=new mj.MjVFS();for(const f of meta.meshFiles)vfs.addBuffer('assets/'+f,new Uint8Array(await fs.readFile(path.join(robot,meta.meshDir||'meshes',f))));
const model=mj.MjModel.from_xml_string(withCourse(await fs.readFile(path.join(robot,'scene_ducklab.xml'),'utf8')),vfs);
const key=mj.mj_name2id(model,mj.mjtObj.mjOBJ_KEY.value,'STAND'),trunk=model.body('trunk_base').id,gyro=model.sensor('imu_ang_vel').adr;
const qa=JOINT_NAMES.map(n=>model.jnt(n).qposadr),va=JOINT_NAMES.map(n=>model.jnt(n).dofadr);
const sessions={};for(const k of ['walk','sitstand','roll','kickL','kickR','groundpick','stand'])sessions[k]=await ort.InferenceSession.create(new Uint8Array(await fs.readFile(path.join(asset,POLICIES[k]))),{executionProviders:['wasm']});
function fresh(){const data=new mj.MjData(model);mj.mj_resetDataKeyframe(model,data,key);mj.mj_forward(model,data);return {data,last:new Float32Array(14)};}
async function step(s,policy='walk',cmd=new Float32Array(13),ticks=1){
 for(let t=0;t<ticks;t++){
  const d=s.data,session=sessions[policy];const obs=buildObservation({gyro:d.sensordata.subarray(gyro,gyro+3),quaternion:d.body(trunk).xquat,positions:qa.map(a=>d.qpos[a]),velocities:va.map(a=>d.qvel[a]),lastAction:s.last,command:cmd});
  const out=await session.run({[session.inputNames[0]]:new ort.Tensor('float32',obs,[1,61])});const a=out[session.outputNames[0]].data;
  assert.equal(a.length,14);assert.ok(Array.from(a).every(Number.isFinite));
  for(let i=0;i<14;i++){d.ctrl[i]=DEFAULT_POSE[i]+a[i];s.last[i]=a[i];}
  for(let n=0;n<4;n++)mj.mj_step(model,d);
  assert.ok(Array.from(d.qpos).every(Number.isFinite));
 }
}
function yaw(q){return Math.atan2(2*(q[3]*q[6]+q[4]*q[5]),1-2*(q[5]*q[5]+q[6]*q[6]));}

const s=fresh();
for(const [kind,pos] of Object.entries(COURSE.props)) s.data.qpos.set(pos,model.jnt('ducklab_'+kind+'_free').qposadr);
mj.mj_forward(model,s.data);const trial=new TimeTrial();trial.start(0,Array.from(s.data.qpos.subarray(0,3)));
let stage=0,previous=0;
for(let i=0;i<7500&&trial.status!=='finished';i++){
 const q=s.data.qpos,cmd=new Float32Array(13);
 if(stage===0){cmd[0]=.25;if(q[0]>=2.56){stage=1;cmd[0]=0;}}
 else if(stage===1){cmd[2]=1;if(yaw(q)>=1.55){stage=2;cmd[2]=0;}}
 else{cmd[0]=.25;}
 await step(s,'walk',cmd,1);trial.update((i+1)*.02,Array.from(s.data.qpos.subarray(0,3)));
 if(trial.next!==previous){console.log('checkpoint',trial.next,trial.elapsed,Array.from(q.subarray(0,3)),yaw(q));previous=trial.next;}
 if(i%500===0)console.log('progress',i*.02,'stage',stage,Array.from(q.subarray(0,3)),yaw(q));
}
console.log('RESULT',trial.snapshot(),Array.from(s.data.qpos.subarray(0,3)),yaw(s.data.qpos));
