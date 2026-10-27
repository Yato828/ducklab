import { createHash } from 'node:crypto';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, getMint } from '@solana/spl-token';
import bs58 from 'bs58';
import { parseBaseUnits, splitPayment } from './amounts.js';

export type ChainConfig = { rpcUrl: string; programId: string; mint: string; treasury: string; tokenProgram: string };
export type ListingExpectation = { address: string; seller: string; manifestHash: string; priceBaseUnits: string };
const discriminator = (kind: string, name: string) => createHash('sha256').update(`${kind}:${name}`).digest().subarray(0,8);
const keyAt = (data: Buffer, offset: number) => new PublicKey(data.subarray(offset,offset+32));
export function addresses(config: ChainConfig, seller: string, hash: string, buyer?: string) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid manifest hash.');
  const program = new PublicKey(config.programId);
  const [marketplace] = PublicKey.findProgramAddressSync([Buffer.from('config')], program);
  const [listing] = PublicKey.findProgramAddressSync([Buffer.from('listing'), new PublicKey(seller).toBuffer(), Buffer.from(hash,'hex')], program);
  const receipt = buyer ? PublicKey.findProgramAddressSync([Buffer.from('receipt'), listing.toBuffer(), new PublicKey(buyer).toBuffer()], program)[0] : undefined;
  return { program, marketplace, listing, receipt };
}
export function decodeReceipt(data: Buffer) {
  if(data.length !== 201 || !data.subarray(0,8).equals(discriminator('account','PurchaseReceipt'))) throw new Error('Invalid purchase receipt layout.');
  return { listing:keyAt(data,8).toBase58(), buyer:keyAt(data,40).toBase58(), seller:keyAt(data,72).toBase58(), mint:keyAt(data,104).toBase58(), manifestHash:data.subarray(136,168).toString('hex'), paid:data.readBigUInt64LE(168), sellerPaid:data.readBigUInt64LE(176), fee:data.readBigUInt64LE(184), slot:data.readBigUInt64LE(192) };
}
export class MarketplaceChain {
  connection: Connection;
  constructor(readonly config: ChainConfig, connection?: Connection) {
    if (config.tokenProgram !== TOKEN_PROGRAM_ID.toBase58()) throw new Error('Only the audited legacy SPL Token Program is currently supported.');
    this.connection = connection || new Connection(config.rpcUrl,'finalized');
  }
  async quote(expected: ListingExpectation, buyer?: string) {
    const a=addresses(this.config,expected.seller,expected.manifestHash,buyer);
    if(a.listing.toBase58()!==expected.address) throw new Error('Database listing does not match its immutable PDA.');
    const accounts=await this.connection.getMultipleAccountsInfo([a.marketplace,a.listing],'finalized');
    const [c,l]=accounts;
    if(!c || !l || !c.owner.equals(a.program) || !l.owner.equals(a.program)) throw new Error('Marketplace accounts are missing or owned by another program.');
    if(c.data.length!==139 || !c.data.subarray(0,8).equals(discriminator('account','MarketplaceConfig'))) throw new Error('Invalid marketplace configuration layout.');
    if(!keyAt(c.data,72).equals(new PublicKey(this.config.mint)) || !keyAt(c.data,104).equals(new PublicKey(this.config.treasury))) throw new Error('Onchain mint or treasury differs from server configuration.');
    if(l.data.length!==116 || !l.data.subarray(0,8).equals(discriminator('account','Listing'))) throw new Error('Invalid listing layout.');
    const seller=keyAt(l.data,40).toBase58(), manifestHash=l.data.subarray(72,104).toString('hex'), price=l.data.readBigUInt64LE(104), feeBps=l.data.readUInt16LE(112), active=l.data[114]===1;
    if(!keyAt(l.data,8).equals(a.marketplace) || seller!==expected.seller || manifestHash!==expected.manifestHash || price!==parseBaseUnits(expected.priceBaseUnits)) throw new Error('Onchain listing does not match the approved immutable version.');
    if(feeBps>10000) throw new Error('Invalid onchain fee.');
    const mint=await getMint(this.connection,new PublicKey(this.config.mint),'finalized',TOKEN_PROGRAM_ID);
    const split=splitPayment(price,feeBps);
    return { listingAddress:expected.address,seller,manifestHash,priceBaseUnits:price.toString(),sellerBaseUnits:split.seller.toString(),feeBaseUnits:split.fee.toString(),feeBps,decimals:mint.decimals,mint:this.config.mint,treasury:this.config.treasury,programId:this.config.programId,active,receiptAddress:a.receipt?.toBase58() };
  }
  async buildListing(sellerWallet:string,manifestHash:string,priceBaseUnits:string,publisher:Keypair) {
    const a=addresses(this.config,sellerWallet,manifestHash);
    const config=await this.connection.getAccountInfo(a.marketplace,'finalized');
    if(!config || !config.owner.equals(a.program) || config.data.length!==139 || !config.data.subarray(0,8).equals(discriminator('account','MarketplaceConfig')) || !keyAt(config.data,40).equals(publisher.publicKey) || keyAt(config.data,72).toBase58()!==this.config.mint || keyAt(config.data,104).toBase58()!==this.config.treasury) throw new Error('Publisher, mint or treasury does not match the initialized marketplace.');
    const amount=parseBaseUnits(priceBaseUnits);if(amount===0n)throw new Error('Price must be positive.');
    const seller=new PublicKey(sellerWallet), data=Buffer.alloc(48);
    discriminator('global','create_listing').copy(data);Buffer.from(manifestHash,'hex').copy(data,8);data.writeBigUInt64LE(amount,40);
    const block=await this.connection.getLatestBlockhash('finalized');
    const tx=new Transaction({feePayer:seller,blockhash:block.blockhash,lastValidBlockHeight:block.lastValidBlockHeight}).add(new TransactionInstruction({programId:a.program,keys:[{pubkey:a.marketplace,isSigner:false,isWritable:false},{pubkey:publisher.publicKey,isSigner:true,isWritable:false},{pubkey:seller,isSigner:true,isWritable:true},{pubkey:a.listing,isSigner:false,isWritable:true},{pubkey:SystemProgram.programId,isSigner:false,isWritable:false}],data}));
    tx.partialSign(publisher);
    return {listingAddress:a.listing.toBase58(),transaction:tx.serialize({requireAllSignatures:false,verifySignatures:false}).toString('base64'),lastValidBlockHeight:block.lastValidBlockHeight,feeBps:config.data.readUInt16LE(136)};
  }
  async buildPurchase(expected: ListingExpectation,buyerWallet: string) {
    const quote=await this.quote(expected,buyerWallet);
    if(!quote.active) throw new Error('This listing is delisted.');
    const buyer=new PublicKey(buyerWallet), seller=new PublicKey(expected.seller), treasury=new PublicKey(this.config.treasury),mint=new PublicKey(this.config.mint);
    if(buyer.equals(seller) || buyer.equals(treasury) || seller.equals(treasury)) throw new Error('Buyer, seller and treasury must be distinct.');
    const a=addresses(this.config,expected.seller,expected.manifestHash,buyerWallet);
    if(await this.connection.getAccountInfo(a.receipt!,'finalized')) throw new Error('Wallet already owns this version.');
    const buyerAta=getAssociatedTokenAddressSync(mint,buyer), sellerAta=getAssociatedTokenAddressSync(mint,seller),treasuryAta=getAssociatedTokenAddressSync(mint,treasury);
    const data=Buffer.alloc(16);discriminator('global','purchase').copy(data);data.writeBigUInt64LE(parseBaseUnits(expected.priceBaseUnits),8);
    const block=await this.connection.getLatestBlockhash('finalized');
    const tx=new Transaction({feePayer:buyer,blockhash:block.blockhash,lastValidBlockHeight:block.lastValidBlockHeight});
    for(const [ata,owner] of [[sellerAta,seller],[treasuryAta,treasury]]) tx.add(createAssociatedTokenAccountIdempotentInstruction(buyer,ata,mint,owner));
    tx.add(new TransactionInstruction({programId:a.program,keys:[{pubkey:a.marketplace,isSigner:false,isWritable:false},{pubkey:a.listing,isSigner:false,isWritable:false},{pubkey:buyer,isSigner:true,isWritable:true},{pubkey:mint,isSigner:false,isWritable:false},{pubkey:buyerAta,isSigner:false,isWritable:true},{pubkey:sellerAta,isSigner:false,isWritable:true},{pubkey:treasuryAta,isSigner:false,isWritable:true},{pubkey:a.receipt!,isSigner:false,isWritable:true},{pubkey:TOKEN_PROGRAM_ID,isSigner:false,isWritable:false},{pubkey:SystemProgram.programId,isSigner:false,isWritable:false}],data}));
    const fee=await this.connection.getFeeForMessage(tx.compileMessage(),'finalized');
    return {quote,transaction:tx.serialize({requireAllSignatures:false,verifySignatures:false}).toString('base64'),lastValidBlockHeight:block.lastValidBlockHeight,estimatedFeeLamports:fee.value};
  }
  async verifyPurchase(expected: ListingExpectation,buyer: string,signature: string) {
    if(bs58.decode(signature).length!==64) throw new Error('Invalid transaction signature.');
    const quote=await this.quote(expected,buyer);
    const a=addresses(this.config,expected.seller,expected.manifestHash,buyer);
    const [tx,receiptAccount]=await Promise.all([this.connection.getParsedTransaction(signature,{commitment:'finalized',maxSupportedTransactionVersion:0}),this.connection.getAccountInfo(a.receipt!,'finalized')]);
    if(!tx) throw new Error('Transaction is not finalized or is unavailable.');
    if(!tx.meta || tx.meta.err) throw new Error('Transaction failed.');
    if(!receiptAccount || !receiptAccount.owner.equals(a.program)) throw new Error('Program-owned receipt is missing.');
    const receipt=decodeReceipt(receiptAccount.data);
    if(receipt.listing!==expected.address || receipt.buyer!==buyer || receipt.seller!==expected.seller || receipt.mint!==this.config.mint || receipt.manifestHash!==expected.manifestHash || receipt.paid.toString()!==expected.priceBaseUnits || receipt.sellerPaid.toString()!==quote.sellerBaseUnits || receipt.fee.toString()!==quote.feeBaseUnits || receipt.slot!==BigInt(tx.slot)) throw new Error('Receipt does not match buyer, listing, price, fee, version or transaction slot.');
    if(!tx.transaction.message.accountKeys.some(k=>k.signer && k.pubkey.toBase58()===buyer)) throw new Error('Buyer did not sign this transaction.');
    const instruction=tx.transaction.message.instructions.find(ix=> 'accounts' in ix && ix.programId.equals(a.program) && ix.accounts[0]?.equals(a.marketplace) && ix.accounts[1]?.equals(a.listing) && ix.accounts[2]?.toBase58()===buyer && ix.accounts[7]?.equals(a.receipt!));
    if(!instruction || !('data' in instruction)) throw new Error('Transaction did not execute the marketplace purchase instruction.');
    const ixData=Buffer.from(bs58.decode(instruction.data));
    if(ixData.length!==16 || !ixData.subarray(0,8).equals(discriminator('global','purchase')) || ixData.readBigUInt64LE(8)!==receipt.paid) throw new Error('Purchase instruction has unexpected data.');
    return {address:a.receipt!.toBase58(),buyerWallet:buyer,listingAddress:expected.address,manifestHash:expected.manifestHash,amount:receipt.paid.toString(),sellerPaid:receipt.sellerPaid.toString(),platformFee:receipt.fee.toString(),slot:tx.slot,signature};
  }
}
