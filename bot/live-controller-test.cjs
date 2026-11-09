"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {LiveController,loadState,b58,persist}=require("./live-controller.cjs");
async function run(){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),"crimson-live-control-test-"));
 try{
  const env={BOT_DATA_DIR:directory,BOT_OWNER_PUBLIC_KEY:"3".repeat(44),
   BOT_DEDICATED_WALLET_ADDRESS:"4".repeat(44),
   BOT_MAX_TRADE_SOL:"0.005",BOT_MAX_DAILY_SPEND_SOL:"0.02",
   BOT_MAX_DAILY_LOSS_SOL:"0.01",BOT_MAX_OPEN_LIVE:"1",
   BOT_MAX_DAILY_LIVE_BUYS:"2"};
  const scanner={status:()=>({candidates:[]})};
  const control=new LiveController({env,scanner,log:()=>{}});
  assert.equal(control.status().liveTrading,false);
  assert.equal(control.status().liveExecutorReady,false);
  const funding=control.fundingStatus();
  assert.equal(funding.mode,"FUNDING_CHECK_ONLY");
  assert.equal(funding.readyToFund,false,"Public deposit address cannot authorize a deposit");
  assert.equal(funding.checks.address,true);
  assert.equal(funding.checks.signer,false);
  assert(funding.blockedBy.includes("Dedicated wallet signing custody not connected"));
  assert(funding.blockedBy.includes("Independent encrypted wallet backup and recovery not verified"));
  assert(funding.neverFundsAutomatically);

  assert.throws(()=>control.start(),/Cannot start live/);
  assert.equal(control.stop().liveTrading,false);
  const empty=await control.portfolio();
  assert.equal(empty.mode,"LIVE_ONLY");
  assert.equal(empty.positions.length,0);
  assert.equal(empty.liveTrading,false);
  // A user's Stop must prevent submission even if a quote resolves afterward.
  let finishQuote,submissions=0;
  control.order=()=>new Promise(resolve=>{finishQuote=resolve;});
  control.executeSigned=async()=>{submissions++;return {status:"Success"};};
  control.running=true;
  const attempted=control.swap({mint:"4".repeat(44),side:"BUY",raw:"5000000",
   plan:{entryReference:1,stop:0.99,tp1:1.01,tp2:1.02,tp3:1.03}});
  control.stop();
  finishQuote({});
  await assert.rejects(attempted,/stopped before transaction signing/);
  assert.equal(submissions,0,"Stop must prevent a spend");
  assert.equal(control.state.pending,null,"Pre-submission intent must be safely cleared");
  const file=path.join(directory,"live-controller-v1.json");
  const state=loadState(file);
  assert.equal(state.pending,null);
  state.pending={id:"test-pending",signature:"test-no-chain"};
  persist(file,state);
  const restarted=new LiveController({env,scanner,log:()=>{}});
  const result=restarted.status();
  assert.equal(result.pendingIntent,true);
  const pendingView=await restarted.portfolio();
  assert.equal(pendingView.pending.id,"test-pending");
  assert.equal(pendingView.positions.length,0);
  assert.equal(pendingView.counters.spentSol,0);
  assert(result.missing.includes("Unresolved on-chain trade intent"));
  assert.throws(()=>restarted.start(),/Cannot start live/);
  assert.equal(b58(Buffer.alloc(32)), "1".repeat(32));
  assert.equal(restarted.stop().liveTrading,false);
  console.log("PASS live controller: opt-in lock, conservative limits, durable pending intent, idempotency stop");
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
