"use strict";
/* Public data adapters for paper-mode automatic Solana research.
 * Prices are DEX pool snapshots, not executable swap quotes.
 * Fail closed if API data or token identity cannot be checked.
 */
const {mintOK}=require("./risk-engine.cjs");
const DEX="https://api.dexscreener.com";
const GT="https://api.geckoterminal.com/api/v2";
const RUG="https://api.rugcheck.xyz/v1/tokens/";
function validPool(p,mint){
  return p?.chainId==="solana"&&p?.baseToken?.address===mint&&mintOK(p?.pairAddress||"");
}
function ranked(pools,mint){
  return (Array.isArray(pools)?pools:[]).filter(p=>validPool(p,mint))
    .sort((a,b)=>(Number(b?.liquidity?.usd)||0)-(Number(a?.liquidity?.usd)||0))[0]||null;
}
class PublicSolanaFeeds{
  constructor({fetchFn=globalThis.fetch,timeoutMs=12000}={}){
    if(typeof fetchFn!=="function")throw Error("Node 20+ fetch() is required");
    this.fetchFn=fetchFn;this.timeoutMs=timeoutMs;
  }
  async json(url){
    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(),this.timeoutMs);
    try{
      const res=await this.fetchFn(url,{cache:"no-store",signal:ctrl.signal});
      if(!res.ok)throw Error("HTTP "+res.status+" from "+new URL(url).hostname);
      return await res.json();
    }finally{clearTimeout(timer);}
  }
  async discover(limit=24){
    const feeds=[
      {label:"new Gecko pools",url:GT+"/networks/solana/new_pools?include=base_token"},
      {label:"trending Gecko pools",url:GT+"/networks/solana/trending_pools?include=base_token"},
      {label:"DEX token profiles",url:DEX+"/token-profiles/latest/v1"},
      {label:"DEX promoted",url:DEX+"/token-boosts/latest/v1"}
    ];
    const results=await Promise.allSettled(feeds.map(x=>this.json(x.url)));
    const groups=feeds.map(()=>[]),warnings=[];
    for(let i=0;i<results.length;i++){
      if(results[i].status!=="fulfilled"){warnings.push(feeds[i].label+" unavailable");continue;}
      const r=results[i].value;
      if(i<2){
        groups[i]=(Array.isArray(r?.data)?r.data:[]).map(p=>{
          const id=p?.relationships?.base_token?.data?.id;
          return typeof id==="string"&&id.startsWith("solana_")?id.slice(7):"";
        });
      }else{
        groups[i]=(Array.isArray(r)?r:[]).filter(t=>t.chainId==="solana").map(t=>t.tokenAddress);
      }
    }
    const result=new Map(),perFeed=[9,9,6,4];
    for(let i=0;i<groups.length;i++)for(const mint of groups[i].slice(0,perFeed[i])){
      if(mintOK(mint)&&!result.has(mint))result.set(mint,feeds[i].label);
    }
    const mints=[...result.keys()].slice(0,Math.max(1,Math.min(30,limit)));
    if(!mints.length)throw Error("No confirmed Solana token mints in discovery feeds: "+warnings.join("; "));
    const pools=await this.json(DEX+"/tokens/v1/solana/"+mints.join(","));
    if(!Array.isArray(pools))throw Error("DEX pool snapshot unavailable");
    const best=new Map();
    for(const p of pools){
      const mint=p?.baseToken?.address;
      if(!result.has(mint)||!validPool(p,mint))continue;
      const current=best.get(mint);
      if(!current||(Number(p?.liquidity?.usd)||0)>(Number(current?.liquidity?.usd)||0))best.set(mint,p);
    }
    return {pools:[...best.values()],warnings,discovered:mints.length};
  }
  async pool(mint){
    if(!mintOK(mint))throw Error("Invalid Solana mint");
    const pools=await this.json(DEX+"/token-pairs/v1/solana/"+mint);
    return ranked(pools,mint);
  }
  async risk(mint){
    if(!mintOK(mint))throw Error("Invalid Solana mint");
    return this.json(RUG+mint+"/report/summary");
  }
  async candles(pool,mint){
    if(!validPool(pool,mint))throw Error("Pool and token mismatch");
    const url=GT+"/networks/solana/pools/"+pool.pairAddress+
      "/ohlcv/minute?aggregate=5&limit=80&currency=usd&token="+mint;
    return this.json(url);
  }
}
module.exports={PublicSolanaFeeds,validPool,ranked};
