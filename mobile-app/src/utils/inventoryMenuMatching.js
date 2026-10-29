const plain = (name) =>
  String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\b\d+(?:\.\d+)?\s*(?:ml|cl|litres?|liters?|l)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const ignored = new Set([
  "seagram",
  "seagrams",
  "s",
  "deluxe",
  "whisky",
  "whiskey",
  "beer",
  "vodka",
  "rum",
  "gin",
  "wine",
  "brandy",
  "bottle",
  "bottles",
  "premium",
  "ml",
  "litre",
  "litres",
]);
function tokens(name) {
  return [
    ...new Set(
      plain(name)
        .split(" ")
        .filter((word) => word && !ignored.has(word)),
    ),
  ];
}
function scoreName(label, name) {
  const a = tokens(label),
    b = tokens(name);
  if (!a.length || !b.length) return 0;
  if (a.join("") === b.join("")) return 1;
  const overlap = a.filter((token) => b.includes(token)).length;
  return (2 * overlap) / (a.length + b.length);
}
function groupMenu(menu) {
  const groups = new Map();
  for (const item of menu || []) {
    const liquor = item.menu_type === "liquor";
    const key = liquor
      ? `brand:${item.liquor_brand_code || plain(item.name)}`
      : `item:${item.id}`;
    if (!groups.has(key))
      groups.set(key, {
        id: key,
        name: String(item.name || "")
          .replace(/\s*\d+(?:\.\d+)?\s*ml\b/gi, "")
          .trim(),
        liquor,
        variants: [],
      });
    groups.get(key).variants.push(item);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    variants: group.variants.sort(
      (a, b) => Number(a.size_ml || 0) - Number(b.size_ml || 0),
    ),
  }));
}
function relatedGroups(menu, label) {
  return groupMenu(menu)
    .map((group) => ({
      ...group,
      score: Math.max(
        ...group.variants.map((item) => scoreName(label, item.name)),
      ),
    }))
    .filter((group) => group.score >= 0.85)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
function quantityPerSale(menu, bottleSizeMl, stockUnit) {
  if (menu.menu_type === "liquor" && !(Number(menu.size_ml) > 0)) return null;
  if (stockUnit === "pcs") return menu.menu_type === "liquor" ? null : 1;
  const printed = String(menu.name || "").match(
    /\b(\d+(?:\.\d+)?)\s*(ml|cl|litres?|liters?|l)\b/i,
  );
  const printedMl = printed
    ? Number(printed[1]) *
      (/^ml$/i.test(printed[2]) ? 1 : /^cl$/i.test(printed[2]) ? 10 : 1000)
    : 0;
  const size = Number(menu.size_ml) || printedMl || Number(bottleSizeMl);
  return size > 0
    ? Math.round((size / (stockUnit === "litre" ? 1000 : 1)) * 1e6) / 1e6
    : null;
}
function chosenLinks(row, menu, stockUnit) {
  if (row.menu_mode === "stock") return [];
  const selected = new Set(row.menu_groups || []);
  return groupMenu(menu)
    .filter((group) => selected.has(group.id))
    .flatMap((group) =>
      group.variants.map((item) => ({
        menu_item_id: item.id,
        quantity_required:
          row.menu_amounts?.[item.id] ??
          quantityPerSale(item, row.bottle_size_ml, stockUnit),
      })),
    );
}
function initialMenuSelection(menu, stockId) {
  const keys = groupMenu(menu)
    .filter((group) =>
      group.variants.every((item) =>
        (item.inventory_item_ids || []).some(
          (id) => String(id) === String(stockId),
        ),
      ),
    )
    .map((group) => group.id);
  return { menu_mode: "link", menu_groups: keys, menu_amounts: {} };
}
module.exports = {
  scoreName,
  groupMenu,
  relatedGroups,
  quantityPerSale,
  chosenLinks,
  initialMenuSelection,
};
