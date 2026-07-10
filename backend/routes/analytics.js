const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");
const { collectDailyData } = require("../utils/dailySummary");
const { generateSummary } = require("../services/aiSummaryService");
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


// ─── GET DAILY SUMMARY (On‑Demand) ──────────────────────────────────
router.get("/daily-summary", auth, async (req, res) => {
  try {
    const businessId = req.businessId;
    
    // Yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // ─── 1. Check if summary already exists ──────────────────────
    let result = await pool.query(
      `SELECT id, summary_date, summary_text, key_metrics, displayed
       FROM daily_summaries 
       WHERE business_id = $1 AND summary_date = $2`,
      [businessId, yesterdayStr]
    );

    let row = result.rows[0];

    // ─── 2. If NOT exists, generate it NOW (on‑demand) ──────────
    if (!row) {
      console.log(`🔄 Generating on‑demand summary for ${businessId}...`);

      // Collect yesterday's data
      const data = await collectDailyData(businessId, yesterday);

      // Only generate if there were orders
      if (data.totalOrders > 0) {
        const summary = await generateSummary(data);

        // Save to database with displayed = false
        const insertResult = await pool.query(
          `INSERT INTO daily_summaries 
           (business_id, summary_date, summary_text, key_metrics, displayed)
           VALUES ($1, $2, $3, $4, false)
           RETURNING id, summary_date, summary_text, key_metrics, displayed`,
          [businessId, yesterdayStr, summary, JSON.stringify(data)]
        );
        row = insertResult.rows[0];
        console.log(`✅ On‑demand summary generated and saved.`);
      } else {
        // No orders yesterday – return no summary
        return res.json({ 
          hasSummary: false, 
          message: "No orders found for yesterday." 
        });
      }
    }

    // ─── 3. Extract data ──────────────────────────────────────────
    const metrics = row.key_metrics || {};
    const isNew = !row.displayed;

    // ─── 4. Mark as displayed (so it doesn't pop up again) ──────
    if (isNew) {
      await pool.query(
        `UPDATE daily_summaries SET displayed = true WHERE id = $1`,
        [row.id]
      );
    }

    // ─── 5. Return the summary ────────────────────────────────────
    res.json({
      hasSummary: true,
      summary_date: row.summary_date,
      summary_text: row.summary_text,
      total_orders: metrics.totalOrders || 0,
      total_revenue: metrics.totalRevenue || 0,
      avg_order_value: metrics.avgOrderValue || 0,
      is_new: isNew,
    });

  } catch (err) {
    console.error("Daily summary error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
// ─── GET NEXT HOURLY INSIGHT ──────────────────────────────────────
router.get("/next-insight", auth, async (req, res) => {
  try {
    const businessId = req.businessId;
    
    // Always use yesterday's date (insights are generated for yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT id, insight_text, insight_order, insight_type
       FROM hourly_insights
       WHERE business_id = $1 AND insight_date = $2 AND displayed = false
       ORDER BY insight_order ASC
       LIMIT 1`,
      [businessId, yesterdayStr]
    );

    if (result.rows.length === 0) {
      return res.json({ hasNext: false, message: "No more insights for today." });
    }

    const insight = result.rows[0];
    await pool.query(
      `UPDATE hourly_insights SET displayed = true, displayed_at = NOW() WHERE id = $1`,
      [insight.id]
    );

    res.json({
      hasNext: true,
      insight: insight.insight_text,
      order: insight.insight_order,
      type: insight.insight_type,
    });
  } catch (err) {
    console.error("Next insight error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
module.exports = router;