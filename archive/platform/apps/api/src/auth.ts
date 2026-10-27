import { createHash, randomBytes } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
export const hashSecret=(value:string)=>createHash('sha256').update(value).digest('hex');
export const newSecret=()=>randomBytes(32).toString('base64url');
export function makeChallenge(wallet: string, origin: string, issuedAt = new Date(), nonce = randomBytes(16).toString('hex')) {
  const key=new PublicKey(wallet);
  if(key.toBase58()!==wallet) throw new Error('Invalid wallet address.');
  const expiresAt=new Date(issuedAt.getTime()+5*60*1000);
  const domain=new URL(origin).host;
  return {message:`${domain} wants you to sign in with your Solana account:\n${wallet}\n\nSign in to DUCKLAB. This signature does not authorize transactions.\n\nURI: ${origin}\nVersion: 1\nChain ID: solana\nNonce: ${nonce}\nIssued At: ${issuedAt.toISOString()}\nExpiration Time: ${expiresAt.toISOString()}`,expiresAt};
}
export function verifyChallengeSignature(wallet: string,message: string,signature: string): boolean {
  try { const bytes=bs58.decode(signature); return bytes.length===64 && nacl.sign.detached.verify(new TextEncoder().encode(message),bytes,new PublicKey(wallet).toBytes()); }
  catch { return false; }
}
