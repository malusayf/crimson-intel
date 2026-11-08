"use strict";
/* Crimson Railway runner — PRIVATE OPERATOR API + AUTONOMOUS PAPER ENGINE.
 * No signing keys, no wallet approvals, no on-chain transactions.
 * Single Node process, one replica, persistent /data, single paper writer.
 */
const fs=require("node:fs");
const path=require("node:path"),os=require("node:os");
const {server}=require("./operator-server.cjs");
const {CrimsonPaperEngine}=require("./engine.cjs");
const {PublicSolanaFeeds}=require("./providers.cjs");
const dataDir=path.resolve(process.env.BOT_DATA_DIR||"");
if(process.env.BOT_AUTORUN_PAPER!=="true")throw Error("Explicit BOT_AUTORUN_PAPER=true required");
if(!process.env.BOT_DATA_DIR||dataDir==="/"||dataDir===path.resolve(__dirname))
 throw Error("Set a dedicated persistent BOT_DATA_DIR; never store journal inside the app image");
fs.mkdirSync(dataDir,{recursive:true,mode:0o700});
const stateFile=path.join(dataDir,"paper.json");
const lockFile=path.join(dataDir,"paper-writer.lock");
function numeric(k,fallback){
 const raw=process.env[k],v=raw===undefined||raw===""?fallback:Number(raw);
 if(!Number.isFinite(v))throw Error("Invalid "+k);
 return v;
}
const config={
 initialCashUsd:numeric("BOT_PAPER_START_USD",1000),
 maxOpenPositions:numeric("BOT_MAX_OPEN",2),
 maxRiskPerTradeFraction:numeric("BOT_RISK_PER_TRADE",.005),
 maxDailyLossFraction:numeric("BOT_MAX_DAILY_LOSS",.03),
 maxTotalDrawdownFraction:numeric("BOT_MAX_DRAWDOWN",.10),
 maxDailyEntries:numeric("BOT_MAX_DAILY_BUYS",5),
 maxPositionEquityFraction:numeric("BOT_MAX_POSITION_PCT",.05),
 maxTradeUsd:numeric("BOT_MAX_TRADE_USD",100),
 modeledFeeUsd:numeric("BOT_PAPER_FEE_USD",.10),
 maxSlippageFraction:numeric("BOT_PAPER_SLIPPAGE",.005),
 scanEveryMs:numeric("BOT_SCAN_SECONDS",180)*1000
};
const poll=numeric("BOT_POLL_SECONDS",25);
if(poll<10||poll>3600)throw Error("Unsafe paper monitor interval");
const store={
 async load(){
  try{return JSON.parse(fs.readFileSync(stateFile,"utf8"))}
  catch(e){if(e.code==="ENOENT")return null;throw e}
 },
 async save(s){
  const tmp=stateFile+".tmp-"+process.pid;
  const fd=fs.openSync(tmp,"w",0o600);
  try{
    fs.writeFileSync(fd,JSON.stringify(s,null,2)+"\n");
    fs.fsyncSync(fd);
  }finally{fs.closeSync(fd)}
  fs.renameSync(tmp,stateFile);
 }
};
function flags(){return {pause:fs.existsSync(path.join(dataDir,"PAUSE")),
 kill:fs.existsSync(path.join(dataDir,"KILL"))};}
const engine=new CrimsonPaperEngine({
 feeds:new PublicSolanaFeeds(),store,config,getFlags:flags,
 log:ev=>console.log("[PAPER]",ev.type,ev.message,
   ev.mint?String(ev.mint).slice(0,8)+"…":"")
});
function writerLock(){
 // Single replica and zero deploy overlap are mandatory at Railway level.
 // Different containers have different hostnames; a lock from the old
 // deployment must not prevent recovery on a redeploy or fast crash restart.
 const hostname=os.hostname();
 if(fs.existsSync(lockFile)){
  let prior;
  try{prior=JSON.parse(fs.readFileSync(lockFile,"utf8"));}
  catch(e){throw Error("Paper lock file corrupt; manual inspection required.");}
  if(prior.hostname===hostname&&prior.pid!==process.pid){
   try{
    process.kill(prior.pid,0);
    throw Error("Paper writer already running in this container; refusing duplicate process.");
   }catch(e){
    if(String(e.message).includes("refusing duplicate")||e.code==="EPERM")throw e;
    if(e.code!=="ESRCH")throw e;
   }
  }
  console.warn("[PAPER] Recovering writer lock from previous container/restart");
 }
 fs.writeFileSync(lockFile,JSON.stringify({pid:process.pid,hostname,at:Date.now()}),
  {mode:0o600});
}
function refreshLock(){
 fs.writeFileSync(lockFile,JSON.stringify({pid:process.pid,hostname:os.hostname(),at:Date.now()}),
  {mode:0o600});
}
let stopped=false,timer=null;
async function tick(){
 if(stopped)return;
 try{
  refreshLock();
  await engine.cycle();
  const s=engine.publicStatus();
  console.log("[PAPER] cycle="+s.cycles+
   " scans="+s.scans+" positions="+s.openPositions+
   " equity="+s.equityUsd+" live=false");
 }catch(e){console.error("[PAPER] cycle failed:",String(e?.message||e).slice(0,250))}
}
async function main(){
 writerLock();
 const bind=process.env.BOT_API_BIND||(process.env.PORT?"0.0.0.0":"127.0.0.1");
 const port=Number(process.env.PORT||process.env.BOT_API_PORT||8788);
 await new Promise((resolve,reject)=>{
  server.once("error",reject);
  server.listen(port,bind,resolve);
 });
 console.log("[CRIMSON] Operator API listening on "+bind+":"+port+
  "; autonomous PAPER ONLY; no signer/executor.");
 await tick();
 timer=setInterval(tick,poll*1000);
}
function shutdown(){
 stopped=true;if(timer)clearInterval(timer);
 try{fs.unlinkSync(lockFile)}catch(e){}
 server.close(()=>process.exit(0));
}
process.once("SIGTERM",shutdown);
process.once("SIGINT",shutdown);
main().catch(e=>{console.error("[CRIMSON] startup failed:",e.stack||e);process.exitCode=1;});
