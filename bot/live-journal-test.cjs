"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const {LiveTradeJournal,verifyReceipt,decimalRatio}=require("./live-journal.cjs");
const wallet="3".repeat(44),mint="4".repeat(44),signature="5".repeat(87),
 alternateSig="6".repeat(87);
function token(amount){
 return {accountIndex:1,mint,owner:wallet,
   uiTokenAmount:{amount:String(amount),decimals:6}};
}
function tx(sig,{side="BUY",fail=false,other=false}={}){
 const buy=side==="BUY";
 return {
   slot:456,blockTime:1780000000,
   transaction:{signatures:[sig],message:{accountKeys:[
     {pubkey:wallet,signer:true,writable:true},
     {pubkey:"9".repeat(44),signer:false,writable:true}
   ]}},
   meta:{err:fail?{InstructionError:[0,"Custom"]}:null,fee:5000,
     preBalances:[buy?4000000000:3000000000,0],
     postBalances:[buy?3000000000:4000000000,0],
     preTokenBalances:buy?[]:[token(1000000000)],
     postTokenBalances:buy?[token(1000000000)]:[]
   }
 };
}
async function run(){
 assert.equal(decimalRatio(1000000n,1000000000n,12),"0.001");
 const entry=verifyReceipt(tx(signature),{wallet,mint,side:"BUY",signature});
 assert.equal(entry.effectivePriceSolPerToken,"0.001");
 assert.equal(entry.transactionFeeLamports,"5000");
 assert.equal(entry.tokenRaw,"1000000000");
 const exit=verifyReceipt(tx(alternateSig,{side:"SELL"}),{wallet,mint,side:"SELL",signature:alternateSig});
 assert.equal(exit.effectivePriceSolPerToken,"0.001");
 assert.throws(()=>verifyReceipt(tx(signature,{fail:true}),{wallet,mint,side:"BUY",signature}));
 assert.throws(()=>verifyReceipt(tx(signature),{wallet,mint,side:"SELL",signature}));
 assert.throws(()=>verifyReceipt(tx(signature),{wallet,mint,side:"BUY",signature:alternateSig}));
 assert.throws(()=>verifyReceipt(tx(signature),{wallet:"7".repeat(44),mint,side:"BUY",signature}));
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),"crimson-live-journal-test-"));
 try{
   const journal=new LiveTradeJournal({directory:temp,wallet,
     fetchFn:async(url,opts)=>{
       const params=JSON.parse(opts.body);
       const sig=params.params[0];
       assert.equal(params.method,"getTransaction");
       assert.equal(params.params[1].commitment,"finalized");
       return {ok:true,json:async()=>({result:tx(sig,{side:sig===signature?"BUY":"SELL"})})};
     }});
   let sum=journal.summary();
   assert.equal(sum.entries,0);assert.equal(sum.walletConfigured,true);
   const intent={signature,wallet,mint,side:"BUY",intentId:"auto-intent-01"};
   const logged=await journal.recordFinalized(intent);
   assert.equal(logged.recorded,true);
   const dupe=await journal.recordFinalized(intent);
   assert.equal(dupe.duplicate,true);
   await journal.recordFinalized({...intent,signature:alternateSig,side:"SELL",intentId:"auto-intent-02"});
   sum=journal.summary();
   assert.equal(sum.entries,2);assert.equal(sum.buys,1);assert.equal(sum.sells,1);
   assert.equal(sum.trades[0].side,"SELL");
   assert.equal(sum.trades[1].priceSolPerToken,"0.001");
   assert.equal(sum.trades[0].effectiveSol,"1");
   assert.equal(sum.trades[0].networkFeeSol,"0.000005");
   assert.equal(new LiveTradeJournal({directory:temp,wallet}).summary().entries,2);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
 console.log("PASS live journal: only finalized matching signer, native SOL/token deltas, entry/exit, fees, replay blocking, persistent records");
}
run().catch(err=>{console.error(err);process.exitCode=1});
