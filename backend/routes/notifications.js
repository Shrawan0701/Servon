const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const NotificationService = require("../services/notificationService");

// ─── REGISTER PUSH TOKEN ──────────────────────────────────────────────
router.post("/push-token", auth, async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Push token is required" });
    }
    const row = await NotificationService.savePushToken(req.businessId, token, platform || "unknown");
    res.json({ success: true, data: row });
  } catch (err) {
    console.error("Save push token error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── REMOVE PUSH TOKEN (logout) ──────────────────────────────────────
router.post("/push-token/remove", auth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Push token is required" });
    }
    await NotificationService.removePushToken(req.businessId, token);
    res.json({ success: true });
  } catch (err) {
    console.error("Remove push token error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
