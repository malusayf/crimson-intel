"use strict";
/* Operator API test: Node 20+, no wallet/private funds. */
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const http=require("node:http");
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
   const noSession=await req("/status");assert.equal(noSession.status,401);
   const noPaperSession=await req("/paper/status");assert.equal(noPaperSession.status,401);
   const noPaperControl=await req("/paper/pause","POST",{});assert.equal(noPaperControl.status,401);
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
   assert.equal(verified.data.walletReady,false);
   const paper=await req("/paper/status","GET",null,ownerSession);
   assert.equal(paper.status,200);
   assert.equal(paper.data.mode,"PAPER_ONLY");
   assert.equal(paper.data.liveTrading,false);
   if(process.env.BOT_AUTORUN_PAPER!=="true"){
     const notConfigured=await req("/paper/pause","POST",{},ownerSession);
     assert.equal(notConfigured.status,503,"Paper controls must refuse action without deployed runner");
   }
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
   console.log("PASS operator: owner Ed25519 login, nonce replay refusal, SOL balance owner-only, start blocked, hostile origin rejected");
 }finally{globalThis.fetch=actualFetch;await new Promise(resolve=>server.close(resolve));}
}
test().catch(e=>{console.error(e);process.exitCode=1});
