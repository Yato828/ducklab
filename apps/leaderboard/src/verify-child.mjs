import {createHeadless} from '../../../packages/simulation-core/node/runtime.mjs';
import {replayRun} from '../../../packages/game-core/src/replay.js';
process.once('message',async run=>{let runtime;try{runtime=await createHeadless({record:false});const result=await replayRun(runtime.engine,run);process.send({ok:true,result});}catch{process.send({ok:false,error:'The authoritative replay did not complete this course.'});}finally{await runtime?.dispose();process.disconnect();}});
