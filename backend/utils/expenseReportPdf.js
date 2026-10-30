const PDFDocument = require("pdfkit");

// Render the same ledger snapshot used by the app's printable expense report.
// This renderer never updates expenses or recalculates analytics.
module.exports = function expenseReportPdf({ businessName, period, expenses, totalSales, grandTotal }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const left = 44, right = 551, bottom = 774;
    const ink = "#20332A", muted = "#627166", border = "#DDE4DC";
    const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const generated = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) + " IST";
    const text = (value, x, y, width, options = {}) => doc.font(options.bold ? "Helvetica-Bold" : "Helvetica").fontSize(options.size || 9).fillColor(options.color || ink).text(String(value ?? ""), x, y, { width, ...options });
    const line = (y) => doc.moveTo(left, y).lineTo(right, y).lineWidth(.6).strokeColor(border).stroke();
    let y;
    const header = () => {
      text(`${businessName} Report`, left, 30, right - left, { bold: true, size: 20, height: 28, ellipsis: true });
      text("Expense & Financial Report", left, 64, 300, { size: 10, color: muted });
      text(`${period.charAt(0).toUpperCase() + period.slice(1)} | ${generated}`, left, 83, right - left, { size: 8, color: muted });
      line(105);
      y = 124;
    };
    const space = (height) => { if (y + height > bottom) { doc.addPage(); header(); return true; } return false; };
    const title = (value) => { space(44); text(value, left, y, right - left, { bold: true, size: 12 }); y += 26; };
    const tableHead = (columns) => {
      doc.rect(left, y, right - left, 26).fill("#F0F4ED");
      columns.forEach((c) => text(c.label, c.x, y + 8, c.w, { bold: true, size: 8, align: c.align || "left" }));
      y += 26;
    };
    header();
    const profit = totalSales - grandTotal;
    [ ["Total Sales", totalSales], ["Total Expenses", grandTotal], ["Net Operating Profit", profit] ].forEach(([label, value], i) => {
      const x = left + i * 173;
      doc.roundedRect(x, y, 161, 64, 5).lineWidth(.6).strokeColor(border).stroke();
      text(label, x + 12, y + 12, 137, { size: 9, color: muted });
      text(money(value), x + 12, y + 32, 137, { bold: true, size: 14 });
    });
    y += 88;
    title("Category Breakdown");
    const catCols = [{ label: "Category", x: left + 8, w: 260 }, { label: "Amount", x: 320, w: 120, align: "right" }, { label: "% of Total", x: 450, w: 93, align: "right" }];
    tableHead(catCols);
    const categories = {};
    expenses.forEach((e) => { categories[e.category] = (categories[e.category] || 0) + Number(e.amount || 0); });
    Object.entries(categories).sort((a, b) => b[1] - a[1]).forEach(([category, amount]) => {
      if (space(30)) tableHead(catCols);
      text(category, left + 8, y + 9, 260);
      text(money(amount), 320, y + 9, 120, { align: "right" });
      text(`${grandTotal ? (amount / grandTotal * 100).toFixed(1) : "0.0"}%`, 450, y + 9, 93, { align: "right" });
      y += 30; line(y);
    });
    space(32);
    text("Total Expenses", left + 8, y + 10, 260, { bold: true });
    text(money(grandTotal), 320, y + 10, 120, { bold: true, align: "right" });
    y += 52;
    title("Detailed Ledger");
    const cols = [{ label: "Date", x: left + 8, w: 72 }, { label: "Category", x: 132, w: 92 }, { label: "Description / Supplier", x: 234, w: 167 }, { label: "Amount / Status", x: 411, w: 132, align: "right" }];
    tableHead(cols);
    expenses.forEach((e) => {
      const category = [e.category || "General", e.sub_category].filter(Boolean).join("\n");
      const description = [e.description || "-", e.supplier].filter(Boolean).join("\n");
      const status = e.payment_status ? e.payment_status.replace(/_/g, " ").toUpperCase() : "";
      const details = [money(e.amount), status];
      if (e.amount_paid) details.push(`Paid: ${money(e.amount_paid)}`);
      if (e.amount_paid && e.amount - e.amount_paid > 0) details.push(`Remaining: ${money(e.amount - e.amount_paid)}`);
      const amount = details.join("\n");
      doc.font("Helvetica").fontSize(9);
      const height = Math.max(42, doc.heightOfString(category, { width: 92 }) + 18, doc.heightOfString(description, { width: 167 }) + 18, doc.heightOfString(amount, { width: 132 }) + 18);
      if (space(height)) tableHead(cols);
      text(String(e.expense_date || "").split("T")[0], left + 8, y + 9, 72, { size: 8 });
      text(category, 132, y + 9, 92);
      text(description, 234, y + 9, 167, { color: muted });
      text(amount, 411, y + 9, 132, { align: "right", size: 9 });
      y += height; line(y);
    });
    space(34);
    text(`Total Expenses (${expenses.length} records)`, left + 8, y + 12, 340, { bold: true });
    text(money(grandTotal), 411, y + 12, 132, { bold: true, align: "right" });
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      line(795);
      text("Confidential | Powered by Servon Labs", left, 807, 360, { size: 8, color: muted });
      text(`${i + 1} / ${pages.count}`, 450, 807, 93, { size: 8, color: muted, align: "right" });
    }
    doc.end();
  });
};
