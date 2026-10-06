// Resolves the display name of a menu item for a given Servon locale code
// (en | mr | hi). Item names are stored as `name` (the default/English name)
// plus optional `name_mr` and `name_hi`. Falls back to the default name whena
// translation is unavailable, so existing/legacy items never break.
export function localizedItemName(item, language) {
  if (!item) return "";
  const lang = language === "mr" ? "mr" : language === "hi" ? "hi" : "en";
  const name = lang === "mr" && item.name_mr
    ? item.name_mr
    : lang === "hi" && item.name_hi
      ? item.name_hi
      : item.name || item.name_mr || item.name_hi || "";
  return item.menu_type === "liquor" && item.size_ml ? `${name} ${Number(item.size_ml)} ML` : name;
}
