const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");

router.get("/", auth, async (req, res) => {
  try {
    const businessId = req.businessId;

    // Today stats
    const todayStats = await pool.query(
      `SELECT COUNT(*) as total_orders,
              COALESCE(SUM(total_amount), 0) as total_revenue
       FROM orders
       WHERE business_id = $1
       AND DATE(created_at) = CURRENT_DATE
       AND status != 'REJECTED'`,
      [businessId]
    );

    // Active tables
    const activeTables = await pool.query(
      `SELECT COUNT(DISTINCT table_id) as count
       FROM orders
       WHERE business_id = $1
       AND DATE(created_at) = CURRENT_DATE
       AND status NOT IN ('REJECTED', 'SERVED')`,
      [businessId]
    );

    // Most ordered item today
    const mostOrdered = await pool.query(
      `SELECT item->>'name' as name,
              SUM((item->>'quantity')::int) as total_qty
       FROM orders,
            jsonb_array_elements(items) as item
       WHERE business_id = $1
       AND DATE(created_at) = CURRENT_DATE
       AND status != 'REJECTED'
       GROUP BY item->>'name'
       ORDER BY total_qty DESC
       LIMIT 1`,
      [businessId]
    );

    // Last 30 days daily stats
    const last30Days = await pool.query(
      `SELECT DATE(created_at) as date,
              COUNT(*) as orders,
              COALESCE(SUM(total_amount), 0) as revenue
       FROM orders
       WHERE business_id = $1
       AND created_at >= NOW() - INTERVAL '30 days'
       AND status != 'REJECTED'
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [businessId]
    );

    // Last 90 days summary
    const last90Days = await pool.query(
      `SELECT COUNT(*) as total_orders,
              COALESCE(SUM(total_amount), 0) as total_revenue
       FROM orders
       WHERE business_id = $1
       AND created_at >= NOW() - INTERVAL '90 days'
       AND status != 'REJECTED'`,
      [businessId]
    );

    // Top 5 items (all time)
    const topItems = await pool.query(
      `SELECT item->>'name' as name,
              SUM((item->>'quantity')::int) as total_qty
       FROM orders,
            jsonb_array_elements(items) as item
       WHERE business_id = $1
       AND status != 'REJECTED'
       GROUP BY item->>'name'
       ORDER BY total_qty DESC
       LIMIT 5`,
      [businessId]
    );

    // Peak order hour
    const peakHour = await pool.query(
      `SELECT EXTRACT(HOUR FROM created_at) as hour,
              COUNT(*) as count
       FROM orders
       WHERE business_id = $1
       AND status != 'REJECTED'
       GROUP BY hour
       ORDER BY count DESC
       LIMIT 1`,
      [businessId]
    );

    res.json({
      today: {
        totalOrders: parseInt(todayStats.rows[0].total_orders),
        totalRevenue: parseFloat(todayStats.rows[0].total_revenue),
        activeTables: parseInt(activeTables.rows[0].count),
        mostOrderedItem: mostOrdered.rows[0] || null,
      },
      last30Days: last30Days.rows,
      last90Days: last90Days.rows[0],
      topItems: topItems.rows,
      peakHour: peakHour.rows[0] || null,
    });

  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;