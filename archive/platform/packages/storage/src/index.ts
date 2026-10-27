import { createHash } from 'node:crypto';
import { S3Client,PutObjectCommand,GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
export function storageConfigured(env:NodeJS.ProcessEnv=process.env){return Boolean(env.S3_ENDPOINT&&env.S3_ACCESS_KEY_ID&&env.S3_SECRET_ACCESS_KEY&&env.S3_PRIVATE_BUCKET);}
export function validatePrivateKey(key:string){
  if(key.length>512||!/^private\/(training|movements)\/[A-Za-z0-9/_\-.]+$/.test(key)||key.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error('Invalid private object key.');
  return key;
}
function client(env:NodeJS.ProcessEnv){
  if(!storageConfigured(env))throw new Error('Private object storage is not configured.');
  const endpoint=new URL(env.S3_ENDPOINT!);
  if(!['http:','https:'].includes(endpoint.protocol)||endpoint.username||endpoint.password)throw new Error('Invalid S3 endpoint.');
  if(env.NODE_ENV==='production'&&endpoint.protocol!=='https:')throw new Error('Production object storage must use TLS.');
  return new S3Client({endpoint:endpoint.href,region:env.S3_REGION||'us-east-1',forcePathStyle:env.S3_FORCE_PATH_STYLE!=='false',credentials:{accessKeyId:env.S3_ACCESS_KEY_ID!,secretAccessKey:env.S3_SECRET_ACCESS_KEY!}});
}
export async function uploadPrivateArtifact(key:string,body:Uint8Array,expectedSha256:string,env:NodeJS.ProcessEnv=process.env){
  validatePrivateKey(key);
  if(body.byteLength===0||body.byteLength>40*1024*1024||!/^[a-f0-9]{64}$/.test(expectedSha256)||createHash('sha256').update(body).digest('hex')!==expectedSha256)throw new Error('Artifact size or content hash is invalid.');
  const s3=client(env);
  try{await s3.send(new PutObjectCommand({Bucket:env.S3_PRIVATE_BUCKET!,Key:key,Body:body,ContentLength:body.byteLength,ContentType:'application/octet-stream',CacheControl:'private, no-store',Metadata:{sha256:expectedSha256},IfNoneMatch:'*'}));return {storageKey:key,sha256:expectedSha256,bytes:body.byteLength};}
  finally{s3.destroy();}
}
export async function signPrivateDownload(key:string,filename:string,env:NodeJS.ProcessEnv=process.env){
  validatePrivateKey(key);
  if(!/^[A-Za-z0-9._-]{1,100}$/.test(filename))throw new Error('Invalid download filename.');
  const s3=client(env);
  try{return {url:await getSignedUrl(s3,new GetObjectCommand({Bucket:env.S3_PRIVATE_BUCKET!,Key:key,ResponseContentType:'application/octet-stream',ResponseContentDisposition:`attachment; filename="${filename}"`,ResponseCacheControl:'private, no-store'}),{expiresIn:60}),expiresInSeconds:60};}
  finally{s3.destroy();}
}
