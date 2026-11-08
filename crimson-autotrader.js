/* Crimson AutoTrader dashboard: honest deployment/activation status.
   The public GitHub Pages website cannot hold wallet keys, trade while closed,
   or claim the private backend is online without a verified connection. */
(() => {
 "use strict";
 if(document.getElementById("ciAutoTrader"))return;
 const main=document.querySelector("main");
 if(!main)return;
 const css=document.createElement("style");
 css.textContent=[
 "#ciAutoTrader{border-color:#665070;background:linear-gradient(140deg,#21172e,#121b30)}",
 "#ciAutoTrader .ca-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:12px}",
 "#ciAutoTrader .ca-tile{padding:14px;background:#0b1327;border:1px solid #3a4460;border-radius:12px}",
 "#ciAutoTrader .ca-state{font-size:17px;font-weight:800;margin:6px 0}",
 "#ciAutoTrader .ca-small{font-size:12px;color:#bcc7e1;line-height:1.6;margin:7px 0}",
 "#ciAutoTrader .ca-red{color:#ff9bac}#ciAutoTrader .ca-green{color:#8cecc5}#ciAutoTrader .ca-yellow{color:#ffdaa0}",
 "#ciAutoTrader .ca-warning{border:1px dashed #7f6944;border-radius:10px;background:#2a2230;padding:12px;font-size:12px;color:#f2d4b3;line-height:1.6}",
 "#ciAutoTrader code{display:block;background:#080f21;padding:12px;border-radius:10px;overflow-x:auto;white-space:pre-wrap;font-size:12px}",
 "#ciAutoTrader .ca-links{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}",
 "#ciAutoTrader .ca-links a{display:inline-block;padding:9px 12px;border:1px solid #626489;border-radius:9px;background:#272c49}",
 ].join("\n");document.head.append(css);
 const panel=document.createElement("section");
 panel.id="ciAutoTrader";panel.className="panel";
 panel.innerHTML=[
 '<h2>🤖 Crimson AutoTrader · Fully Automatic Strategy</h2>',
 '<p class="ca-small">Designed to find candidate Solana tokens, apply strict risk and candle-confirmation gates, model buys, manage TP1–TP3 and SL, and maintain an execution journal. All wallet transactions are currently disabled.</p>',
 '<div class="ca-grid">',
 '<div class="ca-tile"><div class="label">AUTOMATED STRATEGY SOURCE</div><div class="ca-state ca-green">INSTALLED</div><p class="ca-small">Market filters, simulated entries, risk limits, partial exits, and tests in GitHub.</p></div>',
 '<div class="ca-tile"><div class="label">AUTONOMOUS PAPER SCANNER</div><div id="caPaperDeployment" class="ca-state ca-yellow">VERIFYING</div><p id="caPaperDescription" class="ca-small">The scanner runs privately on Railway when the backend reports a fresh journal update. Verify your Phantom owner wallet below to load its live status.</p></div>',
 '<div class="ca-tile"><div class="label">AUTONOMOUS LIVE TRADING</div><div class="ca-state ca-red">DISABLED</div><p class="ca-small">No bot wallet, live signer, swap executor, or verified trade confirmations are connected.</p></div>',
 '</div>',
 '<h3>Cloud AutoTrader · Railway</h3>',
 '<p class="ca-small">The deployed cloud scanner needs no open MacBook or terminal. You can also test the same logic locally with:</p>',
 '<code>node bot/test.cjs\nnode bot/main.cjs run</code>',
 '<p class="ca-small">For Railway paper monitoring and emergency controls, use the secure Phantom Owner Connection panel below. The local-only terminal option remains available for development.</p>',
 '<div class="ca-links">',
 '<a href="https://github.com/malusayf/crimson-intel/tree/main/bot" target="_blank" rel="noopener noreferrer">View AutoTrader code ↗</a>',
 '<a href="https://github.com/malusayf/crimson-intel/blob/main/bot/README.md" target="_blank" rel="noopener noreferrer">Setup and risk guide ↗</a>',
 '</div>',
 '<div class="ca-warning"><strong>Cloud scanner is PAPER ONLY.</strong> Paper fills are hypothetical DEX snapshot prices with modeled slippage; they are not executable swap quotes. Live execution requires a dedicated bot wallet, secure signing, real swap confirmations and independent testing. No Phantom SOL is traded. Never enter seed phrases or private keys into this public website.</div>'
 ].join("");
 const command=document.getElementById("ccCommandCenter");
 if(command)command.insertAdjacentElement("afterend",panel);
 else main.appendChild(panel);
window.addEventListener("crimson:paper-status",event=>{
  const v=event.detail||{},tag=document.getElementById("caPaperDeployment"),
    description=document.getElementById("caPaperDescription");
  if(!tag||!description)return;
  tag.textContent=v.kill?"PAPER HALTED":v.paused?"PAPER PAUSED":
    v.online?"SCANNING — PAPER":v.configured?"RUNNER OFFLINE":"NOT CONNECTED";
  tag.className="ca-state "+(v.online&&!v.kill?"ca-green":"ca-yellow");
  description.textContent="Paper scanner: "+(v.message||"Status unavailable")+
    " · No automatic trades from Phantom.";
});
})();