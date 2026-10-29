import {verifyIsolated} from './verification.mjs';
import {COURSE} from '../../../packages/game-core/src/course.js';import {GAMEPLAY_CONFIG} from '../../../packages/game-core/src/version.js';
export function startVerifier(store,{intervalMs=500}={}){
 const abort=new AbortController();let timer,active=Promise.resolve(),stopped=false;
 async function work(){
  const db=await store.pool.connect();let locked=false;
  try{
   // One active verifier across all service instances sharing this database.
   locked=(await db.query('SELECT pg_try_advisory_lock(828003) AS locked')).rows[0].locked;if(!locked)return;
   await db.query("UPDATE ducklab_runs SET status=CASE WHEN attempts<2 THEN 'queued' ELSE 'rejected' END,error='Interrupted verification; retry limit reached.',milliseconds=NULL WHERE status='verifying' AND started_at<now()-interval '1 minute'");
   const {rows}=await db.query("UPDATE ducklab_runs SET status='verifying',attempts=attempts+1,started_at=now(),error=NULL WHERE id=(SELECT id FROM ducklab_runs WHERE status='queued' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING id,replay");
   const job=rows[0];if(!job)return;
   try{const result=await verifyIsolated(job.replay,{signal:abort.signal});if(result.courseId!==COURSE.id||result.configId!==GAMEPLAY_CONFIG||result.stages!==6||!Number.isSafeInteger(result.milliseconds)||result.milliseconds<=0)throw new Error('Invalid verification result.');await db.query("UPDATE ducklab_runs SET status='verified',result=$2,milliseconds=$3,verified_at=clock_timestamp(),replay=NULL WHERE id=$1 AND status='verifying'",[job.id,result,result.milliseconds]);}
   catch(e){if(stopped)await db.query("UPDATE ducklab_runs SET status='queued',error=NULL WHERE id=$1",[job.id]);else await db.query("UPDATE ducklab_runs SET status='rejected',error=$2,replay=NULL WHERE id=$1",[job.id,e.message.slice(0,180)]);}
  }finally{if(locked)await db.query('SELECT pg_advisory_unlock(828003)').catch(()=>{});db.release();}
 }
 const loop=()=>{if(stopped)return;active=work().catch(()=>{}).finally(()=>{if(!stopped)timer=setTimeout(loop,intervalMs);});};loop();
 return async()=>{stopped=true;clearTimeout(timer);abort.abort();await active;};
}
