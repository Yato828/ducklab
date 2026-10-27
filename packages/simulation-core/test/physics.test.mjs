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
test('every downloaded source and original asset matches recorded SHA256',async()=>{
 const manifest=JSON.parse(await fs.readFile(path.join(root,'assets/microduck/manifest.json'),'utf8'));
 for(const f of manifest.files){const bytes=await fs.readFile(path.join(root,f.path));assert.equal(bytes.length,f.bytes,f.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256,f.path);}
});
test('official MuJoCo hierarchy, scale, inertia, servo order and limits',()=>{
 assert.equal(model.nu,14);assert.equal(model.nq,42);assert.equal(model.opt.timestep,.005);assert.equal(model.nbody,19);
 assert.deepEqual(meta.jointNames,JOINT_NAMES);for(let i=0;i<14;i++)assert.ok(Math.abs(fresh().data.ctrl[i]-DEFAULT_POSE[i])<1e-7);
 for(let i=0;i<14;i++){assert.equal(model.actuator(i).name,JOINT_NAMES[i]);const id=model.jnt(JOINT_NAMES[i]).id;assert.ok(model.jnt_range[2*id]<model.jnt_range[2*id+1]);}
 assert.equal(model.body('trunk_base').mass>0,true);assert.equal(model.body('trunk_base').pos[2],.12);
});
test('all seven official ONNX interfaces are float32 obs[1,61] to actions[1,14]',()=>{
 for(const s of Object.values(sessions)){assert.equal(s.inputNames[0],'obs');assert.equal(s.outputNames[0],'actions');assert.deepEqual(s.inputMetadata[0].shape,[1,61]);assert.deepEqual(s.outputMetadata[0].shape,[1,14]);}
});
test('gravity quaternion convention and 61D observation reject NaN',()=>{
 assert.deepEqual(projectedGravity([1,0,0,0]),[0,-0,-1]);const q=Math.SQRT1_2;assert.ok(Math.abs(projectedGravity([q,q,0,0])[2])<1e-6);
 assert.throws(()=>buildObservation({gyro:[NaN,0,0],quaternion:[1,0,0,0],positions:DEFAULT_POSE,velocities:new Float32Array(14),lastAction:new Float32Array(14),command:new Float32Array(13)}),/Non-finite/);
});
test('fixed-seed standing has genuine contacts and stable trained control',async()=>{
 const s=fresh();await step(s,'walk',new Float32Array(13),150);assert.ok(s.data.ncon>0);assert.ok(s.data.qpos[2]>.09);assert.ok(projectedGravity(s.data.body(trunk).xquat)[2]<-.9);assert.ok(Math.abs(s.data.time-3)<1e-9);
});
test('official forward walking policy translates through physics at supported full-speed command',async()=>{
 const s=fresh(),cmd=new Float32Array(13);cmd[0]=.25;await step(s,'walk',cmd,150);
 assert.ok(s.data.qpos[0]>.25,`forward=${s.data.qpos[0]}`);
});
test('full-scale turn command changes physical orientation',async()=>{const s=fresh(),cmd=new Float32Array(13);cmd[2]=1;await step(s,'walk',cmd,150);assert.ok(yaw(s.data.qpos)>.8);});
test('sitstand policy lowers then raises robot with original collisions',async()=>{
 const s=fresh(),cmd=new Float32Array(13);await step(s,'sitstand',cmd,40);cmd[0]=1;await step(s,'sitstand',cmd,150);const sitting=s.data.qpos[2];cmd[0]=0;await step(s,'sitstand',cmd,150);assert.ok(sitting<.09,`sit=${sitting}`);assert.ok(s.data.qpos[2]>sitting+.02,`stand=${s.data.qpos[2]}`);
});
test('ball collides with floor and loses height under gravity',()=>{
 const s=fresh(),d=s.data,a=model.jnt('ducklab_ball_free').qposadr;d.qpos[a]=.6;d.qpos[a+1]=0;d.qpos[a+2]=.4;mj.mj_forward(model,d);for(let i=0;i<300;i++)mj.mj_step(model,d);assert.ok(d.qpos[a+2]>.035&&d.qpos[a+2]<.045);assert.ok(d.ncon>0);
});
test('identical model resets produce deterministic physics',async()=>{
 const a=fresh(),b=fresh(),cmd=new Float32Array(13);cmd[0]=.15;await step(a,'walk',cmd,50);await step(b,'walk',cmd,50);assert.deepEqual(Array.from(a.data.qpos),Array.from(b.data.qpos));
});

test('official recovery returns two fallen orientations to upright',async()=>{
 for(const quat of [[Math.SQRT1_2,0,Math.SQRT1_2,0],[Math.SQRT1_2,Math.SQRT1_2,0,0]]){
  const s=fresh();s.data.qpos.set(quat,3);s.data.qpos[2]=.09;mj.mj_forward(model,s.data);await step(s,'stand',new Float32Array(13),300);
  assert.ok(s.data.qpos[2]>.10);assert.ok(projectedGravity(s.data.body(trunk).xquat)[2]<-.95);
 }
});
test('official roll tips and returns upright through contacts',async()=>{
 const s=fresh();await step(s,'walk',new Float32Array(13),50);let tipped=false;
 for(let i=0;i<150;i++){await step(s,'roll');if(projectedGravity(s.data.body(trunk).xquat)[2]>-.3)tipped=true;}
 assert.ok(tipped);assert.ok(projectedGravity(s.data.body(trunk).xquat)[2]<-.9);assert.ok(s.data.qpos[0]>.25);
});
test('kick policies and phase-driven ground pick stay finite and finish upright',async()=>{
 for(const policy of ['kickL','kickR','groundpick']){const s=fresh();await step(s,'walk',new Float32Array(13),50);
  for(let i=0;i<(policy==='groundpick'?140:25);i++){const cmd=new Float32Array(13);if(policy==='groundpick'){cmd[0]=Math.cos(2*Math.PI*i*.02/4);cmd[1]=Math.sin(2*Math.PI*i*.02/4);}await step(s,policy,cmd);}
  assert.ok(projectedGravity(s.data.body(trunk).xquat)[2]<-.9);
 }
});

test('right steering while walking produces a genuine clockwise arc',async()=>{
 const s=fresh(),cmd=new Float32Array(13);cmd[0]=.25;cmd[2]=-1;let previous=0,total=0;
 for(let i=0;i<250;i++){await step(s,'walk',cmd,1);const current=yaw(s.data.qpos);total+=Math.atan2(Math.sin(current-previous),Math.cos(current-previous));previous=current;}
 assert.ok(total<-2,`clockwise turn=${total}`);assert.ok(s.data.qpos[2]>.09);
});
