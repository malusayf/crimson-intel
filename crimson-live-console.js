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
'<div class="lv-warning" id="lvHeadline">The Railway scanner observes real Solana markets. Real trading is disabled until secure wallet signing and risk checks are verified.</div>',
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
'<button id="lvNotify" type="button" disabled>Enable real-trade notifications</button>',
'<button id="lvCopy" type="button" disabled>Copy Phantom address</button>',
'<button id="lvCopyBot" type="button" disabled>Copy bot deposit address</button>',
'<button id="lvLogout" type="button">Disconnect</button>',
'</div>',
'<div class="lv-section"><h3>Live Trading Controls</h3>',
'<div class="lv-actions"><button id="lvStart" type="button" disabled>Start Live · Locked</button>',
'<button id="lvStop" type="button" disabled>Stop new trades</button>',
'<button id="lvEmergency" type="button" disabled>Emergency halt</button>',
'<button id="lvReconcile" type="button" disabled>Reconcile pending trade</button></div>',
'<p id="lvStatus" class="lv-info" role="status">Connect Phantom and verify your wallet ownership to inspect the private server.</p>',
'<h4>Start Live requirements</h4><ul class="lv-sub" id="lvRequirements"><li>Verify Phantom owner to load missing requirements.</li></ul></div>',
'<div class="lv-section"><h3>Fund Bot · Simple Setup</h3>',
'<p class="lv-sub">This guided screen confirms signer, recovery, provider and pilot safety before permitting you to copy a deposit address. No secrets or wallet passwords go into this website.</p>',
'<p class="lv-info" id="lvFundingStatus">Connect Phantom to check deposit safety.</p>',
'<ul class="lv-sub" id="lvFundingChecks"><li>Owner verification required.</li></ul>',
'<p class="lv-sub">PUBLIC bot wallet address: <strong id="lvDepositAddress">Not verified</strong></p>',
'<p class="lv-sub">Choose an allocation from your existing SOL. The selected amount is only a preview; no funding or transaction authorization occurs here.</p>',
'<div class="lv-amount"><label>Proposed amount (SOL)<input type="number" id="lvAllocate" min="0" step="0.000001" placeholder="0.1"></label>',
'<button id="lvPreview" type="button" disabled>Preview allocation</button>',
'</div>',
'<label class="lv-sub" style="display:block;margin:12px 0"><input id="lvConfirmDeposit" type="checkbox" style="width:auto;margin-right:7px">I backed up and independently tested recovery of this exact dedicated wallet and checked its address.</label>',
'<p class="lv-sub" id="lvAllocation">Funding locked until the dedicated wallet can securely sign and recover funds.</p>',
'<p class="lv-warning">A Phantom transfer is irreversible. This website cannot debit your Phantom wallet. After funding is unlocked, use Phantom Send, review the destination and amount, and keep an SOL fee reserve. Live trading must be separately authorized.</p></div>',
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
'<div class="lv-section"><h3>Real Wallet Positions and Daily Limits</h3>',
'<p class="lv-sub">Actual recorded positions with read-only Solana balance checks and DEX price observations. These prices are not executable sell quotes.</p>',
'<div class="lv-grid"><div class="lv-tile"><div class="lv-kicker">OPEN POSITIONS</div><b id="lvPositionsCount">—</b></div>',
'<div class="lv-tile"><div class="lv-kicker">SOL SPENT TODAY</div><b id="lvDailySpent">—</b></div>',
'<div class="lv-tile"><div class="lv-kicker">REALIZED SOL LOSS TODAY</div><b id="lvDailyLoss">—</b></div></div>',
'<p class="lv-info" id="lvPending">No pending transaction.</p>',
'<div class="lv-table-wrap"><table class="lv-table"><thead><tr>',
'<th>Token</th><th>Recorded quantity</th><th>Observed entry USD</th><th>Observed current USD</th><th>Stop USD</th><th>TP1 / TP2 / TP3 USD</th><th>Chain check</th>',
'</tr></thead><tbody id="lvPositions"></tbody></table></div></div>',
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
  solBalance=null,botBalance=null,ledger=null,scan=null,portfolio=null,funding=null,busy=false,lastPoll=0,
  notifyEnabled=false,seenSignatures=null;
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
  token="";expiresAt=0;ownerAddress="";serverStatus=null;ledger=null;portfolio=null;funding=null;seenSignatures=null;solBalance=null;botBalance=null;scan=null;provider=null;
   $("lvConfirmDeposit").checked=false;
  $("lvAllocation").textContent="Funding authorization reset; no funds moved.";
  setMsg(reason||"Disconnected. No live trading authorization.");
  draw();drawLedger();drawScan();drawPortfolio();
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
 const fundReady=loggedIn()&&funding?.readyToFund===true&&
   validWallet(funding.wallet)&&funding.wallet===serverStatus?.privateBotWallet;
 const active=serverStatus?.liveTrading===true;
 const pending=serverStatus?.pendingIntent===true;
 $("lvHeadline").textContent=active?
  "LIVE REAL-MONEY TRADING: the server can submit irreversible swaps. Closing your browser does not stop it. A restart, loss of liquidity or API outage may leave open positions requiring manual action.":
  "Railway is monitoring real markets. No trades are currently being placed. The required setup steps are listed below.";
 const list=$("lvRequirements");list.replaceChildren();
 if(!loggedIn()){
   const li=document.createElement("li");li.textContent="Connect Phantom and verify owner to see launch requirements.";list.append(li);
 }else if(Array.isArray(serverStatus?.missing)&&serverStatus.missing.length){
   for(const missing of serverStatus.missing){const li=document.createElement("li");li.textContent=missing;list.append(li);}
 }else{
   const li=document.createElement("li");li.textContent="Backend configuration gates satisfied. Real-money risk and independent execution tests still apply.";list.append(li);
 }
 $("lvExecutor").textContent=canTrade?"VERIFIED READY":"NOT READY";
 $("lvExecutor").className=canTrade?"lv-on":"lv-off";
 $("lvMode").textContent=active?"LIVE RUNNING":"LIVE DISABLED";
 $("lvMode").className="lv-badge "+(active?"lv-on":"lv-off");
 $("lvCount").textContent=ledger?String(ledger.entries):"—";
 $("lvConnect").disabled=busy;
 $("lvVerify").disabled=busy||!validWallet(ownerAddress);
 $("lvRefresh").disabled=busy||!loggedIn();
 $("lvNotify").disabled=busy||!loggedIn()||!("Notification" in window);
 $("lvNotify").textContent=notifyEnabled?"Disable real-trade notifications":"Enable real-trade notifications";
 $("lvJournalRefresh").disabled=busy||!loggedIn();
 $("lvScanRefresh").disabled=busy||!loggedIn();
 $("lvCopy").disabled=busy||!validWallet(ownerAddress);
 $("lvCopyBot").disabled=busy||!fundReady||!$("lvConfirmDeposit").checked;
 $("lvDepositAddress").textContent=loggedIn()&&validWallet(serverStatus?.privateBotWallet)?
   serverStatus.privateBotWallet:"Verify owner to view public bot wallet address";
 $("lvFundingStatus").textContent=!loggedIn()?"Connect and verify Phantom to check readiness.":
   fundReady?"Funding checks passed. Independently review your backup, destination, and transfer amount.":
   "FUNDING LOCKED — the bot wallet is not yet safely configured to receive SOL.";
 const checks=$("lvFundingChecks");checks.replaceChildren();
 if(funding?.mode==="FUNDING_CHECK_ONLY"&&loggedIn()){
   for(const [label,passed] of [
     ["Dedicated wallet address saved",funding.checks?.address],
     ["Signer matched to wallet address",funding.checks?.signer],
     ["Recovery and backup verified",funding.checks?.recovery],
     ["Jupiter and Solana RPC configured",funding.checks?.provider],
     ["Real-money pilot safety review approved",funding.checks?.pilotApproved]
   ]){const li=document.createElement("li");li.textContent=(passed?"✓ ":"✕ ")+label;checks.append(li);}
   const listed=new Set([
     "Dedicated wallet signing custody not connected",
     "Independent encrypted wallet backup and recovery not verified",
     "Jupiter swap execution provider not configured",
     "Private Solana RPC not configured",
     "Small real-money pilot and signing/exit safety review not approved"
   ]);
   for(const blocker of funding.blockedBy||[])if(!listed.has(blocker)){
     const li=document.createElement("li");li.textContent="✕ "+blocker;checks.append(li);
   }
 }else{const li=document.createElement("li");li.textContent="Verify Phantom to see funding checks.";checks.append(li);}
 $("lvPreview").disabled=busy||!loggedIn()||!Number.isFinite(solBalance);
 $("lvExport").disabled=busy||!loggedIn()||!(ledger?.entries>0);
 $("lvStart").disabled=busy||!canTrade||active;
 $("lvStart").textContent=canTrade?"Start Live":"Start Live · Locked";
 $("lvStop").disabled=busy||!active;
 $("lvEmergency").disabled=busy||!(active||serverStatus?.pendingIntent);
 $("lvReconcile").disabled=busy||!loggedIn()||!serverStatus?.pendingIntent;
 // Funding stays a manual Phantom transfer. No browser signing of automatic orders.
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
    (serverStatus?.liveTrading?" · Live worker active; scanner observations are not executed orders":" · Monitoring only; no trades being sent"):
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
function checkTradeAlerts(){
 if(!ledger?.trades||!Array.isArray(ledger.trades))return;
 const next=new Set(ledger.trades.map(x=>x.signature));
 if(seenSignatures!==null&&notifyEnabled&&window.Notification?.permission==="granted"){
  for(const x of ledger.trades.filter(x=>!seenSignatures.has(x.signature)).slice(0,4)){
   try{const n=new Notification("Crimson LIVE — "+x.side+" finalized",{
    body:shorten(x.mint)+" · "+x.tokenQuantity+" tokens · "+x.effectiveSol+" SOL · confirmed on Solana",
    tag:"crimson-finalized-"+x.signature
   });n.onclick=()=>{window.focus();n.close();};}
   catch(err){setMsg("Browser notification unavailable; see the verified trade journal below.");}
  }
 }
 seenSignatures=next;
}
function drawPortfolio(){
 const info=portfolio,tbody=$("lvPositions");tbody.replaceChildren();
 $("lvPositionsCount").textContent=info?String(info.positions.length):"—";
 $("lvDailySpent").textContent=info?info.counters.spentSol+" / "+info.counters.spendingLimitSol+" SOL":"—";
 $("lvDailyLoss").textContent=info?info.counters.realizedLossSol+" / "+info.counters.lossLimitSol+" SOL":"—";
 const pendingBox=$("lvPending");pendingBox.replaceChildren();
 if(info?.pending){
  pendingBox.append(document.createTextNode("PENDING "+info.pending.side+" — uncertain on-chain status, no new trades permitted. "));
  if(info.pending.signature){
   const a=document.createElement("a");a.href="https://solscan.io/tx/"+encodeURIComponent(info.pending.signature);
   a.textContent="View pending transaction";a.target="_blank";a.rel="noopener noreferrer";
   pendingBox.append(a);
  }
 }else pendingBox.textContent="No pending live order; a swap must be finalized before it appears in the trade journal.";
 if(!info?.positions?.length){
  const row=document.createElement("tr"),cell=document.createElement("td");
  cell.colSpan=7;cell.textContent=info?"No finalized open positions.":"Verify owner to view positions.";
  row.append(cell);tbody.append(row);return;
 }
 const price=x=>x==null||!Number.isFinite(Number(x))?"—":"$"+Number(x).toPrecision(6);
 for(const position of info.positions){
  const tr=document.createElement("tr");
  const qty=Number(position.rawRemaining)/Math.pow(10,position.decimals);
  const values=[shorten(position.mint),Number.isFinite(qty)?qty.toLocaleString("en-US",{maximumFractionDigits:8}):"—",
   price(position.entryObservedUsd),price(position.currentObservedUsd),price(position.stopUsd),
   [position.tp1Usd,position.tp2Usd,position.tp3Usd].map(price).join(" / "),
   position.warning||(position.onchainRaw!==null?"Recorded balance queried on-chain":"Chain balance unavailable")];
  for(const value of values){const td=document.createElement("td");td.textContent=value;tr.append(td);}
  tbody.append(tr);
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
 const [statusResult,balanceResult,tradeResult,scanResult,botBalanceResult,portfolioResult,fundingResult]=await Promise.allSettled([
   api("/status"),api("/wallet/owner-sol-balance"),api("/live/trades"),api("/live/scans"),api("/wallet/bot-sol-balance"),api("/live/portfolio"),api("/funding/readiness")
 ]);
 if(statusResult.status!=="fulfilled")throw statusResult.reason;
 serverStatus=statusResult.value;
 funding=fundingResult.status==="fulfilled"&&
   fundingResult.value.mode==="FUNDING_CHECK_ONLY"&&
   fundingResult.value.network==="solana-mainnet"&&
   fundingResult.value.wallet===serverStatus.privateBotWallet&&
   typeof fundingResult.value.readyToFund==="boolean"?
   fundingResult.value:null;
 if(serverStatus.liveTrading===true&&!serverStatus.privateBotWallet)
   throw Error("Live backend reports no dedicated wallet; investigate before continuing");
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
 portfolio=portfolioResult.status==="fulfilled"&&portfolioResult.value.mode==="LIVE_ONLY"&&Array.isArray(portfolioResult.value.positions)?portfolioResult.value:null;
 checkTradeAlerts();draw();drawLedger();drawScan();drawPortfolio();lastPoll=Date.now();
}
$("lvConnect").addEventListener("click",async()=>{
 if(busy)return;busy=true;draw();
 try{
  provider=client();
  if(!provider?.connect)throw Error("Phantom extension unavailable. Open Phantom in this browser.");
  const result=await provider.connect();
  const address=String(result?.publicKey||provider.publicKey||"");
  if(!validWallet(address))throw Error("Phantom did not provide a valid Solana wallet address");
  ownerAddress=address;token="";expiresAt=0;serverStatus=null;ledger=null;scan=null;portfolio=null;funding=null;seenSignatures=null;notifyEnabled=false;solBalance=null;botBalance=null;
   $("lvConfirmDeposit").checked=false;
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
$("lvNotify").addEventListener("click",async()=>{
 if(!loggedIn()||!("Notification" in window))return;
 try{
  if(notifyEnabled){notifyEnabled=false;setMsg("Browser real-trade notifications disabled.");}
  else{
   const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();
   notifyEnabled=permission==="granted";
   setMsg(notifyEnabled?
    "Browser notifications enabled for new finalized buys and sells while this page is open.":
    "Notifications were not approved. You can still view all finalized transactions in the journal.");
  }
 }catch(e){setMsg("Notifications unsupported or blocked in this browser.");}
 finally{draw();}
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
 if(!loggedIn()||funding?.readyToFund!==true||funding.wallet!==wallet||
   !validWallet(wallet)||!$("lvConfirmDeposit").checked){
   setMsg("Funding locked. Complete the recovery, signer and pilot reviews before transferring SOL.");
   return;
 }
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
$("lvConfirmDeposit").addEventListener("change",draw);
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
   (funding?.readyToFund===true?
      "After reviewing the recovery acknowledgement, copy the address and use Phantom Send. No automatic transfer occurs here.":
      "DO NOT SEND. Funding is locked; this is a preview only.");
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
 if(busy||!loggedIn()||Date.now()-lastPoll<30000)return;
 busy=true;draw();
 try{await refreshAll();}catch(e){setMsg("Live data refresh unavailable: "+e.message);}
 finally{busy=false;draw();}
},35000);
draw();drawLedger();drawScan();drawPortfolio();
})();
