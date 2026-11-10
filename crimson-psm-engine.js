/* Crimson PSM Fusion DEX calculation core. Research only; no order execution.
   v5.3 Trading logic adapted to DEX OHLCV, never Heikin Ashi executable prices. */
(()=>{"use strict";
if(window.CrimsonPSMEngine)return;
const TF=Object.freeze({
 "1m":{unit:"minute",agg:1,ms:60000,htf:"5m"},
 "5m":{unit:"minute",agg:5,ms:300000,htf:"15m"},
 "15m":{unit:"minute",agg:15,ms:900000,htf:"1h"},
 "1h":{unit:"hour",agg:1,ms:3600000,htf:"4h"},
 "4h":{unit:"hour",agg:4,ms:14400000,htf:"1d"},
 "1d":{unit:"day",agg:1,ms:86400000,htf:null}
});
const ok=Number.isFinite;
const value=x=>x===null||x===undefined||x===""?NaN:Number(x);
function parse(raw,tf,now){
 const rows=raw?.data?.attributes?.ohlcv_list,config=TF[tf];
 if(!Array.isArray(rows)||!config)throw Error("Provider returned no usable pool OHLCV.");
 const seen=new Set(),result=[];
 for(const row of rows){
  if(!Array.isArray(row)||row.length<5)continue;
  const [t,o,h,l,c]=row.slice(0,5).map(value);const ms=t*1000;
  if(![ms,o,h,l,c].every(ok)||ms<=0||[o,h,l,c].some(x=>x<=0)||
      h<Math.max(o,l,c)||l>Math.min(o,h,c)||seen.has(ms))continue;
  // No price levels from still-forming candles.
  if(ms+config.ms>now-2000)continue;
  result.push({t:ms,o,h,l,c});seen.add(ms);
 }
 return result.sort((a,b)=>a.t-b.t);
}
function apiUrl(network,pool,token,tf){
 const x=TF[tf];
 if(!x||!["solana","robinhood"].includes(network)||
    !/^(?:[1-9A-HJ-NP-Za-km-z]{32,44}|0x[0-9a-fA-F]{40})$/.test(pool)||
    !/^(?:[1-9A-HJ-NP-Za-km-z]{32,44}|0x[0-9a-fA-F]{40})$/.test(token))
   throw Error("Unsupported market address or timeframe.");
 return "https://api.geckoterminal.com/api/v2/networks/"+encodeURIComponent(network)+
   "/pools/"+encodeURIComponent(pool)+"/ohlcv/"+x.unit+"?aggregate="+x.agg+
   "&limit=300&currency=usd&token="+encodeURIComponent(token);
}
function ema(a,n){const alpha=2/(n+1);let v=NaN;return a.map(x=>{
 if(!ok(x))return v;v=ok(v)?alpha*x+(1-alpha)*v:x;return v;
});}
function wilder(a,n){let v=NaN,sum=0,count=0;return a.map(x=>{
 if(!ok(x))return NaN;
 if(!ok(v)){sum+=x;if(++count===n)v=sum/n;}else v=(v*(n-1)+x)/n;
 return v;
});}
function indicators(bars){
 const close=bars.map(x=>x.c),fast=ema(close,21),slow=ema(close,55);
 const gain=close.map((x,i)=>i?Math.max(x-close[i-1],0):NaN);
 const loss=close.map((x,i)=>i?Math.max(close[i-1]-x,0):NaN);
 const g=wilder(gain,14),l=wilder(loss,14);
 const rsi=g.map((x,i)=>!ok(x)||!ok(l[i])?NaN:l[i]===0?(x===0?50:100):100-100/(1+x/l[i]));
 const tr=bars.map((b,i)=>!i?b.h-b.l:Math.max(b.h-b.l,Math.abs(b.h-bars[i-1].c),Math.abs(b.l-bars[i-1].c)));
 const atr=wilder(tr,14);
 const mfast=ema(close,12),mslow=ema(close,26);
 const macd=close.map((_,i)=>mfast[i]-mslow[i]),signal=ema(macd,9);
 const hist=macd.map((v,i)=>v-signal[i]);
 const ha=[];let ho=NaN,hc=NaN;
 for(const b of bars){
  const nextClose=(b.o+b.h+b.l+b.c)/4;
  const nextOpen=ok(ho)?(ho+hc)/2:(b.o+b.c)/2;
  ha.push(nextClose>nextOpen?1:nextClose<nextOpen?-1:0);
  ho=nextOpen;hc=nextClose;
 }
 return {fast,slow,rsi,atr,macd,signal,hist,ha};
}
function pivot(bars,i,high){
 const mid=i-3;if(mid<3)return NaN;
 const field=high?"h":"l",c=bars[mid][field];
 for(let j=mid-3;j<=mid+3;j++){
  if(j===mid)continue;
  if(high?bars[j][field]>=c:bars[j][field]<=c)return NaN;
 }
 return c;
}
function direction(x){return x===1?"BULLISH":x===-1?"BEARISH":"MIXED";}
function analyze(bars,higher,baseTF){
 const htf=TF[baseTF]?.htf,base=TF[baseTF],big=TF[htf];
 if(!base||!big)throw Error("Select a 4h-or-lower chart for higher-timeframe confirmation.");
 if(bars.length<80||higher.length<60)throw Error("Not enough completed pool bars for 55 EMA and confirmed swing structure.");
 const s=indicators(bars),hs=indicators(higher);
 let hi=NaN,lo=NaN,ht=-1,lastSignal=-9999,plan=null,bias="MIXED",htfBias="UNAVAILABLE";
 for(let i=0;i<bars.length;i++){
  const b=bars[i],prior=bars[i-1],pH=pivot(bars,i,true),pL=pivot(bars,i,false);
  if(ok(pH))hi=pH;if(ok(pL))lo=pL;
  while(ht+1<higher.length&&higher[ht+1].t+big.ms<=b.t+base.ms)ht++;
  const confirmed=ht>=54&&ok(hs.slow[ht]),htBull=confirmed&&higher[ht].c>hs.slow[ht],
        htBear=confirmed&&higher[ht].c<hs.slow[ht];
  const r=s.rsi[i],a=s.atr[i];
  const bull=ok(r)&&s.fast[i]>s.slow[i]&&b.c>s.slow[i]&&r>=52;
  const bear=ok(r)&&s.fast[i]<s.slow[i]&&b.c<s.slow[i]&&r<=48;
  if(i===bars.length-1){bias=bull?"BULLISH":bear?"BEARISH":"MIXED";htfBias=htBull?"BULLISH":htBear?"BEARISH":"MIXED / NO CONFIRMATION";}
  const bUp=prior&&ok(hi)&&b.c>hi&&prior.c<=hi;
  const bDn=prior&&ok(lo)&&b.c<lo&&prior.c>=lo;
  const ready=i>=36&&i-lastSignal>8&&ok(a)&&a>0;
  const recent=ready?bars.slice(i-35,i):[];
  const slLong=ready?Math.min(Math.min(...recent.map(x=>x.l)),b.c-1.5*a):NaN;
  const slShort=ready?Math.max(Math.max(...recent.map(x=>x.h)),b.c+1.5*a):NaN;
  const riskLong=b.c-slLong,riskShort=slShort-b.c;
  const buy=ready&&i>=60&&bull&&htBull&&bUp&&riskLong>0&&riskLong<=6*a;
  const sell=ready&&i>=60&&bear&&htBear&&bDn&&riskShort>0&&riskShort<=6*a;
  if(buy||sell){
   const side=buy?1:-1,entry=b.c,sl=buy?slLong:slShort,risk=Math.abs(entry-sl);
   const haConfirm=s.ha[i]===side&&s.ha[i-1]===side;
   const macdConfirm=side===1?(s.macd[i]>s.signal[i]&&s.hist[i]>0):
     (s.macd[i]<s.signal[i]&&s.hist[i]<0);
   plan={direction:side===1?"BUY":"SELL",active:true,entry,sl,
     tp1:entry+side*risk,tp2:entry+side*2*risk,tp3:entry+side*3*risk,
     at:b.t+base.ms,signalIndex:i,haConfirm,macdConfirm,
     status:side===1?"BUY SETUP":"SELL SETUP",hit1:false,hit2:false,hit3:false};
   lastSignal=i;
  }else if(plan&&plan.active&&i>plan.signalIndex){
   // Never infer a same-signal-candle fill; SL first on ambiguous OHLC bars.
   const stop=plan.direction==="BUY"?b.l<=plan.sl:b.h>=plan.sl;
   if(stop){plan.status="SL HIT (OHLC check)";plan.active=false;}
   else{
    const hit=t=>plan.direction==="BUY"?b.h>=t:b.l<=t;
    plan.hit1=plan.hit1||hit(plan.tp1);plan.hit2=plan.hit2||hit(plan.tp2);
    plan.hit3=plan.hit3||hit(plan.tp3);
    if(plan.hit3){plan.status="TP3 HIT (OHLC check)";plan.active=false;}
    else if(plan.hit2)plan.status="TP2 HIT (OHLC check)";
    else if(plan.hit1)plan.status="TP1 HIT (OHLC check)";
   }
  }
 }
 const i=bars.length-1,haDir=s.ha[i]===s.ha[i-1]?s.ha[i]:0;
 const macdDir=s.macd[i]>s.signal[i]&&s.hist[i]>0?1:
   s.macd[i]<s.signal[i]&&s.hist[i]<0?-1:0;
 return {bias,higherBias:htfBias,haBias:direction(haDir),macdBias:direction(macdDir),
   fast:s.fast[i],slow:s.slow[i],rsi:s.rsi[i],macd:s.macd[i],hist:s.hist[i],
   atr:s.atr[i],close:bars[i].c,barClosedAt:bars[i].t+base.ms,plan,
   bars:bars.length,higherBars:higher.length};
}
window.CrimsonPSMEngine=Object.freeze({TF,parse,apiUrl,analyze});
})();