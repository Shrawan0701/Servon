const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");
const subscription = require("../middleware/subscription");
const sendPush = require('../utils/pushNotify');
const { getIO } = require("../socket");

// Customer: Place Order (Handles both NEW orders and EDITS)
router.post("/place", async (req, res) => {
  const { businessId, tableId, items, totalAmount, specialInstructions, orderId } = req.body;

  if (!businessId || !tableId || !items || !totalAmount) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Check business subscription
    const biz = await pool.query(
      "SELECT subscription_status, subscription_end_date, push_token FROM businesses WHERE id = $1",
      [businessId]
    );

    if (
      biz.rows.length === 0 ||
      biz.rows[0].subscription_status !== "ACTIVE" ||
      new Date(biz.rows[0].subscription_end_date) < new Date()
    ) {
      return res
        .status(403)
        .json({ error: "Restaurant is currently not accepting orders" });
    }

    const pushToken = biz.rows[0].push_token;

    // Get the table number
    const tableInfo = await pool.query(
      "SELECT table_number FROM tables WHERE id = $1",
      [tableId]
    );
    const tableNum = tableInfo.rows[0]?.table_number || "Unknown";

    // --- NEW SMART TIMER FUNCTION ---
    const triggerAutoConfirm = (targetOrderId) => {
      setTimeout(async () => {
        try {
          const checkStatus = await pool.query("SELECT status, updated_at FROM orders WHERE id = $1", [targetOrderId]);
          
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
      }, 60 * 1000); // 60 seconds
    };

    // EDIT FLOW: If the frontend sent an orderId, update it!
    if (orderId) {
      const checkOrder = await pool.query("SELECT status FROM orders WHERE id = $1", [orderId]);
      
      if (checkOrder.rows.length > 0 && checkOrder.rows[0].status === "EDITABLE") {
        const updatedOrder = await pool.query(
          `UPDATE orders 
           SET items = $1, total_amount = $2, special_instructions = $3, updated_at = NOW() 
           WHERE id = $4 RETURNING *`,
          [JSON.stringify(items), totalAmount, specialInstructions || null, orderId]
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

    // NEW ORDER FLOW: If no orderId
    const result = await pool.query(
      `INSERT INTO orders 
       (business_id, table_id, items, total_amount, special_instructions, status, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'EDITABLE', NOW())
       RETURNING *`,
      [
        businessId,
        tableId,
        JSON.stringify(items),
        totalAmount,
        specialInstructions || null,
      ]
    );

    const order = result.rows[0];

    // SEND PUSH NOTIFICATION FOR NEW ORDER
    if (pushToken) {
      sendPush(
        pushToken,
        "New Order! 🍕",
        `Table ${tableNum} just placed an order for ₹${totalAmount}`
      );
    }

    // Create notification
    const notifMessage = `New order from Table ${tableNum} - ₹${totalAmount}`;
    const notifResult = await pool.query(
      "INSERT INTO notifications (business_id, order_id, message) VALUES ($1, $2, $3) RETURNING *",
      [businessId, order.id, notifMessage]
    );

    try {
      const io = getIO();
      io.to(`business_${businessId}`).emit("new_order", {
        order,
        notification: notifResult.rows[0],
        tableNumber: tableNum,
      });
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

// Customer: Edit order within 1 minute
router.put("/edit/:id", async (req, res) => {
  const { items, totalAmount, specialInstructions } = req.body;
  try {
    const result = await pool.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Order not found" });

    const order = result.rows[0];
    const elapsed = (Date.now() - new Date(order.created_at).getTime()) / 1000;

    if (elapsed > 60 || order.status !== "EDITABLE") {
      return res.status(400).json({ error: "Edit window closed" });
    }

    const updated = await pool.query(
      `UPDATE orders SET items = $1, total_amount = $2, special_instructions = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [JSON.stringify(items), totalAmount, specialInstructions, req.params.id]
    );
    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Business: Get all orders (today)
// Business: Get all orders (No date limit so frontend can filter Today vs Previous)
router.get("/", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, t.table_number
       FROM orders o
       LEFT JOIN tables t ON o.table_id = t.id
       WHERE o.business_id = $1
       ORDER BY o.created_at DESC`, // Removed the "AND o.created_at >= CURRENT_DATE"
      [req.businessId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Fetch orders error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Business: Update order status
router.patch("/:id/status", auth, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ["EDITABLE", "CONFIRMED", "PREPARING", "SERVED", "TABLE_ACTIVE", "PAID", "REJECTED"];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: "Invalid status" });

  try {
    const result = await pool.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 AND business_id = $3 RETURNING *`,
      [status, req.params.id, req.businessId]
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

// Business: Get notifications
router.get("/notifications", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications WHERE business_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Business: Mark notification read
router.patch("/notifications/:id/read", auth, async (req, res) => {
  try {
    await pool.query("UPDATE notifications SET is_read = true WHERE id = $1 AND business_id = $2", [req.params.id, req.businessId]);
    res.json({ message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Business: Mark all notifications read
router.patch("/notifications/read-all", auth, async (req, res) => {
  try {
    await pool.query("UPDATE notifications SET is_read = true WHERE business_id = $1", [req.businessId]);
    res.json({ message: "All marked as read" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;