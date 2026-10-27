#!/usr/bin/env node
/** Restore exact manifest-pinned originals. Every response is hash-verified before writing. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await fs.readFile(path.join(root,'assets/microduck/manifest.json'),'utf8'));
let index=0,downloaded=0;
async function task(){while(index<manifest.files.length){const f=manifest.files[index++],dst=path.resolve(root,f.path);if(!dst.startsWith(root+path.sep))throw new Error('Manifest path escapes repository.');
  try{const d=await fs.readFile(dst);if(d.length===f.bytes&&createHash('sha256').update(d).digest('hex')===f.sha256)continue;}catch{}
  const r=await fetch(f.source,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error(`Upstream ${r.status}: ${f.source}`);const bytes=new Uint8Array(await r.arrayBuffer());
  if(bytes.length!==f.bytes||createHash('sha256').update(bytes).digest('hex')!==f.sha256)throw new Error(`Asset integrity failed: ${f.path}`);
  await fs.mkdir(path.dirname(dst),{recursive:true});await fs.writeFile(dst,bytes);downloaded++;console.log('Verified '+f.path);
}}
await Promise.all(Array.from({length:6},task));console.log(`Verified ${manifest.files.length} originals; restored ${downloaded}.`);
