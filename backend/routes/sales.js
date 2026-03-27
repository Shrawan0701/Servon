const express = require("express");
const router  = express.Router();
const pool    = require("../db");
const auth    = require("../middleware/auth");
const { generateSalesReportPDF } = require("../utils/pdf");

// ─── DATA FETCHER ─────────────────────────────────────────────────────────────

const getReportData = async (businessId, startDate, endDate) => {
  const orders = await pool.query(
    `SELECT *
     FROM orders
     WHERE business_id = $1
       AND DATE(created_at) BETWEEN $2 AND $3
       AND status != 'REJECTED'`,
    [businessId, startDate, endDate]
  );

  const totalOrders  = orders.rows.length;
  const totalRevenue = orders.rows.reduce((sum, o) => sum + parseFloat(o.total_amount), 0);

  // ── Item-wise breakdown ──────────────────────────────────────────────────────
  const itemMap = {};
  for (const order of orders.rows) {
    const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items);
    for (const item of items) {
      const key = item.name;
      if (!itemMap[key]) itemMap[key] = { name: key, qty_sold: 0, revenue: 0 };
      itemMap[key].qty_sold += item.quantity || 1;
      itemMap[key].revenue  += (item.price || 0) * (item.quantity || 1);
    }
  }

  // ── Daily revenue aggregation ────────────────────────────────────────────────
  // Build a map of date → { orders, revenue }
  const dailyMap = {};
  for (const order of orders.rows) {
    // created_at may be a Date object or ISO string
    const dateStr = new Date(order.created_at).toISOString().split("T")[0];
    if (!dailyMap[dateStr]) dailyMap[dateStr] = { date: dateStr, orders: 0, revenue: 0 };
    dailyMap[dateStr].orders  += 1;
    dailyMap[dateStr].revenue += parseFloat(order.total_amount || 0);
  }

  // Sort by date ascending
  const dailyRevenue = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  return {
    startDate,
    endDate,
    totalOrders,
    totalRevenue,
    items: Object.values(itemMap).sort((a, b) => b.qty_sold - a.qty_sold),
    dailyRevenue, // ← new field consumed by PDF + CSV
  };
};

// ─── CSV EXPORT ───────────────────────────────────────────────────────────────

router.get("/csv", auth, async (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: "Date range required" });

  try {
    const data = await getReportData(req.businessId, startDate, endDate);

    let csv = `SERVON BUSINESS DASHBOARD\n`;
    csv += `========================================\n`;
    csv += `Report Date Range:,${startDate},to,${endDate}\n`;
    csv += `Total Orders:,${data.totalOrders}\n`;
    csv += `Total Revenue (INR):,${data.totalRevenue.toFixed(2)}\n`;
    csv += `Avg Order Value (INR):,${data.totalOrders > 0 ? (data.totalRevenue / data.totalOrders).toFixed(2) : "0.00"}\n`;
    csv += `========================================\n\n`;

    // ── Top Items section ──────────────────────────────────────────────────────
    csv += `TOP SELLING ITEMS\n`;
    csv += `ITEM NAME,QUANTITY SOLD,REVENUE (INR)\n`;
    for (const item of data.items) {
      const cleanName = `"${item.name.replace(/"/g, '""')}"`;
      csv += `${cleanName},${item.qty_sold},${Number(item.revenue).toFixed(2)}\n`;
    }

    csv += `\n`;

    // ── Daily Revenue section ──────────────────────────────────────────────────
    csv += `DAILY REVENUE BREAKDOWN\n`;
    csv += `DATE,DAY,ORDERS,REVENUE (INR),AVG ORDER VALUE (INR)\n`;
    for (const row of data.dailyRevenue) {
      const dayName = new Date(row.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long" });
      const avg     = row.orders > 0 ? (row.revenue / row.orders).toFixed(2) : "0.00";
      csv += `${row.date},"${dayName}",${row.orders},${row.revenue.toFixed(2)},${avg}\n`;
    }
    // Totals row
    csv += `TOTAL,,${data.totalOrders},${data.totalRevenue.toFixed(2)},\n`;

    res.set({
      "Content-Type":        "text/csv",
      "Content-Disposition": `attachment; filename="sales-report-${startDate}-to-${endDate}.csv"`,
    });
    res.send(csv);

  } catch (err) {
    console.error("CSV error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── PDF EXPORT ───────────────────────────────────────────────────────────────

router.get("/pdf", auth, async (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: "Date range required" });

  try {
    const data      = await getReportData(req.businessId, startDate, endDate);
    const pdfBuffer = await generateSalesReportPDF(data);

    res.set({
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="sales-report-${startDate}-to-${endDate}.pdf"`,
    });
    res.send(pdfBuffer);

  } catch (err) {
    console.error("PDF error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;