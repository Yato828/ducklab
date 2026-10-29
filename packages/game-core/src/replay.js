import {COURSE} from './course.js';
import {GAMEPLAY_CONFIG} from './version.js';
const actions=['sit','stand','roll','kickL','kickR','groundpick','recover'];
export const REPLAY_LIMITS={bytes:1_500_000,events:20_000,ticks:45_000};
export function validateRun(value){
 const fail=()=>{throw new Error('Invalid or incompatible run log.');};
 if(!value||typeof value!=='object'||Array.isArray(value))fail();
 if(Object.keys(value).some(k=>!['protocol','courseId','configId','ticks','events'].includes(k)))fail();
 if(value.protocol!==1||value.courseId!==COURSE.id||value.configId!==GAMEPLAY_CONFIG||!Number.isSafeInteger(value.ticks)||value.ticks<1||value.ticks>REPLAY_LIMITS.ticks||!Array.isArray(value.events)||value.events.length>REPLAY_LIMITS.events)fail();
 let previous=-1,countAtStep=0;
 for(const e of value.events){
  if(!e||typeof e!=='object'||!Number.isSafeInteger(e.step)||e.step<0||e.step>=value.ticks||e.step<previous)fail();
  countAtStep=e.step===previous?countAtStep+1:1;if(countAtStep>24)fail();previous=e.step;
  const keys=e.type==='command'?['step','type','vx','wz']:e.type==='action'?['step','type','action']:e.type==='assist'?['step','type','kind']:[];
  if(!keys.length||Object.keys(e).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(e,k)))fail();
  if(e.type==='command'&&(!Number.isFinite(e.vx)||!Number.isFinite(e.wz)||e.vx<-.2||e.vx>.25||Math.abs(e.wz)>1||Math.abs(e.vx*1000-Math.round(e.vx*1000))>1e-7||Math.abs(e.wz*1000-Math.round(e.wz*1000))>1e-7))fail();
  if(e.type==='action'&&!actions.includes(e.action))fail();
  if(e.type==='assist'&&!['ball','block','rescue'].includes(e.kind))fail();
 }
 return value;
}
export async function applyInput(engine,event){if(event.type==='command')engine.setCommand(event.vx,event.wz);else if(event.type==='action')await engine.action(event.action);else if(event.type==='assist')engine.assist(event.kind);else throw new Error('Unknown input.');}
export async function replayRun(engine,run){
 validateRun(run);engine.start();let index=0;
 for(let tick=0;tick<run.ticks;tick++){
  while(index<run.events.length&&run.events[index].step===tick)await applyInput(engine,run.events[index++]);
  await engine.tick();
  if(engine.trial.status==='finished'){
   if(tick+1!==run.ticks||index!==run.events.length)throw new Error('Input after finish.');
   const trial=engine.trial.snapshot();return {ticks:engine.steps,milliseconds:engine.steps*20+trial.penalties*1000,penalties:trial.penalties,stages:trial.checkpoint,splits:trial.splits,courseId:run.courseId,configId:run.configId};
  }
 }
 throw new Error('Replay did not complete all objectives and cross the finish.');
}
