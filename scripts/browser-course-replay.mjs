import {chromium} from '@playwright/test';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {createHeadless} from '../packages/simulation-core/node/runtime.mjs';import {replayRun} from '../packages/game-core/src/replay.js';
const fixture=JSON.parse(await fs.readFile('tests/artifacts/chaos-course.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.exposeFunction('qaProgress',n=>console.log('Browser physical replay step',n,'/',fixture.run.ticks));
 // Test-only instrumentation of the served component: capture its existing public API.
 // No robot state, objective flags, policy outputs or timers are replaced.
 await page.route('**/src/components/SimulationViewport.tsx*',async route=>{const response=await route.fetch();let body=await response.text();assert.match(body,/instance\.current\s*=\s*result;/);body=body.replace(/instance\.current\s*=\s*result;/,'instance.current = result; window.__qaSimulation = result;');await route.fulfill({response,body});});
 await page.goto('http://127.0.0.1:5173/time-trial');await page.waitForFunction(()=>!!window.__qaSimulation,{timeout:60000});
 const result=await page.evaluate(async run=>{
  const sim=window.__qaSimulation;await sim.startTrial({paused:true});let index=0;
  for(let tick=0;tick<run.ticks;tick++){
   while(index<run.events.length&&run.events[index].step===tick){const e=run.events[index++];if(e.type==='command')sim.setCommand(e.vx,e.wz);else if(e.type==='action')await sim.action(e.action);else await sim.assist(e.kind);}
   await sim.step();if(tick%1000===0)await window.qaProgress(tick);
  }
  return {log:await sim.getRun(),diagnostics:sim.getState(),trialText:document.querySelector('[data-testid="stopwatch"]').textContent};
 },fixture.run);
 assert.equal(result.log.ticks,fixture.run.ticks);assert.equal(result.trialText,'03:10.30');assert.equal(errors.length,0,JSON.stringify(errors));await page.getByRole('heading',{name:'COURSE COMPLETED.'}).waitFor();
 await page.screenshot({path:'tests/artifacts/dark-course-result.png',fullPage:true});
 const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Save screenshot'}).click();const download=await downloadEvent;await download.saveAs('tests/artifacts/dark-shared-result.png');
 const runtime=await createHeadless({record:false});try{const official=await replayRun(runtime.engine,result.log);assert.equal(official.milliseconds,190300);const difference=Math.max(...result.diagnostics.position.map((v,i)=>Math.abs(v-runtime.engine.data.qpos[i])));assert.ok(difference<1e-6,'Browser/Node physical position tolerance');console.log('Browser → authoritative replay verified',official.milliseconds,'ms; max position difference',difference);await fs.writeFile('tests/artifacts/browser-replay.json',JSON.stringify({official,browser:result.diagnostics,maxPositionDifference:difference,errors},null,2));}finally{await runtime.dispose();}
 if(process.argv.includes('--submit')){await page.getByLabel('Submit for authoritative verification').fill('Browser replay QA');await page.getByRole('button',{name:'SUBMIT',exact:true}).click();await page.locator('.result-card>.verified').waitFor({timeout:30000});assert.match(await page.locator('.result-card>.verified').textContent(),/VERIFIED/);await page.screenshot({path:'tests/artifacts/dark-course-verified.png',fullPage:true});const board=await (await page.request.get('http://127.0.0.1:5173/api/leaderboard')).json();assert.equal(board.worldBest.milliseconds,190300);assert.equal(board.worldBest.status,'verified');console.log('UI submission → persistent verification → verified world-best passed.');}
 await page.reload();await page.waitForSelector('.simulation-viewport[data-ready="true"]');assert.equal(await page.getByTestId('personal-best').textContent(),'03:10.30');console.log('Result screen, PNG export and personal-best reload passed.');
}finally{await browser.close();}
