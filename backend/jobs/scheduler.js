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
    // ✅ Determine branch_id — the id passed in is the filter ID (branch or business)
    // We need to know the parent business_id for the row
    const bizRes = await pool.query(
      `SELECT id, parent_id, is_branch FROM businesses WHERE id = $1`,
      [businessId]
    );

    if (bizRes.rows.length === 0) {
      throw new Error(`Business not found: ${businessId}`);
    }

    const biz = bizRes.rows[0];
    const parentBusinessId = biz.is_branch ? biz.parent_id : biz.id;
    const branchId = biz.id; // ✅ Use the actual ID as branch_id

    // Collect metrics for this branch
    const metrics = await collectBusinessMetrics(businessId);

    const brief = await generateHourlyBrief(metrics);

    const summaryDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const summaryHour = parseInt(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }),
      10
    );

    // ✅ Include branch_id in INSERT
    const result = await pool.query(
      `INSERT INTO business_summaries
         (business_id, branch_id, summary_date, summary_hour, summary_text, summary_json, key_metrics, is_read)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false)
       ON CONFLICT (branch_id, summary_date, summary_hour)
       DO UPDATE SET
         business_id = EXCLUDED.business_id,
         summary_text = EXCLUDED.summary_text,
         summary_json = EXCLUDED.summary_json,
         key_metrics = EXCLUDED.key_metrics,
         is_read = false,
         generated_at = NOW()
       RETURNING *`,
      [
        parentBusinessId,   // ✅ Main business ID
        branchId,           // ✅ Branch ID (or main business ID if it's the main)
        summaryDate,
        summaryHour,
        brief.text,
        JSON.stringify(brief.json),
        JSON.stringify(metrics),
      ]
    );

    const row = result.rows[0];
    console.log(`✅ Brief saved for branch ${branchId} (business ${parentBusinessId}) hour ${summaryHour}`);

    // ✅ Emit to both rooms
    if (io) {
      io.to(`business_${parentBusinessId}`).emit("new_summary", row);
      if (branchId !== parentBusinessId) {
        io.to(`branch_${branchId}`).emit("new_summary", row);
      }
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
    // ✅ Determine parent/child
    const bizRes = await pool.query(
      `SELECT id, parent_id, is_branch FROM businesses WHERE id = $1`,
      [businessId]
    );

    if (bizRes.rows.length === 0) {
      throw new Error(`Business not found: ${businessId}`);
    }

    const biz = bizRes.rows[0];
    const parentBusinessId = biz.is_branch ? biz.parent_id : biz.id;
    const branchId = biz.id;

    const metrics = await collectBusinessMetrics(businessId);
    const newAlerts = await evaluateAlerts(businessId, metrics);

    // ✅ Attach branch_id to alerts
    if (io) {
      for (const alertRow of newAlerts) {
        // Save alert with branch_id (assuming alertsEngine already inserts them)
        io.to(`business_${parentBusinessId}`).emit("new_alert", alertRow);
        if (branchId !== parentBusinessId) {
          io.to(`branch_${branchId}`).emit("new_alert", alertRow);
        }
      }
    }

    return newAlerts;
  } catch (err) {
    console.error(`runAlertsCheck error for ${businessId}:`, err);
    throw err;
  }
};

// ─── Get all active/paying businesses AND branches ─────────────────────
const getActiveBusinessIds = async () => {
  // ✅ Get all businesses that are ACTIVE or their branches
  // This returns parent business IDs AND their branch IDs
  const result = await pool.query(
    `SELECT id FROM businesses
     WHERE subscription_status = 'ACTIVE'
     OR subscription_status IS NULL
     OR parent_id IN (
       SELECT id FROM businesses 
       WHERE subscription_status = 'ACTIVE' 
       OR subscription_status IS NULL
     )`
  );
  return result.rows.map(r => r.id);
};

// ─── Cron job definitions ───────────────────────────────────────────────
const startCronJobs = () => {
  cron.schedule(
    "0 * * * *",
    async () => {
      console.log(
        `🔄 [${new Date().toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        })}] Running hourly AI business summary job...`
      );

      try {
        const ids = await getActiveBusinessIds();
        console.log(`📋 Processing ${ids.length} active branches for summaries`);

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
    },
    {
      timezone: "Asia/Kolkata",
    }
  );

  // Every 5 minutes: run the alert engine
  cron.schedule("*/5 * * * *", async () => {
    // ...your existing alert code
  });

  console.log("✅ AI Business Summary & Alerts cron jobs scheduled");
};

module.exports = {
  initScheduler,
  startCronJobs,
  generateAndSaveBrief,
  runAlertsCheck,
};