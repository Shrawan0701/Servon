const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");

// ─── LIST INVENTORY ITEMS ─────────────────────────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    // ✅ Use branchId if available
    const filterId = req.branchId || req.businessId;
    
    const result = await pool.query(
      `SELECT *, (current_stock <= low_stock_threshold) AS is_low
       FROM inventory_items
       WHERE (branch_id = $1)
       ORDER BY name`,
      [filterId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch inventory error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── LOW STOCK COUNT ──────────────────────────────────────────────────
router.get("/alerts/count", auth, async (req, res) => {
  try {
    const filterId = req.branchId || req.businessId;
    
    const result = await pool.query(
      `SELECT COUNT(*) FROM inventory_items 
       WHERE (branch_id = $1) 
       AND current_stock <= low_stock_threshold`,
      [filterId]
    );
    res.json({ count: parseInt(result.rows[0].count, 10) });
  } catch (err) {
    console.error("Low stock count error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── ADD ITEM ──────────────────────────────────────────────────────────
router.post("/", auth, async (req, res) => {
  const { name, unit, current_stock, low_stock_threshold } = req.body;
  if (!name || !unit) return res.status(400).json({ error: "Name and unit are required" });

  try {
    // ✅ Determine branch_id for this item
    const branchId = req.branchId || req.businessId;

    const result = await pool.query(
      `INSERT INTO inventory_items (business_id, branch_id, name, unit, current_stock, low_stock_threshold)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        req.businessId,
        branchId,
        name,
        unit,
        parseFloat(current_stock) || 0,
        parseFloat(low_stock_threshold) || 0
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Add inventory item error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── UPDATE ITEM DETAILS ──────────────────────────────────────────────
router.put("/:id", auth, async (req, res) => {
  const { name, unit, low_stock_threshold } = req.body;
  try {
    const filterId = req.branchId || req.businessId;
    
    const existing = await pool.query(
      "SELECT * FROM inventory_items WHERE id = $1 AND (branch_id = $2 OR business_id = $2)",
      [req.params.id, filterId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: "Item not found" });

    const result = await pool.query(
      `UPDATE inventory_items
       SET name = $1, unit = $2, low_stock_threshold = $3, updated_at = NOW()
       WHERE id = $4 AND (branch_id = $5 OR business_id = $5) RETURNING *`,
      [
        name || existing.rows[0].name,
        unit || existing.rows[0].unit,
        low_stock_threshold !== undefined ? parseFloat(low_stock_threshold) : existing.rows[0].low_stock_threshold,
        req.params.id,
        filterId,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update inventory item error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── RESTOCK (add stock) ───────────────────────────────────────────────
router.patch("/:id/restock", auth, async (req, res) => {
  const { amount } = req.body;
  const value = parseFloat(amount);
  if (!value || value <= 0) return res.status(400).json({ error: "Enter a valid amount" });

  try {
    const filterId = req.branchId || req.businessId;
    
    const result = await pool.query(
      `UPDATE inventory_items SET current_stock = current_stock + $1, updated_at = NOW()
       WHERE id = $2 AND (branch_id = $3 OR business_id = $3) RETURNING *`,
      [value, req.params.id, filterId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Item not found" });

    // ✅ Log restock with branch_id
    await pool.query(
      `INSERT INTO inventory_stock_logs (business_id, branch_id, inventory_item_id, change_amount, reason)
       VALUES ($1, $2, $3, $4, 'restock')`,
      [req.businessId, filterId, req.params.id, value]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Restock error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── MANUAL ADJUSTMENT ────────────────────────────────────────────────
router.patch("/:id/adjust", auth, async (req, res) => {
  const { new_stock } = req.body;
  const value = parseFloat(new_stock);
  if (isNaN(value) || value < 0) return res.status(400).json({ error: "Enter a valid stock value" });

  try {
    const filterId = req.branchId || req.businessId;
    
    const existing = await pool.query(
      "SELECT current_stock FROM inventory_items WHERE id = $1 AND (branch_id = $2 OR business_id = $2)",
      [req.params.id, filterId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: "Item not found" });

    const delta = value - parseFloat(existing.rows[0].current_stock);

    const result = await pool.query(
      `UPDATE inventory_items SET current_stock = $1, updated_at = NOW()
       WHERE id = $2 AND (branch_id = $3 OR business_id = $3) RETURNING *`,
      [value, req.params.id, filterId]
    );

    // ✅ Log adjustment with branch_id
    await pool.query(
      `INSERT INTO inventory_stock_logs (business_id, branch_id, inventory_item_id, change_amount, reason)
       VALUES ($1, $2, $3, $4, 'manual_adjustment')`,
      [req.businessId, filterId, req.params.id, delta]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Adjust stock error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── DELETE ITEM ───────────────────────────────────────────────────────
router.delete("/:id", auth, async (req, res) => {
  try {
    const filterId = req.branchId || req.businessId;
    
    const result = await pool.query(
      "DELETE FROM inventory_items WHERE id = $1 AND (branch_id = $2 OR business_id = $2) RETURNING id",
      [req.params.id, filterId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Item not found" });
    res.json({ message: "Item deleted" });
  } catch (err) {
    console.error("Delete inventory error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── RECIPES ──────────────────────────────────────────────────────────
router.get("/recipes", auth, async (req, res) => {
  try {
    const filterId = req.branchId || req.businessId;
    
    const result = await pool.query(
      `SELECT m.id, m.name, m.category,
              COUNT(mi.id)::int AS ingredient_count
       FROM menu_items m
       LEFT JOIN menu_item_ingredients mi
         ON mi.menu_item_id = m.id AND (mi.branch_id = m.branch_id OR mi.business_id = m.business_id)
       WHERE (m.branch_id = $1 OR m.business_id = $1)
       GROUP BY m.id
       ORDER BY m.category, m.name`,
      [filterId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch recipes error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/recipes/:menuItemId", auth, async (req, res) => {
  try {
    const filterId = req.branchId || req.businessId;
    
    const result = await pool.query(
      `SELECT mi.inventory_item_id, mi.quantity_required, ii.name, ii.unit, ii.current_stock
       FROM menu_item_ingredients mi
       JOIN inventory_items ii ON ii.id = mi.inventory_item_id
       WHERE mi.menu_item_id = $1 AND (mi.branch_id = $2 OR mi.business_id = $2)`,
      [req.params.menuItemId, filterId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch recipe error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/recipes/:menuItemId", auth, async (req, res) => {
  const { ingredients } = req.body;
  if (!Array.isArray(ingredients)) return res.status(400).json({ error: "Ingredients must be an array" });

  try {
    const filterId = req.branchId || req.businessId;
    
    await pool.query(
      "DELETE FROM menu_item_ingredients WHERE menu_item_id = $1 AND (branch_id = $2 OR business_id = $2)",
      [req.params.menuItemId, filterId]
    );

    for (const ing of ingredients) {
      const qty = parseFloat(ing.quantity_required);
      if (!ing.inventory_item_id || !qty || qty <= 0) continue;
      await pool.query(
        `INSERT INTO menu_item_ingredients (business_id, branch_id, menu_item_id, inventory_item_id, quantity_required)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.businessId, filterId, req.params.menuItemId, ing.inventory_item_id, qty]
      );
    }

    const result = await pool.query(
      `SELECT mi.inventory_item_id, mi.quantity_required, ii.name, ii.unit
       FROM menu_item_ingredients mi
       JOIN inventory_items ii ON ii.id = mi.inventory_item_id
       WHERE mi.menu_item_id = $1 AND (mi.branch_id = $2 OR mi.business_id = $2)`,
      [req.params.menuItemId, filterId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Save recipe error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;