/* Crimson Intel — Robinhood Chain 4663 research workspace.
   Read-only, public market data. Never signs transactions or connects to Robinhood accounts. */
(()=>{
"use strict";
if(document.getElementById("ciRobinhood"))return;
const main=document.querySelector("main");if(!main)return;
const $=id=>document.getElementById(id);
const API="https://crimson-operator-api-production.up.railway.app";
const storeKey="ci-robinhood-local-watch-v1";
const css=document.createElement("style");css.textContent=[
 "#ciRobinhood{border:1px solid #4d4766;border-radius:15px;background:linear-gradient(150deg,#211b30,#101827);padding:19px}",
 "#ciRobinhood h3{margin:0 0 8px;font-size:17px}",
 "#ciRobinhood .rh-sub{color:#bac6dc;font-size:12px;line-height:1.6;margin:8px 0 12px}",
 "#ciRobinhood .rh-top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}",
 "#ciRobinhood .rh-action{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin:12px 0}",
 "#ciRobinhood .rh-action button{font-size:12px;padding:9px 13px}",
 "#ciRobinhood button:disabled{opacity:.48;cursor:default}",
 "#ciRobinhood .rh-active{background:#743b78;color:white;border:1px solid #b277a9}",
 "#ciRobinhood .rh-status{padding:11px 13px;border:1px solid #465572;background:#111b30;border-radius:11px;font-size:12px;line-height:1.55;overflow-wrap:anywhere}",
 "#ciRobinhood .rh-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:9px;margin:13px 0}",
 "#ciRobinhood .rh-stat{padding:13px;background:#101a2e;border:1px solid #344263;border-radius:11px}",
 "#ciRobinhood .rh-stat small{display:block;font-size:10px;letter-spacing:.5px;color:#aebed9;margin-bottom:5px}",
 "#ciRobinhood .rh-stat b{font-size:15px;overflow-wrap:anywhere}",
 "#ciRobinhood .rh-wrap{max-width:100%;overflow:auto}",
 "#ciRobinhood .rh-table{border-collapse:collapse;width:100%;min-width:850px;font-size:12px}",
 "#ciRobinhood .rh-table td,#ciRobinhood .rh-table th{border-bottom:1px solid #3b4960;text-align:left;padding:10px 7px;vertical-align:middle}",
 "#ciRobinhood .rh-table th{color:#b7cae1;font-size:11px}",
 "#ciRobinhood .rh-table button{font-size:11px;padding:5px 8px;margin:2px}",
 "#ciRobinhood .rh-table a,#ciRobinhood a{color:#eaa8d7}",
 "#ciRobinhood .rh-dim{color:#aeb8cc}",
 "#ciRobinhood .rh-bad{color:#ffa6ac}",
 "#ciRobinhood .rh-good{color:#99f1cb}",
 "#ciRobinhood .rh-search{display:flex;flex-wrap:wrap;align-items:center;gap:10px}",
 "#ciRobinhood .rh-search input{min-width:220px;flex:1;margin:0;padding:10px;background:#0b1729;color:#f8f8fb;border:1px solid #53627c;border-radius:9px}",
 "#ciRobinhood .rh-detail{padding:14px;border:1px solid #574767;border-radius:11px;background:#1b1831;margin:12px 0;font-size:12px;line-height:1.8;overflow-wrap:anywhere}",
 "#ciRobinhood .rh-hidden{display:none!important}",
 "@media(max-width:600px){#ciRobinhood{padding:13px}#ciRobinhood .rh-action{gap:6px}#ciRobinhood .rh-action button{font-size:11px}}"
].join("\n");document.head.append(css);
const root=document.createElement("section");root.id="ciRobinhood";root.className="panel";
root.innerHTML=[
 '<div class="rh-top"><div><h3>🟢 Robinhood Chain Intelligence</h3>',
 '<p class="rh-sub">Chain 4663 · DEX tokens + issuer-listed Stock Tokens · read-only research · no wallet permissions</p></div>',
 '<a href="https://robinhoodchain.blockscout.com/" target="_blank" rel="noopener noreferrer">Chain explorer</a></div>',
 '<div class="rh-action"><button id="rhDexTab" type="button" class="rh-active">DEX tokens</button>',
 '<button id="rhStockTab" type="button">Official Stock Tokens</button>',
 '<button id="rhWatchTab" type="button">My watchlist <span id="rhWatchCount">0</span></button>',
 '<button id="rhRefresh" type="button">Refresh</button></div>',
 '<p id="rhStatus" class="rh-status" role="status">Loading Robinhood Chain observations…</p>',
 '<div id="rhDexPanel"><div class="rh-action"><button id="rhTrending" type="button" class="rh-active">Trending pools</button>',
 '<button id="rhNew" type="button">New pools</button>',
 '<label class="rh-sub" for="rhMinLiq">Min liquidity</label>',
 '<select id="rhMinLiq"><option value="0">All</option><option value="10000">$10k+</option><option value="50000">$50k+</option><option value="100000">$100k+</option></select></div>',
 '<div class="rh-search"><label for="rhTokenSearch" class="rh-sub">Token contract (0x address)</label>',
'<input id="rhTokenSearch" maxlength="42" placeholder="Paste any Robinhood Chain token contract…">',
'<button id="rhLookupToken" type="button">Track contract</button></div>',
'<div class="rh-cards"><div class="rh-stat"><small>VISIBLE POOLS</small><b id="rhPoolCount">—</b></div>',
 '<div class="rh-stat"><small>24H DEX VOLUME (VISIBLE)</small><b id="rhVolume">—</b></div>',
 '<div class="rh-stat"><small>OBSERVED LIQUIDITY (VISIBLE)</small><b id="rhLiquidity">—</b></div></div>',
 '<p class="rh-sub">DEX metrics describe trading pools, not unique holders or guaranteed sell liquidity. Pool lists are sampled, not complete chain totals.</p>',
 '<div class="rh-wrap"><table class="rh-table"><thead><tr><th>Pool / token</th><th>USD price</th><th>Liquidity</th>',
 '<th>24h volume</th><th>5m buys / sells</th><th>24h change</th><th>Issuer match</th><th>Details</th></tr></thead>',
 '<tbody id="rhDexRows"></tbody></table></div>',
 '<div id="rhDexDetail" class="rh-detail rh-hidden"></div></div>',
 '<div id="rhStockPanel" class="rh-hidden"><div class="rh-search">',
 '<label for="rhStockSearch" class="rh-sub">Search ticker, company or official contract</label>',
 '<input id="rhStockSearch" placeholder="AAPL, NVDA, TSLA or 0x contract" maxlength="60" autocomplete="off"></div>',
 '<p class="rh-sub">Official contracts come from Robinhood’s issuer registry. Quote values are underlying equity bid/ask × current shares-per-token multiplier. Not executable swap prices.</p>',
 '<div class="rh-wrap"><table class="rh-table"><thead><tr><th>Stock token</th><th>Issuer-listed contract</th>',
 '<th>Shares / token</th><th>Registry status</th><th>Market session</th><th>Details</th></tr></thead><tbody id="rhStockRows"></tbody></table></div>',
 '<div id="rhStockDetail" class="rh-detail rh-hidden"></div></div>',
 '<div id="rhWatchPanel" class="rh-hidden"><p class="rh-sub">Saved only in this browser, not in your Phantom or Robinhood account. Select any saved item to inspect its latest information.</p>',
 '<div id="rhWatchRows"></div></div>',
 '<p class="rh-sub">Robinhood Stock Tokens are debt securities providing economic exposure, not ownership of the underlying shares. They are subject to eligibility restrictions, including restrictions on offers and sales to U.S. persons. This tool does not enable trading.</p>',
 '<p class="rh-sub"><a href="https://docs.robinhood.com/chain/stock-token-apis/" target="_blank" rel="noopener noreferrer">Robinhood issuer API</a> · ',
 '<a href="https://www.geckoterminal.com/robinhood/pools" target="_blank" rel="noopener noreferrer">GeckoTerminal Robinhood markets</a></p>'
].join("");
main.append(root);
const state={mode:"dex",view:"trending",dex:null,stocks:null,selectedDex:null,selectedStock:null,watch:[],busy:false,lastLoad:0,searchDelay:0};
const validAddress=x=>typeof x==="string"&&/^0x[a-fA-F0-9]{40}$/.test(x);
const money=x=>x===null||x===undefined||!Number.isFinite(Number(x))?"—":
  "$"+Number(x).toLocaleString("en-US",{notation:Number(x)>=1000000?"compact":"standard",maximumFractionDigits:Number(x)<1?7:2});
const shorter=x=>x?x.slice(0,7)+"…"+x.slice(-5):"—";
const pct=x=>x===null||x===undefined||!Number.isFinite(Number(x))?"—":(Number(x)>=0?"+":"")+Number(x).toFixed(2)+"%";
const status=s=>{$("rhStatus").textContent=s;};
function readWatch(){
 try{const items=JSON.parse(localStorage.getItem(storeKey)||"[]");
  return Array.isArray(items)?items.filter(x=>x&&(
    (x.kind==="stock"&&/^[A-Z0-9.^_-]{1,20}$/.test(x.key))||
    ((x.kind==="dex"||x.kind==="token")&&validAddress(x.key)))).slice(0,50):[];
 }catch(e){return [];}
}
state.watch=readWatch();
function saveWatch(){
 $("rhWatchCount").textContent=String(state.watch.length);
 try{localStorage.setItem(storeKey,JSON.stringify(state.watch));}
 catch(e){status("Local watchlist could not be saved in this browser.");}
}
function watching(kind,key){return state.watch.some(x=>x.kind===kind&&x.key.toLowerCase()===String(key).toLowerCase());}
function toggleWatch(kind,key,label){
 if(watching(kind,key))state.watch=state.watch.filter(x=>!(x.kind===kind&&x.key.toLowerCase()===key.toLowerCase()));
 else if(state.watch.length<50)state.watch.push({kind,key,label:String(label).slice(0,80)});
 else{status("Watchlist holds up to 50 assets.");return;}
 saveWatch();drawWatch();drawDex();drawStocks();
}
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);
 if(cls)e.className=cls;return e;};
