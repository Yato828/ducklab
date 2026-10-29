import pg from 'pg';import fs from 'node:fs/promises';import {createHash,randomUUID} from 'node:crypto';
import {COURSE} from '../../../packages/game-core/src/course.js';import {GAMEPLAY_CONFIG} from '../../../packages/game-core/src/version.js';
export function apiError(status,message){return Object.assign(new Error(message),{status});}
export class RunStore {
 constructor(connectionString){this.pool=new pg.Pool({connectionString,max:5,connectionTimeoutMillis:5000,statement_timeout:5000});this.pool.on('error',()=>{});}
 async init(){await this.pool.query(await fs.readFile(new URL('./schema.sql',import.meta.url),'utf8'));}
 async submit(nickname,run,identity){
  const db=await this.pool.connect();try{await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(828002)');
   // Persistent quotas apply even to duplicate submissions and survive API restarts.
   await db.query("DELETE FROM ducklab_rate_limits WHERE window_start < now() - interval '1 day'");
   const rate=await db.query("INSERT INTO ducklab_rate_limits(identity,window_start,submissions) VALUES($1,date_bin(interval '10 minutes',now(),'2020-01-01'::timestamptz),1) ON CONFLICT(identity,window_start) DO UPDATE SET submissions=ducklab_rate_limits.submissions+1 RETURNING submissions",[identity]);
   const daily=await db.query('SELECT sum(submissions)::int AS n FROM ducklab_rate_limits WHERE identity=$1',[identity]);
   if(rate.rows[0].submissions>3||daily.rows[0].n>30){await db.query('COMMIT');throw apiError(429,'Submission limit reached. Try again in ten minutes.');}
   const digest=createHash('sha256').update(JSON.stringify(run)).digest('hex');const existing=await db.query('SELECT id,status FROM ducklab_runs WHERE digest=$1',[digest]);if(existing.rowCount){await db.query('COMMIT');return existing.rows[0];}
   const pending=await db.query("SELECT count(*)::int AS n FROM ducklab_runs WHERE status IN ('queued','verifying')");if(pending.rows[0].n>=16){await db.query('COMMIT');throw apiError(503,'Verification queue is full. Please try again later.');}
   const id=randomUUID();await db.query('INSERT INTO ducklab_runs(id,digest,nickname,course_id,config_id,replay) VALUES($1,$2,$3,$4,$5,$6)',[id,digest,nickname,run.courseId,run.configId,run]);await db.query('COMMIT');return {id,status:'queued'};
  }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release();}
 }
 async leaderboard(){const {rows}=await this.pool.query("SELECT id,nickname,milliseconds,course_id AS \"courseId\",config_id AS \"configId\",verified_at AS \"verifiedAt\",'verified' AS status FROM ducklab_runs WHERE status='verified' AND course_id=$1 AND config_id=$2 ORDER BY milliseconds,verified_at,id LIMIT 10",[COURSE.id,GAMEPLAY_CONFIG]);return {courseId:COURSE.id,configId:GAMEPLAY_CONFIG,worldBest:rows[0]??null,entries:rows.map((r,i)=>({...r,rank:i+1}))};}
 async status(id){const {rows}=await this.pool.query('SELECT id,nickname,status,error,milliseconds,result,course_id AS "courseId",config_id AS "configId",verified_at AS "verifiedAt" FROM ducklab_runs WHERE id=$1',[id]);if(!rows.length)throw apiError(404,'Run not found.');const row=rows[0];if(row.status==='verified'){const ranks=await this.pool.query("SELECT count(*)::int+1 AS rank FROM ducklab_runs WHERE status='verified' AND course_id=$1 AND config_id=$2 AND (milliseconds,verified_at,id)<($3,$4,$5)",[row.courseId,row.configId,row.milliseconds,row.verifiedAt,row.id]);row.rank=ranks.rows[0].rank;const faster=await this.pool.query("SELECT exists(SELECT 1 FROM ducklab_runs WHERE status='verified' AND course_id=$1 AND config_id=$2 AND verified_at<$3 AND milliseconds<=$4) AS exists",[row.courseId,row.configId,row.verifiedAt,row.milliseconds]);row.newWorldBest=!faster.rows[0].exists;}return row;}
 async close(){await this.pool.end();}
}
