const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");

// ─── GET REFERRAL STATS ──────────────────────────────────────────────
// ─── GET REFERRAL STATS & HISTORY ────────────────────────────────────
router.get("/stats", auth, async (req, res) => {
  try {
    const businessId = req.businessId;

    // 1. Get referral code
    const codeResult = await pool.query(
      "SELECT referral_code FROM businesses WHERE id = $1",
      [businessId]
    );

    let referralCode = codeResult.rows[0]?.referral_code;
    if (!referralCode) {
      const nameResult = await pool.query(
        "SELECT business_name FROM businesses WHERE id = $1",
        [businessId]
      );
      const baseName = nameResult.rows[0]?.business_name
        ?.substring(0, 4)
        .toUpperCase()
        .replace(/\s/g, "") || "SERV";
      referralCode = baseName + Math.floor(1000 + Math.random() * 9000);
      await pool.query(
        "UPDATE businesses SET referral_code = $1 WHERE id = $2",
        [referralCode, businessId]
      );
    }

    // 2. Count referrals by status
   // Count referrals by status
const statsResult = await pool.query(
  `SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) as successful,
    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending
   FROM referrals
   WHERE referrer_id = $1`,
  [businessId]
);

    // 3. Get reward usage
    const rewardResult = await pool.query(
      `SELECT referral_rewards_used, referral_rewards_earned 
       FROM businesses WHERE id = $1`,
      [businessId]
    );

    // 4. Check cooldown (last redemption date)
    const cooldownResult = await pool.query(
      `SELECT MAX(created_at) as last_redeemed 
       FROM referral_rewards 
       WHERE business_id = $1 AND reward_type = 'FREE_MONTH'`,
      [businessId]
    );

    // 5. Fetch referral history (JOIN with referred business name)
    const historyResult = await pool.query(
      `SELECT 
         r.status, 
         r.created_at, 
         b.business_name 
       FROM referrals r
       JOIN businesses b ON r.referred_id = b.id
       WHERE r.referrer_id = $1
       ORDER BY r.created_at DESC`,
      [businessId]
    );

    const successful = parseInt(statsResult.rows[0]?.successful || 0);
    const pending = parseInt(statsResult.rows[0]?.pending || 0);
    const total = parseInt(statsResult.rows[0]?.total || 0);
    const rewardsUsed = parseInt(rewardResult.rows[0]?.referral_rewards_used || 0);
    const rewardsEarned = Math.floor(successful / 2);
    const availableRewards = rewardsEarned - rewardsUsed;

    // Check if cooldown has passed
    let cooldownEnds = null;
    let isCooldownActive = false;
    if (cooldownResult.rows[0]?.last_redeemed) {
      const lastRedeemed = new Date(cooldownResult.rows[0].last_redeemed);
      const cooldownEnd = new Date(lastRedeemed);
      cooldownEnd.setDate(cooldownEnd.getDate() + 30);
      cooldownEnds = cooldownEnd;
      isCooldownActive = new Date() < cooldownEnd;
    }

    // Return combined response
    res.json({
      referral_code: referralCode,
      stats: { total, successful, pending },
      rewards: {
        earned: rewardsEarned,
        used: rewardsUsed,
        available: availableRewards,
      },
      reward_available: availableRewards > 0 && !isCooldownActive,
      isCooldownActive,
      cooldownEnds,
      referrals_needed: Math.max(0, 2 - (successful % 2 === 0 ? 0 : 1)),
      history: historyResult.rows, // 👈 Added history array here
    });
  } catch (err) {
    console.error("Referral stats error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── REDEEM REFERRAL REWARD ──────────────────────────────────────────
router.post("/redeem", auth, async (req, res) => {
  try {
    const businessId = req.businessId;

    // ─── 1. CHECK AVAILABLE REWARDS ──────────────────────────────────
    const countResult = await pool.query(
  `SELECT COUNT(*) as count FROM referrals 
   WHERE referrer_id = $1 AND status = 'SUCCESS'`,
  [businessId]
);
    const successful = parseInt(countResult.rows[0]?.count || 0);

    const rewardResult = await pool.query(
      `SELECT referral_rewards_used FROM businesses WHERE id = $1`,
      [businessId]
    );
    const used = parseInt(rewardResult.rows[0]?.referral_rewards_used || 0);

    const available = Math.floor(successful / 2) - used;
    if (available <= 0) {
      return res.status(400).json({
        error: "No rewards available. You need 2 successful referrals for 1 free month.",
      });
    }

    // ─── 2. CHECK 30‑DAY COOLDOWN ─────────────────────────────────────
    const cooldownResult = await pool.query(
      `SELECT MAX(created_at) as last_redeemed 
       FROM referral_rewards 
       WHERE business_id = $1 AND reward_type = 'FREE_MONTH'`,
      [businessId]
    );

    if (cooldownResult.rows[0]?.last_redeemed) {
      const lastRedeemed = new Date(cooldownResult.rows[0].last_redeemed);
      const cooldownEnd = new Date(lastRedeemed);
      cooldownEnd.setDate(cooldownEnd.getDate() + 30);

      if (new Date() < cooldownEnd) {
        const daysLeft = Math.ceil((cooldownEnd - new Date()) / (1000 * 60 * 60 * 24));
        return res.status(400).json({
          error: `You can only redeem once every 30 days. Please wait ${daysLeft} more day${daysLeft > 1 ? 's' : ''}.`,
          cooldownEnds: cooldownEnd,
        });
      }
    }

    // ─── 3. APPLY 1 MONTH FREE ────────────────────────────────────────
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);

    const bizResult = await pool.query(
      "SELECT subscription_status, subscription_end_date FROM businesses WHERE id = $1",
      [businessId]
    );

    let finalEndDate = endDate;
    if (
      bizResult.rows[0]?.subscription_status === "ACTIVE" &&
      bizResult.rows[0]?.subscription_end_date
    ) {
      const existingEnd = new Date(bizResult.rows[0].subscription_end_date);
      if (existingEnd > now) {
        finalEndDate = new Date(existingEnd);
        finalEndDate.setMonth(finalEndDate.getMonth() + 1);
      }
    }

    await pool.query(
      `UPDATE businesses 
       SET 
         subscription_status = 'ACTIVE',
         subscription_end_date = $1,
         subscription_start_date = COALESCE(subscription_start_date, NOW()),
         referral_rewards_used = referral_rewards_used + 1,
         updated_at = NOW()
       WHERE id = $2`,
      [finalEndDate, businessId]
    );

    // ─── 4. LOG REDEMPTION ─────────────────────────────────────────────
    await pool.query(
      `INSERT INTO referral_rewards (business_id, reward_type, description)
       VALUES ($1, 'FREE_MONTH', '1 month free from referrals')`,
      [businessId]
    );

    res.json({
      success: true,
      message: "🎉 1 month free subscription applied!",
      new_end_date: finalEndDate,
    });
  } catch (err) {
    console.error("Redeem error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;