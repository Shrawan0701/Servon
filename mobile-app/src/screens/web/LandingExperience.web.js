import React, { useRef, useState } from "react";
import { MarkIcon } from "./MarketingTheme.web";
import { SiteLink } from "./MarketingShell.web";
import { landingExperienceCSS } from "./LandingExperienceTheme.web";

const orderItems = [["Paneer tikka", "2", "560"], ["Garlic naan", "3", "180"], ["Dal makhani", "1", "260"]];
const serviceSteps = [
  ["QR ordering", "Guests order in their browser. Your staff can enter orders too."],
  ["Kitchen tickets", "The kitchen receives the items, quantities and table reference."],
  ["Billing", "Generate the bill from the same order and record its payment."],
];

function DepthScene({ children, className = "" }) {
  const frame = useRef(null);
  return (
    <div ref={frame} className={`lv-depth ${className}`} onPointerMove={(event) => {
      if (event.pointerType !== "mouse") return;
      const bounds = frame.current.getBoundingClientRect();
      frame.current.style.setProperty("--mx", `${((event.clientX - bounds.left) / bounds.width - .5) * 5}deg`);
      frame.current.style.setProperty("--my", `${((event.clientY - bounds.top) / bounds.height - .5) * -4}deg`);
    }} onPointerLeave={() => { frame.current.style.setProperty("--mx", "0deg"); frame.current.style.setProperty("--my", "0deg"); }}>
      {children}
    </div>
  );
}

function FoodPlate({ small = false }) {
  return (
    <svg className={small ? "lv-food lv-food-small" : "lv-food"} viewBox="0 0 300 300" aria-hidden="true">
      <defs>
        <radialGradient id={small ? "lv-dish-small" : "lv-dish"}><stop stopColor="#fffef9" /><stop offset=".75" stopColor="#f4efe5" /><stop offset=".91" stopColor="#e5e0d4" /><stop offset="1" stopColor="#faf8f1" /></radialGradient>
        <radialGradient id={small ? "lv-curry-small" : "lv-curry"}><stop stopColor="#d78b3e" /><stop offset="1" stopColor="#b75c26" /></radialGradient>
      </defs>
      <circle cx="150" cy="150" r="143" fill={`url(#${small ? "lv-dish-small" : "lv-dish"})`} />
      <circle cx="150" cy="150" r="112" fill="none" stroke="#d4cfc0" strokeWidth="1" />
      <path d="M67 124C77 74 122 57 171 66c44 7 76 50 66 95-7 35-39 70-90 71-57 0-96-53-80-108Z" fill={`url(#${small ? "lv-curry-small" : "lv-curry"})`} />
      <path d="M87 121c42-35 81-36 115 15-14 44-55 68-97 40" fill="none" stroke="#f3c690" strokeWidth="4" opacity=".7" />
      {[[100,106,-14],[153,91,14],[184,136,-9],[132,145,20],[106,180,-19],[166,185,12]].map(([x,y,rotation], index) => (
        <g key={index} transform={`rotate(${rotation} ${x + 16} ${y + 12})`}><rect x={x+2} y={y+5} width="33" height="26" rx="4" fill="#874d2c" opacity=".32" /><rect x={x} y={y} width="33" height="26" rx="4" fill="#f6e7bd" /><path d={`M${x+3} ${y+22}h26`} stroke="#d8bc82" strokeWidth="2" /></g>
      ))}
      {[[91,150],[151,119],[191,185],[133,205],[190,94]].map(([x,y], index) => <path key={index} d={`M${x} ${y}q-12-17 5-20q12 14-5 20m0 0 8-11`} fill="#54743b" stroke="#315532" strokeWidth="1" />)}
      <circle cx="78" cy="161" r="3" fill="#eaba74" /><circle cx="211" cy="154" r="3" fill="#eaba74" />
    </svg>
  );
}

