import { COURSE } from './course.js';
import {GAMEPLAY_CONFIG} from './version.js';
export function crossedGate(before, after, gate) {
  const n=gate.normal,c=gate.center;
  const a=(before[0]-c[0])*n[0]+(before[1]-c[1])*n[1];
  const b=(after[0]-c[0])*n[0]+(after[1]-c[1])*n[1];
  if(a>=0||b<0||b-a<1e-9)return false;
  const t=-a/(b-a),x=before[0]+(after[0]-before[0])*t-c[0],y=before[1]+(after[1]-before[1])*t-c[1];
  return Math.abs(-x*n[1]+y*n[0])<=gate.width/2;
}
export class TimeTrial {
 /** @type {Record<string, boolean>} */
 completed={};
 /** @type {Array<{kind:string,step:number,seconds:number}>} */
 assists=[];
 status='ready'; next=0; elapsed=0; raw=0; penalties=0; startedAt=0; lastTime=0; hold=0;
 constructor(course=COURSE){this.course=course;this.reset();}
 reset(){this.status='ready';this.next=0;this.elapsed=0;this.raw=0;this.penalties=0;this.assists=[];this.startedAt=0;this.lastTime=0;this.previous=null;this.previousBall=null;this.splits=[];this.completed={};this.hold=0;this.rolled=false;this.kicked=false;this.event=null;return this.snapshot();}
 start(simTime,position){if(this.status!=='ready')throw new Error('Restart before starting a new run.');if(!Number.isFinite(simTime))throw new Error('Invalid simulation time.');this.status='running';this.startedAt=simTime;this.lastTime=simTime;this.previous=position.slice(0,2);return this.snapshot();}
 assist(kind,step){if(this.status!=='running'||!Object.hasOwn(this.course.assistance,kind))throw new Error('Assistance is unavailable.');if((kind==='ball'&&this.next!==1)||(kind==='block'&&this.next!==2))throw new Error('Reset this object in its challenge room.');this.penalties+=this.course.assistance[kind];this.assists.push({kind,step,seconds:this.course.assistance[kind]});if(kind==='ball'){this.previousBall=null;this.kicked=false;}this.hold=0;this.rolled=false;this.elapsed=this.raw+this.penalties;}
 update(simTime,position,physical={}){
  if(this.status!=='running')return this.snapshot();
  if(!Number.isFinite(simTime)||simTime<this.lastTime||!position.slice(0,3).every(Number.isFinite))throw new Error('Invalid physical state for time trial.');
  const advancing=simTime>this.lastTime;this.lastTime=simTime;this.raw=simTime-this.startedAt;this.elapsed=this.raw+this.penalties;
  const stage=this.course.stages?.[this.next],c=this.course;
  const complete=(id,message)=>{this.completed[id]=true;this.event={id,message,at:this.raw};this.hold=0;};
  if(stage&&!this.completed[stage.id]&&advancing){
   if(stage.id==='football'&&physical.ball){
    if(physical.kickContact)this.kicked=true;
    const ball=physical.ball,g=c.football.goal;
    if(this.kicked&&this.previousBall&&ball[2]<c.football.height-c.football.radius&&ball[2]>=0&&crossedGate(this.previousBall,ball,{...g,width:g.width-2*c.football.radius}))complete('football','GOAL!');
   }
   if(stage.id==='box'&&physical.block){const p=physical.block,inside=Math.abs(p[0]-c.box.target[0])<=c.box.targetHalf-Math.SQRT2*c.box.half&&Math.abs(p[1]-c.box.target[1])<=c.box.targetHalf-Math.SQRT2*c.box.half&&p[2]<.09;this.hold=inside&&(physical.blockSpeed??Infinity)<.10?this.hold+1:0;if(this.hold>=c.box.holdTicks)complete('box','BOX LOCKED IN');}
   if(stage.id==='sit'){const inside=Math.hypot(position[0]-c.sit.center[0],position[1]-c.sit.center[1])<=c.sit.radius-.07;const seated=physical.mode==='sitstand'&&inside&&position[2]<c.sit.maxHeight&&position[2]>.035&&(physical.gravityZ??0)<-.7&&(physical.robotSpeed??Infinity)<.09;this.hold=seated?this.hold+1:0;if(this.hold>=c.sit.holdTicks)complete('sit','NICE SEAT. NOW STAND.');}
   if(stage.id==='roll'){const inside=Math.abs(position[0]-c.roll.center[0])<c.roll.half[0]&&Math.abs(position[1]-c.roll.center[1])<c.roll.half[1];if(!inside){this.rolled=false;this.hold=0;}else{if(physical.mode==='roll'&&(physical.gravityZ??-1)>-.15)this.rolled=true;this.hold=this.rolled&&(physical.gravityZ??0)<-.88&&position[2]>.095?this.hold+1:0;if(this.hold>=c.roll.holdTicks)complete('roll','CONTROLLED CHAOS');}}
  }
  const gate=c.checkpoints[this.next]??c.finish;
  const unlocked=!stage||!['football','box','sit','roll'].includes(stage.id)||this.completed[stage.id];
  if(unlocked&&position[2]<.35&&this.previous&&crossedGate(this.previous,position,gate)){
   if(this.next<c.checkpoints.length){this.completed[gate.id]=true;this.splits.push(this.elapsed);this.next++;this.hold=0;this.rolled=false;}
   else this.status='finished';
  }
  this.previous=position.slice(0,2);if(physical.ball)this.previousBall=physical.ball.slice(0,3);return this.snapshot();
 }
 snapshot(){return {courseId:this.course.id,configId:GAMEPLAY_CONFIG,status:this.status,elapsed:this.elapsed,raw:this.raw,penalties:this.penalties,assists:[...this.assists],checkpoint:this.next,total:this.course.checkpoints.length,splits:[...this.splits],completed:{...this.completed},hold:this.hold,event:this.event};}
}
export function formatTime(seconds){const value=Number.isFinite(seconds)&&seconds>=0?Math.floor((seconds+1e-7)*100):0;const minutes=Math.floor(value/6000),secs=Math.floor(value/100)%60,hundredths=value%100;return `${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}.${String(hundredths).padStart(2,'0')}`;}
export function readBest(storage,courseId=String(COURSE.id),configId=GAMEPLAY_CONFIG){try{const record=JSON.parse(storage.getItem(`ducklab.best.${courseId}.${configId}`)||'null');return record&&record.courseId===courseId&&record.configId===configId&&Number.isSafeInteger(record.milliseconds)&&record.milliseconds>0&&record.milliseconds<Number.MAX_SAFE_INTEGER?record:null;}catch{return null;}}
export function recordBest(storage,seconds,courseId=String(COURSE.id),configId=GAMEPLAY_CONFIG){const milliseconds=Math.round(seconds*1000);if(!Number.isSafeInteger(milliseconds)||milliseconds<=0||milliseconds>=Number.MAX_SAFE_INTEGER)throw new Error('Invalid completed run time.');const previous=readBest(storage,courseId,configId),isNew=!previous||milliseconds<previous.milliseconds;const record=isNew?{courseId,configId,milliseconds,completedAt:new Date().toISOString()}:previous;let saved=true;if(isNew)try{storage.setItem(`ducklab.best.${courseId}.${configId}`,JSON.stringify(record));}catch{saved=false;}return {record,isNew,saved};}
