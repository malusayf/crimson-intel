# Crimson AutoTrader — LIVE ONLY

The owner-authenticated operator API and public website dashboard are in this repository. There is **no paper-trading feature**. The real-money execution worker is **disabled by default** and does **not** auto-start on deployment.

The code now contains a dedicated-wallet signer, Jupiter Swap V2 /order and /execute, a persistent pending-intent safety lock, automatic buy/sell scanning, stop controls, and a finalized on-chain trade journal. It has **not** been proven safe for unrestricted funds, independently audited, or tested with real SOL. **Do not fund or start it until private signer recovery and the tiny pilot are independently verified.**

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for exact Railway variable names, local Mac wallet setup, clipboard transfer of the seed directly into Railway (not ChatGPT), strict pilot limits, the Phantom manual Send funding workflow, reconciliation rules and limitations.

## Local non-funding checks

```bash
cd bot
npm install
npm test
```

The current automatic signal uses a cautious completed-candle pullback proxy. It is **not** the user's manually anchored PSM 0ABC setup. Stop-loss and take-profit references may fail to execute when liquidity disappears. The journal records verified SOL/token wallet-net changes, not guaranteed swaps or hypothetical fills. Existing paper data remains separate and never counts as real trading.

Website: https://malusayf.github.io/crimson-intel/  
Railway API: https://crimson-operator-api-production.up.railway.app

## Robinhood Chain Intelligence (read-only, independent of AutoTrader)

Crimson Intel now uses **one shared token tracker** with a network switch for Solana or Robinhood Chain (4663). Robinhood discovery appears in Discover, not as a separate analytics workflow. Both networks can feed the same Market Dashboard, Positions & Guardian, Portfolio, and Price Alerts screens. The read-only Robinhood discovery feed includes:
- GeckoTerminal network-4663 DEX trending and new pools with observed price, liquidity, transaction buys/sells and 24-hour volume/change.
- Canonical Robinhood Stock Token registry lookup by issuer ticker, name or full contract address.
- Robinhood Stock Token underlying equity USD bid/ask, adjusted using the issuer's current shares-per-token multiplier; raw equity volume is not token DEX volume.
- Public contract and DEX pool explorer links, visibly stale data when upstream APIs temporarily fail, and browser-local watchlist.

Public read-only endpoints: GET /robinhood/pools?view=trending, GET /robinhood/pools?view=new, GET /robinhood/stocks?q=AAPL, GET /robinhood/stock-quote?symbol=AAPL, GET /robinhood/pool?address=<40-hex-EVM-address> and GET /robinhood/token?address=<40-hex-EVM-address>. Direct token lookup reads highest-liquidity GeckoTerminal pools with the supplied token as the base asset and never confuses it with a quote-token price. Every server-side upstream hostname is fixed, and no Robinhood API credentials, wallet secrets or trading authorization are involved. Public data is subject to caching and upstream availability. No holder count or safety audit is claimed where data is absent.

Stock-token names are trusted **only when the issuer registry includes the exact contract address on Robinhood Chain id 4663**. A matching ticker or logo from a DEX is not official issuance. The backend does not grant token tradability or eligibility.

**U.S. restriction:** Robinhood Stock Tokens are issued as debt securities providing exposure to an underlying asset, not underlying share ownership. Robinhood states these securities may not be offered or sold to U.S. persons; this feature is for research and observation only. It does NOT extend the Solana trading bot to EVM, Robinhood Chain or securities, or trade any Robinhood assets.

Sources:
- https://docs.robinhood.com/chain/stock-token-apis/
- https://docs.robinhood.com/chain/stock-tokens/
- https://api.geckoterminal.com/docs/index.html

## Unified Solana + Robinhood Token Research Workflow

1. Open the main Market Dashboard, choose **Solana** or **Robinhood Chain**, and paste the proper network-specific token contract. Or click **Track + TP/SL** on a Robinhood Chain market in Discover.
2. Review the same USD price, pool liquidity, volume, transaction-pressure proxies, entry assessment and market-risk evidence. Values that the network provider did not report remain unavailable rather than becoming artificial zeroes.
3. In **Positions & Guardian**, enter the real entry price and invested USD. For a pool with credible completed 5m candles, Intel calculates a structural reference SL and 1R/2R/3R target prices. For a coin with unavailable candles, manually enter a stop below entry to see explicitly hypothetical 1R/2R/3R levels.
4. Guardian can lock one plan per **network + token**, record manual sales, and monitor available price/liquidity-risk alerts while the browser runs. A chain-4663 plan cannot overwrite a Solana plan. Existing Solana locked plans migrate to network-qualified keys.
5. Portfolio accepts Solana and Robinhood Chain holdings together, using actual indexed pools or an issuer-only reference when it is the only available pricing input. Missing/stale data is excluded from totals.

**Important scope and limits:** The market scanner's opportunity/danger scores are rules-based DEX transaction heuristics, not probabilities of profitability or contract audits. Only Solana mints use RugCheck; Robinhood Chain contract security is explicitly unverified. Robinhood-issued stock token prices may be an issuer-derived bid/ask midpoint multiplied by the current shares-per-token multiplier, not a swap quote; issuer markets can have no usable DEX pool. Watchlist, alerts and positions are not 24/7 services and do not execute orders. U.S. persons cannot be offered Robinhood-issued Stock Tokens under the issuer's terms. AutoTrader is still Solana-only and retains its own private live-trading safety gates.

Technical shared feed: the public browser-side CrimsonChainData adapter normalizes market observations into the same contract used by existing position and risk modules. It refuses a Robinhood DEX pool whose base token does not exactly match the selected EVM contract; it will not infer an issuer-backed stock from a ticker match.
