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
    // Updated query to include new fields
    const rows = await pool.query(
      `SELECT id, category, amount, description, receipt_url, expense_date, created_at,
              supplier, amount_paid, payment_status, invoice_number, purchase_date, sub_category
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

    // Calculate outstanding summary
    const outstanding = await pool.query(
      `SELECT 
         COALESCE(SUM(amount), 0) AS total_expenses,
         COALESCE(SUM(amount_paid), 0) AS total_paid,
         COALESCE(SUM(amount - amount_paid), 0) AS total_outstanding
       FROM expenses
       WHERE business_id = $1
         AND expense_date >= $2
         AND expense_date < $3`,
      [req.businessId, start, end]
    );

    // Get supplier-wise outstanding
    const supplierSummary = await pool.query(
      `SELECT 
         supplier,
         COALESCE(SUM(amount), 0) AS total,
         COALESCE(SUM(amount_paid), 0) AS paid,
         COALESCE(SUM(amount - amount_paid), 0) AS remaining
       FROM expenses
       WHERE business_id = $1
         AND expense_date >= $2
         AND expense_date < $3
         AND supplier IS NOT NULL
       GROUP BY supplier
       HAVING COALESCE(SUM(amount - amount_paid), 0) > 0
       ORDER BY supplier`,
      [req.businessId, start, end]
    );

    res.json({
      period,
      expenses: rows.rows,
      categoryTotals: totals.rows,
      grandTotal: parseFloat(grand.rows[0].total),
      outstandingSummary: {
        totalExpenses: parseFloat(outstanding.rows[0].total_expenses),
        totalPaid: parseFloat(outstanding.rows[0].total_paid),
        totalOutstanding: parseFloat(outstanding.rows[0].total_outstanding),
      },
      supplierSummary: supplierSummary.rows,
    });

  } catch (err) {
    console.error("Get expenses error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── POST /api/expenses ────────────────────────────────────────────────────────
router.post("/", auth, async (req, res) => {
  const { 
    category, 
    amount, 
    description, 
    expenseDate,
    supplier,
    amountPaid,
    paymentStatus,
    invoiceNumber,
    purchaseDate,
    subCategory
  } = req.body;

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

    // Calculate amount_paid and payment_status if not provided
    const totalAmount = parseFloat(amount);
    const paid = amountPaid !== undefined ? parseFloat(amountPaid) : 0;
    let status = paymentStatus;

    // Auto-calculate payment status if not provided
    if (!status) {
      if (paid >= totalAmount) {
        status = 'paid';
      } else if (paid > 0 && paid < totalAmount) {
        status = 'partially_paid';
      } else {
        status = 'unpaid';
      }
    }

    const result = await pool.query(
      `INSERT INTO expenses (
        business_id, category, amount, description, receipt_url, expense_date,
        supplier, amount_paid, payment_status, invoice_number, purchase_date, sub_category
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        req.businessId,
        category,
        parseFloat(amount),
        description || null,
        receiptUrl,
        expenseDate || new Date().toISOString().split("T")[0],
        supplier || null,
        paid,
        status,
        invoiceNumber || null,
        purchaseDate || null,
        subCategory || null,
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
router.put("/:id", auth, async (req, res) => {
  const { 
    category, 
    amount, 
    description, 
    expenseDate, 
    existingReceiptUrl,
    supplier,
    amountPaid,
    paymentStatus,
    invoiceNumber,
    purchaseDate,
    subCategory
  } = req.body;

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
    let receiptUrl = undefined;

    if (req.files && req.files.receipt) {
      receiptUrl = await uploadImage(req.files.receipt.data, "servon/receipts");
    } else if (existingReceiptUrl !== undefined) {
      receiptUrl = existingReceiptUrl || null;
    }

    // Calculate amount_paid and payment_status
    const totalAmount = parseFloat(amount);
    const paid = amountPaid !== undefined ? parseFloat(amountPaid) : 0;
    let status = paymentStatus;

    if (!status) {
      if (paid >= totalAmount) {
        status = 'paid';
      } else if (paid > 0 && paid < totalAmount) {
        status = 'partially_paid';
      } else {
        status = 'unpaid';
      }
    }

    const fields = [
      "category = $1",
      "amount = $2",
      "description = $3",
      "expense_date = $4",
      "supplier = $5",
      "amount_paid = $6",
      "payment_status = $7",
      "invoice_number = $8",
      "purchase_date = $9",
      "sub_category = $10",
    ];
    const values = [
      category,
      parseFloat(amount),
      description || null,
      expenseDate,
      supplier || null,
      paid,
      status,
      invoiceNumber || null,
      purchaseDate || null,
      subCategory || null,
    ];

    if (receiptUrl !== undefined) {
      fields.push(`receipt_url = $${values.length + 1}`);
      values.push(receiptUrl);
    }

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

// ── GET /api/expenses/suppliers ─────────────────────────────────────────────
// Get unique supplier suggestions for autocomplete
router.get("/suppliers", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT supplier 
       FROM expenses 
       WHERE business_id = $1 
         AND supplier IS NOT NULL 
         AND supplier != ''
       ORDER BY supplier`,
      [req.businessId]
    );

    res.json({ suppliers: result.rows.map(row => row.supplier) });

  } catch (err) {
    console.error("Get suppliers error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/expenses/outstanding ────────────────────────────────────────────
// Get outstanding payables summary
router.get("/outstanding", auth, async (req, res) => {
  const period = req.query.period || "monthly";
  const { start, end } = getDateRange(period);

  try {
    // Overall summary
    const summary = await pool.query(
      `SELECT 
         COALESCE(SUM(amount), 0) AS total_expenses,
         COALESCE(SUM(amount_paid), 0) AS total_paid,
         COALESCE(SUM(amount - amount_paid), 0) AS total_outstanding
       FROM expenses
       WHERE business_id = $1
         AND expense_date >= $2
         AND expense_date < $3`,
      [req.businessId, start, end]
    );

    // Supplier-wise outstanding
    const suppliers = await pool.query(
      `SELECT 
         supplier,
         COALESCE(SUM(amount), 0) AS total,
         COALESCE(SUM(amount_paid), 0) AS paid,
         COALESCE(SUM(amount - amount_paid), 0) AS remaining
       FROM expenses
       WHERE business_id = $1
         AND expense_date >= $2
         AND expense_date < $3
         AND supplier IS NOT NULL
       GROUP BY supplier
       HAVING COALESCE(SUM(amount - amount_paid), 0) > 0
       ORDER BY remaining DESC`,
      [req.businessId, start, end]
    );

    res.json({
      summary: {
        totalExpenses: parseFloat(summary.rows[0].total_expenses),
        totalPaid: parseFloat(summary.rows[0].total_paid),
        totalOutstanding: parseFloat(summary.rows[0].total_outstanding),
      },
      suppliers: suppliers.rows,
    });

  } catch (err) {
    console.error("Get outstanding error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;