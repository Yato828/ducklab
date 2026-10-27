import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Keypair,PublicKey } from '@solana/web3.js';
import { MintLayout,TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import { MarketplaceChain,addresses,decodeReceipt } from '../src/marketplace.js';
const disc=(kind:string,name:string)=>createHash('sha256').update(`${kind}:${name}`).digest().subarray(0,8);
function fixture(){
  const buyer=Keypair.generate().publicKey,seller=Keypair.generate().publicKey,mint=Keypair.generate().publicKey,treasury=Keypair.generate().publicKey,program=Keypair.generate().publicKey,hash='a'.repeat(64),config={rpcUrl:'http://unused.test',programId:program.toBase58(),mint:mint.toBase58(),treasury:treasury.toBase58(),tokenProgram:TOKEN_PROGRAM_ID.toBase58()};
  const a=addresses(config,seller.toBase58(),hash,buyer.toBase58());
  const c=Buffer.alloc(139);disc('account','MarketplaceConfig').copy(c);mint.toBuffer().copy(c,72);treasury.toBuffer().copy(c,104);c.writeUInt16LE(1000,136);
  const l=Buffer.alloc(116);disc('account','Listing').copy(l);a.marketplace.toBuffer().copy(l,8);seller.toBuffer().copy(l,40);Buffer.from(hash,'hex').copy(l,72);l.writeBigUInt64LE(1000n,104);l.writeUInt16LE(1000,112);l[114]=1;
  const receipt=Buffer.alloc(201);disc('account','PurchaseReceipt').copy(receipt);a.listing.toBuffer().copy(receipt,8);buyer.toBuffer().copy(receipt,40);seller.toBuffer().copy(receipt,72);mint.toBuffer().copy(receipt,104);Buffer.from(hash,'hex').copy(receipt,136);receipt.writeBigUInt64LE(1000n,168);receipt.writeBigUInt64LE(900n,176);receipt.writeBigUInt64LE(100n,184);receipt.writeBigUInt64LE(123n,192);
  const mintData=Buffer.alloc(82);MintLayout.encode({mintAuthorityOption:0,mintAuthority:PublicKey.default,supply:1000000n,decimals:6,isInitialized:true,freezeAuthorityOption:0,freezeAuthority:PublicKey.default},mintData);
  const ix=Buffer.alloc(16);disc('global','purchase').copy(ix);ix.writeBigUInt64LE(1000n,8);
  const keys=[a.marketplace,a.listing,buyer,mint,Keypair.generate().publicKey,Keypair.generate().publicKey,Keypair.generate().publicKey,a.receipt!];
  const tx={slot:123,meta:{err:null},transaction:{message:{accountKeys:[{pubkey:buyer,signer:true}],instructions:[{programId:program,accounts:keys,data:bs58.encode(ix)}]}}};
  const state:{owner:PublicKey;receipt:Buffer|null;tx:typeof tx|null}={owner:program,receipt,tx};
  const connection={getMultipleAccountsInfo:async()=>[{owner:program,data:c},{owner:program,data:l}],getAccountInfo:async(key:PublicKey)=>key.equals(mint)?{owner:TOKEN_PROGRAM_ID,data:mintData}:state.receipt?{owner:state.owner,data:state.receipt}:null,getParsedTransaction:async()=>state.tx};
  const chain=new MarketplaceChain(config,connection as never),expected={address:a.listing.toBase58(),seller:seller.toBase58(),manifestHash:hash,priceBaseUnits:'1000'},signature=bs58.encode(new Uint8Array(64).fill(7));
  return {chain,expected,buyer:buyer.toBase58(),signature,state,a,receipt,tx,config};
}
test('finalized receipt verification checks complete immutable purchase fixture',async()=>{const f=fixture();const receipt=await f.chain.verifyPurchase(f.expected,f.buyer,f.signature);assert.equal(receipt.amount,'1000');assert.equal(receipt.slot,123);assert.equal(receipt.address,f.a.receipt!.toBase58());});
test('receipt rejects wrong buyer, mint, seller, hash, fee, amount, slot and program owner',async()=>{
  for(const offset of [40,72,104,136,168,176,184,192]){const f=fixture();f.receipt[offset]^=1;await assert.rejects(f.chain.verifyPurchase(f.expected,f.buyer,f.signature),/Receipt does not match/);}
  const f=fixture();f.state.owner=Keypair.generate().publicKey;await assert.rejects(f.chain.verifyPurchase(f.expected,f.buyer,f.signature),/Program-owned receipt/);
});
test('receipt rejects missing finality, failed transactions, missing instruction and absent buyer signature',async()=>{
  const missing=fixture();missing.state.tx=null;await assert.rejects(missing.chain.verifyPurchase(missing.expected,missing.buyer,missing.signature),/not finalized/);
  const failed=fixture();(failed.tx.meta as any).err={InstructionError:[0,'failed']};await assert.rejects(failed.chain.verifyPurchase(failed.expected,failed.buyer,failed.signature),/Transaction failed/);
  const unsigned=fixture();unsigned.tx.transaction.message.accountKeys[0].signer=false;await assert.rejects(unsigned.chain.verifyPurchase(unsigned.expected,unsigned.buyer,unsigned.signature),/Buyer did not sign/);
  const unrelated=fixture();unrelated.tx.transaction.message.instructions=[];await assert.rejects(unrelated.chain.verifyPurchase(unrelated.expected,unrelated.buyer,unrelated.signature),/did not execute/);
});
test('receipt layout and PDA bind exact version and buyer',()=>{assert.throws(()=>decodeReceipt(Buffer.alloc(201)),/layout/);const f=fixture();assert.equal(addresses(f.config,f.expected.seller,f.expected.manifestHash,f.buyer).receipt!.toBase58(),f.a.receipt!.toBase58());assert.notEqual(addresses(f.config,f.expected.seller,f.expected.manifestHash,Keypair.generate().publicKey.toBase58()).receipt!.toBase58(),f.a.receipt!.toBase58());});
