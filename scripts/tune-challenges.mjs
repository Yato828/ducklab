import {createHeadless} from '../packages/simulation-core/node/runtime.mjs';
const r=await createHeadless(),e=r.engine;
for(const offset of [.02,.05,.08,.10])for(const side of [-.055,0,.055])for(const action of ['kickL','kickR']){
 e.start();e.data.qpos.set([2.77-offset,side,.12],0);e.trial.next=1;e.mj.mj_forward(e.model,e.data);
 for(let i=0;i<75;i++)await e.tick();let before=Array.from(e.data.qpos.subarray(e.objects.ball.q,e.objects.ball.q+3));
 await e.action(action);for(let i=0;i<100;i++)await e.tick();let after=Array.from(e.data.qpos.subarray(e.objects.ball.q,e.objects.ball.q+3));
 console.log({offset,side,action,kicked:e.trial.kicked,goal:e.trial.completed.football,delta:after.map((x,i)=>(x-before[i]).toFixed(3)),after:after.map(x=>x.toFixed(3))});
}
await r.dispose();
