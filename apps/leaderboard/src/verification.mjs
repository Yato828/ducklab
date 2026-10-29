import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export function verifyIsolated(run,{timeoutMs=25000,signal}={}){
 return new Promise((resolve,reject)=>{
  const child=fork(fileURLToPath(new URL('./verify-child.mjs',import.meta.url)),[],{execArgv:['--max-old-space-size=256'],stdio:['ignore','ignore','ignore','ipc'],env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR},serialization:'json'});
  let settled=false;const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);child.kill('SIGKILL');error?reject(error):resolve(result);};
  const abort=()=>finish(new Error('Verification stopped.'));const timer=setTimeout(()=>finish(new Error('Verification exceeded its CPU time allowance.')),timeoutMs);
  child.on('message',m=>m?.ok?finish(null,m.result):finish(new Error(m?.error||'Verification failed.')));child.on('error',e=>finish(e));child.on('exit',()=>finish(new Error('Verification process exited.')));
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();else child.send(run);
 });
}
