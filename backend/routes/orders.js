const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");
const sendPush = require('../utils/pushNotify');
const { getIO } = require("../socket");

// ─── DISCOUNT CALCULATION ─────────────────────────────────────────────
function calculateDiscount(subtotal, discountType = 'none', discountValue = 0) {
  let discountAmount = 0;
  if (discountType === 'percentage') {
    discountAmount = (subtotal * discountValue) / 100;
  } else if (discountType === 'flat') {
    discountAmount = Math.min(discountValue, subtotal);
  }
  return {
    discountAmount,
    amountAfterDiscount: subtotal - discountAmount,
    subtotal,
  };
}

// ─── CUSTOMER: PLACE ORDER (New or Edit) ─────────────────────────────
router.post("/place", async (req, res) => {
  const {
    businessId,
    tableId,
    branchId,               // ✅ Accept branchId from customer
    items,
    specialInstructions,
    orderId,
    discount_type = 'none',
    discount_value = 0
  } = req.body;

  // ✅ Debug logs
  console.log('🔍 Place order received:');
  console.log('   businessId:', businessId);
  console.log('   branchId:', branchId);
  console.log('   tableId:', tableId);
  console.log('   items count:', items?.length);

  if (!businessId || !tableId || !items) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // ─── Check business subscription ──────────────────────────────────
    const biz = await pool.query(
      "SELECT subscription_status, subscription_end_date, push_token FROM businesses WHERE id = $1",
      [businessId]
    );
    if (
      biz.rows.length === 0 ||
      biz.rows[0].subscription_status !== "ACTIVE" ||
      new Date(biz.rows[0].subscription_end_date) < new Date()
    ) {
      return res.status(403).json({ error: "Restaurant is currently not accepting orders" });
    }
    const pushToken = biz.rows[0].push_token;

    // ─── Get table number ──────────────────────────────────────────────
    const tableInfo = await pool.query(
      "SELECT table_number, branch_id FROM tables WHERE id = $1",
      [tableId]
    );
    const tableNum = tableInfo.rows[0]?.table_number || "Unknown";

    // ✅ Determine final branch ID (priority: frontend > table > business)
    const finalBranchId = branchId || tableInfo.rows[0]?.branch_id || businessId;

    console.log('🔍 Final branch ID:', finalBranchId);

    // ─── Calculate subtotal ────────────────────────────────────────────
    let subtotal = 0;
    if (Array.isArray(items)) {
      subtotal = items.reduce((sum, item) => {
        const price = parseFloat(item.price) || 0;
        const qty = parseInt(item.quantity) || 0;
        return sum + price * qty;
      }, 0);
    } else {
      try {
        const parsed = JSON.parse(items);
        if (Array.isArray(parsed)) {
          subtotal = parsed.reduce((sum, item) => {
            const price = parseFloat(item.price) || 0;
            const qty = parseInt(item.quantity) || 0;
            return sum + price * qty;
          }, 0);
        }
      } catch (e) {}
    }

    // ─── Fetch business GST rates ──────────────────────────────────────
    const gstResult = await pool.query(
      "SELECT cgst_percentage, sgst_percentage FROM businesses WHERE id = $1",
      [businessId]
    );
    const cgstPercent = parseFloat(gstResult.rows[0]?.cgst_percentage || 0);
    const sgstPercent = parseFloat(gstResult.rows[0]?.sgst_percentage || 0);

    // ─── Apply discount and compute GST ────────────────────────────────
    const { discountAmount, amountAfterDiscount } = calculateDiscount(subtotal, discount_type, discount_value);
    const cgst = (amountAfterDiscount * cgstPercent) / 100;
    const sgst = (amountAfterDiscount * sgstPercent) / 100;
    const gstTotal = cgst + sgst;
    const finalTotal = amountAfterDiscount + gstTotal;

    const discountType = discount_type;
    const discountValue = parseFloat(discount_value) || 0;
    const subtotalBeforeDiscount = subtotal;

    // ─── Smart timer (auto-confirm after 60s) ──────────────────────────
    const triggerAutoConfirm = (targetOrderId) => {
      setTimeout(async () => {
        try {
          const checkStatus = await pool.query(
            "SELECT status, updated_at FROM orders WHERE id = $1", 
            [targetOrderId]
          );
          if (checkStatus.rows.length > 0 && checkStatus.rows[0].status === 'EDITABLE') {
            const elapsed = Date.now() - new Date(checkStatus.rows[0].updated_at).getTime();
            if (elapsed >= 58000) {
              const updated = await pool.query(
                `UPDATE orders SET status = 'CONFIRMED', updated_at = NOW() WHERE id = $1 RETURNING *`,
                [targetOrderId]
              );
              const io = getIO();
              io.to(`business_${businessId}`).emit("order_updated", updated.rows[0]);
            }
          }
        } catch (e) {
          console.error("Auto-confirm error:", e);
        }
      }, 60 * 1000);
    };

    // ─── EDIT FLOW ──────────────────────────────────────────────────────
    if (orderId) {
      const checkOrder = await pool.query(
        "SELECT status FROM orders WHERE id = $1", 
        [orderId]
      );
      
      if (checkOrder.rows.length > 0 && checkOrder.rows[0].status === "EDITABLE") {
        // ✅ Include branch_id in UPDATE
        const updatedOrder = await pool.query(
          `UPDATE orders 
           SET 
             items = $1,
             total_amount = $2,
             special_instructions = $3,
             discount_type = $4,
             discount_value = $5,
             discount_amount = $6,
             subtotal_before_discount = $7,
             gst_amount = $8,
             branch_id = $9,
             updated_at = NOW()
           WHERE id = $10
           RETURNING *`,
          [
            JSON.stringify(items),
            finalTotal,
            specialInstructions || null,
            discountType,
            discountValue,
            discountAmount,
            subtotalBeforeDiscount,
            gstTotal,
            finalBranchId,   // ✅ Set branch on edit
            orderId
          ]
        );
        
        try {
          const io = getIO();
          io.to(`business_${businessId}`).emit("order_updated", updatedOrder.rows[0]);
        } catch (e) {
          console.warn("Socket emit failed:", e.message);
        }
        
        triggerAutoConfirm(orderId);
        return res.status(200).json(updatedOrder.rows[0]);
      }
    }

    // ─── NEW ORDER FLOW ──────────────────────────────────────────────
    // ✅ Include branch_id in INSERT
    const result = await pool.query(
      `INSERT INTO orders 
       (
         business_id, 
         branch_id,
         table_id, 
         items, 
         total_amount, 
         special_instructions, 
         status, 
         updated_at,
         discount_type, 
         discount_value, 
         discount_amount, 
         subtotal_before_discount, 
         gst_amount
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, 'EDITABLE', NOW(),
         $7, $8, $9, $10, $11
       )
       RETURNING *`,
      [
        businessId,
        finalBranchId,   // ✅ Branch ID saved here
        tableId,
        JSON.stringify(items),
        finalTotal,
        specialInstructions || null,
        discountType,
        discountValue,
        discountAmount,
        subtotalBeforeDiscount,
        gstTotal
      ]
    );

    const order = result.rows[0];
    console.log('✅ Order created:');
    console.log('   order.id:', order.id);
    console.log('   order.business_id:', order.business_id);
    console.log('   order.branch_id:', order.branch_id);

    // ─── Push notification ─────────────────────────────────────────────
    if (pushToken) {
      sendPush(
        pushToken,
        "New Order! 🍕",
        `Table ${tableNum} just placed an order for ₹${finalTotal}`
      );
    }

    // ─── Save notification with branch_id ──────────────────────────────
    const notifMessage = `New order from Table ${tableNum} - ₹${finalTotal}`;
    const notifResult = await pool.query(
      `INSERT INTO notifications (
        business_id, 
        branch_id,
        order_id, 
        type, 
        title, 
        message, 
        is_read, 
        scheduled_for, 
        status, 
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        businessId, 
        finalBranchId,          // ✅ Branch ID
        order.id, 
        'order_update', 
        'New Order', 
        notifMessage, 
        false, 
        new Date(), 
        'pending', 
        new Date()
      ]
    );

    // ─── Socket emit ───────────────────────────────────────────────────
    try {
      const io = getIO();
      
      // ✅ Emit to business room (for main branch dashboard)
      io.to(`business_${businessId}`).emit("new_order", {
        order,
        notification: notifResult.rows[0],
        tableNumber: tableNum,
      });

      // ✅ Also emit to branch room (for branch dashboard)
      if (finalBranchId !== businessId) {
        io.to(`branch_${finalBranchId}`).emit("new_order", {
          order,
          notification: notifResult.rows[0],
          tableNumber: tableNum,
        });
      }
    } catch (e) {
      console.warn("Socket emit failed:", e.message);
    }

    triggerAutoConfirm(order.id);
    res.status(201).json(order);

  } catch (err) {
    console.error("Place order error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── CUSTOMER: EDIT ORDER (within 1 minute) ──────────────────────────
router.put("/edit/:id", async (req, res) => {
  const { items, specialInstructions, discount_type, discount_value } = req.body;

  if (!items) {
    return res.status(400).json({ error: "Items required" });
  }

  try {
    const result = await pool.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Order not found" });

    const order = result.rows[0];
    const elapsed = (Date.now() - new Date(order.created_at).getTime()) / 1000;

    if (elapsed > 60 || order.status !== "EDITABLE") {
      return res.status(400).json({ error: "Edit window closed" });
    }

    let subtotal = 0;
    if (Array.isArray(items)) {
      subtotal = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
    }

    const discType = discount_type || order.discount_type || 'none';
    const discValue = parseFloat(discount_value) || parseFloat(order.discount_value) || 0;

    // ─── Fetch business GST rates ──────────────────────────────────────
    const businessId = order.business_id;
    const gstResult = await pool.query(
      "SELECT cgst_percentage, sgst_percentage FROM businesses WHERE id = $1",
      [businessId]
    );
    const cgstPercent = parseFloat(gstResult.rows[0]?.cgst_percentage || 0);
    const sgstPercent = parseFloat(gstResult.rows[0]?.sgst_percentage || 0);

    const { discountAmount, amountAfterDiscount } = calculateDiscount(subtotal, discType, discValue);
    const cgst = (amountAfterDiscount * cgstPercent) / 100;
    const sgst = (amountAfterDiscount * sgstPercent) / 100;
    const gstTotal = cgst + sgst;
    const finalTotal = amountAfterDiscount + gstTotal;

    // ✅ Preserve branch_id on edit
    const updated = await pool.query(
      `UPDATE orders 
       SET 
         items = $1,
         total_amount = $2,
         special_instructions = $3,
         discount_type = $4,
         discount_value = $5,
         discount_amount = $6,
         subtotal_before_discount = $7,
         gst_amount = $8,
         updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        JSON.stringify(items),
        finalTotal,
        specialInstructions || null,
        discType,
        discValue,
        discountAmount,
        subtotal,
        gstTotal,
        req.params.id
      ]
    );
    res.json(updated.rows[0]);
  } catch (err) {
    console.error("Edit order error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── BUSINESS: GET ALL ORDERS (Branch-aware) ─────────────────────────
// ─── BUSINESS: GET ALL ORDERS (Strict Branch Isolation) ─────────────
router.get("/", auth, async (req, res) => {
  try {
    // ✅ Use branchId if available, fall back to businessId
    const filterId = req.branchId || req.businessId;

    const result = await pool.query(
      `SELECT 
         o.*, 
         t.table_number,
         b.branch_name
       FROM orders o
       LEFT JOIN tables t ON o.table_id = t.id
       LEFT JOIN businesses b ON o.branch_id = b.id
       WHERE o.branch_id = $1
       ORDER BY o.created_at DESC`,
      [filterId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch orders error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── BUSINESS: UPDATE ORDER STATUS ──────────────────────────────────
router.patch("/:id/status", auth, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ["EDITABLE", "CONFIRMED", "PREPARING", "SERVED", "TABLE_ACTIVE", "PAID", "REJECTED"];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: "Invalid status" });

  try {
    const filterId = req.branchId || req.businessId;
    
    const result = await pool.query(
      `UPDATE orders SET status = $1, updated_at = NOW() 
       WHERE id = $2 AND (branch_id = $3 OR business_id = $3) 
       RETURNING *`,
      [status, req.params.id, filterId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Order not found" });

    try {
      const io = getIO();
      io.to(`business_${req.businessId}`).emit("order_updated", result.rows[0]);
    } catch (e) {}
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── BUSINESS: GET NOTIFICATIONS (Branch-aware) ─────────────────────
router.get("/notifications", auth, async (req, res) => {
  try {
    const filterId = req.branchId || req.businessId;
    
    const result = await pool.query(
      `SELECT * FROM notifications 
       WHERE (branch_id = $1) 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [filterId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── BUSINESS: MARK NOTIFICATION READ ──────────────────────────────
router.patch("/notifications/:id/read", auth, async (req, res) => {
  try {
    const filterId = req.branchId || req.businessId;
    
    await pool.query(
      "UPDATE notifications SET is_read = true WHERE id = $1 AND (branch_id = $2 OR business_id = $2)", 
      [req.params.id, filterId]
    );
    res.json({ message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── BUSINESS: MARK ALL NOTIFICATIONS READ ──────────────────────────
router.patch("/notifications/read-all", auth, async (req, res) => {
  try {
    const filterId = req.branchId || req.businessId;
    
    await pool.query(
      "UPDATE notifications SET is_read = true WHERE (branch_id = $1)", 
      [filterId]
    );
    res.json({ message: "All marked as read" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;