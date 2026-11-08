# ⚔ Crimson AutoTrader — Autonomous Paper Engine

**Status: working code foundation / PAPER ONLY. Not a live or deployed trading service.**  
The current engine **never accesses a wallet, signs a transaction, broadcasts an order, or pays network fees.** It autonomously makes simulated decisions when running on your MacBook or a secure server.

## Quick start on a MacBook

Install [Node.js 20 or later](https://nodejs.org/) and use a local copy of the repository. In Terminal:

```bash
git clone https://github.com/malusayf/crimson-intel.git
cd crimson-intel
node --version
node bot/test.cjs
node bot/main.cjs once
node bot/main.cjs run
```

Open the **local-only** status page at `http://127.0.0.1:8787` while the runner is active. Alternatively, in the `bot/` directory use `npm test` or `npm start`. This is **not** your public GitHub Pages site. Closing Terminal or turning the computer off stops the bot unless you deploy an always-on process.

To inspect/control the process, open **another Terminal window** in the repository:

```bash
node bot/main.cjs status
node bot/main.cjs pause
node bot/main.cjs resume
node bot/main.cjs kill
node bot/main.cjs clear-kill
```

- **pause:** blocks new modeled buys, but allows modeled protective sells.
- **kill:** blocks *all* modeled orders, **including simulated stop-loss sells**. Use with care.
- **clear-kill:** removes that control flag, but **does not enable live trading**.
- Persistent state, logs, and control flags live in `bot/.data/` and are excluded from Git.

**Never paste or commit a seed phrase, wallet keypair, RPC secret, API key, or private signer into the GitHub Pages frontend.**

## Strategy behavior

1. Every ~3 minutes, discover a *limited* sample of Solana pools using GeckoTerminal and DEX Screener profiles/promotions.
2. Require sufficiently liquid pools, meaningful trade and dollar volume, 5m/1h directional alignment, and pool age ≥1h.
3. Require a current, complete RugCheck summary, no severe findings, no more than one warning, known ≥75% locked LP, and a normalized score ≤25. Missing data **fails closed**. Passing does **not** prove safety.
4. Require ≥28 completed **five-minute candles**, a recent valid ATR/support level and a bullish confirmed-close breakout following a pullback. This is a deterministic **PSM-inspired proxy, NOT your complete manually marked 0ABC system**.
5. Risk-size a **paper long**; model price slippage and a fixed fee; create a locked Entry/SL/TP1/TP2/TP3 based on the modeled entry.
6. Monitor open positions about every 25 seconds while running; model 25% exit at TP1, another 25% of the *original* size at TP2 and the remainder at TP3. On an emergency condition, attempt a modeled full exit. No actual swap route is checked.
7. Keep every paper decision, simulated fill, loss, and risk warning in the local account journal.

**Default paper limits** (configurable only through runtime environment, not the public website):

| Rule | Default |
| --- | --- |
| Starting paper balance | $1,000 |
| Maximum simultaneous positions | 2 |
| Maximum position notional | 5% of simulated equity and $100 |
| Maximum planned position risk | 0.5% of simulated equity |
| Maximum pool allocation | 0.2% of reported USD pool liquidity |
| Daily loss entry halt | 3% of start-of-day simulated equity |
| Peak-to-current drawdown entry halt | 10% |
| Maximum new trades / day | 5 |
| Simulated price slippage | 0.5% each side (simplifying assumption) |
| Fixed modeled fill fee | $0.10 each order |
| Re-entry cooldown after closing | 1 hour |

Example configuration for the current terminal session on macOS/Linux:

```bash
export BOT_PAPER_START_USD=1000
export BOT_MAX_OPEN=2
export BOT_RISK_PER_TRADE=0.005
export BOT_MAX_DAILY_LOSS=0.03
export BOT_MAX_TRADE_USD=100
node bot/main.cjs run
```

**Important limitations:** A fixed slippage assumption is **not** a sellability check; stale data, sandwich attacks, tax/transfer restrictions, rug pulls, and market gaps are not realistically simulated. A stop-loss price does not guarantee a sell fill. GeckoTerminal and RugCheck feeds can be unavailable, incomplete, rate limited, or subject to CORS, schema or access changes. If confirmation or security verification is unavailable, new buys are skipped. The engine uses one pool's observable trade counts, which are not net dollar inflow, distinct buyers, or proof against wash trading.

## Engineering milestones to support fully autonomous *real* buys and sells

These are **not implemented** and are hard blockers to enabling a real wallet.

1. **Dedicated limited-funds bot wallet** created offsite / on a secure private server. Use the main wallet only to fund this segregated wallet. Never store a wallet key in GitHub, JS frontend, screenshots, logs or public environment variables.
2. **Private live execution service** using a supported Jupiter Swap API v2 quote/order and execution path with explicit fee, slippage, liquidity, transfer-restriction, route and token identity checks. Handle quote expiration, unsigned transaction simulation, signing, submission, confirmations and duplicate/ambiguous transactions safely. Public DEX prices must *never* be passed off as Jupiter executable quotes.
3. **Independent wallet balance reconciliation** from RPC, persistent token decimals and cost basis, real fee accounting, and idempotent order identifiers. An order submitted but not yet confirmed is *not* permission to submit another.
4. **Real protective stops:** server-side continuous monitoring, independent price/route checks, emergency exit attempts, tradeable amount checks and kill-switch semantics. Stops can fail during rugs or liquidity loss.
5. **Secure hosting and operations:** process supervision, persistent database and backups, strict admin authentication, encrypted secrets/signing service, RPC rate controls, alerting, audit logs, tests, emergency shutdown, and endpoint protection.
6. **Trading-validation gates:** forward-testing under realistic quotes/costs, independent review of the full PSM 0ABC entry model (including point markers and close-confirmation/expiry), failure and manipulation tests, position-size caps and a deliberately funded pilot.

A Github Pages page **cannot** safely sign transactions or continuously trade when closed. The current Node runner is a prototype for an independent, always-on backend, **not** a production order router.

## Validation

`node bot/test.cjs` provides no-network unit/integration tests for the market filter, failed-security handling, completed-candle entry, modeled buy, TP1 partial sale, pause, kill and TP3 exit. These **do not** substitute for testing exchange quotes, live pool conditions, order confirmation, or deployment resilience.

**Do not fund this code or treat its simulated returns as proof of profitable strategy performance.**
