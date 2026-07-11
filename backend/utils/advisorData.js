// utils/advisorData.js
const pool = require('../db');

/**
 * Collect all business data needed for AI analysis
 */
const collectAdvisorData = async (businessId, dateRange = '30 days') => {
  const rangeClause = `NOW() - INTERVAL '${dateRange}'`;

  // ─── ORDERS ──────────────────────────────────────────────────────────
  const ordersResult = await pool.query(`
    SELECT 
      COUNT(*) as total_orders,
      COALESCE(SUM(total_amount), 0) as total_revenue,
      COALESCE(AVG(total_amount), 0) as avg_order_value,
      MIN(total_amount) as min_order,
      MAX(total_amount) as max_order,
      COUNT(DISTINCT table_id) as tables_used
    FROM orders
    WHERE business_id = $1
      AND created_at >= ${rangeClause}
      AND status != 'REJECTED'
  `, [businessId]);

  // ─── DAILY TREND ────────────────────────────────────────────────────
  const dailyTrend = await pool.query(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as orders,
      COALESCE(SUM(total_amount), 0) as revenue
    FROM orders
    WHERE business_id = $1
      AND created_at >= ${rangeClause}
      AND status != 'REJECTED'
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 30
  `, [businessId]);

  // ─── TOP ITEMS ──────────────────────────────────────────────────────
  const topItems = await pool.query(`
    SELECT 
      item->>'name' as name,
      SUM((item->>'quantity')::int) as total_quantity,
      SUM((item->>'price')::float * (item->>'quantity')::int) as total_revenue
    FROM orders,
    jsonb_array_elements(items) as item
    WHERE business_id = $1
      AND created_at >= ${rangeClause}
      AND status != 'REJECTED'
    GROUP BY item->>'name'
    ORDER BY total_quantity DESC
    LIMIT 10
  `, [businessId]);

  // ─── PEAK HOURS ────────────────────────────────────────────────────
  const peakHours = await pool.query(`
    SELECT 
      EXTRACT(HOUR FROM created_at) as hour,
      COUNT(*) as orders,
      COALESCE(SUM(total_amount), 0) as revenue
    FROM orders
    WHERE business_id = $1
      AND created_at >= ${rangeClause}
      AND status != 'REJECTED'
    GROUP BY hour
    ORDER BY orders DESC
  `, [businessId]);

  // ─── WEEKDAY PATTERNS ──────────────────────────────────────────────
  const weekdayPattern = await pool.query(`
    SELECT 
      EXTRACT(DOW FROM created_at) as day_of_week,
      COUNT(*) as orders,
      COALESCE(SUM(total_amount), 0) as revenue
    FROM orders
    WHERE business_id = $1
      AND created_at >= ${rangeClause}
      AND status != 'REJECTED'
    GROUP BY day_of_week
    ORDER BY day_of_week
  `, [businessId]);

  // ─── REVIEWS / RATINGS ─────────────────────────────────────────────
  const reviews = await pool.query(`
    SELECT 
      COUNT(*) as total_reviews,
      COALESCE(AVG(rating), 0) as avg_rating,
      COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive,
      COUNT(CASE WHEN rating < 3 THEN 1 END) as negative
    FROM reviews
    WHERE business_id = $1
      AND created_at >= ${rangeClause}
  `, [businessId]);

  return {
    dateRange,
    summary: {
      totalOrders: parseInt(ordersResult.rows[0]?.total_orders || 0),
      totalRevenue: parseFloat(ordersResult.rows[0]?.total_revenue || 0),
      avgOrderValue: parseFloat(ordersResult.rows[0]?.avg_order_value || 0),
      minOrder: parseFloat(ordersResult.rows[0]?.min_order || 0),
      maxOrder: parseFloat(ordersResult.rows[0]?.max_order || 0),
      tablesUsed: parseInt(ordersResult.rows[0]?.tables_used || 0),
    },
    dailyTrend: dailyTrend.rows,
    topItems: topItems.rows,
    peakHours: peakHours.rows,
    weekdayPattern: weekdayPattern.rows,
reviews: reviews.rows[0] 
  ? { 
      total_reviews: parseInt(reviews.rows[0].total_reviews || 0), 
      avg_rating: parseFloat(reviews.rows[0].avg_rating || 0),   // ← ADD parseFloat
      positive: parseInt(reviews.rows[0].positive || 0), 
      negative: parseInt(reviews.rows[0].negative || 0) 
    }
  : { total_reviews: 0, avg_rating: 0, positive: 0, negative: 0 },  };
};

module.exports = { collectAdvisorData };