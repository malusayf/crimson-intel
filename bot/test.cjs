"use strict";
/* No network. Run: node bot/test.cjs */
const assert=require("node:assert/strict");
const R=require("./risk-engine.cjs");
const {CrimsonPaperEngine}=require("./engine.cjs");
const {PublicSolanaFeeds}=require("./providers.cjs");
async function main(){
 const mint="So11111111111111111111111111111111111111112";
 const poolMint="AuaVG7BDXk84daSMJ2irSpNd1nXyCrwMJecS2ZtbVaaa";
 assert(R.mintOK(mint));assert(R.mintOK(poolMint));
 const t=Date.now(),nowSec=Math.floor(t/1000);
 const price0=1.025;
 const originalPool={
  chainId:"solana",pairAddress:mint,
  baseToken:{address:poolMint,symbol:"TEST"},
  pairCreatedAt:t-7200000,priceUsd:String(price0),
  liquidity:{usd:150000},volume:{m5:8000,h1:150000},
  txns:{m5:{buys:80,sells:20},h1:{buys:500,sells:300}},
  priceChange:{m5:2.5,h1:6,h24:10}
 };
 const security={risks:[],score_normalised:1,lpLockedPct:100};
 const candles=Array.from({length:55},(_,i)=>{
  const offset=.003*Math.sin(i*.7),base=1+offset;
  return [nowSec-400-(54-i)*300,base,base+.009,base-.009,base];
 });
 // Latest completed candle: bullish close above preceding high after pullback.
 candles[53]=[nowSec-700,1.010,1.017,.999,1.009];
 candles[54]=[nowSec-400,1.012,1.029,1.004,1.025];
 const raw={data:{attributes:{ohlcv_list:[...candles].reverse()}}};
 const observed=R.market(originalPool);
 assert(observed.eligible,"qualifying liquid market");
 assert(R.security(security).pass,"security report accepted");
 const pattern=R.plan(R.closedCandles(raw,t),price0,t);
 assert(pattern&&pattern.confirmed,"completed bullish confirmation");
 const weak={...originalPool,txns:{m5:{buys:1,sells:1},h1:{buys:1,sells:1}}};
 assert(!R.market(weak).adequate,"reject thin transaction samples");
 assert(!R.security({risks:[],score_normalised:1}).pass,"unknown LP lock must fail");
 assert(!R.plan(R.closedCandles({data:{attributes:{ohlcv_list:candles.slice(0,5)}}},t),price0,t),"reject missing candles");
 const state={saved:null};
 const store={load:async()=>state.saved,save:async s=>{state.saved=JSON.parse(JSON.stringify(s));}};
 const feed={
  price:price0,
  async discover(){return {discovered:1,pools:[{...originalPool,priceUsd:String(this.price)}]};},
  async risk(){return security;},
  async candles(){return raw;},
  async pool(){return {...originalPool,priceUsd:String(this.price)};}
 };
 let time=t,kill=false,pause=false;
 const engine=new CrimsonPaperEngine({feeds:feed,store,clock:()=>time,getFlags:()=>({kill,pause}),
  config:{scanEveryMs:900000}});
 await engine.cycle();
 assert.equal(engine.state.positions.length,1,"automatic paper BUY created");
 assert.equal(engine.state.trades.filter(x=>x.side==="BUY").length,1);
 assert(engine.state.cash<1000);
 const pos=engine.state.positions[0];
 const originalQty=pos.originalQty;
 pause=true;
 feed.price=pos.tp1+.00001;
 time+=30000;
 await engine.cycle();
 assert.equal(engine.state.positions.length,1);
 assert(Math.abs(engine.state.positions[0].qty-originalQty*.75)<1e-5,"TP1 sold 25% despite paused entries");
 assert.equal(engine.state.positions[0].stage,1);
 // TP2 must sell another 25% of ORIGINAL quantity, not 75%.
 feed.price=pos.tp2+.00001;
 time+=30000;
 await engine.cycle();
 assert.equal(engine.state.positions[0].stage,2);
 assert(Math.abs(engine.state.positions[0].qty-originalQty*.50)<1e-5,"TP2 leaves half of original position");
 feed.price=pos.tp3+.00001;
 kill=true;
 time+=30000;
 await engine.cycle();
 assert.equal(engine.state.positions.length,1,"kill switch disables even paper exits");
 kill=false;
 time+=30000;
 await engine.cycle();
 assert.equal(engine.state.positions.length,0,"TP3 closes remainder");
 assert.equal(engine.state.trades.filter(x=>x.side==="SELL").length,3);
 assert(engine.state.cash>0);
 assert.equal(engine.publicStatus().liveExecution,false,"no live mode implemented");
 console.log("PASS: market filters, rug fail-closed, closed candles, paper buy, TP1 and TP2 partials, pause, kill, TP3 close, live disabled");
}
main().catch(e=>{console.error("FAIL:",e.stack);process.exitCode=1;});
