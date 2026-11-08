"use strict";
/* Crimson autonomous PAPER trader runner. Node 20+, zero wallet keys/orders. */
const fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const {CrimsonPaperEngine}=require("./engine.cjs");
const {PublicSolanaFeeds}=require("./providers.cjs");
const cmd=String(process.argv[2]||"help").toLowerCase();
const dir=path.resolve(process.env.BOT_DATA_DIR||path.join(__dirname,".data"));
const statePath=path.join(dir,"paper.json"),pauseFile=path.join(dir,"PAUSE"),
killFile=path.join(dir,"KILL"),lockFile=path.join(dir,"runner.pid");
fs.mkdirSync(dir,{recursive:true,mode:0o700});
function flags(){return {pause:fs.existsSync(pauseFile),kill:fs.existsSync(killFile)};}
function flag(file,on){
 if(on)fs.writeFileSync(file,new Date().toISOString()+"\n",{mode:0o600});
 else try{fs.unlinkSync(file)}catch(e){if(e.code!=="ENOENT")throw e;}
}
function val(key,def){
 const v=process.env[key];if(v==null||v==="")return def;
 const x=Number(v);if(!Number.isFinite(x))throw Error("Invalid "+key);
 return x;
}
const config={
 initialCashUsd:val("BOT_PAPER_START_USD",1000),
 maxOpenPositions:val("BOT_MAX_OPEN",2),
 maxRiskPerTradeFraction:val("BOT_RISK_PER_TRADE",.005),
 maxDailyLossFraction:val("BOT_MAX_DAILY_LOSS",.03),
 maxTotalDrawdownFraction:val("BOT_MAX_DRAWDOWN",.10),
 maxDailyEntries:val("BOT_MAX_DAILY_BUYS",5),
 maxPositionEquityFraction:val("BOT_MAX_POSITION_PCT",.05),
 maxTradeUsd:val("BOT_MAX_TRADE_USD",100),
 modeledFeeUsd:val("BOT_PAPER_FEE_USD",.10),
 maxSlippageFraction:val("BOT_PAPER_SLIPPAGE",.005),
 scanEveryMs:val("BOT_SCAN_SECONDS",180)*1000
};
const store={
 load(){try{return JSON.parse(fs.readFileSync(statePath,"utf8"))}catch(e){if(e.code==="ENOENT")return null;throw e;}},
 save(s){const tmp=statePath+".tmp-"+process.pid;
  fs.writeFileSync(tmp,JSON.stringify(s,null,2)+"\n",{mode:0o600});fs.renameSync(tmp,statePath);}
};
const info=s=>process.stdout.write("[Crimson PAPER] "+s+"\n");
const engine=new CrimsonPaperEngine({feeds:new PublicSolanaFeeds(),store,config,getFlags:flags,
 log:e=>info(e.type+" "+e.message)});
