const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");
const subscription = require("../middleware/subscription");

// Get all menu items for a business (public) - UPDATED with branch support
router.get("/public/:businessId", async (req, res) => {
  try {
    // ✅ Get branchId from query if provided
    const branchId = req.query.branchId;
    const filterId = branchId || req.params.businessId;
    
    const result = await pool.query(
      `SELECT * FROM menu_items 
       WHERE (branch_id = $1)
       AND is_available = true 
       ORDER BY category, name`,
      [filterId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Public menu error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all menu items (business owner) - UPDATED with branch support
router.get("/", auth, async (req, res) => {
  try {
    // ✅ Use branchId if available, fall back to businessId
    const filterId = req.branchId || req.businessId;
    
    const result = await pool.query(
      `SELECT * FROM menu_items 
       WHERE (branch_id = $1)
       ORDER BY category, name`,
      [filterId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Fetch menu error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Add menu item (Combined Logic) - UPDATED with branch support
router.post("/", auth, subscription, async (req, res) => {
  const {
    name,
    name_mr,
    name_hi,
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
    // ✅ Determine branch_id for this menu item
    const branchId = req.branchId || req.businessId;
    
    const result = await pool.query(
      `INSERT INTO menu_items 
       (business_id, branch_id, name, name_mr, name_hi, description, price, image_url, category, is_thali, thali_includes, thali_custom) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
       RETURNING *`,
      [
        req.businessId,
        branchId,  // ✅ Added branch_id
        name,
        name_mr || null,
        name_hi || null,
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

// Update menu item (Combined Logic) - UPDATED with branch support
router.put("/:id", auth, subscription, async (req, res) => {
  const {
    name,
    name_mr,
    name_hi,
    description,
    price,
    category,
    image_url,
    is_thali,
    thali_includes,
    thali_custom
  } = req.body;

  try {
    // ✅ Use branchId if available
    const filterId = req.branchId || req.businessId;
    
    const existing = await pool.query(
      "SELECT * FROM menu_items WHERE id = $1 AND (branch_id = $2 OR business_id = $2)",
      [req.params.id, filterId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }

    const finalImageUrl = image_url !== undefined ? image_url : existing.rows[0].image_url;

    const result = await pool.query(
      `UPDATE menu_items 
       SET name = $1, name_mr = $2, name_hi = $3, description = $4, 
           price = $5, image_url = $6, category = $7, is_thali = $8, 
           thali_includes = $9, thali_custom = $10, updated_at = NOW() 
       WHERE id = $11 AND (branch_id = $12 OR business_id = $12) 
       RETURNING *`,
      [
        name || existing.rows[0].name,
        name_mr !== undefined ? name_mr : existing.rows[0].name_mr,
        name_hi !== undefined ? name_hi : existing.rows[0].name_hi,
        description !== undefined ? description : existing.rows[0].description,
        price || existing.rows[0].price,
        finalImageUrl,
        category || existing.rows[0].category,
        is_thali !== undefined ? is_thali : existing.rows[0].is_thali,
        JSON.stringify(thali_includes !== undefined ? thali_includes : (existing.rows[0].thali_includes || [])),
        thali_custom !== undefined ? thali_custom : (existing.rows[0].thali_custom || ""),
        req.params.id,
        filterId,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update menu error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Toggle availability - UPDATED with branch support
router.patch("/:id/availability", auth, async (req, res) => {
  try {
    // ✅ Use branchId if available
    const filterId = req.branchId || req.businessId;
    
    const result = await pool.query(
      `UPDATE menu_items 
       SET is_available = NOT is_available,
           updated_at = NOW()
       WHERE id = $1 AND (branch_id = $2 OR business_id = $2)
       RETURNING *`,
      [req.params.id, filterId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Toggle availability error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete menu item - UPDATED with branch support
router.delete("/:id", auth, subscription, async (req, res) => {
  try {
    // ✅ Use branchId if available
    const filterId = req.branchId || req.businessId;
    
    const result = await pool.query(
      "DELETE FROM menu_items WHERE id = $1 AND (branch_id = $2 OR business_id = $2) RETURNING id",
      [req.params.id, filterId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json({ message: "Item deleted" });
  } catch (err) {
    console.error("Delete menu error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;