// jobs/scheduler.js — cron jobs for hourly AI business summaries and alert checks
const cron = require("node-cron");
const pool = require("../db");
const { collectBusinessMetrics } = require("../utils/businessMetrics");
const { generateHourlyBrief } = require("../services/aiSummaryService");
const { evaluateAlerts } = require("../services/alertsEngine");

let io = null;

const initScheduler = (socketIO) => {
  io = socketIO;
  console.log("✅ Scheduler initialized with Socket.IO instance");
};

// ─── Generate (or update) this hour's AI business brief ────────────────
const generateAndSaveBrief = async (businessId) => {
  try {
    const metrics = await collectBusinessMetrics(businessId);

    const brief = await generateHourlyBrief(metrics);

    // Use IST (Asia/Kolkata) for date & hour — server may run in UTC
    // toLocaleDateString("en-CA") yields exactly YYYY-MM-DD
    const summaryDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const summaryHour = parseInt(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }),
      10
    );

    const result = await pool.query(
      `INSERT INTO business_summaries
         (business_id, summary_date, summary_hour, summary_text, summary_json, key_metrics, is_read)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       ON CONFLICT (business_id, summary_date, summary_hour)
       DO UPDATE SET
         summary_text = EXCLUDED.summary_text,
         summary_json = EXCLUDED.summary_json,
         key_metrics = EXCLUDED.key_metrics,
         is_read = false,
         generated_at = NOW()
       RETURNING *`,
      [
        businessId,
        summaryDate,
        summaryHour,
        brief.text,
        JSON.stringify(brief.json),
        JSON.stringify(metrics),
      ]
    );

    const row = result.rows[0];

    if (io) {
      io.to(`business_${businessId}`).emit("new_summary", row);
    }

    return row;
  } catch (err) {
    console.error(`generateAndSaveBrief error for ${businessId}:`, err);
    throw err;
  }
};

// ─── Run the alert engine for a business ────────────────────────────────
const runAlertsCheck = async (businessId) => {
  try {
    const metrics = await collectBusinessMetrics(businessId);
    const newAlerts = await evaluateAlerts(businessId, metrics);

    if (io) {
      for (const alertRow of newAlerts) {
        io.to(`business_${businessId}`).emit("new_alert", alertRow);
      }
    }

    return newAlerts;
  } catch (err) {
    console.error(`runAlertsCheck error for ${businessId}:`, err);
    throw err;
  }
};

// ─── Get all active/paying businesses ──────────────────────────────────
const getActiveBusinessIds = async () => {
  const result = await pool.query(
    `SELECT id FROM businesses
     WHERE subscription_status = 'ACTIVE'
     OR subscription_status IS NULL`
  );
  return result.rows.map(r => r.id);
};

// ─── Cron job definitions ───────────────────────────────────────────────
const startCronJobs = () => {
  // Hourly at the top of every hour: generate/save the business brief
  cron.schedule("0 * * * *", async () => {
    console.log(`🔄 [${new Date().toLocaleTimeString()}] Running hourly AI business summary job...`);
    try {
      const ids = await getActiveBusinessIds();
      console.log(`📋 Processing ${ids.length} active businesses for summaries`);
      for (const id of ids) {
        try {
          const row = await generateAndSaveBrief(id);
          console.log(`✅ Brief saved for ${id} (hour ${row.summary_hour})`);
        } catch (err) {
          console.error(`❌ Brief failed for ${id}:`, err.message);
        }
      }
    } catch (err) {
      console.error("❌ Hourly summary cron error:", err);
    }
  });

  // Every 5 minutes: run the alert engine
  cron.schedule("*/5 * * * *", async () => {
    console.log(`🔔 [${new Date().toLocaleTimeString()}] Running alerts check...`);
    try {
      const ids = await getActiveBusinessIds();
      console.log(`📋 Checking ${ids.length} active businesses for alerts`);
      for (const id of ids) {
        try {
          const alerts = await runAlertsCheck(id);
          if (alerts.length > 0) {
            console.log(`🔔 ${alerts.length} alert(s) created for ${id}`);
          }
        } catch (err) {
          console.error(`❌ Alerts failed for ${id}:`, err.message);
        }
      }
    } catch (err) {
      console.error("❌ Alerts cron error:", err);
    }
  });

  console.log("✅ AI Business Summary & Alerts cron jobs scheduled");
};

module.exports = {
  initScheduler,
  startCronJobs,
  generateAndSaveBrief,
  runAlertsCheck,
};