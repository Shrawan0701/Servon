const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");
const { uploadImage } = require("../utils/cloudinary");

// Get profile
router.get("/", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id,
              business_name,
              owner_name,
              email,
              phone,
              logo_url,
              description,
              address,
              admin_pin,
              city,
              state,
              pincode,
              gst_number,
              cgst_percentage,
              sgst_percentage,
              subscription_status,
              subscription_start_date,
              subscription_end_date
       FROM businesses
       WHERE id = $1`,
      [req.businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Update profile
router.put("/", auth, async (req, res) => {
  const {
    businessName,
    ownerName,
    phone,
    description,
    address,
    city,
    state,
    pincode,
    gstNumber,
    
    cgstPercentage, // <-- Changed to CGST
    sgstPercentage, // <-- Changed to SGST
  } = req.body;

  try {
    let logoUrl;

    if (req.files && req.files.logo) {
      logoUrl = await uploadImage(
        req.files.logo.data,
        "servon/logos"
      );
    }

    const existing = await pool.query(
      "SELECT * FROM businesses WHERE id = $1",
      [req.businessId]
    );

    const biz = existing.rows[0];

    const result = await pool.query(
      `UPDATE businesses SET
        business_name = $1,
        owner_name = $2,
        phone = $3,
        description = $4,
        address = $5,
        city = $6,
        state = $7,
        pincode = $8,
        gst_number = $9,
        logo_url = $10,
        cgst_percentage = $11,
        sgst_percentage = $12,
        updated_at = NOW()
       WHERE id = $13
       RETURNING id,
                 business_name,
                 owner_name,
                 email,
                 phone,
                 logo_url,
                 description,
                 address,
                 city,
                 state,
                 pincode,
                 gst_number,
                 cgst_percentage,
                 sgst_percentage,
                 admin_pin`,
      [
        businessName || biz.business_name,
        ownerName || biz.owner_name,
        phone || biz.phone,
        description !== undefined ? description : biz.description,
        address !== undefined ? address : biz.address,
        city !== undefined ? city : biz.city,
        state !== undefined ? state : biz.state,
        pincode !== undefined ? pincode : biz.pincode,
        gstNumber !== undefined ? gstNumber : biz.gst_number,
        logoUrl || biz.logo_url,
        cgstPercentage !== undefined ? cgstPercentage : biz.cgst_percentage, 
        sgstPercentage !== undefined ? sgstPercentage : biz.sgst_percentage, 
        req.businessId,
      ]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 1. Owner: Set or Update Admin PIN
router.patch("/pin", auth, async (req, res) => {
  const { pin } = req.body;
  if (!pin || pin.length !== 4) {
    return res.status(400).json({ error: "PIN must be exactly 4 digits" });
  }

  try {
    await pool.query("UPDATE businesses SET admin_pin = $1 WHERE id = $2", [pin, req.businessId]);
    res.json({ message: "Admin PIN set successfully" });
  } catch (err) {
    console.error("Set PIN error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 2. Chef Lockscreen: Verify PIN to Exit Chef Mode
router.post("/verify-pin", auth, async (req, res) => {
  const { pin } = req.body;
  
  try {
    const result = await pool.query("SELECT admin_pin FROM businesses WHERE id = $1", [req.businessId]);
    const actualPin = result.rows[0]?.admin_pin;

    if (!actualPin) {
      return res.status(400).json({ error: "No PIN set by owner yet." });
    }

    if (actualPin === pin) {
      res.json({ success: true });
    } else {
      res.status(401).json({ error: "Incorrect PIN" });
    }
  } catch (err) {
    console.error("Verify PIN error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;