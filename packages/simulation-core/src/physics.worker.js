/* DUCKLAB worker. Observation and switching conventions adapted from the
 * Apache-2.0 Pollen Robotics simulator, revision ad9d41a763f30dc770817c33d92dcfec0205db1e.
 * No rendering or user-auth/wallet capabilities exist in this worker. */
import loadMujoco from '@mujoco/mujoco';
import mujocoWasmUrl from '@mujoco/mujoco/mujoco.wasm?url';
import * as ort from 'onnxruntime-web/wasm';
import ortWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import { JOINT_NAMES, DEFAULT_POSE, POLICIES, CTRL_DT, DECIMATION } from '../upstream/constants.js';
import { projectedGravity, buildObservation } from './observation.js';
import { COURSE, withCourse } from '../../game-core/src/course.js';
import { TimeTrial } from '../../game-core/src/trial.js';

let mj, model, data, vfs;
let sessions = {}, qAdr=[], vAdr=[], gyroAdr, trunkId, keyId;
let running=true, disposed=false, initialized=false, busy=false, timer;
let mode='walk', modeSteps=0, sitFlag=0, sitTarget=0, fallSteps=0, uprightSteps=0;
let vx=0,wz=0, stepCount=0, inferenceMs=0,physicsMs=0,simulationHz=0;
let measuredSteps=0, measureStart=performance.now(), deadline=0, lastTelemetry=0;
const lastAction=new Float32Array(14), obs=new Float32Array(61);
const objects={};
let courseMode=false;const trial=new TimeTrial();const messages=[];
function reply(id,error){self.postMessage({type:'reply',id,error});}
async function fetchOk(url,kind='arrayBuffer'){
  const r=await fetch(url);if(!r.ok)throw new Error(`Required robot asset unavailable: ${url} (${r.status})`);
  return r[kind]();
}
function progress(label){self.postMessage({type:'progress',label});}
function reset(){
  mj.mj_resetDataKeyframe(model,data,keyId);mj.mj_forward(model,data);
  lastAction.fill(0);vx=0;wz=0;mode='walk';modeSteps=0;sitFlag=0;sitTarget=0;fallSteps=0;uprightSteps=0;stepCount=0;
  trial.reset();running=!courseMode;
  if(courseMode)for(const [kind,pos] of Object.entries(COURSE.props))data.qpos.set(pos,objects[kind].q);
  mj.mj_forward(model,data);
  sendState(true);
}
function gravity(){return projectedGravity(data.body(trunkId).xquat);}
function buildObs(){
  const command=new Float32Array(13);
  if(mode==='walk'){command[0]=vx;command[2]=wz;}
  if(mode==='sitstand')command[0]=sitFlag;
  if(mode==='groundpick'){const phase=modeSteps*CTRL_DT/4;command[0]=Math.cos(2*Math.PI*phase);command[1]=Math.sin(2*Math.PI*phase);}
  return buildObservation({gyro:data.sensordata.subarray(gyroAdr,gyroAdr+3),quaternion:data.body(trunkId).xquat,
    positions:qAdr.map(a=>data.qpos[a]),velocities:vAdr.map(a=>data.qvel[a]),lastAction,command},obs);
}
function sendState(force=false){
  if(!data)return;
  const now=performance.now(), q=data.qpos;
  const state=new Float64Array(7+14+3*7);
  state.set(q.subarray(0,7),0);
  for(let i=0;i<14;i++)state[7+i]=q[qAdr[i]];
  let at=21;
  for(const key of ['ball','block','ramp']){const a=objects[key].q;state.set(q.subarray(a,a+7),at);at+=7;}
  let diagnostics;
  if(force||now-lastTelemetry>100){
    lastTelemetry=now;
    const w=q[3],x=q[4],y=q[5],z=q[6];
    diagnostics={simTime:stepCount*CTRL_DT,simulationHz,inferenceMs,physicsMs,mode:mode==='sitstand'?(sitTarget?'sitting':'standing'):mode,paused:!running,contacts:data.ncon,
      jointNames:JOINT_NAMES,jointPositions:qAdr.map(a=>q[a]),jointLimits:JOINT_NAMES.map(n=>{const j=model.jnt(n);return Array.from(model.jnt_range.subarray(j.id*2,j.id*2+2));}),
      position:[q[0],q[1],q[2]],yaw:Math.atan2(2*(w*z+x*y),1-2*(y*y+z*z)),robotVersion:'ad9d41a / allcollisions',policyVersion:'official / 61 → 14 / 50 Hz'};
  }
  self.postMessage({type:'state',state,diagnostics,trial:courseMode?trial.snapshot():undefined},[state.buffer]);
}
async function controlStep(){
  const start=performance.now();
  if(mode!=='fallen'){
    const session=sessions[mode==='recover'?'stand':mode];
    const t=performance.now();
    const out=await session.run({[session.inputNames[0]]:new ort.Tensor('float32',buildObs(),[1,61])});
    inferenceMs=performance.now()-t;
    const act=out[session.outputNames[0]].data;
    if(act.length!==14||!Array.from(act).every(Number.isFinite))throw new Error('Invalid policy output: expected 14 finite actions.');
    for(let j=0;j<14;j++){
      const target=DEFAULT_POSE[j]+act[j],r=model.actuator_ctrlrange;
      if(target<r[2*j]||target>r[2*j+1])throw new Error(`Policy target exceeds ${JOINT_NAMES[j]} actuator control range.`);
      data.ctrl[j]=target;lastAction[j]=act[j];
    }
  }
  const t=performance.now();
  for(let n=0;n<DECIMATION;n++)mj.mj_step(model,data);
  physicsMs=performance.now()-t;stepCount++;measuredSteps++;modeSteps++;
  if(!Array.from(data.qpos).every(Number.isFinite))throw new Error('MuJoCo produced a non-finite state. Reset required.');
  const gz=gravity()[2];
  if(mode==='walk'){
    fallSteps=gz>-.5?fallSteps+1:0;
    if(fallSteps>=10){mode='fallen';modeSteps=0;vx=0;wz=0;}
  }else if(mode==='fallen'&&modeSteps>=15){mode='recover';modeSteps=0;uprightSteps=0;lastAction.fill(0);}
  else if(mode==='recover'){
    uprightSteps=gz<-.85?uprightSteps+1:0;
    if(uprightSteps>=50){mode='walk';modeSteps=0;lastAction.fill(0);}
    else if(modeSteps>=300){running=false;self.postMessage({type:'warning',error:'Recovery timed out after 6 simulation seconds. Reset or inspect the pose.'});}
  }else if(mode==='sitstand'){
    if(sitTarget&&modeSteps>=40)sitFlag=1;
    if(!sitTarget&&modeSteps>=100){mode='walk';modeSteps=0;lastAction.fill(0);}
  }else if((mode==='kickL'||mode==='kickR')&&modeSteps>=25){mode='walk';modeSteps=0;}
  else if(mode==='groundpick'&&modeSteps>=140){mode='walk';modeSteps=0;}
  else if(mode==='roll'&&modeSteps>=150){mode=gz<-.85?'walk':'recover';modeSteps=0;lastAction.fill(0);}
  const now=performance.now();
  if(now-measureStart>=1000){simulationHz=measuredSteps*1000/(now-measureStart);measuredSteps=0;measureStart=now;}
  if(courseMode&&trial.status==='running'){trial.update(stepCount*CTRL_DT,Array.from(data.qpos.subarray(0,3)));if(trial.status==='finished'){running=false;vx=0;wz=0;}}
  sendState();
}
async function tick(){
  if(disposed)return;
  busy=true;
  try{
    while(messages.length)await handleMessage(messages.shift());
    if(running){await controlStep();deadline=Math.max(deadline+20,performance.now()-100);}
    else deadline=performance.now();
  }catch(e){running=false;sendState(true);self.postMessage({type:'error',error:e.message||String(e)});}
  finally{busy=false;}
  timer=setTimeout(tick,running?Math.max(0,deadline-performance.now()):20);
}
async function ensurePolicy(key){
  if(sessions[key])return sessions[key];
  if(!POLICIES[key])throw new Error('Unsupported official policy.');
  const session=await ort.InferenceSession.create(POLICIES[key],{executionProviders:['wasm']});
  if(session.inputNames.length!==1||session.outputNames.length!==1)throw new Error(`Unexpected ${key} policy interface`);
  sessions[key]=session;progress('Official policy · '+key);return session;
}
async function init(){
  ort.env.wasm.wasmPaths={wasm:ortWasmUrl};ort.env.wasm.numThreads=1;
  const [runtime,xml,meta]=await Promise.all([
    loadMujoco({locateFile:p=>p.endsWith('.wasm')?mujocoWasmUrl:p}).then(v=>{progress('MuJoCo WebAssembly');return v;}),
    fetchOk('/robot/mjlab/scene_ducklab.xml','text').then(v=>{progress('Collision model');return v;}),
    fetchOk('/robot/mjlab/physics-assets.json','json')
  ]);mj=runtime;vfs=new mj.MjVFS();
  await Promise.all(meta.meshFiles.map(async f=>{const b=await fetchOk('/robot/mjlab/'+(meta.meshDir||'meshes')+'/'+f);vfs.addBuffer('assets/'+f,new Uint8Array(b));progress('Collision mesh · '+f);}));
  model=mj.MjModel.from_xml_string(courseMode?withCourse(xml):xml,vfs);data=new mj.MjData(model);
  qAdr=JOINT_NAMES.map(n=>model.jnt(n).qposadr);vAdr=JOINT_NAMES.map(n=>model.jnt(n).dofadr);
  gyroAdr=model.sensor('imu_ang_vel').adr;trunkId=mj.mj_name2id(model,mj.mjtObj.mjOBJ_BODY.value,'trunk_base');keyId=mj.mj_name2id(model,mj.mjtObj.mjOBJ_KEY.value,'STAND');
  for(const key of ['ball','block','ramp'])objects[key]={q:model.jnt('ducklab_'+key+'_free').qposadr,v:model.jnt('ducklab_'+key+'_free').dofadr};
  for(const key of ['walk','stand'])await ensurePolicy(key);
  initialized=true;reset();self.postMessage({type:'ready'});deadline=performance.now();tick();
}
self.onmessage=async({data:m})=>{
  if(m.type==='init'){courseMode=m.mode==='course';try{await init();}catch(e){self.postMessage({type:'error',error:e.message||String(e)});}return;}
  if(m.type==='dispose'){disposed=true;clearTimeout(timer);self.close();return;}
  if(!initialized)return reply(m.id,'Simulation is not initialized.');
  // Commands are velocities only; state-changing operations execute between policy ticks.
  if(m.type==='command'){if(Number.isFinite(m.vx)&&Number.isFinite(m.wz)){vx=Math.max(-.2,Math.min(.25,m.vx));wz=Math.max(-1,Math.min(1,m.wz));}return;}
  messages.push(m);
};
async function handleMessage(m){
  try{
    switch(m.type){
      case 'pause':running=courseMode&&trial.status!=='running'?false:!m.paused;vx=0;wz=0;sendState(true);break;
      case 'startTrial':if(!courseMode)throw new Error('Open Time Trial first.');reset();trial.start(0,Array.from(data.qpos.subarray(0,3)));running=true;deadline=performance.now();sendState(true);break;
      case 'action':{
        if(courseMode&&trial.status!=='running')throw new Error('Start the run first.');
        if(['roll','kickL','kickR','groundpick','fallen','recover'].includes(mode))throw new Error('Wait for the active physical skill to finish.');
        if(!['sit','stand','roll','kickL','kickR','groundpick','recover'].includes(m.action))throw new Error('Unsupported policy action.');
        await ensurePolicy(m.action==='sit'||m.action==='stand'?'sitstand':m.action==='recover'?'stand':m.action);
        if(m.action==='sit'){mode='sitstand';sitTarget=1;sitFlag=0;lastAction.fill(0);}
        else if(m.action==='stand'){mode='sitstand';sitTarget=0;sitFlag=0;lastAction.fill(0);}
        else{mode=m.action;if(mode==='recover'){uprightSteps=0;lastAction.fill(0);}}
        modeSteps=0;vx=0;wz=0;sendState(true);break;
      }
      case 'reset':reset();break;
      case 'step':if(running)throw new Error('Pause physics before single stepping.');await controlStep();sendState(true);break;
      case 'object':{
        if(courseMode)throw new Error('Course objects are fixed for consistent personal records.');
        const o=objects[m.kind];if(!o)throw new Error('Unsupported physical object.');
        const q=data.qpos,yaw=Math.atan2(2*(q[3]*q[6]+q[4]*q[5]),1-2*(q[5]*q[5]+q[6]*q[6]));
        q[o.q]=q[0]+.35*Math.cos(yaw);q[o.q+1]=q[1]+.35*Math.sin(yaw);q[o.q+2]=m.kind==='ramp'?.01:.12;
        q[o.q+3]=1;q.fill(0,o.q+4,o.q+7);data.qvel.fill(0,o.v,o.v+6);mj.mj_forward(model,data);sendState(true);break;
      }
      case 'perturb':if(courseMode)throw new Error('Push testing is available in Free Playground.');data.qvel[3]+=4;data.qvel[1]+=.3;sendState(true);break;
      default:throw new Error('Unknown simulation command.');
    }
    if(m.id)reply(m.id);
  }catch(e){reply(m.id,e.message||String(e));}
}
