"use strict";
/* Crimson verified-live trade journal.
 *
 * - No swaps, signers, or funding functions are implemented here.
 * - An eventual trusted executor must call recordFinalized({signature, wallet,
 *   mint, side, intentId}); this method NEVER accepts unverified prices.
 * - It pulls FINALIZED on-chain state from Solana RPC, verifies the intended
 *   wallet signed, then derives actual wallet-net SOL per token from balances.
 * - Native SOL wallet delta includes network fees, ATA rent and refunds;
 *   therefore price is EFFECTIVE NET WALLET COST, not DEX execution quote.
 * - Do not expose a public "record trade" API. Read-only owner session only.
 */
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const ABC="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const WRAPPED_SOL="So11111111111111111111111111111111111111112";
const validPublic=x=>typeof x==="string"&&x.length>=32&&x.length<=44&&
 [...x].every(c=>ABC.includes(c));
const validSig=x=>typeof x==="string"&&x.length>=80&&x.length<=90&&
 [...x].every(c=>ABC.includes(c));
const rawNumber=x=>{
 if(typeof x!=="string"||!/^(?:0|[1-9][0-9]*)$/.test(x))throw Error("Invalid token amount");
 return BigInt(x);
};
const whole=x=>{
 if(typeof x!=="number"||!Number.isSafeInteger(x)||x<0)throw Error("Invalid integer lamports");
 return BigInt(x);
};
const abs=x=>x<0n?-x:x;
function decimalRatio(numerator,denominator,places=18){
 if(denominator<=0n||numerator<0n||places<1||places>24)throw Error("Invalid ratio");
 const base=10n**BigInt(places);
 const whole=(numerator*base)/denominator;
 const integer=whole/base,frac=String(whole%base).padStart(places,"0").replace(/0+$/,"");
 return String(integer)+(frac?"."+frac:"");
}
function extractBalance(items,owner,mint){
 const matching=(Array.isArray(items)?items:[]).filter(x=>
   x.owner===owner&&x.mint===mint);
 let amount=0n,decimals=null;
 for(const x of matching){
   const u=x.uiTokenAmount||{};
   if(!Number.isInteger(u.decimals)||u.decimals<0||u.decimals>18)throw Error("Invalid token decimals");
   if(decimals!==null&&decimals!==u.decimals)throw Error("Inconsistent token decimals");
   decimals=u.decimals;
   amount+=rawNumber(u.amount);
 }
 return {amount,decimals};
}
function verifyReceipt(tx,{signature,wallet,mint,side}){
 if(!validSig(signature)||!validPublic(wallet)||!validPublic(mint)||mint===WRAPPED_SOL||
    !["BUY","SELL"].includes(side))throw Error("Invalid intended SOL/token trade");
 if(!tx||tx.meta?.err!==null||!tx.meta||!tx.transaction)
   throw Error("Transaction is not a successful finalized swap");
 if(!Array.isArray(tx.transaction.signatures)||
    !tx.transaction.signatures.includes(signature))
   throw Error("Confirmed signature does not match intent");
 const keys=tx.transaction.message?.accountKeys;
 if(!Array.isArray(keys))throw Error("Missing parsed account keys");
 const signerIndex=keys.findIndex(x=>x?.pubkey===wallet&&x.signer===true);
 if(signerIndex<0)throw Error("Intended wallet did not sign the finalized transaction");
 const pre=tx.meta.preBalances?.[signerIndex],post=tx.meta.postBalances?.[signerIndex];
 const nativeDelta=whole(post)-whole(pre);
 const fee=whole(tx.meta.fee);
 const before=extractBalance(tx.meta.preTokenBalances,wallet,mint);
 const after=extractBalance(tx.meta.postTokenBalances,wallet,mint);
 const decimals=after.decimals??before.decimals;
 if(decimals===null||(before.decimals!==null&&after.decimals!==null&&
    before.decimals!==after.decimals))throw Error("Token decimals absent or inconsistent");
 const tokenDelta=after.amount-before.amount;
 if(side==="BUY"&&!(tokenDelta>0n&&nativeDelta<0n))
   throw Error("BUY not proved by wallet balance movements");
 if(side==="SELL"&&!(tokenDelta<0n&&nativeDelta>0n))
   throw Error("SELL not proved by wallet balance movements");
 // Reject any other non-SOL token changes: complex migrations or mixed swaps
 // need a more detailed verified multi-leg ledger, not a guessed price.
 const allMints=new Set([...(tx.meta.preTokenBalances||[]),
   ...(tx.meta.postTokenBalances||[])].filter(x=>x?.owner===wallet).map(x=>x.mint));
 for(const other of allMints){
   if(other===mint)continue;
   const b=extractBalance(tx.meta.preTokenBalances,wallet,other);
   const a=extractBalance(tx.meta.postTokenBalances,wallet,other);
   if(a.amount!==b.amount)
     throw Error("Additional token asset movement; cannot attribute effective SOL price");
 }
 const tokenQty=abs(tokenDelta),solQty=abs(nativeDelta),tokenUnits=10n**BigInt(decimals);
 const price=decimalRatio(solQty*tokenUnits,tokenQty*1000000000n);
 const execution={
  signature,side,mint,wallet,slot:tx.slot,blockTime:tx.blockTime??null,
  tokenRaw:tokenQty.toString(),tokenDecimals:decimals,
  effectiveSolLamports:solQty.toString(),transactionFeeLamports:fee.toString(),
  effectivePriceSolPerToken:price,
  accountingMethod:"NET_WALLET_SOL_CHANGE_INCLUDES_FEES_AND_RENT",
  signedByWallet:true,commitment:"finalized",chain:"solana-mainnet",
  note:"Effective SOL/token price from finalized wallet balance changes; includes tx fees, token-account rent and refunds. Not a raw Jupiter swap fill quote."
 };
 return execution;
}
class LiveTradeJournal{
 constructor({directory=process.env.BOT_DATA_DIR,fetchFn=globalThis.fetch,
   rpc=process.env.SOLANA_RPC_URL||"https://api.mainnet-beta.solana.com",
   wallet=process.env.BOT_DEDICATED_WALLET_ADDRESS}={}){
  this.directory=directory;this.filename=directory?path.join(directory,"live-trades-v1.json"):null;
  this.fetchFn=fetchFn;this.rpc=rpc;this.wallet=wallet;
 }
 configured(){return !!this.filename&&validPublic(this.wallet);}
 read(){
  if(!this.filename)return {version:1,transactions:[]};
  try{
   const size=fs.statSync(this.filename).size;
   if(size>10*1024*1024)throw Error("Live journal too large: inspect manually");
   const data=JSON.parse(fs.readFileSync(this.filename,"utf8"));
   if(data.version!==1||!Array.isArray(data.transactions))
     throw Error("Unrecognized live journal format");
   return data;
  }catch(e){if(e.code==="ENOENT")return {version:1,transactions:[]};throw e;}
 }
 async finalizedTransaction(signature){
  if(!this.fetchFn)throw Error("RPC fetch unavailable");
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);
  try{
   const response=await this.fetchFn(this.rpc,{
    method:"POST",signal:ctl.signal,cache:"no-store",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({jsonrpc:"2.0",id:"crimson-confirm-"+signature.slice(0,10),
      method:"getTransaction",
      params:[signature,{encoding:"jsonParsed",commitment:"finalized",maxSupportedTransactionVersion:0}]})
   });
   if(!response.ok)throw Error("Solana finalized receipt RPC unavailable");
   const data=await response.json();
   if(data.error||!data.result)throw Error("Finalized transaction not confirmed or unsupported");
   return data.result;
  }finally{clearTimeout(timer);}
 }
 async recordFinalized(intent){
  if(!this.configured())throw Error("No dedicated bot wallet configured");
  if(!intent||intent.wallet!==this.wallet||!validSig(intent.signature)||
     !validPublic(intent.mint)||!["BUY","SELL"].includes(intent.side)||
     typeof intent.intentId!=="string"||
     !/^[a-zA-Z0-9_-]{8,100}$/.test(intent.intentId))
    throw Error("Invalid trusted execution intent");
  const existing=this.read();
  const dup=existing.transactions.find(x=>x.signature===intent.signature);
  if(dup)return {recorded:false,duplicate:true,entry:dup};
  const tx=await this.finalizedTransaction(intent.signature);
  const validated=verifyReceipt(tx,intent);
  const entry={id:crypto.randomUUID(),intentId:intent.intentId,
    ...validated,observedAt:new Date().toISOString()};
  // The running executor must hold a single writer lock and reconcile pending
  // signatures first. This API is NOT exposed over owner HTTP routes.
  fs.mkdirSync(this.directory,{recursive:true,mode:0o700});
  const tmp=this.filename+".tmp-"+process.pid;
  const updated={version:1,transactions:[...existing.transactions,entry]};
  const fd=fs.openSync(tmp,"wx",0o600);
  try{fs.writeFileSync(fd,JSON.stringify(updated,null,2)+"\n");fs.fsyncSync(fd);}
  finally{fs.closeSync(fd);}
  fs.renameSync(tmp,this.filename);
  return {recorded:true,duplicate:false,entry};
 }
 summary(){
  const data=this.read();
  const trades=data.transactions;
  const bought=trades.filter(x=>x.side==="BUY").length;
  const sold=trades.filter(x=>x.side==="SELL").length;
  return {mode:"LIVE_ONLY",liveTrading:false,
    journalReady:!!this.filename,walletConfigured:this.configured(),
    entries:trades.length,buys:bought,sells:sold,priceUnit:"SOL per token",
    priceMethod:"effective wallet-net SOL including fees/rent",
    trades:trades.slice(-100).reverse().map(x=>({
      signature:x.signature,mint:x.mint,side:x.side,slot:x.slot,
      blockTime:x.blockTime,observedAt:x.observedAt,
      tokenQuantity:decimalRatio(BigInt(x.tokenRaw),10n**BigInt(x.tokenDecimals),12),
      effectiveSol:decimalRatio(BigInt(x.effectiveSolLamports),1000000000n,9),
      priceSolPerToken:x.effectivePriceSolPerToken,
      networkFeeSol:decimalRatio(BigInt(x.transactionFeeLamports),1000000000n,9),
      priceMethod:x.accountingMethod,confirmation:x.commitment
    })),
    note:"Only finalized transactions of a future dedicated bot wallet are eligible. No simulated trades or editable manual fills."
  };
 }
}
module.exports={LiveTradeJournal,verifyReceipt,decimalRatio,validPublic,validSig};