function ServiceScene() {
  const [step, setStep] = useState(0);
  return (
    <div className="lv-service" id="service-demo">
      <DepthScene className="lv-service-stage">
        <div className="lv-worktop" aria-hidden="true"><span>TABLE 04</span><i /><i /><i /></div>
        <div className="lv-service-path" aria-hidden="true"><i /><i /><i /></div>
        <div className="lv-device lv-kitchen" data-active={step === 1}>
          <div className="lv-camera" />
          <div className="lv-kitchen-screen">
            <header><b>Servon<span>.</span></b><span><i /> Kitchen display</span></header>
            <div className="lv-kitchen-toolbar"><h3>Orders in preparation</h3><span>Sample workspace</span></div>
            <div className="lv-kitchen-tickets">
              <article className="lv-paper-ticket" data-ready={step === 2}>
                <header><span>TABLE 04</span><strong>#104</strong></header>
                <p>{step === 0 ? "Order preview" : step === 1 ? "Preparing" : "Ready to serve"}</p>
                {orderItems.map(([name, count]) => <div key={name}><b>{count}</b><span>{name}</span><i>{step === 2 ? "✓" : ""}</i></div>)}
                <footer><MarkIcon name={step === 2 ? "check" : "clock"} size={13} />{step === 0 ? "Place the sample order to begin" : step === 1 ? "Kitchen ticket received" : "Preparation complete"}</footer>
              </article>
              <article className="lv-paper-ticket lv-background-ticket" aria-hidden="true"><header><span>TABLE 09</span><strong>#103</strong></header><p>Preparing</p><div><b>2</b>Veg biryani</div><div><b>1</b>Fresh lime soda</div><footer><MarkIcon name="clock" size={13} /> In preparation</footer></article>
            </div>
            <div className="lv-kitchen-bottom"><span>Orders · Kitchen · Billing</span><MarkIcon name="layers" size={14} /></div>
          </div>
        </div>
        <div className="lv-phone" data-active={step === 0}>
          <div className="lv-phone-camera" />
          <div className="lv-phone-top"><span>9:41</span><span>••• ▰</span></div>
          <header><b>Servon.</b><span>Table 04</span></header>
          <div className="lv-phone-dish"><FoodPlate small /><span>FROM YOUR MENU</span></div>
          <h3>Paneer tikka</h3><p>Starters · 2 portions</p>
          <div className="lv-phone-order"><span>3 items in your order</span><b>₹1,000</b></div>
          <button onClick={() => setStep(1)} disabled={step > 0}>{step > 0 ? "Order placed" : "Place order"}<MarkIcon name={step > 0 ? "check" : "arrow"} size={13} /></button>
          <div className="lv-phone-home" />
        </div>
        <div className="lv-receipt-stack" data-active={step === 2}>
          <div className="lv-receipt">
            <MarkIcon name="receipt" size={22} /><h3>Servon kitchen</h3><span>TABLE 04 / BILL #104</span>
            <div className="lv-receipt-rule" />
            {orderItems.map(([name, count, price]) => <p key={name}><span>{count} × {name}</span><b>₹{price}</b></p>)}
            <div className="lv-receipt-total"><span>Subtotal</span><strong>₹1,000</strong></div>
            <div className="lv-paid-stamp">{step === 2 ? "BILL GENERATED" : "BILL PREVIEW"}</div>
            <small>Illustrative amounts, before tax</small>
          </div>
        </div>
        <div className="lv-stage-note"><span className="lv-dot" />Interactive product illustration</div>
      </DepthScene>
      <div className="lv-service-controls">
        <div className="lv-step-picker" aria-label="Explore the order workflow">
          {serviceSteps.map(([name], index) => <button key={name} aria-pressed={step === index} onClick={() => setStep(index)}><span>0{index + 1}</span>{name}<MarkIcon name={step > index ? "check" : "arrow"} size={14} /></button>)}
        </div>
        <div className="lv-step-description" aria-live="polite"><p>{serviceSteps[step][1]}</p><button onClick={() => setStep((step + 1) % 3)}>{step === 2 ? "Start again" : "Next step"}<MarkIcon size={14} /></button></div>
      </div>
    </div>
  );
}

