"use strict";
/* Jupiter order preview adapter. NEVER signs or submits swaps.
   Directly queries the documented /swap/v2/order route WITHOUT taker
   (quote-only); private API key stays on the backend, never in Pages.
 */
const {mintOK}=require("./risk-engine.cjs");
const BASE="https://api.jup.ag/swap/v2/order";
const STABLE="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
function whole(x){
 const s=String(x??"");
 if(!/^[1-9][0-9]{0,19}$/.test(s))throw Error("Amount must be a positive integer in atomic token units");
 const big=BigInt(s);
 if(big>(2n**64n-1n))throw Error("Amount exceeds Solana u64");
 return s;
}
class JupiterQuotePreview{
 constructor({fetchFn=globalThis.fetch,apiKey=process.env.JUPITER_API_KEY,timeoutMs=12000}={}){
   if(typeof fetchFn!=="function")throw Error("fetch not available");
   this.fetchFn=fetchFn;this.apiKey=apiKey;this.timeoutMs=timeoutMs;
 }
 async preview({inputMint,outputMint,amount}){
   if(!this.apiKey)throw Error("JUPITER_API_KEY not configured privately");
   if(!mintOK(inputMint)||!mintOK(outputMint)||inputMint===outputMint)
     throw Error("Invalid distinct Solana mint addresses");
   const raw=whole(amount);
   const url=new URL(BASE);
   url.searchParams.set("inputMint",inputMint);
   url.searchParams.set("outputMint",outputMint);
   url.searchParams.set("amount",raw);
   // Intentionally NO taker. Quote only, no unsigned transaction.
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeoutMs);
   try{
     const resp=await this.fetchFn(url.toString(),{method:"GET",
       headers:{"x-api-key":this.apiKey},signal:controller.signal,cache:"no-store"});
     if(!resp.ok)throw Error("Jupiter quote HTTP "+resp.status);
     const body=await resp.json();
     // Fail closed on omitted or malformed output; never call this an execution.
     if(!body||body.errorCode||body.errorMessage||body.transaction)
       throw Error("Provider did not return a valid quote-only response");
     const out=String(body.outAmount??"");
     if(!/^[1-9][0-9]*$/.test(out))throw Error("Missing or invalid token output amount");
     const fee=Number(body.feeBps);
     if(!Number.isFinite(fee)||fee<0||fee>10000)throw Error("Invalid provider fee basis points");
     return {source:"Jupiter Swap V2 /order (no taker)",kind:"QUOTE_ONLY",
       inputMint,outputMint,inputAmount:raw,outputAmount:out,
       feeBps:fee,feeMint:body.feeMint||null,
       router:body.router||"unknown",requestId:body.requestId||null,
       checkedAt:new Date().toISOString(),
       quoteIsExecutable:false,transactionSigningAllowed:false,
       note:"Quote is not guaranteed and may expire; token decimals, price impact, route availability, transfer fees and final output require independent checks."};
   }finally{clearTimeout(timer);}
 }
}
module.exports={JupiterQuotePreview,whole,USDC_MINT:STABLE};
