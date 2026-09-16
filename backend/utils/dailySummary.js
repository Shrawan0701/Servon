// utils/dailySummary.js
const pool = require("../db");

const collectDailyData = async (businessId, date) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Summary stats
  const summaryResult = await pool.query(`
    SELECT 
      COUNT(*) as total_orders,
      COALESCE(SUM(total_amount), 0) as total_revenue,
      COALESCE(AVG(total_amount), 0) as avg_order_value,
      COUNT(DISTINCT table_id) as tables_used
    FROM orders
    WHERE business_id = $1
      AND created_at BETWEEN $2 AND $3
      AND status != 'REJECTED'
  `, [businessId, startOfDay, endOfDay]);

  // Top items
  const topItems = await pool.query(`
    SELECT 
      item->>'name' as name,
      SUM((item->>'quantity')::int) as total_quantity
    FROM orders,
    jsonb_array_elements(items) as item
    WHERE business_id = $1
      AND created_at BETWEEN $2 AND $3
      AND status != 'REJECTED'
    GROUP BY item->>'name'
    ORDER BY total_quantity DESC
    LIMIT 5
  `, [businessId, startOfDay, endOfDay]);

  // Peak hours
  const hourly = await pool.query(`
    SELECT 
      EXTRACT(HOUR FROM created_at) as hour,
      COUNT(*) as orders
    FROM orders
    WHERE business_id = $1
      AND created_at BETWEEN $2 AND $3
      AND status != 'REJECTED'
    GROUP BY hour
    ORDER BY hour
  `, [businessId, startOfDay, endOfDay]);

  const row = summaryResult.rows[0];

  return {
    date: date.toISOString().split('T')[0],
    totalOrders: parseInt(row?.total_orders || 0),
    totalRevenue: parseFloat(row?.total_revenue || 0),
    avgOrderValue: parseFloat(row?.avg_order_value || 0),
    tablesUsed: parseInt(row?.tables_used || 0),
    topItems: topItems.rows,
    hourlyDistribution: hourly.rows,
  };
};

module.exports = { collectDailyData };