function ScannerScene() {
  const [scanned, setScanned] = useState(false);
  return (
    <div className="lv-scanner" data-scanned={scanned}>
      <div className="lv-scanner-top"><span><MarkIcon name="scan" size={15} />Shelf count</span><small>SAMPLE PRODUCTS</small></div>
      <div className="lv-shelf-photo">
        {[6, 5].map((count, row) => <div className={`lv-shelf-row lv-shelf-row-${row}`} key={row}>
          {Array.from({ length: count }, (_, index) => <div key={index} className="lv-bottle-wrap"><div className={`lv-bottle lv-bottle-${row}`}><div className="lv-bottle-cap" /><div className="lv-bottle-label"><span>{row === 0 ? "SPRING" : "SODA"}</span><b>{row === 0 ? "750" : "300"}</b><small>ml</small></div></div><i className="lv-detection"><span>{row === 0 ? "Water" : "Soda"}</span></i></div>)}
          <div className="lv-shelf-plank" />
        </div>)}
        <div className="lv-scan-line" aria-hidden="true" />
        <div className="lv-scan-corner lv-corner-a" /><div className="lv-scan-corner lv-corner-b" />
        <span className="lv-camera-label">SHELF A / FRONT VIEW</span>
      </div>
      <div className="lv-count-results" aria-live="polite">
        {scanned ? <>
          <div className="lv-count-heading"><MarkIcon name="check" size={17} /><span>11 bottles identified</span><small>Review before saving</small></div>
          <div className="lv-count-grid"><span>Product</span><span>Expected</span><span>Counted</span><span>Difference</span><strong>Water · 750 ml</strong><b>6</b><b>6</b><b>0</b><strong>Soda · 300 ml</strong><b>6</b><b>5</b><b className="lv-shortfall">−1</b></div>
          <button className="lv-scan-reset" onClick={() => setScanned(false)}>View shelf again <MarkIcon size={13} /></button>
        </> : <button className="lv-scan-button" onClick={() => setScanned(true)}><MarkIcon name="scan" size={19} />Scan this example<MarkIcon size={16} /></button>}
      </div>
    </div>
  );
}

function RecipeScene() {
  const [servings, setServings] = useState(1);
  return (
    <div className="lv-recipe-scene">
      <div className="lv-recipe-orbit" aria-hidden="true"><i /><i /></div>
      <div className="lv-plate-shadow" />
      <div className="lv-recipe-plate"><FoodPlate /></div>
      <div className="lv-ingredient lv-ingredient-paneer"><div className="lv-paneer-cubes"><i /><i /><i /></div><span>Paneer<strong>{200 * servings} g</strong></span></div>
      <div className="lv-ingredient lv-ingredient-tomato"><div className="lv-tomatoes"><i /><i /></div><span>Tomatoes<strong>{150 * servings} g</strong></span></div>
      <div className="lv-ingredient lv-ingredient-gravy"><div className="lv-gravy-bowl"><i /></div><span>Shared base gravy<strong>{100 * servings} g</strong></span></div>
      <span className="lv-recipe-name">PANEER MASALA / SAMPLE RECIPE</span>
      <div className="lv-serving-control"><label htmlFor="lv-servings">Servings <strong>{servings}</strong></label><input id="lv-servings" type="range" min="1" max="5" value={servings} onChange={(event) => setServings(Number(event.target.value))} /><div><span>1</span><span>5</span></div></div>
      <div className="lv-stock-deduction" aria-live="polite"><MarkIcon name="layers" size={18} /><span>Recipe quantities scale with each order.<small>Shared gravy is counted through its raw ingredients.</small></span></div>
    </div>
  );
}

const reports = {
  week: { total: "₹28,460", period: "Last 7 days", labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], values: [36, 48, 39, 59, 53, 88, 76], top: "Paneer tikka", peak: "Saturday", orders: "86" },
  month: { total: "₹1,12,800", period: "Last 30 days", labels: ["01–04", "05–08", "09–12", "13–16", "17–20", "21–24", "25–30"], values: [49, 37, 62, 51, 76, 68, 94], top: "Veg biryani", peak: "25–30", orders: "342" },
};

