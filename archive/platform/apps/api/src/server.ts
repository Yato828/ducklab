import 'dotenv/config';
import { buildApp } from './app.js';
import { readConfig } from './config.js';
const config=readConfig();
const app=await buildApp({config});
await app.listen({port:config.port,host:process.env.API_HOST||'127.0.0.1'});
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,async()=>{await app.close();process.exit(0);});
