import bs58 from 'bs58';
import {decimalToBaseUnits} from './amounts';
export const SPL_TOKEN_PROGRAM='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export type TokenConfiguration={mint:string;rpcUrl:string;threshold:string;symbol:string;cluster:string;configured:boolean;reason:string};
export function isAddress(value:string){try{return typeof value==='string'&&bs58.decode(value).length===32;}catch{return false;}}
export function tokenConfiguration(env:Record<string,string|undefined>):TokenConfiguration{
  const mint=env.VITE_QUACK_TOKEN_MINT??'',cluster=env.VITE_SOLANA_CLUSTER??'devnet',rpcUrl=env.VITE_SOLANA_RPC_URL??(cluster==='mainnet-beta'?'https://api.mainnet-beta.solana.com':'https://api.devnet.solana.com'),threshold=env.VITE_QUACK_COSMETIC_THRESHOLD??'100',symbol=env.VITE_QUACK_TOKEN_SYMBOL??'QUACK';
  let reason='';if(!mint)reason='Token cosmetics are not configured. The original appearance and the entire game are free.';else if(!isAddress(mint))reason='The configured token mint is invalid.';else if(!/^\d+(\.\d+)?$/.test(threshold))reason='The cosmetic threshold is invalid.';
  try{const u=new URL(rpcUrl);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))reason='Use an HTTPS Solana RPC endpoint.';if(u.username||u.password)reason='RPC configuration must not embed private credentials.';}catch{reason='The Solana RPC URL is invalid.';}
  return {mint,rpcUrl,threshold,symbol,cluster,configured:!reason,reason};
}
export async function readTokenBalance(wallet:string,config:TokenConfiguration,signal?:AbortSignal){
  if(!config.configured)throw new Error(config.reason);if(!isAddress(wallet))throw new Error('Wallet address is invalid.');
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();
  async function rpc(method:string,params:unknown[]){const response=await fetch(config.rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:method,method,params}),signal:controller.signal});if(!response.ok)throw new Error(`Solana RPC is unavailable (${response.status}).`);const json=await response.json();if(json.error)throw new Error('Solana RPC could not verify the token balance.');if(!json.result)throw new Error('Invalid RPC response.');return json.result;}
  try{
    const mint=await rpc('getAccountInfo',[config.mint,{encoding:'jsonParsed',commitment:'finalized'}]);
    if(!Number.isSafeInteger(mint.context?.slot)||mint.context.slot<0)throw new Error('Invalid mint context.');
    const account=mint.value,info=account?.data?.parsed?.info;
    if(!account||account.owner!==SPL_TOKEN_PROGRAM||account.executable||account.data?.parsed?.type!=='mint'||info?.isInitialized!==true)throw new Error('Configured address is not an initialized SPL token mint.');
    const decimals=info.decimals;if(!Number.isInteger(decimals)||decimals<0||decimals>18)throw new Error('Unsupported token decimals.');
    const threshold=decimalToBaseUnits(config.threshold,decimals);
    const result=await rpc('getTokenAccountsByOwner',[wallet,{mint:config.mint},{encoding:'jsonParsed',commitment:'finalized',minContextSlot:mint.context.slot}]);
    if(!Array.isArray(result.value)||result.value.length>10000||!Number.isSafeInteger(result.context?.slot)||result.context.slot<mint.context.slot)throw new Error('Invalid token account response.');
    let amount=0n;for(const entry of result.value){const a=entry.account,parsed=a?.data?.parsed,token=parsed?.info;
      if(a?.owner!==SPL_TOKEN_PROGRAM||parsed?.type!=='account'||token?.mint!==config.mint||token?.owner!==wallet||token?.tokenAmount?.decimals!==decimals||!['initialized','frozen'].includes(token?.state)||!/^\d{1,20}$/.test(token?.tokenAmount?.amount??''))throw new Error('RPC returned an unexpected token account.');
      const value=BigInt(token.tokenAmount.amount);if(value>18446744073709551615n)throw new Error('Invalid token account amount.');amount+=value;
    }
    if(amount>18446744073709551615n)throw new Error('Invalid total token balance.');
    return {amount,decimals,threshold,eligible:amount>=threshold,slot:result.context.slot,mint:config.mint,checkedAt:Date.now()};
  }finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}
