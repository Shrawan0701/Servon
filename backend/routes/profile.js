const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");
const { uploadImage } = require("../utils/cloudinary");

// Get profile - UPDATED with branch support
router.get("/", auth, async (req, res) => {
  try {
    // ✅ Use branchId if available, fall back to businessId
    const filterId = req.branchId || req.businessId;

    const result = await pool.query(
      `SELECT id,
              business_name,
              branch_name,
              branch_code,
              is_branch,
              is_main_branch,
              parent_id,
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
              subscription_end_date,
              plan_type,
              subscription_plan,
              upi_id
       FROM businesses
       WHERE id = $1`,
      [filterId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    const business = result.rows[0];

    // ✅ Get branches list (for Profile page)
    const parentId = business.is_branch && business.parent_id 
      ? business.parent_id 
      : business.id;

    const branches = await pool.query(
      `SELECT id, business_name, branch_name, branch_code, is_main_branch
       FROM businesses 
       WHERE (id = $1 OR parent_id = $1) AND is_active != false
       ORDER BY is_main_branch DESC, created_at ASC`,
      [parentId]
    );

    res.json({
      ...business,
      branches: branches.rows,
      parentBusinessId: parentId,
    });

  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update profile - UPDATED with branch support
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
    cgstPercentage,
    sgstPercentage,
    upiId,
  } = req.body;

  try {
    // ✅ Use branchId if available
    const filterId = req.branchId || req.businessId;

    let logoUrl;

    if (req.files && req.files.logo) {
      logoUrl = await uploadImage(
        req.files.logo.data,
        "servon/logos"
      );
    }

    const existing = await pool.query(
      "SELECT * FROM businesses WHERE id = $1",
      [filterId]
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
        upi_id = $13,
        updated_at = NOW()
       WHERE id = $14
       RETURNING id,
                 business_name,
                 branch_name,
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
                 admin_pin,
                 upi_id`,
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
        upiId !== undefined ? upiId : biz.upi_id,
        filterId,
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
    const filterId = req.branchId || req.businessId;
    await pool.query("UPDATE businesses SET admin_pin = $1 WHERE id = $2", [pin, filterId]);
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
    const filterId = req.branchId || req.businessId;
    const result = await pool.query("SELECT admin_pin FROM businesses WHERE id = $1", [filterId]);
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

// Upload Business Logo - UPDATED with branch support
router.post("/upload-logo", auth, async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ error: "No files were uploaded." });
    }

    const logoFile = req.files.logo;
    if (!logoFile) {
      return res.status(400).json({ error: "Please upload file with field name 'logo'" });
    }

    // ✅ Use branchId if available
    const filterId = req.branchId || req.businessId;

    const logoUrl = await uploadImage(logoFile.data, "servon/logos");

    const result = await pool.query(
      `UPDATE businesses 
       SET logo_url = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING id, logo_url`,
      [logoUrl, filterId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Logo upload route error:", err);
    res.status(500).json({ error: "Internal server error during upload" });
  }
});

// ─── PUBLIC: Get business profile (no auth) ──────────────────────────
router.get("/public/:businessId", async (req, res) => {
  try {
    const { businessId } = req.params;
    const result = await pool.query(
      `SELECT id, business_name, cgst_percentage, sgst_percentage, gst_number, upi_id 
       FROM businesses WHERE id = $1`,
      [businessId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Business not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;