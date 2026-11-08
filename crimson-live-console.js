/* Crimson Intel: LIVE-ONLY AutoTrader control panel (November 2026).
 * No paper balances, paper buttons, local simulations, secret keys or browser
 * execution. The backend is authoritative on wallet and live readiness.
 */
(() => {
"use strict";
if(document.getElementById("ciAutoTrader"))return;
const main=document.querySelector("main");if(!main)return;
const $=id=>document.getElementById(id);
const serverUrl="https://crimson-operator-api-production.up.railway.app";
const css=document.createElement("style");
css.textContent=[
"#ciAutoTrader{border:1px solid #5f4966;background:linear-gradient(135deg,#24182e,#101d32);border-radius:15px}",
"#ciAutoTrader .lv-top{display:flex;gap:10px;align-items:start;justify-content:space-between;flex-wrap:wrap}",
"#ciAutoTrader h2{margin:0 0 7px}",
"#ciAutoTrader .lv-sub{color:#bcc9e3;font-size:12px;line-height:1.6;margin:8px 0}",
"#ciAutoTrader .lv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,185px),1fr));gap:11px;margin:15px 0}",
"#ciAutoTrader .lv-tile{background:#0e162a;border:1px solid #3a4764;border-radius:12px;padding:13px;min-width:0}",
"#ciAutoTrader .lv-tile b{font-size:14px;overflow-wrap:anywhere}",
"#ciAutoTrader .lv-kicker{font-size:10px;letter-spacing:.5px;color:#b8c6e2;margin-bottom:5px}",
"#ciAutoTrader .lv-off{color:#ff9da9}#ciAutoTrader .lv-on{color:#81e8c4}#ciAutoTrader .lv-warn{color:#f1d49c}",
"#ciAutoTrader .lv-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}",
"#ciAutoTrader .lv-actions button{padding:10px 12px;font-size:12px}",
"#ciAutoTrader button:disabled{opacity:.46;cursor:not-allowed}",
"#ciAutoTrader .lv-info{background:#121a31;border:1px solid #344466;border-radius:11px;padding:12px;line-height:1.55;color:#c4d0e7;font-size:12px}",
"#ciAutoTrader .lv-warning{background:#30232d;border:1px dashed #9b735a;color:#f6d6b5;border-radius:12px;padding:12px;font-size:12px;line-height:1.6}",
"#ciAutoTrader .lv-section{padding-top:16px;margin-top:17px;border-top:1px solid #405071}",
"#ciAutoTrader .lv-amount{display:flex;align-items:end;gap:12px;flex-wrap:wrap}",
"#ciAutoTrader .lv-amount label{font-size:12px;flex:1;min-width:175px}",
"#ciAutoTrader .lv-amount input{margin-top:6px}",
"#ciAutoTrader .lv-table-wrap{overflow:auto;max-width:100%}",
"#ciAutoTrader .lv-table{width:100%;min-width:670px;border-collapse:collapse;font-size:12px}",
"#ciAutoTrader .lv-table th,#ciAutoTrader .lv-table td{padding:10px 7px;text-align:left;border-bottom:1px solid #354361;vertical-align:top;overflow-wrap:anywhere}",
"#ciAutoTrader .lv-table th{color:#aebfdd;font-weight:700}",
"#ciAutoTrader .lv-table a{color:#f0b1d2;text-decoration:underline}",
"#ciAutoTrader .lv-badge{font-size:11px;border:1px solid #805f75;border-radius:99px;padding:6px 11px;color:#efbcd3}",
"#ciAutoTrader .lv-empty{font-size:13px;padding:16px;background:#10172b;border:1px dashed #485776;border-radius:11px;color:#bfc9dd}"
].join("\n");document.head.append(css);
const node=document.createElement("section");node.id="ciAutoTrader";node.className="panel";
node.innerHTML=[
'<div class="lv-top"><div><h2>⚔ Crimson AutoTrader · LIVE ONLY</h2>',
'<p class="lv-sub">One owner · Phantom funding source · dedicated execution wallet · finalized on-chain transaction journal</p></div>',
'<span class="lv-badge" id="lvMode">LIVE DISABLED</span></div>',
'<div class="lv-warning">Crimson is not currently buying or selling real tokens. Your Phantom connection proves ownership but does not grant unattended signing permission. Start Live remains locked until a dedicated signer, secure swap execution, transaction reconciliation and recovery testing are verified.</div>',
'<div class="lv-grid">',
'<div class="lv-tile"><div class="lv-kicker">PHANTOM OWNER</div><b id="lvOwner">Not connected</b></div>',
'<div class="lv-tile"><div class="lv-kicker">RAILWAY SERVER</div><b id="lvServer">Not verified</b></div>',
'<div class="lv-tile"><div class="lv-kicker">DEDICATED BOT WALLET</div><b id="lvBotWallet">Not configured</b></div>',
'<div class="lv-tile"><div class="lv-kicker">ACTUAL SOL BALANCE IN PHANTOM</div><b id="lvBalance">—</b></div>',
'<div class="lv-tile"><div class="lv-kicker">DEDICATED BOT SOL BALANCE</div><b id="lvBotBalance">—</b></div>',
'<div class="lv-tile"><div class="lv-kicker">REAL BUY/SELL EXECUTION</div><b id="lvExecutor" class="lv-off">NOT READY</b></div>',
'<div class="lv-tile"><div class="lv-kicker">FINALIZED TRANSACTIONS DOCUMENTED</div><b id="lvCount">—</b></div>',
'</div>',
'<div class="lv-actions">',
'<button id="lvConnect" type="button">Connect Phantom</button>',
'<button id="lvVerify" type="button" disabled>Verify owner</button>',
'<button id="lvRefresh" type="button" disabled>Refresh live status</button>',
'<button id="lvCopy" type="button" disabled>Copy Phantom address</button>',
'<button id="lvCopyBot" type="button" disabled>Copy bot deposit address</button>',
'<button id="lvLogout" type="button">Disconnect</button>',
'</div>',
'<div class="lv-section"><h3>Live Trading Controls</h3>',
'<div class="lv-actions"><button id="lvStart" type="button" disabled>Start Live · Locked</button>',
'<button id="lvStop" type="button" disabled>Stop new trades</button>',
'<button id="lvEmergency" type="button" disabled>Emergency halt</button>',
'<button id="lvReconcile" type="button" disabled>Reconcile pending trade</button></div>',
'<p id="lvStatus" class="lv-info" role="status">Connect Phantom and verify your wallet ownership to inspect the private server.</p></div>',
'<div class="lv-section"><h3>Fund Bot From Phantom</h3>',
'<p class="lv-sub">Choose an allocation from your existing SOL. The selected amount is only a preview; no funding or transaction authorization occurs here.</p>',
'<div class="lv-amount"><label>Proposed amount (SOL)<input type="number" id="lvAllocate" min="0" step="0.000001" placeholder="0.1"></label>',
'<button id="lvPreview" type="button" disabled>Preview allocation</button>',
'<button id="lvFund" type="button" disabled>Fund manually in Phantom</button></div>',
'<p class="lv-sub" id="lvAllocation">Once the dedicated wallet and its recovery have been verified, copy its deposit address and send a small amount of SOL using Phantom’s normal Send screen. No private keys or seed phrases belong on this website.</p></div>',
'<div class="lv-section"><div class="lv-top"><div><h3>Live Solana Market Scanner</h3>',
'<p class="lv-sub">Observes real Solana market data and security screens. It does not simulate trades or move funds.</p></div>',
'<button id="lvScanRefresh" type="button" disabled>Refresh scan</button></div>',
'<div class="lv-grid"><div class="lv-tile"><div class="lv-kicker">SCAN STATUS</div><b id="lvScanStatus">Not checked</b></div>',
'<div class="lv-tile"><div class="lv-kicker">COINS DISCOVERED</div><b id="lvDiscovered">—</b></div>',
'<div class="lv-tile"><div class="lv-kicker">MARKET FILTER PASSED</div><b id="lvQualified">—</b></div>',
'<div class="lv-tile"><div class="lv-kicker">SECURITY FILTER PASSED</div><b id="lvSafeCount">—</b></div></div>',
'<p class="lv-sub" id="lvScanTime">No live scan data loaded.</p>',
'<div class="lv-table-wrap"><table class="lv-table"><thead><tr>',
'<th>Token</th><th>Observed price (USD)</th><th>Liquidity (USD)</th><th>5m buying</th><th>Security</th><th>Candle setup</th>',
'</tr></thead><tbody id="lvScanRows"></tbody></table></div></div>',
'<div class="lv-section"><div class="lv-top"><div><h3>Real Trade Journal</h3>',
'<p class="lv-sub">Only finalized on-chain buys and sells from the dedicated trading wallet. Actual SOL/token price includes net wallet fees and rent adjustments.</p></div>',
'<div class="lv-actions"><button id="lvJournalRefresh" type="button" disabled>Refresh records</button>',
'<button id="lvExport" type="button" disabled>Export CSV</button></div></div>',
'<p class="lv-sub" id="lvJournalStatus">No real trade records loaded.</p>',
'<div class="lv-table-wrap"><table class="lv-table"><thead><tr>',
'<th>Executed (UTC)</th><th>Trade</th><th>Token</th><th>Quantity</th><th>Actual effective entry / exit (SOL/token)</th><th>SOL paid / received</th><th>Network fee</th><th>Transaction</th>',
'</tr></thead><tbody id="lvTrades"></tbody></table></div>',
'<div class="lv-empty" id="lvNoTrades">No verified real transactions yet. Paper and estimated fills are not included.</div></div>',
'<p class="lv-sub">Ledger prices are derived from finalized wallet balance changes, inclusive of network fees and account-rent movements. A separate Jupiter execution-price feed will be needed to isolate swap-only price from those costs. Records will appear only after the live execution system is connected and produces confirmed transactions.</p>',
'<p class="lv-sub"><a href="https://github.com/malusayf/crimson-intel/blob/main/bot/DEPLOYMENT.md" target="_blank" rel="noopener noreferrer">Private execution and recovery requirements</a></p>'
].join("");
const existing=document.getElementById("ccCommandCenter");
if(existing)existing.insertAdjacentElement("afterend",node);else main.append(node);
let provider=null,ownerAddress="",serverStatus=null,token="",expiresAt=0,
  solBalance=null,botBalance=null,ledger=null,scan=null,busy=false,lastPoll=0;
const shorten=x=>x?x.slice(0,6)+"…"+x.slice(-6):"—";
const validWallet=x=>typeof x==="string"&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(x);
const loggedIn=()=>!!token&&Date.now()<expiresAt&&validWallet(ownerAddress);
const setMsg=s=>{$("lvStatus").textContent=s;};
function client(){return window.phantom?.solana||window.solana?.isPhantom&&window.solana||null;}
function toBase64(bytes){
  const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||[]);
  let str="";for(const part of b)str+=String.fromCharCode(part);
  return btoa(str);
}
async function api(path,method="GET",body=null,auth=true){
 const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),12000);
 try{
  const response=await fetch(serverUrl+path,{
    method,headers:{"Content-Type":"application/json",
      ...(auth&&token?{Authorization:"Bearer "+token}:{})},
    body:body===null?undefined:JSON.stringify(body),
    signal:ctrl.signal,credentials:"omit",cache:"no-store"
  });
  let data={};try{data=await response.json();}catch(e){}
  if(!response.ok)throw Error(data.error||"Server HTTP "+response.status);
  return data;
 }finally{clearTimeout(timeout);}
}
function reset(reason){
  token="";expiresAt=0;ownerAddress="";serverStatus=null;ledger=null;solBalance=null;botBalance=null;scan=null;provider=null;
  $("lvAllocation").textContent="Funding authorization reset; no funds moved.";
  setMsg(reason||"Disconnected. No live trading authorization.");
  draw();drawLedger();drawScan();
}
function ready(){
 return loggedIn()&&serverStatus?.online===true&&
  serverStatus.walletReady===true&&serverStatus.liveExecutorReady===true&&
  serverStatus.recoveryVerified===true&&serverStatus.riskControlsReady===true&&
  serverStatus.onchainConfirmationReady===true;
}
function draw(){
 $("lvOwner").textContent=ownerAddress?shorten(ownerAddress):"Not connected";
 $("lvServer").textContent=loggedIn()?"OWNER VERIFIED":"NOT VERIFIED";
 $("lvBotWallet").textContent=serverStatus?.privateBotWallet?
   shorten(serverStatus.privateBotWallet):"Not configured";
 $("lvBotBalance").textContent=Number.isFinite(botBalance)?botBalance.toLocaleString("en-US",{maximumFractionDigits:9})+" SOL":"—";
 $("lvBalance").textContent=Number.isFinite(solBalance)?
   solBalance.toLocaleString("en-US",{maximumFractionDigits:9})+" SOL":"—";
 const canTrade=ready();
 const active=serverStatus?.liveTrading===true;
 $("lvExecutor").textContent=canTrade?"VERIFIED READY":"NOT READY";
 $("lvExecutor").className=canTrade?"lv-on":"lv-off";
 $("lvMode").textContent=active?"LIVE RUNNING":"LIVE DISABLED";
 $("lvMode").className="lv-badge "+(active?"lv-on":"lv-off");
 $("lvCount").textContent=ledger?String(ledger.entries):"—";
 $("lvConnect").disabled=busy;
 $("lvVerify").disabled=busy||!validWallet(ownerAddress);
 $("lvRefresh").disabled=busy||!loggedIn();
 $("lvJournalRefresh").disabled=busy||!loggedIn();
 $("lvScanRefresh").disabled=busy||!loggedIn();
 $("lvCopy").disabled=busy||!validWallet(ownerAddress);
 $("lvCopyBot").disabled=busy||!loggedIn()||!serverStatus?.walletReady||!validWallet(serverStatus.privateBotWallet);
 $("lvPreview").disabled=busy||!loggedIn()||!Number.isFinite(solBalance);
 $("lvExport").disabled=busy||!loggedIn()||!(ledger?.entries>0);
 $("lvStart").disabled=busy||!canTrade||active;
 $("lvStart").textContent=canTrade?"Start Live":"Start Live · Locked";
 $("lvStop").disabled=busy||!active;
 $("lvEmergency").disabled=busy||!(active||serverStatus?.pendingIntent);
 $("lvReconcile").disabled=busy||!loggedIn()||!serverStatus?.pendingIntent;
 $("lvFund").disabled=true; // Funding stays a manual Phantom transfer; do not auto-sign from the public website.
}
function drawScan(){
 $("lvScanStatus").textContent=!scan?"NOT CHECKED":
   scan.enabled===false?"OFFLINE":scan.lastError?"DATA UNAVAILABLE":"OBSERVING LIVE MARKETS";
 $("lvDiscovered").textContent=Number.isInteger(scan?.discovered)?String(scan.discovered):"—";
 $("lvQualified").textContent=Number.isInteger(scan?.marketQualified)?String(scan.marketQualified):"—";
 $("lvSafeCount").textContent=Number.isInteger(scan?.securityQualified)?String(scan.securityQualified):"—";
 $("lvScanTime").textContent=scan?.lastScanAt?
   "Latest observations: "+new Date(scan.lastScanAt).toLocaleString()+
    (scan.lastError?" · "+scan.lastError:"")+
    " · Live market research only; zero executable orders":
   "Live scanner status not available.";
 const body=$("lvScanRows");body.replaceChildren();
 for(const item of (scan?.candidates||[]).slice(0,10)){
  const row=document.createElement("tr");
  const cells=[
   item.symbol||item.mint?.slice(0,8)||"Unknown",
   Number.isFinite(item.priceUsd)?"$"+Number(item.priceUsd).toPrecision(7):"—",
   Number.isFinite(item.liquidityUsd)?"$"+Math.round(item.liquidityUsd).toLocaleString():"—",
   Number.isFinite(item.buyShare5m)?(item.buyShare5m*100).toFixed(1)+"%":"—",
   item.securityPass?"Report passed (not rug-proof)":"Not verified / risk",
   item.candleConfirmed?"Structure watch, no order":"No entry confirmation"
  ];
  for(const cell of cells){const td=document.createElement("td");td.textContent=cell;row.append(td);}
  body.append(row);
 }
}
function drawLedger(){
 const tbody=$("lvTrades");tbody.replaceChildren();
 const rows=ledger?.trades||[];
 $("lvNoTrades").hidden=rows.length>0;
 $("lvJournalStatus").textContent=ledger?
   ledger.entries+" finalized trades · "+ledger.buys+" buys · "+ledger.sells+
   " sells · wallet "+(ledger.walletConfigured?"configured":"not configured"):
   "Journal unavailable until owner login.";
 for(const x of rows){
  const tr=document.createElement("tr");
  const value=[
    x.blockTime?new Date(x.blockTime*1000).toISOString().replace("T"," ").slice(0,19):"—",
    x.side==="BUY"?"BUY · Entry":"SELL · Exit",
    shorten(x.mint),
    x.tokenQuantity,x.priceSolPerToken,(x.side==="BUY"?"−":"+")+x.effectiveSol,x.networkFeeSol
  ];
  for(const cell of value){
    const td=document.createElement("td");td.textContent=String(cell??"—");tr.append(td);
  }
  const sig=document.createElement("td");
  const a=document.createElement("a");
  a.href="https://solscan.io/tx/"+encodeURIComponent(x.signature);
  a.target="_blank";a.rel="noopener noreferrer";a.textContent="View "+shorten(x.signature);
  sig.append(a);tr.append(sig);tbody.append(tr);
 }
}
async function refreshAll(){
 if(!loggedIn())throw Error("Verify the Phantom owner signature again.");
 const [statusResult,balanceResult,tradeResult,scanResult,botBalanceResult]=await Promise.allSettled([
   api("/status"),api("/wallet/owner-sol-balance"),api("/live/trades"),api("/live/scans"),api("/wallet/bot-sol-balance")
 ]);
 if(statusResult.status!=="fulfilled")throw statusResult.reason;
 serverStatus=statusResult.value;
 if(serverStatus.liveTrading===true&&serverStatus.liveExecutorReady!==true)
   throw Error("Backend state inconsistent: real trading readiness unverified");
 if(balanceResult.status==="fulfilled"&&
    balanceResult.value.wallet===ownerAddress&&balanceResult.value.network==="solana-mainnet"&&
    Number.isFinite(Number(balanceResult.value.sol)))
    solBalance=Number(balanceResult.value.sol);
 else solBalance=null;
 botBalance=botBalanceResult.status==="fulfilled"&&botBalanceResult.value.wallet===serverStatus.privateBotWallet&&
  botBalanceResult.value.network==="solana-mainnet"&&Number.isFinite(Number(botBalanceResult.value.sol))?
  Number(botBalanceResult.value.sol):null;
 if(tradeResult.status==="fulfilled"&&tradeResult.value.mode==="LIVE_ONLY"&&
    typeof tradeResult.value.liveTrading==="boolean"&&Array.isArray(tradeResult.value.trades))
     ledger=tradeResult.value;
 else ledger=null;
 scan=scanResult.status==="fulfilled"&&scanResult.value.mode==="LIVE_MARKET_RESEARCH_ONLY"?scanResult.value:null;
 draw();drawLedger();drawScan();lastPoll=Date.now();
}
$("lvConnect").addEventListener("click",async()=>{
 if(busy)return;busy=true;draw();
 try{
  provider=client();
  if(!provider?.connect)throw Error("Phantom extension unavailable. Open Phantom in this browser.");
  const result=await provider.connect();
  const address=String(result?.publicKey||provider.publicKey||"");
  if(!validWallet(address))throw Error("Phantom did not provide a valid Solana wallet address");
  ownerAddress=address;token="";expiresAt=0;serverStatus=null;ledger=null;scan=null;solBalance=null;
  setMsg("Connected to Phantom "+address+". Click Verify owner to authenticate the private trading server. No money moved.");
 }catch(e){setMsg("Phantom connection failed: "+String(e.message).slice(0,190));}
 finally{busy=false;draw();}
});
$("lvVerify").addEventListener("click",async()=>{
 if(busy||!ownerAddress)return;busy=true;draw();
 try{
  provider=client();if(!provider?.signMessage)throw Error("Phantom message signing unavailable");
  const challenge=await api("/auth/challenge","POST",{address:ownerAddress},false);
  if(typeof challenge.message!=="string"||!challenge.message.startsWith("Crimson AutoTrader operator sign-in\n"))
    throw Error("Unexpected server challenge: signing refused");
  const sigResult=await provider.signMessage(new TextEncoder().encode(challenge.message),"utf8");
  const signature=toBase64(sigResult?.signature??sigResult);
  const verified=await api("/auth/verify","POST",
    {address:ownerAddress,message:challenge.message,signature},false);
  if(typeof verified.token!=="string"||verified.token.length<30)
    throw Error("Server did not verify owner token");
  token=verified.token;expiresAt=Date.now()+Number(verified.expiresInSeconds)*1000;
  serverStatus=verified;
  await refreshAll();
  setMsg(serverStatus.message||"Owner verified. Start Live remains locked until a safe signer is ready.");
 }catch(e){
  token="";expiresAt=0;serverStatus=null;ledger=null;scan=null;
  setMsg("Owner verification failed: "+String(e.message).slice(0,190));
 }finally{busy=false;draw();drawLedger();}
});
$("lvRefresh").addEventListener("click",async()=>{
 if(busy)return;busy=true;draw();
 try{await refreshAll();setMsg(serverStatus?.message||"Live status checked");}
 catch(e){setMsg("Status unavailable: "+e.message);}
 finally{busy=false;draw();}
});
$("lvScanRefresh").addEventListener("click",async()=>{
 if(busy||!loggedIn())return;busy=true;draw();
 try{
   const result=await api("/live/scans");
   if(result.mode!=="LIVE_MARKET_RESEARCH_ONLY")throw Error("Invalid scanner response");
   scan=result;drawScan();
   setMsg("Live market scanner status updated. No orders were placed.");
 }catch(e){scan=null;drawScan();setMsg("Scanner unavailable: "+e.message);}
 finally{busy=false;draw();}
});
$("lvJournalRefresh").addEventListener("click",async()=>{
 if(busy||!loggedIn())return;busy=true;draw();
 try{
  const result=await api("/live/trades");
  if(result.mode!=="LIVE_ONLY"||!Array.isArray(result.trades))throw Error("Invalid live ledger response");
  ledger=result;drawLedger();setMsg("Finalized on-chain trade journal refreshed.");
 }catch(e){setMsg("Trade journal unavailable: "+e.message);}
 finally{busy=false;draw();}
});
$("lvExport").addEventListener("click",async()=>{
 if(busy||!loggedIn())return;busy=true;draw();
 try{
  const response=await fetch(serverUrl+"/live/trades.csv",{
    headers:{Authorization:"Bearer "+token},cache:"no-store",credentials:"omit"
  });
  if(!response.ok)throw Error("Cannot export authenticated verified trades");
  const csv=await response.blob(),u=URL.createObjectURL(csv);
  const a=document.createElement("a");a.href=u;a.download="crimson-real-transactions.csv";a.click();
  setTimeout(()=>URL.revokeObjectURL(u),1000);
 }catch(e){setMsg("CSV export unsuccessful: "+e.message);}
 finally{busy=false;draw();}
});
$("lvCopy").addEventListener("click",async()=>{
 if(!ownerAddress)return;
 try{await navigator.clipboard.writeText(ownerAddress);setMsg("Phantom public wallet address copied. Never share a recovery phrase.");}
 catch(e){setMsg("Your PUBLIC Phantom address: "+ownerAddress);}
});
$("lvCopyBot").addEventListener("click",async()=>{
 const wallet=serverStatus?.privateBotWallet;
 if(!serverStatus?.walletReady||!validWallet(wallet))return;
 try{await navigator.clipboard.writeText(wallet);
   setMsg("Dedicated bot deposit address copied. Verify this address in your trusted wallet setup before sending funds.");}
 catch(e){setMsg("BOT PUBLIC DEPOSIT ADDRESS: "+wallet);}
});
$("lvReconcile").addEventListener("click",async()=>{
 if(busy||!loggedIn()||!serverStatus?.pendingIntent)return;
 busy=true;draw();
 try{const result=await api("/live/reconcile","POST",{});
   await refreshAll();setMsg(result.note||"Trade reconciled. Check live ledger before restarting.");}
 catch(e){setMsg("Pending trade remains locked: "+e.message);}
 finally{busy=false;draw();}
});
$("lvPreview").addEventListener("click",()=>{
 const raw=$("lvAllocate").value.trim(),amount=Number(raw);
 if(!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,9})?$/.test(raw)||
    !Number.isFinite(amount)||!(amount>0)||!Number.isFinite(solBalance)||
    amount>Math.max(0,solBalance-.02)){
  $("lvAllocation").textContent="Invalid allocation. Keep at least 0.02 SOL in Phantom for fees. This is a preview only.";
  return;
 }
 $("lvAllocation").textContent=
   "Preview: "+amount.toFixed(6)+" SOL from Phantom, leaving approx. "+
   (solBalance-amount).toFixed(6)+" SOL before fees. "+
   (serverStatus?.walletReady&&serverStatus?.recoveryVerified?
      "Use Copy bot deposit address, verify the destination independently, then use Phantom Send. No transfer is initiated here.":
      "Do NOT send until the dedicated wallet and its recovery are configured and verified.");
});
$("lvStart").addEventListener("click",async()=>{
 if(busy||!ready()||serverStatus?.liveTrading===true)return;
 if(!window.confirm("START REAL automated Solana trades with your dedicated bot wallet? These are irreversible and may lose the entire funded balance. Stops and exits are not guaranteed. Confirm to start."))return;
 busy=true;draw();
 try{
  const value=await api("/start","POST",{confirmed:true});
  serverStatus=value;draw();setMsg(value.liveTrading===true?"Backend reports real trading running":"Start refused; no live trading confirmed.");
 }catch(e){setMsg("Live trading NOT started: "+e.message);}
 finally{busy=false;draw();}
});
for(const [id,endpoint] of [["lvStop","/stop"],["lvEmergency","/emergency-stop"]]){
 $(id).addEventListener("click",async()=>{
  if(busy||serverStatus?.liveTrading!==true)return;
  busy=true;draw();
  try{
    const r=await api(endpoint,"POST",{});serverStatus={...serverStatus,...r};
    setMsg(r.message||"Backend acknowledged control request. Recheck positions.");
  }catch(e){setMsg("Could not confirm stop: "+e.message);}
  finally{busy=false;draw();}
 });
}
$("lvLogout").addEventListener("click",()=>{
 if(serverStatus?.liveTrading===true){
  setMsg("Stop live execution on the server before signing out. Disconnecting Phantom does not stop trades.");return;
 }
 reset("Disconnected from AutoTrader owner session. Phantom wallet funds untouched.");
});
const w=client();
if(w?.on){
 w.on("accountChanged",()=>reset("Phantom account changed. Reconnect and verify your owner wallet."));
 w.on("disconnect",()=>reset("Phantom disconnected. Sign in again to view live trades."));
}
setInterval(async()=>{
 if(document.hidden||busy||!loggedIn()||Date.now()-lastPoll<30000)return;
 busy=true;draw();
 try{await refreshAll();}catch(e){setMsg("Live data refresh unavailable: "+e.message);}
 finally{busy=false;draw();}
},35000);
draw();drawLedger();drawScan();
})();
