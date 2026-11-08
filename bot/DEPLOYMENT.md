# Crimson AutoTrader — private server & wallet deployment

**Current release: owner-authenticated control gateway and quote previews only. No real on-chain buy/sell executor is installed.** The Start Live API deliberately returns HTTP 409. No funds have been moved or wallet keys created in GitHub.

## Service shape

```
Phantom browser wallet (owner login & funding only)
      ↓ Ed25519 signed challenge
GitHub Pages → private HTTPS API (Railway)
      ↓ authenticated quote-only calls
Jupiter Swap V2 /order (no taker, NO signing)
      |
      [UNIMPLEMENTED] separately audited live signer & swap executor
      |
Dedicated bot wallet (local encrypted provisioner, NOT funded)
```

**Railway suggested in ChatGPT:** Connect Railway to let deployment tools operate on your account. Until that connection is confirmed, nothing has been deployed there.

## Prepare a private Railway service

1. Connect Railway in ChatGPT; select your private project and GitHub repo `malusayf/crimson-intel` for deployment. Treat the existing GitHub Pages site separately.
2. For the API service set **Root Directory** to `/bot`, using `bot/package.json`, `bot/railway.json`, and start command `node operator-server.cjs`. Railway should supply `PORT`, terminate HTTPS at its public domain, and run the service as an ordinary Node.js web process.
3. Configure these **private service variables** in Railway's secret/environment settings:
   - `BOT_OWNER_PUBLIC_KEY`: **only** your Phantom *public wallet address*; it is safe to paste into a private setting.
   - `BOT_FRONTEND_ORIGIN=https://malusayf.github.io`: exact origin of your public UI.
   - `BOT_BEHIND_TLS_PROXY=true`: only when deployed behind Railway's actual HTTPS proxy.
   - `JUPITER_API_KEY`: your private Jupiter API key, entered directly into Railway (never chat or GitHub).
4. Deploy the server, verify `GET /health` reports `liveTrading:false`, and use the HTTPS service origin in the AutoTrader → Phantom Owner Connection section.
5. In your browser, connect Phantom and sign the specific operator-login message. A normal wallet connect does **not** authorize signing swaps or spending money.
6. Check Backend: it should truthfully report `walletReady:false`, `liveExecutorReady:false`, `liveTrading:false`. **Start Live must stay disabled.**

This API's authorization sessions are kept in memory and expire after 4 hours. It is a developer scaffold, not a production-hardened treasury service; deployment behind HTTPS does not make it safe to fund a bot.

## Create a **separate** bot wallet locally (not in GitHub)

Only on your own trusted MacBook, after cloning the repository and installing Node.js 20+:

```bash
node bot/wallet-setup.cjs create
node bot/wallet-setup.cjs verify
node bot/wallet-setup.cjs show-address
```

`create` generates a new random Solana Ed25519 key, encrypts the 32-byte seed with password-derived AES-256-GCM, and writes the ciphertext and public address to ignored `bot/.data/` files. It asks for a strong passphrase with hidden input. It will not overwrite an existing keystore. **It never prints the seed phrase or private key.**

Keep an off-device backup of the **encrypted keystore and passphrase**. Losing either can permanently lock funds. Anyone who obtains both could steal the wallet. The current code does **not** import this wallet into a signer or execute real swaps. Do **not deposit funds yet**, because secure signing, key recovery and withdrawal functionality are not operational or audited.

## Status of execution infrastructure

| Feature | Status |
|---|---|
| Solana candidate research, TP/SL paper simulation, forward record | Implemented |
| Phantom public address connect + signed owner-only challenge | Implemented, needs live test |
| HTTPS-ready private operator server and health route | Implemented, not deployed |
| Jupiter quote-only route | Implemented, provider key required |
| Local encrypted dedicated-wallet creation + password verification | Implemented, requires user's device |
| Private signing service with audited custody and key isolation | **Not implemented** |
| Exact-mint, decimals, route checks and token sellability simulation | **Not implemented** |
| Confirmed real swaps, retry/idempotency, chain reconciliation | **Not implemented** |
| Durable production database, alerts, backups, risk engine and controls | **Not implemented** |
| Real-money Start button | **Intentionally disabled** |

## Before spending real funds

- Use a dedicated wallet with a deliberately small balance and a recovery method tested separately.
- Require a *verified* on-chain sell route and transaction simulation. Rug pulls, liquidity removal and token transfer rules can defeat a stop-loss.
- Validate filled quantities, fees, wallet balances, approval scope, RPC confirmation and retries. Treat uncertain transactions as potentially executed until reconciled.
- Restrict per-trade amounts, daily losses, total exposure, token risk, pool age, and chain fees. Never trade on stale/failed security feeds.
- Only after independent code review, realistic forward testing, private deployment, secret management and an explicit launch authorization should live execution be considered.

**Do not put Phantom seed phrases, private keys, keystore passwords, API keys, or recovery information into ChatGPT or a GitHub repository.**
