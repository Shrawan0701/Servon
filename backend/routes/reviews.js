const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");

// 1. Customer: Submit a Review (Public Route)
// 1. Customer: Submit a Review (Public Route)
router.post("/", async (req, res) => {
  const { businessId, tableNumber, orderId, items, rating, comment } = req.body;

  if (!businessId || !rating) {
    return res.status(400).json({ error: "Business ID and Rating are required" });
  }

  try {
    let orderedItems = [];

    // Option A: If the feedback page sent the exact items in req.body, use them directly
    if (items && Array.isArray(items) && items.length > 0) {
      orderedItems = items;
    } 
    // Option B: If orderId was passed, fetch ONLY that specific order's items
    else if (orderId) {
      const orderResult = await pool.query(
        `SELECT items FROM orders WHERE id = $1 AND business_id = $2`,
        [orderId, businessId]
      );

      if (orderResult.rows.length > 0) {
        const rawItems = orderResult.rows[0].items;
        orderedItems = typeof rawItems === "string" ? JSON.parse(rawItems) : rawItems;
      }
    } 
    // Option C: Fallback to the latest single PAID order for this table
    else if (tableNumber) {
      const recentOrder = await pool.query(
        `SELECT o.items 
         FROM orders o
         JOIN tables t ON o.table_id = t.id
         WHERE o.business_id = $1 
           AND t.table_number = $2 
           AND o.status = 'PAID'
         ORDER BY o.updated_at DESC 
         LIMIT 1`,
        [businessId, tableNumber]
      );

      if (recentOrder.rows.length > 0) {
        const rawItems = recentOrder.rows[0].items;
        orderedItems = typeof rawItems === "string" ? JSON.parse(rawItems) : rawItems;
      }
    }

    // Save the review with ONLY the items from that single receipt
    const result = await pool.query(
      `INSERT INTO reviews (business_id, table_number, rating, comment, ordered_items) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        businessId,
        tableNumber || 'Unknown',
        rating,
        comment || null,
        JSON.stringify(orderedItems)
      ]
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