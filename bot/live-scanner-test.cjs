"use strict";
const assert=require("node:assert/strict");
const {LiveScanner}=require("./live-scanner.cjs");
const mint="9".repeat(44),pairAddress="8".repeat(44),now=Date.now(),sec=Math.floor(now/1000);
const token={chainId:"solana",pairAddress,baseToken:{address:mint,symbol:"CRIMSON"},
 pairCreatedAt:now-7200000,priceUsd:"1.025",
 liquidity:{usd:160000},volume:{m5:8000,h1:150000},
 txns:{m5:{buys:80,sells:20},h1:{buys:500,sells:250}},
 priceChange:{m5:2,h1:8}};
const candles=Array.from({length:55},(_,i)=>{
 const value=1+.003*Math.sin(i*.7);
 return [sec-400-(54-i)*300,value,value+.009,value-.009,value];
});
candles[53]=[sec-700,1.010,1.017,.999,1.009];
candles[54]=[sec-400,1.012,1.029,1.004,1.025];
async function test(){
 const feeds={
  async discover(){return {discovered:1,pools:[token],warnings:[]};},
  async risk(){return {risks:[],score_normalised:1,lpLockedPct:100};},
  async candles(){return {data:{attributes:{ohlcv_list:[...candles].reverse()}}};}
 };
 const scanner=new LiveScanner({feeds,clock:()=>now});
 const status=await scanner.scan();
 assert.equal(status.mode,"LIVE_MARKET_RESEARCH_ONLY");
 assert.equal(status.discovered,1);
 assert.equal(status.marketQualified,1);
 assert.equal(status.securityQualified,1);
 assert.equal(status.candidates.length,1);
 assert.equal(status.actualOrders,0);
 assert.equal(status.liveExecutionReady,false);
 assert.equal(status.everExecutedRealTrade,false);
 assert(status.candidates[0].securityPass);
 const failure=new LiveScanner({feeds:{async discover(){throw Error("feed unavailable")}},clock:()=>now});
 const failStatus=await failure.scan();
 assert.equal(failStatus.candidates.length,0);
 assert.equal(failStatus.lastError,"feed unavailable");
 assert.equal(failStatus.actualOrders,0);
 console.log("PASS scanner: actual market observations only, risk filters, no paper orders or live execution, fail closed");
}
test().catch(e=>{console.error(e);process.exitCode=1});
