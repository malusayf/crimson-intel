"use strict";
/* Crimson PRIVATE operator gateway v0.1.
 * Phantom proves the ONLY authorized owner via Ed25519 message signature.
 * Dedicated bot signer (never Phantom) is loaded only after explicit private
 * configuration. No live funds move until owner-authenticated Start and all
 * backend risk gates pass. Never expose raw localhost HTTP publicly.
 */
const http=require("node:http"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path");
const {JupiterQuotePreview}=require("./jupiter-quote.cjs");
const {LiveTradeJournal}=require("./live-journal.cjs");
const {LiveScanner}=require("./live-scanner.cjs");
const {LiveController}=require("./live-controller.cjs");
const {RobinhoodMarket}=require("./robinhood-market.cjs");
const {URL}=require("node:url");
const B58="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const origin=(process.env.BOT_FRONTEND_ORIGIN||"https://malusayf.github.io").replace(/\/$/,"");
const owner=(process.env.BOT_OWNER_PUBLIC_KEY||"").trim();
const host=process.env.BOT_API_BIND||(process.env.PORT?"0.0.0.0":"127.0.0.1");
const port=Number(process.env.PORT||process.env.BOT_API_PORT||8788);
const managedAddress=process.env.BOT_DEDICATED_WALLET_ADDRESS||"";
if(!/^https:\/\//.test(origin)||!Number.isInteger(port)||port<1024||port>65535)
 throw Error("Configure valid BOT_FRONTEND_ORIGIN and BOT_API_PORT");
if(host!=="127.0.0.1"&&host!=="::1"&&process.env.BOT_BEHIND_TLS_PROXY!=="true"&&!process.env.RAILWAY_PUBLIC_DOMAIN)
 throw Error("Non-local binding requires a verified HTTPS reverse proxy");
function fromBase58(s){
 if(typeof s!=="string"||s.length<32||s.length>44)throw Error("Invalid key");
 let v=0n;
 for(const c of s){const i=B58.indexOf(c);if(i<0)throw Error("Invalid key");v=v*58n+BigInt(i);}
 const bytes=[];
 while(v>0n){bytes.unshift(Number(v%256n));v/=256n;}
 for(const c of s){if(c==="1")bytes.unshift(0);else break;}
 const out=Buffer.from(bytes);
 if(out.length!==32)throw Error("Incorrect key size");
 return out;
}
function bytesB64(s){
 if(typeof s!=="string"||s.length>200||!/^[A-Za-z0-9+/]+={0,2}$/.test(s))throw Error("Malformed signature");
 const b=Buffer.from(s,"base64");
 if(b.length!==64||b.toString("base64")!==s)throw Error("Signature must contain 64 bytes");
 return b;
}
if(owner)fromBase58(owner);
if(managedAddress)fromBase58(managedAddress);
const challenges=new Map(),sessions=new Map(),attempts=new Map();
const ownerBalanceCache={value:null,expires:0};
const solanaRpcUrl=process.env.SOLANA_RPC_URL||"https://api.mainnet-beta.solana.com";
async function ownerSolBalance(){
 if(!owner)throw Error("Owner public key is not configured");
 if(ownerBalanceCache.value&&Date.now()<ownerBalanceCache.expires)
   return {...ownerBalanceCache.value,cacheAgeMs:Date.now()-(ownerBalanceCache.value.checkedAtMs||Date.now())};
 const control=new AbortController(),timer=setTimeout(()=>control.abort(),10000);
 try{
   const response=await fetch(solanaRpcUrl,{
     method:"POST",signal:control.signal,cache:"no-store",
     headers:{"Content-Type":"application/json"},
     body:JSON.stringify({jsonrpc:"2.0",id:"crimson-owner-sol",
       method:"getBalance",params:[owner,{commitment:"confirmed"}]})
   });
   if(!response.ok)throw Error("RPC request failed");
   const rpc=await response.json();
   const lamports=rpc?.result?.value;
   if(rpc.error||!Number.isSafeInteger(lamports)||lamports<0)
     throw Error("RPC returned an unavailable or unsafe balance");
   const value={
     network:"solana-mainnet",wallet:owner,
     lamports:String(lamports),sol:lamports/1000000000,
     source:"Solana getBalance (confirmed commitment)",
     contextSlot:Number.isSafeInteger(rpc?.result?.context?.slot)?rpc.result.context.slot:null,
     checkedAt:new Date().toISOString(),checkedAtMs:Date.now()
   };
   ownerBalanceCache.value=value;
   ownerBalanceCache.expires=Date.now()+25000;
   return {...value,cacheAgeMs:0};
 }finally{clearTimeout(timer);}
}
const MAX_BODY=8192;
// Live transaction journal stays on persistent storage, separate from archived simulations.
const liveJournal=new LiveTradeJournal({directory:process.env.BOT_DATA_DIR,
  wallet:managedAddress||undefined});
const marketScanner=process.env.BOT_LIVE_SCANNER_ENABLED==="true"?
  new LiveScanner({intervalMs:180000,log:msg=>console.log("[CRIMSON LIVE SCAN]",msg)}):null;
const liveController=new LiveController({scanner:marketScanner,journal:liveJournal,
  log:msg=>console.log(msg)});
const robinhoodMarket=new RobinhoodMarket();
function setSecurityHeaders(res){
 res.setHeader("cache-control","no-store");
 res.setHeader("x-content-type-options","nosniff");
 res.setHeader("referrer-policy","no-referrer");
 res.setHeader("content-security-policy","default-src 'none'");
}
function send(res,status,object){
 setSecurityHeaders(res);
 res.writeHead(status,{"content-type":"application/json; charset=utf-8"});
 res.end(JSON.stringify(object));
}
function allowOrigin(req,res){
 const got=req.headers.origin;
 if(got!==origin)return false;
 res.setHeader("access-control-allow-origin",origin);
 res.setHeader("access-control-allow-methods","GET, POST, OPTIONS");
 res.setHeader("access-control-allow-headers","Authorization, Content-Type");
 res.setHeader("vary","Origin");
 return true;
}
function rateLimit(req,category="generic"){
 const key=(req.socket.remoteAddress||"unknown")+":"+category;
 const now=Date.now(),r=attempts.get(key)||{since:now,count:0};
 if(now-r.since>60000){r.since=now;r.count=0;}
 r.count++;attempts.set(key,r);
 if(attempts.size>1000)for(const [k,v] of attempts)if(now-v.since>60000)attempts.delete(k);
 return r.count<=(category==="auth"?10:75);
}
async function json(req){
 const parts=[];let size=0;
 for await(const part of req){
   size+=part.length;if(size>MAX_BODY)throw Error("Request too large");
   parts.push(part);
 }
 const text=Buffer.concat(parts).toString("utf8");
 const obj=JSON.parse(text||"{}");
 if(!obj||typeof obj!=="object"||Array.isArray(obj))throw Error("Expected JSON object");
 return obj;
}
function prune(){
 const now=Date.now();
 for(const [k,v] of challenges)if(v.expires<now)challenges.delete(k);
 for(const [k,v] of sessions)if(v.expires<now)sessions.delete(k);
}
function auth(req){
 const header=req.headers.authorization||"";
 const token=header.startsWith("Bearer ")?header.slice(7):"";
 const data=sessions.get(token);
 if(!data||data.expires<Date.now())return false;
 return data.address===owner;
}
function capability(){
 const live=liveController.status();
 return {
  online:true,network:"solana-mainnet",walletConnection:"Phantom owner authentication",
  liveOnly:true,simulationDisabled:true,tradeJournalReady:!!process.env.BOT_DATA_DIR,
  liveMarketScannerConfigured:!!marketScanner,
  ...live,
  state:live.liveTrading?"LIVE_RUNNING":live.liveExecutorReady?"READY_FOR_OWNER_START":"NOT_CONFIGURED",
  limitations:[
    "Dedicated signer must be distinct from Phantom; no seed phrase belongs in the browser or ChatGPT.",
    "Automated trading uses a conservative pullback proxy, not the manual 0ABC model.",
    "Losses and failed exits can occur even with risk controls; unresolved swaps freeze new orders."
  ]
 };
}

const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url||"/","http://localhost");
  if(url.pathname==="/health"&&req.method==="GET"){
    return send(res,200,{online:true,mode:liveController.running?"LIVE_RUNNING":"CONTROL_PLANE",liveTrading:liveController.running,ownerConfigured:!!owner,signerReady:liveController.status().liveExecutorReady});
  }
  if(!allowOrigin(req,res))return send(res,403,{error:"Origin not allowed"});
  if(req.method==="OPTIONS"){res.writeHead(204);res.end();return;}
  if(!rateLimit(req,req.url.startsWith("/auth")?"auth":"generic"))
    return send(res,429,{error:"Rate limit reached"});
  prune();
  // Public read-only market observations: no account login or wallet access required.
  // Every upstream URL is fixed server-side; these endpoints can NEVER submit an order.
  if(req.method==="GET"&&url.pathname==="/robinhood/pools"){
   const view=url.searchParams.get("view")||"trending";
   if(!["trending","new"].includes(view))
     return send(res,400,{error:"Invalid Robinhood pool view"});
   try{return send(res,200,await robinhoodMarket.pools(view));}
   catch(e){return send(res,503,{error:"Robinhood Chain DEX feed unavailable. No prices inferred."});}
  }
  if(req.method==="GET"&&url.pathname==="/robinhood/stocks"){
   const q=url.searchParams.get("q")||"";
   if(q.length>60)return send(res,400,{error:"Search is too long"});
   try{return send(res,200,await robinhoodMarket.stocks(q));}
   catch(e){return send(res,503,{error:"Official Robinhood Stock Token registry unavailable."});}
  }
  if(req.method==="GET"&&url.pathname==="/robinhood/stock-quote"){
   const symbol=url.searchParams.get("symbol")||"";
   if(!/^[A-Za-z0-9.^_-]{1,20}$/.test(symbol))
     return send(res,400,{error:"Valid ticker required"});
   try{return send(res,200,await robinhoodMarket.quote(symbol));}
   catch(e){return send(res,503,{error:"Official Robinhood Stock Token quote unavailable."});}
  }
  if(req.method==="GET"&&url.pathname==="/robinhood/pool"){
   const address=url.searchParams.get("address")||"";
   if(!/^0x[a-fA-F0-9]{40}$/.test(address))
     return send(res,400,{error:"Valid Robinhood Chain pool address required"});
   try{return send(res,200,await robinhoodMarket.pool(address));}
   catch(e){return send(res,503,{error:"Robinhood Chain pool detail unavailable."});}
  }
  if(url.pathname==="/auth/challenge"&&req.method==="POST"){
    if(!owner)return send(res,503,{error:"Owner public key has not been configured"});
    const body=await json(req);
    if(body.address!==owner)return send(res,403,{error:"Not the authorized operator"});
    if(challenges.size>64)return send(res,429,{error:"Too many outstanding challenges"});
    const nonce=crypto.randomBytes(24).toString("hex"),now=Date.now(),expires=now+120000;
    const message=[
      "Crimson AutoTrader operator sign-in",
      "Site: "+origin,
      "Wallet: "+owner,
      "Nonce: "+nonce,
      "Issued: "+new Date(now).toISOString(),
      "Expires: "+new Date(expires).toISOString(),
      "This signature only proves wallet ownership; it does NOT authorize spending or grant token allowances."
    ].join("\n");
    challenges.set(owner,{message,expires});
    return send(res,200,{message,expiresAt:new Date(expires).toISOString()});
  }
  if(url.pathname==="/auth/verify"&&req.method==="POST"){
    if(!owner)return send(res,503,{error:"Owner public key not configured"});
    const body=await json(req),pending=challenges.get(owner);
    challenges.delete(owner); // One-time nonce, even on a failed attempt.
    if(!pending||pending.expires<Date.now()||
       body.address!==owner||body.message!==pending.message)
       return send(res,401,{error:"Expired or invalid challenge"});
    const raw=fromBase58(owner);
    const spki=Buffer.concat([Buffer.from("302a300506032b6570032100","hex"),raw]);
    const key=crypto.createPublicKey({key:spki,format:"der",type:"spki"});
    const signature=bytesB64(body.signature);
    if(!crypto.verify(null,Buffer.from(pending.message,"utf8"),key,signature))
      return send(res,401,{error:"Signature verification failed"});
    const token=crypto.randomBytes(32).toString("base64url");
    sessions.set(token,{address:owner,expires:Date.now()+4*60*60*1000});
    return send(res,200,{token,expiresInSeconds:14400,...capability()});
  }
  if(!auth(req))return send(res,401,{error:"Owner authentication required"});
  if(url.pathname==="/status"&&req.method==="GET")return send(res,200,capability());
  if(url.pathname==="/live/scans"&&req.method==="GET"){
    return send(res,200,marketScanner?marketScanner.status():{
      mode:"LIVE_MARKET_RESEARCH_ONLY",enabled:false,scanning:false,
      actualOrders:0,liveExecutionReady:false,everExecutedRealTrade:false,
      candidates:[],note:"Live scanner is not enabled on this server."});
  }
  if(url.pathname==="/live/portfolio"&&req.method==="GET"){
    try{return send(res,200,await liveController.portfolio());}
    catch(e){return send(res,503,{error:"Verified portfolio status unavailable; refusing to invent balances."});}
  }
  if(url.pathname==="/live/trades"&&req.method==="GET"){
    try{
      return send(res,200,{...liveJournal.summary(),
        executionReady:liveController.status().liveExecutorReady,liveTrading:liveController.running,
        explanation:"Every recorded trade requires a finalized on-chain receipt; an unresolved order blocks additional execution."});
    }catch(e){return send(res,503,{error:"Verified live trade journal unavailable; no trades were fabricated."});}
  }
  if(url.pathname==="/live/trades.csv"&&req.method==="GET"){
    try{
      const report=liveJournal.summary();
      const fields=["blockTime","side","mint","tokenQuantity","effectiveSol",
        "priceSolPerToken","networkFeeSol","signature","confirmation"];
      const esc=x=>'"'+String(x??"").replace(/"/g,'""').replace(/^[=+@-]/,"'$&")+'"';
      const rows=[fields.map(esc).join(","),
        ...report.trades.map(t=>fields.map(k=>esc(t[k])).join(","))];
      setSecurityHeaders(res);
      res.writeHead(200,{"content-type":"text/csv; charset=utf-8",
        "content-disposition":"attachment; filename=crimson-real-transactions.csv"});
      res.end(rows.join("\r\n")+"\r\n");
      return;
    }catch(e){return send(res,503,{error:"Verified live trade CSV unavailable"});}
  }
  if(url.pathname==="/wallet/bot-sol-balance"&&req.method==="GET"){
    const status=liveController.status();
    if(!status.privateBotWallet)return send(res,503,{error:"Dedicated bot wallet has not been configured"});
    try{const lamports=await liveController.solBalance();
      return send(res,200,{wallet:status.privateBotWallet,network:"solana-mainnet",
        lamports:String(lamports),sol:Number(lamports)/1000000000,
        note:"Read-only confirmed bot-wallet balance; does not authorize spending"});
    }catch(e){return send(res,503,{error:"Dedicated bot wallet balance unavailable"});}
  }
  if(url.pathname==="/wallet/owner-sol-balance"&&req.method==="GET"){
    // READ ONLY. Fetch only configured, signed-in owner wallet. No arbitrary
    // address lookup, funding transfer, secret access or transaction execution.
    if(!owner)return send(res,503,{error:"Wallet owner not configured"});
    try{
      const wallet=await ownerSolBalance();
      return send(res,200,wallet);
    }catch(e){
      return send(res,503,{error:"Solana balance unavailable; check private RPC service. No funds moved."});
    }
  }
  if(url.pathname==="/quote-preview"&&req.method==="POST"){
    // Owner-authenticated quote preview ONLY: no taker, signing or execution.
    // Never expose JUPITER_API_KEY or provider errors to the public browser.
    const body=await json(req);
    if(!body||Object.keys(body).some(k=>!["inputMint","outputMint","amount"].includes(k)))
      return send(res,400,{error:"Invalid quote request fields"});
    try{
      const quote=await new JupiterQuotePreview().preview(body);
      return send(res,200,quote);
    }catch(e){
      return send(res,422,{error:"Jupiter quote unavailable or invalid; no trade executed"});
    }
  }
  if(url.pathname==="/start"&&req.method==="POST"){
    const body=await json(req);
    if(body.confirmed!==true||Object.keys(body).some(k=>k!=="confirmed"))
      return send(res,400,{error:"Explicit live-funds confirmation required."});
    try{liveController.start();return send(res,200,capability());}
    catch(e){return send(res,409,{error:String(e.message||e).slice(0,240),...capability()});}
  }
  if((url.pathname==="/stop"||url.pathname==="/emergency-stop")&&req.method==="POST"){
    liveController.stop();
    return send(res,200,{...capability(),stopped:true,
      message:"Live worker stopped. No additional orders are initiated, but an in-flight transaction might still finalize. Existing positions remain in the bot wallet; automated exits are also stopped."});
  }
  if(url.pathname==="/live/reconcile"&&req.method==="POST"){
    const result=await liveController.reconcile();
    return send(res,result.resolved?200:409,{...result,...capability()});
  }
  if(url.pathname==="/auth/logout"&&req.method==="POST"){
    const token=(req.headers.authorization||"").slice(7);sessions.delete(token);
    return send(res,200,{signedOut:true});
  }
  return send(res,404,{error:"Unknown endpoint"});
 }catch(e){
  return send(res,400,{error:String(e.message||"Request failed").slice(0,160)});
 }
});
if(require.main===module){
 server.listen(port,host,()=>{
  process.stdout.write("[Crimson operator] Listening on "+host+":"+port+
   "; Start Live guarded by private readiness and owner authorization; permitted origin "+origin+"\n");
  if(marketScanner)marketScanner.start();
 });
}
module.exports={server,fromBase58,capability};
