// Resolves the display name of a menu item (/enriched order item) for a given
// Servon locale code (en | mr | hi). Item names are stored as `name` (the
// default/English name) plus optional `name_mr` and `name_hi` for the localized
// spellings. Falls back to the default name when a translation is unavailable,
// so existing/legacy items (and null columns) never break.
export function localizedItemName(item, language) {
  if (!item) return "";
  const lang = language === "mr" ? "mr" : language === "hi" ? "hi" : "en";
  if (lang === "mr" && item.name_mr) return item.name_mr;
  if (lang === "hi" && item.name_hi) return item.name_hi;
  return item.name || item.name_mr || item.name_hi || "".trim();
}