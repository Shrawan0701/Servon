const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");
const { uploadImage } = require("../utils/cloudinary");

// ── Helpers ──────────────────────────────────────────────────────────────────

const getDateRange = (period) => {
  const now = new Date();
  let start, end;

  if (period === "daily") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else if (period === "weekly") {
    const day = now.getDay(); // 0 = Sunday
    start = new Date(now);
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(start.getDate() + 7);
  } else {
    // monthly (default)
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  return { start, end };
};

// ── GET /api/expenses?period=monthly ─────────────────────────────────────────
router.get("/", auth, async (req, res) => {
  const period = req.query.period || "monthly";
  const { start, end } = getDateRange(period);

  try {
    const rows = await pool.query(
      `SELECT id, category, amount, description, receipt_url, expense_date, created_at
       FROM expenses
       WHERE business_id = $1
         AND expense_date >= $2
         AND expense_date < $3
       ORDER BY expense_date DESC, created_at DESC`,
      [req.businessId, start, end]
    );

    const totals = await pool.query(
      `SELECT category, COALESCE(SUM(amount), 0) AS total
       FROM expenses
       WHERE business_id = $1
         AND expense_date >= $2
         AND expense_date < $3
       GROUP BY category`,
      [req.businessId, start, end]
    );

    const grand = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM expenses
       WHERE business_id = $1
         AND expense_date >= $2
         AND expense_date < $3`,
      [req.businessId, start, end]
    );

    res.json({
      period,
      expenses:       rows.rows,
      categoryTotals: totals.rows,
      grandTotal:     parseFloat(grand.rows[0].total),
    });

  } catch (err) {
    console.error("Get expenses error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── POST /api/expenses ────────────────────────────────────────────────────────
router.post("/", auth, async (req, res) => {
  const { category, amount, description, expenseDate } = req.body;

  if (!category || !amount) {
    return res.status(400).json({ error: "Category and amount are required" });
  }

  const validCategories = ["Utilities", "Payroll", "Procurement", "Maintenance", "Waste", "Other"];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: "Invalid category" });
  }

  if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }

  try {
    let receiptUrl = null;

    if (req.files && req.files.receipt) {
      receiptUrl = await uploadImage(req.files.receipt.data, "servon/receipts");
    }

    const result = await pool.query(
      `INSERT INTO expenses (business_id, category, amount, description, receipt_url, expense_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        req.businessId,
        category,
        parseFloat(amount),
        description || null,
        receiptUrl,
        expenseDate || new Date().toISOString().split("T")[0],
      ]
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error("Add expense error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── DELETE /api/expenses/:id ──────────────────────────────────────────────────
router.delete("/:id", auth, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM expenses WHERE id = $1 AND business_id = $2 RETURNING id",
      [req.params.id, req.businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Expense not found" });
    }

    res.json({ message: "Deleted successfully" });

  } catch (err) {
    console.error("Delete expense error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── PUT /api/expenses/:id ─────────────────────────────────────────────────────
// FIX: Only updates receipt_url if a NEW file is uploaded OR existingReceiptUrl is passed.
// If neither is provided, the existing receipt_url column is left untouched.
router.put("/:id", auth, async (req, res) => {
  const { category, amount, description, expenseDate, existingReceiptUrl } = req.body;

  if (!category || !amount) {
    return res.status(400).json({ error: "Category and amount are required" });
  }

  const validCategories = ["Utilities", "Payroll", "Procurement", "Maintenance", "Waste", "Other"];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: "Invalid category" });
  }

  if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }

  try {
    // undefined = don't touch the column at all
    // string    = set it to this value (new upload or preserved existing)
    // null      = user explicitly removed the receipt
    let receiptUrl = undefined;

    if (req.files && req.files.receipt) {
      // New image uploaded — upload to Cloudinary and use new URL
      receiptUrl = await uploadImage(req.files.receipt.data, "servon/receipts");
    } else if (existingReceiptUrl !== undefined) {
      // Frontend passed back the existing URL (or empty string to clear)
      receiptUrl = existingReceiptUrl || null;
    }
    // else: receiptUrl stays undefined → receipt_url column not touched

    // Build query dynamically so we never accidentally NULL the receipt
    const fields = [
      "category = $1",
      "amount = $2",
      "description = $3",
      "expense_date = $4",
    ];
    const values = [
      category,
      parseFloat(amount),
      description || null,
      expenseDate,
    ];

    if (receiptUrl !== undefined) {
      fields.push(`receipt_url = $${values.length + 1}`);
      values.push(receiptUrl);
    }

    // id and business_id always go last
    const idIdx  = values.length + 1;
    const bizIdx = values.length + 2;
    values.push(req.params.id);
    values.push(req.businessId);

    const result = await pool.query(
      `UPDATE expenses
       SET ${fields.join(", ")}
       WHERE id = $${idIdx} AND business_id = $${bizIdx}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Expense not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error("Update expense error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;