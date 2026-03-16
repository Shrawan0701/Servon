const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");

// Get referral stats and history
// Get referral stats and history
router.get("/", auth, async (req, res) => {
  try {
    // 1. Get their info
    const bizRes = await pool.query("SELECT business_name, referral_code FROM businesses WHERE id = $1", [req.businessId]);
    
    let refCode = bizRes.rows[0].referral_code;

    // 2. THE FIX: If they are an old user and don't have a code, generate one right now!
    if (!refCode) {
      const baseName = bizRes.rows[0].business_name.substring(0, 4).toUpperCase().replace(/\s/g, '');
      refCode = baseName + Math.floor(1000 + Math.random() * 9000);
      
      // Save it to the database
      await pool.query("UPDATE businesses SET referral_code = $1 WHERE id = $2", [refCode, req.businessId]);
    }

    // 3. Get their referral history
    const historyRes = await pool.query(
      `SELECT r.status, r.created_at, b.business_name 
       FROM referrals r
       JOIN businesses b ON r.referred_id = b.id
       WHERE r.referrer_id = $1
       ORDER BY r.created_at DESC`,
      [req.businessId]
    );

    // 4. Calculate how many times they've redeemed overall
    const redeemRes = await pool.query(
      `SELECT MAX(updated_at) as last_redeemed 
       FROM referrals WHERE referrer_id = $1 AND status = 'REDEEMED'`,
       [req.businessId]
    );

    const successCount = historyRes.rows.filter(r => r.status === 'SUCCESS').length;

    res.json({
      referralCode: refCode, // Send the guaranteed code
      history: historyRes.rows,
      successCount,
      lastRedeemed: redeemRes.rows[0].last_redeemed
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Redeem 5 Successes for 1 Month Free
router.post("/redeem", auth, async (req, res) => {
  try {
    // 1. Check if they have 5 SUCCESS referrals
    const checkRes = await pool.query(
      `SELECT id FROM referrals WHERE referrer_id = $1 AND status = 'SUCCESS' LIMIT 5`,
      [req.businessId]
    );

    if (checkRes.rows.length < 5) {
      return res.status(400).json({ error: "You need 5 successful referrals to redeem." });
    }

    // 2. Check the 30-day cooldown rule
    const lastRedeemRes = await pool.query(
      `SELECT MAX(updated_at) as last_redeemed FROM referrals WHERE referrer_id = $1 AND status = 'REDEEMED'`,
      [req.businessId]
    );
    
    if (lastRedeemRes.rows[0].last_redeemed) {
      const daysSinceLastRedeem = (new Date() - new Date(lastRedeemRes.rows[0].last_redeemed)) / (1000 * 60 * 60 * 24);
      if (daysSinceLastRedeem < 30) {
        return res.status(400).json({ error: "You can only redeem one free month every 30 days." });
      }
    }

    // 3. Mark exactly 5 as REDEEMED
    const idsToUpdate = checkRes.rows.map(r => r.id);
    await pool.query(
      `UPDATE referrals SET status = 'REDEEMED', updated_at = NOW() WHERE id = ANY($1::uuid[])`,
      [idsToUpdate]
    );

    // 4. Add 30 days to their subscription!
    await pool.query(
      `UPDATE businesses 
       SET subscription_end_date = subscription_end_date + INTERVAL '30 days',
           subscription_status = 'ACTIVE'
       WHERE id = $1`,
      [req.businessId]
    );

    res.json({ message: "Successfully redeemed 1 Month Free!" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;