import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import type { ChainConfig } from '../../../packages/solana/src/marketplace.js';
export type AppConfig = {
  port: number; origin: string; production: boolean; databaseUrl?: string; sessionHours: number;
  network: string; tokenSymbol: string; chain?: ChainConfig; paymentReason: string;
  adminWallets: Set<string>; openaiKey?: string; openaiModel: string; trainingConfigured: boolean;
};
export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const origin = new URL(env.APP_ORIGIN || 'http://localhost:5173').origin;
  const network=env.SOLANA_CLUSTER || 'devnet';
  if(!['localnet','devnet','mainnet-beta'].includes(network)) throw new Error('SOLANA_CLUSTER must be localnet, devnet, or mainnet-beta.');
  const required=['SOLANA_RPC_URL','QUACK_TOKEN_MINT','QUACK_TOKEN_PROGRAM','MARKETPLACE_PROGRAM_ID','MARKETPLACE_TREASURY_ADDRESS'] as const;
  const missing=required.filter(key=>!env[key]);
  let paymentReason=missing.length ? `Configure ${missing.join(', ')}.` : '';
  let chain: ChainConfig|undefined;
  if(!missing.length) {
    for(const key of required.filter(x=>x!=='SOLANA_RPC_URL')) new PublicKey(env[key]!);
    const rpc=new URL(env.SOLANA_RPC_URL!);
    if(!['http:','https:'].includes(rpc.protocol)) throw new Error('RPC must be HTTP(S).');
    if(env.QUACK_TOKEN_PROGRAM!==TOKEN_PROGRAM_ID.toBase58()) throw new Error('Token-2022 is not yet supported; configure the legacy SPL Token Program.');
    if(network==='mainnet-beta' && env.ALLOW_MAINNET_PAYMENTS!=='true') paymentReason='Mainnet payments require an explicit deployment review and ALLOW_MAINNET_PAYMENTS=true.';
    else chain={rpcUrl:env.SOLANA_RPC_URL!,mint:env.QUACK_TOKEN_MINT!,tokenProgram:env.QUACK_TOKEN_PROGRAM!,programId:env.MARKETPLACE_PROGRAM_ID!,treasury:env.MARKETPLACE_TREASURY_ADDRESS!};
  }
  const production=env.NODE_ENV==='production';
  if(production && !origin.startsWith('https://')) throw new Error('Production APP_ORIGIN must use HTTPS.');
  return {port:Number(env.API_PORT||3001),origin,production,databaseUrl:env.DATABASE_URL,sessionHours:24,network,tokenSymbol:env.TOKEN_SYMBOL||'QUACK',chain,paymentReason,adminWallets:new Set((env.ADMIN_WALLETS||'').split(',').map(x=>x.trim()).filter(Boolean)),openaiKey:env.OPENAI_API_KEY,openaiModel:env.OPENAI_MODEL||'gpt-4.1-mini',trainingConfigured:Boolean(env.REDIS_URL && env.TRAINING_ENABLED==='true')};
}
