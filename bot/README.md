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


## Phantom → Connect → Start Live integration (2026-11-07)

**Private operator authentication has been added; real-money execution remains explicitly locked and unimplemented.**

The new frontend `crimson-phantom-live.js` (in AutoTrader tab) can:
- Connect your Phantom extension to read the public wallet address only.
- Contact an optional private operator API URL and ask Phantom to **sign a login message** (not a transaction).
- Authenticate that signature against `BOT_OWNER_PUBLIC_KEY` on the server, using an expiring one-time nonce and an in-memory owner session.
- Display private backend status, isolated bot wallet configuration and live execution readiness.
- Present Start Live / Stop / Emergency Stop buttons; **Start Live stays disabled unless a private backend explicitly reports a verified signer/executor and wallet ready**.

The new `bot/operator-server.cjs` is only a **control-plane scaffold**. It does not produce signed swaps. Its `/start` endpoint always returns **409 Not Configured**. Neither the UI nor server asks for your Phantom seed phrase.

### Operator authentication testing (localhost)

1. Configure only the *public* owner Phantom address in the **private server environment** as `BOT_OWNER_PUBLIC_KEY` (not a seed phrase).
2. Use `BOT_FRONTEND_ORIGIN=https://malusayf.github.io` and run `node bot/operator-server.cjs` on an authorized private computer.
3. Run `node bot/operator-test.cjs` for fail-closed/API checks.
4. In Crimson Intel AutoTrader, connect Phantom and set your **HTTPS operator server origin**. The frontend can authenticate with a signed message. The private server must be correctly hosted behind HTTPS and must not expose raw insecure HTTP to the Internet.
5. The currently provided localhost-only `http://127.0.0.1:8788` server is for developer testing. A public GitHub Pages page may be blocked from accessing localhost due to browser private-network restrictions. An authenticated HTTPS private endpoint with carefully restricted CORS, network security, CSRF protections and rate controls is needed for cross-device production use.

### Requirements before enabling unattended live trades

- User-approved configuration for **a newly generated, dedicated, limited-funds bot wallet**; separate from the user's everyday Phantom wallet. Phantom is the ownership/funding account; normal browser wallet connections cannot automatically sign every unattended swap.
- A trusted signer in a secure private environment; access controlled with strong owner authentication, no private keys sent to the browser, website, repository or ordinary logs.
- Build a supported, currently verified Jupiter Swap v2 quote/order/execution adapter and on-chain confirmation handling, including route constraints, quote expiration, exact in/out amounts, fees, token transfer rules, retries, token decimal validation, transaction simulation, signer authorization and idempotency.
- Persistent durable trade state and reconciliation; an uncertain submitted swap must never be retried as a separate new swap until chain status is reconciled.
- Real account-value risk limits, daily maximum loss, per-trade and aggregate exposure limits, fee and slippage limits, and emergency-stop controls that **stop new entries but consider existing open risk**. A fully destructive kill may prevent protective exits.
- Robust server infrastructure, independent monitoring, operator alerts, audited signer and forward-testing.
- **Start Live is intentionally disabled until those are complete**. A UI switch should never claim to authorize use of a public Phantom wallet's funds silently.

### Security warning

Do not use a primary Phantom wallet secret key for unattended trading. Never provide seed phrases, wallet private keys or OTP/recovery data in chat. A dedicated bot wallet funded with a deliberately small amount reduces (but does not eliminate) the loss from a compromised signer or bot failure.

