# Crimson AutoTrader — LIVE ONLY production setup

## Current deployment state

Railway serves the private owner-authenticated API at
https://crimson-operator-api-production.up.railway.app and GitHub Pages hosts
https://malusayf.github.io/crimson-intel/ .

**The feature is opt-in and OFF by default.** The code includes a dedicated-wallet signer, Jupiter Swap V2 /order → /execute adapter, persisted order intents, Solana finalized-receipt reconciliation, real buy/sell ledger, and a scanner-driven worker. **Deployment is not evidence that trading is safe or has been tested with actual SOL. No trade should be started until recovery, security review, and a tiny pilot have been independently completed.**

No paper mode, paper UI, simulated transactions or simulated entries are used by this live worker.

## Mandatory private configuration

Use Railway > crimson-operator-api > Variables. Set directly in Railway, **never in ChatGPT, GitHub, GitHub Pages, screenshots or logs**. Variables with secret contents should use Railway's secret/sealed option where available.

| Variable | Meaning |
| --- | --- |
| BOT_OWNER_PUBLIC_KEY | Existing PUBLIC Phantom owner wallet address |
| BOT_FRONTEND_ORIGIN | https://malusayf.github.io |
| BOT_DATA_DIR | /data (persistent volume attached) |
| BOT_BEHIND_TLS_PROXY | true |
| BOT_LIVE_SCANNER_ENABLED | true |
| BOT_DEDICATED_WALLET_ADDRESS | PUBLIC address of a separate dedicated bot wallet, distinct from Phantom |
| BOT_SIGNER_SEED_BASE64 | **SECRET**, 32-byte SEED encoded as base64, extracted only locally from the encrypted bot-wallet keystore |
| JUPITER_API_KEY | **SECRET** Jupiter Developer API key for /swap/v2/order and /execute |
| SOLANA_RPC_URL | **SECRET** trusted mainnet Solana RPC HTTPS endpoint; must support finalized getTransaction and getTokenAccountsByOwner |
| BOT_RECOVERY_VERIFIED | true **only after verifying wallet backup and recovery locally** |
| BOT_LIVE_PILOT_APPROVED | true **only after independent review and explicit approval of tiny real-SOL pilot** |
| BOT_LIVE_EXECUTION_ENABLED | true to arm the server's Start Live readiness; does NOT auto-start after a restart |
| BOT_MAX_TRADE_SOL | 0.005 for initial pilot (hard maximum 0.05) |
| BOT_MAX_DAILY_SPEND_SOL | 0.02 for initial pilot (hard maximum 0.1) |
| BOT_MAX_DAILY_LOSS_SOL | 0.01 for initial pilot (hard maximum 0.03; realized SOL loss only) |
| BOT_MAX_OPEN_LIVE | 1 for pilot (maximum 2) |
| BOT_MAX_DAILY_LIVE_BUYS | 2 for pilot (maximum 4) |

Leave BOT_LIVE_EXECUTION_ENABLED unset or false until review, restore verification, RPC and Jupiter connection checks have passed. Existing BOT_AUTORUN_PAPER and BOT_PAPER_START_USD variables are obsolete and are never used by the live controller.

## Dedicated wallet setup — on your own Mac, never in chat

From Terminal in the repository's bot/ directory:

~~~sh
npm install
npm run wallet:create
npm run wallet:verify
npm run wallet:address
~~~

Create a reliable offline backup of the encrypted keystore **and** its separate passphrase, then verify decryption and recovery. **Never import Phantom's existing wallet or recovery phrase.**

After independent recovery verification, run the following on the same Mac to place the dedicated-wallet SEED **only in your local clipboard**, with a hidden passphrase prompt:

~~~sh
npm run wallet:railway-secret
~~~

Paste the clipboard directly into the **private** Railway variable BOT_SIGNER_SEED_BASE64. Clear the clipboard. Put the corresponding PUBLIC address in BOT_DEDICATED_WALLET_ADDRESS. The API checks that the secret actually derives the advertised address.

Only after all tests and controls have passed, fund the dedicated wallet from Phantom by copying the **bot deposit address** in the website and using Phantom's normal Send flow. Confirm the entire address in the trusted local wallet utility, start with an amount you can afford to lose and **retain a SOL fee reserve**. There is no auto-debit of your Phantom account.

## Controls and ledger

The private API requires an owner-only Phantom signed login challenge. The controls are:

- POST /start with {"confirmed":true} — starts real-money auto-scanning and trading **only when all private conditions are met**.
- POST /stop or /emergency-stop — stops the worker from initiating further orders. Already-signed in-flight orders may still settle; existing token positions remain in the wallet, and automatic exits also stop.
- POST /live/reconcile — retries chain verification of an unresolved signed order; it **does not submit a second order**. If resolution is uncertain, keep the bot halted and review the transaction with a wallet explorer and trusted RPC.
- GET /live/trades and /live/trades.csv — only finalized and verified on-chain swaps, effective net SOL paid/received, entry/exit token quantities, and fees.
- GET /wallet/bot-sol-balance — read-only confirmed bot wallet balance.

A new order is first written durably to /data/live-controller-v1.json. The signed transaction signature is persisted **before** sending it to Jupiter. On ambiguous outcomes, automation halts until that signature is independently reconciled; it never retries as a fresh purchase. Journal data is independent of archived paper records.

**Strategy limitation:** The current scanner's completed-candle entry rule is a conservative pullback proxy, **not** the user's manually anchored PSM 0ABC strategy. It has not been independently backtested for profitable production trading. Exit levels and sell-route availability cannot be guaranteed. A pool can suffer a rug pull or liquidity collapse before an order executes. Realized SOL-loss budget does not capture unrealized losses.

**Operational limitations:** In-memory owner sessions are invalidated on server restart; live execution does not automatically resume after restart. If the worker fails, open positions remain in the dedicated wallet and may require manual sale. A single Railway replica and persistent volume are essential to prevent concurrent signers writing over each other's state.

## Verification before funding

~~~sh
cd bot
npm install
npm test
~~~

The test suite is deliberately non-funding and does not execute swaps. Code tests and a successful Railway deploy are necessary but insufficient. Independently inspect the signer, quotes, order payer and token identity, fees, execution journal, ambiguous timeouts, crash recovery, CORS auth and emergency stop before approving any real trade.

No seed phrases or private keys belong in support chats.
