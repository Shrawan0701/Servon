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
    console.error("Public table error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── 2. AUTHENTICATED OWNER ENDPOINTS (SECURED BELOW) ───────────────────

// Get all tables - UPDATED with branch support
router.get("/", auth, async (req, res) => {
  try {
    const filterId = req.branchId || req.businessId;
    
    // ✅ Strict branch filter
    const result = await pool.query(
      `SELECT * FROM tables 
       WHERE branch_id = $1
       ORDER BY table_number`,
      [filterId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Fetch tables error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Add table - UPDATED with branch support
router.post("/", auth, subscription, async (req, res) => {
  const { tableNumber } = req.body;

  if (!tableNumber) {
    return res.status(400).json({ error: "Table number required" });
  }

  try {
    // ✅ Determine branch_id for this table
    const branchId = req.branchId || req.businessId;
    
    // Check if table number already exists in this branch
    const existing = await pool.query(
      "SELECT id FROM tables WHERE (branch_id = $1) AND table_number = $2",
      [branchId, tableNumber]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Table number already exists" });
    }

    // ✅ Insert with branch_id
    const result = await pool.query(
      "INSERT INTO tables (business_id, branch_id, table_number) VALUES ($1, $2, $3) RETURNING *",
      [req.businessId, branchId, tableNumber]
    );

    const tableId = result.rows[0].id;

    const customerUrl = process.env.CUSTOMER_URL || "https://servon-customer-menu.vercel.app";
    
    // ✅ Include branchId in QR URL so customer sees correct branch menu
    const qrUrl = `${customerUrl}/menu?restaurantId=${req.businessId}&tableId=${tableId}&branchId=${branchId}`;

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

// Download QR as PDF - UPDATED with branch support
router.get("/:id/qr-pdf", auth, subscription, async (req, res) => {
  try {
    // ✅ Use branchId if available
    const filterId = req.branchId || req.businessId;
    
    // 1. Fetch table details
    const tableResult = await pool.query(
      "SELECT * FROM tables WHERE id = $1 AND (branch_id = $2 OR business_id = $2)",
      [req.params.id, filterId]
    );

    if (tableResult.rows.length === 0) {
      return res.status(404).json({ error: "Table not found" });
    }

    const table = tableResult.rows[0];

    // 2. Fetch business name
    const businessResult = await pool.query(
      "SELECT business_name FROM businesses WHERE id = $1",
      [req.businessId]
    );

    const businessName = businessResult.rows[0]?.business_name || "Our Restaurant";

    // 3. Generate PDF
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

// Delete table - UPDATED with branch support
router.delete("/:id", auth, subscription, async (req, res) => {
  try {
    // ✅ Use branchId if available
    const filterId = req.branchId || req.businessId;
    
    const result = await pool.query(
      "DELETE FROM tables WHERE id = $1 AND (branch_id = $2 OR business_id = $2) RETURNING id",
      [req.params.id, filterId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Table not found" });
    }

    res.json({ message: "Table deleted" });

  } catch (err) {
    console.error("Delete table error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;