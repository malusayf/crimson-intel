# Crimson Intel — PSM Fusion DEX Research Beta

Updated 2026-11-10. This is **read-only research** in the existing Crimson Intel dashboard, next to the selected DEX chart. It is **not** a TradingView Pine plugin installed inside DEX Screener. It does not change the working `malusayf/PSM-V4` v5.3 script, the existing position/Guardian calculations, account login, Robinhood tracker, or the Phantom live trading bot.

## Open it

Visit https://malusayf.github.io/crimson-intel/ and sign in as usual. On the **Dashboard** tab, track a Solana mint or Robinhood Chain DEX token, then scroll below the **DEX chart** for **PSM Fusion · DEX Research Beta**. Select a chart timeframe: 1m, 5m, 15m, 1h or 4h; the matching confirmed higher timeframe is 5m, 15m, 1h, 4h or daily. Daily is intentionally marked unsupported for PSM Trading, because the public OHLC provider does not offer a higher timeframe that can satisfy v5.3's HTF filter.

The panel fetches read-only candles for the exact tracked `pair.pairAddress` and the exact `mint` as the base token. It uses GeckoTerminal public `/api/v2/networks/{network}/pools/{pool}/ohlcv/{timeframe}` (300 bars, USD, token=tracked mint) rather than assuming DEX Screener snapshots contain candle history.

Shows:

- Blue **EMA 21** and orange **EMA 55** numerical values (both based on the selected chart interval)
- Confirmed higher-timeframe 55 EMA direction
- RSI 14, ATR 14 and previously confirmed pivot 3/3 structural breakout
- Heikin Ashi direction from a 2-bar consensus, computed from ordinary pool OHLCV for **visual information only**
- Separate MACD (12,26,9) momentum direction and histogram from regular OHLCV, plus whether HA and MACD agreed **at the latest original PSM signal**
- The most recent qualified PSM BUY/SELL reference in the available candle sample, illustrative entry/SL, TP1=1R, TP2=2R, TP3=3R and **candle-based** status (stop first on an ambiguous bar)
- Existing selected pool's estimated liquidity, 5m/1h BUY and SELL **transaction counts**, and 24h volume

The core is `crimson-psm-engine.js` and the UI is `crimson-psm-panel.js`. These two files are only imported into `index.html`; no other existing market analysis module is changed.

## Safety and caveats

This is a JavaScript adaptation of the **Trading mode** of the v5.3 rules, not a byte-for-byte Pine clone or verified TradingView backtest. Swing pivot tie behavior, history-window warm-up and vendor candle construction can differ from TradingView. EMA/RSI/ATR/MACD are based on standard USD pool candles rather than Heikin Ashi prices (even if the DEX Screener iframe displays HA candles). Only **completed candles** are used. For v5.3 stop rules, long SL is the lower of prior-35-bar low and 1.5 ATR below entry, short SL is the higher of prior-35-bar high and 1.5 ATR above entry; max accepted initial risk is 6 ATR. A confirmed higher-timeframe EMA filter is required.

- The UI must show unavailable if the pool, timeframe or HTF has insufficient **confirmed historical candles**, if provider data is stale, if base-token addresses mismatch, or if API requests fail. **No fabricated BUY/SELL**.
- The GeckoTerminal public API is third-party, has rate limits and caching. It might block cross-origin browser fetches, and Robinhood Chain pools may not be covered. No production browser end-to-end verification was possible in this environment. If a status reads `PSM data unavailable`, inspect the browser Console/Network panel; a CORS error would require a trusted same-origin/server-side proxy.
- It is a passive research panel. It never places or signs transactions and does **not** feed its levels to the existing live bot.
- Price observations are not executable swap quotes. Coin transaction counts are not unique wallets or holder changes. Slippage, fees, transfer taxes, low liquidity, MEV, and rug-pull risks are not reflected in projected reference targets.
- Read-only candle outcomes are not a verified portfolio P/L, realized trades, or performance estimates. Spot FX/TradingView comparisons need matching data providers and symbols.

## Static validation completed

1. Both new JavaScript files parse in a V8 engine.
2. Unit-like tests passed: invalid-pool rejection; complete-candle filtering; duplicated bar rejection; finite EMA, ATR, RSI and MACD output on synthetic series; strict missing-history errors; confirmed-HTF support.
3. Source inspection verified the original scripts for tracker, Guardian, portfolio and wallet/live console remain referenced and untouched.
4. **Still required:** Test a tracked real DEX pool in an authenticated desktop/mobile browser (including public API CORS and price comparison), inspect exact signal timestamps, benchmark history and compare versus TradingView v5.3 using equivalent real candles.

