/* Crimson Safety Scout: additive Solana candidate discovery, security screening, and
   research trade zones. Does not change Crimson's existing tracking or accounts. */
(() => {
"use strict";
const $=id=>document.getElementById(id);
if($("crimsonSafetyScout"))return;
const DEX="https://api.dexscreener.com", GECKO="https://api.geckoterminal.com/api/v2",
RUG="https://api.rugcheck.xyz/v1/tokens/";
const valid=x=>typeof x==="string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(x);
const n=x=>x==null||x===""?NaN:Number(x);
const dollars=x=>Number.isFinite(x)?"$"+x.toLocaleString("en-US",{maximumFractionDigits:0}):"—";
const price=x=>Number.isFinite(x)&&x>0?"$"+Number(x).toPrecision(7):"—";
const percent=x=>Number.isFinite(x)?(x>0?"+":"")+x.toFixed(1)+"%":"—";
const excluded=new Set(["So11111111111111111111111111111111111111112","EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"]);
const make=(tag,value,cls)=>{const e=document.createElement(tag);e.textContent=String(value);if(cls)e.className=cls;return e;};
const link=(text,url)=>{const e=make("a",text);e.href=url;e.target="_blank";e.rel="noopener noreferrer";return e;};
const style=document.createElement("style");
style.textContent="#crimsonSafetyScout{background:linear-gradient(145deg,#20182e,#111a31);border-color:#744865}"+
"#crimsonSafetyScout .cs-title{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}"+
"#crimsonSafetyScout .cs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:12px;margin-top:12px}"+
"#crimsonSafetyScout .cs-card{background:#0b1428;border:1px solid #36415d;border-radius:12px;padding:14px;min-width:0}"+
"#crimsonSafetyScout .cs-card h3{font-size:16px;margin:0 0 8px}"+
"#crimsonSafetyScout .cs-small{font-size:12px;color:#b8c3de;line-height:1.6;margin:8px 0}"+
"#crimsonSafetyScout .cs-pill{display:inline-block;border-radius:99px;padding:4px 8px;font-size:11px;background:#34384f;color:#dde8ff;font-weight:800}"+
"#crimsonSafetyScout .cs-pill.pass{background:#124333;color:#88f0c2}"+
"#crimsonSafetyScout .cs-pill.fail{background:#49242e;color:#ffa1a9}"+
"#crimsonSafetyScout .cs-table{border-collapse:collapse;width:100%;font-size:12px;margin-top:9px}"+
"#crimsonSafetyScout .cs-table td,#crimsonSafetyScout .cs-table th{padding:7px 3px;border-bottom:1px solid #35415d;text-align:left}"+
"#crimsonSafetyScout .cs-buttons{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-top:12px}"+
"#crimsonSafetyScout .cs-buttons button{padding:8px 12px}"+
"#crimsonSafetyScout .cs-warning{border:1px dashed #81653f;color:#e7d5b8;font-size:12px;line-height:1.6;border-radius:10px;padding:12px;margin-top:14px}"+
"#crimsonSafetyScout a{color:#aac8ff}";
document.head.append(style);
const main=document.querySelector("main");if(!main)return;
const panel=document.createElement("section");panel.className="panel";panel.id="crimsonSafetyScout";
panel.innerHTML='<div class="cs-title"><div><h2>🛡 Crimson Safety Scout · Auto Discovery</h2>'+
'<p class="cs-small">Finds Solana meme-coin candidates in new, trending and promoted discovery feeds. Filters for liquidity, real activity and available on-chain risk findings. Never assumes a paid promotion is trustworthy.</p></div>'+
'<button type="button" id="csScan">Scan now</button></div>'+
'<div id="csScanStatus" class="cs-small" role="status" aria-live="polite">Preparing discovery…</div>'+
'<div id="csTop" class="cs-card" style="margin-top:12px"><h3>Best screened candidate</h3><p class="cs-small">Waiting for sufficient verified risk data.</p></div>'+
'<div class="cs-grid" id="csCandidates"></div>'+
'<div class="cs-warning"><strong>Risk disclosure:</strong> Best screened means lowest observed warnings <em>among a limited sample</em>, not a probability of avoiding a rug. If security results are unavailable, Crimson refuses to mark a coin as screened. Entry, SL and TP1–TP3 are illustrative price levels based on completed five-minute candles, not predicted executions or guaranteed profits. Discovery operates only while this browser page is active.</div>';
const originalRadar=$("crimsonMarketRadar"),search=$("mint")?.closest("section");
if(originalRadar)originalRadar.insertAdjacentElement("afterend",panel);
else if(search)search.insertAdjacentElement("afterend",panel);
else main.prepend(panel);
const tracked=document.createElement("section");tracked.className="panel";tracked.id="csTrackedReport";
tracked.innerHTML='<h2>🔎 Tracked Coin RugCheck Screening</h2>'+
'<p id="csTrackedState" class="note">Track a Solana coin to view a current independent token-security summary.</p>'+
'<div id="csTrackedReasons" class="note"></div>';
const risk=$("crimsonTrackedRadar");
if(risk)risk.insertAdjacentElement("afterend",tracked);else main.append(tracked);

async function get(url){
const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),13000);
try{const res=await fetch(url,{cache:"no-store",signal:ctrl.signal});
if(!res.ok)throw Error("Provider HTTP "+res.status);
return await res.json();}finally{clearTimeout(timer);}
}
const cache=new Map();
function classifyReport(r){
if(!r||!Array.isArray(r.risks))return {verified:false,reject:true,warnings:999,notes:["Provider risk report was incomplete."]};
const severe=r.risks.filter(x=>["danger","critical","high"].includes(String(x?.level||"").toLowerCase()));
const warn=r.risks.filter(x=>["warn","warning","medium"].includes(String(x?.level||"").toLowerCase()));
const lp=n(r.lpLockedPct),lpOK=Number.isFinite(lp)&&lp>=0&&lp<=100;
const normalized=n(r.score_normalised),scoreKnown=Number.isFinite(normalized)&&normalized>=0&&normalized<=100;
const notes=[
...severe.slice(0,3).map(x=>"Severe: "+String(x.name||x.description||"Unspecified").slice(0,120)),
...warn.slice(0,3).map(x=>"Warning: "+String(x.name||x.description||"Unspecified").slice(0,120)),
lpOK?"Reported locked LP: "+lp.toFixed(0)+"%.":"LP lock percentage unverified.",
scoreKnown?"RugCheck normalized risk score: "+normalized.toFixed(0)+"/100 (higher = riskier).":"No normalized score provided."
];
return {verified:true,reject:severe.length>0||!lpOK||lp<75||(scoreKnown&&normalized>25),
warnings:warn.length,severe:severe.length,lp,lpOK,normalized,scoreKnown,notes};
}
async function securityFor(mint){
const c=cache.get(mint);if(c&&Date.now()-c.time<300000)return c.value;
let value;try{value=classifyReport(await get(RUG+encodeURIComponent(mint)+"/report/summary"));}
catch(e){value={verified:false,reject:true,warnings:999,notes:["RugCheck API unavailable or blocked by browser/CORS: "+String(e.message).slice(0,90)]};}
cache.set(mint,{time:Date.now(),value});return value;
}
function geckoMint(pool){
const id=pool?.relationships?.base_token?.data?.id;
const mint=typeof id==="string"&&id.startsWith("solana_")?id.slice(7):"";
return valid(mint)&&!excluded.has(mint)?mint:null;
}
async function discover(){
const feeds=[["New pools",GECKO+"/networks/solana/new_pools?include=base_token"],
["Trending",GECKO+"/networks/solana/trending_pools?include=base_token"],
["Profiles",DEX+"/token-profiles/latest/v1"],
["Paid boost",DEX+"/token-boosts/latest/v1"]];
const results=await Promise.allSettled(feeds.map(f=>get(f[1])));
const buckets=feeds.map(()=>[]),failures=[];
results.forEach((r,i)=>{
if(r.status!=="fulfilled"){failures.push(feeds[i][0]+" unavailable");return;}
const data=r.value;
const candidates=i<2?(Array.isArray(data?.data)?data.data:[]).map(geckoMint):
(Array.isArray(data)?data:[]).filter(t=>t?.chainId==="solana").map(t=>t.tokenAddress);
buckets[i]=candidates.filter(m=>valid(m)&&!excluded.has(m));
});
const unique=new Map();
// Mix sources to avoid choosing only the newest low-liquidity tokens.
for(const [i,limit] of [[0,10],[1,10],[2,6],[3,4]])
for(const mint of buckets[i].slice(0,limit))if(!unique.has(mint))unique.set(mint,feeds[i][0]);
const addresses=[...unique.keys()].slice(0,30);
if(!addresses.length)throw Error("No Solana candidates in available discovery feeds. "+failures.join("; "));
const pools=await get(DEX+"/tokens/v1/solana/"+addresses.map(encodeURIComponent).join(","));
if(!Array.isArray(pools))throw Error("Pool snapshots missing");
const best=new Map();
for(const p of pools){
const mint=p?.baseToken?.address;
if(p?.chainId!=="solana"||!unique.has(mint))continue;
const old=best.get(mint);
if(!old||n(p?.liquidity?.usd)>n(old?.liquidity?.usd))best.set(mint,p);
}
const rows=[];
for(const [mint,p] of best){
const liq=n(p.liquidity?.usd),spot=n(p.priceUsd),volume=n(p.volume?.h24),
buys=n(p.txns?.m5?.buys),sells=n(p.txns?.m5?.sells),
c5=n(p.priceChange?.m5),c1=n(p.priceChange?.h1),created=n(p.pairCreatedAt);
if(![liq,spot,volume,buys,sells,c5,c1].every(Number.isFinite)||spot<=0||
liq<30000||volume<30000||buys+sells<15||
(Number.isFinite(created)&&Date.now()-created<3600000))continue;
const share=buys/(buys+sells),danger=liq<50000||share<0.42||c5<=-12||c1<=-35||c5>25||c1>120;
const activity=Math.min(30,(buys+sells)/10)+Math.min(25,volume/10000)+share*30;
rows.push({mint,symbol:p.baseToken?.symbol||"?",name:p.baseToken?.name||"Token",
pair:p.pairAddress,source:unique.get(mint),spot,liq,volume,share,c5,c1,danger,activity,report:null,plan:null});
}
rows.sort((a,b)=>Number(a.danger)-Number(b.danger)||b.activity-a.activity);
return {rows:rows.slice(0,8),discovered:addresses.length,failures};
}
function fromCandles(raw,c){
const data=raw?.data?.attributes?.ohlcv_list;
if(!Array.isArray(data)||data.length<28)throw Error("Too few five-minute candles");
const cutoff=Date.now()/1000-325;
const candles=data.map(v=>({ts:n(v[0]),o:n(v[1]),h:n(v[2]),l:n(v[3]),c:n(v[4])}))
.filter(v=>[v.ts,v.o,v.h,v.l,v.c].every(Number.isFinite)&&v.l>0&&v.h>=v.l&&v.ts<=cutoff)
.sort((a,b)=>a.ts-b.ts).slice(-50);
if(candles.length<25)throw Error("Insufficient closed 5m history");
const latest=candles[candles.length-1];
if(Date.now()/1000-latest.ts>1800)throw Error("Price candles are stale");
if(Math.abs(latest.c-c.spot)/c.spot>0.25)throw Error("Candle price disagrees with DEX quote");
const ranges=candles.slice(1).map((v,i)=>Math.max(v.h-v.l,Math.abs(v.h-candles[i].c),Math.abs(v.l-candles[i].c)));
const atr=ranges.slice(-14).reduce((s,v)=>s+v,0)/14;
if(!(atr>0))throw Error("ATR calculation failed");
const lows=[];
for(let i=2;i<candles.length-2;i++)if(candles[i].l<=candles[i-1].l&&candles[i].l<=candles[i-2].l&&candles[i].l<=candles[i+1].l&&candles[i].l<=candles[i+2].l)lows.push(candles[i].l);
const support=lows.filter(x=>x<latest.c).sort((a,b)=>b-a)[0]??Math.min(...candles.slice(-25).map(x=>x.l));
const low=support+0.15*atr,high=support+0.85*atr,sl=support-0.6*atr;
if(!(sl>0&&low>sl&&high>low))throw Error("Invalid structural risk");
const risk=high-sl;
const status=c.spot<sl?"INVALIDATED / AVOID":
c.spot>high+1.5*atr?"WAIT / EXTENDED":
c.spot>=low&&c.spot<=high?"AT ENTRY ZONE":"WAIT FOR CONFIRMATION";
return {low,high,sl,tp1:high+risk,tp2:high+2*risk,tp3:high+3*risk,status};
}
async function planFor(c){
if(!valid(c.pair))throw Error("Pool address unavailable");
const url=GECKO+"/networks/solana/pools/"+encodeURIComponent(c.pair)+
"/ohlcv/minute?aggregate=5&limit=80&currency=usd&token="+encodeURIComponent(c.mint);
return fromCandles(await get(url),c);
}
function draw(target,c,featured){
target.replaceChildren();
target.append(make("h3",(featured?"Best screened: ":"Watch: ")+c.symbol));
target.append(make("p",c.name+" · "+c.mint.slice(0,8)+"… · "+c.source,"cs-small"));
target.append(make("p",price(c.spot)+" · liquidity "+dollars(c.liq)+" · 5m "+percent(c.c5)+" · 1h "+percent(c.c1),"cs-small"));
const verified=c.report?.verified,accepted=verified&&!c.report.reject;
target.append(make("span",accepted?"SCREENED / NOT RUG-PROOF":verified?"RISK FINDINGS / NOT CLEARED":"SECURITY UNVERIFIED","cs-pill "+(accepted?"pass":verified?"fail":"")));
target.append(make("p",(c.report?.notes||["Security unavailable."]).slice(0,3).join(" "),"cs-small"));
if(c.plan){
const table=document.createElement("table");table.className="cs-table";
for(const [k,v] of [["Position",c.plan.status],["Entry zone",price(c.plan.low)+" — "+price(c.plan.high)],
["SL / invalidation",price(c.plan.sl)],["TP1 · 1R",price(c.plan.tp1)],
["TP2 · 2R",price(c.plan.tp2)],["TP3 · 3R",price(c.plan.tp3)]]){
const tr=document.createElement("tr");tr.append(make("th",k),make("td",v));table.append(tr);}
target.append(table);
}else target.append(make("p","No verified 5m candle-based Entry/SL/TP plan available.","cs-small"));
const actions=document.createElement("div");actions.className="cs-buttons";
const btn=make("button","Deep analyze");btn.type="button";
btn.addEventListener("click",()=>{$("mint").value=c.mint;$("track").click();$("mint").scrollIntoView({behavior:"smooth",block:"center"});});
actions.append(btn,link("RugCheck ↗","https://rugcheck.xyz/tokens/"+encodeURIComponent(c.mint)),link("DEX chart ↗","https://dexscreener.com/solana/"+encodeURIComponent(c.pair||c.mint)));
target.append(actions);
}
let working=false,lastScan=0,tracking=false;
async function scan(){
if(working||document.hidden||document.body.classList.contains("ci-account-locked"))return;
working=true;$("csScan").disabled=true;$("csScanStatus").textContent="Scanning current Solana candidates…";
try{
const result=await discover();
$("csScanStatus").textContent="Checking "+result.rows.length+" market-qualified tokens against RugCheck…";
for(let i=0;i<result.rows.length;i+=2)
await Promise.all(result.rows.slice(i,i+2).map(async c=>{c.report=await securityFor(c.mint);}));
const eligible=result.rows.filter(c=>c.report?.verified&&!c.report.reject&&
c.report.warnings<=1&&!c.danger&&c.liq>=75000&&c.share>=0.5);
eligible.sort((a,b)=>(a.report.scoreKnown?a.report.normalized:100)-(b.report.scoreKnown?b.report.normalized:100)||
a.report.warnings-b.report.warnings||b.liq-a.liq);
const best=eligible[0];
if(best)try{best.plan=await planFor(best);}catch(e){best.planError=String(e.message);}
const top=$("csTop"),list=$("csCandidates");top.replaceChildren();list.replaceChildren();
if(best)draw(top,best,true);
else top.append(make("h3","No sufficiently verified candidate passed"),make("p","No coin is selected. Safety reports may be unavailable or all screened candidates may be too risky.","cs-small"));
for(const c of result.rows.filter(x=>x!==best).slice(0,6)){
const box=document.createElement("article");box.className="cs-card";draw(box,c,false);list.append(box);}
lastScan=Date.now();
$("csScanStatus").textContent="Discovered "+result.discovered+" token mints · "+
result.rows.length+" passed market filters · "+result.rows.filter(x=>x.report?.verified).length+
" RugCheck reports · "+eligible.length+" conservative shortlist candidates. Updated "+
new Date().toLocaleTimeString()+". "+result.failures.join("; ");
}catch(e){$("csScanStatus").textContent="Safety scanner unavailable: "+String(e.message)+". The existing tracker still works.";}
finally{working=false;$("csScan").disabled=false;}
}
async function checkTracked(){
const mint=$("mint")?.value.trim()||"";if(!valid(mint)||tracking)return;
tracking=true;$("csTrackedState").textContent="Checking RugCheck report…";
try{
const r=await securityFor(mint);
// Send normalized RugCheck result to Unified Intelligence; market scores never
// pretend token security can be inferred from DEX transaction counts.
window.dispatchEvent(new CustomEvent("crimson:security-check", {
  detail: { mint, report: r }
}));
// Avoid showing a stale report for a token the user has already replaced.
if (($("mint")?.value.trim()||"") !== mint) return;
$("csTrackedState").textContent=r.verified?(r.reject?"Caution: security findings or unverified LP lock status.":"No severe findings in available report; rugs still possible."):"UNVERIFIED — report unavailable.";
const box=$("csTrackedReasons");box.replaceChildren();
for(const x of r.notes)box.append(make("p",x));
box.append(link("Full RugCheck report ↗","https://rugcheck.xyz/tokens/"+encodeURIComponent(mint)));
}finally{tracking=false;}
}
$("csScan").addEventListener("click",scan);
$("track")?.addEventListener("click",checkTracked);
$("mint")?.addEventListener("keydown",e=>{if(e.key==="Enter")checkTracked();});
setInterval(()=>{if(!document.hidden&&Date.now()-lastScan>=180000)scan();},180000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&Date.now()-lastScan>=180000)scan();});
const watch=new MutationObserver(()=>{if(!document.body.classList.contains("ci-account-locked")){watch.disconnect();setTimeout(scan,800);}});
if(document.body.classList.contains("ci-account-locked"))
watch.observe(document.body,{attributes:true,attributeFilter:["class"]});
else setTimeout(scan,1100);
})();