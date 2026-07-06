const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");
const { instance, verifySignature } = require("../utils/razorpay");

// 1. Create Razorpay Order
router.post("/create-order", auth, async (req, res) => {
  try {
    const amount = parseInt(process.env.SUBSCRIPTION_AMOUNT) || 99900;
    const shortTime = Date.now().toString().slice(-8);

    const order = await instance.orders.create({
      amount,
      currency: "INR",
      receipt: `sub_${shortTime}`,
      notes: { businessId: req.businessId },
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Failed to create payment order" });
  }
});

// 2. Verify Payment & Update Database
router.post("/verify-payment", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const isValid = verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) return res.status(400).json({ error: "Invalid payment signature" });

    const order = await instance.orders.fetch(razorpay_order_id);
    const businessId = order.notes.businessId;

    await pool.query(
      `INSERT INTO subscription_payments (business_id, razorpay_payment_id, razorpay_order_id, amount, currency, status, paid_at)
       VALUES ($1, $2, $3, $4, $5, 'SUCCESS', NOW())`,
      [businessId, razorpay_payment_id, razorpay_order_id, order.amount, order.currency]
    );

    await pool.query(
      `UPDATE businesses 
       SET subscription_status = 'ACTIVE', 
           subscription_start_date = NOW(), 
           subscription_end_date = NOW() + INTERVAL '30 days',
           last_payment_id = $1
       WHERE id = $2`,
      [razorpay_payment_id, businessId]
    );

    // ─── REFERRAL HANDLING ────────────────────────────────────────────
    const refCheck = await pool.query(
      `SELECT * FROM referrals WHERE referred_id = $1 AND status = 'PENDING'`,
      [businessId]
    );
    if (refCheck.rows.length > 0) {
      const ref = refCheck.rows[0];
      const daysSinceSignup = (new Date() - new Date(ref.created_at)) / (1000 * 60 * 60 * 24);
      const newStatus = daysSinceSignup <= 3 ? "SUCCESS" : "EXPIRED";

      // Update referral status
      await pool.query(
        `UPDATE referrals SET status = $1, updated_at = NOW() WHERE id = $2`,
        [newStatus, ref.id]
      );

      // ─── ONLY IF SUCCESSFUL: increment referrer's reward count ────
      if (newStatus === "SUCCESS") {
        await pool.query(
          `UPDATE businesses 
           SET referral_rewards_earned = referral_rewards_earned + 1 
           WHERE id = $1`,
          [ref.referrer_id]
        );
      }
    }

    res.json({ success: true, message: "Account Activated!" });
  } catch (err) {
    console.error("Verify payment error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

// 3. Hosted Checkout Page
router.get("/checkout/:orderId", async (req, res) => {
  const { orderId } = req.params;
  const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://10.193.19.38:8081";

  res.send(`
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: transparent; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
      .loader { font-family: sans-serif; color: #555; font-size: 14px; }
    </style>
  </head>
  <body>
    <p class="loader">Opening payment...</p>
    <script>
      var options = {
        key: "${process.env.RAZORPAY_KEY_ID}",
        order_id: "${orderId}",
        name: "Servon",
        description: "Servon Monthly Subscription",
        theme: { color: "#1A1410" },
        modal: {
          ondismiss: function() {
            window.parent.postMessage({ type: "PAYMENT_DISMISSED" }, "${frontendOrigin}");
          }
        },
        handler: function(response) {
          fetch("${process.env.BASE_URL}/api/subscription/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          })
            .then(function(res) { return res.json(); })
            .then(function(data) {
              if (data.success) {
                window.parent.postMessage({ type: "PAYMENT_SUCCESS" }, "${frontendOrigin}");
              } else {
                window.parent.postMessage({ type: "PAYMENT_FAILED", error: data.error }, "${frontendOrigin}");
              }
            })
            .catch(function() {
              window.parent.postMessage({ type: "PAYMENT_FAILED", error: "Network error" }, "${frontendOrigin}");
            });
        },
      };
      var rzp = new Razorpay(options);
      rzp.open();
    </script>
  </body>
</html>
  `);
});

// 4. Get Subscription Details
router.get("/details", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT subscription_status, subscription_start_date, subscription_end_date, last_payment_id 
       FROM businesses WHERE id = $1`,
      [req.businessId]
    );
    const payments = await pool.query(
      `SELECT * FROM subscription_payments WHERE business_id = $1 ORDER BY paid_at DESC LIMIT 5`,
      [req.businessId]
    );
    res.json({ ...result.rows[0], paymentHistory: payments.rows });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;