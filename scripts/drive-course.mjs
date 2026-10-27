import fs from 'node:fs/promises';
import {createHeadless} from '../packages/simulation-core/node/runtime.mjs';
export function yaw(q){return Math.atan2(2*(q[3]*q[6]+q[4]*q[5]),1-2*(q[5]*q[5]+q[6]*q[6]));}
export async function drive(e,{verbose=false}={}){
 const trace=[];let ticks=0;
 async function tick(){await e.tick();ticks++;if(ticks%50===0)trace.push({step:e.steps,p:Array.from(e.data.qpos.subarray(0,3)),yaw:yaw(e.data.qpos),stage:e.trial.next,completed:{...e.trial.completed},ball:Array.from(e.data.qpos.subarray(e.objects.ball.q,e.objects.ball.q+3)),block:Array.from(e.data.qpos.subarray(e.objects.block.q,e.objects.block.q+3))});}
 async function wait(n){e.setCommand(0,0);for(let i=0;i<n;i++)await tick();}
 async function go(x,y,tol=.035){let count=0;while(e.trial.status!=='finished'&&Math.hypot(e.data.qpos[0]-x,e.data.qpos[1]-y)>tol&&count++<2300){const q=e.data.qpos,a=Math.atan2(y-q[1],x-q[0]),err=Math.atan2(Math.sin(a-yaw(q)),Math.cos(a-yaw(q)));e.setCommand(err>.7?0:.25,Math.max(-1,Math.min(1,err*3)));await tick();}e.setCommand(0,0);if(verbose)console.log('at',x,y,'t',e.steps*.02,'p',Array.from(e.data.qpos.subarray(0,3)),'yaw',yaw(e.data.qpos),'stage',e.trial.next);if(count>=2300)throw new Error('Navigation stuck '+x+','+y);}
 async function face(angle){for(let i=0;i<900;i++){const err=Math.atan2(Math.sin(angle-yaw(e.data.qpos)),Math.cos(angle-yaw(e.data.qpos)));if(Math.abs(err)<.025)break;e.setCommand(err<-.3?.20:0,Math.max(-1,Math.min(1,err*5)));await tick();}await wait(40);}
 e.start();await go(.35,.28);await go(.94,.28);await go(1.06,-.30);await go(1.63,-.30);await go(2.2,0);await go(2.66,0);await face(0);await wait(50);await e.action('kickL');await wait(150);
 if(verbose)console.log('football',e.trial.snapshot(),Array.from(e.data.qpos.subarray(e.objects.ball.q,e.objects.ball.q+3)));
 if(!e.trial.completed.football)throw new Error('Football did not score');
 await go(3.0,-.62);await go(3.8,-.62);await go(4.2,0);await go(4.5,0);await face(0);await go(4.95,0,.02);await wait(90);
 if(verbose)console.log('box',e.trial.snapshot(),Array.from(e.data.qpos.subarray(e.objects.block.q,e.objects.block.q+3)));
 if(!e.trial.completed.box)throw new Error('Box did not settle');
 await go(5.4,-.42);await go(6.1,0);await go(6.6,0);await wait(40);await e.action('sit');await wait(190);
 if(!e.trial.completed.sit)throw new Error('Sit did not complete');await e.action('stand');await wait(125);
 await go(7.7,0);await go(8.05,0);await face(0);await e.action('roll');await wait(200);
 if(verbose)console.log('roll',e.trial.snapshot(),Array.from(e.data.qpos.subarray(0,3)));
 if(!e.trial.completed.roll)throw new Error('Roll did not complete');
 await go(9.65,0);await go(10.5,0);await go(11.13,.1);await face(Math.PI/2);await go(11.15,1.55);
 if(e.trial.status!=='finished')throw new Error('Finish incomplete');return {trace,run:e.getRun(),trial:e.trial.snapshot(),qpos:Array.from(e.data.qpos)};
}
if(process.argv[1]?.endsWith('drive-course.mjs')){const r=await createHeadless();try{const result=await drive(r.engine,{verbose:true});await fs.writeFile('tests/artifacts/chaos-course.json',JSON.stringify(result));console.log('COMPLETE',result.trial);}finally{await r.dispose();}}
