/* Shared browser/authoritative replay engine. Official Apache-2.0 controller conventions. */
import {JOINT_NAMES,DEFAULT_POSE,CTRL_DT,DECIMATION} from '../upstream/constants.js';
import {buildObservation,projectedGravity} from './observation.js';
import {COURSE} from '../../game-core/src/course.js';
import {TimeTrial} from '../../game-core/src/trial.js';
import {GAMEPLAY_CONFIG} from '../../game-core/src/version.js';
export const ACTIONS=['sit','stand','roll','kickL','kickR','groundpick','recover'];
export class PhysicsEngine {
 constructor(mj,model,ort,ensurePolicy,{course=false,record=true,rollers=false}={}){
  Object.assign(this,{mj,model,ort,ensurePolicy,course,record,rollers});if(course&&rollers)throw new Error('Rollers are only available in Free Playground.');this.data=new mj.MjData(model);this.trial=new TimeTrial();
  this.qa=JOINT_NAMES.map(n=>model.jnt(n).qposadr);this.va=JOINT_NAMES.map(n=>model.jnt(n).dofadr);this.gyro=model.sensor('imu_ang_vel').adr;this.trunk=model.body('trunk_base').id;this.key=mj.mj_name2id(model,mj.mjtObj.mjOBJ_KEY.value,'STAND');
  this.objects=Object.fromEntries(['ball','block','ramp'].map(k=>[k,{q:model.jnt('ducklab_'+k+'_free').qposadr,v:model.jnt('ducklab_'+k+'_free').dofadr,body:model.body('ducklab_'+k).id}]));
  this.locks=course?COURSE.locks.map(g=>({...g,id:g.id,mocap:model.body('lock_'+g.id).mocapid})):[];
  this.last=new Float32Array(14);this.obs=new Float32Array(61);this.reset();
 }
 reset(){this.mj.mj_resetDataKeyframe(this.model,this.data,this.key);this.last.fill(0);this.vx=0;this.wz=0;this.mode='walk';this.modeSteps=0;this.sitFlag=0;this.sitTarget=0;this.fallSteps=0;this.uprightSteps=0;this.steps=0;this.events=[];this.trial.reset();this.warning='';this.inferenceMs=0;this.physicsMs=0;
  if(this.course)for(const [kind,pos] of Object.entries(COURSE.props))this.resetProp(kind,pos);
  for(const g of this.locks)this.data.mocap_pos.set([g.x,0,.19],g.mocap*3);this.mj.mj_forward(this.model,this.data);
 }
 start(){if(!this.course)throw new Error('Time Trial only.');this.reset();this.trial.start(0,Array.from(this.data.qpos.subarray(0,3)));}
 log(event){if(this.record&&this.course&&this.trial.status==='running'){if(this.events.length>=20000)throw new Error('Run input limit reached. Restart the run.');this.events.push({step:this.steps,...event});}}
 setCommand(vx,wz){if(!Number.isFinite(vx)||!Number.isFinite(wz))throw new Error('Invalid command.');vx=Math.round(Math.max(this.rollers?-.5:-.2,Math.min(this.rollers?.6:.25,vx))*1000)/1000;const turnLimit=this.rollers?.3:1;wz=Math.round(Math.max(-turnLimit,Math.min(turnLimit,wz))*1000)/1000;if(vx!==this.vx||wz!==this.wz){this.log({type:'command',vx,wz});this.vx=vx;this.wz=wz;}}
 async action(action){
  if(this.rollers? action!=='crouch':!ACTIONS.includes(action))throw new Error('Unsupported official action.');
  if(this.course&&this.trial.status!=='running')throw new Error('Start the run first.');
  if(['roll','kickL','kickR','groundpick','fallen','recover','crouch'].includes(this.mode))throw new Error('Wait for the active skill to finish.');
  await this.ensurePolicy(action==='sit'||action==='stand'?'sitstand':action==='recover'?'stand':action);
  this.log({type:'action',action});
  if(action==='sit'||action==='stand'){this.mode='sitstand';this.sitTarget=action==='sit'?1:0;this.sitFlag=0;this.last.fill(0);}
  else{this.mode=action;if(action==='recover'){this.uprightSteps=0;this.last.fill(0);}}
  this.modeSteps=0;this.vx=0;this.wz=0;
 }
 resetProp(kind,pos){const o=this.objects[kind];this.data.qpos.set([...pos,1,0,0,0],o.q);this.data.qvel.fill(0,o.v,o.v+6);}
 assist(kind){if(!this.course)throw new Error('Course assistance only.');this.trial.assist(kind,this.steps);this.log({type:'assist',kind});
  if(kind==='rescue'){const p=COURSE.stages[Math.min(this.trial.next,5)].start;this.data.qpos.set([...p,1,0,0,0],0);for(let i=0;i<14;i++)this.data.qpos[this.qa[i]]=DEFAULT_POSE[i];this.data.qvel.fill(0,0,20);this.last.fill(0);this.mode='walk';this.modeSteps=0;this.fallSteps=0;this.vx=0;this.wz=0;this.trial.previous=p.slice(0,2);}
  else this.resetProp(kind,COURSE.props[kind]);this.mj.mj_forward(this.model,this.data);
 }
 gravity(){return projectedGravity(this.data.body(this.trunk).xquat);}
 async tick(){
  if(this.course&&this.trial.status!=='running')return;
  if(this.course&&this.steps>=45000)throw new Error('Run limit: 15 simulation minutes. Restart to try again.');
  const {data:d,model:m,mj}=this,activeMode=this.mode;
  if(this.mode!=='fallen'){
   const command=new Float32Array(13);if(this.mode==='walk'){command[0]=this.vx;command[2]=this.wz;}if(this.mode==='sitstand')command[0]=this.sitFlag;if(this.mode==='groundpick'||this.mode==='crouch'){const phase=this.modeSteps*CTRL_DT/(this.mode==='crouch'?5:4);command[0]=Math.cos(2*Math.PI*phase);command[1]=Math.sin(2*Math.PI*phase);}
   const session=await this.ensurePolicy(this.mode==='recover'?'stand':this.rollers&&this.mode==='walk'?'drive':this.mode);
   const obs=buildObservation({gyro:d.sensordata.subarray(this.gyro,this.gyro+3),quaternion:d.body(this.trunk).xquat,positions:this.qa.map(a=>d.qpos[a]),velocities:this.va.map(a=>d.qvel[a]),lastAction:this.last,command},this.obs);
   const t=performance.now(),out=await session.run({[session.inputNames[0]]:new this.ort.Tensor('float32',obs,[1,61])});this.inferenceMs=performance.now()-t;const act=out[session.outputNames[0]].data;
   if(act.length!==14||!Array.from(act).every(Number.isFinite))throw new Error('Invalid policy output.');
   for(let i=0;i<14;i++){const target=DEFAULT_POSE[i]+act[i];if(target<m.actuator_ctrlrange[i*2]||target>m.actuator_ctrlrange[i*2+1])throw new Error('Unsafe policy target.');d.ctrl[i]=target;this.last[i]=act[i];}
  }
  const t=performance.now();let kickContact=false;
  for(let n=0;n<DECIMATION;n++){mj.mj_step(m,d);if(activeMode==='kickL'||activeMode==='kickR')for(let i=0;i<d.ncon;i++){const c=d.contact.get(i),a=m.geom_bodyid[c.geom1],b=m.geom_bodyid[c.geom2],ball=this.objects.ball.body;if((a===ball&&b>0&&b<ball)||(b===ball&&a>0&&a<ball))kickContact=true;}}
  this.physicsMs=performance.now()-t;this.steps++;this.modeSteps++;
  if(!Array.from(d.qpos).every(Number.isFinite))throw new Error('Non-finite physical state.');
  const gz=this.gravity()[2];
  if(this.course){const b=this.objects.block;this.trial.update(this.steps*CTRL_DT,Array.from(d.qpos.subarray(0,3)),{ball:Array.from(d.qpos.subarray(this.objects.ball.q,this.objects.ball.q+3)),block:Array.from(d.qpos.subarray(b.q,b.q+3)),blockSpeed:Math.hypot(...d.qvel.subarray(b.v,b.v+3)),robotSpeed:Math.hypot(...d.qvel.subarray(0,3)),gravityZ:gz,mode:activeMode,kickContact});for(const g of this.locks)this.data.mocap_pos[g.mocap*3+2]=this.trial.completed[g.id]?1.0:.19;}
  if(this.mode==='walk'){this.fallSteps=gz>-.5?this.fallSteps+1:0;if(this.fallSteps>=10){if(this.rollers)throw new Error('Roller duck fell. Reset to skate again.');this.mode='fallen';this.modeSteps=0;this.vx=0;this.wz=0;}}
  else if(this.mode==='fallen'&&this.modeSteps>=15){this.mode='recover';this.modeSteps=0;this.uprightSteps=0;this.last.fill(0);}
  else if(this.mode==='recover'){this.uprightSteps=gz<-.85?this.uprightSteps+1:0;if(this.uprightSteps>=50){this.mode='walk';this.modeSteps=0;this.last.fill(0);}else if(this.modeSteps>=300)throw new Error('Recovery timed out. Use Rescue (+30s) or restart.');}
  else if(this.mode==='sitstand'){if(this.sitTarget&&this.modeSteps>=40)this.sitFlag=1;if(!this.sitTarget&&this.modeSteps>=100){this.mode='walk';this.modeSteps=0;this.last.fill(0);}}
  else if((this.mode==='kickL'||this.mode==='kickR')&&this.modeSteps>=25){this.mode='walk';this.modeSteps=0;}
  else if(this.mode==='crouch'&&this.modeSteps>=175){this.mode='walk';this.modeSteps=0;}
  else if(this.mode==='groundpick'&&this.modeSteps>=140){this.mode='walk';this.modeSteps=0;}
  else if(this.mode==='roll'&&this.modeSteps>=150){this.mode=gz<-.85?'walk':'recover';this.modeSteps=0;this.last.fill(0);}
 }
 getRun(){if(this.trial.status!=='finished')throw new Error('Finish all stages before submitting.');return {protocol:1,courseId:COURSE.id,configId:GAMEPLAY_CONFIG,ticks:this.steps,events:this.events.map(e=>({...e}))};}
 dispose(){this.data.delete();}
}
