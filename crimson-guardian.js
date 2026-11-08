/* Crimson Guardian V1. Capital protection + tracked position management.
   Existing analytics, calculator, Firebase auth and price alerts are untouched.
   Spot long only; all execution quotes and sales are USER-SUPPLIED, not verified.
*/
(() => {
"use strict";
const $=id=>document.getElementById(id);
if($("cgGuardian"))return;
const finite=x=>Number.isFinite(x);
const number=x=>x===null||x===undefined||x===""?NaN:Number(x);
const p=x=>finite(x)&&x>0?"$"+Number(x).toPrecision(8):"—";
const usd=x=>finite(x)?(x<0?"−":"")+"$"+Math.abs(x).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}):"—";
const pct=x=>finite(x)?(x>0?"+":"")+x.toFixed(1)+"%":"—";
const mintOK=x=>typeof x==="string"&&(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(x)||/^0x[a-fA-F0-9]{40}$/.test(x));
const keyOK=k=>typeof k==="string"&&(mintOK(k)||/^(solana|robinhood):/.test(k)&&mintOK(k.split(":").slice(1).join(":")));
const create=(tag,text,klass)=>{const e=document.createElement(tag);e.textContent=String(text);if(klass)e.className=klass;return e;};
const style=document.createElement("style");
style.textContent=[
"#cgGuardian{border:1px solid #69516e;background:linear-gradient(130deg,#1b152f,#101b2e)}",
"#cgGuardian .cg-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center}",
"#cgGuardian .cg-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,225px),1fr));gap:10px}",
"#cgGuardian .cg-card{background:#0b1427;border:1px solid #34415b;border-radius:12px;padding:13px;min-width:0}",
"#cgGuardian .cg-card strong{font-size:18px;overflow-wrap:anywhere}",
"#cgGuardian .cg-small{color:#b6c4df;font-size:12px;line-height:1.55;margin:7px 0}",
"#cgGuardian .cg-controls{display:flex;gap:8px;flex-wrap:wrap;align-items:center}",
"#cgGuardian .cg-controls button{padding:9px 12px}",
"#cgGuardian .cg-inputs{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,155px),1fr));gap:12px;margin:12px 0}",
"#cgGuardian .cg-inputs label{font-size:12px;color:#ced8f2}",
"#cgGuardian input{margin-top:5px}",
"#cgGuardian .cg-warning{background:#30232d;border:1px dashed #896647;border-radius:10px;padding:11px;font-size:12px;color:#f7dcb5;line-height:1.55}",
"#cgGuardian .cg-alert{font-size:14px;font-weight:800;margin:9px 0}",
"#cgGuardian .cg-alert.urgent{color:#ff91a3}",
"#cgGuardian .cg-alert.watch{color:#ffdea0}",
"#cgGuardian .cg-alert.calm{color:#7de9bc}",
"#cgGuardian .cg-table{width:100%;border-collapse:collapse;font-size:12px}",
"#cgGuardian .cg-table th,#cgGuardian .cg-table td{padding:7px 4px;border-bottom:1px solid #35415d;text-align:left}",
"#cgGuardian .cg-section{margin:14px 0;padding-top:10px;border-top:1px solid #39425b}",
"#cgGuardian button:disabled{opacity:.45}",
"#cgGuardian .cg-help{color:#b7c2df;font-size:12px}",
"#cgGuardian .cg-input-label{display:block;margin-bottom:5px}"
].join("\n");
document.head.append(style);
const original=$("ciPositionIntel"),main=document.querySelector("main");
if(!main)return;
const panel=document.createElement("section");
panel.id="cgGuardian";panel.className="panel";
panel.innerHTML=[
'<div class="cg-head"><div><h2>🛡 Crimson Guardian · Capital Protection</h2>',
'<p class="cg-small">Locked trade plans, real-exit sanity checks, manually recorded partial sales and liquidity warnings. Your original live TP/SL engine stays active separately.</p></div>',
'<button id="cgLock" type="button">Lock current plan</button></div>',
'<div class="cg-alert watch" id="cgWarning">Track a coin, enter a position, then lock a confirmed plan.</div>',
'<div class="cg-small" id="cgStatus">No locked position.</div>',
'<div class="cg-grid">',
'<div class="cg-card"><div class="label">LOCKED ENTRY / SL</div><strong id="cgLocked">—</strong><p class="cg-small" id="cgLockNote">No locked plan.</p></div>',
'<div class="cg-card"><div class="label">REMAINING POSITION</div><strong id="cgRemain">—</strong><p class="cg-small" id="cgRemainingValue">Not entered</p></div>',
'<div class="cg-card"><div class="label">REALIZED P/L · MANUAL FILLS</div><strong id="cgRealized">—</strong><p class="cg-small" id="cgExitCount">0 recorded exits</p></div>',
'<div class="cg-card"><div class="label">MARKET EXIT ESTIMATE</div><strong id="cgExitSpot">—</strong><p class="cg-small" id="cgLiquidityRisk">No live coin selected</p></div>',
'</div>',
'<div class="cg-section"><h3>Partial Profit Manager</h3>',
'<p class="cg-small">Log an actual sale AFTER executing it elsewhere. Crimson never executes trades or assumes a TP automatically sold.</p>',
'<div class="cg-inputs">',
'<label>Sell % of REMAINING tokens<input id="cgSellPercent" type="number" min="0.01" max="100" step="any" value="25"></label>',
'<label>Actual executed sale price ($)<input id="cgSalePrice" type="number" min="0" step="any" placeholder="Filled token price"></label>',
'<label>Actual fees for sale ($)<input id="cgSaleFee" type="number" min="0" step="any" value="0"></label>',
'</div><div class="cg-controls"><button id="cgRecordSale" type="button">Record actual partial sale</button>',
'<button id="cgUndoSale" type="button">Undo last manual sale</button>',
'<button id="cgRelease" type="button">Unlock / clear this plan</button></div>',
'<p id="cgSales" class="cg-small">No exits recorded.</p></div>',
'<div class="cg-section"><h3>Can I realistically exit?</h3>',
'<p class="cg-small">Spot price is NOT a confirmed fill. Enter a <strong>fresh sell-preview net USD output</strong> from your wallet or swap interface to compare it with the theoretical market value.</p>',
'<div class="cg-inputs">',
'<label>Net USD output from sell preview<input id="cgQuote" type="number" min="0" step="any" placeholder="After estimated swap fees"></label>',
'<label>Preview timestamp<input id="cgQuoteTime" type="text" disabled placeholder="No preview recorded"></label>',
'</div><div class="cg-controls"><button id="cgSetQuote" type="button">Record preview (manual)</button>',
'<button id="cgClearQuote" type="button">Clear preview</button></div>',
'<p class="cg-small" id="cgQuoteSummary">Live executable quotes are not connected. Liquidity checks alone cannot confirm sellability.</p></div>',
'<div class="cg-section"><h3>Emergency Watch</h3>',
'<div class="cg-inputs"><label>Liquidity-drop warning %<input id="cgLiqThreshold" type="number" min="5" max="90" step="1" value="15"></label>',
'<label>Price-drop warning % from entry<input id="cgPriceThreshold" type="number" min="1" max="99" step="1" value="20"></label></div>',
'<label class="cg-small"><input type="checkbox" id="cgAlerts" style="width:auto"> Enable browser warnings while this tab is open</label>',
'<p class="cg-small" id="cgEvidence">Waiting for observed market activity.</p></div>',
'<div class="cg-warning"><strong>Limits:</strong> Guardian saves manually entered positions locally in this browser for the signed-in account. Other devices do not sync this data. These warnings cannot run after you close the browser; 24/7 alerts need a secure backend. Token security and wallet ownership are not inferred from price alone. SL/TP zones are reference prices, and extremely illiquid pools may be impossible to exit.</div>'
].join("");
if(original)original.insertAdjacentElement("afterend",panel);else main.append(panel);
const data={snapshot:null,planSnapshot:null,unified:null,security:null,liquidityHistory:[],warningKey:"",quote:null,plans:{},userKey:""};
function accountKey(){
if(document.body.classList.contains("ci-account-locked"))return "";
const name=String($("ciAccountEmail")?.textContent||"").trim().toLowerCase();
if(!name||!name.includes("@"))return "";
// Lightweight non-cryptographic partition, not encryption.
let h=2166136261;for(let i=0;i<name.length;i++){h^=name.charCodeAt(i);h=Math.imul(h,16777619);}
return "crimson-guardian-v1-"+(h>>>0).toString(16);
}
function recordKey(){
const k=accountKey();
if(!k)return "";
if(data.userKey!==k){
data.userKey=k;data.plans={};data.quote=null;
try{const v=JSON.parse(localStorage.getItem(k)||"null");
if(v&&typeof v==="object"&&v.plans&&typeof v.plans==="object")data.plans=Object.fromEntries(Object.entries(v.plans).filter(([key,plan])=>keyOK(key)&&plan?.plan&&Array.isArray(plan.sales)).map(([key,plan])=>
 [key.includes(":")?key:"solana:"+key,plan]));
}catch(e){}
}
return k;
}
function persist(){
const k=recordKey();if(!k)return;
try{if(Object.keys(data.plans).length)localStorage.setItem(k,JSON.stringify({plans:data.plans}));
else localStorage.removeItem(k);}
catch(e){$("cgStatus").textContent="Browser storage unavailable: data may not persist.";}
}
function currentMint(){return data.snapshot?.mint||data.planSnapshot?.mint||"";}
function currentChain(){return data.snapshot?.pair?.chainId||data.planSnapshot?.chainId||"solana";}
function currentId(){
 const mint=currentMint();
 return mintOK(mint)?currentChain()+":"+(currentChain()==="robinhood"?mint.toLowerCase():mint):"";
}
function lockedForCurrent(){
 recordKey();return data.plans[currentId()]||null;
}
function availableQty(l){
if(!l)return 0;
const sold=l.sales.reduce((sum,x)=>sum+Number(x.qty||0),0);
return Math.max(0,l.quantity-sold);
}
function livePlan(){
const v=data.planSnapshot,p=v?.plan;
if(!v||!p||v.mint!==currentMint()||v.chainId!==currentChain()||
 !(v.amount>0&&v.entry>0&&v.qty>0))return null;
if(![p.sl,p.tp1,p.tp2,p.tp3].every(x=>Number.isFinite(Number(x))&&x>0))return null;
return v;
}
function alertStatus(message,level){
const key=currentId()+"|"+message;
if(key===data.warningKey)return;
data.warningKey=key;
if(!$("cgAlerts").checked||document.hidden)return;
if("Notification" in window&&Notification.permission==="granted"){
try{new Notification("Crimson Guardian",{body:message});}catch(e){}
}
}
function render(){
const current=data.snapshot,lk=lockedForCurrent(),activePlan=livePlan(),
 priceNow=number(current?.pair?.priceUsd),liquidity=number(current?.pair?.liquidity?.usd);
const coin=currentMint(),sec=data.security||data.unified?.security;
if(!coin){data.warningKey="";$("cgStatus").textContent="Track a Solana or Robinhood token to start Guardian.";
 $("cgLock").disabled=true;return;}
if(!recordKey()){
$("cgStatus").textContent="Sign in first to unlock position storage.";
$("cgLock").disabled=true;
}else{
$("cgLock").disabled=!activePlan||!!lk;
}
$("cgRecordSale").disabled=!lk||availableQty(lk)<=0;
$("cgUndoSale").disabled=!lk||lk.sales.length===0;
$("cgRelease").disabled=!lk;
const market=data.unified?.mint===coin?data.unified.market:null;
const qty=lk?availableQty(lk):activePlan?.qty||NaN;
const entry=lk?.entry??activePlan?.entry;
const sl=lk?.plan?.sl??activePlan?.plan?.sl;
const exitSpot=finite(priceNow)&&finite(qty)?priceNow*qty:NaN;
const tradeSize=finite(exitSpot)?exitSpot:NaN;
const theoreticalReturn=lk&&finite(priceNow)?qty*(priceNow-lk.entry):NaN;
$("cgLocked").textContent=lk?p(lk.entry)+" / "+p(lk.plan.sl):"—";
$("cgLockNote").textContent=lk?"Locked "+new Date(lk.createdAt).toLocaleString()+
 " · TP1 "+p(lk.plan.tp1)+" · TP2 "+p(lk.plan.tp2)+" · TP3 "+p(lk.plan.tp3)+
 " · "+(lk.planSource||"Recorded reference"):
 "Live calculated plans can change. Lock a valid plan to freeze the price levels.";
$("cgRemain").textContent=finite(qty)?qty.toLocaleString("en-US",{maximumFractionDigits:6})+" tokens":"—";
$("cgRemainingValue").textContent=lk?usd(exitSpot)+" theoretical spot value · "+
 usd(theoreticalReturn)+" unrealized P/L": "No locked plan; showing calculator quantity if present.";
const realized=lk?lk.sales.reduce((sum,x)=>sum+x.qty*(x.price-lk.entry)-x.fee,0):NaN;
$("cgRealized").textContent=lk?usd(realized):"—";
$("cgExitCount").textContent=lk?lk.sales.length+" manually recorded sales":"Lock plan to track actual exits.";
$("cgExitSpot").textContent=usd(exitSpot);
const fraction=finite(tradeSize)&&finite(liquidity)&&liquidity>0?100*tradeSize/liquidity:NaN;
$("cgLiquidityRisk").textContent=finite(fraction)?
 "Position value / total pool USD liquidity "+fraction.toFixed(2)+"% · crude concentration flag, NOT swap impact.":
 "Live pool liquidity unavailable; quote needed for executable estimate.";
let quoteText="No fresh manual sell-preview output recorded. Not a verified live quote.";
if(data.quote&&data.quote.key===currentId()&&Date.now()-data.quote.time<120000&&finite(exitSpot)){
 const impact=exitSpot>0?100*(exitSpot-data.quote.value)/exitSpot:NaN;
 quoteText="Manual preview net output "+usd(data.quote.value)+" · "+pct(-impact)+
 " vs theoretical spot output · recorded "+new Date(data.quote.time).toLocaleTimeString()+
 ". This quote is user-supplied, may expire and is NOT independently verified.";
}
$("cgQuoteSummary").textContent=quoteText;
$("cgQuoteTime").value=data.quote?.key===currentId()?new Date(data.quote.time).toLocaleString():"";
$("cgSales").textContent=lk&&lk.sales.length?lk.sales.map((x,i)=>
 "#"+(i+1)+": "+x.qty.toPrecision(6)+" tokens @ "+p(x.price)+
 " · "+usd(x.qty*(x.price-lk.entry)-x.fee)+" realized").join(" | "):
 "No manual sales recorded. Buttons cannot perform actual swaps.";
const messages=[];
const oldest=data.liquidityHistory.find(x=>x.key===currentId()&&Date.now()-x.time<=30*60000);
const drop=oldest&&oldest.value>0&&finite(liquidity)?100*(oldest.value-liquidity)/oldest.value:NaN;
const liqLimit=number($("cgLiqThreshold").value),priceLimit=number($("cgPriceThreshold").value);
if(sec?.verified&&sec.reject)messages.push("ON-CHAIN SECURITY FLAG: investigate report immediately.");
if(currentChain()==="robinhood"&&current?.pair?.priceType==="issuer-reference")
 messages.push("ISSUER REFERENCE ONLY: NO DEX EXECUTABLE SELL QUOTE OR POOL LIQUIDITY. U.S. OFFERING RESTRICTIONS.");
if(current?.pair?.dataStale)messages.push("STALE MARKET DATA. Do not rely on spot alerts or risk scores as live.");
if(currentChain()==="robinhood"&&current?.pair?.issuerStatus&&current.pair.issuerStatus!=="ASSET_STATUS_ACTIVE")
 messages.push("ISSUER STOCK TOKEN IS NOT MARKED ACTIVE; trading eligibility cannot be inferred.");
if(currentChain()==="robinhood"&&current?.pair?.pendingMultiplier)
 messages.push("CORPORATE ACTION MULTIPLIER PENDING; recheck entry/exit levels before relying on an older plan.");
if(currentChain()==="robinhood"&&current?.pair?.priceType==="dex-spot"&&!sec?.verified)
 messages.push("ROBINHOOD CONTRACT SECURITY NOT VERIFIED. Pool liquidity is not proof a token is safe.");
if(lk&&finite(priceNow)&&priceNow<=lk.plan.sl)messages.push("PRICE AT/BELOW LOCKED SL. Exit may be impaired by slippage.");
if(market?.dangerous||market?.dump)messages.push("HIGH MARKET DANGER / DUMP PRESSURE detected.");
if(finite(drop)&&drop>=(finite(liqLimit)?liqLimit:15))messages.push("OBSERVED USD LIQUIDITY DOWN "+drop.toFixed(1)+"%; cause unknown.");
if(lk&&finite(priceNow)&&priceNow<lk.entry*(1-(finite(priceLimit)?priceLimit:20)/100))
 messages.push("POSITION DOWN MORE THAN SET PRICE THRESHOLD.");
if(finite(fraction)&&fraction>10)messages.push("POSITION >10% OF POOL USD LIQUIDITY; execution danger.");
if(data.quote&&data.quote.key===currentId()&&Date.now()-data.quote.time<120000&&finite(exitSpot)&&
 exitSpot>0&&data.quote.value<exitSpot*.85)messages.push("MANUAL SELL PREVIEW >15% WORSE THAN SPOT ESTIMATE.");
const high=messages.length>0;
const headline=high?"EMERGENCY WATCH · "+messages[0]:
 !lk?"NO LOCKED PLAN · RISK UNVERIFIED":
 !market?.enough?"DATA QUALITY LOW · NO CLEAR HOLD SIGNAL":
 "MONITOR POSITION · NO CRITICAL TRIGGER FROM CURRENT SNAPSHOT";
$("cgWarning").textContent=headline;
$("cgWarning").className="cg-alert "+(high?"urgent":lk?"watch":"calm");
$("cgEvidence").textContent=messages.length?messages.join(" "):
 "No current emergency flag under configured checks. This does NOT prove safety.";
$("cgStatus").textContent=(lk?"Plan frozen; market checks continue.":"No plan locked yet.")+
 " · "+(currentChain()==="robinhood"?"Robinhood Chain":"Solana")+
 " · Last market update "+(current?new Date(current.updatedAt||Date.now()).toLocaleTimeString():"—");
if(high)alertStatus(messages[0],"urgent");
else data.warningKey="";
}
function lock(){
const v=livePlan();if(!v||!recordKey())return;
if(data.plans[currentId()])return;
const entry=number(v.entry),amount=number(v.amount),qty=number(v.qty);
data.plans[currentId()]={
 mint:v.mint,chainId:currentChain(),pairAddress:v.pairAddress,entry,invested:amount,quantity:qty,
 planSource:v.plan.source||"Unverified reference",
 plan:{sl:Number(v.plan.sl),tp1:Number(v.plan.tp1),tp2:Number(v.plan.tp2),tp3:Number(v.plan.tp3)},
 createdAt:Date.now(),sales:[]
};
persist();render();
}
function recordSale(){
const lk=lockedForCurrent();if(!lk)return;
const percent=number($("cgSellPercent").value),price=number($("cgSalePrice").value),fee=number($("cgSaleFee").value);
if(!(percent>0&&percent<=100&&price>0&&fee>=0)){
 $("cgSales").textContent="Enter a sale fraction 0–100%, ACTUAL execution price and nonnegative fee.";return;
}
const remain=availableQty(lk),qty=remain*percent/100;
if(qty<=0)return;
lk.sales.push({qty,price,fee,time:Date.now()});
persist();render();
}
function clearPlan(){const lk=lockedForCurrent();if(!lk)return;
if(!window.confirm("Clear the locked plan and its manually recorded exits for this coin?"))return;
delete data.plans[currentId()];persist();render();
}
function storeQuote(){
const amount=number($("cgQuote").value),mint=currentMint();
if(!mintOK(mint)||!(amount>0)){$("cgQuoteSummary").textContent="Enter a valid net sell-preview USD output.";return;}
data.quote={key:currentId(),value:amount,time:Date.now()};render();
}
$("cgLock").addEventListener("click",lock);
$("cgRecordSale").addEventListener("click",recordSale);
$("cgRelease").addEventListener("click",clearPlan);
$("cgUndoSale").addEventListener("click",()=>{
const lk=lockedForCurrent();if(!lk?.sales.length)return;
lk.sales.pop();persist();render();
});
$("cgSetQuote").addEventListener("click",storeQuote);
$("cgClearQuote").addEventListener("click",()=>{data.quote=null;$("cgQuote").value="";render();});
for(const id of ["cgLiqThreshold","cgPriceThreshold"])$(id).addEventListener("input",render);
$("cgAlerts").addEventListener("change",async()=>{
if($("cgAlerts").checked&&"Notification" in window&&Notification.permission==="default"){
try{await Notification.requestPermission();}catch(e){}
}
});
window.addEventListener("crimson:position-plan",ev=>{
data.planSnapshot=ev.detail;render();
});
window.addEventListener("crimson:market-snapshot",ev=>{
const s=ev.detail;if(!mintOK(s?.mint))return;
data.snapshot=s;const value=number(s?.pair?.liquidity?.usd);
if(finite(value)&&value>0){
data.liquidityHistory.push({key:currentId(),value,time:Date.now()});
data.liquidityHistory=data.liquidityHistory.filter(x=>Date.now()-x.time<31*60000).slice(-150);
}
render();
});
window.addEventListener("crimson:unified-intelligence",ev=>{data.unified=ev.detail;render();});
window.addEventListener("crimson:security-check",ev=>{
if(ev.detail?.mint===currentMint())data.security=ev.detail.report;
render();
});
window.addEventListener("crimson:tracked-change",ev=>{
data.snapshot=null;data.unified=null;data.security=null;data.quote=null;data.planSnapshot=null;
if(mintOK(ev.detail?.mint))data.planSnapshot={mint:ev.detail.mint,chainId:ev.detail.chainId};
render();
});
window.addEventListener("focus",render);
const observed=window.CRIMSON_LATEST_MARKET;
if(observed)data.snapshot=observed;
if(window.CRIMSON_LATEST_POSITION)data.planSnapshot=window.CRIMSON_LATEST_POSITION;
if(window.CRIMSON_LATEST_INTELLIGENCE)data.unified=window.CRIMSON_LATEST_INTELLIGENCE;
// Refresh per-account saved plans on every login transition; on sign-out,
// discard private browser state immediately, even though the app is hidden.
new MutationObserver(()=>{
  if(document.body.classList.contains("ci-account-locked")){
    data.userKey="";data.plans={};data.quote=null;
  }
  render();
}).observe(document.body,{attributes:true,attributeFilter:["class"]});
render();
})();