function link(text,url){
 const a=el("a",text);a.href=url;a.rel="noopener noreferrer";a.target="_blank";return a;
}
function cell(row,value,cls){const td=el("td",value,cls);row.append(td);return td;}
function button(text,click){
 const b=el("button",text);b.type="button";b.addEventListener("click",click);return b;
}
async function api(path){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),16000);
 try{
  const r=await fetch(API+path,{signal:controller.signal,cache:"no-store",credentials:"omit"});
  let data={};try{data=await r.json();}catch(e){}
  if(!r.ok)throw Error(data.error||"Market feed HTTP "+r.status);
  return data;
 }finally{clearTimeout(timer);}
}
function changeMode(mode){
 state.mode=mode;
 for(const name of ["dex","stock","watch"]){
  $("rh"+name.charAt(0).toUpperCase()+name.slice(1)+"Panel").classList.toggle("rh-hidden",name!==mode);
  $("rh"+name.charAt(0).toUpperCase()+name.slice(1)+"Tab").classList.toggle("rh-active",name===mode);
 }
 if(mode==="dex")loadDex();else if(mode==="stock")loadStocks();else drawWatch();
}
function useSharedTracker(address){
 if(!validAddress(address)){status("No exact base-token contract available for the shared tracker.");return;}
 if(!window.CRIMSON_TRACK_ASSET?.("robinhood",address))
  status("Cross-chain tracker is unavailable; refresh Crimson Intel.");
 else status("Sent "+shorter(address)+" to the unified dashboard with TP, SL and risk tools.");
}
function drawDex(){
 const body=$("rhDexRows");body.replaceChildren();
 const data=state.dex;
 const threshold=Number($("rhMinLiq").value)||0;
 const pools=(data?.pools||[]).filter(x=>Number(x.liquidityUsd||0)>=threshold);
 $("rhPoolCount").textContent=data?String(pools.length):"—";
 $("rhVolume").textContent=data?money(pools.reduce((s,x)=>s+Number(x.volume24hUsd||0),0)):"—";
 $("rhLiquidity").textContent=data?money(pools.reduce((s,x)=>s+Number(x.liquidityUsd||0),0)):"—";
 for(const p of pools){
  const tr=el("tr");
  const name=cell(tr,p.poolName||p.baseTokenSymbol||shorter(p.poolAddress));
  name.append(el("div",p.baseTokenAddress?shorter(p.baseTokenAddress):"Contract not indexed","rh-dim"));
  cell(tr,money(p.priceUsd));cell(tr,money(p.liquidityUsd));cell(tr,money(p.volume24hUsd));
  cell(tr,Number.isFinite(Number(p.buys5m))&&p.buys5m!==null?
    p.buys5m+" / "+(p.sells5m??"—"):"—");
  cell(tr,pct(p.change24hPct));
  cell(tr,p.issuerCheck==="issuer-listed"?"Exact issuer contract":"Not issuer-verified",
    p.issuerCheck==="issuer-listed"?"rh-good":"rh-dim");
  const act=cell(tr,"");act.append(button("Track + TP/SL",()=>useSharedTracker(p.baseTokenAddress)));
  act.append(button("Inspect",()=>selectDex(p)));
  act.append(button(watching("dex",p.poolAddress)?"★":"☆",
    ()=>toggleWatch("dex",p.poolAddress,p.poolName||p.baseTokenSymbol)));
  body.append(tr);
 }
 if(!pools.length){const tr=el("tr");const td=cell(tr,data?"No markets meet this filter.":"Markets have not loaded.");
 td.colSpan=8;body.append(tr);}
}
function selectDex(p){
 state.selectedDex=p;
 const d=$("rhDexDetail");d.replaceChildren();d.classList.remove("rh-hidden");
 d.append(el("h3",p.poolName||p.baseTokenSymbol||"Robinhood Chain pool"));
 d.append(el("p","Pool: "+p.poolAddress+" · Chain 4663"));
 d.append(el("p","Liquidity: "+money(p.liquidityUsd)+
  " · 24h DEX volume: "+money(p.volume24hUsd)+
  " · 24h buys/sells: "+(p.buys24h??"—")+"/"+(p.sells24h??"—")));
 const notes=[];
 if(p.liquidityUsd===null)notes.push("Liquidity not reported");
 else if(p.liquidityUsd<10000)notes.push("Very low observed liquidity");
 if(p.issuerCheck!=="issuer-listed")notes.push("NOT a verified issuer-listed Stock Token");
 notes.push("Holders and unique buyers not verified; pool buys/sells are transaction counts");
 d.append(el("p",notes.join(" · "),"rh-bad"));
 d.append(link("View pool on GeckoTerminal","https://www.geckoterminal.com/robinhood/pools/"+encodeURIComponent(p.poolAddress)));
 if(validAddress(p.baseTokenAddress)){d.append(document.createTextNode(" · "));d.append(button("Open in shared TP/SL tracker",()=>useSharedTracker(p.baseTokenAddress)));}
 if(p.baseTokenAddress){
  d.append(document.createTextNode(" · "));
  d.append(link("View token contract on Blockscout","https://robinhoodchain.blockscout.com/token/"+p.baseTokenAddress));
 }
 d.append(document.createTextNode(" · "));
 d.append(button(watching("dex",p.poolAddress)?"Remove watch":"Add to watchlist",
   ()=>{toggleWatch("dex",p.poolAddress,p.poolName||p.baseTokenSymbol);selectDex(p);}));
}
async function inspectToken(address){
 const detail=$("rhDexDetail");detail.replaceChildren();detail.classList.remove("rh-hidden");
 detail.append(el("p","Checking Robinhood Chain token "+shorter(address)+" against real DEX pools…"));
 try{
  const x=await api("/robinhood/token?address="+encodeURIComponent(address));
  if(x.chainId!==4663||x.mode!=="READ_ONLY"||String(x.tokenAddress).toLowerCase()!==address.toLowerCase())
   throw Error("Unexpected token lookup result");
  detail.replaceChildren();
  const label=x.topPool?.baseTokenSymbol||x.issuerListedStock?.symbol||shorter(address);
  detail.append(el("h3",label+" · Robinhood Chain"));
  detail.append(el("p","Token contract: "+x.tokenAddress));
  detail.append(el("p","Issuer identity: "+(x.issuerCheck==="issuer-listed"?
    "Exact contract appears in Robinhood's official issuer registry":
    x.issuerCheck==="unavailable"?"Issuer verification unavailable":"NOT an issuer-listed Robinhood Stock Token"),
    x.issuerCheck==="issuer-listed"?"rh-good":"rh-bad"));
  detail.append(el("p",x.totalObservedPools+" observed base-token trading pools"+
   (x.stale?" · STALE cached results":"")+". Not a complete liquidity inventory."));
  if(x.topPool){
   detail.append(el("p","Highest reported-liquidity pool: "+x.topPool.poolName+
    " · Price "+money(x.topPool.priceUsd)+" · Liquidity "+money(x.topPool.liquidityUsd)+
    " · 24h volume "+money(x.topPool.volume24hUsd)));
   detail.append(el("p","5m transaction buys/sells "+(x.topPool.buys5m??"—")+
    "/"+(x.topPool.sells5m??"—")+" · 24h change "+pct(x.topPool.change24hPct)));
   detail.append(link("Open primary DEX pool","https://www.geckoterminal.com/robinhood/pools/"+encodeURIComponent(x.topPool.poolAddress)));
  }else detail.append(el("p","No base-token DEX pool was returned. No price or liquidity estimate is available.","rh-bad"));
  detail.append(document.createTextNode(" · "));
  detail.append(button("Open in shared TP/SL tracker",()=>useSharedTracker(address)));
  detail.append(document.createTextNode(" · "));
  detail.append(link("Verify exact token contract on Blockscout","https://robinhoodchain.blockscout.com/token/"+x.tokenAddress));
  detail.append(document.createTextNode(" · "));
  detail.append(button(watching("token",address)?"Remove token watch":"Watch this token contract",
   ()=>{toggleWatch("token",address,label);inspectToken(address);}));
  status("Contract inspected on Robinhood Chain · issuer identity and on-chain DEX pricing remain separate.");
 }catch(e){detail.replaceChildren();detail.append(el("p","Token data unavailable: "+e.message,"rh-bad"));}
}
function drawStocks(){
 const body=$("rhStockRows");body.replaceChildren();
 for(const x of (state.stocks?.stocks||[])){
  const tr=el("tr");
  const n=cell(tr,x.symbol);
  n.append(el("div",x.name,"rh-dim"));
  cell(tr,shorter(x.contract));cell(tr,x.multiplier??"—");
  cell(tr,x.status==="ASSET_STATUS_ACTIVE"?"Active":"Inactive / unknown");
  const market=x.tradingCapabilities?.market?.fractional||
    x.tradingCapabilities?.fractionalTradability||"Not reported";
  cell(tr,market);
  const actions=cell(tr,"");
  actions.append(button("Track + TP/SL",()=>useSharedTracker(x.contract)));
  actions.append(button("Issuer quote",()=>selectStock(x.symbol)));
  actions.append(button(watching("stock",x.symbol)?"★":"☆",()=>toggleWatch("stock",x.symbol,x.name)));
  body.append(tr);
 }
 if(!(state.stocks?.stocks||[]).length){
  const tr=el("tr");const td=cell(tr,state.stocks?"No issuer-listed tokens match.":"Issuer registry not loaded.");td.colSpan=6;body.append(tr);
 }
}
async function selectStock(symbol){
 const d=$("rhStockDetail");d.replaceChildren();d.classList.remove("rh-hidden");
 d.append(el("p","Loading official Robinhood issuer quote for "+symbol+"…"));
 try{
  const quote=await api("/robinhood/stock-quote?symbol="+encodeURIComponent(symbol));
  const {stock,q}= {stock:quote.stock,q:quote.quote};
  state.selectedStock=stock;
  d.replaceChildren();
  d.append(el("h3",stock.symbol+" · "+stock.name));
  d.append(el("p","Issuer contract on Robinhood Chain (4663): "+stock.contract));
  d.append(el("p","Underlying bid / ask: "+money(q.underlyingBidUsd)+" / "+money(q.underlyingAskUsd)));
  d.append(el("p","Multiplier-adjusted reference per token: "+money(q.perTokenBidUsd)+" / "+money(q.perTokenAskUsd)));
  d.append(el("p","Shares per token: "+(stock.multiplier??"unavailable")+
   " · Trading halt: "+(q.isTradingHalt?"YES":"No reported halt")));
  d.append(el("p","Quote generated: "+(q.quoteGeneratedAt?new Date(q.quoteGeneratedAt).toLocaleString():"Not reported")+
   (quote.stale?" · STALE CACHED DATA":"")));
  d.append(el("p","Not a guaranteed on-chain executable price. Underlying volume, if shown, is not token DEX trading volume.","rh-bad"));
  d.append(button("Open in shared TP/SL tracker",()=>useSharedTracker(stock.contract)));
  d.append(document.createTextNode(" · "));
  d.append(link("Verify issuer contract on Blockscout","https://robinhoodchain.blockscout.com/token/"+stock.contract));
  d.append(document.createTextNode(" · "));
  d.append(button(watching("stock",symbol)?"Remove watch":"Add to watchlist",
   ()=>{toggleWatch("stock",symbol,stock.name);selectStock(symbol);}));
 }catch(e){d.replaceChildren();d.append(el("p","No verified issuer quote: "+e.message,"rh-bad"));}
}
function drawWatch(){
 const body=$("rhWatchRows");body.replaceChildren();
 if(!state.watch.length){body.append(el("p","Your local watchlist is empty. Add a DEX pool or official Stock Token from the tables.","rh-sub"));return;}
 for(const x of state.watch){
  const row=el("div",undefined,"rh-detail");
  row.append(el("strong",(x.kind==="stock"?"Issuer token ":"DEX pool ")+(x.label||x.key)+" · "+shorter(x.key)));
  row.append(document.createTextNode(" "));
  row.append(button("Inspect",async()=>{
   if(x.kind==="stock"){changeMode("stock");await selectStock(x.key);}
   else if(x.kind==="token"){changeMode("dex");await inspectToken(x.key);}
   else{changeMode("dex");try{const result=await api("/robinhood/pool?address="+encodeURIComponent(x.key));
    selectDex(result.pool);}catch(e){status("Saved pool is temporarily unavailable: "+e.message);}}
  }));
  row.append(button("Remove",()=>toggleWatch(x.kind,x.key,x.label)));
  body.append(row);
 }
}
async function loadDex(force=false){
 if(state.busy)return;
 if(!force&&state.dex?.view===state.view&&Date.now()-state.lastLoad<55000)return;
 state.busy=true;$("rhRefresh").disabled=true;
 try{
  const data=await api("/robinhood/pools?view="+encodeURIComponent(state.view));
  if(data.chainId!==4663||data.mode!=="READ_ONLY"||!Array.isArray(data.pools))throw Error("Unexpected Robinhood Chain response");
  state.dex=data;state.lastLoad=Date.now();drawDex();
  status("Robinhood Chain · "+state.view+" · "+data.total+" observed DEX pools"+
   (data.stale?" · STALE cached market data":" · updated "+new Date(data.fetchedAt||data.cachedAt).toLocaleTimeString())+
   ". Robinhood Chain tokens are NOT automatically safety-verified.");
 }catch(e){status("DEX data unavailable: "+e.message+". No market numbers were invented.");}
 finally{state.busy=false;$("rhRefresh").disabled=false;}
}
async function loadStocks(){
 if(state.busy)return;
 state.busy=true;$("rhRefresh").disabled=true;
 try{
  const q=$("rhStockSearch").value.trim();
  const data=await api("/robinhood/stocks?q="+encodeURIComponent(q));
  if(data.chainId!==4663||data.mode!=="READ_ONLY"||!Array.isArray(data.stocks))throw Error("Unexpected issuer registry response");
  state.stocks=data;drawStocks();
  status("Official Robinhood issuer registry · "+data.totalOfficialAssets+" tokens registered"+
   (data.stale?" · STALE cached registry":" · refreshed "+new Date(data.cachedAt).toLocaleTimeString())+
   ". Select a ticker for a separate issuer quote.");
 }catch(e){status("Official Robinhood token data unavailable: "+e.message);}
 finally{state.busy=false;$("rhRefresh").disabled=false;}
}
$("rhDexTab").addEventListener("click",()=>changeMode("dex"));
$("rhStockTab").addEventListener("click",()=>changeMode("stock"));
$("rhWatchTab").addEventListener("click",()=>changeMode("watch"));
$("rhTrending").addEventListener("click",()=>{state.view="trending";$("rhTrending").classList.add("rh-active");$("rhNew").classList.remove("rh-active");loadDex(true);});
$("rhNew").addEventListener("click",()=>{state.view="new";$("rhNew").classList.add("rh-active");$("rhTrending").classList.remove("rh-active");loadDex(true);});
$("rhMinLiq").addEventListener("change",drawDex);
$("rhLookupToken").addEventListener("click",()=>{
 const a=$("rhTokenSearch").value.trim();
 if(!validAddress(a)){status("Paste a complete 0x + 40-character Robinhood Chain contract address.");return;}
 inspectToken(a);
});
$("rhTokenSearch").addEventListener("keydown",e=>{if(e.key==="Enter")$("rhLookupToken").click();});
$("rhRefresh").addEventListener("click",()=>{
 if(state.mode==="dex")loadDex(true);else if(state.mode==="stock")loadStocks();else drawWatch();
});
$("rhStockSearch").addEventListener("input",()=>{
 clearTimeout(state.searchDelay);
 state.searchDelay=setTimeout(()=>{if(state.mode==="stock")loadStocks();},380);
});
setInterval(()=>{
 if(document.hidden||state.busy||root.closest("[hidden]"))return;
 if(state.mode==="dex")loadDex(true);
 else if(state.mode==="stock"&&state.selectedStock)selectStock(state.selectedStock.symbol);
},60000);
saveWatch();drawWatch();drawDex();drawStocks();loadDex();
})();
