const productLabel = (name) => String(name || "")
  .replace(/\s*\b\d+(?:\.\d+)?\s*(?:ml|cl|litres?|liters?|l)\b/gi, " ")
  .replace(/\s+\b(?:30|60|90|180|330|375|500|650|750|1000)\b\s*$/, "")
  .replace(/\s+/g, " ").trim();
const plain = (name) =>
  String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/\b(?:mc\s*dowells?|mcdowells)\b/g, "mcdowell")
    .replace(/\b(?:magik|magic)\s+moments?\b/g, "magic moments")
    .replace(/\b\d+(?:\.\d+)?\s*(?:ml|cl|litres?|liters?|l)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:30|60|90|180|330|375|500|650|750|1000)\b\s*$/g, "")
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
  const initials = (words) => words.map((word) => word[0]).join("");
  if ((b.length > 1 && a.some((word) => word.length >= 2 && word === initials(b))) ||
      (a.length > 1 && b.some((word) => word.length >= 2 && word === initials(a)))) return 0.75;
  const overlap = a.filter((token) => b.includes(token)).length;
  if (overlap === Math.min(a.length, b.length)) return 0.9;
  // Suggestions only: tolerate OCR spelling errors without auto-linking.
  const left = a.join(""), right = b.join("");
  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i++) {
    const next = [i];
    for (let j = 1; j <= right.length; j++)
      next[j] = Math.min(next[j - 1] + 1, previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
    previous = next;
  }
  const similarity = 1 - previous[right.length] / Math.max(left.length, right.length);
  if (Math.min(left.length, right.length) >= 5 && similarity >= 0.75) return similarity;
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
        name: productLabel(item.name),
        liquor,
        variants: [],
      });
    groups.get(key).variants.push(item);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    linkableVariants: group.variants.filter((item) => !group.liquor || (Number.isFinite(Number(item.size_ml)) && Number(item.size_ml) > 0))
      .sort((a, b) => Number(a.size_ml || 0) - Number(b.size_ml || 0)),
    missingSizeVariants: group.variants.filter((item) => group.liquor && !(Number.isFinite(Number(item.size_ml)) && Number(item.size_ml) > 0)),
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
    .filter((group) => group.score >= 0.6)
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
      group.linkableVariants.map((item) => ({
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
      group.linkableVariants.length > 0 && group.linkableVariants.every((item) =>
        (item.inventory_item_ids || []).some(
          (id) => String(id) === String(stockId),
        ),
      ),
    )
    .map((group) => group.id);
  return { menu_mode: "link", menu_groups: keys, menu_amounts: {} };
}
module.exports = {
  plain,
  productLabel,
  scoreName,
  groupMenu,
  relatedGroups,
  quantityPerSale,
  chosenLinks,
  initialMenuSelection,
};
