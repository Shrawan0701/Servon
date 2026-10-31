const { plain, productLabel } = require("./inventoryMenuMatching");
const volumeUnit = (unit) => ["ml", "litre"].includes(unit);
function scanTarget(detection, stock) {
  const identified = stock.find((item) => String(item.id) === String(detection.inventory_item_id));
  if (identified) return identified;
  if (!(detection.confidence >= 0.8) || !(Number(detection.bottle_size_ml) > 0)) return undefined;
  // If separate cards exist for the same product and size, normal deliveries
  // use the oldest card by default. Staff can explicitly choose another card.
  return stock.filter((item) => volumeUnit(item.unit) &&
    plain(item.name).replace(/\s/g, "") === plain(detection.label).replace(/\s/g, "") &&
    Number(item.bottle_size) * (item.unit === "litre" ? 1000 : 1) === Number(detection.bottle_size_ml))
    .sort((a, b) => Number(a.id) - Number(b.id))[0];
}

// An explicit new-card choice must never be replaced by automatic matching.
function updateScanRow(row, change, stock) {
  const next = { ...row, ...change };
  if (change.bottle_size_ml === undefined || !(Number(change.bottle_size_ml) > 0) || next.create_separate_card)
    return next;
  const selected = stock.find((record) => String(record.id) === String(row.inventory_item_id));
  const label = selected?.name || next.new_name || row.label;
  const matches = stock.filter((record) => volumeUnit(record.unit) &&
    plain(label).replace(/\s/g, "") === plain(record.name).replace(/\s/g, "") &&
    Number(record.bottle_size) * (record.unit === "litre" ? 1000 : 1) === Number(change.bottle_size_ml));
  if (matches.length === 1) next.inventory_item_id = matches[0].id;
  else if (selected?.bottle_size && Number(selected.bottle_size) * (selected.unit === "litre" ? 1000 : 1) !== Number(change.bottle_size_ml)) {
    next.inventory_item_id = "new";
    next.new_name = productLabel(selected.name);
    next.new_unit = "ml";
  }
  return next;
}

function stockPreview(row, item, mode = "add") {
  const unit = row.inventory_item_id === "new" ? row.new_unit : item?.unit;
  const current = row.inventory_item_id === "new" ? 0 : Number(item?.current_stock || 0);
  const entered = volumeUnit(unit)
    ? (Number(row.full_bottles) * Number(row.bottle_size_ml) + Number(row.opened_ml || 0)) / (unit === "litre" ? 1000 : 1)
    : Number(row.full_bottles);
  const after = mode === "add" ? current + entered : entered;
  const size = Number(row.bottle_size_ml) / (unit === "litre" ? 1000 : 1);
  return { unit, current, entered, after, bottleSize: volumeUnit(unit) ? size : 1 };
}
module.exports = { updateScanRow, stockPreview, scanTarget };
