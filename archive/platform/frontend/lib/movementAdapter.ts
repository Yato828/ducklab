import type { MovementAdapter, MovementInstruction } from '../../../../packages/movement-dsl/src/index';
import type { Simulation, RobotAction } from '../../../../packages/simulation-core/src/index';
function delay(signal:AbortSignal){return new Promise<void>((resolve,reject)=>{signal.throwIfAborted();const abort=()=>{clearTimeout(timer);reject(signal.reason);};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},25);signal.addEventListener('abort',abort,{once:true});});}
export function movementAdapter(sim:Simulation):MovementAdapter {
  return {
    getState:()=>{const state=sim.getState();return {upright:state.position[2]>.08&&!['fallen','recover'].includes(state.mode),fallen:['fallen','recover'].includes(state.mode)};},
    stop:()=>sim.setCommand(0,0),
    async execute(instruction:MovementInstruction,signal:AbortSignal){
      signal.throwIfAborted();if(sim.getState().paused)throw new Error('Resume the physics simulation before running a movement.');
      const start=sim.getState();
      const ensure=()=>{signal.throwIfAborted();const state=sim.getState();if(state.error)throw new Error(state.error);if(state.paused)throw new Error('Simulation paused. Movement execution stopped.');return state;};
      try {
        if(instruction.kind==='walk'){
          const distance=Number(instruction.args.distance),speed=Number(instruction.args.speed);if(distance===0)return;
          if(start.mode!=='walk')throw new Error('Stand up and finish the active movement before walking.');
          sim.setCommand(Math.sign(distance)*speed,0);
          while(true){const state=ensure();const dx=state.position[0]-start.position[0],dy=state.position[1]-start.position[1];const progress=(dx*Math.cos(start.yaw)+dy*Math.sin(start.yaw))*Math.sign(distance);if(progress>=Math.abs(distance))break;if(['fallen','recover'].includes(state.mode))throw new Error('The robot fell before reaching the target. Let it recover and retry.');await delay(signal);}
        }else if(instruction.kind==='turn'){
          const radians=Number(instruction.args.degrees)*Math.PI/180;if(!radians)return;if(start.mode!=='walk')throw new Error('Stand up before turning.');let previous=start.yaw,total=0;
          sim.setCommand(0,Math.sign(radians)*.8);
          while(total*Math.sign(radians)<Math.abs(radians)){const state=ensure();total+=Math.atan2(Math.sin(state.yaw-previous),Math.cos(state.yaw-previous));previous=state.yaw;await delay(signal);}
        }else if(instruction.kind==='wait'){
          sim.setCommand(0,0);while(ensure().simTime-start.simTime<Number(instruction.args.seconds))await delay(signal);
        }else{
          const actions:Record<string,RobotAction>={sit:'sit',stand:'stand',kick:instruction.args.side==='left'?'kickL':'kickR',roll:'roll',recover:'recover',groundPick:'groundpick'};
          await sim.action(actions[instruction.kind]);
          while(true){const state=ensure(),elapsed=state.simTime-start.simTime;if(instruction.kind==='sit'?elapsed>=2&&state.mode==='sitting':elapsed>=.2&&state.mode==='walk')break;await delay(signal);}
        }
      }finally{sim.setCommand(0,0);}
    }
  };
}
