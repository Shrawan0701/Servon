const { transaction } = require("../services/inventoryTransaction");
const {
  catalogue,
  consumptionForMenu,
} = require("../services/inventoryRecipes");
const { fail, round } = require("../services/inventoryUnits");
function parseItems(items) {
  if (Array.isArray(items)) return items;
  try {
    const p = JSON.parse(items || "[]");
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}
function normalizeStockName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b\d+(\.\d+)?\s*(ml|l|litre|liter|ltr)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function quantities(items) {
  const result = new Map();
  for (const item of parseItems(items)) {
    const id = item.id || item.menu_item_id || item.menuItemId,
      qty = Number(item.quantity);
    if (!id || !Number.isSafeInteger(qty) || qty <= 0)
      fail("Order items require a menu item and positive whole quantity");
    result.set(String(id), (result.get(String(id)) || 0) + qty);
  }
  return result;
}
async function move(db, businessId, orderId, menuId, stockId, amount, reason) {
  amount = round(amount);
  if (!amount) return;
  const updated = await db.query(
    `UPDATE inventory_items SET current_stock=current_stock+$1,updated_at=NOW()
    WHERE id=$2 AND business_id=$3 AND ($1::numeric>=0 OR current_stock+$1::numeric>=0) RETURNING unit`,
    [amount, stockId, businessId],
  );
  if (!updated.rowCount)
    fail("Insufficient stock or ingredient unavailable", 409);
  await db.query(
    `INSERT INTO inventory_stock_logs(business_id,inventory_item_id,change_amount,reason,order_id,menu_item_id,unit,actor)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      businessId,
      stockId,
      amount,
      reason,
      orderId,
      menuId,
      updated.rows[0].unit,
      `business:${businessId}`,
    ],
  );
}
// Input is the complete desired order. Saved per-serving snapshots ensure
// retries and later recipe changes cannot cause duplicate/incorrect refunds.
async function deductInventoryForOrder(
  businessId,
  orderId,
  items,
  options = {},
) {
  return transaction(
    businessId,
    async (db) => {
      const order = await db.query(
        "SELECT id,status FROM orders WHERE id=$1 AND business_id=$2 FOR UPDATE",
        [orderId, businessId],
      );
      if (!order.rowCount) fail("Order not found", 404);
      if (order.rows[0].status === "REJECTED")
        fail("Rejected orders cannot consume inventory", 409);
      await db.query(
        "INSERT INTO inventory_order_state(business_id,order_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [businessId, orderId],
      );
      const state = await db.query(
        "SELECT lines FROM inventory_order_state WHERE business_id=$1 AND order_id=$2 FOR UPDATE",
        [businessId, orderId],
      );
      const lines = state.rows[0].lines,
        desired = quantities(items),
        cat = await catalogue(db, businessId);
      if (lines._legacy) {
        const old = quantities(lines._legacy.items);
        if (!desired.size) {
          for (const c of lines._legacy.consumption)
            await move(
              db,
              businessId,
              orderId,
              null,
              c.inventory_item_id,
              Number(c.quantity) * lines._legacy.quantity,
              "order_edit_refund",
            );
          lines._legacy.quantity = 0;
          lines._legacy.items = [];
        } else {
          // Old logs have no per-dish attribution. Preserve their baseline;
          // only additional servings use new recipes. Never guess a refund.
          for (const [id, quantity] of old) {
            if ((desired.get(id) || 0) < quantity)
              fail(
                "This order predates recipe snapshots. Cancel it and create a corrected order to preserve exact stock accounting.",
                409,
              );
            desired.set(id, (desired.get(id) || 0) - quantity);
          }
        }
      }
      for (const id of [
        ...new Set([
          ...Object.keys(lines).filter((id) => id !== "_legacy"),
          ...desired.keys(),
        ]),
      ].sort()) {
        const previous = lines[id],
          quantity = desired.get(id) || 0;
        if (
          (!previous && quantity === 0) ||
          (previous && previous.quantity === quantity)
        )
          continue;
        let consumption = previous?.consumption;
        if (!consumption) {
          consumption = await consumptionForMenu(db, businessId, id, cat);
          if (!consumption.length) {
            const m = await db.query(
              "SELECT name,menu_type,size_ml FROM menu_items WHERE id=$1 AND business_id=$2",
              [id, businessId],
            );
            const menu = m.rows[0];
            if (menu?.menu_type === "liquor" && Number(menu.size_ml) > 0) {
              const name = normalizeStockName(menu.name);
              const matches = cat.stock.filter(
                (s) =>
                  ["ml", "litre"].includes(s.unit) &&
                  normalizeStockName(s.name) === name,
              );
              if (matches.length === 1)
                consumption = [
                  {
                    inventory_item_id: matches[0].id,
                    quantity:
                      Number(menu.size_ml) /
                      (matches[0].unit === "litre" ? 1000 : 1),
                  },
                ];
            }
          }
        }
        const delta = quantity - (previous?.quantity || 0);
        for (const c of [...consumption].sort(
          (a, b) => a.inventory_item_id - b.inventory_item_id,
        ))
          await move(
            db,
            businessId,
            orderId,
            id,
            c.inventory_item_id,
            -delta * Number(c.quantity),
            delta < 0 ? "order_edit_refund" : "order_deduction",
          );
        lines[id] = { quantity, consumption };
      }
      await db.query(
        "UPDATE inventory_order_state SET lines=$1,updated_at=NOW() WHERE business_id=$2 AND order_id=$3",
        [JSON.stringify(lines), businessId, orderId],
      );
    },
    options.client,
  );
}
async function reverseDeductionsForOrder(
  businessId,
  orderId,
  reason = "order_reject_refund",
  options = {},
) {
  return transaction(
    businessId,
    async (db) => {
      const state = await db.query(
        "SELECT lines FROM inventory_order_state WHERE business_id=$1 AND order_id=$2 FOR UPDATE",
        [businessId, orderId],
      );
      if (!state.rowCount) return;
      const lines = state.rows[0].lines;
      for (const [id, line] of Object.entries(lines)) {
        for (const c of line.consumption)
          await move(
            db,
            businessId,
            orderId,
            id === "_legacy" ? null : id,
            c.inventory_item_id,
            Number(c.quantity) * line.quantity,
            reason,
          );
        line.quantity = 0;
      }
      await db.query(
        "UPDATE inventory_order_state SET lines=$1,updated_at=NOW() WHERE business_id=$2 AND order_id=$3",
        [JSON.stringify(lines), businessId, orderId],
      );
    },
    options.client,
  );
}
module.exports = {
  deductInventoryForOrder,
  reverseDeductionsForOrder,
  parseItems,
  quantities,
};
