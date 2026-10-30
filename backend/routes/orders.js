const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const orderTransaction = require("../middleware/orderTransaction");
const { transaction } = require("../services/inventoryTransaction");
const pool = require("../db");
const auth = require("../middleware/auth");
const sendPush = require('../utils/pushNotify');
const { getIO } = require("../socket");
const { deductInventoryForOrder, reverseDeductionsForOrder } = require("../utils/inventoryHelper");
const { generateCustomerOutstandingPDF } = require("../utils/pdf");

// ─── DISCOUNT CALCULATION (GST removed, handled separately) ──────────
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

function getOptionalBusinessId(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  try {
    const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
    return decoded.businessId || decoded.id || null;
  } catch (err) {
    return null;
  }
}

async function calculateOrderTotals(businessId, items, discountType = "none", discountValue = 0, db = pool) {
  const subtotal = (Array.isArray(items) ? items : []).reduce((sum, item) => {
    const price = parseFloat(item.price) || 0;
    const qty = parseInt(item.quantity) || 0;
    return sum + price * qty;
  }, 0);

  const gstResult = await db.query(
    "SELECT cgst_percentage, sgst_percentage FROM businesses WHERE id = $1",
    [businessId]
  );
  const cgstPercent = parseFloat(gstResult.rows[0]?.cgst_percentage || 0);
  const sgstPercent = parseFloat(gstResult.rows[0]?.sgst_percentage || 0);
  const { discountAmount, amountAfterDiscount } = calculateDiscount(subtotal, discountType, discountValue);
  const cgst = (amountAfterDiscount * cgstPercent) / 100;
  const sgst = (amountAfterDiscount * sgstPercent) / 100;
  const gstTotal = cgst + sgst;

  return {
    subtotal,
    discountAmount,
    gstTotal,
    finalTotal: Math.round((amountAfterDiscount + gstTotal + Number.EPSILON) * 100) / 100,
  };
}

function toCents(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  const [rupees, paise = ""] = normalized.split(".");
  return Number(rupees) * 100 + Number((paise + "00").slice(0, 2));
}

function centsToAmount(cents) {
  return (Number(cents) / 100).toFixed(2);
}

// Keep the legacy editable-order timer, using a new transaction after the
// request commits rather than retaining its released database client.
function scheduleConfirmation(businessId, orderId) {
  const timer = setTimeout(async () => {
    try {
      const updated = await transaction(businessId, async db => {
        const result = await db.query("SELECT * FROM orders WHERE id=$1 AND business_id=$2 FOR UPDATE", [orderId,businessId]);
        const order = result.rows[0];
        if (!order || order.status !== 'EDITABLE' || Date.now()-new Date(order.updated_at).getTime()<58000) return null;
        await deductInventoryForOrder(businessId,orderId,order.items,{client:db});
        return (await db.query("UPDATE orders SET status='CONFIRMED',updated_at=NOW() WHERE id=$1 AND business_id=$2 RETURNING *",[orderId,businessId])).rows[0];
      });
      if (updated) getIO().to(`business_${businessId}`).emit('order_updated',updated);
    } catch (error) { console.warn(JSON.stringify({event:'order_auto_confirm_failed',type:error.name})); }
  },60000);
  timer.unref?.();
}

