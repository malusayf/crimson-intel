"use strict";
/* Operator API test: Node 20+, no wallet/private funds. */
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const http=require("node:http");
const {server,fromBase58,capability}=require("./operator-server.cjs");
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
 assert.deepEqual(fromBase58(address),raw);
 assert.equal(capability().liveTrading,false);
 assert.equal(capability().liveExecutorReady,false);
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
   // The owner must be configured for challenges. No owner = fail-closed.
   if(!process.env.BOT_OWNER_PUBLIC_KEY){
     const challenge=await req("/auth/challenge","POST",{address});
     assert.equal(challenge.status,503);
   }
   const noSession=await req("/status");assert.equal(noSession.status,401);
   const noStart=await req("/start","POST",{});assert.equal(noStart.status,401);
   const wrongOrigin=await fetch("http://127.0.0.1:"+port+"/status",{
     headers:{Origin:"https://attacker.example"}});
   assert.equal(wrongOrigin.status,403);
   console.log("PASS operator: Ed25519 pubkey decode, health, no-owner refusal, unauthenticated start blocked, origin denied");
 }finally{await new Promise(resolve=>server.close(resolve));}
}
test().catch(e=>{console.error(e);process.exitCode=1});
