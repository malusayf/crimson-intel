"use strict";
/* Crimson LIVE ONLY executor. No paper trading, no public arbitrary-order endpoint.
 * Starts only with a distinct, limited-funds signer and explicit enablement.
 * Journaled pending intents are never retried as fresh orders.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Risk=require('./risk-engine.cjs');
const {PublicSolanaFeeds}=require('./providers.cjs');
const {LiveTradeJournal}=require('./live-journal.cjs');
const SOL='So11111111111111111111111111111111111111112';
const ABC='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(bytes){let n=0n;for(const b of bytes)n=n*256n+BigInt(b);let s='';while(n>0n){s=ABC[Number(n%58n)]+s;n/=58n;}for(const b of bytes){if(b!==0)break;s='1'+s;}return s;}
function amount(x){return typeof x==='string'&&/^[1-9][0-9]*$/.test(x)&&BigInt(x)<=(2n**64n-1n);}
function atomicSol(n){if(!(n>0&&Number.isSafeInteger(Math.round(n*1e9))))throw Error('Invalid SOL amount');return BigInt(Math.round(n*1e9));}
function atomicRaw(x){if(!/^(0|[1-9]\d*)$/.test(String(x)))throw Error('Invalid integer amount');return BigInt(x);}
function persist(file,obj){
 fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
 const tmp=file+'.tmp-'+process.pid+'-'+crypto.randomBytes(4).toString('hex');
 const fd=fs.openSync(tmp,'wx',0o600);
 try{fs.writeFileSync(fd,JSON.stringify(obj,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 fs.renameSync(tmp,file);
 try{const d=fs.openSync(path.dirname(file),'r');try{fs.fsyncSync(d);}finally{fs.closeSync(d);}}catch(e){if(process.platform!=='win32')throw e;}
}
function loadState(file){
 try{const stat=fs.statSync(file);if(stat.size>2e6)throw Error('State exceeds safety limit');
  const s=JSON.parse(fs.readFileSync(file,'utf8'));
  if(s.version!==1||!s.positions||!Array.isArray(s.positions)||!('pending' in s))throw Error('Unknown state version');
  return s;
 }catch(e){if(e.code==='ENOENT')return {version:1,positions:[],pending:null,day:'',dailyBuys:0,dailySpent:'0',dailyLoss:'0',lastError:''};throw e;}
}
class LiveController{
 constructor({env=process.env,scanner=null,journal=null,feeds=new PublicSolanaFeeds(),fetchFn=globalThis.fetch,log=console.log}={}){
  this.env=env;this.scanner=scanner;this.feeds=feeds;this.fetchFn=fetchFn;this.log=log;
  this.directory=env.BOT_DATA_DIR||'';
  this.file=this.directory?path.join(this.directory,'live-controller-v1.json'):'';
  this.journal=journal||new LiveTradeJournal({directory:this.directory,wallet:env.BOT_DEDICATED_WALLET_ADDRESS});
  this.running=false;this.busy=false;this.timer=null;this.signer=null;
  this.state=null;
  this.lastTickAt=null;
  this.lastError='';
 }
 requirements(){
  const e=this.env,missing=[];
  const expected=e.BOT_DEDICATED_WALLET_ADDRESS||'';
  if(e.BOT_LIVE_EXECUTION_ENABLED!=='true')missing.push('BOT_LIVE_EXECUTION_ENABLED');
  if(e.BOT_RECOVERY_VERIFIED!=='true')missing.push('BOT_RECOVERY_VERIFIED');
  if(e.BOT_LIVE_PILOT_APPROVED!=='true')missing.push('BOT_LIVE_PILOT_APPROVED');
  if(!this.directory||this.directory==='/tmp')missing.push('Persistent BOT_DATA_DIR');
  if(!this.scanner)missing.push('Live market scanner');
  if(!e.BOT_OWNER_PUBLIC_KEY)missing.push('Phantom owner authentication');
  if(!e.JUPITER_API_KEY)missing.push('JUPITER_API_KEY');
  if(!/^https:\/\//.test(e.SOLANA_RPC_URL||''))missing.push('Private SOLANA_RPC_URL');
  if(!Risk.mintOK(expected)||expected===e.BOT_OWNER_PUBLIC_KEY)missing.push('Distinct BOT_DEDICATED_WALLET_ADDRESS');
  const seed=e.BOT_SIGNER_SEED_BASE64||'';
  if(!/^[A-Za-z0-9+/]{43}=$/.test(seed)||Buffer.from(seed,'base64').length!==32)
   missing.push('BOT_SIGNER_SEED_BASE64 (32-byte dedicated wallet seed)');
  else if(Risk.mintOK(expected)){try{this.ensureSigner();}catch(e){missing.push('Signer/address verification failed');}}
  const maxTrade=Number(e.BOT_MAX_TRADE_SOL),maxDay=Number(e.BOT_MAX_DAILY_SPEND_SOL),
   maxLoss=Number(e.BOT_MAX_DAILY_LOSS_SOL),maxOpen=Number(e.BOT_MAX_OPEN_LIVE),
   maxBuys=Number(e.BOT_MAX_DAILY_LIVE_BUYS);
  if(!(maxTrade>=.001&&maxTrade<=.05&&maxDay>=maxTrade&&maxDay<=.1&&
   maxLoss>0&&maxLoss<=.03&&Number.isInteger(maxOpen)&&maxOpen>=1&&maxOpen<=2&&
   Number.isInteger(maxBuys)&&maxBuys>=1&&maxBuys<=4))missing.push('Conservative live risk limits');
  if(this.file&&!this.state){try{this.state=loadState(this.file);}catch(e){missing.push('Persistent state integrity');}}
  if(this.state?.pending)missing.push('Unresolved on-chain trade intent');
  return {ready:missing.length===0,missing,wallet:Risk.mintOK(expected)?expected:null,
   signerConfigured:!!seed,riskControlsReady:Number.isFinite(maxTrade)&&Number.isFinite(maxLoss),
   recoveryVerified:e.BOT_RECOVERY_VERIFIED==='true',onchainConfirmationReady:/^https:\/\//.test(e.SOLANA_RPC_URL||'')};
 }
 ensureSigner(){
  if(this.signer)return this.signer;
  const seed=Buffer.from(this.env.BOT_SIGNER_SEED_BASE64||'','base64');
  if(seed.length!==32)throw Error('Dedicated signer seed missing or invalid');
  try{
   const {Keypair}=require('@solana/web3.js');
   const k=Keypair.fromSeed(new Uint8Array(seed));
   if(k.publicKey.toBase58()!==this.env.BOT_DEDICATED_WALLET_ADDRESS)
     throw Error('Signer does not match the dedicated wallet address');
   this.signer=k;return k;
  }finally{seed.fill(0);}
 }
 fundingStatus(){
  const r=this.requirements(),need=[];
  // Funding is NOT the same as knowing a public address. A funded wallet
  // without a matched, recoverable signer may strand funds indefinitely.
  for(const [missing,label] of [
    ["Distinct BOT_DEDICATED_WALLET_ADDRESS","Valid bot deposit address distinct from your Phantom wallet"],
    ["BOT_SIGNER_SEED_BASE64 (32-byte dedicated wallet seed)","Dedicated wallet signing custody not connected"],
    ["Signer/address verification failed","Signer does not cryptographically match the deposit address"],
    ["BOT_RECOVERY_VERIFIED","Independent encrypted wallet backup and recovery not verified"],
    ["JUPITER_API_KEY","Jupiter swap execution provider not configured"],
    ["Private SOLANA_RPC_URL","Private Solana RPC not configured"],
    ["Persistent BOT_DATA_DIR","Durable transaction journal unavailable"],
    ["Persistent state integrity","Saved trade state requires review"],
    ["Conservative live risk limits","Risk limits need verification"],
    ["Phantom owner authentication","Phantom owner access not configured"],
    ["Unresolved on-chain trade intent","An unresolved on-chain order must be reconciled"]
  ])if(r.missing.includes(missing))need.push(label);
  // The pilot approval is a separate real-money safety gate. Funding can
  // happen while execution remains off, but not before pilot review.
  if(r.missing.includes("BOT_LIVE_PILOT_APPROVED"))
    need.push("Small real-money pilot and signing/exit safety review not approved");
  return {
    mode:"FUNDING_CHECK_ONLY",network:"solana-mainnet",
    wallet:r.wallet,readyToFund:need.length===0&&!!r.wallet,
    checks:{address:!!r.wallet,signer:r.signerConfigured&&
      !r.missing.includes("Signer/address verification failed"),
      recovery:r.recoveryVerified,
      provider:!r.missing.includes("JUPITER_API_KEY")&&
        !r.missing.includes("Private SOLANA_RPC_URL"),
      pilotApproved:!r.missing.includes("BOT_LIVE_PILOT_APPROVED")},
    blockedBy:need,
    neverFundsAutomatically:true,
    note:"Readiness permits a separately approved manual Phantom transfer. It does not start or authorize the bot, prove profitability, or guarantee execution or exit."
  };
 }
 status(){
  const r=this.requirements();return {
   walletReady:r.signerConfigured&&!!r.wallet&&!r.missing.includes('Signer/address verification failed'),liveExecutorReady:r.ready,
   recoveryVerified:r.recoveryVerified,riskControlsReady:r.ready,
   onchainConfirmationReady:r.onchainConfirmationReady,
   liveTrading:this.running,privateBotWallet:r.wallet,missing:r.missing,
   pendingIntent:!!this.state?.pending,positions:this.state?.positions?.length||0,
   dailyBuys:this.state?.dailyBuys||0,lastTickAt:this.lastTickAt,
   backgroundWorker:true,autoResumeOnRestart:false,
   lastError:this.lastError||this.state?.lastError||'',
   message:this.running?'LIVE automation active — real funds at risk':
     r.ready?'LIVE ready; owner must explicitly press Start Live':'LIVE locked: '+r.missing.join(', ')
  };
 }
 day(){const today=new Date().toISOString().slice(0,10);if(this.state.day!==today){
  this.state.day=today;this.state.dailyBuys=0;this.state.dailySpent='0';this.state.dailyLoss='0';this.save();}}
 save(){if(!this.file)throw Error('Persistent live state unavailable');persist(this.file,this.state);}
  async portfolio(){
   const r=this.requirements();
   const state=this.state||{positions:[],pending:null,day:'',dailyBuys:0,dailySpent:'0',dailyLoss:'0'};
   const view={
     mode:'LIVE_ONLY',wallet:r.wallet,liveTrading:this.running,
     timestamp:new Date().toISOString(),
     pending:state.pending?{id:state.pending.id,side:state.pending.side,
       mint:state.pending.mint,signature:state.pending.signature||null,
       createdAt:state.pending.createdAt,reviewRequired:true}:null,
     counters:{day:state.day,buys:state.dailyBuys,
       spentSol:Number(atomicRaw(state.dailySpent||'0'))/1e9,
       realizedLossSol:Number(atomicRaw(state.dailyLoss||'0'))/1e9,
       buyLimit:Number(this.env.BOT_MAX_DAILY_LIVE_BUYS)||0,
       spendingLimitSol:Number(this.env.BOT_MAX_DAILY_SPEND_SOL)||0,
       lossLimitSol:Number(this.env.BOT_MAX_DAILY_LOSS_SOL)||0},
     positions:[]
   };
   for(const p of state.positions.slice(0,2)){
     const position={mint:p.mint,rawRemaining:p.rawRemaining,
       decimals:p.decimals,quantity:((BigInt(p.rawRemaining)*100000000n)/(10n**BigInt(p.decimals))).toString(),
       quantityScale:100000000,entryObservedUsd:p.entrySpot,stopUsd:p.stop,
       tp1Usd:p.tp1,tp2Usd:p.tp2,tp3Usd:p.tp3,stage:p.stage,
       effectiveCostSol:Number(atomicRaw(p.costLamports||'0'))/1e9,
       currentObservedUsd:null,onchainRaw:null,observationAt:null,warning:null};
     try{
       const pool=await this.feeds.pool(p.mint);
       const price=Number(pool?.priceUsd);
       if(Number.isFinite(price)&&price>0){position.currentObservedUsd=price;
        position.observationAt=new Date().toISOString();}
       else position.warning='DEX price not available; no executable quote';
     }catch(e){position.warning='DEX spot observation unavailable';}
     if(r.wallet&&/^https:\/\//.test(this.env.SOLANA_RPC_URL||'')){
       try{position.onchainRaw=String(await this.tokenBalance(p.mint));
         if(BigInt(position.onchainRaw)<BigInt(p.rawRemaining))
           position.warning='On-chain token quantity below recorded position; investigate before trading';
       }catch(e){position.warning='On-chain token balance unavailable';}
     }
     view.positions.push(position);
   }
   return view;
  }
 async rpc(method,params){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),12000);
  try{const r=await this.fetchFn(this.env.SOLANA_RPC_URL,{method:'POST',signal:c.signal,
    headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:crypto.randomUUID(),method,params})});
   if(!r.ok)throw Error('Mainnet RPC unavailable');const x=await r.json();
   if(x.error||!x.result)throw Error('Mainnet RPC error');return x.result;
  }finally{clearTimeout(t);}
 }
 async solBalance(){
  const result=await this.rpc('getBalance',[this.env.BOT_DEDICATED_WALLET_ADDRESS,{commitment:'confirmed'}]);
  if(!Number.isSafeInteger(result.value))throw Error('Wallet balance unavailable');return BigInt(result.value);
 }
 async tokenBalance(mint){
  const r=await this.rpc('getTokenAccountsByOwner',[this.env.BOT_DEDICATED_WALLET_ADDRESS,{mint},{encoding:'jsonParsed',commitment:'confirmed'}]);
  let total=0n;for(const a of r.value||[])total+=atomicRaw(a.account?.data?.parsed?.info?.tokenAmount?.amount||'0');
  return total;
 }
 async order(inputMint,outputMint,raw){
  if(!Risk.mintOK(inputMint)||!Risk.mintOK(outputMint)||
     (inputMint!==SOL&&outputMint!==SOL)||inputMint===outputMint||!amount(raw))
    throw Error('Only validated SOL/token swaps are supported');
  const taker=this.ensureSigner().publicKey.toBase58();
  const u=new URL('https://api.jup.ag/swap/v2/order');
  for(const [k,v] of Object.entries({inputMint,outputMint,amount:raw,taker,slippageBps:'100'}))u.searchParams.set(k,v);
  const c=new AbortController(),t=setTimeout(()=>c.abort(),12000);
  try{const r=await this.fetchFn(u.toString(),{headers:{'x-api-key':this.env.JUPITER_API_KEY},signal:c.signal});
    if(!r.ok)throw Error('Jupiter order unavailable '+r.status);const x=await r.json();
    if(!x||typeof x.transaction!=='string'||x.transaction.length<80||
       typeof x.requestId!=='string'||x.requestId.length<5||
       String(x.inAmount)!==raw||!amount(String(x.outAmount))||
       (x.errorCode||x.errorMessage))throw Error('Jupiter order invalid or amount changed');
    if(x.feeBps!=null&&(!Number.isFinite(Number(x.feeBps))||Number(x.feeBps)>200))
       throw Error('Swap fee over hard limit');
    return x;
  }finally{clearTimeout(t);}
 }
 async executeSigned(order){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),20000);
  try{const r=await this.fetchFn('https://api.jup.ag/swap/v2/execute',{
   method:'POST',signal:c.signal,headers:{'x-api-key':this.env.JUPITER_API_KEY,'content-type':'application/json'},
   body:JSON.stringify(order)});
   if(!r.ok)throw Error('Jupiter execution response unavailable');const x=await r.json();
   if(!x||!['Success','Failed'].includes(x.status))throw Error('Jupiter execution state uncertain');return x;
  }finally{clearTimeout(t);}
 }
 apply(entry,pending){
  const raw=atomicRaw(entry.tokenRaw);
  if(pending.side==='BUY'){
    if(this.state.positions.some(p=>p.mint===pending.mint))throw Error('Duplicate position');
    this.state.positions.push({mint:pending.mint,rawRemaining:String(raw),
      decimals:entry.tokenDecimals,entrySpot:pending.plan.entryReference,
      stop:pending.plan.stop,tp1:pending.plan.tp1,tp2:pending.plan.tp2,tp3:pending.plan.tp3,
      stage:0,costLamports:entry.effectiveSolLamports});
    this.state.dailyBuys++;this.state.dailySpent=String(atomicRaw(this.state.dailySpent)+BigInt(pending.amount));
  }else{
    const p=this.state.positions.find(x=>x.mint===pending.mint);
    if(!p)throw Error('Exit without tracked position');
    const old=atomicRaw(p.rawRemaining),qty=raw>old?old:raw;
    const cost=old?atomicRaw(p.costLamports)*qty/old:0n;
    const received=BigInt(entry.effectiveSolLamports);
    if(cost>received)this.state.dailyLoss=String(atomicRaw(this.state.dailyLoss)+cost-received);
    p.rawRemaining=String(old-qty);p.costLamports=String(atomicRaw(p.costLamports)-cost);
    p.stage=Math.max(p.stage,Number(pending.stage)||3);
    if(atomicRaw(p.rawRemaining)===0n)this.state.positions=this.state.positions.filter(x=>x!==p);
  }
  this.state.pending=null;this.save();
 }
 async reconcile({internal=false}={}){
  if(!this.state?.pending)return {resolved:true,note:'No pending transaction'};
  if(!internal&&(this.running||this.busy))
    return {resolved:false,note:'Stop the worker and wait for any in-flight API call before reconciling'};
  const pending=this.state.pending;
  // A durable phase marker proves the app never reached the network-submit call.
  // Only those specifically marked local-only are safely cancellable.
  if(pending.phase==='PREPARING'||pending.phase==='SIGNED_NOT_SUBMITTED'){
   this.state.pending=null;this.save();
   return {resolved:true,note:'Cancelled local-only unsent order intent; no transaction was submitted'};
  }
  if(!pending.signature)return {resolved:false,note:'Ambiguous legacy intent; requires manual review'};
  let entry=this.journal.read().transactions.find(t=>t.signature===pending.signature);
  if(!entry){
   try{const x=await this.journal.recordFinalized({signature:pending.signature,
      wallet:this.env.BOT_DEDICATED_WALLET_ADDRESS,mint:pending.mint,side:pending.side,intentId:pending.id});
     entry=x.entry;
   }catch(e){return {resolved:false,note:'Pending signature not yet proven finalized; no retry or fresh trade'};}
  }
  this.apply(entry,pending);return {resolved:true,note:'Finalized transaction reconciled'};
 }
 async swap({mint,side,raw,plan=null,stage=3}){
  if(!this.running)throw Error('Live worker is not running — refusing to submit');
  if(this.state.pending)throw Error('Unresolved intent blocks trades');
  const wallet=this.env.BOT_DEDICATED_WALLET_ADDRESS;
  const input=side==='BUY'?SOL:mint,output=side==='BUY'?mint:SOL;
  this.state.pending={id:'live-'+crypto.randomUUID(),wallet,mint,side,amount:String(raw),
   plan,stage,signature:null,phase:'PREPARING',createdAt:new Date().toISOString()};this.save();
  try{
   const order=await this.order(input,output,String(raw));
   if(!this.running)throw Error('Live operator stopped before transaction signing');
   const {VersionedTransaction}=require('@solana/web3.js');
   const tx=VersionedTransaction.deserialize(Buffer.from(order.transaction,'base64'));
   const signer=this.ensureSigner();
   if(!tx.message.staticAccountKeys[0]?.equals(signer.publicKey))throw Error('Unexpected fee payer');
   tx.sign([signer]);
   const signerIndex=tx.message.staticAccountKeys
     .slice(0,tx.message.header.numRequiredSignatures)
     .findIndex(key=>key.equals(signer.publicKey));
   if(signerIndex<0)throw Error('Dedicated wallet is not a required transaction signer');
   const signature=b58(tx.signatures[signerIndex]);
   if(!signature||signature.length<80)throw Error('Signature missing');
   this.state.pending.signature=signature;
   this.state.pending.requestId=order.requestId;
   this.state.pending.phase='SIGNED_NOT_SUBMITTED';this.save();
   if(!this.running)throw Error('Live operator stopped before transaction submission');
   this.state.pending.phase='SUBMITTING';this.save();
   // Once SUBMITTING is durable, an ambiguous network result MUST remain locked.
   const result=await this.executeSigned({signedTransaction:Buffer.from(tx.serialize()).toString('base64'),requestId:order.requestId});
   if(result.signature!==signature||result.status!=='Success')throw Error('Execution not confirmed; reconcile before resuming');
   for(let i=0;i<12;i++){
     const settled=await this.reconcile({internal:true});if(settled.resolved)return settled;
     await new Promise(r=>setTimeout(r,5000));
   }
   throw Error('Finalized on-chain receipt unavailable; pending locked');
  }catch(e){
   // Only a pre-signature failure can be safely cleared automatically;
   // once a signature exists it MUST remain locked until chain reconciliation.
   if(this.state.pending&&['PREPARING','SIGNED_NOT_SUBMITTED'].includes(this.state.pending.phase))
     this.state.pending=null;
   this.running=false;this.lastError=String(e.message||e).slice(0,180);
   this.state.lastError=this.lastError;this.save();this.log('[Crimson LIVE HALT] '+this.lastError);
   throw e;
  }
 }
 async tick(){
  if(!this.running||this.busy)return;
  this.busy=true;this.lastTickAt=new Date().toISOString();
  try{
   this.day();if(this.state.pending)throw Error('Pending intent blocks further trades');
   // Exits before entries. Sell no more than verified on-chain token balance.
   for(const p of [...this.state.positions]){
    const pool=await this.feeds.pool(p.mint);
    const spot=Number(pool?.priceUsd);
    if(!Number.isFinite(spot)||spot<=0)throw Error('Tracked token price unavailable; automatic exits paused');
    const m=Risk.market(pool),exit=Risk.chooseExit(p,spot,m,{verified:false});
    if(!exit)continue;
    const onchain=await this.tokenBalance(p.mint);
    const available=onchain<atomicRaw(p.rawRemaining)?onchain:atomicRaw(p.rawRemaining);
    const qty=exit.fraction===1?available:available*BigInt(Math.round(exit.fraction*10000))/10000n;
    if(qty<=0n)continue;
    await this.swap({mint:p.mint,side:'SELL',raw:String(qty),stage:exit.type==='TP1'?1:exit.type==='TP2'?2:3});
    return;
   }
   if(this.state.positions.length>=Number(this.env.BOT_MAX_OPEN_LIVE)||
      this.state.dailyBuys>=Number(this.env.BOT_MAX_DAILY_LIVE_BUYS)||
      atomicRaw(this.state.dailyLoss)>=atomicSol(Number(this.env.BOT_MAX_DAILY_LOSS_SOL)))return;
   const snapshot=this.scanner?.status();
   if(!snapshot||snapshot.lastError||Date.now()-Date.parse(snapshot.lastScanAt)>210000)return;
   const candidate=(snapshot?.candidates||[]).find(c=>c.securityPass&&c.candleConfirmed&&
      c.entryPlan&&Date.now()-Date.parse(c.updatedAt)<210000&&
      !this.state.positions.some(p=>p.mint===c.mint));
   if(!candidate)return;
   const limit=atomicSol(Number(this.env.BOT_MAX_TRADE_SOL));
   if(atomicRaw(this.state.dailySpent)+limit>atomicSol(Number(this.env.BOT_MAX_DAILY_SPEND_SOL)))return;
   const balance=await this.solBalance();
   if(balance-limit<atomicSol(.04))return; // Reserve SOL for fees, rent, and exits.
   await this.swap({mint:candidate.mint,side:'BUY',raw:String(limit),plan:candidate.entryPlan,stage:0});
  }catch(e){
   this.running=false;this.lastError=String(e.message||e).slice(0,180);
   if(this.timer){clearInterval(this.timer);this.timer=null;}
   this.log('[Crimson LIVE HALTED] '+this.lastError);
  }finally{this.busy=false;}
 }
 start(){
  if(this.running)return this.status();
  const r=this.requirements();if(!r.ready)throw Error('Cannot start live: '+r.missing.join(', '));
  this.ensureSigner(); // Verify secret and address before any signing.
  this.running=true;this.lastError='';this.timer=setInterval(()=>void this.tick(),180000);
  void this.tick();return this.status();
 }
 stop(){this.running=false;if(this.timer)clearInterval(this.timer);this.timer=null;return this.status();}
}
module.exports={LiveController,loadState,b58,persist};
