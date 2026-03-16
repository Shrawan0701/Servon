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

// Add menu item
router.post("/", auth, subscription, async (req, res) => {
  // EXTRACT image_url FROM req.body
  const { name, description, price, category, image_url } = req.body;

  if (!name || !price || !category) {
    return res
      .status(400)
      .json({ error: "Name, price, and category are required" });
  }

  try {
    // USE the image_url directly from the frontend
    const result = await pool.query(
      `INSERT INTO menu_items 
       (business_id, name, description, price, image_url, category)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.businessId, name, description, price, image_url || null, category]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Add menu error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update menu item
router.put("/:id", auth, subscription, async (req, res) => {
  // EXTRACT image_url FROM req.body
  const { name, description, price, category, image_url } = req.body;

  try {
    const existing = await pool.query(
      "SELECT * FROM menu_items WHERE id = $1 AND business_id = $2",
      [req.params.id, req.businessId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }

    // Determine final image URL (keep old one if a new one isn't provided)
    const finalImageUrl = image_url !== undefined ? image_url : existing.rows[0].image_url;

    const result = await pool.query(
      `UPDATE menu_items 
       SET name = $1,
           description = $2,
           price = $3,
           image_url = $4,
           category = $5,
           updated_at = NOW()
       WHERE id = $6 AND business_id = $7
       RETURNING *`,
      [
        name || existing.rows[0].name,
        description !== undefined ? description : existing.rows[0].description,
        price || existing.rows[0].price,
        finalImageUrl,
        category || existing.rows[0].category,
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