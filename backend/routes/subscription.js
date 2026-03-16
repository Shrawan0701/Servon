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
      notes: { businessId: req.businessId } // We hide the businessId here securely
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

// 2. THE MISSING ROUTE: Verify Payment & Update Database
router.post("/verify-payment", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // A. Verify the signature is legit
    const isValid = verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) return res.status(400).json({ error: "Invalid payment signature" });

    // B. Fetch the order from Razorpay to retrieve the hidden businessId
    const order = await instance.orders.fetch(razorpay_order_id);
    const businessId = order.notes.businessId;

    // C. Record the payment in the database
    await pool.query(
      `INSERT INTO subscription_payments (business_id, razorpay_payment_id, razorpay_order_id, amount, currency, status, paid_at)
       VALUES ($1, $2, $3, $4, $5, 'SUCCESS', NOW())`,
      [businessId, razorpay_payment_id, razorpay_order_id, order.amount, order.currency]
    );

    // D. Upgrade the business account to ACTIVE for 30 days
    await pool.query(
      `UPDATE businesses 
       SET subscription_status = 'ACTIVE', 
           subscription_start_date = NOW(), 
           subscription_end_date = NOW() + INTERVAL '30 days',
           last_payment_id = $1
       WHERE id = $2`,
      [razorpay_payment_id, businessId]
    );

    // --- THE REFERRAL 3-DAY CHECK LOGIC ---
    // Check if this business was referred by someone and is still in PENDING status
    const refCheck = await pool.query(
      `SELECT * FROM referrals WHERE referred_id = $1 AND status = 'PENDING'`,
      [businessId]
    );

    if (refCheck.rows.length > 0) {
      const ref = refCheck.rows[0];
      const signupDate = new Date(ref.created_at);
      const today = new Date();
      // Calculate how many days have passed since they signed up
      const daysSinceSignup = (today - signupDate) / (1000 * 60 * 60 * 24);

      // Enforce the urgent 3-day conversion rule
      const newStatus = daysSinceSignup <= 3 ? 'SUCCESS' : 'EXPIRED';

      await pool.query(
        `UPDATE referrals SET status = $1, updated_at = NOW() WHERE id = $2`,
        [newStatus, ref.id]
      );
    }
    // ----------------------------------------

    res.json({ success: true, message: "Account Activated!" });

  } catch (err) {
    console.error("Verify payment error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

// 3. Hosted Checkout Page
router.get("/checkout/:orderId", async (req, res) => {
  const { orderId } = req.params;

  res.send(`
    <html>
      <head>
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      </head>
      <body>
        <script>
          var options = {
            "key": "${process.env.RAZORPAY_KEY_ID}",
            "order_id": "${orderId}",
            "name": "Servon",
            "description": "Servon Monthly Subscription",
            "theme": { "color": "#111" },
            handler: function (response){
              fetch("${process.env.BASE_URL}/api/subscription/verify-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature
                })
              })
              .then(res => res.json())
              .then(data => {
                alert("Payment Successful!");
                window.location.href = "${process.env.FRONTEND_URL}";
              })
              .catch(() => {
                alert("Verification failed");
              });
            }
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