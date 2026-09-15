const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");
const { collectDailyData } = require("../utils/dailySummary");
const { generateSummary } = require("../services/aiSummaryService");

// ─── GET ANALYTICS (Strict Branch Isolation) ──────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const filterId = req.branchId || req.businessId;

    const todayStats = await pool.query(
      `SELECT COUNT(*) as total_orders,
              COALESCE(SUM(total_amount), 0) as total_revenue
       FROM orders
       WHERE branch_id = $1
       AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
       AND status != 'REJECTED'`,
      [filterId]
    );

    const activeTables = await pool.query(
      `SELECT COUNT(DISTINCT table_id) as count
       FROM orders
       WHERE branch_id = $1
       AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
       AND status NOT IN ('REJECTED', 'SERVED', 'PAID')`,
      [filterId]
    );

    const totalTablesResult = await pool.query(
      `SELECT COUNT(*) as count FROM tables 
       WHERE branch_id = $1`,
      [filterId]
    );

    const mostOrdered = await pool.query(
      `SELECT item->>'name' as name,
              SUM((item->>'quantity')::int) as total_qty
       FROM orders,
            jsonb_array_elements(items) as item
       WHERE branch_id = $1
       AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
       AND status != 'REJECTED'
       GROUP BY item->>'name'
       ORDER BY total_qty DESC
       LIMIT 1`,
      [filterId]
    );

    const last30Days = await pool.query(
      `SELECT DATE(created_at) as date,
              COUNT(*) as orders,
              COALESCE(SUM(total_amount), 0) as revenue
       FROM orders
       WHERE branch_id = $1
       AND created_at >= NOW() - INTERVAL '30 days'
       AND status != 'REJECTED'
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [filterId]
    );

    const last90Days = await pool.query(
      `SELECT COUNT(*) as total_orders,
              COALESCE(SUM(total_amount), 0) as total_revenue
       FROM orders
       WHERE branch_id = $1
       AND created_at >= NOW() - INTERVAL '90 days'
       AND status != 'REJECTED'`,
      [filterId]
    );

    const topItems = await pool.query(
      `SELECT item->>'name' as name,
              SUM((item->>'quantity')::int) as total_qty
       FROM orders,
            jsonb_array_elements(items) as item
       WHERE branch_id = $1
       AND status != 'REJECTED'
       GROUP BY item->>'name'
       ORDER BY total_qty DESC
       LIMIT 5`,
      [filterId]
    );

    const peakHour = await pool.query(
      `SELECT EXTRACT(HOUR FROM created_at) as hour,
              COUNT(*) as count
       FROM orders
       WHERE branch_id = $1
       AND status != 'REJECTED'
       GROUP BY hour
       ORDER BY count DESC
       LIMIT 1`,
      [filterId]
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
      tablesOccupied: parseInt(activeTables.rows[0].count),
      totalTables: parseInt(totalTablesResult.rows[0].count),
    });

  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GET DAILY SUMMARY (Strict Branch) ──────────────────────────────
router.get("/daily-summary", auth, async (req, res) => {
  try {
    const filterId = req.branchId || req.businessId;
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // ✅ Add ORDER BY generated_at DESC LIMIT 1
    let result = await pool.query(
      `SELECT id, summary_date, summary_text, key_metrics, displayed
       FROM daily_summaries 
       WHERE branch_id = $1 AND summary_date = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [filterId, yesterdayStr]
    );

    let row = result.rows[0];

    if (!row) {
      console.log(`🔄 Generating on-demand summary for ${filterId}...`);

      const data = await collectDailyData(filterId, yesterday);

      if (data.totalOrders > 0) {
        const summary = await generateSummary(data);

        const insertResult = await pool.query(
          `INSERT INTO daily_summaries 
           (business_id, branch_id, summary_date, summary_text, key_metrics, displayed)
           VALUES ($1, $2, $3, $4, $5, false)
           RETURNING id, summary_date, summary_text, key_metrics, displayed`,
          [req.businessId, filterId, yesterdayStr, summary, JSON.stringify(data)]
        );
        row = insertResult.rows[0];
        console.log(`✅ On-demand summary generated and saved.`);
      } else {
        return res.json({ 
          hasSummary: false, 
          message: "No orders found for yesterday." 
        });
      }
    }

    const metrics = row.key_metrics || {};
    const isNew = !row.displayed;

    if (isNew) {
      await pool.query(
        `UPDATE daily_summaries SET displayed = true WHERE id = $1`,
        [row.id]
      );
    }

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

