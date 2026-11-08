/* Crimson Intel unified read-only token/pool adapter.
 * Solana and Robinhood Chain (EVM 4663) share one market snapshot contract.
 * A Robinhood-issued Stock Token quote is a reference, not an executable price.
 */
(()=>{
"use strict";
if(window.CrimsonChainData)return;
const BASE="https://crimson-operator-api-production.up.railway.app";
const SOL=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/,EVM=/^0x[a-fA-F0-9]{40}$/;
const isValid=(chain,address)=>chain==="solana"?SOL.test(String(address||"")):
 chain==="robinhood"?EVM.test(String(address||"")):false;
function n(x){if(x===null||x===undefined||x==="")return null;const v=Number(x);return Number.isFinite(v)?v:null;}
const positive=x=>{const v=n(x);return v!==null&&v>0?v:null;};
async function get(url){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),15000);
 try{
  const response=await fetch(url,{signal:ctl.signal,credentials:"omit",cache:"no-store"});
  if(!response.ok)throw Error("Market provider HTTP "+response.status);
  return response.json();
 }finally{clearTimeout(timer);}
}
const tokenKey=(chain,mint)=>chain+":"+(chain==="robinhood"?mint.toLowerCase():mint);
function normalizePool(mint,p,stale=false,stock=null,observedAt=null){
 if(!p||typeof p!=="object"||!EVM.test(String(p.poolAddress||""))||
    String(p.baseTokenAddress||"").toLowerCase()!==mint.toLowerCase())
   throw Error("Chain 4663 pool base token does not match the tracked contract");
 return {
  chainId:"robinhood",pairAddress:p.poolAddress,dexId:p.dex||"Robinhood DEX",
  baseToken:{address:mint,symbol:p.baseTokenSymbol||stock?.symbol||"?",name:stock?.name||p.baseTokenSymbol||"Robinhood Chain token"},
  quoteToken:{address:p.quoteTokenAddress||null,symbol:p.quoteTokenSymbol||"?"},
  priceUsd:positive(p.priceUsd),liquidity:{usd:n(p.liquidityUsd)},
  volume:{m5:n(p.volume5mUsd),h1:n(p.volume1hUsd),h24:n(p.volume24hUsd)},
  txns:{m5:{buys:n(p.buys5m),sells:n(p.sells5m)},h1:{buys:n(p.buys1h),sells:n(p.sells1h)},
   h24:{buys:n(p.buys24h),sells:n(p.sells24h)}},
  priceChange:{m5:n(p.change5mPct),h1:n(p.change1hPct),h24:n(p.change24hPct)},
  marketCap:n(p.marketCapUsd),fdv:n(p.fdvUsd),pairCreatedAt:Date.parse(p.createdAt)||null,
  url:"https://www.geckoterminal.com/robinhood/pools/"+encodeURIComponent(p.poolAddress),
  priceType:"dex-spot",dataStale:stale,observationAt:observedAt,
  source:"GeckoTerminal Robinhood Chain",issuerListed:!!stock,
  issuerLabel:stock?.symbol||null,securityVerified:false,
  marketUnavailable:false,stockToken:!!stock
 };
}
function normalizeStock(mint,stock,quote,stale){
 if(!stock||String(stock.contract).toLowerCase()!==mint.toLowerCase())
   throw Error("Issuer quote contract identity mismatch");
 const bid=positive(quote?.quote?.perTokenBidUsd),ask=positive(quote?.quote?.perTokenAskUsd);
 const price=bid!==null&&ask!==null?(bid+ask)/2:bid??ask;
 if(!(price>0))throw Error("No supported issuer bid/ask token reference");
 return {
  chainId:"robinhood",pairAddress:null,dexId:"Robinhood issuer reference (not a DEX)",
  baseToken:{address:mint,symbol:stock.symbol,name:stock.name},
  quoteToken:{address:null,symbol:"USD"},
  priceUsd:price,liquidity:{usd:null},volume:{m5:null,h1:null,h24:null},
  txns:{m5:{buys:null,sells:null},h1:{buys:null,sells:null},h24:{buys:null,sells:null}},
  priceChange:{m5:null,h1:null,h24:null},marketCap:null,fdv:null,pairCreatedAt:null,
  url:"https://robinhoodchain.blockscout.com/token/"+mint,
  priceType:"issuer-reference",dataStale:!!stale||!!quote?.stale,
  observationAt:quote?.observedAt||null,source:"Robinhood Stock Token issuer",
  issuerListed:true,issuerLabel:stock.symbol,securityVerified:false,
  marketUnavailable:true,stockToken:true,quoteReferenceOnly:true,
  isTradingHalt:quote?.quote?.isTradingHalt===true,
  issuerStatus:stock.status||"unknown",
  pendingMultiplier:stock.pendingMultiplier||null,
  currentMultiplier:stock.multiplier||null,
  underlyingBidUsd:quote?.quote?.underlyingBidUsd??null,
  underlyingAskUsd:quote?.quote?.underlyingAskUsd??null
 };
}
async function load(chain,address){
 const mint=String(address||"").trim();
 if(!isValid(chain,mint))throw Error("Invalid address for selected network");
 if(chain==="solana"){
  const pairs=await get("https://api.dexscreener.com/token-pairs/v1/solana/"+encodeURIComponent(mint));
  if(!Array.isArray(pairs))throw Error("Solana DEX market response unavailable");
  const viable=pairs.filter(x=>x?.chainId==="solana"&&x.baseToken?.address===mint);
  const pair=viable.sort((a,b)=>(Number(b.liquidity?.usd)||0)-(Number(a.liquidity?.usd)||0))[0];
  if(!pair)throw Error("No base-token DEX pair found for this Solana mint");
  return {chain,mint,pair:{...pair,priceType:"dex-spot",source:"DEX Screener Solana",dataStale:false},at:Date.now()};
 }
 const token=await get(BASE+"/robinhood/token?address="+encodeURIComponent(mint));
 if(token.chainId!==4663||token.mode!=="READ_ONLY"||token.tokenAddress?.toLowerCase()!==mint.toLowerCase())
  throw Error("Robinhood Chain provider returned mismatched chain or contract");
 const stock=token.issuerListedStock;
 let pair;
 if(token.topPool)pair=normalizePool(mint,token.topPool,!!token.stale,stock,token.fetchedAt||token.cachedAt);
 else if(stock){
  const quote=await get(BASE+"/robinhood/stock-quote?symbol="+encodeURIComponent(stock.symbol));
  pair=normalizeStock(mint,stock,quote,token.stale);
 }else throw Error("No verified DEX pool or official issuer reference found for that Robinhood Chain contract");
 return {chain,mint,pair,at:Date.now()};
}
function networkLabel(chain){return chain==="robinhood"?"Robinhood Chain":"Solana";}
window.CrimsonChainData=Object.freeze({load,isValid,tokenKey,networkLabel,normalizePool,normalizeStock});
})();
