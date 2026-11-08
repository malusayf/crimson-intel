/* Crimson Command Center v1
   Multi-position manually entered watch, observed signal performance and
   evidence-based research flags. Not a broker, wallet or historical backtester.
*/
(() => {
"use strict";
const $=id=>document.getElementById(id),DEX="https://api.dexscreener.com";
if($("ccCommandCenter"))return;
const valid=x=>typeof x==="string"&&(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(x)||/^0x[a-fA-F0-9]{40}$/.test(x));
const chainFor=x=>x?.chainId==="robinhood"?"robinhood":"solana";
const portfolioKey=x=>chainFor(x)+"|"+(chainFor(x)==="robinhood"?x.mint.toLowerCase():x.mint);
const num=x=>x===null||x===undefined||x===""?NaN:Number(x);
const fin=x=>Number.isFinite(x);
const dollar=x=>fin(x)?(x<0?"−":"")+"$"+Math.abs(x).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}):"—";
const pr=x=>fin(x)&&x>0?"$"+x.toPrecision(8):"—";
const percent=x=>fin(x)?(x>0?"+":"")+x.toFixed(1)+"%":"—";
const create=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=String(text);if(cls)e.className=cls;return e;};
const css=document.createElement("style");
css.textContent=[
"#ccCommandCenter{border-color:#5c4f70;background:linear-gradient(155deg,#1d1730,#10192e)}",
"#ccCommandCenter .cc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,235px),1fr));gap:12px}",
"#ccCommandCenter .cc-card{background:#0c1429;border:1px solid #38425c;border-radius:13px;padding:14px}",
"#ccCommandCenter .cc-small{font-size:12px;color:#b9c6df;line-height:1.6;margin:8px 0}",
"#ccCommandCenter .cc-stat{font-size:19px;font-weight:800}",
"#ccCommandCenter .cc-sub{margin:15px 0;border-top:1px solid #3c455d;padding-top:12px}",
"#ccCommandCenter .cc-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px 0}",
"#ccCommandCenter .cc-controls button{padding:8px 11px}",
"#ccCommandCenter .cc-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:10px}",
"#ccCommandCenter .cc-form label{font-size:12px;color:#c5d0e9}",
"#ccCommandCenter .cc-form input{margin-top:5px}",
"#ccCommandCenter .cc-table{width:100%;font-size:12px;border-collapse:collapse}",
"#ccCommandCenter .cc-table td,#ccCommandCenter .cc-table th{text-align:left;border-bottom:1px solid #34405c;padding:7px 4px;overflow-wrap:anywhere}",
"#ccCommandCenter .cc-table button{padding:6px 8px}",
"#ccCommandCenter .cc-warning{border:1px dashed #705b43;border-radius:10px;background:#2b2230;color:#e9dabf;font-size:12px;padding:11px;line-height:1.6}",
"#ccCommandCenter .cc-good{color:#73edc1}#ccCommandCenter .cc-bad{color:#ff94a7}",
"#ccCommandCenter a{color:#b7c9ff}",
"@media(max-width:600px){#ccCommandCenter .cc-table{font-size:10px}#ccCommandCenter .cc-table td,#ccCommandCenter .cc-table th{padding:4px 2px}}"
].join("\n");document.head.appendChild(css);
const section=document.createElement("section");
section.id="ccCommandCenter";section.className="panel";
section.innerHTML=[
'<h2>⚔ Crimson Command Center · Portfolio & Evidence Lab</h2>',
'<p class="cc-small">Track multiple spot holdings manually; inspect transaction-pattern warnings, developer research links and the outcomes of actual observed signals. This is a browser-based beta, not live wallet custody or a backtest.</p>',
'<div class="cc-sub"><h3>Portfolio Risk Commander</h3>',
'<div class="cc-form"><label>Network<select id="ccChain"><option value="solana">Solana</option><option value="robinhood">Robinhood Chain</option></select></label>',
'<label>Token mint / contract<input id="ccMint" placeholder="Mint / 0x contract" spellcheck="false"></label>',
'<label>Amount invested (USD)<input id="ccAmount" type="number" step="any" min="0" placeholder="100"></label>',
'<label>Entry price (USD)<input id="ccEntry" type="number" step="any" min="0" placeholder="0.00001"></label></div>',
'<div class="cc-controls"><button id="ccUseTracked">Use tracked position</button>',
'<button id="ccAdd">Add / update holding</button><button id="ccRefresh">Refresh portfolio quotes</button></div>',
'<div id="ccPortfolioStatus" class="cc-small" role="status">Add a holding to compare exposure and estimated P/L.</div>',
'<div class="cc-grid">',
'<div class="cc-card"><div class="label">CAPITAL INVESTED</div><div id="ccCost" class="cc-stat">—</div></div>',
'<div class="cc-card"><div class="label">MARKET VALUE (OBSERVED)</div><div id="ccValue" class="cc-stat">—</div></div>',
'<div class="cc-card"><div class="label">GROSS UNREALIZED P/L</div><div id="ccPnL" class="cc-stat">—</div></div>',
'<div class="cc-card"><div class="label">TOP-HOLDING CONCENTRATION</div><div id="ccConcentration" class="cc-stat">—</div></div>',
'</div>',
'<div style="overflow-x:auto"><table class="cc-table"><thead><tr><th>Token</th><th>Invested</th><th>Current est.</th><th>Gross P/L</th><th>Action</th></tr></thead><tbody id="ccPortfolioRows"></tbody></table></div>',
'<p class="cc-small">Market quotes can be stale or unavailable. Portfolio is saved only in this browser, partitioned by signed-in account, never uploaded to a wallet or server.</p></div>',
'<div class="cc-sub"><h3>Anti-Fake Volume & Market Anomaly Watch</h3>',
'<div class="cc-grid">',
'<div class="cc-card"><div class="label">TRADE SIZE PROXY</div><div id="ccTradeSize" class="cc-stat">—</div><p class="cc-small">5m USD volume / number of transactions</p></div>',
'<div class="cc-card"><div class="label">PATTERN ASSESSMENT</div><div id="ccPattern" class="cc-stat" style="font-size:15px">WAIT FOR DATA</div><p class="cc-small">Suspicious is not proven wash trading</p></div>',
'</div><p id="ccPatternEvidence" class="cc-small">Track a token to analyze count-volume divergence.</p>',
'<div class="cc-warning">Actual wash trading, linked insider wallets, deployer identities, holder clustering and manipulation attribution require indexed transaction and account history. Those checks are NOT yet connected. Extremely small trades can also occur naturally.</div>',
'<div id="ccResearchLinks" class="cc-controls"></div></div>',
'<div class="cc-sub"><h3>Crimson Research Brief · Evidence Only</h3>',
'<p class="cc-small" id="ccBrief">Track a token to generate a rules-based research summary. This is not a generative AI service.</p></div>',
'<div class="cc-sub"><h3>Performance Observation Lab</h3>',
'<p class="cc-small">Records observed PUMP WATCH, DUMP WATCH and MARKET DANGER events while this browser is open. Re-checks the same token after at least 60 minutes of observed data. Does not fill gaps or claim 24/7 tracking.</p>',
'<div class="cc-grid"><div class="cc-card"><div class="label">OBSERVED SIGNALS</div><div id="ccCount" class="cc-stat">0</div></div>',
'<div class="cc-card"><div class="label">60+ MIN FOLLOW-UPS</div><div id="ccFollowups" class="cc-stat">0</div></div>',
'<div class="cc-card"><div class="label">AVERAGE FOLLOW-UP CHANGE</div><div id="ccAverage" class="cc-stat">—</div></div></div>',
'<div class="cc-controls"><button id="ccExport">Export observation CSV</button>',
'<button id="ccClearObservations">Clear observation log</button></div>',
'<div style="overflow-x:auto"><table class="cc-table"><thead><tr><th>First observed</th><th>Token</th><th>Signal</th><th>Later price</th><th>Observed change</th></tr></thead><tbody id="ccObservations"></tbody></table></div>',
'<div class="cc-warning">The log is an observational sample, not historical predictive accuracy. Follow-up changes only reflect when the token was observed again; market movement between visits is not reconstructed. No fees, slippage or stop/TP execution results are inferred.</div></div>'
].join("");
const main=document.querySelector("main");
if(!main)return;
const guardian=$("cgGuardian"),position=$("ciPositionIntel");
if(guardian)guardian.insertAdjacentElement("afterend",section);
else if(position)position.insertAdjacentElement("afterend",section);
else main.append(section);
let scope="",holdings=[],events=[],lastSnapshot=null,lastIntel=null,lastSecurity=null,
prices=new Map(),busy=false,quotesAt=0;
function userKey(){
if(document.body.classList.contains("ci-account-locked"))return "";
const u=String($("ciAccountEmail")?.textContent||"").toLowerCase().trim();
if(!u.includes("@"))return "";
let h=2166136261;for(let i=0;i<u.length;i++){h^=u.charCodeAt(i);h=Math.imul(h,16777619);}
return "crimson-command-v1-"+(h>>>0).toString(16);
}
function ensure(){
const key=userKey();
if(!key)return false;
if(scope===key)return true;
scope=key;holdings=[];events=[];prices.clear();lastIntel=null;lastSecurity=null;
try{
const parsed=JSON.parse(localStorage.getItem(scope)||"null");
if(parsed&&Array.isArray(parsed.holdings))holdings=parsed.holdings.filter(x=>valid(x.mint)&&x.amount>0&&x.entry>0)
 .map(x=>({...x,chainId:chainFor(x)})).slice(0,20);
if(parsed&&Array.isArray(parsed.events))events=parsed.events.filter(x=>valid(x.mint)&&x.price>0)
 .map(x=>({...x,chainId:chainFor(x)})).slice(-160);
}catch(e){}
return true;
}
function persist(){
if(!ensure())return;
try{localStorage.setItem(scope,JSON.stringify({holdings,events}));}
catch(e){$("ccPortfolioStatus").textContent="Local browser storage unavailable; data may be lost.";}
}
function add(){
if(!ensure()){$("ccPortfolioStatus").textContent="Sign in before saving holdings.";return;}
const mint=$("ccMint").value.trim(),amount=num($("ccAmount").value),entry=num($("ccEntry").value);
const chainId=$("ccChain").value;
if(!window.CrimsonChainData?.isValid(chainId,mint)||!(amount>0&&entry>0)){
 $("ccPortfolioStatus").textContent="Select the correct network and enter a valid contract, invested USD and entry price.";return;}
const row={mint,chainId,amount,entry,created:Date.now()};
const prev=holdings.findIndex(x=>portfolioKey(x)===portfolioKey(row));
if(prev>=0)holdings[prev]=row;
else if(holdings.length<20)holdings.push(row);
else{$("ccPortfolioStatus").textContent="20-holding limit reached; remove one first.";return;}
persist();renderPortfolio();refreshQuotes();
}
function renderPortfolio(){
if(!ensure()){for(const id of ["ccCost","ccValue","ccPnL","ccConcentration"])$(id).textContent="—";return;}
const cost=holdings.reduce((s,x)=>s+x.amount,0),valuations=holdings.map(x=>{
const result=prices.get(portfolioKey(x)),q=result?.price;
return {holding:x,value:fin(q)&&q>0?x.amount*q/x.entry:NaN};
});
const complete=holdings.length>0&&valuations.every(x=>fin(x.value));
const total=complete?valuations.reduce((s,x)=>s+x.value,0):NaN;
const top=complete&&total>0?100*Math.max(...valuations.map(x=>x.value))/total:NaN;
$("ccCost").textContent=dollar(cost);
$("ccValue").textContent=dollar(total);
$("ccPnL").textContent=complete?dollar(total-cost):"—";
$("ccConcentration").textContent=fin(top)?top.toFixed(1)+"%":"—";
const rows=$("ccPortfolioRows");rows.replaceChildren();
for(const x of valuations){
const tr=document.createElement("tr"),quote=prices.get(portfolioKey(x.holding));
const symbols=(chainFor(x.holding)==="robinhood"?"RH · ":"SOL · ")+(quote?.symbol||x.holding.mint.slice(0,6)+"…");
for(const cell of [symbols,dollar(x.holding.amount),dollar(x.value),
dollar(fin(x.value)?x.value-x.holding.amount:NaN)])tr.append(create("td",cell));
const c=document.createElement("td"),btn=create("button","Remove");btn.type="button";
btn.addEventListener("click",()=>{holdings=holdings.filter(p=>portfolioKey(p)!==portfolioKey(x.holding));persist();renderPortfolio();});
c.append(btn);tr.append(c);rows.append(tr);
}
const concern=fin(top)&&top>35?" Top holding >35% of observed portfolio: concentration risk.":"";
$("ccPortfolioStatus").textContent=holdings.length+" holdings · "+
(complete?"all quotes available.":"some values missing/stale.")+
concern+" Quotes from chain-specific DEX sources or issuer reference; never executable sell orders.";
}
async function refreshQuotes(){
 if(!ensure()||busy||document.hidden||!holdings.length)return;
 busy=true;$("ccRefresh").disabled=true;
 const sol=holdings.filter(x=>chainFor(x)==="solana");
 const rh=holdings.filter(x=>chainFor(x)==="robinhood");
 const failures=[];
 try{
  if(sol.length){
   const names=sol.map(x=>x.mint);
   const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);
   try{
    const res=await fetch(DEX+"/tokens/v1/solana/"+names.map(encodeURIComponent).join(","),
      {cache:"no-store",signal:ctl.signal});
    if(!res.ok)throw Error("Solana DEX HTTP "+res.status);
    const pools=await res.json();
    if(!Array.isArray(pools))throw Error("Solana DEX feed unavailable");
    const best=new Map();
    for(const p of pools){
     const mint=p?.baseToken?.address;
     if(p?.chainId!=="solana"||!names.includes(mint))continue;
     const old=best.get(mint);
     if(!old||num(p?.liquidity?.usd)>num(old?.liquidity?.usd))best.set(mint,p);
    }
    for(const x of sol){
     const pair=best.get(x.mint),v=num(pair?.priceUsd);
     if(fin(v)&&v>0)prices.set(portfolioKey(x),{price:v,symbol:pair?.baseToken?.symbol,at:Date.now()});
     else{prices.delete(portfolioKey(x));failures.push("SOL "+x.mint.slice(0,6));}
    }
   }catch(e){for(const x of sol)prices.delete(portfolioKey(x));failures.push("Solana quotes unavailable");}
   finally{clearTimeout(timer);}
  }
  // Research-only Robinhood Chain quotes. No EVM wallet access or order execution.
  // Small bounded batches to respect upstream public feeds.
  for(let i=0;i<rh.length;i+=4){
   await Promise.all(rh.slice(i,i+4).map(async x=>{
    try{
     const r=await window.CrimsonChainData.load("robinhood",x.mint);
     const quote=r.pair?.priceUsd;
     if(r.pair?.dataStale||!(quote>0))throw Error("Stale or unavailable");
     prices.set(portfolioKey(x),{price:quote,symbol:r.pair?.baseToken?.symbol,
      source:r.pair.priceType,at:Date.now()});
    }catch(e){prices.delete(portfolioKey(x));failures.push("RH "+x.mint.slice(0,6));}
   }));
  }
  quotesAt=Date.now();
 }finally{
  busy=false;$("ccRefresh").disabled=false;renderPortfolio();
  if(failures.length)$("ccPortfolioStatus").textContent+=" Missing / stale: "+failures.slice(0,4).join(", ")+
   (failures.length>4?" and "+(failures.length-4)+" others":"")+".";
 }
}
function research(){
const pair=lastSnapshot?.pair,intel=lastIntel?.market,security=lastSecurity||lastIntel?.security,mint=lastSnapshot?.mint;
const box=$("ccResearchLinks");box.replaceChildren();
if(!valid(mint)||!pair){$("ccBrief").textContent="Track a Solana or Robinhood token to generate a market brief.";return;}
const network=pair.chainId==="robinhood"?"robinhood":"solana";
const v5=num(pair.volume?.m5),buys=num(pair.txns?.m5?.buys),
sells=num(pair.txns?.m5?.sells),trades=buys+sells,average=trades>0?v5/trades:NaN;
$("ccTradeSize").textContent=dollar(average);
const flow5=num(pair.priceChange?.m5),flow1=num(pair.priceChange?.h1),liquidity=num(pair.liquidity?.usd);
const suspicious=trades>=50&&fin(average)&&average<10;
const exhausted=fin(flow5)&&flow5>20&&trades>25;
const divergence=fin(flow5)&&fin(flow1)&&flow5<-5&&flow1>20;
const flags=[];
if(suspicious)flags.push("High transaction count but low average dollar volume: possible small-trade spam; cannot prove wash trading.");
if(exhausted)flags.push("Rapid 5m price rise: potentially overheated or coordinated.");
if(divergence)flags.push("5m reversal against a strong 1h rally.");
if(fin(liquidity)&&liquidity<30000)flags.push("Low liquidity may prevent selling without severe slippage.");
$("ccPattern").textContent=flags.length?"ANOMALY WATCH":"NO STRONG COUNT-VOLUME FLAG";
$("ccPatternEvidence").textContent=flags.length?flags.join(" "):
"Market-wide on-chain verification unavailable. Normal-looking DEX counts do not prove organic volume.";
const notes=[
"Current observed market: "+(intel?.decision||"insufficient / unavailable")+".",
"5m trades: "+(fin(trades)?trades:"—")+", average volume per transaction "+dollar(average)+".",
"1h and 5m price changes: "+percent(flow1)+" and "+percent(flow5)+".",
"Token report: "+(network==="robinhood"?
 (pair.issuerListed?"Issuer identity matched; smart-contract safety NOT VERIFIED.":"Robinhood Chain smart-contract safety NOT VERIFIED."):
 security?.verified?
 (security.reject?"RugCheck has warnings/unknown lock status.":"Available RugCheck report does not flag severe risk, but rugs remain possible."):
 "Token security UNVERIFIED.")+".",
flags.length?"Anomalies: "+flags.join(" "):"No flagged count-volume anomaly at these thresholds.",
"Developer history, wallet relationships and insider concentration: NOT CONNECTED."
];
$("ccBrief").textContent=notes.join(" ");
const links=network==="robinhood"?
 [["Inspect token on Blockscout ↗","https://robinhoodchain.blockscout.com/token/"+mint],
  ["Robinhood DEX pool ↗",pair?.pairAddress?"https://www.geckoterminal.com/robinhood/pools/"+encodeURIComponent(pair.pairAddress):
  "https://www.geckoterminal.com/robinhood/pools"]]:
 [["Inspect token on Solscan ↗","https://solscan.io/token/"+encodeURIComponent(mint)],
  ["RugCheck report ↗","https://rugcheck.xyz/tokens/"+encodeURIComponent(mint)],
  ["DEX Screener pools ↗","https://dexscreener.com/solana/"+encodeURIComponent(pair?.pairAddress||mint)]];
for(const [label,url] of links){
const a=create("a",label);a.href=url;a.target="_blank";a.rel="noopener noreferrer";box.append(a);
}
}
function observe(){
if(!ensure()||!lastSnapshot||!lastIntel)return;
const mint=lastSnapshot.mint,chainId=chainFor(lastSnapshot?.pair),
 price=num(lastSnapshot?.pair?.priceUsd),market=lastIntel.market;
if(!valid(mint)||!(price>0)||!market)return;
let changed=false;
for(const e of events){
if(e.mint!==mint||chainFor(e)!==chainId||e.followPrice||Date.now()-e.ts<3600000)continue;
e.followPrice=price;e.followAt=Date.now();changed=true;
}
const type=market.dangerous?"MARKET DANGER":market.dump?"DUMP WATCH":market.pump?"PUMP WATCH":null;
if(type){
const recent=events.find(x=>x.mint===mint&&chainFor(x)===chainId&&x.type===type&&Date.now()-x.ts<3*3600000);
if(!recent){events.push({mint,chainId,ts:Date.now(),price,type,followPrice:null,followAt:null});changed=true;}
}
if(changed){events=events.slice(-160);persist();}
renderObservations();
}
function renderObservations(){
if(!ensure())return;
const resolved=events.filter(x=>fin(x.followPrice)&&x.followPrice>0);
$("ccCount").textContent=String(events.length);
$("ccFollowups").textContent=String(resolved.length);
$("ccAverage").textContent=resolved.length?percent(resolved.reduce((s,x)=>s+100*(x.followPrice/x.price-1),0)/resolved.length):"—";
const tbody=$("ccObservations");tbody.replaceChildren();
for(const x of [...events].reverse().slice(0,18)){
const row=document.createElement("tr"),change=fin(x.followPrice)&&x.followPrice>0?100*(x.followPrice/x.price-1):NaN;
for(const c of [new Date(x.ts).toLocaleString(),(chainFor(x)==="robinhood"?"RH ":"SOL ")+x.mint.slice(0,7)+"…",x.type,pr(x.followPrice),percent(change)])row.append(create("td",c));
tbody.append(row);
}
}
$("ccAdd").addEventListener("click",add);
$("ccUseTracked").addEventListener("click",()=>{
$("ccMint").value=lastSnapshot?.mint||$("mint")?.value.trim()||"";
$("ccChain").value=chainFor(lastSnapshot?.pair);
$("ccAmount").value=$("amount")?.value||"";
$("ccEntry").value=$("entry")?.value||"";
});
$("ccRefresh").addEventListener("click",refreshQuotes);
$("ccClearObservations").addEventListener("click",()=>{
if(!window.confirm("Delete your locally recorded observation log?"))return;
events=[];persist();renderObservations();
});
$("ccExport").addEventListener("click",()=>{
if(!ensure()||!events.length)return;
const escape=x=>'"'+String(x??"").replace(/"/g,'""').replace(/^[=+\-@]/,"'$&")+'"';
const rows=[["mint","first_seen","signal","first_price","followup_seen","followup_price","observed_change_pct"]];
for(const e of events)rows.push([e.mint,new Date(e.ts).toISOString(),e.type,e.price,
e.followAt?new Date(e.followAt).toISOString():"",e.followPrice??"",
e.followPrice?100*(e.followPrice/e.price-1):""]);
const csv=rows.map(row=>row.map(escape).join(",")).join("\r\n");
const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob);
const a=document.createElement("a");a.href=url;a.download="crimson-observed-signals.csv";a.click();
setTimeout(()=>URL.revokeObjectURL(url),1000);
});
window.addEventListener("crimson:market-snapshot",e=>{
lastSnapshot=e.detail;research();if(lastIntel?.mint===lastSnapshot?.mint&&lastIntel?.pair?.chainId===lastSnapshot?.pair?.chainId)observe();
});
window.addEventListener("crimson:unified-intelligence",e=>{
lastIntel=e.detail;research();observe();
});
window.addEventListener("crimson:security-check",e=>{
if(e.detail?.mint===lastSnapshot?.mint)lastSecurity=e.detail.report;
research();
});
window.addEventListener("crimson:tracked-change",()=>{
lastSnapshot=null;lastIntel=null;lastSecurity=null;research();
});
const active=window.CRIMSON_LATEST_MARKET;if(active)lastSnapshot=active;
if(window.CRIMSON_LATEST_INTELLIGENCE)lastIntel=window.CRIMSON_LATEST_INTELLIGENCE;
if(ensure()){renderPortfolio();renderObservations();research();}
// Keep the observer active across sign-out / sign-in, not just the initial login.
// This partitions local portfolio data immediately when a different account
// unlocks the page, preventing the previous user's figures from lingering.
const watcher=new MutationObserver(()=>{
if(document.body.classList.contains("ci-account-locked")){
  scope="";holdings=[];events=[];prices.clear();
  lastSnapshot=null;lastIntel=null;lastSecurity=null;
}else{
  ensure();renderPortfolio();renderObservations();research();refreshQuotes();
}
});
watcher.observe(document.body,{attributes:true,attributeFilter:["class"]});
if(!document.body.classList.contains("ci-account-locked"))refreshQuotes();
setInterval(()=>{if(!document.hidden&&Date.now()-quotesAt>100000)refreshQuotes();},100000);
})();
