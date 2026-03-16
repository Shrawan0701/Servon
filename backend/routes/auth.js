const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { generateOTP, sendOTP } = require("../utils/otp");

// Signup
router.post("/signup", async (req, res) => {
  // <-- Added referralCode to req.body extraction
  const { businessName, ownerName, email, phone, password, referralCode } = req.body;

  if (!businessName || !ownerName || !email || !phone || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const existing = await pool.query(
      "SELECT id FROM businesses WHERE email = $1 OR phone = $2",
      [email, phone]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email or phone already registered" });
    }

    // --- 1. REFERRAL CODE GENERATION & VALIDATION ---
    const baseName = businessName.substring(0, 4).toUpperCase().replace(/\s/g, '');
    const newReferralCode = baseName + Math.floor(1000 + Math.random() * 9000);

    let referrerId = null;
    if (referralCode) {
      const referrerRes = await pool.query("SELECT id FROM businesses WHERE referral_code = $1", [referralCode]);
      if (referrerRes.rows.length > 0) {
        referrerId = referrerRes.rows[0].id;
      }
    }
    // ------------------------------------------------

    const passwordHash = await bcrypt.hash(password, 12);

    // --- 2. ADDED referral_code AND referred_by TO INSERT ---
    const result = await pool.query(
      `INSERT INTO businesses 
      (business_name, owner_name, email, phone, password_hash, subscription_status, referral_code, referred_by)
      VALUES ($1, $2, $3, $4, $5, 'INACTIVE', $6, $7)
      RETURNING id, business_name, owner_name, email, phone, subscription_status, referral_code`,
      [businessName, ownerName, email, phone, passwordHash, newReferralCode, referrerId]
    );

    const business = result.rows[0];

    // --- 3. LOG TO REFERRALS TABLE AS PENDING ---
    if (referrerId) {
      await pool.query(
        `INSERT INTO referrals (referrer_id, referred_id, status) VALUES ($1, $2, 'PENDING')`,
        [referrerId, business.id]
      );
    }
    // --------------------------------------------

    const token = jwt.sign(
      { businessId: business.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    res.status(201).json({ token, business });

  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM businesses WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const business = result.rows[0];
    const valid = await bcrypt.compare(password, business.password_hash);

    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check if subscription expired
    const now = new Date();

    if (
      business.subscription_status === "ACTIVE" &&
      business.subscription_end_date &&
      new Date(business.subscription_end_date) < now
    ) {
      await pool.query(
        "UPDATE businesses SET subscription_status = 'EXPIRED' WHERE id = $1",
        [business.id]
      );
      business.subscription_status = "EXPIRED";
    }

    const token = jwt.sign(
      { businessId: business.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    const { password_hash, otp_code, otp_expires_at, ...safeData } = business;

    res.json({ token, business: safeData });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Forgot Password - Send OTP
router.post("/forgot-password/send-otp", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

  try {
    const result = await pool.query(
      "SELECT id FROM businesses WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Email not registered" });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      "UPDATE businesses SET otp_code = $1, otp_expires_at = $2 WHERE email = $3",
      [otp, expiresAt, email]
    );

    await sendOTP(email, otp);

    res.json({ message: "OTP sent successfully" });

  } catch (err) {
    console.error("Send OTP error:", err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

// Forgot Password - Verify OTP
router.post("/forgot-password/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP required" });
  }

  try {
    const result = await pool.query(
      "SELECT id, otp_code, otp_expires_at FROM businesses WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Email not found" });
    }

    const business = result.rows[0];

    if (business.otp_code !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    if (new Date(business.otp_expires_at) < new Date()) {
      return res.status(400).json({ error: "OTP expired" });
    }

    const resetToken = jwt.sign(
      { businessId: business.id, type: "reset" },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    await pool.query(
      "UPDATE businesses SET otp_code = NULL, otp_expires_at = NULL WHERE id = $1",
      [business.id]
    );

    res.json({ resetToken });

  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Forgot Password - Reset Password
router.post("/forgot-password/reset", async (req, res) => {
  const { resetToken, newPassword } = req.body;

  if (!resetToken || !newPassword) {
    return res.status(400).json({
      error: "Reset token and new password required"
    });
  }

  try {
    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);

    if (decoded.type !== "reset") {
      return res.status(400).json({ error: "Invalid token" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await pool.query(
      "UPDATE businesses SET password_hash = $1, otp_code = NULL, otp_expires_at = NULL WHERE id = $2",
      [passwordHash, decoded.businessId]
    );

    res.json({ message: "Password reset successful" });

  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Invalid or expired token" });
  }
});

// Get current business (me)
router.get("/me", require("../middleware/auth"), async (req, res) => {
  try {
    // <-- ADDED referral_code to this query so the frontend Profile page can use it
    const result = await pool.query(
      `SELECT id, business_name, owner_name, email, phone, logo_url, description,
      address, city, state, pincode, gst_number, referral_code,
      subscription_status, subscription_start_date,
      subscription_end_date, created_at
      FROM businesses WHERE id = $1`,
      [req.businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;