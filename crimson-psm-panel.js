/* Crimson Intel · PSM Fusion DEX Research Panel.
   Appends to the existing DEX chart panel and follows the same tracked pool.
   Never imports trade/signer services; cannot send real orders. */
(()=>{"use strict";
const engine=window.CrimsonPSMEngine;
if(!engine||document.getElementById("ciPsmDex"))return;
const $=id=>document.getElementById(id);
const chart=$("chart"),host=chart?.closest("section.panel")||chart?.parentElement;
if(!host)return;
const css=document.createElement("style");css.id="ciPsmStyle";
css.textContent=[
 "#ciPsmDex{margin-top:18px;padding:16px;border:1px solid #80456e;border-radius:14px;background:linear-gradient(130deg,#21192b,#0d192d);color:#f5f0fa}",
 "#ciPsmDex *{box-sizing:border-box}",
 "#ciPsmDex h3{font-size:18px;margin:0 0 5px}",
 "#ciPsmDex .pd-flex{display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between;align-items:center}",
 "#ciPsmDex .pd-controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap}",
 "#ciPsmDex select,#ciPsmDex button{border-radius:8px;background:#26314b;border:1px solid #62708b;color:#fff;font-size:12px;padding:8px}",
 "#ciPsmDex p{font-size:12px;line-height:1.55;color:#b7c6df;margin:8px 0}",
 "#ciPsmDex .pd-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,162px),1fr));gap:9px;margin:12px 0}",
 "#ciPsmDex .pd-tile{background:#0b1529;border:1px solid #3d4763;border-radius:11px;padding:11px;min-width:0}",
 "#ciPsmDex .pd-tile small,#ciPsmDex .pd-row small{font-size:11px;color:#b7c4d7;display:block;margin-bottom:5px}",
 "#ciPsmDex .pd-tile strong{font-size:16px;overflow-wrap:anywhere}",
 "#ciPsmDex .pd-plan{padding:12px;background:#10192e;border-radius:11px;border:1px solid #47516d}",
 "#ciPsmDex .pd-levels{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,115px),1fr));gap:7px;margin-top:10px}",
 "#ciPsmDex .pd-row{background:#172239;border-radius:8px;padding:9px;overflow-wrap:anywhere}",
 "#ciPsmDex .pd-green{color:#74edbb!important}",
 "#ciPsmDex .pd-red{color:#ff8e9e!important}",
 "#ciPsmDex .pd-gold{color:#ffdc9b!important}",
 "#ciPsmDex .pd-foot{border-top:1px solid #3b435b;margin-top:13px;padding-top:10px}",
 "#ciPsmDex .pd-foot p{font-size:11px}",
 "@media(max-width:570px){#ciPsmDex{padding:12px}#ciPsmDex .pd-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}"
].join("");
document.head.appendChild(css);
const panel=document.createElement("div");panel.id="ciPsmDex";
panel.innerHTML=[
 '<div class="pd-flex"><div><h3>📈 PSM Fusion · DEX Research <small style="font-size:11px;color:#f0a6cb">BETA</small></h3>',
 '<p>Separate read-only analysis beside your DEX chart. Your TradingView v5.3 remains unchanged.</p></div>',
 '<div class="pd-controls"><label for="pdTime">Chart TF</label><select id="pdTime">',
 '<option value="auto" selected>Auto · best confirmed TF</option>',
 '<option value="1m">1 minute</option><option value="5m">5 minutes</option>',
 '<option value="15m">15 minutes</option><option value="1h">1 hour</option>',
 '<option value="4h">4 hours</option><option value="1d">1 day (HTF unavailable)</option>',
 '</select><button id="pdReload" type="button">Refresh candles</button></div></div>',
 '<p id="pdStatus" role="status" aria-live="polite">Track a token to load confirmed candles.</p>',
 '<p id="pdActive" style="font-size:11px;color:#ffc3da">AUTO chooses 15m, 5m, then 1m based on completed history; no invented bars.</p>',
 '<div class="pd-grid">',
 '<div class="pd-tile"><small>PSM trend + RSI</small><strong id="pdBias">—</strong><p id="pdRsi">—</p></div>',
 '<div class="pd-tile"><small>EMA 21 / EMA 55</small><strong id="pdEma">—</strong></div>',
 '<div class="pd-tile"><small>Confirmed higher TF</small><strong id="pdHigher">—</strong></div>',
 '<div class="pd-tile"><small>Heikin Ashi trend</small><strong id="pdHa">—</strong></div>',
 '<div class="pd-tile"><small>MACD (12,26,9)</small><strong id="pdMacd">—</strong><p id="pdHist">—</p></div>',
 '<div class="pd-tile"><small>Last completed close</small><strong id="pdClose">—</strong></div>',
 '</div>',
 '<div class="pd-plan"><div class="pd-flex"><strong>Latest PSM breakout reference</strong><strong id="pdTrade">NO SIGNAL</strong></div>',
 '<p id="pdTradeNote">Entry/SL/TP use real pool OHLCV, not Heikin Ashi synthetic prices.</p>',
 '<div class="pd-levels">',
 '<div class="pd-row"><small>ENTRY</small><strong id="pdEntry">—</strong></div>',
 '<div class="pd-row"><small>SL</small><strong id="pdSL">—</strong></div>',
 '<div class="pd-row"><small>TP1 · 1R</small><strong id="pdTP1">—</strong></div>',
 '<div class="pd-row"><small>TP2 · 2R</small><strong id="pdTP2">—</strong></div>',
 '<div class="pd-row"><small>TP3 · 3R</small><strong id="pdTP3">—</strong></div>',
 '</div><p id="pdConfirm">HA and MACD are separate observations and do not alter v5.3 signals.</p></div>',
 '<div class="pd-foot"><strong>Same selected pool · liquidity and activity</strong>',
 '<p id="pdFlow">No pool selected.</p>',
 '<p>Buys/sells are transactions, not unique people. Reference trade plans are NOT executable fills or verified backtests. Does not account for transfer taxes, MEV, slippage, price impact, pool drains or fees. No order execution.</p>',
 '</div>'
].join("");
host.appendChild(panel);
const state={snap:null,key:"",requestedAt:0,controller:null};
const set=(id,value)=>{const el=$(id);if(el)el.textContent=String(value)};
const num=v=>v==null||v===""?NaN:Number(v);
const finite=Number.isFinite;
const format=v=>!finite(v)?"—":v>=1?"$"+v.toLocaleString("en-US",{maximumFractionDigits:5}):
 v>=0.000001?"$"+v.toPrecision(6):"$"+v.toExponential(5);
const money=x=>!finite(num(x))?"—":"$"+Number(x).toLocaleString("en-US",{maximumFractionDigits:0});
const stamp=x=>finite(x)?new Date(x).toLocaleString():"—";
const tone=(id,status)=>{
 const el=$(id);if(!el)return;
 el.classList.remove("pd-green","pd-red","pd-gold");
 el.classList.add(status==="BULLISH"?"pd-green":status==="BEARISH"?"pd-red":"pd-gold");
};
function clear(message){
 for(const id of ["pdBias","pdRsi","pdEma","pdHigher","pdHa","pdMacd","pdHist",
  "pdClose","pdEntry","pdSL","pdTP1","pdTP2","pdTP3"])set(id,"—");
 set("pdTrade","NO CONFIRMED SIGNAL");
 set("pdTradeNote","No verified entry or trade plan is available.");
 set("pdConfirm","HA and MACD observations do not change the original PSM breakout rule.");
 set("pdStatus",message);
 set("pdActive","No valid pool/timeframe selected.");
}
function flow(snap){
 const p=snap?.pair;
 if(!p){set("pdFlow","No pool selected.");return;}
 const five=p.txns?.m5||{},hour=p.txns?.h1||{};
 set("pdFlow","Liquidity "+money(p.liquidity?.usd)+
  " · 5m: "+(five.buys??"—")+" buys / "+(five.sells??"—")+" sells"+
  " · 1h: "+(hour.buys??"—")+" buys / "+(hour.sells??"—")+" sells"+
  " · 24h volume "+money(p.volume?.h24)+(p.dataStale?" · STALE DATA":""));
}
function render(data,snap,tf){
 set("pdBias",data.bias);tone("pdBias",data.bias);
 set("pdRsi","RSI 14: "+(finite(data.rsi)?data.rsi.toFixed(1):"—"));
 set("pdEma",format(data.fast)+" / "+format(data.slow));
 set("pdHigher",engine.TF[tf].htf+": "+data.higherBias);tone("pdHigher",data.higherBias);
 set("pdHa",data.haBias);tone("pdHa",data.haBias);
 set("pdMacd",data.macdBias);tone("pdMacd",data.macdBias);
 set("pdHist","Histogram: "+(finite(data.hist)?data.hist.toPrecision(4):"—"));
 set("pdClose",format(data.close));
 const p=data.plan;
 if(p){
  set("pdTrade",p.direction+" · "+p.status);
  set("pdTradeNote","Last signal "+stamp(p.at)+" · outcome checked on following completed candles, SL first when ambiguous.");
  set("pdEntry",format(p.entry));set("pdSL",format(p.sl));
  set("pdTP1",format(p.tp1));set("pdTP2",format(p.tp2));set("pdTP3",format(p.tp3));
  set("pdConfirm","At entry: HA "+(p.haConfirm?"AGREED":"DID NOT CONFIRM")+
    " · MACD "+(p.macdConfirm?"AGREED":"DID NOT CONFIRM")+
    ". These are separate checks, not extra signal filters.");
 }else{
  set("pdTrade","NO CONFIRMED BREAKOUT");
  for(const id of ["pdEntry","pdSL","pdTP1","pdTP2","pdTP3"])set(id,"—");
  set("pdTradeNote","No PSM-qualified breakout in the available completed OHLCV sample.");
  set("pdConfirm","Latest HA "+data.haBias+" · MACD "+data.macdBias+
   ". Agreement alone does not trigger an entry.");
 }
 const current=num(snap.pair.priceUsd);
 const mismatch=finite(current)&&current>0&&Math.abs(current-data.close)/data.close>0.20;
 set("pdStatus",snap.pair.dexId+" · "+tf+" / confirmed "+engine.TF[tf].htf+
   " · "+data.bars+" + "+data.higherBars+" closed bars"+
   " · last close "+stamp(data.barClosedAt)+
   (mismatch?" · WARNING: live pool quote differs >20% from last candle close":"")+
   " · provider may lag; signal levels are historical.");
}
function renderPreview(data,snap,tf,extra){
  set("pdBias",data.bias);tone("pdBias",data.bias);
  set("pdRsi","RSI 14: "+(finite(data.rsi)?data.rsi.toFixed(1):"—"));
  set("pdEma",format(data.fast)+" / "+format(data.slow));
  set("pdHigher",engine.TF[tf].htf+": "+data.higherBias);
  tone("pdHigher",data.higherBias);
  set("pdHa",data.haBias);tone("pdHa",data.haBias);
  set("pdMacd",data.macdBias);tone("pdMacd",data.macdBias);
  set("pdHist","Histogram: "+(finite(data.hist)?data.hist.toPrecision(4):"—"));
  set("pdClose",format(data.close));
  set("pdTrade","WAIT · INSUFFICIENT DATA");
  for(const id of ["pdEntry","pdSL","pdTP1","pdTP2","pdTP3"])set(id,"—");
  set("pdTradeNote","NO PSM SIGNAL: "+data.bars+"/"+data.requiredBars+" completed "+tf+
    " bars and "+data.higherBars+"/"+data.requiredHigher+" confirmed "+engine.TF[tf].htf+
    " bars. Waiting for a fully established 55 EMA and swing history.");
  set("pdConfirm","Early-token HA, MACD, EMA and RSI values are preliminary observations only; no entry, SL or TP issued.");
  set("pdStatus","Early-token research · "+tf+" chart has "+data.bars+
    "/80 bars; "+engine.TF[tf].htf+" higher TF has "+data.higherBars+
    "/60 bars · last completed "+stamp(data.barClosedAt)+". "+(extra||""));
  set("pdActive","EARLY TOKEN / WAIT: PSM entry rules need 80 completed chart bars and 60 completed higher-timeframe bars.");
}
function abort(){state.controller?.abort();state.controller=null;}
async function fetchBars(url,controller){
 const response=await fetch(url,{signal:controller.signal,cache:"no-store",credentials:"omit"});
 if(!response.ok)throw Error("GeckoTerminal HTTP "+response.status+(response.status===429?" · rate-limited":""));
 return response.json();
}
async function update(force){
 const snap=state.snap,p=snap?.pair,selection=$("pdTime").value;
 const auto=selection==="auto";
 const requested=auto?["15m","5m","1m"]:[selection];
 if(!p)return;
 flow(snap);
 if(!auto&&!engine.TF[selection]?.htf){
  abort();clear("Daily OHLCV has no supported higher TF. Choose Auto or 4h and lower.");flow(snap);return;
 }
 if(p.priceType==="issuer-reference"||!p.pairAddress){
  abort();clear("Issuer prices are NOT DEX pool candle data. Track a real DEX pool.");flow(snap);return;
 }
 if(p.dataStale){
  abort();clear("Tracked pool quote is stale. No PSM signal until the quote refreshes.");flow(snap);return;
 }
 if(String(p.baseToken?.address||"").toLowerCase()!==String(snap.mint||"").toLowerCase()){
  abort();clear("Pool base token does not match the tracked contract. Analysis blocked.");flow(snap);return;
 }
 const key=[snap.chainId,p.pairAddress,snap.mint,selection].join("|");
 if(!force&&state.key===key&&Date.now()-state.requestedAt<90000)return;
 abort();
 const ctl=new AbortController();
 state.controller=ctl;state.key=key;state.requestedAt=Date.now();
 set("pdStatus",auto?"Finding a timeframe with enough confirmed pool candles…":
  "Loading confirmed "+selection+" and "+engine.TF[selection].htf+" OHLCV candles…");
 const timer=setTimeout(()=>ctl.abort(),24000);
 const dataCache=new Map();
 async function getTimeframe(tf){
  if(!dataCache.has(tf)){
   const url=engine.apiUrl(snap.chainId,p.pairAddress,snap.mint,tf);
   dataCache.set(tf,fetchBars(url,ctl).then(raw=>engine.parse(raw,tf,Date.now())));
  }
  return dataCache.get(tf);
 }
 let best=null;
 try {
  for(const tf of requested){
   const higherTf=engine.TF[tf].htf;
   // AUTO caches overlapping higher-timeframe candles: at most 4 HTTP
   // requests for 15m/1h, 5m/15m and 1m/5m, not 6.
   const [bars,higher]=await Promise.all([getTimeframe(tf),getTimeframe(higherTf)]);
   if(state.controller!==ctl||state.snap?.mint!==snap.mint||
     state.snap?.pair?.pairAddress!==p.pairAddress||$("pdTime").value!==selection)return;
   const now=Date.now(),last=bars[bars.length-1],lastHigher=higher[higher.length-1];
   const spec=engine.TF[tf],htfSpec=engine.TF[higherTf];
   const fresh=!!last&&now-(last.t+spec.ms)<=Math.max(3*spec.ms,600000);
   const higherFresh=!!lastHigher&&now-(lastHigher.t+htfSpec.ms)<=Math.max(3*htfSpec.ms,600000);
   const preview=engine.preview(bars,higher,tf);
   const progress=Math.min(1,bars.length/80)*0.6+Math.min(1,higher.length/60)*0.4;
   if(fresh&&(!best||progress>best.progress))
     best={tf,preview,progress,higherFresh};
   if(preview.ready&&fresh&&higherFresh){
     const result=engine.analyze(bars,higher,tf);
     render(result,snap,tf);
     set("pdActive",(auto?"AUTO selected ":"Manual ")+tf+
       " with confirmed "+higherTf+" trend · "+bars.length+
       "/80 chart bars and "+higher.length+"/60 higher bars. PSM levels are reference only.");
     return;
   }
   if(!auto)break;
  }
  if(best){
   renderPreview(best.preview,snap,best.tf,
     best.higherFresh?"No full v5.3 trade signal yet.":
      "Higher timeframe data is not recent enough for a trade signal.");
   if(auto)set("pdActive","AUTO: best available provisional timeframe "+best.tf+
     ". Waiting for 80 chart candles and 60 higher-timeframe candles before issuing a PSM plan.");
  }else{
   clear("The pool has no recent completed candles for the selected timeframe(s). No signal generated.");
   flow(state.snap);
  }
 }catch(err){
  if(state.controller!==ctl)return;
  clear("PSM candle request failed: "+(err?.name==="AbortError"?"request timed out":
    err?.message||"provider unavailable")+
    ". This is different from insufficient history. Check network, API, CORS and rate limits.");
  flow(state.snap);
 }finally{
  clearTimeout(timer);
  if(state.controller===ctl)state.controller=null;
 }
}
function accept(snap){
 if(!snap?.pair)return;
 const old=state.snap;
 const changed=!old||old.mint!==snap.mint||old.chainId!==snap.chainId||
  old.pair?.pairAddress!==snap.pair.pairAddress;
 state.snap=snap;
 if(changed){abort();state.key="";state.requestedAt=0;clear("New pool selected; requesting candles…");}
 flow(snap);update(false);
}
window.addEventListener("crimson:market-snapshot",event=>accept(event.detail));
window.addEventListener("crimson:tracked-change",()=>{
 abort();state.snap=null;state.key="";state.requestedAt=0;
 clear("Track a token to load confirmed pool candles.");flow(null);
});
$("pdTime").addEventListener("change",()=>{state.key="";state.requestedAt=0;update(true)});
$("pdReload").addEventListener("click",()=>{state.requestedAt=0;update(true)});
if(window.CRIMSON_LATEST_MARKET)accept(window.CRIMSON_LATEST_MARKET);
else clear("Track a Solana or Robinhood Chain DEX token to load PSM research.");
})();