"use strict";
/* Always-on LIVE Solana market research. NO paper positions, NO signers,
 * NO trade execution, NO private funds or balance mutations.
 * Public APIs may be delayed, incomplete, unavailable or manipulated.
 */
const R=require("./risk-engine.cjs");
const {PublicSolanaFeeds}=require("./providers.cjs");
class LiveScanner{
 constructor({feeds=new PublicSolanaFeeds(),clock=()=>Date.now(),intervalMs=180000,
   log=()=>{}}={}){
  if(!Number.isFinite(intervalMs)||intervalMs<60000)throw Error("Unsafe scan interval");
  this.feeds=feeds;this.clock=clock;this.intervalMs=intervalMs;this.log=log;
  this.timer=null;this.busy=false;
  this.snapshot={
    mode:"LIVE_MARKET_RESEARCH_ONLY",enabled:false,scanning:false,
    actualOrders:0,liveExecutionReady:false,everExecutedRealTrade:false,
    lastScanAt:null,discovered:0,marketQualified:0,securityQualified:0,
    confirmedSetups:0,candidates:[],warnings:[],lastError:"",
    note:"Live token observations only. No real or simulated buys/sells."
  };
 }
 status(){return {...this.snapshot,scanning:this.busy,
   candidates:this.snapshot.candidates.map(x=>({...x})),
   warnings:[...this.snapshot.warnings]};}
 async scan(){
  if(this.busy)return this.status();
  this.busy=true;this.snapshot.enabled=true;this.snapshot.scanning=true;
  const startedAt=this.clock();
  try{
    const discovery=await this.feeds.discover(24);
    const raw=discovery.pools||[];
    const qualified=raw.map(p=>({pair:p,m:R.market(p)})).filter(x=>x.m.eligible)
      .sort((a,b)=>b.m.liq-a.m.liq);
    const candidates=[],warnings=[...(discovery.warnings||[])];
    let securityQualified=0,confirmedSetups=0;
    for(const item of qualified.slice(0,6)){
      const mint=item.pair?.baseToken?.address;
      if(!R.mintOK(mint))continue;
      let report=null,plan=null,reportError="";
      try{
        report=R.security(await this.feeds.risk(mint));
        if(report.pass){
          securityQualified++;
          try{
            const rawCandles=await this.feeds.candles(item.pair,mint);
            plan=R.plan(R.closedCandles(rawCandles,this.clock()),item.m.spot,this.clock());
          }catch(e){reportError="Closed candle data unavailable";}
        }
      }catch(e){reportError="Security data unavailable";}
      const confirmed=!!(report?.pass&&plan?.confirmed);
      if(confirmed)confirmedSetups++;
      candidates.push({
        mint,symbol:item.pair.baseToken?.symbol||"Unknown",
        pairAddress:item.pair.pairAddress,
        priceUsd:item.m.spot,liquidityUsd:item.m.liq,
        volume5mUsd:item.m.usd5,volume1hUsd:item.m.usd1,
        buyShare5m:item.m.share5,priceChange5mPct:item.m.ch5,
        securityVerified:!!report?.verified,securityPass:!!report?.pass,
        securityReason:report?.reason||reportError||"Risk unverified",
        candleConfirmed:confirmed,
        signalLabel:confirmed?"STRUCTURE WATCH — NOT AN ORDER":"RESEARCH ONLY",
        updatedAt:new Date(this.clock()).toISOString()
      });
    }
    this.snapshot={...this.snapshot,
      lastScanAt:new Date(this.clock()).toISOString(),
      discovered:discovery.discovered??raw.length,
      marketQualified:qualified.length,securityQualified,confirmedSetups,
      candidates,warnings,lastError:"",
      note:"Live public Solana market data. Qualifying signals are preliminary research, not a verified executable swap."
    };
    this.log("Scan complete: "+this.snapshot.discovered+
      " discovered; "+qualified.length+" market qualified; "+
      securityQualified+" passed security; "+confirmedSetups+
      " observed candle setups; REAL trades 0.");
  }catch(e){
    this.snapshot={...this.snapshot,
      lastScanAt:new Date(this.clock()).toISOString(),
      discovered:0,marketQualified:0,securityQualified:0,confirmedSetups:0,
      candidates:[],lastError:String(e.message||e).slice(0,140),warnings:[],
      note:"Live data scan failed closed; no investment decision or trade executed."
    };
    this.log("Live scan unavailable; no orders: "+this.snapshot.lastError);
  }finally{this.busy=false;this.snapshot.scanning=false;}
  return this.status();
 }
 start(){
  if(this.timer)return;
  this.snapshot.enabled=true;
  void this.scan();
  this.timer=setInterval(()=>{void this.scan();},this.intervalMs);
 }
 stop(){
  if(this.timer)clearInterval(this.timer);
  this.timer=null;this.snapshot.enabled=false;
 }
}
module.exports={LiveScanner};
