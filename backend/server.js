require("dotenv").config(); 
const express = require("express"); 
const http = require("http"); 
const cors = require("cors"); 
const fileUpload = require("express-fileupload"); 
const { init: initSocket } = require("./socket"); 
const pool = require("./db"); 
const app = express(); 
const server = http.createServer(app); 
const cron = require('node-cron');
const sendPush = require('./utils/pushNotify');

// Init socket 
// Init socket 
initSocket(server); 

// Middleware 
// REPLACED: app.use(cors({ origin: "*" })); 
const allowedOrigins = [
  "https://servon.cloud",
  "https://www.servon.cloud", // IMPORTANT (you are using this!)
  "https://menu.servon.cloud",
  "https://servon-customer-menu.vercel.app",
  "https://servon-blue.vercel.app",
  "http://localhost:8081"
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps, curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS: " + origin));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// VERY IMPORTANT: handle preflight manually
app.options("*", cors());

app.use(express.json({ limit: "10mb" })); 
// ... rest of your code
app.use(express.urlencoded({ extended: true, limit: "10mb" })); 
app.use(fileUpload({ limits: { fileSize: 5 * 1024 * 1024 } })); // 5MB 

// --- DEBUG LOGGER ---
// This will print every request to your console so we can see the 404 in real-time
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// Routes 
app.use("/api/auth", require("./routes/auth")); 
app.use("/api/subscription", require("./routes/subscription")); 
app.use("/api/menu", require("./routes/menu")); 
app.use("/api/tables", require("./routes/tables")); 
app.use("/api/orders", require("./routes/orders")); 
app.use("/api/analytics", require("./routes/analytics"));
app.use("/api/sales", require("./routes/sales")); 
app.use("/api/profile", require("./routes/profile")); 
app.use('/api/referrals', require('./routes/referrals'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/expenses', require('./routes/expenses'));

// Health check 
app.get("/api/health", (req, res) => res.json({ status: "ok", time: new Date() })); 

// Daily Subscription Expiry Check (10:00 AM)
cron.schedule('0 10 * * *', async () => {
  try {
    const result = await pool.query(`
      SELECT push_token FROM businesses 
      WHERE subscription_end_date::date = (CURRENT_DATE + INTERVAL '3 days')::date
    `);

    result.rows.forEach(row => {
      if (row.push_token) {
        sendPush(row.push_token, "Plan Expiring", "Your Servon plan expires in 3 days. Renew now to avoid interruption!");
      }
    });
  } catch (err) {
    console.error("Cron Job Error:", err);
  }
});

// 404 handler - MUST BE LAST
app.use("*", (req, res) => {
  console.log(`404 triggered for: ${req.originalUrl}`);
  res.status(404).json({ error: "Route not found" });
});

const PORT = process.env.PORT || 5000; 

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servon backend running on port ${PORT}`);
});