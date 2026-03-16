const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");

// 1. Customer: Submit a Review (Public Route)
router.post("/", async (req, res) => {
  const { businessId, tableNumber, rating, comment } = req.body;

  if (!businessId || !rating) {
    return res.status(400).json({ error: "Business ID and Rating are required" });
  }

  try {
    // SMART LOGIC: Find the paid orders for this table from the last 2 hours
   // SMART LOGIC: Join tables to find the paid orders for this table number from the last 2 hours
    const recentOrders = await pool.query(
      `SELECT o.items 
       FROM orders o
       JOIN tables t ON o.table_id = t.id
       WHERE o.business_id = $1 
         AND t.table_number = $2 
         AND o.status = 'PAID' 
         AND o.updated_at >= NOW() - INTERVAL '2 hours'`,
      [businessId, tableNumber]
    );

    let orderedItems = [];
    recentOrders.rows.forEach(row => {
      const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;
      if (Array.isArray(items)) {
        orderedItems = [...orderedItems, ...items];
      }
    });

    // Insert the review AND the items they ate!
    const result = await pool.query(
      `INSERT INTO reviews (business_id, table_number, rating, comment, ordered_items) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [businessId, tableNumber || 'Unknown', rating, comment || null, JSON.stringify(orderedItems)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Submit review error:", err);
    res.status(500).json({ error: "Failed to submit review" });
  }
});

// 2. Hotel Owner: Get all their reviews
router.get("/", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM reviews WHERE business_id = $1 ORDER BY created_at DESC`,
      [req.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch reviews error:", err);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

module.exports = router;