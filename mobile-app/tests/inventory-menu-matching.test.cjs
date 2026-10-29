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
test("photo labels suggest the right brand and group its serving sizes without selecting another product", () => {
  const related = relatedGroups(menu, "Seagram's Royal Stag Deluxe Whisky");
  assert.equal(related.length, 1);
  assert.deepEqual(
    related[0].variants.map((item) => item.size_ml),
    [30, 60],
  );
  assert.equal(relatedGroups(menu, "RoyalStag")[0].id, "brand:21");
  assert.equal(relatedGroups(menu, "Royal Stag Double")[0].id, "brand:22");
  assert.equal(relatedGroups(menu, "Unknown bottle").length, 0);
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
