/* Crimson Phantom operator connection v0.1
 * Public frontend ONLY proves owner wallet control. No private keys, signer,
 * token approvals, or real transaction submission. Start is fail-closed until
 * the authenticated private backend advertises a verified live executor.
 */
(() => {
"use strict";
const $=id=>document.getElementById(id);
if($("ciPhantomLive"))return;
const parent=$("ciAutoTrader");if(!parent)return;
const css=document.createElement("style");
css.textContent=[
"#ciPhantomLive{background:#10172b;border:1px solid #5a4b75;border-radius:14px;padding:15px;margin:16px 0}",
"#ciPhantomLive .cl-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}",
"#ciPhantomLive .cl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:11px;margin:12px 0}",
"#ciPhantomLive .cl-card{background:#0a1225;border:1px solid #3a4763;border-radius:12px;padding:12px}",
"#ciPhantomLive .cl-value{font-size:15px;font-weight:800;word-break:break-word;margin-top:6px}",
"#ciPhantomLive .cl-warn{color:#ffbf92;font-size:12px;line-height:1.6}",
"#ciPhantomLive .cl-actions{display:flex;flex-wrap:wrap;gap:9px;margin:13px 0}",
"#ciPhantomLive .cl-actions button{padding:11px 13px}",
"#ciPhantomLive button:disabled{opacity:.45;cursor:not-allowed}",
"#ciPhantomLive .cl-status{background:#171d31;padding:11px;border-radius:10px;font-size:13px;line-height:1.6;white-space:pre-wrap}",
"#ciPhantomLive label{display:block;font-size:12px;color:#b9c6e3}",
"#ciPhantomLive input{margin-top:6px}",
"#ciPhantomLive .cl-off{color:#ff91a3}",
"#ciPhantomLive .cl-on{color:#86e9bb}"
].join("\n");document.head.append(css);
const box=document.createElement("section");box.id="ciPhantomLive";
box.innerHTML=[
'<div class="cl-header"><h3 style="margin:0">🔐 Phantom Owner Connection & Live Controls</h3>',
'<span id="clMode" class="cl-off">LIVE TRADING OFF</span></div>',
'<p class="cl-warn">Connecting Phantom proves ownership; it does NOT allow unattended trading from the Phantom extension. Full automation requires a separately funded bot wallet and a securely deployed executor. Never paste your recovery phrase or private key here.</p>',
'<div class="cl-grid">',
'<div class="cl-card"><div class="label">PHANTOM OWNER</div><div class="cl-value" id="clWallet">Not connected</div></div>',
'<div class="cl-card"><div class="label">PRIVATE TRADING SERVER</div><div class="cl-value" id="clBackend">Not connected</div></div>',
'<div class="cl-card"><div class="label">DEDICATED BOT WALLET</div><div class="cl-value" id="clBotWallet">Not configured</div></div>',
'<div class="cl-card"><div class="label">REAL EXECUTION</div><div class="cl-value cl-off" id="clExecution">NOT READY</div></div>',
'</div>',
'<label>Private operator server HTTPS URL (or localhost for development)',
'<input id="clServerUrl" type="url" spellcheck="false" placeholder="https://your-private-trading-api.example"></label>',
'<div class="cl-actions"><button id="clConnect" type="button">Connect Phantom</button>',
'<button id="clCopyAddress" type="button" disabled>Copy public address</button>',
'<button id="clAuthorize" type="button" disabled>Verify wallet ownership</button>',
'<button id="clCheck" type="button" disabled>Check backend</button></div>',
'<div class="cl-actions"><button id="clStart" type="button" disabled>Start Live · Locked</button>',
'<button id="clStop" type="button" disabled>Stop New Trades</button>',
'<button id="clEmergency" type="button" disabled>Emergency Stop</button>',
'<button id="clDisconnect" type="button">Disconnect</button></div>',
'<p id="clStatus" class="cl-status" role="status">Connect Phantom to begin private operator setup. No funds can move through this interface yet.</p>',
'<p class="cl-warn">Security: the owner public wallet must match the private server configuration. The service must verify a unique, expiring Phantom signature. “Start Live” becomes available only after the backend explicitly reports an installed and verified live executor and signer. All actual trades would occur server-side with hard spending limits and audit logs. The current repository does not include those live execution components.</p>'
].join("");
parent.append(box);
const OPERATOR_ORIGIN="https://crimson-operator-api-production.up.railway.app";
let provider=null,address="",token="",backend=null,base=OPERATOR_ORIGIN,busy=false,sessionExpires=0;
function truncate(x){return x?x.slice(0,6)+"…"+x.slice(-5):"—";}
function status(message){$("clStatus").textContent=message;}
function safeUrl(s){
 const u=new URL(s.trim());const host=u.hostname.toLowerCase();
 if(u.username||u.password||u.search||u.hash||u.pathname!=="/"&&u.pathname!=="")
   throw Error("Use only the server origin, without paths, credentials or query parameters.");
 if(u.protocol!=="https:"&&!(u.protocol==="http:"&&["127.0.0.1","localhost","[::1]"].includes(host)))
   throw Error("The trading API must use HTTPS, except localhost for development.");
 return u.origin;
}
function update(){
 $("clWallet").textContent=address?truncate(address):"Not connected";
 const authorized=!!token&&Date.now()<sessionExpires;
 $("clBackend").textContent=authorized?"OWNER VERIFIED":base?"NOT VERIFIED":"Not connected";
 $("clBotWallet").textContent=backend?.privateBotWallet?truncate(backend.privateBotWallet):"Not configured";
 const ready=authorized&&backend?.liveExecutorReady===true&&backend?.walletReady===true&&backend?.online===true;
 $("clExecution").textContent=ready?"BACKEND READY":"NOT READY";
 $("clExecution").className="cl-value "+(ready?"cl-on":"cl-off");
 $("clMode").textContent=backend?.liveTrading===true?"LIVE TRADING REPORTED ACTIVE":"LIVE TRADING OFF";
 $("clMode").className=backend?.liveTrading===true?"cl-on":"cl-off";
 $("clCopyAddress").disabled=busy||!address;
 $("clAuthorize").disabled=busy||!address||!base;
 $("clCheck").disabled=busy||!authorized;
 $("clConnect").disabled=busy;
 $("clStart").disabled=busy||!ready||backend?.liveTrading===true;
 $("clStart").textContent=ready?"Start Live":"Start Live · Locked";
 $("clStop").disabled=busy||!authorized||backend?.liveTrading!==true;
 $("clEmergency").disabled=busy||!authorized||backend?.liveTrading!==true;
}
async function request(path,method="GET",body=null,authenticated=false){
 if(!base)throw Error("Private server URL is missing.");
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);
 try{
   const res=await fetch(base+path,{
     method,headers:{"Content-Type":"application/json",
       ...(authenticated&&token?{"Authorization":"Bearer "+token}:{})},
     body:body===null?undefined:JSON.stringify(body),
     signal:ctl.signal,cache:"no-store",credentials:"omit"
   });
   let data={};try{data=await res.json()}catch(e){}
   if(!res.ok)throw Error(data.error||"Operator server HTTP "+res.status);
   return data;
 }finally{clearTimeout(timer);}
}
function findPhantom(){return window.phantom?.solana||window.solana?.isPhantom&&window.solana||null;}
function base64(bytes){
 const v=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes?.signature||bytes||[]);
 let s="";for(const n of v)s+=String.fromCharCode(n);
 return btoa(s);
}
$("clServerUrl").addEventListener("change",()=>{
 try{base=safeUrl($("clServerUrl").value);token="";sessionExpires=0;backend=null;status("Server address set. Verify Phantom ownership to authenticate.");}
 catch(e){base="";token="";backend=null;status("Server URL error: "+e.message);}
 update();
});
$("clConnect").addEventListener("click",async()=>{
 if(busy)return;busy=true;update();
 try{
   provider=findPhantom();
   if(!provider?.connect)throw Error("Phantom extension not detected. Install/open Phantom in this browser.");
   const result=await provider.connect();
   address=String(result?.publicKey||provider.publicKey||"");
   if(!address)throw Error("No public address returned.");
   backend=null;token="";sessionExpires=0;
   status("Phantom connected: "+address+". This connection does not authorize automatic spending.");
 }catch(e){status("Phantom connection unsuccessful: "+String(e.message));}
 finally{busy=false;update();}
});
$("clCopyAddress").addEventListener("click",async()=>{
 if(!address)return;
 try{
  await navigator.clipboard.writeText(address);
  status("Public Phantom address copied. This address is safe to share for configuring your owner-only bot access. Never share your recovery phrase.");
 }catch(e){status("Clipboard unavailable. Your PUBLIC wallet address is: "+address);}
});
$("clAuthorize").addEventListener("click",async()=>{
 if(busy||!address||!base)return;busy=true;update();
 try{
   provider=findPhantom();
   if(!provider?.signMessage)throw Error("Phantom message signing is unavailable in this browser.");
   const challenge=await request("/auth/challenge","POST",{address},false);
   if(typeof challenge.message!=="string"||!challenge.message.includes("Crimson AutoTrader operator sign-in"))
     throw Error("Unexpected owner challenge.");
   const bytes=new TextEncoder().encode(challenge.message);
   const signed=await provider.signMessage(bytes,"utf8");
   const signature=base64(signed?.signature??signed);
   const verified=await request("/auth/verify","POST",{address,message:challenge.message,signature},false);
   if(typeof verified.token!=="string"||verified.token.length<30)throw Error("Invalid server session token");
   token=verified.token;sessionExpires=Date.now()+(Math.max(0,Number(verified.expiresInSeconds)||0)*1000);
   backend=verified;
   status("Wallet ownership verified. "+(verified.message||"Live trading is not configured."));
 }catch(e){token="";backend=null;sessionExpires=0;status("Authentication unsuccessful: "+String(e.message));}
 finally{busy=false;update();}
});
$("clCheck").addEventListener("click",async()=>{
 if(busy)return;busy=true;update();
 try{backend=await request("/status","GET",null,true);status(backend.message||"Status received.");}
 catch(e){backend=null;status("Backend check failed: "+String(e.message));}
 finally{busy=false;update();}
});
$("clStart").addEventListener("click",async()=>{
 if(busy||backend?.liveExecutorReady!==true||backend?.walletReady!==true)return;
 if(!window.confirm("Start REAL trading with the funded dedicated bot wallet and the backend's fixed risk limits? This can lose money."))return;
 busy=true;update();
 try{
   backend=await request("/start","POST",{confirmed:true},true);
   status(backend.liveTrading===true?"Backend reports LIVE trading active. Monitor positions and order confirmations.":"Start was NOT activated; backend has not confirmed live execution.");
 }catch(e){status("No real trading activated: "+e.message);}
 finally{busy=false;update();}
});
for(const [id,route] of [["clStop","/stop"],["clEmergency","/emergency-stop"]]){
 $(id).addEventListener("click",async()=>{
   if(busy)return;busy=true;update();
   try{backend=await request(route,"POST",{},true);status(backend.message||"Control acknowledged. Confirm backend position state.");}
   catch(e){status("Unable to confirm control on backend: "+e.message);}
   finally{busy=false;update();}
 });
}
$("clDisconnect").addEventListener("click",()=>{
 // Disconnecting only ends frontend authentication; it cannot revoke a
 // server signer or stop an independently running trading bot.
 if(backend?.liveTrading===true){
   status("Stop real trading on the server BEFORE disconnecting. Closing Phantom alone does not stop the bot.");
   return;
 }
 token="";sessionExpires=0;backend=null;address="";provider=null;
 status("Owner session cleared. No bot wallet was connected or granted spending authority.");
 update();
});
$("clServerUrl").value=OPERATOR_ORIGIN;
provider=findPhantom();update();
})();