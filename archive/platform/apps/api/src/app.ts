import Fastify, { type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { createHash,randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile,realpath,stat } from 'node:fs/promises';
import { resolve,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { z } from 'zod';
import { Keypair, PublicKey } from '@solana/web3.js';
import { getMint,TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { compileMovement } from '../../../packages/movement-dsl/src/index.js';
import { MarketplaceChain } from '../../../packages/solana/src/marketplace.js';
import { parseBaseUnits } from '../../../packages/solana/src/amounts.js';
import { hashSecret, makeChallenge, newSecret, verifyChallengeSignature } from './auth.js';
import { type AppConfig, readConfig } from './config.js';
import { ApiError, requireDatabase, transaction } from './db.js';
import { reconcilePurchase } from './reconcile.js';
import { AIOutputError,generateMovement } from '../../../packages/shared/ai.js';
import { APPROVED_TRAINING_TASKS, TRAINING_QUEUE, validateTrainingRequest } from '../../../packages/shared/training.js';
import { signPrivateDownload } from '../../../packages/storage/src/index.js';

type User={id:string;wallet:string;displayName:string|null;csrfHash:string};
const categories=['Walking','Balance','Tricks','Recovery','Navigation','Interaction','Dance','Experimental'] as const;
const walletSchema=z.string().min(32).max(44).refine(value=>{try{return new PublicKey(value).toBase58()===value;}catch{return false;}},'Invalid Solana wallet address.');
const movementInput=z.object({name:z.string().trim().min(1).max(100),source:z.string().max(32768),description:z.string().max(2000).default(''),category:z.enum(categories).default('Walking')}).strict();
const uuid=z.string().uuid();
const cursorInput=z.object({cursor:z.string().uuid().optional(),limit:z.coerce.number().int().min(1).max(50).default(24)});
const signCookie='ducklab_session';
const manifestPath=fileURLToPath(new URL('../../../assets/microduck/manifest.json',import.meta.url));

async function createManifest(source:string) {
  const program=compileMovement(source);
  let upstream:unknown;
  try{ upstream=JSON.parse(await readFile(manifestPath,'utf8')); }
  catch{throw new ApiError(503,'Pinned robot asset manifest is missing. Run the documented upstream asset fetch before saving server movements.','ASSET_PROVENANCE_MISSING');}
  const manifest={format:'ducklab-movement-v1',source,program,upstream};
  return {manifest,manifestHash:hashSecret(JSON.stringify(manifest))};
}

export async function buildApp(options:{config?:AppConfig;pool?:pg.Pool;logger?:boolean}={}) {
  const config=options.config||readConfig();
  const pool=options.pool||(config.databaseUrl?new pg.Pool({connectionString:config.databaseUrl,max:10,connectionTimeoutMillis:5000,idleTimeoutMillis:30000}):undefined);
  const chain=config.chain?new MarketplaceChain(config.chain):undefined;
  const app=Fastify({logger:options.logger ?? true,bodyLimit:65536,trustProxy:false});
  const sessionCache=new WeakMap<FastifyRequest,User|null>();
  const metrics={requests:0,errors:0};
  await app.register(cookie);
  await app.register(cors,{origin:config.origin,credentials:true,methods:['GET','POST','PATCH','DELETE','OPTIONS'],allowedHeaders:['Content-Type','X-CSRF-Token']});
  await app.register(helmet,{contentSecurityPolicy:{directives:{defaultSrc:["'none'"],frameAncestors:["'none'"]}}});
  await app.register(rateLimit,{max:120,timeWindow:'1 minute'});
  app.addHook('onRequest',async request=>{
    metrics.requests++;
    if(['POST','PATCH','DELETE','PUT'].includes(request.method) && request.headers.origin!==config.origin) throw new ApiError(403,'Request origin is not allowed.','ORIGIN_REJECTED');
  });
  app.addHook('onClose',async()=>{if(pool && !options.pool)await pool.end();});
  app.setErrorHandler((error,request,reply)=>{
    metrics.errors++;
    if(error instanceof z.ZodError)return reply.code(400).send({error:'VALIDATION_FAILED',message:error.issues.map(i=>`${i.path.join('.')||'request'}: ${i.message}`).join('; ')});
    const status=error instanceof ApiError?error.statusCode:((error as {statusCode?:number}).statusCode||500);
    if(status>=500)request.log.error({name:error instanceof Error?error.name:'UnknownError',code:(error as {code?:string}).code,requestId:request.id},'API request failed');
    reply.code(status).send({error:error instanceof ApiError?error.code:'REQUEST_FAILED',message:status>=500 && !(error instanceof ApiError)?'Service operation failed. See server logs and configuration.':error instanceof Error?error.message:'Request failed.'});
  });
  async function user(request:FastifyRequest,required=true):Promise<User|null> {
    let result=sessionCache.get(request);
    if(result===undefined){
      const token=request.cookies[signCookie];result=null;
      if(token && pool){const {rows}=await pool.query(`SELECT u.id,u.display_name AS "displayName",w.wallet,s.csrf_hash AS "csrfHash" FROM authentication_sessions s JOIN users u ON u.id=s.user_id JOIN wallet_identities w ON w.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()`,[hashSecret(token)]);result=rows[0]||null;}
      sessionCache.set(request,result||null);
    }
    if(required&&!result)throw new ApiError(401,'Sign in by signing a wallet challenge first.','AUTHENTICATION_REQUIRED');
    if(result&&['POST','PATCH','DELETE','PUT'].includes(request.method)){
      const supplied=request.headers['x-csrf-token'];
      if(typeof supplied!=='string' || !timingSafeEqual(Buffer.from(hashSecret(supplied),'hex'),Buffer.from(result.csrfHash,'hex')))throw new ApiError(403,'CSRF token is missing or invalid.','CSRF_REJECTED');
    }
    return result||null;
  }
  async function admin(request:FastifyRequest){const u=(await user(request))!;if(!config.adminWallets.has(u.wallet))throw new ApiError(403,'Administrator access is required.','FORBIDDEN');return u;}
  function requireChain(){if(!chain)throw new ApiError(503,config.paymentReason,'PAYMENTS_UNAVAILABLE');return chain;}
  async function listing(id:string){const db=requireDatabase(pool);const {rows}=await db.query('SELECT * ,price_base_units::text AS price_text FROM marketplace_listings WHERE id=$1',[uuid.parse(id)]);if(!rows[0])throw new ApiError(404,'Listing not found.');const l=rows[0];return {row:l,expected:{address:l.listing_address,seller:l.seller_wallet,manifestHash:l.manifest_hash,priceBaseUnits:l.price_text}};}

  app.get('/api/v1/health',async(_request,reply)=>{
    let database:'unconfigured'|'healthy'|'unavailable'=pool?'healthy':'unconfigured';
    if(pool){try{await pool.query('SELECT 1');}catch{database='unavailable';reply.code(503);}}
    return {status:database==='unavailable'?'degraded':'ok',database,uptimeSeconds:process.uptime(),timestamp:new Date().toISOString()};
  });
  app.get('/api/v1/config',async()=>({network:config.network,tokenSymbol:config.tokenSymbol,payments:{configured:Boolean(chain),reason:config.paymentReason,mint:config.chain?.mint,programId:config.chain?.programId},database:{configured:Boolean(pool)},ai:{configured:Boolean(config.openaiKey)},training:{configured:config.trainingConfigured}}));
  app.post('/api/v1/auth/challenge',{config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async request=>{
    const db=requireDatabase(pool),{wallet}=z.object({wallet:walletSchema}).strict().parse(request.body),challengeId=randomUUID();
    const challenge=makeChallenge(wallet,config.origin);
    await db.query('INSERT INTO auth_challenges(id,wallet,message,expires_at) VALUES($1,$2,$3,$4)',[challengeId,wallet,challenge.message,challenge.expiresAt]);
    return {challengeId,message:challenge.message,expiresAt:challenge.expiresAt.toISOString()};
  });
  app.post('/api/v1/auth/verify',{config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async(request,reply)=>{
    const db=requireDatabase(pool),input=z.object({challengeId:uuid,signature:z.string().min(80).max(90)}).strict().parse(request.body);
    const token=newSecret(),csrfToken=newSecret(),expiresAt=new Date(Date.now()+config.sessionHours*3600000);
    const authenticated=await transaction(db,async client=>{
      const {rows}=await client.query('SELECT * FROM auth_challenges WHERE id=$1 FOR UPDATE',[input.challengeId]);const challenge=rows[0];
      if(!challenge || challenge.consumed_at || new Date(challenge.expires_at).getTime()<=Date.now() || !verifyChallengeSignature(challenge.wallet,challenge.message,input.signature))throw new ApiError(401,'Challenge signature is invalid, expired, or already used.','CHALLENGE_INVALID');
      await client.query('UPDATE auth_challenges SET consumed_at=now() WHERE id=$1',[input.challengeId]);
      const existing=await client.query('SELECT user_id FROM wallet_identities WHERE wallet=$1',[challenge.wallet]);
      let userId=existing.rows[0]?.user_id;
      if(!userId){
        // Advisory lock serializes first sign-in to the same wallet across challenges.
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[challenge.wallet]);
        const locked=await client.query('SELECT user_id FROM wallet_identities WHERE wallet=$1',[challenge.wallet]);userId=locked.rows[0]?.user_id;
        if(!userId){userId=randomUUID();await client.query('INSERT INTO users(id) VALUES($1)',[userId]);await client.query('INSERT INTO wallet_identities(wallet,user_id) VALUES($1,$2)',[challenge.wallet,userId]);}
      }
      await client.query('INSERT INTO authentication_sessions(token_hash,user_id,csrf_hash,expires_at) VALUES($1,$2,$3,$4)',[hashSecret(token),userId,hashSecret(csrfToken),expiresAt]);
      const profile=await client.query('SELECT display_name FROM users WHERE id=$1',[userId]);
      return {id:userId,wallet:challenge.wallet,displayName:profile.rows[0].display_name};
    });
    reply.setCookie(signCookie,token,{httpOnly:true,secure:config.production,sameSite:'strict',path:'/api',expires:expiresAt});
    // CSRF is readable by this origin, session token remains HttpOnly.
    reply.setCookie('ducklab_csrf',csrfToken,{httpOnly:false,secure:config.production,sameSite:'strict',path:'/',expires:expiresAt});
    return {user:authenticated,csrfToken,expiresAt:expiresAt.toISOString()};
  });
  app.get('/api/v1/auth/session',async request=>{const u=await user(request,false);return {user:u?{id:u.id,wallet:u.wallet,displayName:u.displayName}:null,csrfToken:u?request.cookies.ducklab_csrf:undefined};});
  app.post('/api/v1/auth/signout',async(request,reply)=>{await user(request);await requireDatabase(pool).query('DELETE FROM authentication_sessions WHERE token_hash=$1',[hashSecret(request.cookies[signCookie]!)]);reply.clearCookie(signCookie,{path:'/api'}).clearCookie('ducklab_csrf',{path:'/'});return {signedOut:true};});
  app.patch('/api/v1/users/me',async request=>{const u=(await user(request))!,{displayName}=z.object({displayName:z.string().trim().min(1).max(64)}).strict().parse(request.body);await requireDatabase(pool).query('UPDATE users SET display_name=$1 WHERE id=$2',[displayName,u.id]);return {id:u.id,wallet:u.wallet,displayName};});
  app.get('/api/v1/users/:wallet',async request=>{const {wallet}=z.object({wallet:walletSchema}).parse(request.params);const {rows}=await requireDatabase(pool).query('SELECT u.display_name,w.wallet,u.created_at FROM users u JOIN wallet_identities w ON w.user_id=u.id WHERE w.wallet=$1',[wallet]);if(!rows[0])throw new ApiError(404,'Creator profile not found.');return rows[0];});
  async function creatorStatistics(wallet:string){
    const db=requireDatabase(pool);
    const sales=await db.query(`SELECT l.mint,count(*)::int AS sales,COALESCE(sum(r.seller_paid),0)::text AS revenue_base_units FROM onchain_receipts r JOIN purchases p ON p.id=r.purchase_id JOIN marketplace_listings l ON l.id=p.listing_id WHERE l.seller_wallet=$1 GROUP BY l.mint`,[wallet]);
    const packs=await db.query(`SELECT count(*)::int AS packs FROM movement_packs p JOIN wallet_identities w ON w.user_id=p.owner_id WHERE w.wallet=$1 AND p.status='published'`,[wallet]);
    return {wallet,publishedPacks:packs.rows[0].packs,sales:sales.rows.reduce((sum:number,row:{sales:number})=>sum+row.sales,0),revenueByMint:sales.rows.map(r=>({mint:r.mint,baseUnits:r.revenue_base_units,sales:r.sales}))};
  }
  app.get('/api/v1/users/:wallet/stats',async request=>creatorStatistics(walletSchema.parse((request.params as {wallet:string}).wallet)));
  app.get('/api/v1/creator/stats',async request=>creatorStatistics((await user(request))!.wallet));
  app.get('/api/v1/wallet/balance',async request=>{
    const u=(await user(request))!;
    if(!chain)return {configured:false,reason:config.paymentReason,mint:null,decimals:null,baseUnits:null,symbol:config.tokenSymbol};
    const mintKey=new PublicKey(chain.config.mint),mint=await getMint(chain.connection,mintKey,'finalized',TOKEN_PROGRAM_ID);
    const accounts=await chain.connection.getParsedTokenAccountsByOwner(new PublicKey(u.wallet),{mint:mintKey},'finalized');
    let amount=0n;
    for(const account of accounts.value){
      const info=account.account.data.parsed?.info;
      if(!account.account.owner.equals(TOKEN_PROGRAM_ID)||info?.mint!==chain.config.mint||info?.owner!==u.wallet||info?.tokenAmount?.decimals!==mint.decimals)throw new ApiError(502,'RPC returned an unexpected token account.','RPC_VALIDATION_FAILED');
      amount+=parseBaseUnits(info.tokenAmount.amount);
    }
    return {configured:true,mint:chain.config.mint,decimals:mint.decimals,baseUnits:amount.toString(),symbol:config.tokenSymbol,commitment:'finalized',slot:accounts.context.slot};
  });

  app.get('/api/v1/movements',async request=>{
    const u=await user(request,false);if(!u||!pool)return {items:[],nextCursor:null};
    const {cursor,limit}=cursorInput.parse(request.query);
    const {rows}=await pool.query(`SELECT m.*,v.source,v.version,v.id AS version_id,v.manifest_hash FROM movements m JOIN LATERAL(SELECT * FROM movement_versions WHERE movement_id=m.id ORDER BY version DESC LIMIT 1)v ON true WHERE m.owner_id=$1 AND ($2::uuid IS NULL OR m.id>$2::uuid) ORDER BY m.id LIMIT $3`,[u.id,cursor||null,limit+1]);
    return {items:rows.slice(0,limit),nextCursor:rows.length>limit?rows[limit-1].id:null};
  });
  app.post('/api/v1/movements',async(request,reply)=>{
    const u=(await user(request))!,input=movementInput.parse(request.body),compiled=await createManifest(input.source),id=randomUUID(),versionId=randomUUID();
    await transaction(requireDatabase(pool),async client=>{
      await client.query('INSERT INTO movements(id,owner_id,name,description,category) VALUES($1,$2,$3,$4,$5)',[id,u.id,input.name,input.description,input.category]);
      await client.query('INSERT INTO movement_versions(id,movement_id,version,source,manifest,manifest_hash) VALUES($1,$2,1,$3,$4,$5)',[versionId,id,input.source,JSON.stringify(compiled.manifest),compiled.manifestHash]);
    });reply.code(201);return {id,versionId,version:1,manifestHash:compiled.manifestHash,validation:{dsl:true,physics:false}};
  });
  app.post('/api/v1/movements/:id/versions',async request=>{
    const u=(await user(request))!,{id}=z.object({id:uuid}).parse(request.params),{source}=z.object({source:z.string().max(32768)}).strict().parse(request.body),compiled=await createManifest(source);
    return transaction(requireDatabase(pool),async client=>{
      const movement=await client.query('SELECT id FROM movements WHERE id=$1 AND owner_id=$2 FOR UPDATE',[id,u.id]);if(!movement.rowCount)throw new ApiError(404,'Movement not found.');
      const last=await client.query('SELECT COALESCE(MAX(version),0)+1 AS version FROM movement_versions WHERE movement_id=$1',[id]),version=last.rows[0].version,versionId=randomUUID();
      await client.query('INSERT INTO movement_versions(id,movement_id,version,source,manifest,manifest_hash) VALUES($1,$2,$3,$4,$5,$6)',[versionId,id,version,source,JSON.stringify(compiled.manifest),compiled.manifestHash]);
      return {id,versionId,version,manifestHash:compiled.manifestHash,validation:{dsl:true,physics:false}};
    });
  });
  app.get('/api/v1/movements/:id/versions',async request=>{const u=(await user(request))!,{id}=z.object({id:uuid}).parse(request.params);const {rows}=await requireDatabase(pool).query('SELECT v.id,v.version,v.source,v.manifest_hash,v.validation_status,v.created_at FROM movement_versions v JOIN movements m ON m.id=v.movement_id WHERE m.id=$1 AND m.owner_id=$2 ORDER BY v.version DESC',[id,u.id]);return {items:rows};});
  app.post('/api/v1/movements/validate',async request=>{const {source}=z.object({source:z.string().max(32768)}).strict().parse(request.body);try{return {valid:true,program:compileMovement(source),physicsValidated:false};}catch(error){throw new ApiError(400,(error as Error).message,'DSL_INVALID');}});

  const marketplaceQuery=`SELECT l.id,l.listing_address,l.seller_wallet,l.price_base_units::text AS price_base_units,l.mint,l.manifest_hash,l.state,p.slug,p.title,p.description,p.category,v.version,v.id AS version_id,v.validation_status,l.created_at,(SELECT count(*)::int FROM purchases WHERE listing_id=l.id AND status='finalized') AS purchase_count,(SELECT CASE WHEN count(*)>=3 THEN round(avg(rating),2)::text ELSE NULL END FROM reviews WHERE listing_id=l.id) AS rating FROM marketplace_listings l JOIN movement_packs p ON p.id=l.pack_id JOIN movement_versions v ON v.id=l.version_id`;
  app.get('/api/v1/marketplace',async request=>{
    const {cursor,limit}=cursorInput.parse(request.query);if(!pool)return {items:[],nextCursor:null,configured:false};
    const {rows}=await pool.query(`${marketplaceQuery} WHERE l.state='active' AND ($1::uuid IS NULL OR l.id>$1::uuid) ORDER BY l.id LIMIT $2`,[cursor||null,limit+1]);return {items:rows.slice(0,limit),nextCursor:rows.length>limit?rows[limit-1].id:null,configured:true};
  });
  app.get('/api/v1/marketplace/:slug',async request=>{const {slug}=z.object({slug:z.string().regex(/^[a-z0-9-]{1,120}$/)}).parse(request.params);const {rows}=await requireDatabase(pool).query(`${marketplaceQuery} WHERE p.slug=$1 ORDER BY v.version DESC`,[slug]);if(!rows[0])throw new ApiError(404,'Movement pack not found.');return {...rows[0],versions:rows.map(r=>({version:r.version,versionId:r.version_id,manifestHash:r.manifest_hash,state:r.state,createdAt:r.created_at}))};});
  app.get('/api/v1/marketplace/:id/quote',async request=>{const {id}=z.object({id:uuid}).parse(request.params),l=await listing(id),u=await user(request,false);return requireChain().quote(l.expected,u?.wallet);});
  app.post('/api/v1/marketplace/:id/purchase-transaction',async request=>{const u=(await user(request))!,{id}=z.object({id:uuid}).parse(request.params),l=await listing(id);return requireChain().buildPurchase(l.expected,u.wallet);});
  app.post('/api/v1/marketplace/:id/purchases',async(request,reply)=>{
    const u=(await user(request))!,{id}=z.object({id:uuid}).parse(request.params),{signature}=z.object({signature:z.string().min(80).max(90)}).strict().parse(request.body);requireChain();await listing(id);
    const result=await requireDatabase(pool).query(`INSERT INTO purchases(id,buyer_id,listing_id,signature,status) VALUES($1,$2,$3,$4,'submitted') ON CONFLICT(signature) DO UPDATE SET signature=EXCLUDED.signature WHERE purchases.buyer_id=$2 AND purchases.listing_id=$3 RETURNING id,status`,[randomUUID(),u.id,id,signature]);
    if(!result.rows[0])throw new ApiError(409,'Transaction is already assigned to another purchase.');
    const purchaseId=result.rows[0].id;
    try{return {id:purchaseId,...await reconcilePurchase(requireDatabase(pool),requireChain(),purchaseId)};}
    catch{reply.code(202);return {id:purchaseId,status:'pending',message:'Access will be granted only after finalized receipt verification. Reconciliation will retry.'};}
  });
  app.get('/api/v1/purchases',async request=>{const u=(await user(request))!;const {rows}=await requireDatabase(pool).query('SELECT id,listing_id,signature,status,created_at,finalized_at FROM purchases WHERE buyer_id=$1 ORDER BY created_at DESC LIMIT 100',[u.id]);return {items:rows};});
  app.get('/api/v1/library',async request=>{const u=(await user(request))!;const {rows}=await requireDatabase(pool).query('SELECT e.version_id,e.created_at,m.name,v.version,v.manifest_hash FROM ownership_entitlements e JOIN movement_versions v ON v.id=e.version_id JOIN movements m ON m.id=v.movement_id WHERE e.user_id=$1 ORDER BY e.created_at DESC LIMIT 100',[u.id]);return {items:rows};});
  app.get('/api/v1/versions/:id/asset',async(request,reply)=>{
    const u=(await user(request))!,{id}=z.object({id:uuid}).parse(request.params);const {rows}=await requireDatabase(pool).query(`SELECT v.manifest,v.manifest_hash FROM movement_versions v JOIN movements m ON m.id=v.movement_id WHERE v.id=$1 AND (m.owner_id=$2 OR EXISTS(SELECT 1 FROM ownership_entitlements e WHERE e.version_id=v.id AND e.user_id=$2))`,[id,u.id]);if(!rows[0])throw new ApiError(404,'Owned movement version not found.');
    reply.header('Cache-Control','private, no-store').header('Content-Disposition',`attachment; filename="movement-${id}.json"`);return rows[0];
  });

  app.post('/api/v1/packs',async(request,reply)=>{
    const u=(await user(request))!,input=z.object({movementId:uuid,slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),title:z.string().trim().min(1).max(100),description:z.string().min(1).max(2000),category:z.enum(categories),rightsConfirmed:z.literal(true)}).strict().parse(request.body),id=randomUUID();
    const result=await requireDatabase(pool).query(`INSERT INTO movement_packs(id,movement_id,owner_id,slug,title,description,category,status,rights_confirmed) SELECT $1,m.id,$2,$3,$4,$5,$6,'submitted',true FROM movements m WHERE m.id=$7 AND m.owner_id=$2 RETURNING id,status`,[id,u.id,input.slug,input.title,input.description,input.category,input.movementId]);if(!result.rows[0])throw new ApiError(404,'Movement not found.');reply.code(201);return result.rows[0];
  });
  app.get('/api/v1/packs/mine',async request=>{const u=(await user(request))!;const {rows}=await requireDatabase(pool).query('SELECT * FROM movement_packs WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100',[u.id]);return {items:rows};});
  app.post('/api/v1/packs/:id/listing-transaction',async request=>{
    const u=(await user(request))!,{id}=z.object({id:uuid}).parse(request.params),{versionId,priceBaseUnits}=z.object({versionId:uuid,priceBaseUnits:z.string().regex(/^[1-9]\d{0,19}$/)}).strict().parse(request.body);parseBaseUnits(priceBaseUnits);
    const {rows}=await requireDatabase(pool).query(`SELECT p.*,v.manifest_hash FROM movement_packs p JOIN movement_versions v ON v.movement_id=p.movement_id WHERE p.id=$1 AND p.owner_id=$2 AND v.id=$3 AND p.status='approved' AND EXISTS(SELECT 1 FROM validation_results r WHERE r.version_id=v.id AND r.kind='admin-physics-review' AND r.passed=true)`,[id,u.id,versionId]);if(!rows[0])throw new ApiError(409,'This exact pack version requires administrator physics approval before listing.');
    if(!process.env.PUBLISHER_KEYPAIR_PATH)throw new ApiError(503,'Configure PUBLISHER_KEYPAIR_PATH with a mounted platform publishing signer.','PUBLISHER_UNAVAILABLE');
    const publisher=Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile(process.env.PUBLISHER_KEYPAIR_PATH,'utf8'))));
    const c=requireChain(),built=await c.buildListing(u.wallet,rows[0].manifest_hash,priceBaseUnits,publisher),listingId=randomUUID();
    await requireDatabase(pool).query(`INSERT INTO marketplace_listings(id,pack_id,version_id,seller_wallet,price_base_units,mint,program_id,listing_address,manifest_hash,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending') ON CONFLICT(pack_id,version_id) DO NOTHING`,[listingId,id,versionId,u.wallet,priceBaseUnits,c.config.mint,c.config.programId,built.listingAddress,rows[0].manifest_hash]);
    return built;
  });
  app.post('/api/v1/packs/:id/confirm-publication',async request=>{
    const u=(await user(request))!,{id}=z.object({id:uuid}).parse(request.params),{versionId}=z.object({versionId:uuid}).strict().parse(request.body);
    const {rows}=await requireDatabase(pool).query(`SELECT l.*,l.price_base_units::text AS price_text FROM marketplace_listings l JOIN movement_packs p ON p.id=l.pack_id WHERE l.pack_id=$1 AND p.owner_id=$2 AND l.version_id=$3`,[id,u.id,versionId]);if(!rows[0])throw new ApiError(404,'Pending listing not found.');const l=rows[0];const quote=await requireChain().quote({address:l.listing_address,seller:l.seller_wallet,manifestHash:l.manifest_hash,priceBaseUnits:l.price_text});if(!quote.active)throw new ApiError(409,'Onchain listing is not active.');
    const result=await transaction(requireDatabase(pool),async client=>{await client.query("UPDATE marketplace_listings SET state='active' WHERE id=$1",[l.id]);return client.query("UPDATE movement_packs SET status='published' WHERE id=$1 RETURNING slug",[id]);});return {published:true,slug:result.rows[0].slug,listingId:l.id};
  });
  app.post('/api/v1/reports',async request=>{const u=(await user(request))!,{packId,reason}=z.object({packId:uuid,reason:z.string().min(10).max(2000)}).strict().parse(request.body);await requireDatabase(pool).query('INSERT INTO content_reports(id,reporter_id,pack_id,reason) VALUES($1,$2,$3,$4)',[randomUUID(),u.id,packId,reason]);return {submitted:true};});

  app.get('/api/v1/admin/metrics',async request=>{
    await admin(request);const {rows}=await requireDatabase(pool).query(`SELECT (SELECT count(*)::int FROM users) AS users,(SELECT count(*)::int FROM movement_packs WHERE status='submitted') AS submissions,(SELECT count(*)::int FROM purchases WHERE status='pending' OR status='submitted') AS pending_payments,(SELECT count(*)::int FROM training_jobs WHERE status='running' OR status='queued') AS active_training`);return {...rows[0],process:metrics};
  });
  app.get('/api/v1/admin/submissions',async request=>{await admin(request);const {rows}=await requireDatabase(pool).query(`SELECT p.*,v.id AS version_id,v.version,v.manifest_hash,v.source FROM movement_packs p JOIN LATERAL(SELECT * FROM movement_versions WHERE movement_id=p.movement_id ORDER BY version DESC LIMIT 1)v ON true WHERE p.status='submitted' ORDER BY p.created_at LIMIT 50`);return {items:rows};});
  app.post('/api/v1/admin/packs/:id/review',async request=>{
    const u=await admin(request),{id}=z.object({id:uuid}).parse(request.params),input=z.object({approved:z.boolean(),reason:z.string().min(10).max(2000),versionId:uuid,physicsEvidence:z.object({robotVersion:z.string().min(1).max(100),scenarios:z.array(z.object({name:z.string().max(100),passed:z.boolean()})).min(1).max(30)}).optional()}).strict().parse(request.body);
    if(input.approved&&(!input.physicsEvidence||input.physicsEvidence.scenarios.some(s=>!s.passed)))throw new ApiError(400,'Approval requires passing physics validation evidence.');
    await transaction(requireDatabase(pool),async client=>{
      const version=await client.query(`SELECT v.id,v.source FROM movement_versions v JOIN movement_packs p ON p.movement_id=v.movement_id WHERE p.id=$1 AND v.id=$2 AND p.status='submitted' FOR UPDATE OF p`,[id,input.versionId]);if(!version.rows[0])throw new ApiError(404,'Submitted pack version not found.');compileMovement(version.rows[0].source);
      await client.query('UPDATE movement_packs SET status=$1 WHERE id=$2',[input.approved?'approved':'rejected',id]);
      await client.query('INSERT INTO moderation_actions(id,admin_id,pack_id,action,reason) VALUES($1,$2,$3,$4,$5)',[randomUUID(),u.id,id,input.approved?'approve':'reject',input.reason]);
      if(input.physicsEvidence)await client.query('INSERT INTO validation_results(id,version_id,kind,passed,details) VALUES($1,$2,$3,$4,$5)',[randomUUID(),input.versionId,'admin-physics-review',input.approved,JSON.stringify(input.physicsEvidence)]);
      await client.query('INSERT INTO admin_audit_logs(id,actor_id,action,target) VALUES($1,$2,$3,$4)',[randomUUID(),u.id,'pack.review',id]);
    });return {status:input.approved?'approved':'rejected'};
  });
  app.post('/api/v1/admin/purchases/:id/reconcile',async request=>{const u=await admin(request),{id}=z.object({id:uuid}).parse(request.params);const result=await reconcilePurchase(requireDatabase(pool),requireChain(),id);await requireDatabase(pool).query('INSERT INTO admin_audit_logs(id,actor_id,action,target) VALUES($1,$2,$3,$4)',[randomUUID(),u.id,'purchase.reconcile',id]);return result;});

  app.post('/api/v1/ai/generate',{config:{rateLimit:{max:5,timeWindow:'1 minute'}}},async request=>{
    const u=(await user(request))!,{prompt}=z.object({prompt:z.string().trim().min(1).max(2000)}).strict().parse(request.body);
    if(!config.openaiKey)throw new ApiError(503,'AI assistance requires server-side OPENAI_API_KEY and OPENAI_MODEL.','AI_UNAVAILABLE');
    const usageId=randomUUID();
    await transaction(requireDatabase(pool),async client=>{
      await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[u.id]);
      const {rows}=await client.query(`SELECT count(*)::int AS daily,count(*) FILTER(WHERE created_at>now()-interval '1 minute')::int AS minute FROM ai_usage WHERE user_id=$1 AND created_at>now()-interval '24 hours'`,[u.id]);
      if(rows[0].daily>=20||rows[0].minute>=5)throw new ApiError(429,'AI request quota reached.','AI_QUOTA_REACHED');
      await client.query('INSERT INTO ai_usage(id,user_id) VALUES($1,$2)',[usageId,u.id]);
    });
    let result;
    try{result=await generateMovement({prompt,userId:u.id},{apiKey:config.openaiKey,model:config.openaiModel,baseUrl:process.env.OPENAI_BASE_URL});}
    catch(error){if(error instanceof AIOutputError&&error.usage)await requireDatabase(pool).query('UPDATE ai_usage SET input_tokens=$1,output_tokens=$2 WHERE id=$3',[error.usage.inputTokens,error.usage.outputTokens,usageId]);throw error;}
    await requireDatabase(pool).query('UPDATE ai_usage SET input_tokens=$1,output_tokens=$2 WHERE id=$3',[result.usage.inputTokens,result.usage.outputTokens,usageId]);
    return result;
  });
  app.get('/api/v1/training/config',async()=>({configured:config.trainingConfigured,tasks:APPROVED_TRAINING_TASKS,reason:config.trainingConfigured?'Training requires an authenticated user and an explicit administrator budget allocation.':'Configure REDIS_URL, TRAINING_ENABLED=true and a separately provisioned CUDA training worker. No training has been started.'}));
  app.get('/api/v1/training/jobs',async request=>{const u=(await user(request))!;const {rows}=await requireDatabase(pool).query('SELECT id,task,configuration,status,budget_seconds,gpu_seconds_used::text,created_at,started_at,completed_at,error FROM training_jobs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',[u.id]);return {items:rows};});
  app.post('/api/v1/training/jobs',async(request,reply)=>{
    const u=(await user(request))!;if(!config.trainingConfigured)throw new ApiError(503,'GPU training is not configured. No job was started.','TRAINING_UNAVAILABLE');
    let input;try{input=validateTrainingRequest(request.body);}catch(error){throw new ApiError(400,(error as Error).message,'TRAINING_INVALID');}
    const jobId=randomUUID();
    await transaction(requireDatabase(pool),async client=>{
      await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[u.id]);
      const quota=await client.query('SELECT value FROM system_configuration WHERE key=$1',[`training_quota:${u.id}`]),budget=Number(quota.rows[0]?.value?.maxSecondsPerDay||0);
      const active=await client.query(`SELECT count(*)::int AS count FROM training_jobs WHERE user_id=$1 AND status IN('queued','running','cancelling')`,[u.id]);
      if(active.rows[0].count>=1)throw new ApiError(429,'Only one active training job is allowed per user.','TRAINING_QUOTA_REACHED');
      const used=await client.query(`SELECT COALESCE(sum(budget_seconds),0)::int AS seconds FROM training_jobs WHERE user_id=$1 AND created_at>now()-interval '24 hours'`,[u.id]);
      if(budget<=0||used.rows[0].seconds+input.maxDurationSeconds>budget)throw new ApiError(403,'An administrator must allocate a sufficient training budget before a GPU job can be queued.','TRAINING_BUDGET_REQUIRED');
      await client.query(`INSERT INTO training_jobs(id,user_id,task,configuration,status,budget_seconds) VALUES($1,$2,$3,$4,'queued',$5)`,[jobId,u.id,input.task,JSON.stringify(input),input.maxDurationSeconds]);
    });
    // Database queue is the durable outbox. apps/worker retries delivery after an API crash.
    try{const {Queue}=await import('bullmq');const queue=new Queue(TRAINING_QUEUE,{connection:redisConnection(process.env.REDIS_URL!)});try{await queue.add(input.task,{...input,jobId,userId:u.id},{jobId,attempts:1,removeOnComplete:false,removeOnFail:false});}finally{await queue.close();}}
    catch{request.log.warn({jobId},'Training job persisted; queue delivery will be retried by the outbox worker');}
    reply.code(202);return {id:jobId,status:'queued',message:'Queued within your allocated budget. A configured GPU worker must pick up this job.'};
  });
  app.post('/api/v1/training/jobs/:id/cancel',async request=>{
    const u=(await user(request))!,{id}=z.object({id:uuid}).parse(request.params);
    const result=await requireDatabase(pool).query(`UPDATE training_jobs SET status=CASE WHEN status='queued' THEN 'cancelled' ELSE 'cancelling' END WHERE id=$1 AND user_id=$2 AND status IN('queued','running') RETURNING status`,[id,u.id]);if(!result.rows[0])throw new ApiError(409,'No cancellable owned training job was found.');
    if(process.env.REDIS_URL){const {default:Redis}=await import('ioredis');const redis=new Redis(process.env.REDIS_URL,{maxRetriesPerRequest:1});try{await redis.set(`ducklab:training:cancel:${id}`,'1','EX',86400);}finally{redis.disconnect();}}
    return {id,status:result.rows[0].status};
  });
  app.get('/api/v1/training/jobs/:id/artifacts',async request=>{const u=(await user(request))!,{id}=z.object({id:uuid}).parse(request.params);const {rows}=await requireDatabase(pool).query('SELECT a.id,a.asset_hash,a.created_at FROM training_artifacts a JOIN training_jobs j ON j.id=a.job_id WHERE j.id=$1 AND j.user_id=$2',[id,u.id]);return {items:rows,publication:'requires-simulation-review'};});
  app.get('/api/v1/training/artifacts/:id/download',async(request,reply)=>{
    const u=(await user(request))!,{id}=z.object({id:uuid}).parse(request.params);
    const {rows}=await requireDatabase(pool).query('SELECT a.asset_hash,a.metadata FROM training_artifacts a JOIN training_jobs j ON j.id=a.job_id WHERE a.id=$1 AND j.user_id=$2',[id,u.id]);
    if(!rows[0])throw new ApiError(404,'Owned training artifact not found.');
    const artifact=rows[0];reply.header('Cache-Control','private, no-store');
    if(artifact.metadata.storageKey)return signPrivateDownload(artifact.metadata.storageKey,`policy-${id}.onnx`);
    if(!process.env.TRAINING_ARTIFACT_ROOT)throw new ApiError(503,'Artifact delivery requires S3 storage or a shared read-only TRAINING_ARTIFACT_ROOT mount.','ARTIFACT_STORAGE_UNAVAILABLE');
    const root=await realpath(resolve(process.env.TRAINING_ARTIFACT_ROOT)),path=await realpath(resolve(artifact.metadata.artifactPath));
    if(!path.startsWith(root+sep))throw new ApiError(403,'Artifact path is outside the configured storage root.');
    const file=await stat(path);if(!file.isFile()||file.size>40*1024*1024)throw new ApiError(400,'Artifact exceeds the supported file size.');
    const body=await readFile(path);if(createHash('sha256').update(body).digest('hex')!==artifact.asset_hash)throw new ApiError(409,'Artifact content hash does not match its immutable record.');
    return reply.type('application/octet-stream').header('Content-Disposition',`attachment; filename="policy-${id}.onnx"`).send(body);
  });
  app.post('/api/v1/admin/training/quotas',async request=>{const u=await admin(request),{userId,maxSecondsPerDay}=z.object({userId:uuid,maxSecondsPerDay:z.number().int().min(0).max(28800)}).strict().parse(request.body);await transaction(requireDatabase(pool),async client=>{await client.query('INSERT INTO system_configuration(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=now()',[`training_quota:${userId}`,JSON.stringify({maxSecondsPerDay})]);await client.query('INSERT INTO admin_audit_logs(id,actor_id,action,target,metadata) VALUES($1,$2,$3,$4,$5)',[randomUUID(),u.id,'training.quota',userId,JSON.stringify({maxSecondsPerDay})]);});return {userId,maxSecondsPerDay};});

  app.get('/api/v1/openapi.json',async()=>openapi);
  return app;
}