// ─── GET NEXT HOURLY INSIGHT (Strict Branch) ────────────────────────
router.get("/next-insight", auth, async (req, res) => {
  try {
    const filterId = req.branchId || req.businessId;
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT id, insight_text, insight_order, insight_type
       FROM hourly_insights
       WHERE branch_id = $1 
       AND insight_date = $2 AND displayed = false
       ORDER BY insight_order ASC
       LIMIT 1`,
      [filterId, yesterdayStr]
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

// ══════════════════════════════════════════════════════════════════════
// AI BUSINESS SUMMARY + ALERTS (Strict Branch)
// ══════════════════════════════════════════════════════════════════════
const { generateAndSaveBrief, runAlertsCheck } = require("../jobs/scheduler");

// ─── GET CURRENT BUSINESS SUMMARY ─────────────────────────────────────
router.get("/business-summary/current", auth, async (req, res) => {
  try {
    const filterId = req.branchId || req.businessId;
    
    const summaryDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const summaryHour = parseInt(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }),
      10
    );

    // ✅ Add ORDER BY generated_at DESC LIMIT 1
    let result = await pool.query(
      `SELECT * FROM business_summaries
       WHERE branch_id = $1 
       AND summary_date = $2 AND summary_hour = $3
       ORDER BY generated_at DESC
       LIMIT 1`,
      [filterId, summaryDate, summaryHour]
    );

    let row = result.rows[0];
    let isNew = false;

    if (!row) {
      console.log(`🔄 Generating on-demand business summary for ${filterId}...`);
      row = await generateAndSaveBrief(filterId);
      isNew = true;
    }

    if (!row.is_read) {
      await pool.query(
        `UPDATE business_summaries SET is_read = true WHERE id = $1`,
        [row.id]
      );
      row = { ...row, is_read: true };
    }

    res.json({
      hasSummary: true,
      ...row,
      is_new: isNew,
    });
  } catch (err) {
    console.error("Business summary current error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── POST GENERATE BUSINESS SUMMARY (manual button) ──────────────────
router.post("/business-summary/generate", auth, async (req, res) => {
  try {
    const filterId = req.branchId || req.businessId;
    const row = await generateAndSaveBrief(filterId);
    res.json({ ...row, is_new: true });
  } catch (err) {
    console.error("Business summary generate error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GET ALERTS (Strict Branch) ───────────────────────────────────────
router.get("/alerts", auth, async (req, res) => {
  try {
    const filterId = req.branchId || req.businessId;
    const limit = parseInt(req.query.limit, 10) || 30;

    const alertsResult = await pool.query(
      `SELECT * FROM business_alerts
       WHERE branch_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [filterId, limit]
    );

    const unreadResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM business_alerts
       WHERE branch_id = $1 AND is_read = false`,
      [filterId]
    );

    res.json({
      alerts: alertsResult.rows,
      unreadCount: unreadResult.rows[0].count,
    });
  } catch (err) {
    console.error("Get alerts error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── POST MARK SINGLE ALERT READ ─────────────────────────────────────
router.post("/alerts/:id/read", auth, async (req, res) => {
  try {
    const filterId = req.branchId || req.businessId;
    
    const result = await pool.query(
      `UPDATE business_alerts SET is_read = true
       WHERE id = $1 AND branch_id = $2
       RETURNING *`,
      [req.params.id, filterId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Alert not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Mark alert read error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── POST MARK ALL ALERTS READ ───────────────────────────────────────
router.post("/alerts/read-all", auth, async (req, res) => {
  try {
    const filterId = req.branchId || req.businessId;
    
    const result = await pool.query(
      `UPDATE business_alerts SET is_read = true
       WHERE branch_id = $1 AND is_read = false
       RETURNING id`,
      [filterId]
    );

    res.json({ updated: result.rows.length });
  } catch (err) {
    console.error("Mark all alerts read error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── POST CHECK-ALERTS-NOW ──────────────────────────────────────────
router.post("/alerts/check-now", auth, async (req, res) => {
  try {
    const filterId = req.branchId || req.businessId;
    
    const newAlerts = await runAlertsCheck(filterId);
    res.json({ newAlerts, count: newAlerts.length });
  } catch (err) {
    console.error("Check alerts now error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;