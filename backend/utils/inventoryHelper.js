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
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const orderItem of itemsArr) {
      const menuItemId = orderItem.id || orderItem.menu_item_id || orderItem.menuItemId;
      const qty = parseInt(orderItem.quantity, 10) || 0;
      if (!menuItemId || qty <= 0) continue;

      const recipeRes = await client.query(
        `SELECT mi.inventory_item_id, mi.quantity_required, ii.name, ii.current_stock
         FROM menu_item_ingredients mi
         JOIN inventory_items ii ON ii.id = mi.inventory_item_id AND ii.business_id = mi.business_id
         WHERE mi.menu_item_id = $1 AND mi.business_id = $2
         FOR UPDATE OF ii`,
        [menuItemId, businessId]
      );

      for (const row of recipeRes.rows) {
        const deductAmount = parseFloat(row.quantity_required) * qty;
        if (deductAmount <= 0) continue;

        const currentStock = parseFloat(row.current_stock) || 0;
        if (currentStock < deductAmount) {
          throw new Error(`Insufficient stock for ${row.name}. Required ${deductAmount}, available ${currentStock}.`);
        }

        await client.query(
          "UPDATE inventory_items SET current_stock = current_stock - $1, updated_at = NOW() WHERE id = $2 AND business_id = $3",
          [deductAmount, row.inventory_item_id, businessId]
        );
        await client.query(
          `INSERT INTO inventory_stock_logs (business_id, inventory_item_id, change_amount, reason, order_id)
           VALUES ($1, $2, $3, 'order_deduction', $4)`,
          [businessId, row.inventory_item_id, -deductAmount, orderId]
        );
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
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
