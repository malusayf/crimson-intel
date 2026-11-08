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
