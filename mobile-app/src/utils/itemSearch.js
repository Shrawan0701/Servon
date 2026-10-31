const normalize = (value) => String(value ?? "").normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’]/g, "")
  .replace(/&/g, " and ").replace(/[^\p{L}\p{M}\p{N}.]+/gu, " ").trim();
const unitWords = new Set(["ml", "cl", "l", "litre", "litres", "liter", "liters", "and"]);
const volumePattern = /\b(\d+(?:\.\d+)?)\s*(ml|cl|litres?|liters?|l)\b/gi;
const commonSizes = new Set([30, 60, 90, 180, 200, 250, 330, 355, 375, 500, 650, 700, 750, 1000, 1500, 2000]);
const cache = new WeakMap();

function nameIndex(value) {
  const full = normalize(value);
  const base = normalize(String(value).replace(volumePattern, " "));
  const words = base.split(/\s+/).filter((word) => word && !unitWords.has(word));
  return {
    full, base, compact: words.join(""), words,
    initials: words.filter((word) => /^\p{L}/u.test(word)).map((word) => word[0]).join(""),
  };
}
function itemIndex(item, aliases) {
  const names = [item.name, item.name_mr, item.name_hi, ...aliases].filter(Boolean);
  const signature = JSON.stringify([names, item.size_ml, item.bottle_size, item.unit]);
  if (cache.get(item)?.signature === signature) return cache.get(item);
  const sizes = new Set([Number(item.size_ml), Number(item.bottle_size) * (item.unit === "litre" ? 1000 : 1)]);
  for (const name of names) for (const match of String(name).matchAll(volumePattern))
    sizes.add(Number(match[1]) * (/^ml$/i.test(match[2]) ? 1 : /^cl$/i.test(match[2]) ? 10 : 1000));
  const result = { signature, names: [...new Set(names)].map(nameIndex), sizes };
  cache.set(item, result);
  return result;
}

// Bounded Damerau-Levenshtein: swapped adjacent letters count as one typo.
function distance(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i), beforePrevious;
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(next[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        next[j] = Math.min(next[j], beforePrevious[j - 2] + 1);
    }
    if (Math.min(...next) > limit) return limit + 1;
    beforePrevious = previous;
    previous = next;
  }
  return previous[b.length];
}
function fuzzyWord(query, word) {
  if (query === word) return 1;
  if (word.startsWith(query)) return 0.95;
  if (query.length < 4 || word.length < 4 || query.length > 48 || word.length > 48) return 0;
  const limit = Math.min(query.length, word.length) >= 7 ? 2 : 1;
  const edits = distance(query, word, limit);
  return edits <= limit ? 1 - edits / Math.max(query.length, word.length) : 0;
}
function nameScore(name, query, compact, words) {
  if (name.base === query || name.full === query) return 1200;
  // Initials come from product names, never category text such as "Starters".
  if (compact.length >= 2 && compact.length <= 6 && /^[a-z]+$/.test(compact) && name.initials.startsWith(compact))
    return name.initials === compact ? 1150 : 1130;
  if (name.full.startsWith(query) || name.base.startsWith(query)) return 1080;
  if (words.length === 1 && name.words.some((word) => word.startsWith(query))) return 1050;
  if (compact.length >= 3 && name.compact.startsWith(compact)) return 1000;
  if (query.length >= 3 && name.full.includes(query)) return 950;
  if (words.length && words.every((word) => word.length >= 2)) {
    // Each query token needs its own name token. Numeric sizes are never fuzzy.
    const used = new Set();
    let total = 0;
    for (const word of words) {
      let best = 0, index = -1;
      name.words.forEach((candidate, i) => {
        const score = used.has(i) ? 0 : fuzzyWord(word, candidate);
        if (score > best) { best = score; index = i; }
      });
      if (!best) { total = 0; break; }
      used.add(index); total += best;
    }
    if (total) return 700 + 100 * total / words.length;
  }
  if (compact.length >= 5 && compact.length <= 48 && /^[a-z]+$/.test(compact)) {
    const limit = compact.length >= 8 ? 2 : 1;
    if (distance(compact, name.compact, limit) <= limit) return 700;
  }
  return 0;
}
function itemSearchScore(item, query, extra = []) {
  let needle = normalize(String(query).slice(0, 128));
  if (!needle) return 1;
  const { aliases = [], metadata = [] } = Array.isArray(extra) ? { metadata: extra } : extra;
  const index = itemIndex(item, aliases);
  if (/^\d+$/.test(needle) && [item.liquor_code, item.liquor_brand_code, item.category_code]
    .some((code) => code != null && String(code) === needle)) return 1100;
  const sizeQuery = needle.match(/^(.*?)\s*(\d+(?:\.\d+)?)\s*(ml)?$/);
  let sizeMatched = false;
  if (sizeQuery && (sizeQuery[3] || commonSizes.has(Number(sizeQuery[2])))) {
    if (!index.sizes.has(Number(sizeQuery[2]))) return 0;
    sizeMatched = true;
    needle = sizeQuery[1].trim();
    if (!needle) return 1100;
  }
  const compact = needle.replace(/\./g, "").replace(/\s+/g, "");
  const words = needle.split(/\s+/).filter((word) => word && !unitWords.has(word));
  let best = 0;
  for (const name of index.names) best = Math.max(best, nameScore(name, needle, compact, words));
  if (best) return best + (sizeMatched ? 5 : 0);
  const fields = [item.category, item.description, item.menu_type, item.liquor_code, item.liquor_brand_code, item.category_code, ...metadata];
  // Short suffixes in descriptions/categories must not swamp name initials.
  return (needle.length >= 3 || /^\d+$/.test(needle)) && fields.some((field) => normalize(field).includes(needle)) ? 100 : 0;
}
function searchItems(items, query, getExtra = () => []) {
  if (!String(query || "").trim()) return items;
  return items.map((item, index) => ({ item, index, score: itemSearchScore(item, query, getExtra(item)) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}
const matchesItemSearch = (item, query, extra) => itemSearchScore(item, query, extra) > 0;
module.exports = { matchesItemSearch, itemSearchScore, searchItems };
