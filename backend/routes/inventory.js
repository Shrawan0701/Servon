const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");

// ─── LIST INVENTORY ITEMS ─────────────────────────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *, (current_stock <= low_stock_threshold) AS is_low
       FROM inventory_items
       WHERE business_id = $1
       ORDER BY name`,
      [req.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch inventory error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── LOW STOCK COUNT (for dashboard badge) ────────────────────────────
router.get("/alerts/count", auth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT COUNT(*) FROM inventory_items WHERE business_id = $1 AND current_stock <= low_stock_threshold",
      [req.businessId]
    );
    res.json({ count: parseInt(result.rows[0].count, 10) });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── ADD ITEM ──────────────────────────────────────────────────────────
router.post("/", auth, async (req, res) => {
  const { name, unit, current_stock, low_stock_threshold } = req.body;
  if (!name || !unit) return res.status(400).json({ error: "Name and unit are required" });

  try {
    const result = await pool.query(
      `INSERT INTO inventory_items (business_id, name, unit, current_stock, low_stock_threshold)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.businessId, name, unit, parseFloat(current_stock) || 0, parseFloat(low_stock_threshold) || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Add inventory item error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── UPDATE ITEM DETAILS (name/unit/threshold) ────────────────────────
router.put("/:id", auth, async (req, res) => {
  const { name, unit, low_stock_threshold } = req.body;
  try {
    const existing = await pool.query(
      "SELECT * FROM inventory_items WHERE id = $1 AND business_id = $2",
      [req.params.id, req.businessId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: "Item not found" });

    const result = await pool.query(
      `UPDATE inventory_items
       SET name = $1, unit = $2, low_stock_threshold = $3, updated_at = NOW()
       WHERE id = $4 AND business_id = $5 RETURNING *`,
      [
        name || existing.rows[0].name,
        unit || existing.rows[0].unit,
        low_stock_threshold !== undefined ? parseFloat(low_stock_threshold) : existing.rows[0].low_stock_threshold,
        req.params.id,
        req.businessId,
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
    const result = await pool.query(
      `UPDATE inventory_items SET current_stock = current_stock + $1, updated_at = NOW()
       WHERE id = $2 AND business_id = $3 RETURNING *`,
      [value, req.params.id, req.businessId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Item not found" });

    await pool.query(
      `INSERT INTO inventory_stock_logs (business_id, inventory_item_id, change_amount, reason)
       VALUES ($1, $2, $3, 'restock')`,
      [req.businessId, req.params.id, value]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Restock error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── MANUAL ADJUSTMENT (set exact stock, e.g. after a physical count) ──
router.patch("/:id/adjust", auth, async (req, res) => {
  const { new_stock } = req.body;
  const value = parseFloat(new_stock);
  if (isNaN(value) || value < 0) return res.status(400).json({ error: "Enter a valid stock value" });

  try {
    const existing = await pool.query(
      "SELECT current_stock FROM inventory_items WHERE id = $1 AND business_id = $2",
      [req.params.id, req.businessId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: "Item not found" });

    const delta = value - parseFloat(existing.rows[0].current_stock);

    const result = await pool.query(
      `UPDATE inventory_items SET current_stock = $1, updated_at = NOW()
       WHERE id = $2 AND business_id = $3 RETURNING *`,
      [value, req.params.id, req.businessId]
    );

    await pool.query(
      `INSERT INTO inventory_stock_logs (business_id, inventory_item_id, change_amount, reason)
       VALUES ($1, $2, $3, 'manual_adjustment')`,
      [req.businessId, req.params.id, delta]
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
    const result = await pool.query(
      "DELETE FROM inventory_items WHERE id = $1 AND business_id = $2 RETURNING id",
      [req.params.id, req.businessId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Item not found" });
    res.json({ message: "Item deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── RECIPES: menu items + how many ingredients each has configured ───
router.get("/recipes", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.id, m.name, m.category,
              COUNT(mi.id)::int AS ingredient_count
       FROM menu_items m
       LEFT JOIN menu_item_ingredients mi
         ON mi.menu_item_id = m.id AND mi.business_id = m.business_id
       WHERE m.business_id = $1
       GROUP BY m.id
       ORDER BY m.category, m.name`,
      [req.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch recipes error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── RECIPE: ingredients for one menu item ─────────────────────────────
router.get("/recipes/:menuItemId", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT mi.inventory_item_id, mi.quantity_required, ii.name, ii.unit, ii.current_stock
       FROM menu_item_ingredients mi
       JOIN inventory_items ii ON ii.id = mi.inventory_item_id
       WHERE mi.menu_item_id = $1 AND mi.business_id = $2`,
      [req.params.menuItemId, req.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch recipe error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── RECIPE: set/replace ingredients for one menu item ─────────────────
router.put("/recipes/:menuItemId", auth, async (req, res) => {
  const { ingredients } = req.body; // [{ inventory_item_id, quantity_required }]
  if (!Array.isArray(ingredients)) return res.status(400).json({ error: "Ingredients must be an array" });

  try {
    await pool.query(
      "DELETE FROM menu_item_ingredients WHERE menu_item_id = $1 AND business_id = $2",
      [req.params.menuItemId, req.businessId]
    );

    for (const ing of ingredients) {
      const qty = parseFloat(ing.quantity_required);
      if (!ing.inventory_item_id || !qty || qty <= 0) continue;
      await pool.query(
        `INSERT INTO menu_item_ingredients (business_id, menu_item_id, inventory_item_id, quantity_required)
         VALUES ($1, $2, $3, $4)`,
        [req.businessId, req.params.menuItemId, ing.inventory_item_id, qty]
      );
    }

    const result = await pool.query(
      `SELECT mi.inventory_item_id, mi.quantity_required, ii.name, ii.unit
       FROM menu_item_ingredients mi
       JOIN inventory_items ii ON ii.id = mi.inventory_item_id
       WHERE mi.menu_item_id = $1 AND mi.business_id = $2`,
      [req.params.menuItemId, req.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Save recipe error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;