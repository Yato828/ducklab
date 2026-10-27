import test from 'node:test';
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
const model=mj.MjModel.from_xml_string(await fs.readFile(path.join(robot,'scene_ducklab.xml'),'utf8'),vfs);
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
const measurements=[];
for(const [label,speed,turn,seconds] of [['forward-right',.25,-1,5],['forward-left',.25,1,5],['right-slow',0,-.5,5],['right-softfloor',0,-1,5]]){
 const s=fresh(),cmd=new Float32Array(13);cmd[0]=speed;cmd[2]=turn;await step(s,'walk',cmd,seconds*50);const r={label,command:{vx:speed,wz:turn},simulationSeconds:seconds,position:Array.from(s.data.qpos.subarray(0,3)),yaw:yaw(s.data.qpos),gravityZ:projectedGravity(s.data.body(trunk).xquat)[2]};measurements.push(r);console.log(r);
}
await fs.writeFile(process.env.MEASUREMENT_OUTPUT||'/private/tmp/ducklab-measurements.json',JSON.stringify(measurements,null,2));
