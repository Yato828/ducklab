import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { MarketplaceChain } from '../../../packages/solana/src/marketplace.js';
import { transaction } from './db.js';
export async function reconcilePurchase(pool: pg.Pool,chain: MarketplaceChain,purchaseId:string) {
  const {rows}=await pool.query(`SELECT p.*, wi.wallet, l.listing_address,l.seller_wallet,l.manifest_hash,l.price_base_units::text,l.version_id
    FROM purchases p JOIN wallet_identities wi ON wi.user_id=p.buyer_id JOIN marketplace_listings l ON l.id=p.listing_id WHERE p.id=$1`,[purchaseId]);
  const p=rows[0];if(!p) throw new Error('Purchase not found.');
  if(p.status==='finalized')return {status:'finalized'};
  const receipt=await chain.verifyPurchase({address:p.listing_address,seller:p.seller_wallet,manifestHash:p.manifest_hash,priceBaseUnits:p.price_base_units},p.wallet,p.signature);
  await transaction(pool,async client=>{
    const lock=await client.query('SELECT status FROM purchases WHERE id=$1 FOR UPDATE',[purchaseId]);
    if(lock.rows[0].status==='finalized')return;
    await client.query('INSERT INTO onchain_receipts(address,purchase_id,listing_address,buyer_wallet,manifest_hash,amount,seller_paid,platform_fee,slot,signature) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(address) DO NOTHING',[receipt.address,purchaseId,receipt.listingAddress,receipt.buyerWallet,receipt.manifestHash,receipt.amount,receipt.sellerPaid,receipt.platformFee,receipt.slot,receipt.signature]);
    const stored=await client.query('SELECT purchase_id,buyer_wallet,manifest_hash FROM onchain_receipts WHERE address=$1',[receipt.address]);
    if(stored.rows[0]?.purchase_id!==purchaseId || stored.rows[0]?.buyer_wallet!==p.wallet || stored.rows[0]?.manifest_hash!==p.manifest_hash)throw new Error('Receipt has already been attached to a different purchase.');
    await client.query('INSERT INTO ownership_entitlements(id,user_id,version_id,receipt_address) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,version_id) DO NOTHING',[randomUUID(),p.buyer_id,p.version_id,receipt.address]);
    await client.query("UPDATE purchases SET status='finalized',finalized_at=now(),last_error=NULL WHERE id=$1",[purchaseId]);
  });
  return {status:'finalized',receipt:receipt.address};
}
