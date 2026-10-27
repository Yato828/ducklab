import {chromium} from '@playwright/test';import fs from 'node:fs/promises';
await fs.mkdir('tests/artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1050},deviceScaleFactor:1});const errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});await page.waitForTimeout(5000);
await page.screenshot({path:'tests/artifacts/home-desktop.png',fullPage:true});console.log(JSON.stringify({title:await page.title(),ready:await page.locator('.simulation-viewport').getAttribute('data-ready'),error:await page.locator('.sim-error').textContent().catch(()=>null),errors},null,2));
await page.goto('http://127.0.0.1:5173/time-trial',{waitUntil:'networkidle'});await page.waitForTimeout(3000);await page.screenshot({path:'tests/artifacts/course-ready.png',fullPage:true});console.log('course',await page.locator('.simulation-viewport').getAttribute('data-ready'),await page.locator('.sim-error').textContent().catch(()=>null));
await browser.close();
