/* Browser transport/scheduler. All physical behavior is shared with the verifier. */
import loadMujoco from '@mujoco/mujoco';
import mujocoWasmUrl from '@mujoco/mujoco/mujoco.wasm?url';
import * as ort from 'onnxruntime-web/wasm';
import ortWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import {JOINT_NAMES,POLICIES,CTRL_DT} from '../upstream/constants.js';
import {withCourse} from '../../game-core/src/course.js';
import {PhysicsEngine} from './engine.js';
let engine,mj,model,vfs,timer,courseMode=false,rollerMode=false,running=false,disposed=false,initializing=false;
let deadline=0,lastTelemetry=0,measureStart=performance.now(),measured=0,simulationHz=0;
const sessions={},messages=[];let extraJoints=[];
const progress=label=>self.postMessage({type:'progress',label});
const reply=(id,error,result)=>{if(id)self.postMessage({type:'reply',id,error,result});};
async function fetchOk(url,kind='arrayBuffer'){const r=await fetch(url);if(!r.ok)throw new Error(`Required asset unavailable: ${url} (${r.status})`);return r[kind]();}
async function ensurePolicy(key){if(sessions[key])return sessions[key];if(!POLICIES[key])throw new Error('Unsupported policy.');const s=await ort.InferenceSession.create(POLICIES[key],{executionProviders:['wasm']});if(s.inputNames.length!==1||s.outputNames.length!==1)throw new Error('Unexpected policy interface.');sessions[key]=s;progress('Official policy · '+key);return s;}
function sendState(force=false){
 if(!engine)return;const e=engine,d=e.data,q=d.qpos,now=performance.now(),state=new Float64Array(42);
 state.set(q.subarray(0,7));e.qa.forEach((a,i)=>state[7+i]=q[a]);['ball','block','ramp'].forEach((k,i)=>state.set(q.subarray(e.objects[k].q,e.objects[k].q+7),21+i*7));
 let diagnostics;
 if(force||now-lastTelemetry>100){lastTelemetry=now;const [w,x,y,z]=q.subarray(3,7);diagnostics={simTime:e.steps*CTRL_DT,simulationHz,inferenceMs:e.inferenceMs,physicsMs:e.physicsMs,mode:e.mode==='sitstand'?(e.sitTarget?'sitting':'standing'):e.mode,paused:!running,contacts:d.ncon,jointNames:JOINT_NAMES,jointPositions:e.qa.map(a=>q[a]),jointLimits:JOINT_NAMES.map(n=>{const j=model.jnt(n);return Array.from(model.jnt_range.subarray(j.id*2,j.id*2+2));}),position:Array.from(q.subarray(0,3)),yaw:Math.atan2(2*(w*z+x*y),1-2*(y*y+z*z)),robotVersion:'ad9d41a / allcollisions',policyVersion:'official / 61 → 14 / 50 Hz',ball:Array.from(q.subarray(e.objects.ball.q,e.objects.ball.q+3)),block:Array.from(q.subarray(e.objects.block.q,e.objects.block.q+3))};}
 self.postMessage({type:'state',state,diagnostics,extraJoints:extraJoints.map(j=>[j.name,q[j.adr]]),trial:courseMode?e.trial.snapshot():undefined},[state.buffer]);
}
async function step(){await engine.tick();measured++;if(courseMode&&engine.trial.status==='finished')running=false;const now=performance.now();if(now-measureStart>=1000){simulationHz=measured*1000/(now-measureStart);measured=0;measureStart=now;}sendState();}
async function handle(m){
 try{let result;switch(m.type){
  case 'command':engine.setCommand(m.vx,m.wz);break;
  case 'pause':running=courseMode&&engine.trial.status!=='running'?false:!m.paused;engine.setCommand(0,0);break;
  case 'reset':engine.reset();running=!courseMode;break;
  case 'startTrial':engine.start();running=!m.paused;deadline=performance.now();break;
  case 'action':await engine.action(m.action);break;
  case 'assist':engine.assist(m.kind);break;
  case 'getRun':result=engine.getRun();break;
  case 'step':if(running)throw new Error('Pause before single stepping.');await step();break;
  case 'object':{if(courseMode)throw new Error('Use the marked challenge objects.');if(!['ball','block','ramp'].includes(m.kind))throw new Error('Unknown prop.');const q=engine.data.qpos,yaw=Math.atan2(2*(q[3]*q[6]+q[4]*q[5]),1-2*(q[5]*q[5]+q[6]*q[6]));engine.resetProp(m.kind,[q[0]+.35*Math.cos(yaw),q[1]+.35*Math.sin(yaw),m.kind==='ramp'?.01:.12]);mj.mj_forward(model,engine.data);break;}
  case 'perturb':if(courseMode)throw new Error('Push testing is available in Free Playground.');engine.data.qvel[3]+=4;engine.data.qvel[1]+=.3;break;
  default:throw new Error('Unknown simulation command.');
 }if(m.type!=='command')sendState(true);reply(m.id,null,result);}catch(error){reply(m.id,error.message||String(error));}
}
async function tick(){if(disposed)return;try{const batch=messages.splice(0);for(const m of batch)await handle(m);if(running){await step();deadline=Math.max(deadline+20,performance.now()-100);}else deadline=performance.now();}catch(e){running=false;sendState(true);self.postMessage({type:'error',error:e.message||String(e)});}timer=setTimeout(tick,running?Math.max(0,deadline-performance.now()):10);}
async function init(){
 ort.env.wasm.wasmPaths={wasm:ortWasmUrl};ort.env.wasm.numThreads=1;
 const [runtime,xml,meta]=await Promise.all([loadMujoco({locateFile:p=>p.endsWith('.wasm')?mujocoWasmUrl:p}),fetchOk('/robot/mjlab/scene_ducklab'+(rollerMode?'_rollers':'')+'.xml','text'),fetchOk('/robot/mjlab/physics-assets'+(rollerMode?'_rollers':'')+'.json','json')]);mj=runtime;progress('MuJoCo WebAssembly');vfs=new mj.MjVFS();
 await Promise.all(meta.meshFiles.map(async f=>{vfs.addBuffer('assets/'+f,new Uint8Array(await fetchOk('/robot/mjlab/'+(meta.meshDir||'meshes')+'/'+f)));progress('Collision mesh · '+f);}));
 model=mj.MjModel.from_xml_string(courseMode?withCourse(xml):xml,vfs);await ensurePolicy(rollerMode?'drive':'walk');await ensurePolicy('stand');engine=new PhysicsEngine(mj,model,ort,ensurePolicy,{course:courseMode,rollers:rollerMode});extraJoints=[];if(rollerMode)for(let i=0;i<model.njnt;i++){const j=model.jnt(i);if(j.name&&!JOINT_NAMES.includes(j.name)&&model.jnt_type[i]===3)extraJoints.push({name:j.name,adr:j.qposadr});}running=!courseMode;sendState(true);self.postMessage({type:'ready'});deadline=performance.now();tick();
}
self.onmessage=({data:m})=>{
 if(m.type==='init'&&!initializing){initializing=true;courseMode=m.mode==='course';rollerMode=m.mode==='rollers';init().catch(e=>self.postMessage({type:'error',error:e.message||String(e)}));return;}
 if(m.type==='dispose'){disposed=true;clearTimeout(timer);self.close();return;}
 if(!engine){reply(m.id,'Simulation is loading.');return;}
 // Apply all inputs between ticks, including inputs arriving while inference awaits.
 if(m.type==='command'&&messages.at(-1)?.type==='command')messages[messages.length-1]=m;
 else if(messages.length<128)messages.push(m);else reply(m.id,'Too many pending inputs.');
};
