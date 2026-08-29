require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const { init: initSocket, getIO } = require("./socket");
const pool = require("./db");
const app = express();
const server = http.createServer(app);
const cron = require("node-cron");
const sendPush = require("./utils/pushNotify");

// ─── IMPORT AUTH & UTILITIES ──────────────────────────────────────────
const auth = require("./middleware/auth");
const { collectDailyData } = require("./utils/dailySummary");
const { generateSummary, generateInsights } = require("./services/aiSummaryService");

// AI Business Summary + Alerts scheduler
const { initScheduler, startCronJobs } = require("./jobs/scheduler");

// ─── INIT SOCKET ──────────────────────────────────────────────────────
initSocket(server);

// Init & start AI Business Summary + Alerts cron jobs
initScheduler(getIO());
startCronJobs();

// ─── CORS ──────────────────────────────────────────────────────────────
const allowedOrigins = [
  // ─── PRODUCTION ──────────────────────────────────────────────
  "https://servon.cloud",
  "https://www.servon.cloud",
  "https://menu.servon.cloud",
  "https://servon-customer-menu.vercel.app",
  "https://servon-blue.vercel.app",

  // ─── LOCAL DEVELOPMENT ──────────────────────────────────────
  "http://localhost:8081",
  "http://localhost:3000",
  "http://localhost:3001",

  // ─── NETWORK IPs (same Wi-Fi) ──────────────────────────────
  "http://10.193.19.38:8081",
  "http://192.168.1.8:3000",
  "http://192.168.1.8:3001",
  "http://10.61.96.12:3000",
  "http://10.198.185.12:3000",
  "http://10.198.185.12:3001",
  "http://10.198.185.12:8081",
  "http://10.198.185.12:19000",
  "exp://10.198.185.12:19000",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS: " + origin));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options("*", cors());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(fileUpload({ limits: { fileSize: 5 * 1024 * 1024 } }));

// ─── DEBUG LOGGER ──────────────────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// ─── ROUTES ────────────────────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));
app.use("/api/subscription", require("./routes/subscription"));
app.use("/api/trial", require("./routes/trialRoutes"));
app.use("/api/menu", require("./routes/menu"));
app.use("/api/tables", require("./routes/tables"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/analytics", require("./routes/analytics"));
app.use("/api/sales", require("./routes/sales"));
app.use("/api/profile", require("./routes/profile"));
app.use("/api/referrals", require("./routes/referrals"));
app.use("/api/reviews", require("./routes/reviews"));
app.use("/api/expenses", require("./routes/expenses"));
app.use("/api/business", require("./routes/profile"));
app.use("/api/advisor", require("./routes/advisor"));
app.use("/api/action", require("./routes/action"));
app.use("/api/rooms", require("./routes/rooms"));
app.use("/api/inventory", require("./routes/inventory"));
app.use("/api/notifications", require("./routes/notifications"));

// ─── ADMIN ROUTES ──────────────────────────────────────────────────────
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);
console.log('✅ Admin routes registered at /api/admin');

// ─── STAFF ROUTES ──────────────────────────────────────────────────────
const staffRoutes = require('./routes/staff');
app.use('/api/staff', staffRoutes);
console.log('✅ Staff routes registered at /api/staff');

// ─── HEALTH CHECK ─────────────────────────────────────────────────────
app.get("/api/health", (req, res) => res.json({ status: "ok", time: new Date() }));

// ─── DAILY AI SUMMARY CRON (6:00 AM) ────────────────────────────────
cron.schedule("0 6 * * *", async () => {
  console.log("🔄 Running Daily AI Summary...");

  try {
    // Get all businesses with active subscription
    const businesses = await pool.query(
      `SELECT id, business_name, owner_name, push_token, email 
       FROM businesses 
       WHERE subscription_status = 'ACTIVE'`
    );

    for (const biz of businesses.rows) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      // Check if summary already exists for yesterday
      const existing = await pool.query(
        `SELECT id FROM daily_summaries 
         WHERE business_id = $1 AND summary_date = $2`,
        [biz.id, yesterdayStr]
      );
      
      if (existing.rows.length > 0) {
        console.log(`⏭️ Summary already exists for ${biz.business_name}`);
        continue;
      }

      const data = await collectDailyData(biz.id, yesterday);
      
      if (data.totalOrders === 0) {
        console.log(`⏭️ No orders for ${biz.business_name}, skipping.`);
        continue;
      }

      // ─── Generate full summary ──────────────────────────────────────
      console.log(`🤖 Generating summary for ${biz.business_name}...`);
      const summary = await generateSummary(data);

      // Save summary
      await pool.query(
        `INSERT INTO daily_summaries (business_id, summary_date, summary_text, key_metrics, displayed)
         VALUES ($1, $2, $3, $4, false)`,
        [biz.id, yesterdayStr, summary, JSON.stringify(data)]
      );

      // ─── Generate hourly insights ──────────────────────────────────
      const insights = await generateInsights(data);

      // Delete any previous hourly insights for yesterday
      await pool.query(
        `DELETE FROM hourly_insights 
         WHERE business_id = $1 AND insight_date = $2`,
        [biz.id, yesterdayStr]
      );

      for (let i = 0; i < insights.length; i++) {
        const insightType = [
          "orders",
          "revenue",
          "top_item",
          "peak_hour",
          "avg_order",
          "recommendation",
        ][i] || "summary";
        
        await pool.query(
          `INSERT INTO hourly_insights 
           (business_id, insight_date, insight_order, insight_type, insight_text)
           VALUES ($1, $2, $3, $4, $5)`,
          [biz.id, yesterdayStr, i + 1, insightType, insights[i]]
        );
      }

      // ─── Send push notification ────────────────────────────────────
      if (biz.push_token) {
        sendPush(
          biz.push_token,
          "📊 Daily Summary Ready",
          `Yesterday: ${data.totalOrders} orders, ₹${data.totalRevenue.toFixed(0)} revenue. Open app to view insights.`
        );
      }

      console.log(`✅ Summary & insights sent to ${biz.business_name}`);
    }
    console.log("✅ Daily AI Summary completed.");
  } catch (err) {
    console.error("❌ Daily AI Summary error:", err);
  }
});

// ─── SUBSCRIPTION EXPIRY CHECK (10:00 AM) ──────────────────────────
cron.schedule("0 10 * * *", async () => {
  try {
    const result = await pool.query(
      `SELECT push_token FROM businesses 
       WHERE subscription_end_date::date = (CURRENT_DATE + INTERVAL '3 days')::date`
    );
    
    result.rows.forEach((row) => {
      if (row.push_token) {
        sendPush(
          row.push_token,
          "Plan Expiring",
          "Your Servon plan expires in 3 days. Renew now to avoid interruption!"
        );
      }
    });
  } catch (err) {
    console.error("Cron Job Error:", err);
  }
});

// ─── TEST ENDPOINT (manual trigger for debugging) ──────────────────
app.post("/api/admin/trigger-summary", async (req, res) => {
  try {
    const { businessId } = req.body;
    if (!businessId) {
      return res.status(400).json({ error: "businessId required" });
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const data = await collectDailyData(businessId, yesterday);
    
    if (data.totalOrders === 0) {
      return res.json({ message: "No orders found for yesterday." });
    }

    const summary = await generateSummary(data);
    await pool.query(
      `INSERT INTO daily_summaries (business_id, summary_date, summary_text, key_metrics, displayed)
       VALUES ($1, $2, $3, $4, false)
       ON CONFLICT (business_id, summary_date) DO UPDATE 
       SET summary_text = EXCLUDED.summary_text, 
           key_metrics = EXCLUDED.key_metrics, 
           displayed = false`,
      [businessId, yesterdayStr, summary, JSON.stringify(data)]
    );

    const insights = await generateInsights(data);
    await pool.query(
      `DELETE FROM hourly_insights 
       WHERE business_id = $1 AND insight_date = $2`,
      [businessId, yesterdayStr]
    );
    
    for (let i = 0; i < insights.length; i++) {
      const insightType = [
        "orders",
        "revenue",
        "top_item",
        "peak_hour",
        "avg_order",
        "recommendation",
      ][i] || "summary";
      
      await pool.query(
        `INSERT INTO hourly_insights 
         (business_id, insight_date, insight_order, insight_type, insight_text)
         VALUES ($1, $2, $3, $4, $5)`,
        [businessId, yesterdayStr, i + 1, insightType, insights[i]]
      );
    }

    res.json({
      message: "Summary and insights generated successfully.",
      data,
      summary,
      insights,
    });
  } catch (err) {
    console.error("Error in trigger-summary:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── 404 HANDLER ──────────────────────────────────────────────────────
app.use("*", (req, res) => {
  console.log(`404 triggered for: ${req.originalUrl}`);
  res.status(404).json({ error: "Route not found" });
});

// ─── START SERVER ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servon backend running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// ─── GRACEFUL SHUTDOWN ──────────────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
});