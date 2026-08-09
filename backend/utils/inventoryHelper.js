const pool = require("../db");

function parseItems(items) {
  if (Array.isArray(items)) return items;
  try {
    const parsed = JSON.parse(items || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Deducts stock for every ingredient tied to the menu items in an order,
// and logs each deduction against the order so it can be reversed later.
async function deductInventoryForOrder(businessId, orderId, items) {
  const itemsArr = parseItems(items);

  for (const orderItem of itemsArr) {
    const menuItemId = orderItem.id || orderItem.menu_item_id || orderItem.menuItemId;
    const qty = parseInt(orderItem.quantity, 10) || 0;
    if (!menuItemId || qty <= 0) continue;

    const recipeRes = await pool.query(
      "SELECT inventory_item_id, quantity_required FROM menu_item_ingredients WHERE menu_item_id = $1 AND business_id = $2",
      [menuItemId, businessId]
    );

    for (const row of recipeRes.rows) {
      const deductAmount = parseFloat(row.quantity_required) * qty;
      if (deductAmount <= 0) continue;

      await pool.query(
        "UPDATE inventory_items SET current_stock = current_stock - $1, updated_at = NOW() WHERE id = $2 AND business_id = $3",
        [deductAmount, row.inventory_item_id, businessId]
      );
      await pool.query(
        `INSERT INTO inventory_stock_logs (business_id, inventory_item_id, change_amount, reason, order_id)
         VALUES ($1, $2, $3, 'order_deduction', $4)`,
        [businessId, row.inventory_item_id, -deductAmount, orderId]
      );
    }
  }
}

// Reverses every 'order_deduction' log entry for an order (used on reject
// or on edit, right before re-deducting the new item list) and records the
// reversal under its own reason so the log stays auditable.
async function reverseDeductionsForOrder(businessId, orderId, reason = "order_edit_refund") {
  const logs = await pool.query(
    `SELECT inventory_item_id, SUM(change_amount) as total
     FROM inventory_stock_logs
     WHERE business_id = $1 AND order_id = $2 AND reason = 'order_deduction'
     GROUP BY inventory_item_id`,
    [businessId, orderId]
  );

  for (const row of logs.rows) {
    const refundAmount = Math.abs(parseFloat(row.total));
    if (refundAmount <= 0) continue;

    await pool.query(
      "UPDATE inventory_items SET current_stock = current_stock + $1, updated_at = NOW() WHERE id = $2 AND business_id = $3",
      [refundAmount, row.inventory_item_id, businessId]
    );
    await pool.query(
      `INSERT INTO inventory_stock_logs (business_id, inventory_item_id, change_amount, reason, order_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [businessId, row.inventory_item_id, refundAmount, reason, orderId]
    );
  }
}

module.exports = { deductInventoryForOrder, reverseDeductionsForOrder, parseItems };