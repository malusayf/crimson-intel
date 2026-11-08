/* Crimson Position Intelligence v1
 * Linked to existing entry/amount inputs + Crimson Unified Intelligence.
 * Spot-long scenario planning only. No orders, certainty, or guaranteed fills.
 */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  if($("ciPositionIntel"))return;
  const GECKO="https://api.geckoterminal.com/api/v2";
  const mintOK=x=>typeof x==="string"&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(x);
  const n=x=>x===null||x===undefined||x===""?NaN:Number(x);
  const finite=x=>Number.isFinite(x);
  const toPrice=x=>finite(x)&&x>0?"$"+x.toPrecision(8):"—";
  const money=x=>finite(x)?(x>=0?"+":"−")+"$"+Math.abs(x).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}):"—";
  const pct=x=>finite(x)?(x>=0?"+":"")+x.toFixed(1)+"%":"—";
  const make=(tag,value,cls)=>{const e=document.createElement(tag);e.textContent=String(value);if(cls)e.className=cls;return e;};
  const style=document.createElement("style");
  style.textContent=[
    "#ciPositionIntel{border-color:#5e547e;background:linear-gradient(135deg,#1e1731,#101b30)}",
    "#ciPositionIntel .cp-head{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:9px}",
    "#ciPositionIntel .cp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:12px;margin:15px 0}",
    "#ciPositionIntel .cp-tile{background:#0b1328;border:1px solid #38445f;border-radius:12px;padding:13px}",
    "#ciPositionIntel .cp-val{font-size:19px;font-weight:800;margin:5px 0}",
    "#ciPositionIntel .cp-small{font-size:12px;color:#b9c5df;line-height:1.6;margin:8px 0}",
    "#ciPositionIntel .cp-table{width:100%;border-collapse:collapse;font-size:13px}",
    "#ciPositionIntel .cp-table th,#ciPositionIntel .cp-table td{padding:9px 6px;border-bottom:1px solid #34405b;text-align:left}",
    "#ciPositionIntel .cp-green{color:#74ecc0}#ciPositionIntel .cp-red{color:#ff96a1}#ciPositionIntel .cp-yellow{color:#ffdda1}",
    "#ciPositionIntel .cp-decision{font-size:20px;font-weight:800;margin:6px 0}",
    "#ciPositionIntel .cp-buttons{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:12px 0}",
    "#ciPositionIntel .cp-buttons button{padding:8px 11px}",
    "#ciPositionIntel .cp-warning{font-size:12px;line-height:1.6;padding:12px;border-radius:10px;border:1px dashed #80664d;color:#e5d2b5}",
    "#cmPositionSummary{border:1px solid #384969;border-radius:12px;background:#0d1427;padding:12px;margin:12px 0}",
    "#cmPositionSummary .cp-title{font-size:12px;color:#b9c5df}",
    "#cmPositionSummary .cp-value{font-size:16px;font-weight:800;margin:5px 0}",
    "@media(max-width:600px){#ciPositionIntel .cp-table{font-size:11px}#ciPositionIntel .cp-table th,#ciPositionIntel .cp-table td{padding:6px 3px}}"
  ].join("\n");
  document.head.appendChild(style);

  const entryInput=$("entry"),amountInput=$("amount");
  if(!entryInput||!amountInput)return;
  const calcSection=entryInput.closest("section");
  const grid=calcSection?.closest(".two");
  const main=document.querySelector("main");
  if(!main)return;

  const view=document.createElement("section");
  view.id="ciPositionIntel";view.className="panel";
  view.innerHTML=[
    '<div class="cp-head"><div><h2>⚔ Linked Position Intelligence · Entry / SL / TP1–TP3</h2>',
    '<p class="cp-small">Uses the entry and amount you already typed in the investment calculator, the tracked coin, and Crimson Unified Intelligence. Real structure data is required for exit levels.</p></div>',
    '<span class="label" id="cpSource">5m data: not loaded</span></div>',
    '<div class="cp-grid">',
      '<div class="cp-tile"><div class="label">MY POSITION (SPOT LONG)</div><div class="cp-val" id="cpUnits">—</div><div class="cp-small" id="cpInvestment">Enter an entry price and amount</div></div>',
      '<div class="cp-tile"><div class="label">CURRENT GROSS P/L</div><div class="cp-val" id="cpNow">—</div><div class="cp-small" id="cpNowRoi">No current tracked coin</div></div>',
      '<div class="cp-tile"><div class="label">STRUCTURAL STOP-LOSS REFERENCE</div><div class="cp-val cp-red" id="cpStop">—</div><div class="cp-small" id="cpRisk">Awaiting actual 5m candles</div></div>',
      '<div class="cp-tile"><div class="label">CRIMSON POSITION DECISION</div><div class="cp-decision cp-yellow" id="cpDecision">WAIT / NO DATA</div><div class="cp-small" id="cpReason">Load a coin, price structure, and your position.</div></div>',
    '</div>',
    '<div id="cpError" class="cp-small" role="status">Live plan pending.</div>',
    '<table class="cp-table" aria-label="Potential profit or loss at reference targets">',
      '<thead><tr><th>Zone</th><th>Target price</th><th>Full position gross P/L</th><th>Return</th></tr></thead>',
      '<tbody>',
        '<tr><th>TP1 · 1R</th><td id="cpTP1">—</td><td id="cpP1">—</td><td id="cpR1">—</td></tr>',
        '<tr><th>TP2 · 2R</th><td id="cpTP2">—</td><td id="cpP2">—</td><td id="cpR2">—</td></tr>',
        '<tr><th>TP3 · 3R</th><td id="cpTP3">—</td><td id="cpP3">—</td><td id="cpR3">—</td></tr>',
        '<tr><th>SL · invalidation</th><td id="cpSL">—</td><td id="cpPL">—</td><td id="cpRL">—</td></tr>',
      '</tbody>',
    '</table>',
    '<div class="cp-buttons"><button type="button" id="cpAlertStop" disabled>Set existing SL price alert</button>',
      '<button type="button" id="cpAlertTP1" disabled>Set existing TP1 price alert</button>',
      '<button type="button" id="cpRefresh">Refresh market structure</button></div>',
    '<div class="cp-warning"><strong>Read before trading:</strong> TP profits assume selling 100% of the tokens at that single level; taking partial profits gives different realized proceeds. These are illustrative candle-based price references, not predictions. Stop-loss prices are not orders and can be skipped during a fast rug or illiquid market. Figures exclude transaction fees, taxes, slippage, market impact, and price-feed errors. The SL is recalculated from recent structure, so it may change. <strong>HOLD and exit warnings are research signals, not personal financial advice.</strong></div>'
  ].join("");
  if(grid)grid.insertAdjacentElement("afterend",view);
  else if(calcSection)calcSection.insertAdjacentElement("afterend",view);
  else main.appendChild(view);

  const unified=$("crimsonMarketRadar");
  let compact=null;
  if(unified){
    compact=document.createElement("div");compact.id="cmPositionSummary";
    compact.innerHTML='<div class="cp-title">LINKED POSITION GUIDANCE · actual entry + amount</div>'+
      '<div class="cp-value" id="cmPositionAction">WAIT / ENTER POSITION</div>'+
      '<div class="cp-title" id="cmPositionDetail">See full entry, SL and TP projections below the investment calculator.</div>';
    const anchor=$("cmOldFlow");
    if(anchor)anchor.insertAdjacentElement("afterend",compact);
    else unified.append(compact);
  }

  let current=null, intel=null, security=null, candles=null, cacheKey="", cacheTime=0,
      requestBusy=false,requestId=0,feedError="No closed candles loaded yet.";
  const QUOTE_AGE=180000,CRITICAL_STALE=12*60000;
  async function json(url){
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);
    try{const r=await fetch(url,{cache:"no-store",signal:ctl.signal});
      if(!r.ok)throw Error("Price-structure provider HTTP "+r.status);
      return await r.json();
    }finally{clearTimeout(timer);}
  }
  function getOHLC(payload,mint,lastPrice){
    const rows=payload?.data?.attributes?.ohlcv_list;
    if(!Array.isArray(rows)||rows.length<25)throw Error("Not enough recent five-minute candles.");
    const token=payload?.meta?.base?.address,quoted=payload?.meta?.quote?.address;
    if(token&&quoted&&token!==mint&&quoted!==mint)throw Error("Candle token does not match the tracked coin.");
    // A candle must be COMPLETED. Delay 5m + 15s to avoid treating an
    // unfinished/clock-skewed candle as confirmed.
    const cutoff=Date.now()/1000-315;
    const ordered=rows.map(r=>({ts:n(r[0]),o:n(r[1]),h:n(r[2]),l:n(r[3]),c:n(r[4])}))
      .filter(r=>[r.ts,r.o,r.h,r.l,r.c].every(finite)&&r.ts<=cutoff&&r.l>0&&r.h>=r.l&&r.c>0)
      .sort((a,b)=>a.ts-b.ts).slice(-55);
    if(ordered.length<25)throw Error("Not enough completed five-minute candles.");
    const last=ordered[ordered.length-1];
    if(Date.now()/1000-last.ts>CRITICAL_STALE/1000)
      throw Error("Candle feed is stale.");
    if(!finite(lastPrice)||lastPrice<=0||Math.abs(last.c-lastPrice)/lastPrice>0.20)
      throw Error("Live price differs from the completed candle feed.");
    const tr=ordered.slice(1).map((r,i)=>Math.max(r.h-r.l,Math.abs(r.h-ordered[i].c),Math.abs(r.l-ordered[i].c)));
    const atr=tr.slice(-14).reduce((a,v)=>a+v,0)/14;
    if(!(atr>0))throw Error("Cannot calculate ATR from five-minute candles.");
    const pivots=[];
    for(let i=2;i<ordered.length-2;i++){
      if(ordered[i].l<=ordered[i-1].l&&ordered[i].l<=ordered[i-2].l&&
         ordered[i].l<=ordered[i+1].l&&ordered[i].l<=ordered[i+2].l)pivots.push(ordered[i].l);
    }
    const minLow=Math.min(...ordered.slice(-30).map(r=>r.l));
    return {atr,pivots,minLow,lastPrice:last.c,lastTime:last.ts,source:"GeckoTerminal 5m confirmed candles"};
  }
  async function updateCandles(force=false){
    if(!current||!mintOK(current.mint)||!mintOK(current.pair?.pairAddress)||requestBusy)return;
    const key=current.mint+"|"+current.pair.pairAddress;
    if(!force&&key===cacheKey&&Date.now()-cacheTime<QUOTE_AGE)return;
    requestBusy=true;const thisRequest=++requestId;
    $("cpSource").textContent="5m data: checking";
    try{
      const path=GECKO+"/networks/solana/pools/"+encodeURIComponent(current.pair.pairAddress)+
        "/ohlcv/minute?aggregate=5&limit=80&currency=usd&token="+encodeURIComponent(current.mint);
      const body=await json(path);
      if(thisRequest!==requestId||!current||current.mint+"|"+current.pair?.pairAddress!==key)return;
      candles=getOHLC(body,current.mint,n(current.pair.priceUsd));
      cacheKey=key;cacheTime=Date.now();feedError="";
    }catch(e){
      if(thisRequest===requestId){
        candles=null;
        feedError=String(e?.message||"OHLC unavailable");
        // Back off failed public-provider queries; don't retry every 20 seconds.
        cacheKey=key;
        cacheTime=Date.now();
      }
    }finally{
      requestBusy=false;render();
    }
  }
  function position(){
    const entry=n(entryInput.value),amount=n(amountInput.value),market=n(current?.pair?.priceUsd);
    if(!(entry>0&&amount>0))return null;
    return {entry,amount,qty:amount/entry,market,
      currentPL:market>0?amount*(market/entry-1):NaN};
  }
  function planning(pos){
    if(!candles||!pos)return null;
    const {atr,minLow,pivots}=candles;
    const below=pivots.filter(x=>x<pos.entry).sort((a,b)=>b-a);
    const support=below[0]??Math.min(minLow,pos.entry-atr);
    // Based on past structure, protected by an ATR buffer.
    const structuralSL=Math.min(support-0.55*atr,pos.entry-0.7*atr);
    if(!(structuralSL>0&&structuralSL<pos.entry))return null;
    const risk=pos.entry-structuralSL;
    const tp1=pos.entry+risk,tp2=pos.entry+2*risk,tp3=pos.entry+3*risk;
    if(![risk,tp1,tp2,tp3].every(finite))return null;
    return {sl:structuralSL,tp1,tp2,tp3,risk,atr,riskPct:100*risk/pos.entry,
      riskExtreme:risk>8*atr||risk/pos.entry>0.5};
  }
  function decide(pos,plan){
    const m=intel?.market,sec=security||intel?.security;
    if(!pos)return {title:"ENTER POSITION DETAILS",reason:"Enter your actual purchase price and investment amount in the existing calculator.",type:"yellow"};
    if(!current||!(pos.market>0))return {title:"WAIT · TRACK A COIN",reason:"Select a Solana coin to review actual market prices.",type:"yellow"};
    if(!plan)return {title:"NO VERIFIED TRADE PLAN",reason:feedError+" Market safety alerts are still available without the chart-based TP/SL levels.",type:"yellow"};
    // Highest-priority warnings override all optimistic momentum readings.
    if(pos.market<=plan.sl)return {title:"EXIT WARNING · BELOW SL",reason:"Current quoted price is at/below the structural invalidation reference. Liquidity and execution may worsen realized proceeds.",type:"red"};
    if(sec?.verified&&sec.reject)return {title:"EXIT WARNING · SECURITY FLAG",reason:"Independent RugCheck screening reported unresolved structural risk. A high pump score cannot cancel that finding.",type:"red"};
    if(m?.dangerous||m?.dump)return {title:"REDUCE / EXIT WARNING",reason:"Current market danger or strong selling evidence exceeds the safety threshold. Reassess exposure before waiting for targets.",type:"red"};
    if(pos.market>=plan.tp3)return {title:"TP3 REACHED · REVIEW EXIT",reason:"Current quoted price is at/above TP3. Consider closing the remaining position; selling is not automatic.",type:"green"};
    if(pos.market>=plan.tp2)return {title:"TP2 REACHED · CONSIDER PARTIAL",reason:"Current quoted price is at/above TP2. You may review additional partial profit-taking, with risk and remaining size in mind.",type:"green"};
    if(pos.market>=plan.tp1)return {title:"TP1 REACHED · CONSIDER PARTIAL",reason:"Current quoted price is at/above TP1. You may consider realizing part of the position; future targets are not guaranteed.",type:"green"};
    if(plan.riskExtreme)return {title:"HIGH RISK · REASSESS POSITION",reason:"Your historical entry is far from current structure or the calculated stop distance is unusually wide. Targets may not be suitable for this holding.",type:"red"};
    if(!m?.enough)return {title:"WAIT · INSUFFICIENT MARKET DATA",reason:"Not enough current transactions or dollar volume for a reliable hold-vs-reduce assessment.",type:"yellow"};
    if(!sec?.verified)return {title:"HOLD DECISION UNVERIFIED",reason:"Market activity is observable, but the token's current on-chain rug risk has not been independently verified.",type:"yellow"};
    if(m.pump&&m.danger<50)return {title:"HOLD CANDIDATE · MONITOR RISK",reason:"Current count-based buying pressure and momentum favor waiting for a target, but there is still material rug and execution risk.",type:"green"};
    return {title:"HOLD / WAIT · NO TARGET REACHED",reason:"No TP has been reached and no major observed warning has triggered. Keep monitoring liquidity, selling pressure and the structural stop.",type:"yellow"};
  }
  function field(id,value){$(id).textContent=value;}
  function row(index,target,pos){
    const planValue=target===null?null:target;
    field("cp"+index,planValue!==null?toPrice(planValue):"—");
    field("cpP"+(index==="SL"?"L":index.slice(2)),planValue!==null?money(pos.amount*(planValue/pos.entry-1)):"—");
    field("cpR"+(index==="SL"?"L":index.slice(2)),planValue!==null?pct(100*(planValue/pos.entry-1)):"—");
  }
  function render(){
    const pos=position(),plan=planning(pos),decision=decide(pos,plan);
    field("cpUnits",pos?pos.qty.toLocaleString("en-US",{maximumFractionDigits:8})+" tokens":"—");
    field("cpInvestment",pos?money(pos.amount).replace(/^\+/,"")+" invested at "+toPrice(pos.entry):"Enter entry price and investment amount");
    field("cpNow",pos?money(pos.currentPL):"—");
    field("cpNowRoi",pos?pct(pos.currentPL/pos.amount*100)+" gross, before fees":"No position entered");
    field("cpStop",plan?toPrice(plan.sl):"—");
    field("cpRisk",plan?"Risk "+pct(-plan.riskPct)+" / "+money(-pos.qty*plan.risk)+" at reference stop":"Waiting for confirmed 5m structure");
    field("cpDecision",decision.title);$("cpDecision").className="cp-decision cp-"+decision.type;
    field("cpReason",decision.reason);
    field("cpSource",candles?"5m structure: confirmed "+new Date(candles.lastTime*1000).toLocaleTimeString():"5m data: "+(requestBusy?"checking":"not verified"));
    field("cpError",candles?"Targets are anchored to YOUR entry and a current structural SL; they will change if the observed structure changes.":feedError);
    row("TP1",plan?plan.tp1:null,pos||{amount:0,entry:1});
    row("TP2",plan?plan.tp2:null,pos||{amount:0,entry:1});
    row("TP3",plan?plan.tp3:null,pos||{amount:0,entry:1});
    row("SL",plan?plan.sl:null,pos||{amount:0,entry:1});
    $("cpAlertStop").disabled=!plan;
    $("cpAlertTP1").disabled=!plan;
    if(compact){
      field("cmPositionAction",decision.title);
      field("cmPositionDetail",plan?"SL "+toPrice(plan.sl)+" · TP1 "+toPrice(plan.tp1)+
        " · TP2 "+toPrice(plan.tp2)+" · TP3 "+toPrice(plan.tp3):
        "Enter position details; confirmed 5m levels are required.");
    }
  }
  const entryChanged=()=>render();
  entryInput.addEventListener("input",entryChanged);
  amountInput.addEventListener("input",entryChanged);
  $("cpRefresh").addEventListener("click",()=>{cacheTime=0;updateCandles(true);});
  $("cpAlertStop").addEventListener("click",()=>{
    const plan=planning(position());if(!plan||!$("below"))return;
    $("below").value=String(plan.sl);$("below").dispatchEvent(new Event("input",{bubbles:true}));
    alertNote("SL reference copied to your EXISTING downside price alert. Enable notifications separately.");
  });
  $("cpAlertTP1").addEventListener("click",()=>{
    const plan=planning(position());if(!plan||!$("above"))return;
    $("above").value=String(plan.tp1);$("above").dispatchEvent(new Event("input",{bubbles:true}));
    alertNote("TP1 reference copied to your EXISTING upside price alert. Enable notifications separately.");
  });
  function alertNote(t){field("cpError",t);}
  window.addEventListener("crimson:tracked-change",e=>{
    const mint=e.detail?.mint;
    if(!mintOK(mint))return;
    current=null;intel=null;security=null;candles=null;cacheKey="";cacheTime=0;requestId++;
    feedError="Loading new tracked token…";render();
  });
  window.addEventListener("crimson:market-snapshot",e=>{
    const m=e.detail?.mint,p=e.detail?.pair;
    if(!mintOK(m)||p?.chainId!=="solana")return;
    if(current?.mint!==m||current?.pair?.pairAddress!==p.pairAddress){
      candles=null;cacheKey="";cacheTime=0;security=null;intel=null;feedError="Fetching confirmed 5m candles…";
    }
    current={mint:m,pair:p};
    render();
    updateCandles();
  });
  window.addEventListener("crimson:unified-intelligence",e=>{
    const x=e.detail;
    if(!mintOK(x?.mint)||!current||x.mint!==current.mint)return;
    intel=x;security=x.security||security;render();
  });
  window.addEventListener("crimson:security-check",e=>{
    const x=e.detail;
    if(!current||x?.mint!==current.mint)return;
    security=x.report;render();
  });
  // In case the tracked coin was loaded before this script initialized.
  const last=window.CRIMSON_LATEST_MARKET;
  if(last&&mintOK(last.mint)&&last.pair?.chainId==="solana"){
    current={mint:last.mint,pair:last.pair};
    intel=window.CRIMSON_LATEST_INTELLIGENCE||null;
    security=intel?.security||null;
    updateCandles();
  }
  render();
})();