# Crimson AutoTrader — Railway live-only service

## Current actual status (2026-11-08)

- **Railway private operator API:** Deployed at `https://crimson-operator-api-production.up.railway.app`.
- **Phantom authentication:** Owner-only Ed25519 signed message with one-time challenge.
- **Existing Phantom SOL:** Read-only balance view and allocation preview; no automatic spending permission granted.
- **Journal:** Persistent Railway volume at `/data`; `live-trades-v1.json` records **only finalized dedicated-bot-wallet transactions** from a future trusted executor.
- **No paper scanner:** The former paper process and paper API were stopped; its previous `paper.json` remains archived separately in the persistent volume and is not imported into live results.
- **Real-money execution:** **NOT BUILT OR ENABLED.** `/start` returns 409 until signer, Jupiter execution, reconciler and verified risk controls are complete.
- **Funds moved by Crimson:** None.

The public Github Pages site loads `crimson-live-console.js` (no paper controls).

## Private service configuration

Railway service source: `malusayf/crimson-intel`, root directory `/bot`, start `node operator-server.cjs`. Healthcheck `GET /health`. One replica and a 256 MB persistent volume mounted at `/data`. TLS is terminated by Railway.

Environment variable **names** (never publish their secret values):

```text
BOT_FRONTEND_ORIGIN=https://malusayf.github.io
BOT_BEHIND_TLS_PROXY=true
BOT_OWNER_PUBLIC_KEY=your-Phantom-public-address
BOT_DATA_DIR=/data
BOT_AUTORUN_PAPER=false
```

Optional private `JUPITER_API_KEY` allows the existing authenticated **quote-only** endpoint. The key must be set directly in Railway, never in the website or chat.

Do not configure `BOT_DEDICATED_WALLET_ADDRESS` until a distinct dedicated wallet is created with a tested recovery method. A public address alone does not make the signer safe or executable.

## When real trading is implemented

The private worker must record each intended order before signing, obtain a fresh Jupiter order, validate route/fees/slippage/price impact and token identity, sign with the **dedicated** wallet only, submit to Jupiter, and independently finalize on Solana. The future executor must call `LiveTradeJournal.recordFinalized` for every successful buy or sell. Any uncertain transaction stays pending until reconciled and must not be retried as a fresh spend. Journal prices reflect finalized wallet-net SOL per token and explicitly include fees/rent adjustments. CSV exports remain restricted to the authenticated owner.

Before funding, require verified emergency controls, spending limits, a single-writer durable database, crash/restart/retry tests, detailed trade history, separate key recovery, and a tiny explicitly approved real-funded pilot. Phantom is used only as the owner and funding wallet, not as a secret source.

## Verification

```bash
cd bot
npm test
```

This runs live-journal synthetic finalized-transaction tests, owner-authentication/HTTP security tests, and Jupiter quote-only tests. It does not validate real wallet custody, route execution, production risk management or market profitability.

**No bot funding or real swaps are authorized by deploying this control plane.**
