"use strict";
/* Crimson AutoTrader paper engine.
   Runs both entry and exit decisions autonomously. NO transactions, keys or
   signatures; all fills are modeled and must not be represented as executable.
*/
const R=require("./risk-engine.cjs");
const DEFAULTS=Object.freeze({
  initialCashUsd:1000, maxOpenPositions:2, maxPositionEquityFraction:.05,
  maxRiskPerTradeFraction:.005, maxDailyLossFraction:.03,
  maxTotalDrawdownFraction:.10, maxDailyEntries:5,
  maxSlippageFraction:.005, modeledFeeUsd:.10,
  minTradeUsd:10, maxTradeUsd:100, maxPoolExposureFraction:.002,
  scanEveryMs:180000, securityCacheMs:300000, quoteMaxAgeMs:120000,
  cooldownMs:3600000, discoveryLimit:24, shortlistLimit:5
});
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const round=x=>Math.round(x*100000000)/100000000;
const safeError=e=>String(e?.message||e).slice(0,220);
function validateConfig(c){
  if(c.initialCashUsd<=0||c.maxDailyLossFraction<=0||c.maxDailyLossFraction>=1||
    c.maxRiskPerTradeFraction<=0||c.maxRiskPerTradeFraction>=.1||
    c.maxPositionEquityFraction<=0||c.maxPositionEquityFraction>.5||
    c.maxOpenPositions<1||c.maxOpenPositions>5||
    c.maxDailyEntries<1||c.maxDailyEntries>30)throw Error("Unsafe risk configuration");
}
class CrimsonPaperEngine{
  constructor({feeds,store,clock=()=>Date.now(),getFlags=()=>({}),config={},log=()=>{}}={}){
    if(!feeds||!store)throw Error("feeds and store required");
    this.config={...DEFAULTS,...config};validateConfig(this.config);
    this.feeds=feeds;this.store=store;this.clock=clock;
    this.getFlags=getFlags;this.log=log;this.busy=false;this.securityCache=new Map();
    this.state=null;
  }
  now(){return this.clock();}
  event(type,message,data={}){
    const e={at:new Date(this.now()).toISOString(),type,message,...data};
    this.state.events.push(e);this.state.events=this.state.events.slice(-400);
    try{this.log(e);}catch(_){}
  }
  newState(){
    const now=this.now(),start=this.config.initialCashUsd;
    return {schema:1,mode:"PAPER_ONLY",createdAt:new Date(now).toISOString(),
      cash:start,initialCash:start,peakEquity:start,day:new Date(now).toISOString().slice(0,10),
      dayStartEquity:start,paused:false,positions:[],trades:[],events:[],
      lastScanAt:0,lastTickAt:0,lastError:"",scanCount:0,cycleCount:0,cooldowns:{},
      latestScan:{found:0,marketQualified:0,securityQualified:0},
      source:"Public feeds / paper-simulated execution"};
  }
  async init(){
    if(this.state)return this.state;
    const saved=await this.store.load();
    if(saved && saved.schema===1 && saved.mode==="PAPER_ONLY" && Array.isArray(saved.positions) &&
       finite(saved.cash)&&saved.cash>=0 && Array.isArray(saved.trades) && Array.isArray(saved.events)){
      this.state=saved;
      this.event("BOOT","Resumed existing paper state. Live trading is not implemented.");
    }else{
      this.state=this.newState();
      this.event("BOOT","Created paper trading account. No wallet access.");
    }
    await this.store.save(this.state);
    return this.state;
  }
  equity(){
    if(!this.state)return NaN;
    return this.state.cash+this.state.positions.reduce((sum,pos)=>{
      const mark=finite(pos.lastMark)&&pos.lastMark>0?pos.lastMark:pos.fillPrice;
      return sum+pos.qty*mark;
    },0);
  }
  dayEntries(){
    const today=this.state.day;
    return this.state.trades.filter(t=>t.side==="BUY"&&t.time.slice(0,10)===today).length;
  }
  dailyHaltReason(){
    const equity=this.equity(),c=this.config;
    if(equity<=this.state.dayStartEquity*(1-c.maxDailyLossFraction))return "daily drawdown threshold";
    if(equity<=this.state.peakEquity*(1-c.maxTotalDrawdownFraction))return "total drawdown threshold";
    if(this.dayEntries()>=c.maxDailyEntries)return "maximum daily entries";
    return "";
  }
  resetDay(){
    const d=new Date(this.now()).toISOString().slice(0,10);
    if(d!==this.state.day){
      this.state.day=d;
      this.state.dayStartEquity=this.equity();
      this.event("NEW_DAY","Daily entry and loss limits reset.",{day:d});
    }
  }
  flags(){try{return this.getFlags()||{};}catch(e){return {kill:true};}}
  async security(mint){
    const cached=this.securityCache.get(mint);
    if(cached&&this.now()-cached.at<this.config.securityCacheMs)return cached.value;
    let value;
    try{value=R.security(await this.feeds.risk(mint));}
    catch(e){value={verified:false,pass:false,reason:"RugCheck unavailable: "+safeError(e)};}
    this.securityCache.set(mint,{at:this.now(),value});
    return value;
  }
  async monitor(){
    const flags=this.flags();
    for(const pos of [...this.state.positions]){
      try{
        const pool=await this.feeds.pool(pos.mint);
        if(!pool){this.event("NO_QUOTE","Position has no matching DEX pool; unable to model executable exit.",{mint:pos.mint});continue;}
        const mark=Number(pool.priceUsd);
        if(!finite(mark)||mark<=0)throw Error("missing positive market price");
        pos.lastMark=mark;pos.markedAt=this.now();pos.lastLiquidity=Number(pool?.liquidity?.usd)||0;
        const risk=R.market(pool),security=await this.security(pos.mint);
        if(!security.verified)this.event("SECURITY_UNVERIFIED","No current verified risk report for open position.",{mint:pos.mint});
        if(flags.kill){
          this.event("KILL_ENGAGED","All modeled executions disabled by KILL flag.",{mint:pos.mint});
          continue;
        }
        const exit=R.chooseExit(pos,mark,risk,security);
        if(exit) this.close(pos,mark,exit);
      }catch(e){
        this.event("MONITOR_ERROR","Position still open; feed failure prevented exit simulation.",{mint:pos.mint,error:safeError(e)});
      }
    }
  }
  close(pos,spot,decision){
    const c=this.config;
    const qty=Math.min(pos.qty,pos.qty*decision.fraction);
    const sale=R.paperSell(qty,spot,c.maxSlippageFraction,c.modeledFeeUsd);
    if(!sale||!(sale.received>=0))return;
    const cost=qty*pos.costPerToken;
    this.state.cash=round(this.state.cash+sale.received);
    pos.qty=round(pos.qty-qty);
    pos.stage=decision.type==="TP1"?Math.max(pos.stage,1):
      decision.type==="TP2"?Math.max(pos.stage,2):
      decision.type==="TP3"?3:pos.stage;
    const realized=sale.received-cost;
    pos.realized=round((pos.realized||0)+realized);
    const t={id:"trade-"+this.now()+"-"+this.state.trades.length,time:new Date(this.now()).toISOString(),
      side:"SELL",mode:"PAPER",mint:pos.mint,reason:decision.type+" · "+decision.why,
      fillPrice:sale.fillPrice,qty,netUsd:sale.received,modeledFeeUsd:sale.fee,realizedUsd:realized};
    this.state.trades.push(t);
    this.event("MODELED_SELL","Paper sale modeled; NOT submitted on-chain.",
      {mint:pos.mint,reason:decision.type,qty,price:sale.fillPrice,realizedUsd:round(realized)});
    if(pos.qty<=Math.max(.00000001,pos.originalQty*.0000001)||decision.fraction===1){
      this.state.positions=this.state.positions.filter(x=>x!==pos);
      this.state.cooldowns[pos.mint]=this.now()+this.config.cooldownMs;
      this.event("POSITION_CLOSED","Paper position closed.",{mint:pos.mint});
    }
  }
  async scanAndEnter(){
    const c=this.config,flags=this.flags();
    if(flags.kill||flags.pause||this.state.paused){
      this.event("SCAN_SKIPPED","New buys blocked by pause/kill flag.");return;
    }
    const reason=this.dailyHaltReason();
    if(reason){this.event("RISK_HALT","No new buys: "+reason);return;}
    if(this.state.positions.length>=c.maxOpenPositions)return;
    const discovered=await this.feeds.discover(c.discoveryLimit);
    this.state.scanCount++;
    this.state.latestScan={found:discovered.discovered||0,marketQualified:0,securityQualified:0};
    const eligible=[];
    for(const pool of discovered.pools){
      const m=R.market(pool);
      if(!m.eligible)continue;
      this.state.latestScan.marketQualified++;
      eligible.push({pool,m});
    }
    eligible.sort((a,b)=>b.m.liq-a.m.liq);
    for(const item of eligible.slice(0,c.shortlistLimit)){
      const mint=item.pool.baseToken.address;
      if(this.state.positions.some(p=>p.mint===mint)||
         (this.state.cooldowns[mint]||0)>this.now())continue;
      const security=await this.security(mint);
      if(!security.verified||!security.pass)continue;
      this.state.latestScan.securityQualified++;
      let candles;
      try{candles=R.closedCandles(await this.feeds.candles(item.pool,mint),this.now());}
      catch(e){this.event("CANDLES_UNAVAILABLE","Skipping unsafe/missing candle data.",{mint,error:safeError(e)});continue;}
      const strategy=R.plan(candles,item.m.spot,this.now());
      if(!strategy?.confirmed)continue;
      if(this.flags().kill||this.flags().pause||this.state.paused)break;
      const currentEq=this.equity();
      const maxRiskSize=currentEq*c.maxRiskPerTradeFraction/strategy.riskFraction;
      const maxEquitySize=currentEq*c.maxPositionEquityFraction;
      const maxLiquiditySize=item.m.liq*c.maxPoolExposureFraction;
      const size=Math.min(maxRiskSize,maxEquitySize,maxLiquiditySize,c.maxTradeUsd,
        this.state.cash-c.modeledFeeUsd-1);
      if(!(size>=c.minTradeUsd))continue;
      const buy=R.paperBuy(this.state.cash,item.m.spot,size,c.maxSlippageFraction,c.modeledFeeUsd);
      if(!buy)continue;
      this.state.cash=round(this.state.cash-buy.spent);
      const stop=strategy.stop;
      const riskPerUnit=buy.fillPrice-stop;
      if(riskPerUnit<=0)continue;
      const position={mint,pairAddress:item.pool.pairAddress,symbol:item.pool.baseToken.symbol||"?",
        fillPrice:buy.fillPrice,stop,
        tp1:buy.fillPrice+riskPerUnit,tp2:buy.fillPrice+2*riskPerUnit,tp3:buy.fillPrice+3*riskPerUnit,
        qty:buy.qty,originalQty:buy.qty,costPerToken:buy.spent/buy.qty,
        stage:0,lastMark:item.m.spot,markedAt:this.now(),
        createdAt:new Date(this.now()).toISOString(),realized:0,lastLiquidity:item.m.liq,
        confirmation:"5m bullish pullback proxy; NOT full manually anchored PSM 0ABC"};
      this.state.positions.push(position);
      this.state.trades.push({id:"trade-"+this.now()+"-"+this.state.trades.length,
        time:position.createdAt,side:"BUY",mode:"PAPER",mint,qty:buy.qty,fillPrice:buy.fillPrice,
        grossUsd:size,modeledFeeUsd:buy.fee,riskUsd:round(riskPerUnit*buy.qty)});
      this.event("MODELED_BUY","Paper buy modeled. No wallet connected.",{
        mint,qty:buy.qty,fillPrice:buy.fillPrice,stop,eligibleAt:this.now()});
      break;
    }
  }
  async cycle(){
    if(this.busy)return this.state;
    this.busy=true;
    try{
      await this.init();
      this.resetDay();
      this.state.cycleCount++;
      await this.monitor();
      if(this.now()-this.state.lastScanAt>=this.config.scanEveryMs){
        this.state.lastScanAt=this.now();
        try{await this.scanAndEnter();}
        catch(e){this.event("SCAN_ERROR","Could not scan; no new paper buys.",{error:safeError(e)});}
      }
      const eq=this.equity();
      if(eq>this.state.peakEquity)this.state.peakEquity=eq;
      this.state.lastTickAt=this.now();
      this.state.lastError="";
      await this.store.save(this.state);
    }catch(e){
      if(this.state){
        this.state.lastError=safeError(e);
        this.event("CYCLE_ERROR","Paper cycle failed safely.",{error:safeError(e)});
        try{await this.store.save(this.state);}catch(_){}
      }
      throw e;
    }finally{this.busy=false;}
    return this.state;
  }
  publicStatus(){
    if(!this.state)return {mode:"PAPER_ONLY",ready:false,liveExecution:false};
    const state=this.state,flags=this.flags();
    return {mode:"PAPER_ONLY",ready:true,liveExecution:false,
      cashUsd:round(state.cash),equityUsd:round(this.equity()),initialCashUsd:state.initialCash,
      peakEquityUsd:round(state.peakEquity),dayStartEquityUsd:state.dayStartEquity,
      paused:!!(flags.pause||state.paused),kill:!!flags.kill,
      entryHalt:this.dailyHaltReason(),cycles:state.cycleCount,scans:state.scanCount,
      lastTickAt:state.lastTickAt?new Date(state.lastTickAt).toISOString():null,
      lastScan:state.latestScan,openPositions:state.positions.length,
      positions:state.positions.map(({mint,symbol,qty,fillPrice,stop,tp1,tp2,tp3,lastMark,stage,createdAt})=>({
        mint,symbol,qty,fillPrice,stop,tp1,tp2,tp3,lastMark,stage,createdAt
      })),
      recentEvents:state.events.slice(-20),recentTrades:state.trades.slice(-30),
      limitations:["Paper-simulated fills, not executable Jupiter quotes","No real wallet connected",
        "Stop-loss not guaranteed; this process never sends orders",
        "Generic confirmed-pullback signal; not full 0ABC PSM strategy"]};
  }
}
module.exports={CrimsonPaperEngine,DEFAULTS,validateConfig};
