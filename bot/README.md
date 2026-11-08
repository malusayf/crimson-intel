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

Crimson Intel now has a **Robinhood Chain (4663)** section next to the Solana and AutoTrader sections. It includes:
- GeckoTerminal network-4663 DEX trending and new pools with observed price, liquidity, transaction buys/sells and 24-hour volume/change.
- Canonical Robinhood Stock Token registry lookup by issuer ticker, name or full contract address.
- Robinhood Stock Token underlying equity USD bid/ask, adjusted using the issuer's current shares-per-token multiplier; raw equity volume is not token DEX volume.
- Public contract and DEX pool explorer links, visibly stale data when upstream APIs temporarily fail, and browser-local watchlist.

Public read-only endpoints: GET /robinhood/pools?view=trending, GET /robinhood/pools?view=new, GET /robinhood/stocks?q=AAPL, GET /robinhood/stock-quote?symbol=AAPL and GET /robinhood/pool?address=<40-hex-EVM-address>. Every server-side upstream hostname is fixed, and no Robinhood API credentials, wallet secrets or trading authorization are involved. Public data is subject to caching and upstream availability. No holder count or safety audit is claimed where data is absent.

Stock-token names are trusted **only when the issuer registry includes the exact contract address on Robinhood Chain id 4663**. A matching ticker or logo from a DEX is not official issuance. The backend does not grant token tradability or eligibility.

**U.S. restriction:** Robinhood Stock Tokens are issued as debt securities providing exposure to an underlying asset, not underlying share ownership. Robinhood states these securities may not be offered or sold to U.S. persons; this feature is for research and observation only. It does NOT extend the Solana trading bot to EVM, Robinhood Chain or securities, or trade any Robinhood assets.

Sources:
- https://docs.robinhood.com/chain/stock-token-apis/
- https://docs.robinhood.com/chain/stock-tokens/
- https://api.geckoterminal.com/docs/index.html
