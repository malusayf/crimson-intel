"use strict";
/* Pure, deterministic research/trade rules. No API calls, wallet access, or
 * guaranteed price predictions. Inputs are untrusted market observations.
 * Auto-entry model is a CONFIRMED PULLBACK proxy, not PSM 0ABC.
 */
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const n=x=>x==null||x===""?NaN:Number(x);
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const mintOK=x=>typeof x==="string"&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(x);
function market(p){
  const liq=n(p?.liquidity?.usd),usd5=n(p?.volume?.m5),usd1=n(p?.volume?.h1),
  buys5=n(p?.txns?.m5?.buys),sells5=n(p?.txns?.m5?.sells),
  buys1=n(p?.txns?.h1?.buys),sells1=n(p?.txns?.h1?.sells),
  ch5=n(p?.priceChange?.m5),ch1=n(p?.priceChange?.h1),
  spot=n(p?.priceUsd),ageMs=Date.now()-n(p?.pairCreatedAt);
  const full=[liq,usd5,usd1,buys5,sells5,buys1,sells1,ch5,ch1,spot].every(finite);
  if(!full||spot<=0||liq<=0)return {adequate:false,eligible:false,reason:"missing or invalid pool data",danger:true};
  const count5=buys5+sells5,count1=buys1+sells1,
  share5=count5?buys5/count5:null,share1=count1?buys1/count1:null;
  const adequate=count5>=20&&count1>=50&&usd5>=200&&usd1>=1000;
  const ageOK=finite(ageMs)&&ageMs>=3600000;
  const danger=liq<75000||ch5<=-10||ch1<=-20||ch5>18||ch1>80||
    (share5!==null&&share5<.45);
  const eligible=adequate&&ageOK&&!danger&&share5>=.55&&share1>=.53&&
    usd1>=15000&&usd5>=300&&liq>=75000;
  return {adequate,eligible,danger,reason:!adequate?"trade sample too small":!ageOK?"pool younger than 1h":danger?"market danger or insufficient liquidity":!eligible?"no aligned momentum":"eligible for candle confirmation",
    liq,usd5,usd1,share5,share1,count5,count1,ch5,ch1,spot,ageMs};
}
function security(report){
  if(!report||!Array.isArray(report.risks))return {verified:false,pass:false,reason:"missing risk report"};
  const severe=report.risks.filter(r=>["danger","critical","high"].includes(String(r?.level||"").toLowerCase()));
  const warnings=report.risks.filter(r=>["warn","warning","medium"].includes(String(r?.level||"").toLowerCase()));
  const lp=n(report.lpLockedPct),score=n(report.score_normalised);
  const lpKnown=finite(lp)&&lp>=0&&lp<=100;
  const pass=severe.length===0&&warnings.length<=1&&lpKnown&&lp>=75&&finite(score)&&score<=25;
  return {verified:true,pass,lpLockedPct:lpKnown?lp:null,
    score:finite(score)?score:null,warnings:warnings.length,severe:severe.length,
    reason:pass?"No severe risks in this provider report; rug still possible.":"Security risks or missing validated LP/score."};
}
function closedCandles(raw,now=Date.now()){
  const rows=raw?.data?.attributes?.ohlcv_list;
  if(!Array.isArray(rows))return [];
  const cutoff=now/1000-315;
  return rows.map(v=>({ts:n(v[0]),o:n(v[1]),h:n(v[2]),l:n(v[3]),c:n(v[4])}))
    .filter(c=>[c.ts,c.o,c.h,c.l,c.c].every(finite)&&c.ts<=cutoff&&c.l>0&&c.h>=c.l&&c.c>0)
    .sort((a,b)=>a.ts-b.ts).slice(-55);
}
function plan(candles,spot,now=Date.now()){
  if(!Array.isArray(candles)||candles.length<28||!finite(spot)||spot<=0)return null;
  const last=candles.at(-1);
  if(now/1000-last.ts>900||Math.abs(last.c-spot)/spot>.15)return null;
  const ranges=candles.slice(1).map((c,i)=>Math.max(c.h-c.l,Math.abs(c.h-candles[i].c),Math.abs(c.l-candles[i].c)));
  const atr=ranges.slice(-14).reduce((a,b)=>a+b,0)/14;
  if(!finite(atr)||atr<=0)return null;
  const lows=[];
  for(let i=2;i<candles.length-2;i++){
    if(candles[i].l<=candles[i-1].l&&candles[i].l<=candles[i-2].l&&
       candles[i].l<=candles[i+1].l&&candles[i].l<=candles[i+2].l)lows.push(candles[i].l);
  }
  const support=lows.filter(x=>x<spot).sort((a,b)=>b-a)[0]??Math.min(...candles.slice(-20).map(c=>c.l));
  const stop=support-.55*atr;
  const risk=spot-stop;
  // Strict risk: avoid implausible structure and very wide stops.
  if(!(stop>0&&risk>0&&risk/spot<=.12&&risk/spot>=.003))return null;
  const previous=candles.at(-2);
  // This deterministic entry requires a completed bullish close past the
  // preceding completed candle's high after a nearby support pullback.
  const confirmed=last.c>last.o&&last.c>previous.h&&
    previous.l<=support+1.25*atr && last.c-support<=4*atr;
  return {entryReference:spot,stop,tp1:spot+risk,tp2:spot+2*risk,tp3:spot+3*risk,
    riskFraction:risk/spot,atr,lastCandleAt:last.ts*1000,confirmed};
}
function chooseExit(position,spot,marketState,securityState){
  if(!position||!finite(spot)||spot<=0)return null;
  if(spot<=position.stop)return {type:"EMERGENCY",fraction:1,why:"stop reference crossed"};
  if(securityState?.verified&&securityState.pass===false)return {type:"EMERGENCY",fraction:1,why:"token security flag"};
  if(marketState?.danger||marketState?.adequate===false)return {type:"EMERGENCY",fraction:1,why:"market risk or inadequate liquidity"};
  if(position.stage<3&&spot>=position.tp3)return {type:"TP3",fraction:1,why:"third target crossed"};
  if(position.stage<2&&spot>=position.tp2)return {type:"TP2",fraction:position.stage===0?.5:1/3,why:"second target crossed"};
  if(position.stage<1&&spot>=position.tp1)return {type:"TP1",fraction:.25,why:"first target crossed"};
  return null;
}
function paperBuy(cash,price,size,slippage=.005,fee=.10){
  if(![cash,price,size,slippage,fee].every(finite)||size<=0||price<=0||cash<size+fee)return null;
  const fillPrice=price*(1+slippage);
  return {qty:size/fillPrice,fillPrice,spent:size+fee,fee};
}
function paperSell(qty,price,slippage=.005,fee=.10){
  if(![qty,price,slippage,fee].every(finite)||qty<=0||price<=0)return null;
  const fillPrice=price*(1-slippage);
  return {qty,fillPrice,received:Math.max(0,qty*fillPrice-fee),fee};
}
module.exports={market,security,closedCandles,plan,chooseExit,paperBuy,paperSell,mintOK};
