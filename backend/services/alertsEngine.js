// services/alertsEngine.js — evaluates real-time metrics and creates business alerts
const pool = require("../db");

const COOLDOWN_HOURS = 3;

// ─── Check cooldown (same alert_type within last 3 hours) ───────────────
const isWithinCooldown = async (businessId, alertType) => {
  const result = await pool.query(
    `SELECT id FROM business_alerts
     WHERE business_id = $1
       AND alert_type = $2
       AND created_at >= NOW() - ($3 || ' hours')::interval
     LIMIT 1`,
    [businessId, alertType, COOLDOWN_HOURS]
  );
  return result.rows.length > 0;
};

// ─── Rule functions: each returns null or an alert object ───────────────
const ruleRevenueChange = (metrics) => {
  const todayRevenue = metrics?.today?.totalRevenue || 0;
  const yesterdayRevenue = metrics?.yesterday?.totalRevenue || 0;
  if (!yesterdayRevenue || yesterdayRevenue <= 0) return null;

  const pctChange = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;

  if (pctChange >= 20) {
    return {
      alert_type: 'revenue_spike',
      severity: 'info',
      title: '📈 Revenue Spike',
      message: `Revenue is up ${pctChange.toFixed(0)}% vs yesterday at this time. Great momentum!`,
      metric_data: { today_revenue: todayRevenue, yesterday_revenue: yesterdayRevenue, pct_change: pctChange },
    };
  }

  if (pctChange <= -30) {
    return {
      alert_type: 'revenue_drop',
      severity: 'warning',
      title: '📉 Revenue Drop',
      message: `Revenue is down ${Math.abs(pctChange).toFixed(0)}% vs yesterday at this time. Consider a promo or check service.`,
      metric_data: { today_revenue: todayRevenue, yesterday_revenue: yesterdayRevenue, pct_change: pctChange },
    };
  }

  return null;
};

const ruleRatingDrop = (metrics) => {
  const reviews = metrics?.today?.reviews || {};
  if ((reviews.totalRating || 0) < 3) return null;
  if ((reviews.avgRating || 5) >= 3.5) return null;

  return {
    alert_type: 'rating_drop',
    severity: 'warning',
    title: '⭐ Rating Drop',
    message: `Average rating is ${(reviews.avgRating || 0).toFixed(1)} from ${reviews.totalRating} reviews today. Check recent feedback.`,
    metric_data: { total_ratings: reviews.totalRating, avg_rating: reviews.avgRating },
  };
};

const ruleItemTrending = (metrics) => {
  const topItems = metrics?.today?.topItems || [];
  const best = topItems[0];
  if (!best || (best.total_quantity || 0) < 15) return null;

  return {
    alert_type: 'item_trending',
    severity: 'info',
    title: '🔥 Item Trending',
    message: `${best.name} is on fire with ${best.total_quantity} orders today!`,
    metric_data: { item_name: best.name, quantity: best.total_quantity },
  };
};

const ruleInventoryLow = (metrics) => {
  const lowStock = metrics?.today?.lowStockItems || [];
  if (lowStock.length === 0) return null;

  const names = lowStock.slice(0, 3).map(i => i.name).join(', ');

  return {
    alert_type: 'inventory_low',
    severity: 'warning',
    title: '📦 Low Stock Alert',
    message: `Running low: ${names}${lowStock.length > 3 ? ` +${lowStock.length - 3} more` : ''}.`,
    metric_data: { low_stock_items: lowStock.map(i => ({ name: i.name, current_stock: i.current_stock, low_stock_threshold: i.low_stock_threshold })) },
  };
};

const ruleExpenseHigh = (metrics) => {
  const revenue = metrics?.today?.totalRevenue || 0;
  const expenses = metrics?.today?.totalExpenses || 0;
  if (revenue <= 0) return null;
  if (expenses <= 0.6 * revenue) return null;

  return {
    alert_type: 'expense_high',
    severity: 'warning',
    title: '💸 High Expenses',
    message: `Expenses (₹${expenses.toFixed(0)}) are over 60% of today's revenue (₹${revenue.toFixed(0)}). Watch your margins.`,
    metric_data: { expenses, revenue },
  };
};

const ruleLunchRush = (metrics, currentHour) => {
  if (currentHour < 12 || currentHour > 14) return null;

  const ordersThisHour = (metrics?.today?.peakHours || [])
    .find(h => h.hour === currentHour)?.orders || 0;

  if (ordersThisHour < 5) return null;

  return {
    alert_type: 'lunch_rush',
    severity: 'info',
    title: '🍽️ Lunch Rush',
    message: `${ordersThisHour} orders this hour — lunch rush is in full swing. Keep the kitchen moving!`,
    metric_data: { hour: currentHour, orders_this_hour: ordersThisHour },
  };
};

const ruleHighCancellations = (metrics) => {
  const cancelled = metrics?.today?.cancelledOrders || 0;
  const orders = metrics?.today?.totalOrders || 0;
  const total = orders + cancelled;
  if (total < 5) return null;
  if (cancelled / total < 0.2) return null;

  return {
    alert_type: 'high_cancellations',
    severity: 'warning',
    title: '🚫 High Cancellations',
    message: `${cancelled} of ${total} orders were cancelled (${((cancelled / total) * 100).toFixed(0)}%). Check for issues.`,
    metric_data: { cancelled_orders: cancelled, total_orders: total, pct_cancelled: (cancelled / total) * 100 },
  };
};

// ─── Main entry point ────────────────────────────────────────────────────
const evaluateAlerts = async (businessId, metrics) => {
  const ruleFunctions = [
    ruleRevenueChange,
    ruleRatingDrop,
    ruleItemTrending,
    ruleInventoryLow,
    ruleExpenseHigh,
    (m) => ruleLunchRush(m, new Date().getHours()),
    ruleHighCancellations,
  ];

  const newAlerts = [];

  for (const ruleFn of ruleFunctions) {
    try {
      const candidate = ruleFn(metrics);
      if (!candidate) continue;

      // Cooldown: skip if the same alert type fired recently
      if (await isWithinCooldown(businessId, candidate.alert_type)) {
        console.log(`⏭️ Cooldown active for ${candidate.alert_type} (${businessId})`);
        continue;
      }

      const result = await pool.query(
        `INSERT INTO business_alerts (business_id, alert_type, severity, title, message, metric_data)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, business_id, alert_type, severity, title, message, metric_data, is_read, created_at`,
        [businessId, candidate.alert_type, candidate.severity, candidate.title, candidate.message, JSON.stringify(candidate.metric_data || {})]
      );

      newAlerts.push(result.rows[0]);
      console.log(`🔔 New alert created: ${candidate.alert_type} for ${businessId}`);
    } catch (err) {
      console.error(`Alert rule error (${ruleFn.name || 'unknown'}):`, err);
    }
  }

  return newAlerts;
};

module.exports = { evaluateAlerts };