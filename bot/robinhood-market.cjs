"use strict";
/* Read-only Robinhood Chain (4663) market adapter.
 * Fixed public upstreams, no wallet, no arbitrary URL proxy, no trading.
 * Official RHJ registry is the ONLY basis for issuer identity.
 */
const RH_CHAIN=4663;
const HEX=/^0x[a-fA-F0-9]{40}$/;
const SYMBOL=/^[A-Za-z0-9.^_-]{1,20}$/;
const SOURCE_STOCKS="https://api.robinhood.com/rhj";
const SOURCE_DEX="https://api.geckoterminal.com/api/v2/networks/robinhood";
function finite(x){if(x===null||x===undefined||x==="")return null;const v=Number(x);return Number.isFinite(v)?v:null;}
function nonnegative(x){const n=finite(x);return n===null||n<0?null:n;}
function trimmed(x,max=120){return typeof x==="string"?x.slice(0,max):"";}
function address(x){return typeof x==="string"&&HEX.test(x)?x:null;}
function ticker(x){const s=String(x||"").trim().toUpperCase();return SYMBOL.test(s)?s:null;}
function multiplier(x){const n=finite(x);return n!==null&&n>0&&n<1e6?n:null;}
function deployment(asset){return (Array.isArray(asset?.deployments)?asset.deployments:[])
 .find(x=>Number(x.chainId)===RH_CHAIN&&address(x.contractAddress));}
