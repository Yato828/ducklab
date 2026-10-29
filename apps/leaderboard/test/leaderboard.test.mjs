import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {createServer} from '../src/server.mjs';import {verifyIsolated} from '../src/verification.mjs';import {COURSE} from '../../../packages/game-core/src/course.js';import {GAMEPLAY_CONFIG} from '../../../packages/game-core/src/version.js';
const databaseUrl=process.env.TEST_DATABASE_URL;
const fixture=JSON.parse(await fs.readFile(new URL('../../../tests/artifacts/chaos-course.json',import.meta.url),'utf8'));
async function listen(app){await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));return 'http://127.0.0.1:'+app.server.address().port;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('bounded verification rejects incomplete inputs and enforces timeout',async()=>{await assert.rejects(()=>verifyIsolated({...fixture.run,ticks:1,events:[]}),/replay/);await assert.rejects(()=>verifyIsolated(fixture.run,{timeoutMs:1}),/allowance/);});
test('PostgreSQL persists only authoritatively verified world records across service restarts',{skip:!databaseUrl,timeout:60000},async()=>{
 assert.match(new URL(databaseUrl).pathname,/test$/,'Refuse to clear a non-test database');let app=await createServer({databaseUrl,verify:false}),base=await listen(app);
 try{
  await app.store.pool.query('TRUNCATE ducklab_runs,ducklab_rate_limits');
  const post=async(body,extra={})=>fetch(base+'/api/runs',{method:'POST',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify(body)});
  let board=await (await fetch(base+'/api/leaderboard')).json();assert.equal(board.worldBest,null);assert.deepEqual(board.entries,[]);
  assert.equal((await post({nickname:'Physics QA',run:{...fixture.run,time:1,completed:true}})).status,400);
  assert.equal((await post({nickname:'Physics QA',run:{...fixture.run,configId:'fake'}})).status,400);
  assert.equal((await post({nickname:'Physics QA',run:fixture.run},{Origin:'https://unrelated.invalid'})).status,403);
  assert.equal((await fetch(base+'/api/runs',{method:'POST',headers:{'Content-Type':'application/json'},body:' '.repeat(1_500_001)})).status,413);
  let response=await post({nickname:'Physics QA',run:fixture.run});assert.equal(response.status,202);const queued=await response.json();assert.equal(queued.status,'queued');assert.equal((await app.store.leaderboard()).worldBest,null);
  const duplicate=await (await post({nickname:'Another name',run:fixture.run})).json();assert.equal(duplicate.id,queued.id);
  const invalid={protocol:1,courseId:COURSE.id,configId:GAMEPLAY_CONFIG,ticks:1,events:[]};const bad=await (await post({nickname:'Invalid QA',run:invalid})).json();assert.equal((await post({nickname:'Rate QA',run:invalid})).status,429);
  await app.close();app=await createServer({databaseUrl});base=await listen(app);
  let status;for(let i=0;i<150;i++){status=await app.store.status(queued.id);if(status.status==='verified'||status.status==='rejected')break;await delay(100);}assert.equal(status.status,'verified',JSON.stringify(status));assert.equal(status.milliseconds,Math.round(fixture.trial.elapsed*1000));assert.equal(status.rank,1);assert.equal(status.newWorldBest,true);
  let rejected;for(let i=0;i<100;i++){rejected=await app.store.status(bad.id);if(rejected.status==='rejected')break;await delay(100);}assert.equal(rejected.status,'rejected');assert.equal(rejected.milliseconds,null);
  board=await (await fetch(base+'/api/leaderboard')).json();assert.equal(board.entries.length,1);assert.equal(board.worldBest.nickname,'Physics QA');assert.equal(board.worldBest.status,'verified');assert.equal(board.configId,GAMEPLAY_CONFIG);
  await app.close();app=await createServer({databaseUrl,verify:false});base=await listen(app);assert.equal((await app.store.leaderboard()).worldBest.id,queued.id);assert.equal((await post({nickname:'Still rate limited',run:invalid})).status,429);
  await app.store.pool.query('TRUNCATE ducklab_runs,ducklab_rate_limits');
  // Concurrent submissions must respect the global queue cap even across identities.
  const attempts=await Promise.allSettled(Array.from({length:20},(_,i)=>app.store.submit('Queue QA',{...invalid,ticks:i+2},'queue-'+i)));assert.equal(attempts.filter(r=>r.status==='fulfilled').length,16);assert.ok(attempts.filter(r=>r.status==='rejected').every(r=>r.reason.status===503));
 }finally{await app.store.pool.query('TRUNCATE ducklab_runs,ducklab_rate_limits');await app.close();}
});