function redisConnection(url:string){const parsed=new URL(url);return {host:parsed.hostname,port:Number(parsed.port||6379),username:parsed.username||undefined,password:parsed.password||undefined,db:Number(parsed.pathname.slice(1)||0),...(parsed.protocol==='rediss:'?{tls:{}}:{})};}

const operationInputs:Record<string,unknown>={
  'post /auth/challenge':z.toJSONSchema(z.object({wallet:walletSchema})),
  'post /auth/verify':z.toJSONSchema(z.object({challengeId:uuid,signature:z.string().min(80).max(90)})),
  'patch /users/me':z.toJSONSchema(z.object({displayName:z.string().min(1).max(64)})),
  'post /movements':z.toJSONSchema(movementInput),
  'post /movements/{id}/versions':z.toJSONSchema(z.object({source:z.string().max(32768)})),
  'post /movements/validate':z.toJSONSchema(z.object({source:z.string().max(32768)})),
  'post /packs':z.toJSONSchema(z.object({movementId:uuid,slug:z.string().max(120),title:z.string().max(100),description:z.string().max(2000),category:z.enum(categories),rightsConfirmed:z.literal(true)})),
  'post /packs/{id}/listing-transaction':z.toJSONSchema(z.object({versionId:uuid,priceBaseUnits:z.string().regex(/^[1-9]\d{0,19}$/)})),
  'post /packs/{id}/confirm-publication':z.toJSONSchema(z.object({versionId:uuid})),
  'post /marketplace/{id}/purchases':z.toJSONSchema(z.object({signature:z.string().min(80).max(90)})),
  'post /reports':z.toJSONSchema(z.object({packId:uuid,reason:z.string().min(10).max(2000)})),
  'post /ai/generate':z.toJSONSchema(z.object({prompt:z.string().min(1).max(2000)})),
  'post /training/jobs':{type:'object',additionalProperties:false,required:['task'],properties:{task:{type:'string',enum:Object.keys(APPROVED_TRAINING_TASKS)},iterations:{type:'integer',minimum:100,maximum:4000},numEnvs:{type:'integer',enum:[128,256,512,1024,2048,4096]},maxDurationSeconds:{type:'integer',minimum:60,maximum:7200}}},
  'post /admin/training/quotas':z.toJSONSchema(z.object({userId:uuid,maxSecondsPerDay:z.number().int().min(0).max(28800)})),
  'post /admin/packs/{id}/review':{type:'object',required:['approved','reason','versionId'],properties:{approved:{type:'boolean'},reason:{type:'string',minLength:10,maxLength:2000},versionId:{type:'string',format:'uuid'},physicsEvidence:{type:'object',required:['robotVersion','scenarios'],properties:{robotVersion:{type:'string'},scenarios:{type:'array',items:{type:'object',required:['name','passed'],properties:{name:{type:'string'},passed:{type:'boolean'}}}}}}}},
};
const operations=[
  ['/health','get'],['/config','get'],['/auth/challenge','post'],['/auth/verify','post'],['/auth/session','get'],['/auth/signout','post'],['/users/me','patch'],['/users/{wallet}','get'],['/users/{wallet}/stats','get'],['/creator/stats','get'],['/wallet/balance','get'],['/movements','get'],['/movements','post'],['/movements/{id}/versions','post'],['/movements/{id}/versions','get'],['/movements/validate','post'],['/marketplace','get'],['/marketplace/{slug}','get'],['/marketplace/{id}/quote','get'],['/marketplace/{id}/purchase-transaction','post'],['/marketplace/{id}/purchases','post'],['/purchases','get'],['/library','get'],['/versions/{id}/asset','get'],['/packs','post'],['/packs/mine','get'],['/packs/{id}/listing-transaction','post'],['/packs/{id}/confirm-publication','post'],['/reports','post'],['/admin/metrics','get'],['/admin/submissions','get'],['/admin/packs/{id}/review','post'],['/admin/purchases/{id}/reconcile','post'],['/ai/generate','post'],['/training/config','get'],['/training/jobs','get'],['/training/jobs','post'],['/training/jobs/{id}/cancel','post'],['/training/jobs/{id}/artifacts','get'],['/admin/training/quotas','post']
];
const paths:Record<string,Record<string,unknown>>={};
for(const [path,method]of operations){
  const input=operationInputs[`${method} ${path}`];
  const parameters=[...path.matchAll(/\{(\w+)\}/g)].map(match=>({name:match[1],in:'path',required:true,schema:{type:'string'}}));
  paths[path]||={};paths[path][method]={summary:`${method.toUpperCase()} ${path}`,parameters,...(input?{requestBody:{required:true,content:{'application/json':{schema:input}}}}:{}),responses:{200:{description:'Operation succeeded'},201:{description:'Resource created'},202:{description:'Persisted and pending external verification or worker'},400:{description:'Invalid input'},401:{description:'Wallet authentication required'},403:{description:'Origin, CSRF, entitlement or administrator check failed'},404:{description:'Resource unavailable to this user'},409:{description:'Immutable version or lifecycle conflict'},429:{description:'Rate or resource quota exceeded'},503:{description:'Required external service is unconfigured or unavailable'}}};
}
const openapi={openapi:'3.1.0',info:{title:'DUCKLAB API',version:'1.0.0',description:'Wallet signatures establish sessions. Supply the readable CSRF token via X-CSRF-Token on authenticated mutations and the configured Origin on all mutations. Financial amounts are decimal strings in token base units. Runtime input validation uses the same Zod schemas used to generate these request schemas.'},servers:[{url:'/api/v1'}],components:{securitySchemes:{session:{type:'apiKey',in:'cookie',name:signCookie}}},paths};
