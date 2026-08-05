const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");
const { instance, verifySignature } = require("../utils/razorpay");

// ─── PLAN CONFIGURATION ────────────────────────────────────────────────
const PLANS = {
    monthly: { amount: 99900, days: 30, label: 'Monthly' },
    quarterly: { amount: 250000, days: 90, label: 'Quarterly' },
    yearly: { amount: 600000, days: 365, label: 'Yearly' },
};

function getPlanDetails(planType) {
    return PLANS[planType] || PLANS.monthly;
}

function getSubscriptionEndDate(days) {
    const now = new Date();
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

// ─── 1. CREATE ORDER ──────────────────────────────────────────────────
router.post("/create-order", auth, async (req, res) => {
    try {
        const { planType = 'monthly' } = req.body;
        const plan = getPlanDetails(planType);

        if (!plan) {
            return res.status(400).json({ error: "Invalid plan type" });
        }

        const shortTime = Date.now().toString().slice(-8);
        const amount = plan.amount;

        const order = await instance.orders.create({
            amount,
            currency: "INR",
            receipt: `sub_${shortTime}`,
            notes: {
                businessId: req.businessId,
                planType: planType,
                planDays: plan.days,
                planLabel: plan.label,
            },
        });

        res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID,
            planType: planType,
        });
    } catch (err) {
        console.error("Create order error:", err);
        res.status(500).json({ error: "Failed to create payment order" });
    }
});

// ─── 2. VERIFY PAYMENT ─────────────────────────────────────────────────
router.post("/verify-payment", async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const isValid = verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
        if (!isValid) return res.status(400).json({ error: "Invalid payment signature" });

        const order = await instance.orders.fetch(razorpay_order_id);
        const businessId = order.notes.businessId;

        // Read plan details from order notes
        const planType = order.notes.planType || 'monthly';
        const planDays = parseInt(order.notes.planDays) || 30;
        const planLabel = order.notes.planLabel || 'Monthly';

        // Insert payment with plan_type
        await pool.query(
            `INSERT INTO subscription_payments (
                business_id,
                razorpay_payment_id,
                razorpay_order_id,
                amount,
                currency,
                status,
                plan_type,
                paid_at
            ) VALUES ($1, $2, $3, $4, $5, 'SUCCESS', $6, NOW())`,
            [businessId, razorpay_payment_id, razorpay_order_id, order.amount, order.currency, planType]
        );

        // Calculate end date based on plan
        const endDate = getSubscriptionEndDate(planDays);

        // Update business with plan info
        await pool.query(
            `UPDATE businesses 
             SET subscription_status = 'ACTIVE', 
                 subscription_start_date = NOW(), 
                 subscription_end_date = $1,
                 last_payment_id = $2,
                 plan_type = $3,
                 subscription_plan = $4
             WHERE id = $5`,
            [endDate, razorpay_payment_id, planType, planLabel, businessId]
        );

        // ─── REFERRAL HANDLING ────────────────────────────────────────────
        const refCheck = await pool.query(
            `SELECT * FROM referrals WHERE referred_id = $1 AND status = 'PENDING'`,
            [businessId]
        );
        
        if (refCheck.rows.length > 0) {
            const ref = refCheck.rows[0];
            
            // ✅ FIXED: No time limit - Always SUCCESSFUL when user pays
            // User can pay anytime, no 3-day expiry
            await pool.query(
                `UPDATE referrals SET status = 'SUCCESSFUL', updated_at = NOW() WHERE id = $1`,
                [ref.id]
            );

            // Increment referrer's reward count
            await pool.query(
                `UPDATE businesses 
                 SET referral_rewards_earned = referral_rewards_earned + 1 
                 WHERE id = $1`,
                [ref.referrer_id]
            );
        }

        res.json({ success: true, message: "Account Activated!" });
    } catch (err) {
        console.error("Verify payment error:", err);
        res.status(500).json({ error: "Verification failed" });
    }
});

// ─── 3. HOSTED CHECKOUT PAGE ───────────────────────────────────────────
router.get("/checkout/:orderId", async (req, res) => {
    const { orderId } = req.params;
    const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://10.193.19.38:8081";

    let planLabel = "Monthly";
    try {
        const order = await instance.orders.fetch(orderId);
        if (order.notes && order.notes.planLabel) {
            planLabel = order.notes.planLabel;
        }
    } catch (err) {
        console.error("Error fetching order for checkout:", err);
    }

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
        description: "Servon ${planLabel} Subscription",
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

// ─── 4. GET SUBSCRIPTION DETAILS ──────────────────────────────────────
router.get("/details", auth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT subscription_status,
                    subscription_start_date,
                    subscription_end_date,
                    last_payment_id,
                    plan_type,
                    subscription_plan
             FROM businesses
             WHERE id = $1`,
            [req.businessId]
        );

        const payments = await pool.query(
            `SELECT * FROM subscription_payments
             WHERE business_id = $1
             ORDER BY paid_at DESC
             LIMIT 5`,
            [req.businessId]
        );

        const business = result.rows[0] || {};
        const planType = business.plan_type || 'monthly';
        const planLabel = business.subscription_plan || 'Monthly';

        res.json({
            ...business,
            planType: planType,
            planLabel: planLabel,
            paymentHistory: payments.rows,
        });
    } catch (err) {
        console.error("Details error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// ─── 5. GET AVAILABLE PLANS ──────────────────────────────────────────
router.get("/plans", auth, async (req, res) => {
    try {
        const plans = Object.entries(PLANS).map(([key, plan]) => ({
            id: key,
            label: plan.label,
            amount: plan.amount / 100,
            days: plan.days,
            amountInPaise: plan.amount,
        }));

        res.json({
            success: true,
            data: plans,
        });
    } catch (err) {
        console.error("Plans error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;