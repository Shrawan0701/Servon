const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  relatedGroups,
  groupMenu,
  chosenLinks,
  initialMenuSelection,
  quantityPerSale,
} = require("../src/utils/inventoryMenuMatching");
const menu = [
  {
    id: "royal-30",
    name: "Royal Stag 30ml",
    menu_type: "liquor",
    liquor_brand_code: 21,
    size_ml: 30,
    inventory_item_ids: [5],
  },
  {
    id: "royal-60",
    name: "Royal Stag 60ml",
    menu_type: "liquor",
    liquor_brand_code: 21,
    size_ml: 60,
    inventory_item_ids: [5],
  },
  {
    id: "double",
    name: "Royal Stag Double",
    menu_type: "liquor",
    liquor_brand_code: 22,
    size_ml: 30,
  },
  {
    id: "green",
    name: "Royal Green",
    menu_type: "liquor",
    liquor_brand_code: 23,
    size_ml: 30,
  },
  { id: "beer", name: "Kingfisher 650ml", menu_type: "food" },
];
test("photo labels rank the brand first and suggest related products without auto-selecting", () => {
  const related = relatedGroups(menu, "Seagram's Royal Stag Deluxe Whisky");
  assert.equal(related[0].id, "brand:21");
  assert.ok(related.some((group) => group.id === "brand:22"));
  assert.ok(!related.some((group) => group.id === "brand:23"));
  assert.deepEqual(
    related[0].variants.map((item) => item.size_ml),
    [30, 60],
  );
  assert.equal(relatedGroups(menu, "RoyalStag")[0].id, "brand:21");
  assert.equal(relatedGroups(menu, "Royal Stag Double")[0].id, "brand:22");
  assert.equal(relatedGroups(menu, "Unknown bottle").length, 0);
});
test("brand suggestions tolerate punctuation, missing size units, partial names and OCR spelling", () => {
  const entries = [
    { id: "gm", name: "Gold Medal Vodka 180 ML", menu_type: "liquor", liquor_brand_code: 73, size_ml: 180 },
    { id: "mc", name: "McDowells Rum 180 ML", menu_type: "liquor", liquor_brand_code: 26, size_ml: 180 },
    { id: "classic", name: "Classic Gold 90 ML", menu_type: "liquor", liquor_brand_code: 50, size_ml: 90 },
    { id: "magic", name: "Magic Moments 180 ML", menu_type: "liquor", liquor_brand_code: 83, size_ml: 180 },
  ];
  for (const [label, expected] of [["GM Blue Berry", "brand:73"], ["Mc Dowell's Rum 750", "brand:26"], ["Classic Gold Whisky", "brand:50"], ["Magik Moment", "brand:83"]])
    assert.equal(relatedGroups(entries, label)[0]?.id, expected);
  assert.equal(relatedGroups(menu, "Royel Stag")[0]?.id, "brand:21");
  assert.deepEqual(initialMenuSelection(entries, null).menu_groups, []);
});
test("a selected brand links all variants with the correct units, while stock-only and unchecked items do not link", () => {
  const row = {
    ...initialMenuSelection(menu, null),
    bottle_size_ml: "750",
    menu_groups: ["brand:21"],
  };
  assert.deepEqual(chosenLinks(row, menu, "ml"), [
    { menu_item_id: "royal-30", quantity_required: 30 },
    { menu_item_id: "royal-60", quantity_required: 60 },
  ]);
  assert.deepEqual(
    chosenLinks(row, menu, "litre").map((link) => link.quantity_required),
    [0.03, 0.06],
  );
  assert.deepEqual(chosenLinks({ ...row, menu_mode: "stock" }, menu, "ml"), []);
  assert.deepEqual(initialMenuSelection(menu, null).menu_groups, []);
  assert.deepEqual(initialMenuSelection(menu, 5).menu_groups, ["brand:21"]);
  assert.equal(quantityPerSale(menu[0], 750, "pcs"), null);
  assert.equal(quantityPerSale(menu[4], 750, "ml"), 650);
  assert.equal(quantityPerSale(menu[4], 750, "pcs"), 1);
  assert.equal(groupMenu(menu).length, 4);
});
test("a Carlsberg entry missing its size cannot block linking the valid 650 ml entry", () => {
  const entries = [
    { id: "no-size", name: "Carlsberg Beer", menu_type: "liquor", liquor_brand_code: 15, size_ml: null },
    { id: "650", name: "Carlsberg Beer", menu_type: "liquor", liquor_brand_code: 15, size_ml: "650", inventory_item_ids: [7] },
  ];
  const row = { menu_mode: "link", menu_groups: ["brand:15"], bottle_size_ml: "180" };
  assert.deepEqual(chosenLinks(row, entries, "ml"), [{ menu_item_id: "650", quantity_required: 650 }]);
  assert.deepEqual(chosenLinks(row, entries, "litre"), [{ menu_item_id: "650", quantity_required: 0.65 }]);
  assert.deepEqual(initialMenuSelection(entries, 7).menu_groups, ["brand:15"]);
  assert.equal(groupMenu(entries)[0].missingSizeVariants.length, 1);
  assert.deepEqual(groupMenu(entries.slice(0, 1))[0].linkableVariants, []);
  assert.deepEqual(chosenLinks(row, entries.slice(0, 1), "ml"), []);
  assert.deepEqual(initialMenuSelection(entries.slice(0, 1), 7).menu_groups, []);
});
