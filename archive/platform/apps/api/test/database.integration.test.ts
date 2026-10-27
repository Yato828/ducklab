import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { buildApp } from '../src/app.js';
import { readConfig } from '../src/config.js';

test('real PostgreSQL: SIWS replay, ownership, immutable versions, moderation and protected assets', {skip:!process.env.TEST_DATABASE_URL},async()=>{
  const schema=`ducklab_test_${randomUUID().replaceAll('-','')}`,bootstrap=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});
  await bootstrap.query(`CREATE SCHEMA ${schema}`);
  const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${schema}`});
  const creator=nacl.sign.keyPair(),other=nacl.sign.keyPair(),administrator=nacl.sign.keyPair(),origin='http://localhost:5173';
  const config=readConfig({APP_ORIGIN:origin,ADMIN_WALLETS:bs58.encode(administrator.publicKey)});
  let app:Awaited<ReturnType<typeof buildApp>>|undefined;
  try{
    await pool.query(await readFile(new URL('../../../packages/database/migrations/001_initial.sql',import.meta.url),'utf8'));
    app=await buildApp({config,pool,logger:false});
    async function login(key:ReturnType<typeof nacl.sign.keyPair>){
      const wallet=bs58.encode(key.publicKey);
      const challenge=await app!.inject({method:'POST',url:'/api/v1/auth/challenge',headers:{origin},payload:{wallet}});assert.equal(challenge.statusCode,200,challenge.body);
      const c=challenge.json(),signature=bs58.encode(nacl.sign.detached(new TextEncoder().encode(c.message),key.secretKey));
      const signed=await app!.inject({method:'POST',url:'/api/v1/auth/verify',headers:{origin},payload:{challengeId:c.challengeId,signature}});assert.equal(signed.statusCode,200,signed.body);
      const cookies=signed.cookies.map(cookie=>`${cookie.name}=${cookie.value}`).join('; ');
      return {headers:{origin,cookie:cookies,'x-csrf-token':signed.json().csrfToken},user:signed.json().user,challengeId:c.challengeId,signature};
    }
    const owner=await login(creator),stranger=await login(other),admin=await login(administrator);
    assert.equal((await app.inject({method:'POST',url:'/api/v1/auth/verify',headers:{origin},payload:{challengeId:owner.challengeId,signature:owner.signature}})).statusCode,401,'challenge must be single use');
    assert.equal((await app.inject({method:'POST',url:'/api/v1/movements',headers:{origin,cookie:owner.headers.cookie},payload:{name:'Missing CSRF',source:'await duck.stand();'}})).statusCode,403);
    const created=await app.inject({method:'POST',url:'/api/v1/movements',headers:owner.headers,payload:{name:'Measured walk',source:'await duck.walk({distance:0.25});',category:'Walking'}});assert.equal(created.statusCode,201,created.body);
    const movement=created.json();assert.equal(movement.validation.physics,false);
    assert.equal((await app.inject({method:'GET',url:`/api/v1/versions/${movement.versionId}/asset`,headers:owner.headers})).statusCode,200);
    assert.equal((await app.inject({method:'GET',url:`/api/v1/versions/${movement.versionId}/asset`,headers:stranger.headers})).statusCode,404,'source must not leak to another signed-in wallet');
    const asset=(await app.inject({method:'GET',url:`/api/v1/versions/${movement.versionId}/asset`,headers:owner.headers}));assert.equal(asset.headers['cache-control'],'private, no-store');
    await assert.rejects(pool.query('UPDATE movement_versions SET source=$1 WHERE id=$2',['tampered',movement.versionId]),/immutable/);
    const pack=await app.inject({method:'POST',url:'/api/v1/packs',headers:owner.headers,payload:{movementId:movement.id,slug:`measured-walk-${randomUUID()}`,title:'Measured walk',description:'A short physically controlled walk.',category:'Walking',rightsConfirmed:true}});assert.equal(pack.statusCode,201,pack.body);const packId=pack.json().id;
    assert.equal((await app.inject('/api/v1/marketplace')).json().items.length,0,'submission does not appear as a sale');
    assert.equal((await app.inject({method:'GET',url:'/api/v1/admin/submissions',headers:owner.headers})).statusCode,403);
    assert.equal((await app.inject({method:'POST',url:`/api/v1/admin/packs/${packId}/review`,headers:admin.headers,payload:{approved:true,reason:'Insufficient evidence test',versionId:movement.versionId}})).statusCode,400);
    const reviewed=await app.inject({method:'POST',url:`/api/v1/admin/packs/${packId}/review`,headers:admin.headers,payload:{approved:true,reason:'Test fixture administrative review',versionId:movement.versionId,physicsEvidence:{robotVersion:'integration-test-fixture',scenarios:[{name:'test-fixture',passed:true}]}}});assert.equal(reviewed.statusCode,200,reviewed.body);
    const newVersion=await app.inject({method:'POST',url:`/api/v1/movements/${movement.id}/versions`,headers:owner.headers,payload:{source:'await duck.turn({degrees:30});'}});assert.equal(newVersion.statusCode,200,newVersion.body);
    const bypass=await app.inject({method:'POST',url:`/api/v1/packs/${packId}/listing-transaction`,headers:owner.headers,payload:{versionId:newVersion.json().versionId,priceBaseUnits:'1000'}});assert.equal(bypass.statusCode,409,'approval cannot be reused for a different immutable version');
    const fakePurchase=await app.inject({method:'POST',url:`/api/v1/marketplace/${randomUUID()}/purchases`,headers:stranger.headers,payload:{signature:bs58.encode(nacl.sign.detached(new TextEncoder().encode('forged purchase claim'),other.secretKey))}});assert.equal(fakePurchase.statusCode,503);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM ownership_entitlements')).rows[0].count,0,'frontend claims cannot create ownership');
    await app.inject({method:'POST',url:'/api/v1/auth/signout',headers:owner.headers});
    assert.equal((await app.inject({method:'GET',url:'/api/v1/auth/session',headers:owner.headers})).json().user,null);
  }finally{await app?.close();await pool.end();await bootstrap.query(`DROP SCHEMA ${schema} CASCADE`);await bootstrap.end();}
});
