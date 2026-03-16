require("dotenv").config(); 
const express = require("express"); 
const http = require("http"); 
const cors = require("cors"); 
const fileUpload = require("express-fileupload"); 
const { init: initSocket } = require("./socket"); 
const app = express(); 
const server = http.createServer(app); 
// Init socket 
initSocket(server); 
// Middleware 
app.use(cors({ origin: "*" })); 
app.use(express.json({ limit: "10mb" })); 
app.use(express.urlencoded({ extended: true, limit: "10mb" })); 
app.use(fileUpload({ limits: { fileSize: 5 * 1024 * 1024 } })); // 5MB 
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
// Health check 
app.get("/api/health", (req, res) => res.json({ status: "ok", time: new Date() })); 



// 404 handler 
app.use("*", (req, res) => res.status(404).json({ error: "Route not found" })); 

const PORT = process.env.PORT || 5000; 

// REMOVE app.listen() entirely!
// ONLY use server.listen() so both Express and Socket.io work on the same port
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servon backend running on port ${PORT}`);
});