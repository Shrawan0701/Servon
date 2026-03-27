const PDFDocument = require("pdfkit");

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  dark:       "#0F172A",
  green:      "#10B981",
  greenLight: "#ECFDF5",
  blue:       "#3B82F6",
  blueLight:  "#EFF6FF",
  amber:      "#F59E0B",
  amberLight: "#FFFBEB",
  white:      "#FFFFFF",
  pageBg:     "#F8FAFC",
  border:     "#E2E8F0",
  textMain:   "#1E293B",
  textMuted:  "#64748B",
  textFaint:  "#94A3B8",
  rowAlt:     "#F8FAFC",
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

function drawHeaderBanner(doc, subtitle, startDate, endDate) {
  doc.rect(0, 0, PAGE_W, HEADER_H).fill(C.dark);
  doc.rect(0, 0, 5, HEADER_H).fill(C.green);

  doc.fillColor(C.green).font("Helvetica-Bold").fontSize(30).text("Servon.", MARGIN, 28);
  doc.fillColor(C.textFaint).font("Helvetica-Bold").fontSize(9)
     .text(subtitle, MARGIN, 70, { characterSpacing: 2 });

  if (startDate && endDate) {
    const bx = PAGE_W - MARGIN - 168;
    doc.roundedRect(bx, 22, 168, 36, 8).fill("#1E293B");
    doc.fillColor(C.green).font("Helvetica-Bold").fontSize(7)
       .text("DATE RANGE", bx + 12, 30, { characterSpacing: 1 });
    doc.fillColor(C.white).font("Helvetica").fontSize(9)
       .text(`${startDate}  ->  ${endDate}`, bx + 12, 42);
  }

  const genLabel = `Generated: ${new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
  doc.fillColor(C.textFaint).font("Helvetica").fontSize(8)
     .text(genLabel, 0, 90, { align: "right", width: PAGE_W - MARGIN });
}

function drawFooter(doc, pageNum, totalPages) {
  doc.rect(0, PAGE_H - FOOTER_H, PAGE_W, FOOTER_H).fill(C.dark);
  doc.rect(0, PAGE_H - FOOTER_H, 5, FOOTER_H).fill(C.green);
  doc.fillColor(C.textFaint).font("Helvetica").fontSize(8)
     .text("© 2026 Servon Business Dashboard  •  Confidential", MARGIN, PAGE_H - 26);
  doc.fillColor(C.textFaint).font("Helvetica").fontSize(8)
     .text(`Page ${pageNum} of ${totalPages}`, 0, PAGE_H - 26, {
       align: "right",
       width: PAGE_W - MARGIN,
     });
}

// ── Section / layout helpers ──────────────────────────────────────────────────

function drawSectionTitle(doc, title, y) {
  doc.rect(MARGIN, y, 3, 18).fill(C.green);
  doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(13)
     .text(title, MARGIN + 12, y + 2);
  return y + 30;
}

function drawKpiCard(doc, x, y, w, h, label, value, accentColor, bgColor) {
  doc.rect(x + 2, y + 2, w, h).fill("#E2E8F0");
  doc.roundedRect(x, y, w, h, 8).fill(bgColor);
  doc.roundedRect(x, y, w, 4, 2).fill(accentColor);
  doc.fillColor(C.textMuted).font("Helvetica-Bold").fontSize(8)
     .text(label, x + 14, y + 16, { characterSpacing: 1 });
  doc.fillColor(accentColor).font("Helvetica-Bold").fontSize(18)
     .text(value, x + 14, y + 30, { width: w - 28 });
}

function drawTableHeader(doc, y, cols) {
  doc.rect(MARGIN, y, CONTENT_W, 30).fill(C.dark);
  doc.rect(MARGIN, y, 3, 30).fill(C.green);
  cols.forEach((col) => {
    doc.fillColor(C.white).font("Helvetica-Bold").fontSize(8.5)
       .text(col.label, col.x, y + 10, {
         width:            col.w,
         align:            col.align || "left",
         characterSpacing: 0.5,
       });
  });
  return y + 30;
}

// ─── PASS 1: COUNT PAGES ──────────────────────────────────────────────────────
// Mirrors the exact layout logic of the drawing pass but only tracks y position
// and counts how many times we cross SAFE_BOT to get the true total page count.

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

    // ctx holds mutable pagination state threaded through the whole render
    const ctx = {
      pageNum:       1,
      totalPages,
      currentBanner: "PREMIUM SALES REPORT",
    };

    // Starts a new page, draws chrome, returns new y
    function startNewPage(banner, showBadge) {
      drawFooter(doc, ctx.pageNum, ctx.totalPages);
      doc.addPage();
      ctx.pageNum++;
      drawPageBg(doc);
      drawHeaderBanner(
        doc,
        banner,
        showBadge ? reportData.startDate : null,
        showBadge ? reportData.endDate   : null
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
    drawHeaderBanner(doc, ctx.currentBanner, reportData.startDate, reportData.endDate);

    let y = SAFE_TOP;

    // KPI cards
    y = drawSectionTitle(doc, "Performance Overview", y);
    const kpiW  = (CONTENT_W - 24) / 3;
    const kpiH  = 72;
    const avgVal = reportData.totalOrders > 0
      ? reportData.totalRevenue / reportData.totalOrders : 0;

    drawKpiCard(doc, MARGIN,                   y, kpiW, kpiH, "TOTAL REVENUE",   fmtRs(reportData.totalRevenue), C.green, C.greenLight);
    drawKpiCard(doc, MARGIN + kpiW + 12,       y, kpiW, kpiH, "TOTAL ORDERS",    fmtNum(reportData.totalOrders), C.blue,  C.blueLight);
    drawKpiCard(doc, MARGIN + (kpiW + 12) * 2, y, kpiW, kpiH, "AVG ORDER VALUE", fmtRs(avgVal),                  C.amber, C.amberLight);
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
      doc.fillColor(C.textFaint).font("Helvetica").fontSize(11)
         .text("No sales data available for this period.", MARGIN, y + 16, { align: "center", width: CONTENT_W });
      y += 48;
    } else {
      items.forEach((item, i) => {
        y = paginateIfNeeded(y, 28, itemCols);

        const rowBg = i % 2 === 0 ? C.rowAlt : C.white;
        doc.rect(MARGIN, y, CONTENT_W, 28).fill(rowBg);
        if (i === 0) doc.rect(MARGIN, y, 3, 28).fill(C.green);

        const name = item.name.length > 38 ? item.name.substring(0, 38) + "..." : item.name;

        doc.fillColor(i === 0 ? C.green : C.textMuted).font("Helvetica-Bold").fontSize(9)
           .text(`${i + 1}`, MARGIN + 8, y + 9, { width: 24 });
        doc.fillColor(C.textMain).font("Helvetica").fontSize(9.5)
           .text(name, MARGIN + 38, y + 9, { width: 250 });
        doc.fillColor(C.textMuted).font("Helvetica").fontSize(9.5)
           .text(item.qty_sold.toString(), MARGIN + 310, y + 9, { width: 80, align: "center" });
        doc.fillColor(C.textMain).font("Helvetica-Bold").fontSize(9.5)
           .text(fmtRs(item.revenue), MARGIN + 390, y + 9, { width: 100, align: "right" });

        doc.moveTo(MARGIN, y + 28).lineTo(MARGIN + CONTENT_W, y + 28)
           .strokeColor(C.border).lineWidth(0.5).stroke();
        y += 28;
      });

      // Items totals row
      y = paginateIfNeeded(y, 32, null);
      doc.rect(MARGIN, y, CONTENT_W, 32).fill(C.dark);
      doc.rect(MARGIN, y, 3, 32).fill(C.green);
      doc.fillColor(C.textFaint).font("Helvetica-Bold").fontSize(9).text("TOTAL", MARGIN + 38, y + 10);
      doc.fillColor(C.green).font("Helvetica-Bold").fontSize(9)
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
    drawKpiCard(doc, MARGIN,                   y, dkW, dkH, "TOTAL PERIOD REVENUE", fmtRs(dailyTotal), C.green, C.greenLight);
    drawKpiCard(doc, MARGIN + dkW + 12,        y, dkW, dkH, "DAILY AVERAGE",        fmtRs(dailyAvg),   C.blue,  C.blueLight);
    drawKpiCard(doc, MARGIN + (dkW + 12) * 2,  y, dkW, dkH,
      peakDay.date ? `PEAK  ${peakDay.date}` : "PEAK DAY",
      peakDay.date ? fmtRs(peakDay.revenue)  : "No data",
      C.amber, C.amberLight
    );
    y += dkH + 20;

    // Daily table
    y = drawSectionTitle(doc, "Day-by-Day Breakdown", y);

    const dayCols = [
      { label: "DATE",      x: MARGIN + 8,   w: 110, align: "left"   },
      { label: "DAY",       x: MARGIN + 128, w: 80,  align: "left"   },
      { label: "ORDERS",    x: MARGIN + 218, w: 70,  align: "center" },
      { label: "REVENUE",   x: MARGIN + 298, w: 110, align: "right"  },
      { label: "AVG ORDER", x: MARGIN + 418, w: 75,  align: "right"  },
    ];
    y = drawTableHeader(doc, y, dayCols);

    if (daily.length === 0) {
      doc.rect(MARGIN, y, CONTENT_W, 48).fill(C.white);
      doc.fillColor(C.textFaint).font("Helvetica").fontSize(11)
         .text("No daily data available for this period.", MARGIN, y + 16, { align: "center", width: CONTENT_W });
      y += 48;
    } else {
      daily.forEach((row, i) => {
        y = paginateIfNeeded(y, 26, dayCols);

        const rev    = parseFloat(row.revenue || 0);
        const orders = parseInt(row.orders || 0);
        const avg    = orders > 0 ? rev / orders : 0;
        const isPeak = row.date === peakDay.date;
        const rowBg  = isPeak ? C.greenLight : i % 2 === 0 ? C.rowAlt : C.white;

        doc.rect(MARGIN, y, CONTENT_W, 26).fill(rowBg);
        if (isPeak) doc.rect(MARGIN, y, 3, 26).fill(C.green);

        const dayName = row.date
          ? new Date(row.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" })
          : "";

        doc.fillColor(isPeak ? C.green : C.textMain)
           .font(isPeak ? "Helvetica-Bold" : "Helvetica").fontSize(9)
           .text(row.date || "—", MARGIN + 8, y + 8, { width: 110 });
        doc.fillColor(C.textFaint).font("Helvetica").fontSize(9)
           .text(dayName, MARGIN + 128, y + 8, { width: 80 });
        doc.fillColor(C.textMuted).font("Helvetica").fontSize(9)
           .text(fmtNum(orders), MARGIN + 218, y + 8, { width: 70, align: "center" });
        doc.fillColor(isPeak ? C.green : C.textMain)
           .font(isPeak ? "Helvetica-Bold" : "Helvetica").fontSize(9)
           .text(fmtRs(rev), MARGIN + 298, y + 8, { width: 110, align: "right" });
        doc.fillColor(C.textMuted).font("Helvetica").fontSize(9)
           .text(fmtRs(avg), MARGIN + 418, y + 8, { width: 75, align: "right" });

        doc.moveTo(MARGIN, y + 26).lineTo(MARGIN + CONTENT_W, y + 26)
           .strokeColor(C.border).lineWidth(0.5).stroke();
        y += 26;
      });

      // Daily totals row
      y = paginateIfNeeded(y, 32, null);
      doc.rect(MARGIN, y, CONTENT_W, 32).fill(C.dark);
      doc.rect(MARGIN, y, 3, 32).fill(C.green);
      doc.fillColor(C.textFaint).font("Helvetica-Bold").fontSize(9).text("TOTAL", MARGIN + 8, y + 11);
      doc.fillColor(C.textFaint).font("Helvetica-Bold").fontSize(9)
         .text(fmtNum(reportData.totalOrders), MARGIN + 218, y + 11, { width: 70, align: "center" });
      doc.fillColor(C.green).font("Helvetica-Bold").fontSize(9)
         .text(fmtRs(dailyTotal), MARGIN + 298, y + 11, { width: 110, align: "right" });
      y += 32;
    }

    // Final footer
    drawFooter(doc, ctx.pageNum, ctx.totalPages);

    doc.end();
  });
};

// ─── QR CODE PDF (UNCHANGED) ─────────────────────────────────────────────────

const generateQRPDF = async (tableNumber, qrCodeDataUrl) => {
  return new Promise((resolve, reject) => {
    const doc     = new PDFDocument({ size: [300, 350], margin: 30 });
    const buffers = [];
    doc.on("data",  (chunk) => buffers.push(chunk));
    doc.on("end",   () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    doc.fontSize(16).fillColor("#111").text("Servon", { align: "center" });
    doc.fontSize(12).fillColor("#555").text(`Table ${tableNumber}`, { align: "center" });
    doc.moveDown(0.5);

    const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, "");
    const imgBuffer  = Buffer.from(base64Data, "base64");
    doc.image(imgBuffer, { fit: [220, 220], align: "center" });

    doc.moveDown(1);
    doc.fontSize(10).fillColor("#888").text("Scan to order", { align: "center" });
    doc.end();
  });
};

module.exports = { generateSalesReportPDF, generateQRPDF };