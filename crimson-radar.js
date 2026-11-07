/* Crimson Unified Intelligence v2.
   Integrates original transaction-count pressure, Solana discovery and tracked
   market risk. Uses the SAME evaluation rules for tracked and discovered pairs.
   Keeps the existing investment calculator, price alerts and Safety Scout.
   Market-risk scores are heuristics, NOT likelihoods or true on-chain fund flow.
*/
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  if($("crimsonMarketRadar"))return;
  const DEX="https://api.dexscreener.com";
  const MINT=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  const num=x=>x==null||x===""?NaN:Number(x);
  const clamp=n=>Math.max(0,Math.min(100,Math.round(n)));
  const usd=x=>Number.isFinite(x)?"$"+x.toLocaleString("en-US",{maximumFractionDigits:Math.abs(x)<1?5:2}):"—";
  const pct=x=>Number.isFinite(x)?(x>0?"+":"")+x.toFixed(1)+"%":"—";
  const make=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=String(text);if(cls)n.className=cls;return n;};
  const link=(text,url)=>{const a=make("a",text);a.href=url;a.rel="noopener noreferrer";a.target="_blank";return a;};
  const evidence=(node,lines)=>{node.replaceChildren();for(const item of lines)node.append(make("li",item));};
  const styles=document.createElement("style");
  styles.textContent=[
    "#crimsonMarketRadar{background:linear-gradient(150deg,#20192f,#121b31);border:1px solid #805072}",
    "#crimsonMarketRadar .cm-header{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center}",
    "#crimsonMarketRadar .cm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,225px),1fr));gap:10px;margin:12px 0}",
    "#crimsonMarketRadar .cm-tile{background:#0b1328;border:1px solid #39425d;border-radius:12px;padding:13px}",
    "#crimsonMarketRadar .cm-tile .cm-value{font-size:21px;font-weight:800;margin:5px 0;overflow-wrap:anywhere}",
    "#crimsonMarketRadar .cm-small{font-size:12px;color:#b8c4e0;line-height:1.55}",
    "#crimsonMarketRadar .cm-signal{font-weight:800;font-size:14px;margin:7px 0}",
    "#crimsonMarketRadar .cm-actions{display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin:12px 0}",
    "#crimsonMarketRadar .cm-actions button{padding:8px 12px}",
    "#crimsonMarketRadar .cm-actions button.cm-filter{background:#2b3551}",
    "#crimsonMarketRadar .cm-actions button.cm-selected{outline:2px solid #fa477f}",
    "#crimsonMarketRadar .cm-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:10px}",
    "#crimsonMarketRadar .cm-card{background:#0c1428;border:1px solid #35415d;border-radius:13px;padding:13px;min-width:0}",
    "#crimsonMarketRadar .cm-card h3{margin:0 0 8px;font-size:16px;overflow-wrap:anywhere}",
    "#crimsonMarketRadar .cm-card button{padding:8px 11px;margin:5px 8px 5px 0}",
    "#crimsonMarketRadar .cm-card a{color:#b3c6ff;font-size:12px}",
    "#crimsonMarketRadar .cm-tag{font-size:11px;padding:4px 8px;border-radius:99px;display:inline-block;background:#2d3751;color:#cfdcff;font-weight:750}",
    "#crimsonMarketRadar .cm-tag.danger{background:#4b2634;color:#ff9baa}",
    "#crimsonMarketRadar .cm-tag.watch{background:#3d3724;color:#ffe2aa}",
    "#crimsonMarketRadar .cm-tag.good{background:#173f37;color:#8eeed2}",
    "#crimsonMarketRadar .cm-evidence{padding-left:22px;margin:7px 0}",
    "#crimsonMarketRadar .cm-evidence li{margin:4px 0;font-size:12px;color:#c1cce6;line-height:1.45}",
    "#crimsonMarketRadar .cm-divider{border-top:1px solid #3b4664;margin:17px 0}",
    "#crimsonMarketRadar .cm-flow{background:#0b1328;border:1px solid #35415d;border-radius:13px;padding:15px;margin-top:12px}",
    "#crimsonMarketRadar .cm-flow .meter{margin:10px 0}",
    "#crimsonMarketRadar .cm-caution{border:1px dashed #775f47;background:#292033;border-radius:10px;padding:12px;color:#e3d1b4;font-size:12px;line-height:1.55}",
    "#crimsonMarketRadar .cm-hidden{display:none!important}",
    "#crimsonMarketRadar button:disabled{opacity:.5}",
    "#crimsonMarketRadar .cm-success{color:#78e9b8}",
    "#crimsonMarketRadar .cm-danger{color:#ff8a9e}",
    "#crimsonMarketRadar .cm-amber{color:#ffe09a}",
    "body .ci-money-moved{background:transparent;border:0;padding:0;margin:0}",
    "@media(max-width:600px){#crimsonMarketRadar .cm-grid{grid-template-columns:1fr 1fr}#crimsonMarketRadar .cm-tile .cm-value{font-size:18px}}"
  ].join("\n");
  document.head.append(styles);

  const main=document.querySelector("main");if(!main)return;
  const root=document.createElement("section");root.className="panel";root.id="crimsonMarketRadar";
  root.innerHTML=[
    '<div class="cm-header"><div><h2>⚔ Crimson Unified Intelligence <span class="cm-tag">V2 BETA</span></h2>',
    '<p class="cm-small">One engine for token discovery, transaction pressure, momentum and observed market danger. Verified on-chain safety is separate; no score is a future prediction.</p></div>',
    '<button id="cmRefresh" type="button">Scan Solana candidates</button></div>',
    '<div class="cm-divider"></div><h3>Tracked Coin · Live Market Intelligence</h3>',
    '<p id="cmLiveStatus" class="cm-small" role="status">Track a Solana coin for real observations.</p>',
    '<div class="cm-grid">',
      '<div class="cm-tile"><div class="label">5M BUY TRANSACTION SHARE</div><div id="cmBuy" class="cm-value">—</div><div id="cmBuyDetails" class="cm-small">No recent coin data</div></div>',
      '<div class="cm-tile"><div class="label">OPPORTUNITY MOMENTUM</div><div id="cmOpportunity" class="cm-value">—</div><div class="cm-small">Heuristic score · NOT a win probability</div></div>',
      '<div class="cm-tile"><div class="label">OBSERVED MARKET DANGER</div><div id="cmDanger" class="cm-value">—</div><div class="cm-small">Higher means more observed risk</div></div>',
      '<div class="cm-tile"><div class="label">SECURITY CHECK</div><div id="cmSecurity" class="cm-value" style="font-size:15px">UNVERIFIED</div><div id="cmSecurityInfo" class="cm-small">RugCheck pending or unavailable</div></div>',
    '</div><div id="cmDecision" class="cm-signal cm-amber">WAIT · DATA NEEDED</div>',
    '<div id="cmConfidence" class="cm-small"></div>',
    '<h3>Evidence · why Crimson reached this assessment</h3><ul class="cm-evidence" id="cmEvidence"><li>Track a coin to begin.</li></ul>',
    '<div class="cm-flow" id="cmOldFlow"></div>',
    '<div class="cm-caution" style="margin-top:12px">Important: Buy/sell transaction share is a count-based pressure proxy, NOT USD net inflow, unique wallets, or the textbook Money Flow Index. High momentum does not override liquidity danger or unverified token security. Low-volume signals are withheld instead of rated favorable.</div>',
    '<div class="cm-divider"></div><h3>Whole-Market Discovery Sample</h3>',
    '<p class="cm-small">Uses the same scoring rules on publicly discovered Solana pools. Paid profiles/boosts can appear; this is NOT a comprehensive scan or recommendation.</p>',
    '<div class="cm-actions"><button data-cm="all" class="cm-filter cm-selected" type="button">All</button>',
      '<button data-cm="pump" class="cm-filter" type="button">Pump Watch</button>',
      '<button data-cm="dump" class="cm-filter" type="button">Dump Watch</button>',
      '<button data-cm="danger" class="cm-filter" type="button">Market Danger</button>',
      '<button data-cm="thin" class="cm-filter" type="button">Low Data</button></div>',
    '<div id="cmScanStatus" class="cm-small" role="status">Press Scan or use automatic discovery.</div>',
    '<div id="cmCards" class="cm-cards"></div>'
  ].join("");
  const searchSection=$("mint")?.closest("section");
  if(searchSection)searchSection.insertAdjacentElement("afterend",root);else main.prepend(root);

  // Move the EXISTING count-based flow card into this unified dashboard.
  // It keeps the same IDs, so the old investment/alerts script still updates it.
  const flow=$("score")?.closest("section");
  if(flow){
    const parent=flow.parentElement;
    const title=flow.querySelector("h2");
    if(title)title.textContent="Transaction Pressure · Count-Based Money Flow";
    flow.classList.add("ci-money-moved");
    $("cmOldFlow").appendChild(flow);
    if(parent?.classList.contains("two"))parent.style.gridTemplateColumns="minmax(0,1fr)";
  }else{
    $("cmOldFlow").appendChild(make("p","Money Flow component unavailable; other analysis remains active.","cm-small"));
  }

  // The rug scanner will place its own separate verified-security panel after
  // the main intelligence section; this is only the shared tracked summary.
  const riskAnchor=document.createElement("div");
  riskAnchor.id="crimsonTrackedRadar";
  root.appendChild(riskAnchor);

  const DANGER=65, SAMPLE_LIMIT=30;
  const lastLiq=new Map(),security=new Map(), latestByMint=new Map();
  let activeMint="", activePair=null, allRows=[], filter="all",scanBusy=false,scanAt=0;

  // All measures use the same reference pool and the same data-quality gates.
  // Avoid returning a confident 50/50 score from 1 buy and 1 sell.
  function evaluate(p,previous){
    const liq=num(p?.liquidity?.usd), m5=num(p?.priceChange?.m5),
    h1=num(p?.priceChange?.h1),h24=num(p?.priceChange?.h24),
    v5=num(p?.volume?.m5),v1=num(p?.volume?.h1);
    const b5=num(p?.txns?.m5?.buys),s5=num(p?.txns?.m5?.sells),
    b1=num(p?.txns?.h1?.buys),s1=num(p?.txns?.h1?.sells);
    const t5=b5+s5,t1=b1+s1;
    const baseValid=[liq,m5,h1,v5,v1,b5,s5,b1,s1].every(Number.isFinite)
      && liq>0 && t5>=0 && t1>=0 && v5>=0 && v1>=0;
    const enough=baseValid && t5>=20 && t1>=50 && v5>=200 && v1>=1000;
    if(!baseValid)return {enough:false,buyShare:null,opp:null,danger:null,
      pump:false,dump:false,dangerous:false,decision:"INSUFFICIENT DATA",
      reasons:["Missing liquidity, volume, or transaction data; no reliable assessment possible."]};
    const share5=t5?100*b5/t5:null;
    const share1=t1?100*b1/t1:null;
    const notes=[
      "5m: "+t5+" trades, "+usd(v5)+" volume; 1h: "+t1+" trades, "+usd(v1)+" volume.",
      "Buy transaction shares: 5m "+(share5===null?"—":share5.toFixed(0)+"%")+"; 1h "+(share1===null?"—":share1.toFixed(0)+"%")+" (counts, not dollar flow)."
    ];
    if(liq<25000)notes.push("Low pool liquidity: fills may have extreme slippage.");
    if(!enough){
      notes.push("Weak data quality: require at least 20 trades / $200 volume (5m) and 50 trades / $1k volume (1h).");
      return {enough:false,buyShare:share5,opp:null,danger:null,pump:false,dump:false,dangerous:liq<25000,
        decision:liq<25000?"LOW LIQUIDITY / AVOID":"INSUFFICIENT DATA", reasons:notes};
    }
    let opp=30,risk=5;
    if(share5>=65){opp+=20;notes.push("Short-term buy transaction frequency is elevated.");}
    else if(share5<=35){opp-=20;risk+=20;notes.push("Short-term sells dominate trade count.");}
    else if(share5>=55)opp+=10;
    if(share1>=60)opp+=12;
    else if(share1<=40){opp-=12;risk+=15;notes.push("1h sellers are relatively active.");}
    if(m5>1&&m5<=10)opp+=15;
    else if(m5>10&&m5<=20){opp+=6;risk+=10;notes.push("Fast 5m rally may be overheated.");}
    else if(m5>20){risk+=25;notes.push("Extreme 5m upward move: reversal risk.");}
    else if(m5<=-8){opp-=20;risk+=30;notes.push("Severe 5m price decline "+pct(m5)+".");}
    else if(m5<=-3)risk+=12;
    if(h1>=3&&h1<=25)opp+=15;
    else if(h1>35){risk+=18;notes.push("1h price is heavily extended.");}
    else if(h1<=-15){risk+=18;opp-=15;notes.push("1h drawdown "+pct(h1)+".");}
    if(Number.isFinite(h24)&&h24>150){risk+=15;notes.push("Large 24h rally raises chasing risk.");}
    if(t5>=45)opp+=7;
    const turnover=v5/liq;
    if(turnover>=.08&&turnover<=1.2)opp+=9;
    if(turnover>2){risk+=12;notes.push("Very high 5m turnover relative to pool liquidity.");}
    if(liq<10000){risk+=70;opp-=35;}
    else if(liq<25000){risk+=50;opp-=25;}
    else if(liq<50000){risk+=25;opp-=12;}
    else if(liq<75000)risk+=10;
    if(previous?.liquidity>0 && Date.now()-previous.time<1800000){
      const dip=100*(previous.liquidity-liq)/previous.liquidity;
      if(dip>=20){risk+=40;notes.push("Observed pool USD liquidity fell "+dip.toFixed(1)+"% since last snapshot. Reason unverified.");}
      else if(dip>=10){risk+=20;notes.push("Observed pool USD liquidity fell "+dip.toFixed(1)+"% since last snapshot.");}
    }
    opp=clamp(opp);risk=clamp(risk);
    const dump=share5<=40&&(m5<-3||h1<-8);
    const dangerous=risk>=DANGER;
    const pump=opp>=70&&risk<50&&share1>=55&&m5>0;
    const decision=dangerous?"MARKET DANGER / AVOID":
      dump?"DUMP WATCH / AVOID":
      pump?"PUMP WATCH · VERIFY ENTRY":"WAIT / OBSERVE";
    return {enough:true,buyShare:share5,opp,danger:risk,pump,dump,dangerous,decision,reasons:notes};
  }
  function assessmentWithSecurity(a, sec){
    if(!a.enough)return a.decision;
    if(a.dangerous||a.dump)return a.decision;
    if(sec?.verified&&sec.reject)return "SECURITY FLAG / AVOID";
    if(!sec?.verified)return "SECURITY UNVERIFIED / OBSERVE";
    if(a.pump)return "PUMP WATCH / WAIT FOR ENTRY";
    return a.decision;
  }

  function redrawTracked(){
    if(!activePair)return;
    const m=activeMint, a=evaluate(activePair,lastLiq.get(m)),sec=security.get(m);
    $("cmBuy").textContent=a.buyShare===null?"—":a.buyShare.toFixed(1)+"%";
    const buyText=activePair.txns?.m5||{};
    $("cmBuyDetails").textContent=(num(buyText.buys)||0)+" buys / "+(num(buyText.sells)||0)+" sells · count-based";
    $("cmOpportunity").textContent=a.opp===null?"—":a.opp+"/100";
    $("cmDanger").textContent=a.danger===null?"—":a.danger+"/100";
    $("cmDanger").className="cm-value "+(a.dangerous?"cm-danger":"");
    $("cmSecurity").textContent=sec?.verified?(sec.reject?"RISK FLAGGED":"SCREENED / NOT GUARANTEED"):"UNVERIFIED";
    $("cmSecurityInfo").textContent=sec?.verified?
      (sec.notes?.[0]||"Provider report available; not a guarantee"):
      "No verified token-security report; cannot assess rug probability.";
    const final=assessmentWithSecurity(a,sec);
    $("cmDecision").textContent=final;
    $("cmDecision").className="cm-signal "+(final.includes("AVOID")?"cm-danger":final.includes("WATCH")?"cm-success":"cm-amber");
    $("cmConfidence").textContent=a.enough?
      "Activity sample adequate for these thresholds · 5m / 1h. No trade-size weighting or wallet identity verification.":
      "DATA QUALITY: LOW · Do not infer directional strength from isolated small trades.";
    evidence($("cmEvidence"),a.reasons);
    // Keep the preserved Money Flow card consistent with the engine's
    // evidence thresholds. The original tracker has just updated its counts;
    // override its directional label only when the sample is too thin.
    const legacyScore=$("score"),legacySignal=$("signal");
    if(legacyScore&&legacySignal){
      legacyScore.textContent=a.enough?a.buyShare.toFixed(1)+"/100":"—";
      legacySignal.textContent=!a.enough?"INSUFFICIENT DATA":
        a.buyShare>=60?"BUY COUNT PRESSURE":
        a.buyShare<=40?"SELL COUNT PRESSURE":"MIXED";
      legacySignal.style.color=!a.enough?"#ffd166":a.buyShare>=60?"#4ee0a9":a.buyShare<=40?"#ff6977":"#ffd166";
      if($("buybar"))$("buybar").style.width=a.enough?a.buyShare+"%":"0%";
      if($("sellbar"))$("sellbar").style.width=a.enough?(100-a.buyShare)+"%":"0%";
    }
    $("cmLiveStatus").textContent="Tracking "+(activePair.baseToken?.symbol||"SOL token")+" · "+new Date().toLocaleTimeString()+" · selected DEX pool";
    lastLiq.set(m,{liquidity:num(activePair?.liquidity?.usd),time:Date.now()});
  }

  // The original tracker already fetches the same token every ~20s.
  // Consume its snapshot rather than independently polling it a second time.
  window.addEventListener("crimson:market-snapshot",ev=>{
    const mint=ev.detail?.mint,pair=ev.detail?.pair;
    if(!MINT.test(mint||"")||pair?.chainId!=="solana")return;
    activeMint=mint;activePair=pair;latestByMint.set(mint,pair);
    redrawTracked();
  });
  window.addEventListener("crimson:tracked-change",ev=>{
    const mint=ev.detail?.mint||"";
    if(MINT.test(mint)&&mint!==activeMint){
      activeMint=mint;activePair=null;
      for(const id of ["cmBuy","cmOpportunity","cmDanger"])$(id).textContent="—";
      $("cmDecision").textContent="WAIT · LOADING NEW TOKEN";
      $("cmLiveStatus").textContent="Loading "+mint.slice(0,8)+"…";
    }
  });
  window.addEventListener("crimson:security-check",ev=>{
    const mint=ev.detail?.mint,report=ev.detail?.report;
    if(!MINT.test(mint||"")||!report)return;
    security.set(mint,report);
    if(mint===activeMint)redrawTracked();
  });
  if(window.CRIMSON_LATEST_MARKET){
    const snap=window.CRIMSON_LATEST_MARKET;
    if(MINT.test(snap.mint||"")&&snap.pair?.chainId==="solana"){
      activeMint=snap.mint;activePair=snap.pair;redrawTracked();
    }
  }

  function renderScan(){
    const matches=allRows.filter(r=>filter==="all"||
      filter==="pump"&&r.analysis.pump||filter==="dump"&&r.analysis.dump||
      filter==="danger"&&r.analysis.dangerous||filter==="thin"&&!r.analysis.enough).slice(0,18);
    const area=$("cmCards");area.replaceChildren();
    if(!matches.length){area.append(make("p",allRows.length?"No candidates matched that filter.":"No scan results yet.","cm-small"));return;}
    for(const r of matches){
      const a=r.analysis,card=document.createElement("article");card.className="cm-card";
      card.append(make("h3",(r.symbol||"?")+" · "+(r.name||"Solana token")));
      const chip=make("span",a.decision,"cm-tag "+(a.dangerous||a.dump?"danger":a.pump?"good":"watch"));
      card.append(chip);
      card.append(make("p","Opportunity "+(a.opp===null?"—":a.opp+"/100")+
        " · Danger "+(a.danger===null?"—":a.danger+"/100")+" · Liquidity "+usd(r.liquidity),"cm-small"));
      card.append(make("p","5m buy share "+(a.buyShare===null?"—":a.buyShare.toFixed(0)+"%")+
        " · 5m price "+pct(r.m5)+" · 1h price "+pct(r.h1),"cm-small"));
      card.append(make("p",a.reasons.slice(-2).join(" ")+" Security UNVERIFIED; separate safety screening required.","cm-small"));
      const btn=make("button","Deep analyze");btn.type="button";
      btn.addEventListener("click",()=>{
        const input=$("mint"),track=$("track");
        if(input&&track){input.value=r.address;track.click();input.scrollIntoView({behavior:"smooth",block:"center"});}
      });
      card.append(btn,link("DEX chart ↗","https://dexscreener.com/solana/"+encodeURIComponent(r.pairAddress||r.address)));
      area.append(card);
    }
  }

  async function getJSON(url){
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);
    try{const res=await fetch(url,{cache:"no-store",signal:ctl.signal});
      if(!res.ok)throw Error("Provider HTTP "+res.status);
      return await res.json();
    }finally{clearTimeout(timer);}
  }
  async function scan(){
    if(scanBusy||document.hidden||document.body.classList.contains("ci-account-locked"))return;
    scanBusy=true;$("cmRefresh").disabled=true;
    $("cmScanStatus").textContent="Fetching a limited Solana discovery sample…";
    try{
      const feeds=await Promise.allSettled([
        getJSON(DEX+"/token-profiles/latest/v1"),
        getJSON(DEX+"/token-boosts/latest/v1"),
        getJSON(DEX+"/token-boosts/top/v1")
      ]);
      const sources=["Profile","Paid boost","Paid boost"],addresses=new Map(),issues=[];
      for(let i=0;i<feeds.length;i++){
        const result=feeds[i];
        if(result.status!=="fulfilled"){issues.push(sources[i]+" feed unavailable");continue;}
        for(const item of Array.isArray(result.value)?result.value:[]){
          const mint=item?.tokenAddress;
          if(item?.chainId==="solana"&&MINT.test(mint||"")&&!addresses.has(mint))addresses.set(mint,sources[i]);
        }
      }
      const names=[...addresses.keys()].slice(0,SAMPLE_LIMIT);
      if(!names.length)throw Error("No eligible Solana tokens in available discovery feeds.");
      const pools=await getJSON(DEX+"/tokens/v1/solana/"+names.map(encodeURIComponent).join(","));
      if(!Array.isArray(pools))throw Error("Pool data unavailable.");
      const set=new Set(names),best=new Map();
      for(const p of pools){
        if(p?.chainId!=="solana"||!set.has(p?.baseToken?.address))continue;
        const mint=p.baseToken.address,prev=best.get(mint);
        if(!prev||num(p?.liquidity?.usd)>num(prev?.liquidity?.usd))best.set(mint,p);
      }
      allRows=[];
      for(const [mint,p] of best){
        const analysis=evaluate(p,null);
        allRows.push({address:mint,symbol:p.baseToken?.symbol,name:p.baseToken?.name,
          pairAddress:p.pairAddress,liquidity:num(p?.liquidity?.usd),
          m5:num(p?.priceChange?.m5),h1:num(p?.priceChange?.h1),analysis});
      }
      allRows.sort((a,b)=>{
        const as=a.analysis,bs=b.analysis;
        // Prioritize interpretable, lower observed-risk candidates, not boosts.
        return Number(bs.enough)-Number(as.enough)||
          Number(as.dangerous)-Number(bs.dangerous)||
          (bs.opp??-1)-(as.opp??-1);
      });
      renderScan();
      scanAt=Date.now();
      $("cmScanStatus").textContent="Reviewed "+names.length+" discovery addresses · "+allRows.length+
        " usable indexed pools · updated "+new Date().toLocaleTimeString()+
        ". Market-only scan, not comprehensive. "+issues.join("; ");
    }catch(e){
      $("cmScanStatus").textContent="Market discovery unavailable: "+String(e?.message||e)+
        ". Tracked-token intelligence and existing features remain active.";
    }finally{scanBusy=false;$("cmRefresh").disabled=false;}
  }
  $("cmRefresh").addEventListener("click",scan);
  root.querySelectorAll("[data-cm]").forEach(btn=>btn.addEventListener("click",()=>{
    filter=btn.dataset.cm;
    root.querySelectorAll("[data-cm]").forEach(b=>b.classList.toggle("cm-selected",b===btn));
    renderScan();
  }));
  renderScan();
  const watcher=new MutationObserver(()=>{
    if(!document.body.classList.contains("ci-account-locked")){
      watcher.disconnect();setTimeout(scan,1000);
    }
  });
  if(document.body.classList.contains("ci-account-locked"))
    watcher.observe(document.body,{attributes:true,attributeFilter:["class"]});
  else setTimeout(scan,1600);
  setInterval(()=>{if(!document.hidden&&Date.now()-scanAt>=180000)scan();},180000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&Date.now()-scanAt>=180000)scan();});
})();