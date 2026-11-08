# Crimson Intel — Guardian and Command Center upgrade (2026-11-07)

## Installed in GitHub Pages source

- `crimson-guardian.js`: Per-account, per-token locked SL / TP plans; actual sale ledger (manual % and execution price); realized and unrealized spot-long P/L; trade-size-to-liquidity *risk proxy*; user-entered swap-preview net proceeds comparison; price, observed liquidity, market-danger and RugCheck browser warnings.
- `crimson-command-center.js`: Manually entered multi-token spot portfolio; public DEX Screener price snapshots; concentration warnings; trade-size/volume anomaly heuristics; documented token research links; forward-only signal observation ledger, 60+ minute revisits, CSV export; evidence-based, non-generative summaries.
- `crimson-position-intelligence.js`: publishes a read-only `crimson:position-plan` event for Guardian, no change to existing TP and SL calculations.
- `index.html`: loads both new additive scripts alongside the existing tracker, unified radar, safety scanner, investment calculator, price alerts and Firebase accounts.

## Verification performed
- GitHub file commits and source references verified.
- JavaScript syntax checks passed for new/existing non-module browser scripts and inline HTML scripts.
- Static checks show all old script references, calculator inputs and alert controls remain present.
- **No authenticated browser smoke test or production API end-to-end test has been performed.**

## Scope and data-quality guardrails
- Locked levels remain frozen on the client when the separately refreshed reference calculator changes.
- Browser-local storage is partitioned by signed-in user's email hash. **This is partitioning, not encryption or cross-device sync.** Do not store passwords, secrets or wallet private keys.
- Transactions, holder identities and developer reputation cannot be inferred from count-based DEX market metrics. Anti-fake-volume indicators are **research flags only, not proof**.
- Sell-preview output is manually entered and expires as a freshness indicator; **there is no authenticated live swap-quote provider**. Liquidity percentage is not executable price impact.
- Background monitoring, push notifications when the browser is closed, on-chain wallet clustering, deployer tracing, and real-time authenticated Jupiter quote routing remain **not connected**. They require a secure service, provider access and separate testing.
- Signals and P/L are observational/illustrative, not verified trading outcomes. No automatic swaps or trade placement.

## Browser smoke-test checklist
1. Sign in and force-refresh the GitHub Pages site, check that Guardian and Command Center appear.
2. Track a Solana coin; verify existing tracker, radar, money-flow and Safety Scout still work.
3. Enter investment amount and entry price; wait for valid 5m structure, then lock a plan. Check prices remain frozen after live refresh.
4. Record one manual 25% sale at an actual price; verify remaining quantity and realized P/L, then undo.
5. Enter a fresh wallet sell-preview amount; compare to the spot estimate. Confirm it is explicitly **manual**.
6. Add two holdings; refresh portfolio and check P/L/concentration and remove one.
7. Examine anomaly/evidence report and CSV export; no wallet-insider claims.
8. Test account logout/login with a different account to verify local positions remain partitioned.
9. When a public API is unavailable, verify that the section shows an error or unavailable state rather than inventing prices.

## Future backend phase
- Secure server-side Jupiter quote adapter with verified mint decimals, gross/net fees, route availability and token exit restrictions.
- Indexed Solana transaction data via authenticated providers (wallet-ownership analysis, holder links, deployer transaction history).
- Reliable periodic monitoring with persisted timestamped snapshots, deduped notification delivery, opt-in controls and alert history.
- Backtest/forward-test framework with independent labels, latency, costs, missing-data handling, and false-positive analysis.
