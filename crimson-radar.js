/* Crimson Intel Radar addon v1 — additive, client-only. No private keys. */
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const base='https://api.dexscreener.com';
 const mintRegex=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
 const css=`
 .ci-radar{background:#131a2ee8;border:1px solid #303955;border-radius:17px;padding:20px;margin:0 0 17px;color:#f2f3ff}
 .ci-radar h2{font-size:19px;margin:0 0 9px}.ci-radar p{color:#a5aecb;line-height:1.6}
 .ci-radar-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
 .ci-radar-stat,.ci-card{background:#0a1124;border:1px solid #293450;border-radius:12px;padding:14px}
 .ci-radar-stat strong{font-size:25px;display:block;margin:6px 0}
 .ci-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:12px;margin:14px 0}
 .ci-card h3{margin:0 0 5px}.ci-card p{font-size:12px;margin:8px 0}.ci-card a{color:#a9b8ff}
 .ci-radar button{cursor:pointer;color:white;background:linear-gradient(120deg,#f64b82,#8657ef);border:0;border-radius:9px;padding:10px;font-weight:700;margin:5px 5px 5px 0}
 .ci-radar button:disabled{opacity:.5}.ci-radar button.ci-filter{background:#27314d}.ci-radar button.ci-active{outline:2px solid #fa477f}
 .ci-tag{font-size:11px;font-weight:800;padding:4px 7px;border-radius:999px;background:#24314a;color:#e6ecff;display:inline-block}
 .ci-tag.red{background:#502332;color:#ff9eae}.ci-tag.green{background:#103b31;color:#76eebc}
 .ci-foot{font-size:12px!important}.ci-danger{color:#ff6977}.ci-good{color:#4ee0a9}
 @media(max-width:530px){.ci-radar-stats{grid-template-columns:1fr}}
 `;
 const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
 const scan=document.createElement('section');scan.id='crimsonMarketRadar';scan.className='ci-radar';scan.innerHTML=`
 <h2>⚔ Crimson Market Radar <span class="ci-tag">BETA</span></h2>
 <p>Scan a limited sample of newly profiled and promoted Solana tokens for unusual momentum, selling pressure and market danger. <strong>This does not scan every coin.</strong></p>
 <button id="ciScan" type="button">Scan candidates</button>
 <button class="ci-filter ci-active" data-ci="all" type="button">All</button>
 <button class="ci-filter" data-ci="pump" type="button">Pump Watch</button>
 <button class="ci-filter" data-ci="dump" type="button">Dump Watch</button>
 <button class="ci-filter" data-ci="danger" type="button">Market Danger</button>
 <p id="ciScanStatus" role="status">Press Scan to load current DEX Screener discovery candidates.</p>
 <div class="ci-cards" id="ciCards"></div>
 <p class="ci-foot">Discovery includes paid promotions and token profiles; promotion is not endorsement. Scores are rule-based research flags, not future pump/rug predictions or token security verification. Requires an open browser tab.</p>`;
 const risk=document.createElement('section');risk.id='crimsonTrackedRadar';risk.className='ci-radar';risk.innerHTML=`
 <h2>🛡 Tracked Coin Risk & Momentum</h2>
 <p>Two independent market metrics. High momentum does not cancel danger. Token contract security and wallet behavior are NOT verified.</p>
 <div class="ci-radar-stats">
 <div class="ci-radar-stat"><small>Opportunity momentum · higher = stronger</small><strong id="ciOpportunity">—</strong><span id="ciOpportunityState">Waiting for token</span></div>
 <div class="ci-radar-stat"><small>Observed market danger · higher = riskier</small><strong id="ciDanger">—</strong><span id="ciDangerState">Waiting for token</span></div>
 </div>
 <h3>Evidence</h3><ul id="ciEvidence"><li>Track a coin to begin monitoring.</li></ul>
 <p class="ci-foot"><strong>ON-CHAIN RUG CHECK: NOT CONNECTED.</strong> Mint/freeze authority, Token-2022 extensions, top holders, linked wallets, deployer history and liquidity lock status require separate validated on-chain data. Pool liquidity changes alone do not prove liquidity removal or fraud.</p>
 <p><a id="ciRugCheck" href="https://rugcheck.xyz" target="_blank" rel="noopener noreferrer">Review on RugCheck ↗</a> · <a id="ciSolscan" href="https://solscan.io" target="_blank" rel="noopener noreferrer">View on Solscan ↗</a></p>
 <label><input type="checkbox" id="ciMarketAlerts" style="width:auto"> Warn me when tracked-token market danger increases (open tab only)</label>`;
 const main=document.querySelector('main');if(!main)return;
 const searchBlock=$('mint')?.closest('section');if(searchBlock?.parentNode)searchBlock.insertAdjacentElement('afterend',scan);else main.prepend(scan);
 const entryIntel=$('entryIntel');if(entryIntel?.parentNode)entryIntel.insertAdjacentElement('afterend',risk);else main.append(risk);
 const usd=n=>Number.isFinite(Number(n))?'$'+Number(n).toLocaleString('en-US',{notation:Math.abs(Number(n))>=1e6?'compact':'standard',maximumFractionDigits:2}):'—';
 const pct=n=>Number.isFinite(Number(n))?(Number(n)>0?'+':'')+Number(n).toFixed(1)+'%':'—';
 const number=v=>v===null||v===undefined||v===''?NaN:Number(v);
 const clamp=n=>Math.max(0,Math.min(100,Math.round(n)));
 const recent=new Map(), lastDanger=new Map();
 let rows=[],filter='all',scanning=false,trackedBusy=false;
 function assess(p,prior){
   const liq=number(p?.liquidity?.usd),p5=number(p?.priceChange?.m5),p1=number(p?.priceChange?.h1),v5=number(p?.volume?.m5),b=number(p?.txns?.m5?.buys),s=number(p?.txns?.m5?.sells);
   const count=b+s;
   if(![liq,p5,p1,v5,b,s].every(Number.isFinite)||liq<=0||b<0||s<0||count<10){return {valid:false,opportunity:null,danger:null,pump:false,dump:false,dangerous:false,reasons:['Insufficient 5m trade activity or missing liquidity/price data.']};}
   let opportunity=30,danger=5;const reasons=[];const buys=100*b/count;
   if(buys>=65){opportunity+=22;reasons.push('5m buy transaction share '+buys.toFixed(0)+'% (counts, not dollar inflow).');}
   else if(buys<=35){opportunity-=16;danger+=20;reasons.push('Sell transactions dominate ('+(100-buys).toFixed(0)+'%).');}
   else if(buys>=55)opportunity+=10;
   if(p5>1&&p5<=10)opportunity+=20;
   else if(p5>10&&p5<=20){opportunity+=8;danger+=12;reasons.push('Fast 5m price increase; chasing risk.');}
   else if(p5>20){danger+=25;reasons.push('Extreme 5m price spike.');}
   else if(p5<=-8){opportunity-=20;danger+=25;reasons.push('Rapid 5m price decline.');}
   else if(p5<-3)danger+=10;
   if(p1>=3&&p1<=25)opportunity+=18;
   else if(p1>35){danger+=20;reasons.push('Price extended over 1h.');}
   else if(p1<=-15){opportunity-=15;danger+=17;reasons.push('1h price decline '+pct(p1)+'.');}
   if(count>=40)opportunity+=10;
   if(v5/liq>=.12&&v5/liq<=1.2)opportunity+=12;
   if(v5/liq>2){danger+=10;reasons.push('High trading volume relative to liquidity.');}
   if(liq<10000){danger+=55;opportunity-=35;reasons.push('Liquidity under $10k: extreme slippage risk.');}
   else if(liq<25000){danger+=30;opportunity-=15;reasons.push('Low liquidity: execution risk.');}
   else if(liq<50000)danger+=12;
   if(prior?.liq>0){const drop=100*(prior.liq-liq)/prior.liq;if(drop>=20){danger+=40;reasons.push('Pool liquidity dropped '+drop.toFixed(1)+'% since previous open-tab snapshot; cause unknown.');}else if(drop>=10){danger+=20;reasons.push('Pool liquidity down '+drop.toFixed(1)+'% since previous snapshot.');}}
   opportunity=clamp(opportunity);danger=clamp(danger);
   return {valid:true,opportunity,danger,pump:opportunity>=70&&danger<55&&p5>0,dump:buys<=35&&(p5<=-3||p1<=-8),dangerous:danger>=55,reasons:reasons.length?reasons:['No extreme conditions in this limited snapshot. Token security still unknown.']};
 }
 function fillEvidence(notes){const ul=$('ciEvidence');ul.replaceChildren();for(const note of notes){const li=document.createElement('li');li.textContent=note;ul.append(li);}}
 function trackedUpdate(p,mint){const before=recent.get(mint),a=assess(p,before);$('ciOpportunity').textContent=a.valid?a.opportunity+'/100':'—';$('ciDanger').textContent=a.valid?a.danger+'/100':'—';$('ciOpportunityState').textContent=a.pump?'PUMP WATCH':a.valid?'Observation only':'INSUFFICIENT DATA';$('ciDangerState').textContent=a.dangerous?'HIGH MARKET DANGER':a.dump?'DUMP WATCH':a.valid?'No major market flag':'INSUFFICIENT DATA';$('ciDanger').className=a.dangerous?'ci-danger':'';$('ciOpportunity').className=a.pump?'ci-good':'';fillEvidence(a.reasons);$('ciRugCheck').href='https://rugcheck.xyz/tokens/'+encodeURIComponent(mint);$('ciSolscan').href='https://solscan.io/token/'+encodeURIComponent(mint);
 const stage=a.danger>=70?'HIGH':a.danger>=55?'ELEVATED':'NORMAL';const old=lastDanger.get(mint);
 if(old&&old!==stage&&stage!=='NORMAL'&&$('ciMarketAlerts').checked){const message='Market danger changed to '+stage+' for '+mint.slice(0,6)+'… (not a verified rug).';if('Notification' in window&&Notification.permission==='granted'){try{new Notification('Crimson Market Radar',{body:message});}catch(e){}}else window.alert(message);}
 lastDanger.set(mint,stage);recent.set(mint,{liq:number(p?.liquidity?.usd),time:Date.now()});}
 function render(){const container=$('ciCards');container.replaceChildren();const found=rows.filter(x=>filter==='all'||(filter==='pump'&&x.a.pump)||(filter==='dump'&&x.a.dump)||(filter==='danger'&&x.a.dangerous)).slice(0,18);if(!found.length){const p=document.createElement('p');p.textContent=rows.length?'No coins matched this filter in the discovery sample.':'No candidates yet.';container.append(p);return;}
 for(const r of found){const card=document.createElement('article');card.className='ci-card';const title=document.createElement('h3');title.textContent=(r.symbol||'?')+' · '+(r.name||'Solana token');const pill=document.createElement('span');pill.className='ci-tag '+(r.a.dangerous||r.a.dump?'red':r.a.pump?'green':'');pill.textContent=!r.a.valid?'INSUFFICIENT DATA':r.a.dangerous?'MARKET DANGER':r.a.dump?'DUMP WATCH':r.a.pump?'PUMP WATCH':'OBSERVE';const metrics=document.createElement('p');metrics.textContent='Opportunity: '+(r.a.valid?r.a.opportunity+'/100':'—')+' · Danger: '+(r.a.valid?r.a.danger+'/100':'—')+' · Liquidity: '+usd(r.liquidity)+' · 5m: '+pct(r.p5)+' · 1h: '+pct(r.p1);const reason=document.createElement('p');reason.textContent=r.a.reasons.slice(0,2).join(' ');const caveat=document.createElement('p');caveat.textContent='Discovery may be paid promotion · Security UNVERIFIED.';const deep=document.createElement('button');deep.type='button';deep.textContent='Deep-analyze';deep.addEventListener('click',()=>{$('mint').value=r.address;$('track')?.click();$('mint').scrollIntoView({behavior:'smooth',block:'center'});});const link=document.createElement('a');link.textContent='DEX chart ↗';link.href='https://dexscreener.com/solana/'+encodeURIComponent(r.pairAddress);link.target='_blank';link.rel='noopener noreferrer';card.append(title,pill,metrics,reason,caveat,deep,link);container.append(card);}}
 async function getJSON(url){const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),12000);try{const r=await fetch(url,{cache:'no-store',signal:ctrl.signal});if(!r.ok)throw Error('HTTP '+r.status);return await r.json();}finally{clearTimeout(timer);}}
 async function scanCandidates(){if(scanning)return;scanning=true;$('ciScan').disabled=true;$('ciScanStatus').textContent='Scanning recent public discovery sample…';try{const feeds=await Promise.all([getJSON(base+'/token-profiles/latest/v1'),getJSON(base+'/token-boosts/latest/v1'),getJSON(base+'/token-boosts/top/v1')]);const candidates=[...new Set(feeds.flat().filter(t=>t?.chainId==='solana'&&mintRegex.test(t.tokenAddress||'')).map(t=>t.tokenAddress))].slice(0,30);if(!candidates.length)throw Error('No Solana candidates in public discovery feeds');const pools=await getJSON(base+'/tokens/v1/solana/'+candidates.map(encodeURIComponent).join(','));if(!Array.isArray(pools))throw Error('Missing pools');const set=new Set(candidates),best=new Map();for(const p of pools){if(p?.chainId!=='solana')continue;const addr=set.has(p?.baseToken?.address)?p.baseToken.address:set.has(p?.quoteToken?.address)?p.quoteToken.address:null;if(!addr)continue;const old=best.get(addr);if(!old||number(p?.liquidity?.usd)>number(old?.liquidity?.usd))best.set(addr,p);}rows=[];for(const [address,p] of best){const tok=p.baseToken?.address===address?p.baseToken:p.quoteToken;rows.push({address,symbol:tok?.symbol,name:tok?.name,pairAddress:p.pairAddress||address,liquidity:number(p.liquidity?.usd),p5:number(p.priceChange?.m5),p1:number(p.priceChange?.h1),a:assess(p,null)});}rows.sort((a,b)=>Number(b.a.dangerous)-Number(a.a.dangerous)||(b.a.opportunity??-1)-(a.a.opportunity??-1));render();$('ciScanStatus').textContent='Scanned '+candidates.length+' discovered addresses; '+rows.length+' indexed pools. Updated '+new Date().toLocaleTimeString()+'. Not a complete market scan.';}catch(e){$('ciScanStatus').textContent='Scanner unavailable: '+(e?.message||'provider error')+'. Existing coin tracker is unaffected.';}finally{scanning=false;$('ciScan').disabled=false;}}
 $('ciScan').addEventListener('click',scanCandidates);
 document.querySelectorAll('[data-ci]').forEach(btn=>btn.addEventListener('click',()=>{filter=btn.dataset.ci;document.querySelectorAll('[data-ci]').forEach(b=>b.classList.toggle('ci-active',b===btn));render();}));render();
 // Add a read-only observation beside the old tracker: do not alter its handlers.
 // Observe existing #price text updates, then fetch the tracked token's market pool.
 // This allows the original single-file tracker and all its features to stay intact.
 let observedMint='',observerPending=false;
 async function pollTracked(){const token=$('mint')?.value.trim()||'';if(!mintRegex.test(token)||!$('pool')?.textContent?.startsWith('Selected pool:'))return;if(observerPending)return;observerPending=true;try{const pairs=await getJSON(base+'/token-pairs/v1/solana/'+encodeURIComponent(token));if(Array.isArray(pairs)&&pairs.length){const p=pairs.filter(x=>x.baseToken?.address===token||x.quoteToken?.address===token).sort((a,b)=>(number(b?.liquidity?.usd)||0)-(number(a?.liquidity?.usd)||0))[0];if(p){observedMint=token;trackedUpdate(p,token);}}}catch(e){$('ciDangerState').textContent='Risk feed unavailable; no current check';}finally{observerPending=false;}}
 $('track')?.addEventListener('click',()=>{observedMint='';$('ciOpportunity').textContent='…';$('ciDanger').textContent='…';setTimeout(pollTracked,1800);});
 setInterval(()=>{if(!document.hidden)pollTracked();},25000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollTracked();});
})();
