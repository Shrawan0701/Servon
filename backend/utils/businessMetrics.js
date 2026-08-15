// utils/businessMetrics.js — collects raw business metrics for the AI summary & alert engine
const pool = require("../db");

// Today's start (Asia/Kolkata) as a timestamptz for consistent "today" filtering
const getTodayStart = () => {
  const todayIST = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  return new Date(`${todayIST}T00:00:00+05:30`);
};

// Yesterday's full-day interval for the day-over-day comparison
const getYesterdayRange = () => {
  const todayStartUTC = getTodayStart();
  const yesterdayStart = new Date(todayStartUTC);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = new Date(todayStartUTC);
  return { yesterdayStart, yesterdayEnd };
};

const getISTHour = () => {
  const hourStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false });
  return parseInt(hourStr, 10);
};

const collectBusinessMetrics = async (businessId) => {
  const todayStart = getTodayStart();
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = new Date(todayStart);

  // ─── 1. Orders / revenue / AOV / cancellations (today) ───────────────────
  const todayOrdersPromise = pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status != 'REJECTED')::int AS total_orders,
       COALESCE(SUM(total_amount) FILTER (WHERE status != 'REJECTED'), 0) AS total_revenue,
       COALESCE(AVG(total_amount) FILTER (WHERE status != 'REJECTED'), 0) AS avg_order_value,
       COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS cancelled_orders,
       COUNT(*)::int AS orders_plus_cancelled
     FROM orders
     WHERE business_id = $1 AND created_at >= $2`,
    [businessId, todayStart]
  );

  // ─── 2. Expenses (today) ──────────────────────────────────────────────────
  const todayExpensesPromise = pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total_expenses
     FROM expenses
     WHERE business_id = $1 AND created_at >= $2`,
    [businessId, todayStart]
  );

  // ─── 3. Top 5 & bottom 5 items (today) ───────────────────────────────────
  const itemsPromise = pool.query(
    `SELECT item->>'name' AS name,
            SUM((item->>'quantity')::int) AS total_qty
     FROM orders,
          jsonb_array_elements(items) AS item
     WHERE business_id = $1
       AND created_at >= $2
       AND status != 'REJECTED'
     GROUP BY item->>'name'
     ORDER BY total_qty DESC`,
    [businessId, todayStart]
  );

  // ─── 4. Peak hours (today) — IST (Asia/Kolkata) ──────────────────────────
  const peakHoursPromise = pool.query(
    `SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata')::int AS hour,
            COUNT(*)::int AS orders
     FROM orders
     WHERE business_id = $1
       AND created_at >= $2
       AND status != 'REJECTED'
     GROUP BY hour
     ORDER BY orders DESC`,
    [businessId, todayStart]
  );

  // ─── 5. Review stats (today) ─────────────────────────────────────────────
  const reviewsPromise = pool.query(
    `SELECT COUNT(*)::int AS total_ratings,
            COALESCE(AVG(rating), 0) AS avg_rating,
            COUNT(*) FILTER (WHERE rating >= 4)::int AS positive_count,
            COUNT(*) FILTER (WHERE rating < 3)::int AS negative_count
     FROM reviews
     WHERE business_id = $1 AND created_at >= $2`,
    [businessId, todayStart]
  );

  // ─── 6. Low-stock inventory items ────────────────────────────────────────
  const lowStockPromise = pool.query(
    `SELECT id, name, unit, current_stock, low_stock_threshold
     FROM inventory_items
     WHERE business_id = $1 AND current_stock <= low_stock_threshold
     ORDER BY (current_stock - low_stock_threshold) ASC
     LIMIT 10`,
    [businessId]
  );

  // ─── 7. Yesterday same-time comparison (up to current IST hour) ──────────
  const yesterdayPromise = pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status != 'REJECTED')::int AS total_orders,
       COALESCE(SUM(total_amount) FILTER (WHERE status != 'REJECTED'), 0) AS total_revenue
     FROM orders
     WHERE business_id = $1
       AND created_at >= $2
       AND created_at < $3
       AND EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata') <= EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Kolkata')`,
    [businessId, yesterdayStart, yesterdayEnd]
  );

  // ─── 8. 7-day trend ──────────────────────────────────────────────────────
  const trendPromise = pool.query(
    `SELECT DATE(created_at AT TIME ZONE 'Asia/Kolkata') AS date,
            COUNT(*) FILTER (WHERE status != 'REJECTED')::int AS orders,
            COALESCE(SUM(total_amount) FILTER (WHERE status != 'REJECTED'), 0) AS revenue
     FROM orders
     WHERE business_id = $1
       AND created_at >= (NOW() - INTERVAL '6 days')
       AND status != 'REJECTED'
     GROUP BY DATE(created_at AT TIME ZONE 'Asia/Kolkata')
     ORDER BY date ASC`,
    [businessId]
  );

  const [today, expenses, items, peakHours, reviews, lowStock, yesterday, trend] =
    await Promise.all([
      todayOrdersPromise,
      todayExpensesPromise,
      itemsPromise,
      peakHoursPromise,
      reviewsPromise,
      lowStockPromise,
      yesterdayPromise,
      trendPromise,
    ]);

  const t = today.rows[0];
  const totalOrders = parseInt(t?.total_orders || 0, 10);
  const totalRevenue = parseFloat(t?.total_revenue || 0);
  const avgOrderValue = parseFloat(t?.avg_order_value || 0);
  const cancelledOrders = parseInt(t?.cancelled_orders || 0, 10);
  const totalExpenses = parseFloat(expenses.rows[0]?.total_expenses || 0);

  const allItems = items.rows || [];
  const topItems = allItems.slice(0, 5).map(i => ({
    name: i.name,
    total_quantity: parseInt(i.total_qty, 10),
  }));
  const bottomItems = allItems.slice(-5).reverse().map(i => ({
    name: i.name,
    total_quantity: parseInt(i.total_qty, 10),
  }));

  const y = yesterday.rows[0];
  // Current hour in IST (Asia/Kolkata) — server may run in UTC
  const currentHour = getISTHour();

  return {
    businessId,
    today: {
      totalOrders,
      totalRevenue,
      avgOrderValue,
      cancelledOrders,
      totalExpenses,
      profit: totalRevenue - totalExpenses,
      topItems,
      bottomItems,
      peakHours: (peakHours.rows || []).map(h => ({
        hour: parseInt(h.hour, 10),
        orders: parseInt(h.orders, 10),
      })),
      reviews: {
        totalRating: parseInt(reviews.rows[0]?.total_ratings || 0, 10),
        avgRating: parseFloat(reviews.rows[0]?.avg_rating || 0),
        positiveCount: parseInt(reviews.rows[0]?.positive_count || 0, 10),
        negativeCount: parseInt(reviews.rows[0]?.negative_count || 0, 10),
      },
      lowStockItems: lowStock.rows || [],
    },
    yesterday: {
      totalOrders: parseInt(y?.total_orders || 0, 10),
      totalRevenue: parseFloat(y?.total_revenue || 0),
      // Same time-of-day window: we fetched up to `currentHour` (IST)
      sameTimeWindowHour: currentHour,
    },
    trend: (trend.rows || []).map(d => ({
      date: d.date instanceof Date ? d.date.toISOString().split("T")[0] : d.date,
      orders: parseInt(d.orders, 10),
      revenue: parseFloat(d.revenue || 0),
    })),
    generatedAt: new Date().toISOString(),
  };
};

module.exports = { collectBusinessMetrics };