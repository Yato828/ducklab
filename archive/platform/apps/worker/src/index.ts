import 'dotenv/config';
import pg from 'pg';
import { Queue } from 'bullmq';
import { readConfig } from '../../api/src/config.js';
import { reconcilePurchase } from '../../api/src/reconcile.js';
import { MarketplaceChain } from '../../../packages/solana/src/marketplace.js';
import { TRAINING_QUEUE,validateTrainingRequest } from '../../../packages/shared/training.js';
const config=readConfig();
if(!config.databaseUrl)throw new Error('DATABASE_URL is required for reconciliation and queue recovery.');
const pool=new pg.Pool({connectionString:config.databaseUrl,max:3});
const chain=config.chain?new MarketplaceChain(config.chain):undefined;
const redis=process.env.REDIS_URL?new URL(process.env.REDIS_URL):undefined;
const queue=redis?new Queue(TRAINING_QUEUE,{connection:{host:redis.hostname,port:Number(redis.port||6379),username:redis.username||undefined,password:redis.password||undefined,db:Number(redis.pathname.slice(1)||0),...(redis.protocol==='rediss:'?{tls:{}}:{})}}):undefined;
let stopping=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true;});
while(!stopping){
  try{
    if(chain){
      const {rows}=await pool.query(`SELECT id FROM purchases WHERE status IN('submitted','pending') AND next_attempt_at<=now() ORDER BY created_at LIMIT 20`);
      for(const purchase of rows){
        try{await reconcilePurchase(pool,chain,purchase.id);console.log(JSON.stringify({event:'purchase.finalized',purchaseId:purchase.id}));}
        catch{await pool.query(`UPDATE purchases SET status='pending',attempts=attempts+1,next_attempt_at=now()+LEAST(3600,power(2,LEAST(attempts,11))::int)*interval '1 second',last_error='Finalized receipt verification pending; inspect RPC or transaction.' WHERE id=$1 AND status<>'finalized'`,[purchase.id]);}
      }
    }
    if(queue&&config.trainingConfigured){
      const {rows}=await pool.query(`SELECT * FROM training_jobs WHERE status='queued' ORDER BY created_at LIMIT 20`);
      for(const job of rows){
        const existing=await queue.getJob(job.id);if(existing)continue;
        const input=validateTrainingRequest(job.configuration);
        await queue.add(input.task,{...input,jobId:job.id,userId:job.user_id},{jobId:job.id,attempts:1,removeOnComplete:false,removeOnFail:false});
        console.log(JSON.stringify({event:'training.delivered',jobId:job.id}));
      }
    }
    await pool.query('DELETE FROM auth_challenges WHERE expires_at<now()-interval \'24 hours\'');
    await pool.query('DELETE FROM authentication_sessions WHERE expires_at<now()');
  }catch(error){console.error(JSON.stringify({event:'worker.error',name:error instanceof Error?error.name:'UnknownError'}));}
  await new Promise(resolve=>setTimeout(resolve,5000));
}
await queue?.close();await pool.end();
