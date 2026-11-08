"use strict";
const assert=require("node:assert/strict");
const {RobinhoodMarket,parseStock}=require("./robinhood-market.cjs");
async function run(){
 let now=1000000,fail=false,calls=[];
 const contract="0xAbCdEf0123456789AbCdEf0123456789AbCdEf01";
 const imposter="0x1234567890123456789012345678901234567890";
 const poolAddress="0x2222222222222222222222222222222222222222";
 const api={
  assets:{assets:[{tokenSymbol:"AAPL",tokenName:"Apple • Robinhood Token",
   currentMultiplier:"2.000000000000000000",status:"ASSET_STATUS_ACTIVE",
   deployments:[{contractAddress:contract,chainId:4663}],
   tradingCapabilities:{market:{fractional:"TRADING_STATUS_TRADABLE"}}},
  {tokenSymbol:"AAPL",deployments:[{contractAddress:imposter,chainId:9999}]}]},
  quote:{quotes:[{tokenSymbol:"AAPL",bid:"200.00",ask:"200.20",
    currency:"USD",dailyTradingVolume:"10000",
    isTradingHalt:false,generatedAt:"2026-11-08T12:00:00Z"}]},
  dex:{data:[{attributes:{address:poolAddress,name:"Apple / WETH",base_token_price_usd:"401",
    reserve_in_usd:"20000",volume_usd:{h24:"35000",m5:"100"},market_cap_usd:null,
    transactions:{m5:{buys:4,sells:2},h24:{buys:20,sells:12}},
    price_change_percentage:{h24:"2.5"}},
   relationships:{base_token:{data:{id:"robinhood_"+contract.toLowerCase()}},
    quote_token:{data:{id:"robinhood_"+imposter.toLowerCase()}}}}],
   included:[{id:"robinhood_"+contract.toLowerCase(),
     attributes:{address:contract,symbol:"AAPL"}},
    {id:"robinhood_"+imposter.toLowerCase(),
     attributes:{address:imposter,symbol:"WETH"}}]}
 };
 const fetchFn=async url=>{
  calls.push(String(url));
  if(fail)throw Error("Upstream offline");
  let result;
  if(String(url).endsWith("/assets"))result=api.assets;
  else if(String(url).endsWith("/prices/AAPL"))result=api.quote;
  else if(String(url).includes("trending_pools"))result=api.dex;
  else if(String(url).includes("new_pools"))result=api.dex;
  else if(String(url).includes("/pools/"))result={data:api.dex.data[0],included:api.dex.included};
  else throw Error("Unexpected network destination");
  return {ok:true,text:async()=>JSON.stringify(result)};
 };
 const client=new RobinhoodMarket({fetchFn,clock:()=>now});
 assert.equal(parseStock(api.assets.assets[1]),null,"Other chains cannot become official 4663 tokens");
 const stocks=await client.stocks("AAPL");
 assert.equal(stocks.totalOfficialAssets,1);
 assert.equal(stocks.stocks[0].contract,contract);
 const quote=await client.quote("AAPL");
 assert.equal(quote.quote.perTokenBidUsd,400,"Multiply equity quote by shares-per-token");
 assert.equal(quote.quote.perTokenAskUsd,400.4);
 const pools=await client.pools("trending");
 assert.equal(pools.pools.length,1);
 assert.equal(pools.pools[0].issuerCheck,"issuer-listed");
 assert.equal(pools.pools[0].securityVerified,false,"Issuer match never proves safety");
 assert.equal(pools.pools[0].buys5m,4);
 assert.equal(pools.pools[0].liquidityUsd,20000);
 const detail=await client.pool(poolAddress);
 assert.equal(detail.pool.poolAddress,poolAddress);
 assert.equal(detail.mode,"READ_ONLY");
 api.dex.data[0].relationships.base_token.data.id="robinhood_"+imposter.toLowerCase();
 now+=61000;const other=await client.pools("trending");
 assert.equal(other.pools[0].issuerCheck,"not-issuer-listed","Fake ticker cannot impersonate RHJ");
 assert.equal(other.pools[0].securityVerified,false);
 assert.equal(other.pools[0].baseTokenAddress,imposter);
 const count=calls.length;
 await client.pools("trending");assert.equal(calls.length,count,"Market refresh is cached");
 fail=true;now+=61000;
 const stale=await client.pools("trending");
 assert.equal(stale.stale,true,"Outage must be visibly labeled stale");
 assert.throws(()=>parseStock({tokenSymbol:"BAD",deployments:[{contractAddress:"no",chainId:4663}]}).contract);
 await assert.rejects(()=>client.quote("UNKNOWN"),/Not listed/);
 await assert.rejects(()=>client.pool("https://evil.com"),/Invalid EVM pool/);
 console.log("PASS robinhood: official contract identity, per-token multiplier, real pool stats, caching, stale warnings, no arbitrary URL");
}
run().catch(e=>{console.error(e);process.exitCode=1;});