function ReportsScene() {
  const [period, setPeriod] = useState("week");
  const [question, setQuestion] = useState("top");
  const data = reports[period];
  return (
    <div className="lv-report-scene">
      <div className="lv-report-header"><span><MarkIcon name="chart" size={16} /> Sales overview</span><div aria-label="Example reporting period"><button aria-pressed={period === "week"} onClick={() => setPeriod("week")}>7 days</button><button aria-pressed={period === "month"} onClick={() => setPeriod("month")}>30 days</button></div></div>
      <div className="lv-report-amount" aria-live="polite"><span>Recorded sales</span><strong>{data.total}</strong><small>{data.period} · illustrative data</small></div>
      <div className="lv-chart" role="img" aria-label={`Illustrative sales chart for ${data.period}; busiest period ${data.peak}`}>
        <div className="lv-chart-grid"><span /><span /><span /><span /></div>
        <div className="lv-chart-bars">{data.values.map((value, index) => <div className="lv-chart-column" key={index}><i style={{ height: `${value}%` }} data-peak={value === Math.max(...data.values)} /><span>{data.labels[index]}</span></div>)}</div>
      </div>
      <div className="lv-report-bottom"><span>{data.orders} orders</span><span>Sales · Expenses · Menu performance</span></div>
      <div className="lv-advisor-answer">
        <header><MarkIcon name="spark" size={18} /><span>Ask Servon</span><small>Example response</small></header>
        <div className="lv-advisor-prompts"><button aria-pressed={question === "top"} onClick={() => setQuestion("top")}>Top-selling item?</button><button aria-pressed={question === "peak"} onClick={() => setQuestion("peak")}>Busiest period?</button></div>
        <p aria-live="polite">{question === "top" ? <><strong>{data.top}</strong> leads item sales in this sample period.</> : <><strong>{data.peak}</strong> has the highest sales in this sample period.</>}</p>
        <div className="lv-waveform" aria-hidden="true">{[8,14,22,11,29,18,35,24,13,27,17,9,21,12,7].map((height, index) => <i key={index} style={{ height }} />)}<span>Text & voice questions</span></div>
      </div>
    </div>
  );
}

function AccessScene() {
  const [chefMode, setChefMode] = useState(true);
  return (
    <div className="lv-access-demo">
      <div className="lv-access-switch"><span><MarkIcon name="shield" size={17} />Chef Mode</span><button type="button" role="switch" aria-checked={chefMode} aria-label="Preview Chef Mode" onClick={() => setChefMode(!chefMode)}><i /></button></div>
      <div className="lv-access-metrics" data-private={chefMode}><div><span>Revenue</span><strong>{chefMode ? "••,•••" : "₹28,460"}</strong></div><div><span>Expenses</span><strong>{chefMode ? "••,•••" : "₹11,200"}</strong></div></div>
      <div className="lv-access-order"><span><i />Table 04</span><span>2 × Paneer tikka</span><b>Preparing</b></div>
      <p aria-live="polite">{chefMode ? "Financial information hidden. Kitchen orders remain visible." : "Owner view: financial information is visible."}</p>
    </div>
  );
}

function OfflineScene() {
  const [online, setOnline] = useState(false);
  return (
    <div className="lv-offline-demo" data-online={online}>
      <div className="lv-offline-network"><div><MarkIcon name="receipt" size={27} /><span>Native app</span></div><div className="lv-sync-path"><i /><i /><i /></div><div><MarkIcon name="wifi" size={27} /><span>Cloud</span></div></div>
      <div className="lv-queue"><span><MarkIcon name={online ? "check" : "clock"} size={15} />{online ? "Sample changes synchronized" : "3 sample changes saved on device"}</span><div><i /><i /><i /></div></div>
      <button onClick={() => setOnline(!online)}><span className="lv-dot" />{online ? "Connected" : "Connection interrupted"}<span>{online ? "Try offline" : "Restore connection"}<MarkIcon size={13} /></span></button>
    </div>
  );
}