function parseStock(a){
 const symbol=ticker(a?.tokenSymbol),d=deployment(a);
 if(!symbol||!d)return null;
 const caps=a.tradingCapabilities||{};
 return {kind:"official-stock-token",symbol,name:trimmed(a.tokenName,180),
  contract:d.contractAddress,chainId:RH_CHAIN,status:trimmed(a.status,40),
  multiplier:multiplier(a.currentMultiplier),pendingMultiplier:multiplier(a.pendingMultiplier),
  multiplierEffectiveAt:trimmed(a.pendingMultiplierEffectiveTime,60)||null,
  assetId:trimmed(a.id,72),
  tradingCapabilities:{
   market:caps.market||null,extended:caps.extended||null,overnight:caps.overnight||null,
   fractionalTradability:caps.fractionalTradability??null,
   allDayTradability:caps.allDayTradability??null
  }};
}
function tokenAddress(rel,included){
 const id=rel?.data?.id;
 if(!id)return null;
 const token=included.get(id);
 const a=address(token?.attributes?.address);
 if(a)return a;
 const last=String(id).match(/0x[a-fA-F0-9]{40}$/);
 return last?last[0]:null;
}
function tokenName(rel,included,key){
 const item=included.get(rel?.data?.id);
 return trimmed(item?.attributes?.[key],80);
}
function parsePool(p,included,stockAddresses){
 const a=p?.attributes||{},pool=address(a.address);
 if(!pool)return null;
 const baseRel=p.relationships?.base_token,quoteRel=p.relationships?.quote_token;
 const base=tokenAddress(baseRel,included),quote=tokenAddress(quoteRel,included);
 const official=base?stockAddresses.get(base.toLowerCase()):null;
 const transactions=a.transactions||{},changes=a.price_change_percentage||{};
 return {kind:"robinhood-dex-pool",chainId:RH_CHAIN,poolAddress:pool,
  poolName:trimmed(a.name,120),dex:trimmed(p.relationships?.dex?.data?.id,80),
  baseTokenAddress:base,quoteTokenAddress:quote,
  baseTokenSymbol:tokenName(baseRel,included,"symbol")||trimmed(a.name,40).split("/")[0].trim(),
  quoteTokenSymbol:tokenName(quoteRel,included,"symbol"),
  priceUsd:nonnegative(a.base_token_price_usd),
  liquidityUsd:nonnegative(a.reserve_in_usd),
  marketCapUsd:nonnegative(a.market_cap_usd),
  fdvUsd:nonnegative(a.fdv_usd),
  volume5mUsd:nonnegative(a.volume_usd?.m5),volume24hUsd:nonnegative(a.volume_usd?.h24),
  buys5m:nonnegative(transactions.m5?.buys),sells5m:nonnegative(transactions.m5?.sells),
  buys24h:nonnegative(transactions.h24?.buys),sells24h:nonnegative(transactions.h24?.sells),
  change5mPct:finite(changes.m5),change24hPct:finite(changes.h24),
  createdAt:trimmed(a.pool_created_at,60)||null,
  issuerCheck:stockAddresses.size===0?"unavailable":official?"issuer-listed":"not-issuer-listed",
  officialStockSymbol:official?.symbol||null,
  officialStockContract:official?.contract||null,
  securityVerified:false};
}
class RobinhoodMarket{
 constructor({fetchFn=globalThis.fetch,clock=()=>Date.now()}={}){
  this.fetchFn=fetchFn;this.clock=clock;this.cache=new Map();this.inflight=new Map();
 }
 async fetchJson(url){
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),11000);
  try{
   const r=await this.fetchFn(url,{signal:abort.signal,
    headers:{accept:"application/json;version=20230203","user-agent":"CrimsonIntel/1.0 (read-only public market tracker)"}});
   if(!r.ok)throw Error("Upstream market data returned HTTP "+r.status);
   const raw=await r.text();
   if(raw.length>4000000)throw Error("Upstream response too large");
   const x=JSON.parse(raw);
   if(!x||typeof x!=="object"||Array.isArray(x))throw Error("Invalid market data");
   return x;
  }finally{clearTimeout(timer);}
 }
 async cached(key,ttl,staleFor,load){
  const now=this.clock(),old=this.cache.get(key);
  if(old&&now-old.at<ttl)return {...old.value,stale:false,cachedAt:new Date(old.at).toISOString()};
  if(this.inflight.has(key))return this.inflight.get(key);
  const task=(async()=>{
   try{
    const value=await load();
    this.cache.set(key,{at:this.clock(),value});
    return {...value,stale:false,cachedAt:new Date(this.clock()).toISOString()};
   }catch(e){
    if(old&&now-old.at<staleFor)return {...old.value,stale:true,
     error:"Upstream temporarily unavailable; showing last known observations",
     cachedAt:new Date(old.at).toISOString()};
    throw e;
   }finally{this.inflight.delete(key);}
  })();
  this.inflight.set(key,task);return task;
 }
 async registry(){
  return this.cached("rh-assets",3600000,86400000,async()=>{
   const response=await this.fetchJson(SOURCE_STOCKS+"/assets");
   if(!Array.isArray(response.assets))throw Error("Robinhood asset registry unavailable");
   const stocks=response.assets.map(parseStock).filter(Boolean);
   if(!stocks.length)throw Error("Robinhood official asset registry empty");
   stocks.sort((a,b)=>a.symbol.localeCompare(b.symbol));
   return {source:"Robinhood Stock Token registry",chainId:RH_CHAIN,assets:stocks,
    fetchedAt:new Date(this.clock()).toISOString()};
  });
 }
 async stocks(q=""){
  const reg=await this.registry();
  const term=String(q||"").trim().slice(0,60).toLowerCase();
  const highlights=["AAPL","NVDA","TSLA","MSFT","AMZN","META","GOOGL","AMD","PLTR","COIN"];
  let items=reg.assets;
  if(term)items=items.filter(x=>x.symbol.toLowerCase().includes(term)||
    x.name.toLowerCase().includes(term)||x.contract.toLowerCase()===term);
  else items=items.filter(x=>highlights.includes(x.symbol))
   .sort((a,b)=>highlights.indexOf(a.symbol)-highlights.indexOf(b.symbol));
  return {mode:"READ_ONLY",network:"Robinhood Chain",chainId:RH_CHAIN,
   issuer:"Robinhood Assets (Jersey) Limited",totalOfficialAssets:reg.assets.length,
   matches:items.length,stocks:items.slice(0,40),query:term,
   stale:reg.stale,cachedAt:reg.cachedAt,source:reg.source};
 }
 async quote(input){
  const symbol=ticker(input);
  if(!symbol)throw Error("Invalid ticker");
  const reg=await this.registry();
  const stock=reg.assets.find(x=>x.symbol===symbol);
  if(!stock)throw Error("Not listed in official Robinhood Stock Token registry");
  const result=await this.cached("rh-quote-"+symbol,15000,120000,async()=>{
   const data=await this.fetchJson(SOURCE_STOCKS+"/prices/"+encodeURIComponent(symbol));
   const quote=(Array.isArray(data.quotes)?data.quotes:[])
    .find(x=>ticker(x.tokenSymbol)===symbol);
   if(!quote)throw Error("Robinhood token quote unavailable");
   const bid=nonnegative(quote.bid),ask=nonnegative(quote.ask);
   if((bid===null||bid<=0)&&(ask===null||ask<=0))
    throw Error("No valid live Robinhood token bid or ask");
   if(quote.currency!=="USD")throw Error("Unexpected Robinhood quote currency");
   return {symbol,underlyingBidUsd:bid,underlyingAskUsd:ask,
    underlyingVolume24h:nonnegative(quote.dailyTradingVolume),
    isTradingHalt:quote.isTradingHalt===true,
    quoteGeneratedAt:trimmed(quote.generatedAt,60)||null,
    source:"Robinhood Stock Token prices"};
  });
  const mx=stock.multiplier;
  return {mode:"READ_ONLY",chainId:RH_CHAIN,stock,
   quote:{...result,perTokenBidUsd:mx!==null&&result.underlyingBidUsd!==null?
     Number((result.underlyingBidUsd*mx).toPrecision(12)):null,
    perTokenAskUsd:mx!==null&&result.underlyingAskUsd!==null?
     Number((result.underlyingAskUsd*mx).toPrecision(12)):null},
   stale:reg.stale||result.stale,observedAt:result.quoteGeneratedAt||result.cachedAt,
   note:"Underlying bid/ask multiplied by current shares-per-token multiplier. Informational reference, not an executable on-chain swap quote."};
 }
 async pools(view="trending"){
  if(!["trending","new"].includes(view))throw Error("Invalid pool view");
  const endpoint=SOURCE_DEX+"/"+(view==="new"?"new_pools":"trending_pools")+
    "?include=base_token%2Cquote_token&page=1";
  return this.cached("rh-pools-"+view,60000,300000,async()=>{
   const [api,registry]=await Promise.all([
    this.fetchJson(endpoint),
    this.registry().catch(()=>null)
   ]);
   if(!Array.isArray(api.data))throw Error("DEX pool data unavailable");
   const included=new Map((api.included||[]).filter(x=>x&&typeof x.id==="string")
    .map(x=>[x.id,x]));
   const official=new Map((registry?.assets||[]).map(x=>[x.contract.toLowerCase(),x]));
   const pools=api.data.map(p=>parsePool(p,included,official)).filter(Boolean).slice(0,30);
   return {mode:"READ_ONLY",network:"Robinhood Chain",chainId:RH_CHAIN,
    view,pools,total:pools.length,source:"GeckoTerminal public on-chain DEX pools",
    issuerRegistryAvailable:!!registry&&!registry.stale,
    fetchedAt:new Date(this.clock()).toISOString(),
    notice:"DEX-listed tokens are unverified; tickers and liquidity are not a security audit."};
  });
 }
 async token(rawAddress){
  const addr=address(rawAddress);
  if(!addr)throw Error("Invalid EVM token address");
  const key=addr.toLowerCase();
  return this.cached("rh-token-"+key,60000,300000,async()=>{
   const [api,registry]=await Promise.all([
    this.fetchJson(SOURCE_DEX+"/tokens/"+key+"/pools?include=base_token%2Cquote_token"),
    this.registry().catch(()=>null)
   ]);
   if(!Array.isArray(api.data))throw Error("Robinhood Chain token pools unavailable");
   const included=new Map((api.included||[]).map(x=>[x.id,x]));
   const official=new Map((registry?.assets||[]).map(x=>[x.contract.toLowerCase(),x]));
   const pools=api.data.map(p=>parsePool(p,included,official)).filter(p=>p&&
     p.baseTokenAddress&&p.baseTokenAddress.toLowerCase()===key)
     .sort((a,b)=>(b.liquidityUsd||0)-(a.liquidityUsd||0)).slice(0,20);
   const issuer=official.get(key)||null;
   return {mode:"READ_ONLY",chainId:RH_CHAIN,tokenAddress:addr,
    issuerCheck:registry?issuer?"issuer-listed":"not-issuer-listed":"unavailable",
    issuerListedStock:issuer?{symbol:issuer.symbol,name:issuer.name,contract:issuer.contract}:null,
    pools,topPool:pools[0]||null,totalObservedPools:pools.length,
    source:"GeckoTerminal Robinhood Chain token pools",
    fetchedAt:new Date(this.clock()).toISOString(),
    note:"Only pools with this address as the base token are shown so prices do not accidentally refer to the quote token."};
  });
 }
 async pool(rawAddress){
  const addr=address(rawAddress);
  if(!addr)throw Error("Invalid EVM pool address");
  const key=addr.toLowerCase();
  return this.cached("rh-pool-"+key,60000,300000,async()=>{
   const [api,registry]=await Promise.all([
    this.fetchJson(SOURCE_DEX+"/pools/"+key+"?include=base_token%2Cquote_token"),
    this.registry().catch(()=>null)
   ]);
   const included=new Map((api.included||[]).map(x=>[x.id,x]));
   const official=new Map((registry?.assets||[]).map(x=>[x.contract.toLowerCase(),x]));
   const parsed=parsePool(api.data,included,official);
   if(!parsed||parsed.poolAddress.toLowerCase()!==key)
    throw Error("Requested DEX pool not found");
   return {mode:"READ_ONLY",chainId:RH_CHAIN,
    pool:parsed,source:"GeckoTerminal pool detail",
    fetchedAt:new Date(this.clock()).toISOString()};
  });
 }
}
module.exports={RobinhoodMarket,parseStock,parsePool,ticker,address};
