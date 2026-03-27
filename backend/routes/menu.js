const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");
const subscription = require("../middleware/subscription");

// Get all menu items for a business (public)
router.get("/public/:businessId", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM menu_items 
       WHERE business_id = $1 
       AND is_available = true 
       ORDER BY category, name`,
      [req.params.businessId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Get all menu items (business owner)
router.get("/", auth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM menu_items WHERE business_id = $1 ORDER BY category, name",
      [req.businessId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Add menu item (Combined Logic)
router.post("/", auth, subscription, async (req, res) => {
  const { 
    name, 
    description, 
    price, 
    category, 
    image_url, 
    is_thali, 
    thali_includes, 
    thali_custom 
  } = req.body;

  if (!name || !price || !category) {
    return res
      .status(400)
      .json({ error: "Name, price, and category are required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO menu_items 
       (business_id, name, description, price, image_url, category, is_thali, thali_includes, thali_custom)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        req.businessId,
        name,
        description,
        price,
        image_url || null,
        category,
        is_thali || false,
        JSON.stringify(thali_includes || []),
        thali_custom || "",
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Add menu error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update menu item (Combined Logic)
router.put("/:id", auth, subscription, async (req, res) => {
  const { 
    name, 
    description, 
    price, 
    category, 
    image_url, 
    is_thali, 
    thali_includes, 
    thali_custom 
  } = req.body;

  try {
    const existing = await pool.query(
      "SELECT * FROM menu_items WHERE id = $1 AND business_id = $2",
      [req.params.id, req.businessId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }

    const finalImageUrl = image_url !== undefined ? image_url : existing.rows[0].image_url;

    const result = await pool.query(
      `UPDATE menu_items 
       SET name = $1,
           description = $2,
           price = $3,
           image_url = $4,
           category = $5,
           is_thali = $6,
           thali_includes = $7,
           thali_custom = $8,
           updated_at = NOW()
       WHERE id = $9 AND business_id = $10
       RETURNING *`,
      [
        name || existing.rows[0].name,
        description !== undefined ? description : existing.rows[0].description,
        price || existing.rows[0].price,
        finalImageUrl,
        category || existing.rows[0].category,
        is_thali !== undefined ? is_thali : existing.rows[0].is_thali,
        JSON.stringify(thali_includes !== undefined ? thali_includes : (existing.rows[0].thali_includes || [])),
        thali_custom !== undefined ? thali_custom : (existing.rows[0].thali_custom || ""),
        req.params.id,
        req.businessId,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update menu error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Toggle availability
router.patch("/:id/availability", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE menu_items 
       SET is_available = NOT is_available,
           updated_at = NOW()
       WHERE id = $1 AND business_id = $2
       RETURNING *`,
      [req.params.id, req.businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Delete menu item
router.delete("/:id", auth, subscription, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM menu_items WHERE id = $1 AND business_id = $2 RETURNING id",
      [req.params.id, req.businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json({ message: "Item deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;