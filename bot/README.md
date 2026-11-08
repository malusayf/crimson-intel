# Crimson AutoTrader — Live-only operator and verified trade journal

**Deployment status:** Owner-authenticated Railway control API is online. **Real trading is disabled**, because the dedicated signing wallet and audited swap executor are not yet installed. The paper scanner was disabled and removed from the website and operator API. Its earlier private data is archived separately and **never appears as real trade history**.

## What you can use now

- Connect Phantom in the [Crimson Intel AutoTrader](https://malusayf.github.io/crimson-intel/) tab.
- Verify Phantom ownership by signing a login **message**, not a spending transaction.
- View your read-only native SOL balance and preview a proposed funding allocation.
- Inspect the **Real Trade Journal**. It will be empty until an authenticated dedicated-wallet executor sends and finalizes genuine swaps.
- Download a CSV containing only confirmed real trades once there are records.

## Required before Start Live can be unlocked

1. Generate and verify a **dedicated, limited-funds trading wallet** on a trusted machine; do not share any seed phrase, private key or password in ChatGPT, browser code or GitHub.
2. Build and independently verify a secure signer isolated from GitHub Pages, with backups and recovery tested before funding.
3. Connect a production Jupiter Swap V2 `GET /order` → sign → `POST /execute` path. Verify token mint, amount, slippage, expiry, fees, signed transaction, confirmation status and final account balances.
4. Persist an intent **before** submission, reconcile uncertain transaction outcomes before retry, and use idempotent execution IDs. A network timeout must never trigger a duplicate trade.
5. Enforce hard aggregate SOL exposure, per-trade spending, daily losses, portfolio concentration, liquidity and sell-route checks, stop controls and operational alerts. Stops **cannot** guarantee exit if liquidity disappears.
6. Run extensive forward tests with realistic network conditions and small-fund pilot validations **before** automatically spending SOL. The original manually anchored 0ABC strategy is not yet codified/validated as an autonomous entry signal.

## Verified real-transaction journal

`live-journal.cjs` provides `recordFinalized(intent)`, for use **only from a future trusted private execution worker**, not from the public HTTP API. It:

- Queries Solana `getTransaction` with `commitment: finalized`.
- Verifies the intended dedicated wallet was a signer and the transaction actually succeeded.
- Checks that the token quantity change and native SOL movement support the intended buy or sell.
- Rejects transactions with extra token-asset movements rather than inventing a price.
- Records the transaction signature, finalized block time and slot, trade side, token amount, fee and effective **SOL/token** entry or exit price.
- Prevents duplicate entries by signature; writes the journal atomically to persistent `BOT_DATA_DIR`.
- Does not include fabricated fills, paper data or user-entered estimated prices.

**Price note:** This is *effective net wallet SOL per token* including network fees and token-account rent changes. To distinguish raw Jupiter fill prices from fees, we must add independently verified Jupiter execution receipts and corresponding chain reconciliation. USD valuation and realized P/L require an explicit cost-basis method and time-aligned exchange-rate source.

Read-only authenticated endpoints: `GET /live/trades`, `GET /live/trades.csv`.
All write access remains internal. No HTTP endpoint can manually fabricate a real trade.

## Developer checks

From the `bot/` directory, using Node.js 20+:

```bash
npm test
node wallet-setup.cjs create
node wallet-setup.cjs verify
node wallet-setup.cjs show-address
```

Wallet commands execute locally only; **do not fund the address yet**. The encrypted keystore remains in ignored `bot/.data/`, not on Railway or GitHub.

The production server uses `node operator-server.cjs`. It serves owner login, readiness checks, SOL balance and a read-only live journal, **not trading execution**.

## Safety

Never put Phantom recovery phrases or private keys in this repository or website. Never infer buy/sell confirmations from a DEX price snapshot. Live trading with meme coins can lose the entire allocated balance and may be impossible to exit during a rug pull.