// ─── CUSTOMER: PLACE ORDER (New or Edit) ─────────────────────────────
router.post("/place", orderTransaction(async (req, res, db) => {
  const {
    businessId,
    tableId,
    items,
    specialInstructions,
    orderId,
    orderSource,
    initialStatus,
    discount_type = 'none',
    discount_value = 0
  } = req.body;

  if (!businessId || !tableId || !items) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const biz = await db.query(
      "SELECT subscription_status, subscription_end_date, trial_end_date, push_token FROM businesses WHERE id = $1",
      [businessId]
    );

    if (biz.rows.length === 0) {
      return res.status(403).json({ error: "Restaurant is currently not accepting orders" });
    }

    const businessData = biz.rows[0];
    const now = new Date();

    const isSubscriptionActive =
      businessData.subscription_status === "ACTIVE" &&
      new Date(businessData.subscription_end_date) > now;

    const isTrialActive =
      businessData.subscription_status === "TRIAL" &&
      businessData.trial_end_date &&
      new Date(businessData.trial_end_date) > now;

    if (!isSubscriptionActive && !isTrialActive) {
      return res.status(403).json({ error: "Restaurant is currently not accepting orders" });
    }

    const pushToken = biz.rows[0].push_token;

    const tableInfo = await db.query(
      "SELECT table_number FROM tables WHERE id = $1 AND business_id = $2",
      [tableId, businessId]
    );
    if (!tableInfo.rowCount) return res.status(404).json({ error: "Table not found" });
    const tableNum = tableInfo.rows[0]?.table_number || "Unknown";

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

    const gstResult = await db.query(
      "SELECT cgst_percentage, sgst_percentage FROM businesses WHERE id = $1",
      [businessId]
    );
    const cgstPercent = parseFloat(gstResult.rows[0]?.cgst_percentage || 0);
    const sgstPercent = parseFloat(gstResult.rows[0]?.sgst_percentage || 0);

    const { discountAmount, amountAfterDiscount } = calculateDiscount(subtotal, discount_type, discount_value);
    const cgst = (amountAfterDiscount * cgstPercent) / 100;
    const sgst = (amountAfterDiscount * sgstPercent) / 100;
    const gstTotal = cgst + sgst;
    const finalTotal = amountAfterDiscount + gstTotal;

    const discountType = discount_type;
    const discountValue = parseFloat(discount_value) || 0;
    const subtotalBeforeDiscount = subtotal;
    const authenticatedBusinessId = getOptionalBusinessId(req);
    const isStaffOrder = orderSource === "staff" && authenticatedBusinessId === businessId;
    const newOrderStatus = "CONFIRMED";



    // ─── EDIT FLOW ──────────────────────────────────────────────────────
    if (orderId) {
      const checkOrder = await db.query("SELECT status FROM orders WHERE id = $1 AND business_id = $2 AND table_id = $3 FOR UPDATE", [orderId,businessId,tableId]);
      if (checkOrder.rows.length > 0 && checkOrder.rows[0].status === "EDITABLE") {
        const updatedOrder = await db.query(
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
            discountType,
            discountValue,
            discountAmount,
            subtotalBeforeDiscount,
            gstTotal,
            orderId
          ]
        );

        req.afterCommit.push(() => scheduleConfirmation(businessId, orderId));
        req.afterCommit.push(() => {
          const io = getIO();
          io.to(`business_${businessId}`).emit("order_updated", updatedOrder.rows[0]);
        });

        return res.status(200).json(updatedOrder.rows[0]);
      }
    }

    if (orderId) return res.status(409).json({ error: "Order cannot be edited" });

    // ─── NEW ORDER FLOW ──────────────────────────────────────────────
    let createdAt = new Date();
    if (isStaffOrder && req.body.clientCreatedAt) {
      const parsed = new Date(req.body.clientCreatedAt);
      if (!Number.isFinite(parsed.getTime()) || parsed.getTime() > Date.now() + 300000)
        return res.status(400).json({ error: "Invalid offline order time" });
      createdAt = parsed;
    }
    const result = await db.query(
      `INSERT INTO orders 
       (
         business_id, table_id, items, total_amount, 
         special_instructions, status, order_source, updated_at,
         discount_type, discount_value, discount_amount, subtotal_before_discount, gst_amount, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        businessId,
        tableId,
        JSON.stringify(items),
        finalTotal,
        specialInstructions || null,
        newOrderStatus,
        isStaffOrder ? "staff" : "customer",
        discountType,
        discountValue,
        discountAmount,
        subtotalBeforeDiscount,
        gstTotal,
        createdAt
      ]
    );

    const order = result.rows[0];
    let notificationRow = null;

    // Save the order and its ingredient deductions in the same transaction.
    if (newOrderStatus === "CONFIRMED") {
      try {
        await deductInventoryForOrder(businessId, order.id, items, { client: db });
      } catch (invErr) {

        return res.status(400).json({ error: invErr.message || "Insufficient stock" });
      }
    }

    await db.query('SAVEPOINT order_notification');
    try {
      if (pushToken) {
        req.afterCommit.push(() => sendPush(
          pushToken,
          "New Order! 🍕",
          `Table ${tableNum} just placed an order for ₹${finalTotal}`
        ));
      }

      const notifMessage = `New order from Table ${tableNum} - ₹${finalTotal}`;
      const notifResult = await db.query(
        "INSERT INTO notifications (business_id, order_id, message, type) VALUES ($1, $2, $3, $4) RETURNING *",
        [businessId, order.id, notifMessage, 'new_order']
      );
      notificationRow = notifResult.rows[0];
      await db.query('RELEASE SAVEPOINT order_notification');
    } catch (notifErr) {
      await db.query('ROLLBACK TO SAVEPOINT order_notification');
      console.error("Non-critical notification creation failed:", notifErr.message);
    }

    req.afterCommit.push(() => {
      const io = getIO();
      io.to(`business_${businessId}`).emit("new_order", {
        order,
        notification: notificationRow,
        tableNumber: tableNum,
      });
    });


    return res.status(201).json(order);

  } catch (err) {
    console.error("Place order error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}));

// ─── CUSTOMER: EDIT ORDER (within 1 minute) ──────────────────────────
router.put("/edit/:id", orderTransaction(async (req, res, db) => {
  const { items, specialInstructions, discount_type, discount_value } = req.body;

  if (!items) {
    return res.status(400).json({ error: "Items required" });
  }

  try {
    const result = await db.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Order not found" });

    const order = result.rows[0];
    // Customer edits are scoped to the QR table context supplied by the caller.
    const authenticatedBusinessId = getOptionalBusinessId(req);
    if (authenticatedBusinessId !== order.business_id && (req.body.businessId !== order.business_id || req.body.tableId !== order.table_id)) {
      return res.status(403).json({ error: "Restaurant and table context are required to edit this order" });
    }
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

    const businessId = order.business_id;
    const gstResult = await db.query(
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

    const updated = await db.query(
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
}));

// ─── BUSINESS: GET ALL ORDERS ────────────────────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, t.table_number
       FROM orders o
       LEFT JOIN tables t ON o.table_id = t.id
       WHERE o.business_id = $1
       ORDER BY o.created_at DESC`,
      [req.businessId]
    );

    const orders = result.rows;

    // Enrich each order item with the CURRENT localized menu names (name_mr /
    // name_hi) so the hotel can display item names in its currently selected
    // platform language, falling back to the stored snapshot name when a menu
    // item no longer exists. The item's own identity/id/price snapshot are kept
    // untouched (localization never changes ordering/business data).
    const menuRes = await pool.query(
      "SELECT id, name_mr, name_hi FROM menu_items WHERE business_id = $1",
      [req.businessId]
    );
    const menuMap = new Map(menuRes.rows.map((r) => [String(r.id), r]));
    orders.forEach((o) => {
      if (typeof o.items === "string") {
        try { o.items = JSON.parse(o.items); } catch { o.items = []; }
      }
      (Array.isArray(o.items) ? o.items : []).forEach((item) => {
        if (item && item.id && menuMap.has(String(item.id))) {
          const m = menuMap.get(String(item.id));
          if (!("name_mr" in item)) item.name_mr = m.name_mr ?? null;
          if (!("name_hi" in item)) item.name_hi = m.name_hi ?? null;
        }
      });
    });

    res.json(orders);
  } catch (err) {
    console.error("Fetch orders error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/:id/items", auth, orderTransaction(async (req, res, db) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Items required" });
  }

  try {
    const orderResult = await db.query(
      `SELECT * FROM orders
       WHERE id = $1
         AND business_id = $2
         AND status IN ('EDITABLE', 'CONFIRMED', 'PREPARING', 'SERVED', 'TABLE_ACTIVE')`,
      [req.params.id, req.businessId]
    );
    if (orderResult.rows.length === 0) return res.status(404).json({ error: "Order not found" });

    const order = orderResult.rows[0];
    const existingItems = Array.isArray(order.items) ? order.items : JSON.parse(order.items || "[]");
    const merged = [...existingItems];

    items.forEach((item) => {
      const qty = parseInt(item.quantity || 1, 10);
      const price = parseFloat(item.price || 0);
      if (!item.id || qty <= 0 || price < 0) return;

      const key = String(item.id);
      const found = merged.find((existing) => String(existing.id) === key);
      if (found) {
        found.quantity = (parseInt(found.quantity || 0, 10) || 0) + qty;
      } else {
        merged.push({ ...item, quantity: qty });
      }
    });

    const totals = await calculateOrderTotals(
      req.businessId,
      merged,
      order.discount_type || "none",
      parseFloat(order.discount_value || 0) || 0,
      db
    );

    try {
      await deductInventoryForOrder(req.businessId, req.params.id, merged, { client: db });
    } catch (invErr) {
      return res.status(400).json({ error: invErr.message || "Insufficient stock" });
    }

    const updated = await db.query(
      `UPDATE orders
       SET items = $1,
           total_amount = $2,
           discount_amount = $3,
           subtotal_before_discount = $4,
           gst_amount = $5,
           updated_at = NOW()
       WHERE id = $6 AND business_id = $7
       RETURNING *`,
      [
        JSON.stringify(merged),
        totals.finalTotal,
        totals.discountAmount,
        totals.subtotal,
        totals.gstTotal,
        req.params.id,
        req.businessId,
      ]
    );

    req.afterCommit.push(() => {
      const io = getIO();
      io.to(`business_${req.businessId}`).emit("order_updated", updated.rows[0]);
    });

    res.json(updated.rows[0]);
  } catch (err) {
    console.error("Append order items error:", err);
    res.status(500).json({ error: "Server error" });
  }
}));

