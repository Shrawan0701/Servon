const { test } = require("node:test");
const assert = require("node:assert/strict");
const { updateScanRow, stockPreview, scanTarget } = require("../src/utils/inventoryScanReview");
const stock = [
  { id: 1, name: "Royal Stag", unit: "ml", bottle_size: 180, current_stock: 360 },
  { id: 2, name: "Royal Stag", unit: "ml", bottle_size: 90, current_stock: 270 },
];
const row = { inventory_item_id: 1, new_name: "Royal Stag", new_unit: "ml", full_bottles: "4", bottle_size_ml: "180", opened_ml: "0" };

test("receiving four bottles adds to the existing two; counting four sets a total of four", () => {
  const added = stockPreview(row, stock[0], "add");
  assert.equal(added.current / added.bottleSize, 2);
  assert.equal(added.after / added.bottleSize, 6);
  const counted = stockPreview(row, stock[0], "count");
  assert.equal(counted.after / counted.bottleSize, 4);
});
test("explicit new-card selection stays new while size and quantities are edited", () => {
  let next = updateScanRow(row, { inventory_item_id: "new", create_separate_card: true, bottle_size_ml: "180" }, stock);
  assert.equal(next.inventory_item_id, "new");
  next = updateScanRow(next, { bottle_size_ml: "90" }, stock);
  assert.equal(next.inventory_item_id, "new");
  next = updateScanRow(next, { full_bottles: "3" }, stock);
  const preview = stockPreview(next, undefined, "add");
  assert.equal(preview.current, 0);
  assert.equal(preview.after, 270);
});
test("automatic size matching uses the correct card and creates a new size when missing", () => {
  assert.equal(updateScanRow(row, { bottle_size_ml: "90" }, stock).inventory_item_id, 2);
  const next = updateScanRow(row, { bottle_size_ml: "750" }, stock);
  assert.equal(next.inventory_item_id, "new");
  assert.equal(next.new_unit, "ml");
  assert.equal(stockPreview(next, undefined, "add").current, 0);
  const pieces = stockPreview({ inventory_item_id: 5, full_bottles: "4" }, { unit: "pcs", current_stock: 2 }, "add");
  assert.equal(pieces.after, 6);
});
test("later deliveries default to an existing card of the same size even after an explicit separate card was made", () => {
  const cards = [...stock, { ...stock[0], id: 3, current_stock: 540 }];
  const detection = { label: "Royal Stag", bottle_size_ml: 180, confidence: 0.95, inventory_item_id: null };
  assert.equal(scanTarget(detection, cards).id, 1);
  assert.equal(scanTarget({ ...detection, bottle_size_ml: 90 }, cards).id, 2);
  assert.equal(scanTarget({ ...detection, bottle_size_ml: 750 }, cards), undefined);
  assert.equal(scanTarget({ ...detection, confidence: 0.3 }, cards), undefined);
});
