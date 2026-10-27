import test from 'node:test';
import assert from 'node:assert/strict';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { makeChallenge, verifyChallengeSignature, hashSecret } from '../src/auth.js';
import { readConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';
test('challenge binds domain wallet nonce and expiry; verifies only the exact message',()=>{
  const key=nacl.sign.keyPair(),wallet=bs58.encode(key.publicKey),challenge=makeChallenge(wallet,'https://ducklab.example',new Date('2026-01-01T00:00:00Z'),'fixedtestnonce');
  const signature=bs58.encode(nacl.sign.detached(new TextEncoder().encode(challenge.message),key.secretKey));
  assert.match(challenge.message,/ducklab.example wants you/);assert.match(challenge.message,/Nonce: fixedtestnonce/);assert.equal(challenge.expiresAt.toISOString(),'2026-01-01T00:05:00.000Z');
  assert.equal(verifyChallengeSignature(wallet,challenge.message,signature),true);assert.equal(verifyChallengeSignature(wallet,challenge.message+' ',signature),false);assert.equal(verifyChallengeSignature(wallet,challenge.message,'malformed'),false);assert.equal(hashSecret('x').length,64);
});
test('missing payment configuration fails closed and never invents addresses',()=>{const c=readConfig({});assert.equal(c.chain,undefined);assert.match(c.paymentReason,/QUACK_TOKEN_MINT/);assert.throws(()=>readConfig({NODE_ENV:'production',APP_ORIGIN:'http://example.com'}));});
test('unconfigured API remains inspectable; protected assets and writes stay protected',async()=>{
  const app=await buildApp({config:readConfig({}),logger:false});
  try{
    assert.equal((await app.inject('/api/v1/health')).statusCode,200);
    assert.deepEqual((await app.inject('/api/v1/marketplace')).json().items,[]);
    assert.equal((await app.inject('/api/v1/auth/session')).json().user,null);
    assert.equal((await app.inject('/api/v1/versions/38be9854-2e47-4e01-9267-ad604e078e6d/asset')).statusCode,401);
    assert.equal((await app.inject({method:'POST',url:'/api/v1/auth/challenge',headers:{origin:'https://attacker.example'},payload:{wallet:'11111111111111111111111111111111'}})).statusCode,403);
    assert.equal((await app.inject({method:'POST',url:'/api/v1/auth/challenge',headers:{origin:'http://localhost:5173'},payload:{wallet:'11111111111111111111111111111111'}})).statusCode,503);
    const valid=await app.inject({method:'POST',url:'/api/v1/movements/validate',headers:{origin:'http://localhost:5173'},payload:{source:'await duck.walk({ distance: 1 });'}});assert.equal(valid.statusCode,200);
    const bad=await app.inject({method:'POST',url:'/api/v1/movements/validate',headers:{origin:'http://localhost:5173'},payload:{source:'fetch("https://attacker.example");'}});assert.equal(bad.statusCode,400);
  }finally{await app.close();}
});
