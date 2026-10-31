// Stricter than menu suggestions: never replace another product's recipe.
function productKey(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/['’]/g, "").replace(/&/g, " and ")
    .replace(/\b(?:mc\s*dowells?|mcdowells)\b/g, "mcdowell")
    .replace(/\b(?:magik|magic)\s+moments?\b/g, "magic moments")
    .replace(/\b\d+(?:\.\d+)?\s*(?:ml|cl|litres?|liters?|ltr|l)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:30|60|90|180|330|375|500|650|750|1000)\b\s*$/g, "")
    .replace(/\b(?:seagrams?|deluxe|premium|bottles?|whisky|whiskey)\b/g, " ")
    .replace(/\s+/g, "").trim();
}
const sizeMl = (item) => Number(item.bottle_size || 0) * (item.unit === "litre" ? 1000 : 1);
module.exports = { productKey, sizeMl };
