const { test } = require("node:test");
const assert = require("node:assert/strict");
const { searchItems, matchesItemSearch } = require("../src/utils/itemSearch");
const items = [
  { id: "food", name: "Aalu Palak", category: "Starters", description: "Served as starters", category_code: 6 },
  { id: "masters", name: "Grand Masters", size_ml: 180 },
  { id: "rs90", name: "Royal Stag 90 ML", size_ml: 90, liquor_brand_code: 21 },
  { id: "rs180", name: "Royal Stag 180 ML", size_ml: 180, liquor_brand_code: 21 },
  { id: "double", name: "Royal Stag Double", size_ml: 180 },
  { id: "rc", name: "Royal Challenge", size_ml: 180, liquor_brand_code: 34 },
  { id: "beer", name: "Carlsberg Beer", size_ml: 650 },
];
const ids = (query) => searchItems(items, query).map((item) => item.id);

test("RS ranks Royal Stag sizes first and excludes Starters/category suffix noise", () => {
  for (const query of ["rs", "RS", "r.s.", "r s"])
    assert.deepEqual(ids(query), ["rs90", "rs180", "double"]);
  assert.deepEqual(ids("rc"), ["rc"]);
  assert.deepEqual(ids("rsd"), ["double"]);
});
test("misspellings, swapped letters and missing spaces still find the saved products", () => {
  for (const query of ["royel stag", "yoyal stag", "roayl stag", "royal stga", "royalstg"])
    assert.deepEqual(ids(query).slice(0, 2), ["rs90", "rs180"], query);
  assert.deepEqual(ids("carlsbrg"), ["beer"]);
  assert.equal(matchesItemSearch({ name: "Paneer Butter Masala" }, "paneer buter"), true);
  assert.deepEqual(ids("zzzzzz"), []);
});
test("size filters stay exact even with initials or misspelled names", () => {
  for (const query of ["rs180", "RS 180 ML", "royel stag 180"])
    assert.deepEqual(ids(query), ["rs180", "double"]);
  assert.deepEqual(ids("rs 650"), []);
  assert.equal(matchesItemSearch({ name: "Royal Stag", unit: "litre", bottle_size: 0.18 }, "rs 180"), true);
});
test("exact matches outrank typo suggestions, while saved codes and ordinary category searches still work", () => {
  const names = [{ name: "Royel Stag", id: "exact" }, ...items];
  assert.equal(searchItems(names, "royel stag")[0].id, "exact");
  assert.deepEqual(ids("21"), ["rs90", "rs180"]);
  assert.deepEqual(ids("starters"), ["food"]);
  assert.equal(matchesItemSearch({ name: "Alpha Bull", size_ml: 180, liquor_brand_code: 60 }, "60"), true);
});
test("grouped aliases include every bottle size, and cached indexes follow changed names", () => {
  const item = { name: "Royal Stag", size_ml: 90 };
  const extra = () => ({ aliases: ["Royal Stag 90 ml", "Royal Stag 180 ml"] });
  assert.equal(searchItems([item], "rs 180", extra).length, 1);
  assert.equal(searchItems([item], "rs").length, 1);
  item.name = "Royal Challenge";
  assert.equal(searchItems([item], "rs").length, 0);
  assert.equal(searchItems([item], "rc").length, 1);
});
