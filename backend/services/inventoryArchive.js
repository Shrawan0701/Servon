const { fail } = require("./inventoryUnits");

// Call inside the tenant's inventory transaction. Keep the stock row, logs and
// order snapshots so an earlier sale can still be reversed accurately.
async function archiveStockItem(db, businessId, itemId) {
  const item = await db.query(
    "SELECT id FROM inventory_items WHERE id=$1 AND business_id=$2 AND NOT archived FOR UPDATE",
    [itemId, businessId],
  );
  if (!item.rowCount) fail("Item not found", 404);

  await db.query(
    "DELETE FROM menu_item_ingredients WHERE inventory_item_id=$1 AND business_id=$2",
    [itemId, businessId],
  );
  const components = await db.query(
    "DELETE FROM inventory_preparation_components WHERE inventory_item_id=$1 AND business_id=$2 RETURNING preparation_id",
    [itemId, businessId],
  );

  let affected = [...new Set(components.rows.map((row) => row.preparation_id))];
  while (affected.length) {
    // Invalidate an editor opened before this ingredient was removed.
    await db.query(
      "UPDATE inventory_preparations SET version=version+1,updated_at=NOW() WHERE business_id=$1 AND id=ANY($2::int[])",
      [businessId, affected],
    );
    const empty = await db.query(
      `SELECT p.id FROM inventory_preparations p
       WHERE p.business_id=$1 AND p.id=ANY($2::int[])
       AND NOT EXISTS (SELECT 1 FROM inventory_preparation_components c
         WHERE c.business_id=p.business_id AND c.preparation_id=p.id)`,
      [businessId, affected],
    );
    if (!empty.rowCount) break;
    const ids = empty.rows.map((row) => row.id);
    // An empty base must not remain linked to dishes or other preparations:
    // recipe expansion would otherwise prevent future orders from processing.
    await db.query(
      "DELETE FROM menu_item_preparations WHERE business_id=$1 AND preparation_id=ANY($2::int[])",
      [businessId, ids],
    );
    const parents = await db.query(
      "DELETE FROM inventory_preparation_components WHERE business_id=$1 AND component_preparation_id=ANY($2::int[]) RETURNING preparation_id",
      [businessId, ids],
    );
    await db.query(
      "UPDATE inventory_preparations SET archived=true,updated_at=NOW() WHERE business_id=$1 AND id=ANY($2::int[])",
      [businessId, ids],
    );
    affected = [...new Set(parents.rows.map((row) => row.preparation_id))];
  }

  await db.query(
    "UPDATE inventory_items SET archived=true,updated_at=NOW() WHERE id=$1 AND business_id=$2",
    [itemId, businessId],
  );
  return { message: "Item deleted; recipe links removed and audit history preserved" };
}

module.exports = { archiveStockItem };
