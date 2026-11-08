"use strict";
const assert=require("node:assert/strict");
const {JupiterQuotePreview,whole}=require("./jupiter-quote.cjs");
const SOL="So11111111111111111111111111111111111111112";
const USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
async function test(){
 assert.equal(whole("1000000"),"1000000");
 assert.throws(()=>whole("-5"));
 assert.throws(()=>whole("1.2"));
 assert.throws(()=>whole("18446744073709551616"));
 let seenUrl="",seenKey="";
 const q=new JupiterQuotePreview({apiKey:"test-api-key",fetchFn:async (url,opts)=>{
  seenUrl=url;seenKey=opts.headers["x-api-key"];
  return {ok:true,json:async()=>({
   transaction:"",requestId:"test-only",outAmount:"1000000",
   feeBps:10,feeMint:USDC,router:"metis"
  })};
 }});
 const result=await q.preview({inputMint:SOL,outputMint:USDC,amount:"123456"});
 assert.equal(result.kind,"QUOTE_ONLY");
 assert.equal(result.quoteIsExecutable,false);
 assert.equal(result.outputAmount,"1000000");
 assert.equal(result.inputAmount,"123456");
 assert.equal(seenKey,"test-api-key");
 const u=new URL(seenUrl);
 assert.equal(u.pathname,"/swap/v2/order");
 assert.equal(u.searchParams.get("taker"),null,"no taker: quote only");
 assert.equal(u.searchParams.get("amount"),"123456");
 await assert.rejects(q.preview({inputMint:SOL,outputMint:SOL,amount:"123"}));
 const reject=new JupiterQuotePreview({apiKey:"test-key",fetchFn:async()=>({
  ok:true,json:async()=>({transaction:"signed-data",outAmount:"20",feeBps:10})
 })});
 await assert.rejects(reject.preview({inputMint:SOL,outputMint:USDC,amount:"123"}));
 console.log("PASS quote: atomic units, no taker, private API key, quote-only rejection, no execution");
}
test().catch(e=>{console.error(e);process.exitCode=1});
