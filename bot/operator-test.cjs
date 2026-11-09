"use strict";
/* Operator API test: Node 20+, no wallet/private funds. */
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const http=require("node:http");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
// Generate a throwaway test wallet before module load; never use real wallet keys.
let server,fromBase58,capability;
const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function toBase58(bytes){
 let z=0n;for(const b of bytes)z=z*256n+BigInt(b);
 let out="";while(z>0n){out=alphabet[Number(z%58n)]+out;z/=58n;}
 for(const b of bytes){if(b!==0)break;out="1"+out;}
 return out;
}
async function test(){
 // Never allow a deployment test to access a production signer, live wallet, or journal.
 const testDir=fs.mkdtempSync(path.join(os.tmpdir(),"crimson-operator-http-"));
 for(const name of ["BOT_SIGNER_SEED_BASE64","BOT_DEDICATED_WALLET_ADDRESS",
  "JUPITER_API_KEY","SOLANA_RPC_URL"])delete process.env[name];
 process.env.BOT_DATA_DIR=testDir;
 process.env.BOT_LIVE_EXECUTION_ENABLED="false";
 process.env.BOT_LIVE_PILOT_APPROVED="false";
 process.env.BOT_RECOVERY_VERIFIED="false";
 process.env.BOT_LIVE_SCANNER_ENABLED="false";
 const pair=crypto.generateKeyPairSync("ed25519");
 const raw=pair.publicKey.export({type:"spki",format:"der"}).subarray(-32);
 const address=toBase58(raw);
 process.env.BOT_OWNER_PUBLIC_KEY=address;
 ({server,fromBase58,capability}=require("./operator-server.cjs"));
 assert.deepEqual(fromBase58(address),raw);
 assert.equal(capability().liveTrading,false);
 assert.equal(capability().liveExecutorReady,false);
 const actualFetch=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{
   if(String(url).startsWith("https://api.mainnet-beta.solana.com")){
     const reqBody=JSON.parse(opts.body);
     assert.equal(reqBody.method,"getBalance");
     assert.equal(reqBody.params[0],address);
     return {ok:true,json:async()=>({jsonrpc:"2.0",id:"crimson-owner-sol",
       result:{context:{slot:123456},value:2250000000}})};
   }
   return actualFetch(url,opts);
 };
 const port=await new Promise((resolve,reject)=>{
   server.once("error",reject);server.listen(0,"127.0.0.1",()=>resolve(server.address().port));
 });
 async function req(route,method="GET",body=null,token=""){
   const res=await fetch("http://127.0.0.1:"+port+route,{
     method,headers:{Origin:process.env.BOT_FRONTEND_ORIGIN||"https://malusayf.github.io",
       ...(body?{"Content-Type":"application/json"}:{}),
       ...(token?{Authorization:"Bearer "+token}:{})},
     body:body?JSON.stringify(body):undefined
   });
   return {status:res.status,data:await res.json()};
 }
 try{
   const health=await req("/health");assert.equal(health.status,200);
   assert.equal(health.data.liveTrading,false);
   const unauthorized=await req("/auth/challenge","POST",{address:"So11111111111111111111111111111111111111112"});
   assert.equal(unauthorized.status,403);
   const publicBadView=await req("/robinhood/pools?view=invalid");assert.equal(publicBadView.status,400);
   const publicBadTicker=await req("/robinhood/stock-quote?symbol=x%2Fy");assert.equal(publicBadTicker.status,400);
   const publicBadPool=await req("/robinhood/pool?address=http://evil.example");assert.equal(publicBadPool.status,400);
   const publicBadToken=await req("/robinhood/token?address=javascript:unsafe");assert.equal(publicBadToken.status,400);
   const noSession=await req("/status");assert.equal(noSession.status,401);
   const noPortfolio=await req("/live/portfolio");assert.equal(noPortfolio.status,401,"Portfolio requires owner authentication");
   const noFunding=await req("/funding/readiness");
   assert.equal(noFunding.status,401,"Funding readiness should not reveal owner wallet to the public");
   const noJournalSession=await req("/live/trades");assert.equal(noJournalSession.status,401);
   const noJournalCsv=await req("/live/trades.csv");assert.equal(noJournalCsv.status,401);
   const noStart=await req("/start","POST",{});assert.equal(noStart.status,401);
   const challenge=await req("/auth/challenge","POST",{address});
   assert.equal(challenge.status,200);
   assert(challenge.data.message.includes(address));
   const signature=crypto.sign(null,Buffer.from(challenge.data.message,"utf8"),pair.privateKey).toString("base64");
   const good=await req("/auth/verify","POST",{address,message:challenge.data.message,signature});
   assert.equal(good.status,200);
   assert.equal(good.data.liveExecutorReady,false);
   const ownerSession=good.data.token;
   const cannotSpend=await req("/start","POST",{confirmed:true},ownerSession);
   assert.equal(cannotSpend.status,409);
   assert.equal(cannotSpend.data.liveTrading,false);
   const replay=await req("/auth/verify","POST",{address,message:challenge.data.message,signature});
   assert.equal(replay.status,401);
   const verified=await req("/status","GET",null,ownerSession);
   assert.equal(verified.status,200);
   const funding=await req("/funding/readiness","GET",null,ownerSession);
   assert.equal(funding.status,200);
   assert.equal(funding.data.mode,"FUNDING_CHECK_ONLY");
   assert.equal(funding.data.readyToFund,false);
   assert.equal(funding.data.checks.signer,false);
   assert.equal(funding.data.neverFundsAutomatically,true);
   assert.equal(verified.data.walletReady,false);
   const portfolio=await req("/live/portfolio","GET",null,ownerSession);
   assert.equal(portfolio.status,200);
   assert.equal(portfolio.data.mode,"LIVE_ONLY");
   assert.equal(portfolio.data.liveTrading,false);
   assert.deepEqual(portfolio.data.positions,[]);
   assert.equal(portfolio.data.pending,null);
   const liveTrades=await req("/live/trades","GET",null,ownerSession);
   assert.equal(liveTrades.status,200);
   assert.equal(liveTrades.data.mode,"LIVE_ONLY");
   assert.equal(liveTrades.data.entries,0);
   assert.equal(liveTrades.data.liveTrading,false);
   const legacyPaper=await req("/paper/status","GET",null,ownerSession);
   assert.equal(legacyPaper.status,404,"Paper API must be removed");
   const legacyCommand=await req("/paper/pause","POST",{},ownerSession);
   assert.equal(legacyCommand.status,404,"Paper commands must no longer exist");
   const csv=await fetch("http://127.0.0.1:"+port+"/live/trades.csv",{
     headers:{Origin:process.env.BOT_FRONTEND_ORIGIN||"https://malusayf.github.io",
       Authorization:"Bearer "+ownerSession}
   });
   assert.equal(csv.status,200);
   assert((await csv.text()).includes("priceSolPerToken"));
   const publicBalance=await req("/wallet/owner-sol-balance");
   assert.equal(publicBalance.status,401,"unsigned account cannot view balance");
   const solBalance=await req("/wallet/owner-sol-balance","GET",null,ownerSession);
   assert.equal(solBalance.status,200);
   assert.equal(solBalance.data.wallet,address);
   assert.equal(solBalance.data.lamports,"2250000000");
   assert.equal(solBalance.data.sol,2.25);
   assert.equal(solBalance.data.network,"solana-mainnet");
   const wrongOrigin=await fetch("http://127.0.0.1:"+port+"/status",{
     headers:{Origin:"https://attacker.example"}});
   assert.equal(wrongOrigin.status,403);
   console.log("PASS operator: signed owner login, live-only journal and CSV owner auth, paper APIs removed, live start locked, hostile origin blocked");
 }finally{globalThis.fetch=actualFetch;await new Promise(resolve=>server.close(resolve));
   fs.rmSync(testDir,{recursive:true,force:true});}
}
test().catch(e=>{console.error(e);process.exitCode=1});