export default function LandingExperience({ onBookDemo, onNavigate }) {
  return (
    <main id="sv-main" className="lv-page" tabIndex={-1}>
      <style>{landingExperienceCSS}</style>
      <section className="lv-hero">
        <div className="sv-wrap">
          <div className="lv-hero-intro"><div><span className="lv-eyebrow"><i />SERVON / RESTAURANT OPERATIONS</span><h1>Run your restaurant from a <em>connected workspace.</em></h1></div><div className="lv-hero-action"><p>Orders, kitchen, stock and billing stay connected throughout service.</p><button className="sv-button" onClick={onBookDemo}>Book a demo <MarkIcon size={17} /></button><a href="#service-demo">Follow an order <MarkIcon size={15} /></a></div></div>
          <ServiceScene />
          <div className="lv-platform"><span>For restaurants, cafés & hotels</span><div><MarkIcon name="scan" size={15} />Browser-based QR menus</div><div><MarkIcon name="grid" size={15} />Web & mobile workspace</div><div><MarkIcon name="receipt" size={15} />Kitchen & billing</div></div>
        </div>
      </section>
      <section className="lv-inventory" id="stock-scanner">
        <div className="sv-wrap lv-split">
          <div className="lv-feature-copy"><span className="lv-eyebrow">01 / PHOTO INVENTORY</span><h2>Turn a shelf photo into a stock count.</h2><p>Identify recognizable bottles and products, review the count, then compare it with your recorded stock.</p><div className="lv-scan-steps"><span>Photograph</span><MarkIcon size={14} /><span>Review</span><MarkIcon size={14} /><span>Confirm</span></div><SiteLink to="features" onNavigate={onNavigate} className="lv-feature-link">Explore inventory <MarkIcon size={16} /></SiteLink><small className="lv-note">AI suggestions are checked by your team before saving.</small></div>
          <div className="lv-scanner-visual"><ScannerScene /><span className="lv-visual-caption">Try the sample scan. Your inventory is unaffected.</span></div>
        </div>
      </section>
      <section className="lv-recipes">
        <div className="sv-wrap lv-split">
          <RecipeScene />
          <div className="lv-feature-copy"><span className="lv-eyebrow">02 / RECIPES & PREPARATIONS</span><h2>Every serving has an ingredient story.</h2><p>Link ingredients and shared gravies to dishes. Servon calculates their stock consumption when orders are processed.</p><ul className="lv-recipe-points"><li><span>01</span>Set quantities per serving</li><li><span>02</span>Reuse gravies, pastes & marinades</li><li><span>03</span>Set up several dishes together</li></ul><SiteLink to="features" onNavigate={onNavigate} className="lv-feature-link">See recipe management <MarkIcon size={16} /></SiteLink></div>
        </div>
      </section>
      <section className="lv-intelligence">
        <div className="sv-wrap"><div className="lv-report-intro"><span className="lv-eyebrow">03 / REPORTS & AI ADVISOR</span><h2>Understand the numbers<br />behind your service.</h2><p>Explore sales and expenses. Ask the AI advisor about your business through text or voice.</p></div><ReportsScene /></div>
      </section>
      <section className="lv-operations">
        <div className="sv-wrap lv-operations-grid">
          <article><span className="lv-eyebrow">04 / STAFF ACCESS</span><h2>Give the kitchen<br />the view it needs.</h2><p>Chef Mode keeps financial information out of staff-facing views.</p><AccessScene /><span className="lv-visual-caption">Toggle to compare sample staff and owner views.</span></article>
          <article><span className="lv-eyebrow">05 / NATIVE OFFLINE MODE</span><h2>Keep working through<br />a connection drop.</h2><p>Supported native ordering and billing changes queue on the device and sync when you reconnect.</p><OfflineScene /><span className="lv-visual-caption">Interactive illustration of native app synchronization.</span></article>
        </div>
      </section>
      <section className="lv-demo-end"><div className="sv-wrap"><div><span className="lv-eyebrow">SEE SERVON IN ACTION</span><h2>Bring your menu.<br />We’ll show you the workflow.</h2><p>A personal walkthrough of ordering, inventory and reporting for your restaurant.</p><button className="sv-button" onClick={onBookDemo}>Book a product demo <MarkIcon size={18} /></button></div><div className="lv-end-art" aria-hidden="true"><div className="lv-end-ring" /><div className="lv-end-tile"><span>S</span><i /></div><span className="lv-end-label lv-end-label-a">Orders</span><span className="lv-end-label lv-end-label-b">Kitchen</span><span className="lv-end-label lv-end-label-c">Stock</span></div></div></section>
      <section className="lv-faq"><div className="sv-wrap"><div><span className="lv-eyebrow">BEFORE YOU ASK</span><h2>A few practical details.</h2><SiteLink to="faq" onNavigate={onNavigate} className="lv-feature-link">All questions <MarkIcon size={15} /></SiteLink></div><div className="sv-faq-list">{[
        ["Do customers need to download an app?", "No. Guests scan the table QR code and order in their browser."],
        ["Can I use my existing devices?", "Servon has a web workspace and a mobile app. We can review device and printer requirements during your demo."],
        ["Does a photo automatically change my stock?", "No. Review the suggested products and counts before saving. Applying a stock adjustment is a separate action."],
      ].map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></div></section>
    </main>
  );
}
