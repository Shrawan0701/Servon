const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");
const { generateSalesReportPDF } = require("../utils/pdf");

const getReportData = async (businessId, startDate, endDate) => {
  const orders = await pool.query(
    `SELECT *
     FROM orders
     WHERE business_id = $1
     AND DATE(created_at) BETWEEN $2 AND $3
     AND status != 'REJECTED'`,
    [businessId, startDate, endDate]
  );

  const totalOrders = orders.rows.length;

  const totalRevenue = orders.rows.reduce(
    (sum, o) => sum + parseFloat(o.total_amount),
    0
  );

  // Item-wise breakdown
  const itemMap = {};

  for (const order of orders.rows) {
    const items = Array.isArray(order.items)
      ? order.items
      : JSON.parse(order.items);

    for (const item of items) {
      const key = item.name;

      if (!itemMap[key]) {
        itemMap[key] = { name: key, qty_sold: 0, revenue: 0 };
      }

      itemMap[key].qty_sold += item.quantity || 1;
      itemMap[key].revenue +=
        (item.price || 0) * (item.quantity || 1);
    }
  }

  return {
    startDate,
    endDate,
    totalOrders,
    totalRevenue,
    items: Object.values(itemMap).sort(
      (a, b) => b.qty_sold - a.qty_sold
    ),
  };
};

// ==========================================
// EXCEL-FRIENDLY CSV EXPORT
// ==========================================
router.get("/csv", auth, async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "Date range required" });
  }

  try {
    const data = await getReportData(
      req.businessId,
      startDate,
      endDate
    );

    // Clean, Excel-friendly formatting
    let csv = `SERVON BUSINESS DASHBOARD\n`;
    csv += `========================================\n`;
    csv += `Report Date Range:,${startDate},to,${endDate}\n`;
    csv += `Total Orders:,${data.totalOrders}\n`;
    csv += `Total Revenue (INR):,${data.totalRevenue.toFixed(2)}\n`; 
    csv += `========================================\n\n`;
    
    // Headers
    csv += `ITEM NAME,QUANTITY SOLD,REVENUE (INR)\n`;

    // Rows
    for (const item of data.items) {
      // Escape commas in item names so it doesn't break Excel columns
      const cleanName = `"${item.name.replace(/"/g, '""')}"`;
      csv += `${cleanName},${item.qty_sold},${Number(item.revenue).toFixed(2)}\n`;
    }

    res.set({
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="sales-report-${startDate}-to-${endDate}.csv"`,
    });

    res.send(csv);

  } catch (err) {
    console.error("CSV error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================================
// ULTRA-PREMIUM PDF EXPORT
// ==========================================
router.get("/pdf", auth, async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "Date range required" });
  }

  try {
    const data = await getReportData(
      req.businessId,
      startDate,
      endDate
    );

    // This calls the beautiful design you pasted into utils/pdf.js!
    const pdfBuffer = await generateSalesReportPDF(data);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="sales-report-${startDate}-to-${endDate}.pdf"`,
    });

    res.send(pdfBuffer);

  } catch (err) {
    console.error("PDF error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;