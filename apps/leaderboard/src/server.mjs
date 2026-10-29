import http from 'node:http';import {createHmac} from 'node:crypto';import {pathToFileURL} from 'node:url';
import {RunStore,apiError} from './store.mjs';import {startVerifier} from './worker.mjs';import {validateRun,REPLAY_LIMITS} from '../../../packages/game-core/src/replay.js';import {checkGameplayHash} from '../../../scripts/pin-gameplay.mjs';
export async function createServer({databaseUrl,origins=['http://127.0.0.1:5173','http://localhost:5173'],rateSecret='local-development-only',verify=true,trustProxy=false}={}){
 if(!databaseUrl)throw new Error('DATABASE_URL is required.');await checkGameplayHash();const store=new RunStore(databaseUrl);await store.init();const stopWorker=verify?startVerifier(store):async()=>{};
 const server=http.createServer(async(req,res)=>{
  const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
  try{
   const origin=req.headers.origin;if(origin&&!origins.includes(origin))throw apiError(403,'Origin is not allowed.');if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
   if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.writeHead(204);res.end();return;}
   const url=new URL(req.url,'http://localhost');
   if(req.method==='GET'&&url.pathname==='/api/leaderboard')return send(200,await store.leaderboard());
   const match=url.pathname.match(/^\/api\/runs\/([a-f0-9-]{36})$/i);if(req.method==='GET'&&match)return send(200,await store.status(match[1]));
   if(req.method==='GET'&&url.pathname==='/api/health')return send(200,{ready:true});
   if(req.method!=='POST'||url.pathname!=='/api/runs')throw apiError(404,'Endpoint not found.');
   if(!req.headers['content-type']?.startsWith('application/json'))throw apiError(415,'Expected JSON.');
   if(Number(req.headers['content-length'])>REPLAY_LIMITS.bytes)throw apiError(413,'Run log is too large.');
   let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>REPLAY_LIMITS.bytes)throw apiError(413,'Run log is too large.');chunks.push(chunk);}
   let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw apiError(400,'Invalid JSON.');}
   if(!body||typeof body!=='object'||Object.keys(body).some(k=>!['nickname','run'].includes(k))||typeof body.nickname!=='string'||!/^[-\p{L}\p{N}_ .]{2,24}$/u.test(body.nickname.trim()))throw apiError(400,'Use a nickname of 2–24 letters, digits, spaces, dots, underscores or hyphens.');
   let run;try{run=validateRun(body.run);}catch(e){throw apiError(400,e.message);}
   const ip=trustProxy?(String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',').at(-1).trim()):req.socket.remoteAddress;
   const identity=createHmac('sha256',rateSecret).update(ip||'unknown').digest('hex');return send(202,await store.submit(body.nickname.trim(),run,identity));
  }catch(e){send(e.status||503,{error:e.status?e.message:'Leaderboard temporarily unavailable.'});}
 });
 server.requestTimeout=10000;server.headersTimeout=10000;server.maxRequestsPerSocket=100;
 return {server,store,async close(){await stopWorker();await new Promise(resolve=>server.close(resolve));await store.close();}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.env.NODE_ENV==='production'&&(!process.env.RATE_LIMIT_SECRET||process.env.RATE_LIMIT_SECRET.length<32))throw new Error('Set a private RATE_LIMIT_SECRET of at least 32 characters.');
 const app=await createServer({databaseUrl:process.env.DATABASE_URL,origins:(process.env.ALLOWED_ORIGINS||'http://127.0.0.1:5173,http://localhost:5173').split(','),rateSecret:process.env.RATE_LIMIT_SECRET,trustProxy:process.env.TRUST_PROXY==='1'});const port=Number(process.env.PORT||8787);app.server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`DUCKLAB leaderboard http://${process.env.HOST||'127.0.0.1'}:${port}`));for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await app.close();process.exit(0);});
}