router.delete("/:id/items/:itemId", auth, orderTransaction(async (req, res, db) => {
  try {
    const orderResult = await db.query(
      `SELECT * FROM orders
       WHERE id = $1
         AND business_id = $2
         AND status IN ('EDITABLE', 'CONFIRMED', 'PREPARING', 'SERVED', 'TABLE_ACTIVE')`,
      [req.params.id, req.businessId]
    );
    if (orderResult.rows.length === 0) return res.status(404).json({ error: "Order not found" });

    const order = orderResult.rows[0];
    const existingItems = Array.isArray(order.items) ? order.items : JSON.parse(order.items || "[]");
    const removeId = String(req.params.itemId);
    const remainingItems = existingItems.filter((item) => String(item.id || item.menu_item_id || item.menuItemId) !== removeId);

    if (remainingItems.length === existingItems.length) {
      return res.status(404).json({ error: "Item not found in this order" });
    }

    const totals = await calculateOrderTotals(
      req.businessId,
      remainingItems,
      order.discount_type || "none",
      parseFloat(order.discount_value || 0) || 0,
      db
    );

    await deductInventoryForOrder(req.businessId, req.params.id, remainingItems, { client: db });

    const updated = await db.query(
      `UPDATE orders
       SET items = $1,
           total_amount = $2,
           discount_amount = $3,
           subtotal_before_discount = $4,
           gst_amount = $5,
           updated_at = NOW()
           ${remainingItems.length === 0 ? ", status = 'REJECTED'" : ""}
       WHERE id = $6 AND business_id = $7
       RETURNING *`,
      [
        JSON.stringify(remainingItems),
        totals.finalTotal,
        totals.discountAmount,
        totals.subtotal,
        totals.gstTotal,
        req.params.id,
        req.businessId,
      ]
    );

    req.afterCommit.push(() => {
      const io = getIO();
      io.to(`business_${req.businessId}`).emit("order_updated", updated.rows[0]);
    });

    res.json(updated.rows[0]);
  } catch (err) {
    console.error("Remove order item error:", err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Server error" });
  }
}));

router.post("/checkout", auth, orderTransaction(async (req, res, db) => {
  const entries = req.body.orders;
  if (!Array.isArray(entries) || !entries.length || entries.length > 100 || entries.some((e) => !e || typeof e.id !== "string" || (e.expected_items !== undefined && !Array.isArray(e.expected_items)) || (e.expected_total !== undefined && !Number.isFinite(Number(e.expected_total)))) || new Set(entries.map((e) => e.id)).size !== entries.length)
    return res.status(400).json({ error: "Choose unique orders for this bill" });
  const result = [];
  for (const entry of entries) {
    const type = entry.discount_type || "none", value = Number(entry.discount_value || 0);
    if (!["none", "percentage", "flat"].includes(type) || !Number.isFinite(value) || value < 0 || (type === "percentage" && value > 100))
      return res.status(400).json({ error: "Invalid bill discount" });
    const found = await db.query("SELECT * FROM orders WHERE id=$1 AND business_id=$2 FOR UPDATE", [entry.id, req.businessId]);
    const order = found.rows[0];
    if (!order) return res.status(404).json({ error: "An order on this bill was not found" });
    if (["PAID", "REJECTED"].includes(order.status)) return res.status(409).json({ error: "An order on this bill has already been closed on another device" });
    const items = typeof order.items === "string" ? JSON.parse(order.items) : order.items;
    if (entry.expected_items) {
      const signature = (list) => JSON.stringify(list.map((i) => ({ id: String(i.id || i.menu_item_id || i.menuItemId), price: Number(i.price), quantity: Number(i.quantity) })).sort((a, b) => a.id.localeCompare(b.id)));
      if (signature(entry.expected_items) !== signature(items))
        return res.status(409).json({ error: "Items on this bill changed on another device. Review the saved bill before syncing." });
    }
    await deductInventoryForOrder(req.businessId, order.id, items, { client: db });
    const totals = await calculateOrderTotals(req.businessId, items, type, value, db);
    if (entry.expected_total !== undefined && Math.abs(Number(entry.expected_total) - totals.finalTotal) > 0.005)
      return res.status(409).json({ error: "Bill tax or totals changed. Review the saved bill before syncing." });
    const updated = await db.query(
      `UPDATE orders SET status='PAID',discount_type=$1,discount_value=$2,discount_amount=$3,subtotal_before_discount=$4,gst_amount=$5,total_amount=$6,updated_at=NOW() WHERE id=$7 AND business_id=$8 RETURNING *`,
      [type,value,totals.discountAmount,totals.subtotal,totals.gstTotal,totals.finalTotal,order.id,req.businessId],
    );
    result.push(updated.rows[0]);
  }
  req.afterCommit.push(() => { const io = getIO(); for (const order of result) io.to(`business_${req.businessId}`).emit("order_updated", order); });
  return res.json({ orders: result });
}));

router.post("/outstanding", auth, orderTransaction(async (req, res, db = pool) => {
  const {
    orderId,
    customerName,
    phoneNumber,
    totalAmount,
    paidAmount,
    remainingAmount,
  } = req.body;

  const cleanName = String(customerName || "").trim();
  const cleanPhone = String(phoneNumber || "").trim();
  const cleanOrderId = orderId ? String(orderId).trim() : null;
  if (!cleanName || (cleanPhone && !/^\d{10}$/.test(cleanPhone))) {
    return res.status(400).json({ error: "Customer name is required; phone number must be 10 digits if provided" });
  }

  const totalCents = toCents(totalAmount);
  let paidCents = toCents(paidAmount);
  let remainingCents = toCents(remainingAmount);
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    return res.status(400).json({ error: "Invalid total amount" });
  }
  if (Number.isNaN(paidCents) || Number.isNaN(remainingCents)) {
    return res.status(400).json({ error: "Invalid payment amounts" });
  }
  if (paidCents === null && remainingCents === null) {
    paidCents = 0;
    remainingCents = totalCents;
  } else if (paidCents !== null && remainingCents === null) {
    remainingCents = totalCents - paidCents;
  } else if (paidCents === null && remainingCents !== null) {
    paidCents = totalCents - remainingCents;
  }

  if (paidCents < 0 || remainingCents < 0 || remainingCents > totalCents || paidCents + remainingCents !== totalCents) {
    return res.status(400).json({ error: "Paid and remaining amounts must add up to the total" });
  }

  try {
    if (cleanOrderId) {
      const orderResult = await db.query(
        "SELECT id FROM orders WHERE id = $1 AND business_id = $2",
        [cleanOrderId, req.businessId]
      );
      if (orderResult.rows.length === 0) return res.status(404).json({ error: "Order not found" });
    }

    const result = await db.query(
      `INSERT INTO customer_outstandings
       (business_id, order_id, customer_name, phone_number, original_total_amount, final_total_amount, total_amount, paid_amount, remaining_amount, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5, $5, $6, $7, NOW())
       ON CONFLICT (order_id) DO UPDATE SET
         customer_name = EXCLUDED.customer_name,
         phone_number = EXCLUDED.phone_number,
         original_total_amount = EXCLUDED.original_total_amount,
         final_total_amount = EXCLUDED.final_total_amount,
         total_amount = EXCLUDED.total_amount,
         paid_amount = EXCLUDED.paid_amount,
         remaining_amount = EXCLUDED.remaining_amount,
         updated_at = NOW()
       WHERE customer_outstandings.business_id = EXCLUDED.business_id
       RETURNING *`,
      [
        req.businessId,
        cleanOrderId,
        cleanName,
        cleanPhone || null,
        centsToAmount(totalCents),
        centsToAmount(paidCents),
        centsToAmount(remainingCents),
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Save outstanding error:", err);
    res.status(500).json({ error: "Server error" });
  }
}));

router.get("/outstanding", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, order_id, customer_name, phone_number, total_amount, remaining_amount, created_at
       FROM customer_outstandings
       WHERE business_id = $1 AND remaining_amount > 0
       ORDER BY created_at DESC`,
      [req.businessId]
    );
    const totalRemaining = result.rows.reduce((sum, row) => sum + Number(row.remaining_amount || 0), 0);
    res.json({ records: result.rows, totalRemaining: totalRemaining.toFixed(2) });
  } catch (err) {
    console.error("Fetch outstanding error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/outstanding/:id", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE customer_outstandings
       SET paid_amount = total_amount,
           remaining_amount = 0,
           updated_at = NOW()
       WHERE id = $1 AND business_id = $2
       RETURNING id`,
      [req.params.id, req.businessId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Outstanding not found" });
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error("Clear outstanding error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/outstanding/pdf", auth, async (req, res) => {
  try {
    const [business, outstanding] = await Promise.all([
      pool.query("SELECT business_name FROM businesses WHERE id = $1", [req.businessId]),
      pool.query(
        `SELECT customer_name, phone_number, total_amount, remaining_amount, created_at
         FROM customer_outstandings
         WHERE business_id = $1 AND remaining_amount > 0
         ORDER BY created_at DESC`,
        [req.businessId]
      ),
    ]);
    const pdfBuffer = await generateCustomerOutstandingPDF({
      business_name: business.rows[0]?.business_name || "Restaurant",
      records: outstanding.rows,
    });
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="customer-outstanding-report.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error("Outstanding PDF error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── BUSINESS: UPDATE ORDER STATUS ──────────────────────────────────
router.patch("/:id/status", auth, orderTransaction(async (req, res, db) => {
  const { status } = req.body;
  const validStatuses = ["EDITABLE", "CONFIRMED", "PREPARING", "SERVED", "TABLE_ACTIVE", "PAID", "REJECTED"];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: "Invalid status" });

  try {
    const targetOrder = await db.query(
      "SELECT table_id, status FROM orders WHERE id = $1 AND business_id = $2 FOR UPDATE",
      [req.params.id, req.businessId]
    );

    if (targetOrder.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (targetOrder.rows[0].status === "REJECTED" && status !== "REJECTED") return res.status(409).json({ error: "Rejected orders cannot be reopened" });
    const tableId = targetOrder.rows[0].table_id;
    const previousStatus = targetOrder.rows[0].status;

    if (["CONFIRMED", "PREPARING", "SERVED", "TABLE_ACTIVE", "PAID"].includes(status)) {
      try {
        const orderForDeduction = await db.query(
          "SELECT items FROM orders WHERE id = $1 AND business_id = $2",
          [req.params.id, req.businessId]
        );
        await deductInventoryForOrder(
          req.businessId,
          req.params.id,
          orderForDeduction.rows[0]?.items || [], { client: db }
        );
      } catch (invErr) {
        return res.status(400).json({ error: invErr.message || "Insufficient stock" });
      }
    }

    if (status === "PAID" && tableId) {
      const activeOrders = await db.query("SELECT id,items FROM orders WHERE table_id=$1 AND business_id=$2 AND status IN ('EDITABLE','CONFIRMED','PREPARING','SERVED','TABLE_ACTIVE') ORDER BY id FOR UPDATE", [tableId,req.businessId]);
      for (const activeOrder of activeOrders.rows) await deductInventoryForOrder(req.businessId,activeOrder.id,activeOrder.items,{client:db});
      await db.query(
        `UPDATE orders 
         SET status = 'PAID', updated_at = NOW() 
         WHERE table_id = $1 
           AND business_id = $2 
           AND status IN ('EDITABLE', 'CONFIRMED', 'PREPARING', 'SERVED', 'TABLE_ACTIVE')`,
        [tableId, req.businessId]
      );
    }

    const result = await db.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 AND business_id = $3 RETURNING *`,
      [status, req.params.id, req.businessId]
    );

    // Rejected orders never get made — refund the stock that was deducted
    // when they were placed. Guarded so re-saving REJECTED doesn't double-refund.
    if (status === "REJECTED" && previousStatus !== "REJECTED") {
      try {
        await reverseDeductionsForOrder(req.businessId, req.params.id, "order_reject_refund", { client: db });
      } catch (invErr) {
        return res.status(409).json({ error: invErr.message || "Inventory reversal failed" });
      }
    }

    req.afterCommit.push(() => {
      const io = getIO();
      io.to(`business_${req.businessId}`).emit("order_updated", result.rows[0]);
    });

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("Update status error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}));

// ─── BUSINESS: GET NOTIFICATIONS ─────────────────────────────────────
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

router.patch("/notifications/:id/read", auth, async (req, res) => {
  try {
    await pool.query("UPDATE notifications SET is_read = true WHERE id = $1 AND business_id = $2", [req.params.id, req.businessId]);
    res.json({ message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/notifications/read-all", auth, async (req, res) => {
  try {
    await pool.query("UPDATE notifications SET is_read = true WHERE business_id = $1", [req.businessId]);
    res.json({ message: "All marked as read" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
