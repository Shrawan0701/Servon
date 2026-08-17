const PDFDocument = require("pdfkit");

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
// Monochrome, professional business-report palette. Color is used only for
// the tiny "Servon." wordmark in the header — everywhere else is navy / ink /
// gray / white with hairline borders, like a real financial report rather
// than a colored dashboard mockup.
const C = {
  navy:       "#1E3A5F",   // headings, emphasis, primary values
  ink:        "#111827",   // body text
  muted:      "#6B7280",   // secondary/label text
  faint:      "#9CA3AF",   // tertiary text
  border:     "#D1D5DB",   // standard hairline border
  borderSoft: "#E5E7EB",   // lighter divider
  panelBg:    "#F7F7F6",   // neutral light panel (table headers, totals, badges)
  rowAlt:     "#FAFAFA",   // subtle zebra striping
  white:      "#FFFFFF",
  pageBg:     "#FFFFFF",
  brand:      "#059669",   // primary brand accent color
};

const PAGE_W    = 595.28;
const PAGE_H    = 841.89;
const MARGIN    = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

// Vertical boundaries
const HEADER_H = 108;
const FOOTER_H = 44;
const SAFE_TOP = HEADER_H + 20;           // y where content starts
const SAFE_BOT = PAGE_H - FOOTER_H - 20;  // y where we must paginate

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmtRs(n) {
  return `Rs. ${Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtNum(n) {
  return parseInt(n || 0).toLocaleString("en-IN");
}

// ── Page chrome ───────────────────────────────────────────────────────────────

function drawPageBg(doc) {
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(C.pageBg);
}

function drawHeaderBanner(doc, subtitle, startDate, endDate, businessName) {
  const hotelDisplayName = businessName || "HOTEL ANALYTICS";

  doc.rect(0, 0, PAGE_W, HEADER_H).fill(C.white);
  doc.moveTo(0, HEADER_H).lineTo(PAGE_W, HEADER_H)
     .strokeColor(C.border).lineWidth(1).stroke();

  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(22).text(hotelDisplayName.toUpperCase(), MARGIN, 28);
  doc.fillColor(C.muted).font("Helvetica-Bold").fontSize(9)
     .text(subtitle, MARGIN, 70, { characterSpacing: 2 });

  if (startDate && endDate) {
    const bx = PAGE_W - MARGIN - 168;
    doc.roundedRect(bx, 22, 168, 36, 6).lineWidth(1).stroke(C.border);
    doc.fillColor(C.muted).font("Helvetica-Bold").fontSize(7)
       .text("DATE RANGE", bx + 12, 30, { characterSpacing: 1 });
    doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(9)
       .text(`${startDate}  ->  ${endDate}`, bx + 12, 42);
  }

  const genLabel = `Generated: ${new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
  doc.fillColor(C.faint).font("Helvetica").fontSize(8)
     .text(genLabel, 0, 90, { align: "right", width: PAGE_W - MARGIN });
}

function drawFooter(doc, pageNum, totalPages, businessName) {
  const hotelDisplayName = businessName || "Hotel Analytics";

  doc.rect(0, PAGE_H - FOOTER_H, PAGE_W, FOOTER_H).fill(C.white);
  doc.moveTo(0, PAGE_H - FOOTER_H).lineTo(PAGE_W, PAGE_H - FOOTER_H)
     .strokeColor(C.border).lineWidth(1).stroke();
  doc.fillColor(C.faint).font("Helvetica").fontSize(8)
     .text(`© ${new Date().getFullYear()} ${hotelDisplayName}  •  Confidential Financial Report`, MARGIN, PAGE_H - 26);
  doc.fillColor(C.faint).font("Helvetica").fontSize(8)
     .text(`Page ${pageNum} of ${totalPages}`, 0, PAGE_H - 26, {
       align: "right",
       width: PAGE_W - MARGIN,
     });
}

// ── Section / layout helpers ──────────────────────────────────────────────────

function drawSectionTitle(doc, title, y) {
  doc.rect(MARGIN, y, 3, 18).fill(C.brand);
  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(13)
     .text(title, MARGIN + 12, y + 2);
  return y + 30;
}

function drawKpiCard(doc, x, y, w, h, label, value) {
  doc.roundedRect(x, y, w, h, 6).lineWidth(1).stroke(C.border);
  doc.fillColor(C.muted).font("Helvetica-Bold").fontSize(8)
     .text(label, x + 14, y + 16, { characterSpacing: 1, width: w - 28 });
  doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(18)
     .text(value, x + 14, y + 32, { width: w - 28 });
}

function drawTableHeader(doc, y, cols) {
  doc.rect(MARGIN, y, CONTENT_W, 30).fill(C.panelBg);
  doc.rect(MARGIN, y, CONTENT_W, 30).lineWidth(1).stroke(C.border);
  cols.forEach((col) => {
    doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(8.5)
       .text(col.label, col.x, y + 10, {
         width:            col.w,
         align:            col.align || "left",
         characterSpacing: 0.5,
       });
  });
  return y + 30;
}

// ─── PASS 1: COUNT PAGES ──────────────────────────────────────────────────────

function countTotalPages(reportData) {
  const items = reportData.items || [];
  const daily = reportData.dailyRevenue || [];

  let pages = 0;
  let y;

  // ── Section 1: Summary + Items ────────────────────────────────────────────
  pages++;
  y = SAFE_TOP;

  // KPI block: section title (30) + cards (72) + gap (20)
  y += 30 + 72 + 20;
  // Items section title (30) + table header (30)
  y += 30 + 30;

  for (let i = 0; i < items.length; i++) {
    if (y + 28 > SAFE_BOT) { pages++; y = SAFE_TOP + 30; }
    y += 28;
  }
  // Totals row
  if (y + 32 > SAFE_BOT) { pages++; y = SAFE_TOP + 30; }
  y += 32;

  // ── Section 2: Daily (always fresh page) ──────────────────────────────────
  pages++;
  y = SAFE_TOP;

  // Daily KPI block: section title (30) + cards (64) + gap (20)
  y += 30 + 64 + 20;
  // Day table section title (30) + table header (30)
  y += 30 + 30;

  for (let i = 0; i < daily.length; i++) {
    if (y + 26 > SAFE_BOT) { pages++; y = SAFE_TOP + 30; }
    y += 26;
  }
  // Totals row
  if (y + 32 > SAFE_BOT) { pages++; y = SAFE_TOP + 30; }

  return pages;
}

// ─── PASS 2: DRAW ─────────────────────────────────────────────────────────────

const generateSalesReportPDF = (reportData) => {
  return new Promise((resolve, reject) => {
    const totalPages = countTotalPages(reportData);

    const doc     = new PDFDocument({ margin: 0, size: "A4" });
    const buffers = [];
    doc.on("data",  (chunk) => buffers.push(chunk));
    doc.on("end",   () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const hotelName = reportData.businessName || reportData.hotelName || "HOTEL ANALYTICS";

    // ctx holds mutable pagination state threaded through the whole render
    const ctx = {
      pageNum:       1,
      totalPages,
      currentBanner: "EXECUTIVE SALES REPORT",
    };

    // Starts a new page, draws chrome, returns new y
    function startNewPage(banner, showBadge) {
      drawFooter(doc, ctx.pageNum, ctx.totalPages, hotelName);
      doc.addPage();
      ctx.pageNum++;
      drawPageBg(doc);
      drawHeaderBanner(
        doc,
        banner,
        showBadge ? reportData.startDate : null,
        showBadge ? reportData.endDate   : null,
        hotelName
      );
      return SAFE_TOP;
    }

    // Paginate mid-section (continuation, no badge)
    function paginateIfNeeded(y, rowH, cols) {
      if (y + rowH > SAFE_BOT) {
        y = startNewPage(ctx.currentBanner, false);
        if (cols) y = drawTableHeader(doc, y, cols);
      }
      return y;
    }

    // ════════════════════════════════════════════════════════
    //  SECTION 1 — SUMMARY + TOP ITEMS
    // ════════════════════════════════════════════════════════

    drawPageBg(doc);
    drawHeaderBanner(doc, ctx.currentBanner, reportData.startDate, reportData.endDate, hotelName);

    let y = SAFE_TOP;

    // KPI cards
    y = drawSectionTitle(doc, "Performance Overview", y);
    const kpiW   = (CONTENT_W - 24) / 3;
    const kpiH   = 72;
    const avgVal = reportData.totalOrders > 0
      ? reportData.totalRevenue / reportData.totalOrders : 0;

    drawKpiCard(doc, MARGIN,                 y, kpiW, kpiH, "TOTAL REVENUE",   fmtRs(reportData.totalRevenue));
    drawKpiCard(doc, MARGIN + kpiW + 12,       y, kpiW, kpiH, "TOTAL ORDERS",    fmtNum(reportData.totalOrders));
    drawKpiCard(doc, MARGIN + (kpiW + 12) * 2, y, kpiW, kpiH, "AVG ORDER VALUE", fmtRs(avgVal));
    y += kpiH + 20;

    // Items table
    y = drawSectionTitle(doc, "Top Selling Items", y);

    const itemCols = [
      { label: "#",         x: MARGIN + 8,   w: 24,  align: "left"   },
      { label: "ITEM NAME", x: MARGIN + 38,  w: 250, align: "left"   },
      { label: "QTY SOLD",  x: MARGIN + 310, w: 80,  align: "center" },
      { label: "REVENUE",   x: MARGIN + 390, w: 100, align: "right"  },
    ];
    y = drawTableHeader(doc, y, itemCols);

    const items = reportData.items || [];

    if (items.length === 0) {
      doc.rect(MARGIN, y, CONTENT_W, 48).fill(C.white);
      doc.fillColor(C.faint).font("Helvetica").fontSize(11)
         .text("No sales data available for this period.", MARGIN, y + 16, { align: "center", width: CONTENT_W });
      y += 48;
    } else {
      items.forEach((item, i) => {
        y = paginateIfNeeded(y, 28, itemCols);

        const rowBg = i % 2 === 0 ? C.rowAlt : C.white;
        doc.rect(MARGIN, y, CONTENT_W, 28).fill(rowBg);

        const name = item.name.length > 38 ? item.name.substring(0, 38) + "..." : item.name;

        doc.fillColor(i === 0 ? C.brand : C.muted).font("Helvetica-Bold").fontSize(9)
           .text(`${i + 1}`, MARGIN + 8, y + 9, { width: 24 });
        doc.fillColor(C.ink).font(i === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(9.5)
           .text(name, MARGIN + 38, y + 9, { width: 250 });
        doc.fillColor(C.muted).font("Helvetica").fontSize(9.5)
           .text(item.qty_sold.toString(), MARGIN + 310, y + 9, { width: 80, align: "center" });
        doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(9.5)
           .text(fmtRs(item.revenue), MARGIN + 390, y + 9, { width: 100, align: "right" });

        doc.moveTo(MARGIN, y + 28).lineTo(MARGIN + CONTENT_W, y + 28)
           .strokeColor(C.borderSoft).lineWidth(0.5).stroke();
        y += 28;
      });

      // Items totals row
      y = paginateIfNeeded(y, 32, null);
      doc.rect(MARGIN, y, CONTENT_W, 32).fill(C.panelBg);
      doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y)
         .strokeColor(C.navy).lineWidth(1.5).stroke();
      doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(9).text("TOTAL", MARGIN + 38, y + 10);
      doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(9)
         .text(fmtRs(reportData.totalRevenue), MARGIN + 390, y + 10, { width: 100, align: "right" });
      y += 32;
    }

    // ════════════════════════════════════════════════════════
    //  SECTION 2 — DAILY REVENUE (always on a fresh page)
    // ════════════════════════════════════════════════════════

    ctx.currentBanner = "DAILY REVENUE BREAKDOWN";
    y = startNewPage(ctx.currentBanner, true);

    const daily      = reportData.dailyRevenue || [];
    const dailyTotal = daily.reduce((s, r) => s + parseFloat(r.revenue || 0), 0);
    const dailyAvg   = daily.length ? dailyTotal / daily.length : 0;
    const peakDay    = daily.reduce(
      (best, r) => parseFloat(r.revenue) > parseFloat(best.revenue || 0) ? r : best,
      { revenue: 0 }
    );

    // Daily KPI cards
    y = drawSectionTitle(doc, "Per-Day Revenue Summary", y);
    const dkW = (CONTENT_W - 24) / 3;
    const dkH = 64;
    drawKpiCard(doc, MARGIN,                 y, dkW, dkH, "TOTAL PERIOD REVENUE", fmtRs(dailyTotal));
    drawKpiCard(doc, MARGIN + dkW + 12,       y, dkW, dkH, "DAILY AVERAGE",        fmtRs(dailyAvg));
    drawKpiCard(doc, MARGIN + (dkW + 12) * 2, y, dkW, dkH,
      peakDay.date ? `PEAK DAY (${peakDay.date})` : "PEAK DAY",
      peakDay.date ? fmtRs(peakDay.revenue)      : "No data"
    );
    y += dkH + 20;

    // Daily table
    y = drawSectionTitle(doc, "Day-by-Day Breakdown", y);

    const dayCols = [
      { label: "DATE",       x: MARGIN + 8,   w: 110, align: "left"   },
      { label: "DAY",        x: MARGIN + 128, w: 80,  align: "left"   },
      { label: "ORDERS",     x: MARGIN + 218, w: 70,  align: "center" },
      { label: "REVENUE",    x: MARGIN + 298, w: 110, align: "right"  },
      { label: "AVG ORDER",  x: MARGIN + 418, w: 75,  align: "right"  },
    ];
    y = drawTableHeader(doc, y, dayCols);

    if (daily.length === 0) {
      doc.rect(MARGIN, y, CONTENT_W, 48).fill(C.white);
      doc.fillColor(C.faint).font("Helvetica").fontSize(11)
         .text("No daily data available for this period.", MARGIN, y + 16, { align: "center", width: CONTENT_W });
      y += 48;
    } else {
      daily.forEach((row, i) => {
        y = paginateIfNeeded(y, 26, dayCols);

        const rev    = parseFloat(row.revenue || 0);
        const orders = parseInt(row.orders || 0);
        const avg    = orders > 0 ? rev / orders : 0;
        const isPeak = row.date === peakDay.date;
        const rowBg  = i % 2 === 0 ? C.rowAlt : C.white;

        doc.rect(MARGIN, y, CONTENT_W, 26).fill(rowBg);

        const dayName = row.date
          ? new Date(row.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" })
          : "";
        const dateLabel = (row.date || "—") + (isPeak ? "  (PEAK)" : "");

        doc.fillColor(isPeak ? C.brand : C.ink)
           .font(isPeak ? "Helvetica-Bold" : "Helvetica").fontSize(9)
           .text(dateLabel, MARGIN + 8, y + 8, { width: 110 });
        doc.fillColor(C.faint).font("Helvetica").fontSize(9)
           .text(dayName, MARGIN + 128, y + 8, { width: 80 });
        doc.fillColor(C.muted).font("Helvetica").fontSize(9)
           .text(fmtNum(orders), MARGIN + 218, y + 8, { width: 70, align: "center" });
        doc.fillColor(C.ink)
           .font(isPeak ? "Helvetica-Bold" : "Helvetica").fontSize(9)
           .text(fmtRs(rev), MARGIN + 298, y + 8, { width: 110, align: "right" });
        doc.fillColor(C.muted).font("Helvetica").fontSize(9)
           .text(fmtRs(avg), MARGIN + 418, y + 8, { width: 75, align: "right" });

        doc.moveTo(MARGIN, y + 26).lineTo(MARGIN + CONTENT_W, y + 26)
           .strokeColor(C.borderSoft).lineWidth(0.5).stroke();
        y += 26;
      });

      // Daily totals row
      y = paginateIfNeeded(y, 32, null);
      doc.rect(MARGIN, y, CONTENT_W, 32).fill(C.panelBg);
      doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y)
         .strokeColor(C.navy).lineWidth(1.5).stroke();
      doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(9).text("TOTAL", MARGIN + 8, y + 11);
      doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(9)
         .text(fmtNum(reportData.totalOrders), MARGIN + 218, y + 11, { width: 70, align: "center" });
      doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(9)
         .text(fmtRs(dailyTotal), MARGIN + 298, y + 11, { width: 110, align: "right" });
      y += 32;
    }

    // Final footer
    drawFooter(doc, ctx.pageNum, ctx.totalPages, hotelName);

    doc.end();
  });
};

// ─── QR CODE PDF (UNCHANGED) ─────────────────────────────────────────────────

const generateQRPDF = async (tableNumber, qrCodeDataUrl, businessName = "Our Restaurant") => {
  return new Promise((resolve, reject) => {
    const W   = 360;
    const H   = 540;
    const doc = new PDFDocument({ size: [W, H], margin: 0 });

    const buffers = [];
    doc.on("data",  (chunk) => buffers.push(chunk));
    doc.on("end",   () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // ── 1. Page Background ────────────────────────────────────────────────
    doc.rect(0, 0, W, H).fill("#FAF9F6");

    // ── 2. Top Vivid Banner ───────────────────────────────────────────────
    const bannerH = 100;
    doc.rect(0, 0, W, bannerH).fill("#4F46E5"); // Vibrant Royal Indigo

    // Top Decorative Accent Lines
    doc.rect(0, 0, W, 5).fill("#FF6B35"); // Vibrant Coral Bar

    // Business Name Heading (White)
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .fillColor("#FFFFFF")
      .text(String(businessName).toUpperCase(), 16, 26, {
        width: W - 32,
        align: "center",
        characterSpacing: 1.5,
      });

    // Subtitle Tagline (Light Lavender)
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#E0E7FF")
      .text("DIGITAL MENU & EASY ORDERING", 16, 56, {
        width: W - 32,
        align: "center",
        characterSpacing: 2,
      });

    // ── 3. Table Pill / Badge Overlay ──────────────────────────────────────
    const pillW = 150;
    const pillH = 34;
    const pillX = (W - pillW) / 2;
    const pillY = bannerH - (pillH / 2); // Straddles the banner bottom

    // Shadow back
    doc.roundedRect(pillX + 1, pillY + 2, pillW, pillH, 8).fill("#1E1B4B");

    // Pill background
    doc.roundedRect(pillX, pillY, pillW, pillH, 8).fill("#FFFFFF");
    doc.roundedRect(pillX, pillY, pillW, pillH, 8).strokeColor("#FF6B35").lineWidth(2).stroke();

    // Table Label inside Pill
    doc
      .fontSize(13)
      .font("Helvetica-Bold")
      .fillColor("#FF6B35")
      .text(`TABLE  ${tableNumber}`, 0, pillY + 10, {
        align: "center",
        characterSpacing: 1.5,
      });

    // ── 4. Main White QR Container Card ───────────────────────────────────
    const cardX = 24;
    const cardY = pillY + pillH + 16;
    const cardW = W - (cardX * 2);
    const cardH = 250;

    // Card Container
    doc.roundedRect(cardX, cardY, cardW, cardH, 16).fill("#FFFFFF");
    doc.roundedRect(cardX, cardY, cardW, cardH, 16).strokeColor("#E5E7EB").lineWidth(1.5).stroke();

    // QR Code Display
    const qrSize = 175;
    const qrX    = (W - qrSize) / 2;
    const qrY    = cardY + 16;

    const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, "");
    const imgBuffer  = Buffer.from(base64Data, "base64");
    doc.image(imgBuffer, qrX, qrY, { width: qrSize, height: qrSize });

    // "Scan to View Menu" Heading inside Card
    const cardTextY = qrY + qrSize + 12;

    doc
      .fontSize(15)
      .font("Helvetica-Bold")
      .fillColor("#111827")
      .text("Scan to View Menu & Order", cardX, cardTextY, {
        width: cardW,
        align: "center",
      });

    doc
      .fontSize(8.5)
      .font("Helvetica")
      .fillColor("#6B7280")
      .text("Point your camera at the QR code to order instantly", cardX, cardTextY + 20, {
        width: cardW,
        align: "center",
      });

    // ── 5. How To Order (4-Step Guide) ───────────────────────────────────
    const stepsY   = cardY + cardH + 18;
    const stepColW = (W - 48) / 2;
    const steps = [
      { num: "1", text: "Open Phone Camera" },
      { num: "2", text: "Scan the QR Code" },
      { num: "3", text: "Browse Digital Menu" },
      { num: "4", text: "Place Your Order" },
    ];

    steps.forEach((step, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const sx  = 28 + col * stepColW;
      const sy  = stepsY + row * 28;

      // Colorful Circle Badge
      doc.circle(sx + 10, sy + 6, 9).fill("#4F46E5");

      // White Step Number
      doc
        .fontSize(8.5)
        .font("Helvetica-Bold")
        .fillColor("#FFFFFF")
        .text(step.num, sx + 5, sy + 2, { width: 10, align: "center" });

      // Step Text Label
      doc
        .fontSize(8.5)
        .font("Helvetica-Bold")
        .fillColor("#374151")
        .text(step.text, sx + 26, sy + 2, { width: stepColW - 28 });
    });

    // ── 6. Bottom Footer & Assistance Bar ─────────────────────────────────
    const footerY = H - 42;

    // Divider Line
    doc
      .moveTo(28, footerY)
      .lineTo(W - 28, footerY)
      .strokeColor("#E5E7EB")
      .lineWidth(1)
      .stroke();

    doc
      .fontSize(8.5)
      .font("Helvetica")
      .fillColor("#6B7280")
      .text("Need assistance? Please ask staff member.", 0, footerY + 8, {
        align: "center",
      });

    // Footer Table Tag
    doc
      .fontSize(7.5)
      .font("Helvetica-Bold")
      .fillColor("#4F46E5")
      .text(
        `${String(businessName).toUpperCase()}  •  TABLE ${tableNumber}`,
        0,
        footerY + 22,
        { align: "center", characterSpacing: 1 }
      );

    // Bottom Color Bar
    doc.rect(0, H - 5, W, 5).fill("#FF6B35");

    doc.end();
  });
};

module.exports = { generateSalesReportPDF, generateQRPDF };