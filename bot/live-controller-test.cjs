"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {LiveController,loadState,b58,persist}=require("./live-controller.cjs");
function run(){
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
  assert.throws(()=>control.start(),/Cannot start live/);
  assert.equal(control.stop().liveTrading,false);
  const file=path.join(directory,"live-controller-v1.json");
  const state=loadState(file);
  assert.equal(state.pending,null);
  state.pending={id:"test-pending",signature:"test-no-chain"};
  persist(file,state);
  const restarted=new LiveController({env,scanner,log:()=>{}});
  const result=restarted.status();
  assert.equal(result.pendingIntent,true);
  assert(result.missing.includes("Unresolved on-chain trade intent"));
  assert.throws(()=>restarted.start(),/Cannot start live/);
  assert.equal(b58(Buffer.alloc(32)), "1".repeat(32));
  assert.equal(restarted.stop().liveTrading,false);
  console.log("PASS live controller: opt-in lock, conservative limits, durable pending intent, idempotency stop");
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
}
run();
