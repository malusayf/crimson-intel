/* Crimson Mission Control layout — presentation-only navigation.
   Moves EXISTING elements, preserving the tracker, accounts, calculators,
   event listeners, charts, and saved position state. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  if(window.__CRIMSON_LAYOUT_LOADED__) return;
  window.__CRIMSON_LAYOUT_LOADED__ = true;

  function init(){
    const main=document.querySelector("main");
    if(!main || $("ciMissionNav")) return;
    const tracker=$("mint")?.closest("section");
    const alertPanel=$("above")?.closest("section");
    const investWrap=$("entry")?.closest(".two") || $("entry")?.closest("section");
    const marketPanel=$("name")?.closest("section");
    const chartPanel=$("chart")?.closest("section");
    const walletPlaceholder=[...main.querySelectorAll("section.panel")].find(
      x=>x.querySelector("h2")?.textContent.includes("Whale / wallet intelligence")
    );
    const disclaimer=[...main.children].find(
      x=>x.tagName==="P" && x.textContent.includes("Crimson Intel is a market research tool")
    );

    const css=document.createElement("style");
    css.id="ciMissionStyle";
    css.textContent=[
      "#ciMissionIntro{margin:8px 0 12px;padding:17px 18px;border:1px solid #39445f;border-radius:16px;background:linear-gradient(125deg,#1c1733,#131c32)}",
      "#ciMissionIntro h2{font-size:20px;margin:0 0 6px}",
      "#ciMissionIntro p{font-size:13px;color:#bfcbe5;margin:0;line-height:1.6}",
      "#ciMissionStatus{margin-top:9px;font-size:12px;color:#94e4ce}",
      "#ciMissionNav{display:flex;gap:7px;padding:9px;margin:0 0 16px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;scrollbar-width:thin;border-radius:15px;background:#12182bf2;border:1px solid #39435e;position:sticky;top:0;z-index:30;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}",
      "#ciMissionNav button{flex:0 0 auto;white-space:nowrap;scroll-snap-align:start;padding:10px 13px;border-radius:10px;background:#202a42;color:#d1d9eb;border:1px solid transparent;font-size:13px;line-height:1.2;box-shadow:none}",
      "#ciMissionNav button[aria-selected=true]{background:linear-gradient(115deg,#9d2c61,#5e4ac9);color:#fff;border-color:#d95b99}",
      "#ciMissionNav button:focus-visible,#ciMissionNav button:hover{outline:2px solid #f079ab;outline-offset:1px}",
      ".ci-mission-pane[hidden]{display:none!important}",
      ".ci-mission-pane{min-width:0}",
      ".ci-pane-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin:4px 0 16px;padding:0 3px}",
      ".ci-pane-head h2{font-size:20px;margin:0}",
      ".ci-pane-head p{font-size:12px;color:#aebcdb;margin:5px 0 0;line-height:1.5}",
      ".ci-navigation-card{border:1px solid #38455f;border-radius:12px;padding:15px;background:#10172c;margin-bottom:16px}",
      ".ci-navigation-card p{font-size:13px;line-height:1.55;color:#becbe1}",
      ".ci-navigation-card button{font-size:12px;padding:9px 12px}",
      ".ci-mission-pane>.panel{margin-bottom:17px}",
      ".ci-mission-pane>.two{margin-bottom:17px}",
      ".ci-mission-pane>.two .panel{margin-bottom:0}",
      ".ci-mission-footer{font-size:12px;color:#a4aecb;line-height:1.6;margin:14px 0 25px}",
      "@media(max-width:650px){#ciMissionIntro{padding:14px}#ciMissionIntro h2{font-size:18px}#ciMissionNav{gap:6px;margin:0 -2px 14px;padding:7px;border-radius:12px}#ciMissionNav button{font-size:12px;padding:10px 11px}.ci-pane-head h2{font-size:18px}.ci-navigation-card{padding:12px}}"
    ].join("\n");
    document.head.appendChild(css);

    const intro=document.createElement("div");intro.id="ciMissionIntro";
    intro.innerHTML='<h2>⚔ Crimson Mission Control</h2>'+
      '<p>All your Crimson systems in one place. Track a token above, then switch sections for market analysis, positions, autonomous trading, portfolio and alerts.</p>'+
      '<div id="ciMissionStatus" aria-live="polite">Tracking idle · choose a Solana token above</div>';

    const nav=document.createElement("nav");nav.id="ciMissionNav";
    nav.setAttribute("role","tablist");
    nav.setAttribute("aria-label","Crimson Intel sections");
    const definitions=[
      {id:"overview",tab:"📊 Dashboard",title:"Market Dashboard",desc:"Price, Unified Intelligence, DEX chart and entry assessments."},
      {id:"discover",tab:"🔎 Discover",title:"Find Coins",desc:"Automatic Solana discovery and screened Safety Scout candidates."},
      {id:"positions",tab:"🎯 Positions & Guardian",title:"Positions & Guardian",desc:"Investment calculator, TP1–TP3, stop-loss planning, locked positions, partial sales and security protection."},
      {id:"autotrader",tab:"🤖 AutoTrader",title:"Automatic Trading (Paper Mode)",desc:"Autonomous paper engine, risk controls, deployment status and the path to a securely connected bot wallet."},
      {id:"portfolio",tab:"💼 Portfolio",title:"Portfolio & Performance",desc:"Multiple holdings, risk concentration, anomaly research and signal observations."},
      {id:"research",tab:"🧠 Research",title:"Project & Growth Research",desc:"Growth Scout, Project Intel and planned wallet intelligence."},
      {id:"alerts",tab:"🔔 Alerts",title:"Price Alerts",desc:"Your original price thresholds and browser notification controls."}
    ];
    const views={};const buttons={};
    const host=document.createElement("div");host.id="ciMissionViews";
    for(const spec of definitions){
      const b=document.createElement("button");b.type="button";b.id="ci-tab-"+spec.id;
      b.textContent=spec.tab;b.setAttribute("role","tab");
      b.setAttribute("aria-controls","ci-view-"+spec.id);
      b.setAttribute("aria-selected","false");
      buttons[spec.id]=b;nav.appendChild(b);
      const pane=document.createElement("section");pane.className="ci-mission-pane";
      pane.id="ci-view-"+spec.id;pane.setAttribute("role","tabpanel");
      pane.setAttribute("aria-labelledby",b.id);
      pane.setAttribute("tabindex","0");pane.hidden=true;
      const header=document.createElement("div");header.className="ci-pane-head";
      const copy=document.createElement("div");
      const title=document.createElement("h2");title.textContent=spec.title;
      const desc=document.createElement("p");desc.textContent=spec.desc;
      copy.append(title,desc);header.append(copy);pane.append(header);
      views[spec.id]=pane;host.append(pane);
    }
    if(tracker){tracker.insertAdjacentElement("afterend",intro);intro.after(nav,host);}
    else main.prepend(intro,nav,host);

    // Reparent, do not duplicate: script references and event handlers survive.
    const move=(id,node)=>{if(node&&views[id]&&!views[id].contains(node))views[id].append(node);};
    // RugCheck report may be a child of Radar; extract it before moving Radar.
    const trackedReport=$("csTrackedReport");
    if(trackedReport?.parentElement=== $("crimsonMarketRadar")) trackedReport.remove();
    move("overview",marketPanel);
    move("overview",$("crimsonMarketRadar"));
    move("overview",chartPanel);
    move("overview",$("entryIntel"));
    move("discover",$("crimsonSafetyScout"));
    move("positions",investWrap);
    move("positions",$("ciPositionIntel"));
    // Position management and capital protection are one continuous workflow.
    const guardianHeading=document.createElement("div");
    guardianHeading.className="ci-navigation-card";
    guardianHeading.innerHTML="<h3 style='margin:0 0 5px'>🛡 Guardian · Capital Protection</h3>"+
      "<p style='margin:0'>Locked plans, partial profits, liquidity risk and independent token security.</p>";
    views.positions.append(guardianHeading);
    move("positions",$("cgGuardian"));
    move("positions",trackedReport);
    move("autotrader",$("ciAutoTrader"));
    move("portfolio",$("ccCommandCenter"));
    move("research",$("ciGrowthScout"));
    move("research",$("crimsonProjectIntel"));
    move("research",walletPlaceholder);
    move("alerts",alertPanel);

    const choose=id=>{
      if(!views[id])return;
      for(const spec of definitions){
        const on=spec.id===id;views[spec.id].hidden=!on;
        buttons[spec.id].setAttribute("aria-selected",String(on));
        buttons[spec.id].tabIndex=on?0:-1;
      }
      try{sessionStorage.setItem("ci-mission-tab",id);}catch(e){}
    };
    for(const [index,spec] of definitions.entries()){
      const b=buttons[spec.id];
      b.addEventListener("click",()=>choose(spec.id));
      b.addEventListener("keydown",ev=>{
        let next=index;
        if(ev.key==="ArrowRight")next=(index+1)%definitions.length;
        else if(ev.key==="ArrowLeft")next=(index+definitions.length-1)%definitions.length;
        else if(ev.key==="Home")next=0;
        else if(ev.key==="End")next=definitions.length-1;
        else return;
        ev.preventDefault();const id=definitions[next].id;
        choose(id);buttons[id].focus();
        buttons[id].scrollIntoView({block:"nearest",inline:"nearest"});
      });
    }

    // Radar's scan and filters stay inside Unified, preserving their
    // root.querySelectorAll() event handlers and historical UI state.
    const tip=document.createElement("div");tip.className="ci-navigation-card";
    tip.innerHTML="<strong>Looking for more coins?</strong>"+
      "<p>Crimson Market Radar lives inside Unified Intelligence so every candidate uses the same scoring rules. Open its scanner from here.</p>";
    const radarButton=document.createElement("button");radarButton.type="button";
    radarButton.textContent="Open Market Radar";
    radarButton.addEventListener("click",()=>{
      choose("overview");
      ($("cmScanStatus")||$("crimsonMarketRadar"))?.scrollIntoView({behavior:"smooth",block:"start"});
    });
    tip.append(radarButton);
    views.discover.insertBefore(tip,views.discover.children[1]||null);

    const help=document.createElement("div");help.className="ci-navigation-card";
    help.innerHTML="<strong>Need a price alert for your position?</strong>"+
      "<p>Copy SL or TP1 from Linked Position Intelligence, then manage the alerts in one place.</p>";
    const alertsBtn=document.createElement("button");alertsBtn.type="button";
    alertsBtn.textContent="Open Price Alerts";
    alertsBtn.addEventListener("click",()=>{
      choose("alerts");
      alertPanel?.scrollIntoView({behavior:"smooth",block:"start"});
    });
    help.append(alertsBtn);views.positions.append(help);

    if(disclaimer){
      const footer=document.createElement("div");footer.className="ci-mission-footer";
      footer.append(disclaimer);host.insertAdjacentElement("afterend",footer);
    }

    let initial="overview";
    try{initial=sessionStorage.getItem("ci-mission-tab")||"overview";}catch(e){}
    // Migrate the former Guardian tab to the merged Positions & Guardian tab.
    if(initial==="guardian")initial="positions";
    choose(views[initial]?initial:"overview");

    window.addEventListener("crimson:market-snapshot",ev=>{
      const snap=ev.detail;if(!snap?.mint)return;
      const symbol=snap.pair?.baseToken?.symbol||snap.mint.slice(0,8)+"…";
      $("ciMissionStatus").textContent="Tracking "+symbol+" · updated "+
        new Date(snap.updatedAt||Date.now()).toLocaleTimeString()+" · safety depends on available data";
    });
    window.addEventListener("crimson:tracked-change",ev=>{
      const mint=ev.detail?.mint;
      if(mint)$("ciMissionStatus").textContent="Loading "+mint.slice(0,8)+"… · awaiting fresh data";
    });
    const latest=window.CRIMSON_LATEST_MARKET;
    if(latest?.mint)$("ciMissionStatus").textContent="Tracking "+
      (latest.pair?.baseToken?.symbol||latest.mint.slice(0,8)+"…")+
      " · most recent snapshot "+new Date(latest.updatedAt||Date.now()).toLocaleTimeString();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();