function status(){
 const s=store.load();if(!s){info("No paper state. Run: node bot/main.cjs once");return;}
 const equity=s.cash+s.positions.reduce((sum,p)=>sum+p.qty*(p.lastMark||p.fillPrice),0);
 process.stdout.write(JSON.stringify({mode:"PAPER_ONLY",liveTrading:false,cashUsd:s.cash,
 equityUsd:equity,positions:s.positions.length,tradeRecords:s.trades.length,
 flags:flags(),lastTickAt:s.lastTickAt?new Date(s.lastTickAt).toISOString():null,
 lastError:s.lastError,recentEvents:s.events.slice(-5)},null,2)+"\n");
}
function lock(){
 try{fs.writeFileSync(lockFile,String(process.pid),{flag:"wx",mode:0o600});return}
 catch(e){if(e.code!=="EEXIST")throw e;}
 const old=Number(fs.readFileSync(lockFile,"utf8"));
 try{process.kill(old,0);throw Error("Runner already active: PID "+old)}
 catch(e){
  if(e.message?.includes("already active")||e.code==="EPERM")throw e;
  if(e.code!=="ESRCH")throw e;
 }
 fs.unlinkSync(lockFile);
 fs.writeFileSync(lockFile,String(process.pid),{flag:"wx",mode:0o600});
}
function unlock(){try{if(Number(fs.readFileSync(lockFile,"utf8"))===process.pid)fs.unlinkSync(lockFile)}catch(e){}}
function dashboard(){
 return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<meta http-equiv="refresh" content="15"><title>Crimson Paper Bot</title>'+
 '<style>body{font:15px system-ui;background:#0b1021;color:#e9edfb;max-width:980px;margin:auto;padding:22px}'+
 'pre{background:#171d35;border:1px solid #36415d;border-radius:12px;padding:16px;white-space:pre-wrap;overflow-wrap:anywhere}'+
 'h1{color:#fa73a1}p{color:#becae0}</style>'+
 '<h1>⚔ Crimson AutoTrader</h1><p>Autonomous PAPER MODE. No wallet connected or real trades.</p>'+
 '<pre id="result">Loading...</pre>'+
 '<script>fetch("/status").then(r=>r.json()).then(x=>document.getElementById("result").textContent=JSON.stringify(x,null,2))'+
 '.catch(()=>document.getElementById("result").textContent="Status unavailable");</script></html>';
}
async function main(){
 if(cmd==="pause"){flag(pauseFile,true);info("New modeled buys paused. Existing modeled exits can continue.");return;}
 if(cmd==="resume"){flag(pauseFile,false);info("PAUSE cleared; KILL unchanged. PAPER ONLY.");return;}
 if(cmd==="kill"){flag(killFile,true);info("KILL active; all modeled orders blocked, including exits.");return;}
 if(cmd==="clear-kill"){flag(killFile,false);info("KILL cleared; PAPER ONLY.");return;}
 if(cmd==="status"){status();return;}
 if(!["run","once"].includes(cmd)){process.stdout.write(
 "Crimson AutoTrader · PAPER ONLY\nCommands: node bot/main.cjs run | once | status | pause | resume | kill | clear-kill\n");return;}
 lock();process.once("exit",unlock);
 process.once("SIGINT",()=>{unlock();process.exit(0)});
 process.once("SIGTERM",()=>{unlock();process.exit(0)});
 if(cmd==="once"){
  try{const s=await engine.cycle();info("Cycle done. Paper equity "+engine.equity().toFixed(2)+"; positions "+s.positions.length);}
  finally{unlock();}
  return;
 }
 const port=val("BOT_STATUS_PORT",8787);
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error("Invalid BOT_STATUS_PORT");
 http.createServer((req,res)=>{
  res.setHeader("cache-control","no-store");res.setHeader("x-content-type-options","nosniff");
  res.setHeader("content-security-policy","default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'");
  if(req.method!=="GET"||!["/","/status","/health"].includes(req.url)){
   res.writeHead(404,{"content-type":"text/plain"});res.end("Not found");return;
  }
  if(req.url==="/health"){
   res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify({mode:"PAPER_ONLY",liveTrading:false,running:true}));return;
  }
  if(req.url==="/status"){
   res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify(engine.publicStatus(),null,2));return;
  }
  res.writeHead(200,{"content-type":"text/html;charset=utf-8"});res.end(dashboard());
 }).listen(port,"127.0.0.1",()=>info("Local dashboard http://127.0.0.1:"+port+" · PAPER ONLY"));
 const tick=async()=>{try{const s=await engine.cycle();info("cycle="+s.cycleCount+" equity="+engine.equity().toFixed(2)+" open="+s.positions.length);}
 catch(e){info("Cycle error: "+String(e.message).slice(0,180));}};
 await tick();
 const poll=val("BOT_POLL_SECONDS",25);
 if(poll<10||poll>3600)throw Error("BOT_POLL_SECONDS must be 10–3600");
 setInterval(tick,poll*1000);
}
main().catch(e=>{process.stderr.write("Crimson error: "+e.stack+"\n");process.exitCode=1});
