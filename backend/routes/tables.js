const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");
const subscription = require("../middleware/subscription");
const QRCode = require("qrcode");
const { generateQRPDF } = require("../utils/pdf");

// ─── 1. PUBLIC ENDPOINTS (MUST BE AT THE TOP) ───────────────────────────

// Get public table info
router.get("/public/:tableId", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, b.business_name, b.logo_url, b.description
       FROM tables t
       JOIN businesses b ON t.business_id = b.id
       WHERE t.id = $1`,
      [req.params.tableId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Table not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── 2. AUTHENTICATED OWNER ENDPOINTS (SECURED BELOW) ───────────────────

// Get all tables
router.get("/", auth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM tables WHERE business_id = $1 ORDER BY table_number",
      [req.businessId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Add table
router.post("/", auth, subscription, async (req, res) => {
  const { tableNumber } = req.body;

  if (!tableNumber) {
    return res.status(400).json({ error: "Table number required" });
  }

  try {
    const existing = await pool.query(
      "SELECT id FROM tables WHERE business_id = $1 AND table_number = $2",
      [req.businessId, tableNumber]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Table number already exists" });
    }

    const result = await pool.query(
      "INSERT INTO tables (business_id, table_number) VALUES ($1, $2) RETURNING *",
      [req.businessId, tableNumber]
    );

    const tableId = result.rows[0].id;

    const customerUrl = process.env.CUSTOMER_URL || "https://servon-customer-menu.vercel.app";
    
    // Construct the URL with query parameters for your customer-web logic
    const qrUrl = `${customerUrl}/menu?restaurantId=${req.businessId}&tableId=${tableId}`;

    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 300,
      margin: 2,
    });

    const updated = await pool.query(
      "UPDATE tables SET qr_code_url = $1 WHERE id = $2 RETURNING *",
      [qrDataUrl, tableId]
    );

    res.status(201).json(updated.rows[0]);

  } catch (err) {
    console.error("Add table error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Download QR as PDF
// Download QR as PDF
// Download QR as PDF
router.get("/:id/qr-pdf", auth, subscription, async (req, res) => {
  try {
    // 1. Fetch table details
    const tableResult = await pool.query(
      "SELECT * FROM tables WHERE id = $1 AND business_id = $2",
      [req.params.id, req.businessId]
    );

    if (tableResult.rows.length === 0) {
      return res.status(404).json({ error: "Table not found" });
    }

    const table = tableResult.rows[0];

    // 2. Fetch business name using 'business_name' column
    const businessResult = await pool.query(
      "SELECT business_name FROM businesses WHERE id = $1",
      [req.businessId]
    );

    // Fallback name if no business name is set
    const businessName = businessResult.rows[0]?.business_name || "Our Restaurant";

    // 3. Generate PDF with table number, QR URL, and business name
    //    The app's currently selected language (en | mr | hi) is passed through;
    //    unknown/invalid values safely fall back to English in the generator.
    const pdfBuffer = await generateQRPDF(
      table.table_number,
      table.qr_code_url,
      businessName,
      req.query?.lang
    );

    // 4. Send PDF response
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="table-${table.table_number}-qr.pdf"`,
    });

    res.send(pdfBuffer);

  } catch (err) {
    console.error("QR PDF error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete table
router.delete("/:id", auth, subscription, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM tables WHERE id = $1 AND business_id = $2 RETURNING id",
      [req.params.id, req.businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Table not found" });
    }

    res.json({ message: "Table deleted" });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;