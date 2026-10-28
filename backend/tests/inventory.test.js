const { test } = require("node:test");
const assert = require("node:assert/strict");
const { convert, physicalQuantity } = require("../services/inventoryUnits");
const {
  parseDetections,
  validateImage,
  detect,
} = require("../services/inventoryVision");
const {
  assertAcyclic,
  expandPreparation,
} = require("../services/inventoryRecipes");

test("compatible unit conversions preserve small servings and reject invalid quantities", () => {
  assert.equal(convert(150, "gm", "kg"), 0.15);
  assert.equal(convert(0.3, "litre", "ml"), 300);
  assert.equal(convert(10, "ml", "litre"), 0.01);
  for (const args of [
    [1, "gm", "ml"],
    [0, "ml", "ml"],
    [-1, "kg", "gm"],
    ["1x", "gm", "kg"],
    [Infinity, "ml", "ml"],
  ])
    assert.throws(() => convert(...args));
});
test("full bottles and manually opened volume have one explicit total", () => {
  const row = { full_bottles: 3, bottle_size_ml: 650, opened_ml: 90 };
  assert.equal(physicalQuantity(row, { unit: "ml" }).quantity, 2040);
  assert.equal(physicalQuantity(row, { unit: "litre" }).quantity, 2.04);
  assert.equal(
    physicalQuantity({ full_bottles: 12, opened_ml: 0 }, { unit: "pcs" })
      .quantity,
    12,
  );
  assert.throws(() =>
    physicalQuantity({ ...row, opened_ml: 650 }, { unit: "ml" }),
  );
  assert.throws(() =>
    physicalQuantity({ ...row, full_bottles: 3.5 }, { unit: "ml" }),
  );
  assert.throws(() =>
    physicalQuantity(
      { full_bottles: 1e9, bottle_size_ml: 1e9, opened_ml: 0 },
      { unit: "ml" },
    ),
  );
});
test("detection parsing distinguishes exact confident matches from unknown/ambiguous products", () => {
  const stock = [{ id: 1, name: "Kingfisher 650ml" }];
  const rows = parseDetections(
    {
      detections: [
        {
          label: "Kingfisher 650ml",
          count: 3,
          confidence: 0.95,
          inventory_item_id: 1,
        },
        {
          label: "Unknown bottle",
          count: 2,
          confidence: 0.3,
          inventory_item_id: 999,
        },
      ],
    },
    stock,
  );
  assert.equal(rows[0].inventory_item_id, 1);
  assert.equal(rows[1].inventory_item_id, null);
  assert.equal(rows[1].suggested_inventory_item_id, null);
  assert.equal(
    parseDetections(
      {
        detections: [{ label: "Kingfisher 650ml", count: 3, confidence: 0.2 }],
      },
      stock,
    )[0].inventory_item_id,
    null,
  );
  assert.equal(
    parseDetections(
      {
        detections: [{ label: "Kingfisher 650ml", count: 3, confidence: 0.95 }],
      },
      [...stock, { id: 2, name: "Kingfisher 650ml" }],
    )[0].inventory_item_id,
    null,
  );
  assert.throws(() =>
    parseDetections(
      { detections: [{ label: "X", count: -1, confidence: 0.9 }] },
      stock,
    ),
  );
  assert.throws(() =>
    parseDetections(
      { detections: [{ label: "X", count: 1, confidence: 2 }] },
      stock,
    ),
  );
  assert.throws(() =>
    parseDetections(
      {
        detections: [
          { label: "X", count: 1, confidence: 0.9 },
          { label: "x", count: 1, confidence: 0.9 },
        ],
      },
      stock,
    ),
  );
  assert.throws(() => parseDetections({ products: [] }, stock));
});
test("upload content signatures, MIME types and limits are validated", () => {
  const data = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  assert.equal(
    validateImage({ data, mimetype: "image/png" }).mime,
    "image/png",
  );
  for (const file of [
    { data, mimetype: "image/jpeg" },
    { data: Buffer.from("<html>not an image</html>"), mimetype: "image/png" },
    { data, mimetype: "image/png", truncated: true },
    { data: Buffer.alloc(6 * 1024 * 1024), mimetype: "image/png" },
  ])
    assert.throws(() => validateImage(file));
});
test("vision integration sends actual image content and handles refusal, malformed output and timeout", async () => {
  const image = { mime: "image/png", data: Buffer.from("image bytes") };
  let request;
  const client = {
    chat: {
      completions: {
        create: async (input) => {
          request = input;
          return {
            choices: [
              {
                finish_reason: "stop",
                message: {
                  content: JSON.stringify({
                    detections: [
                      {
                        label: "Bottle",
                        count: 2,
                        confidence: 0.4,
                        inventory_item_id: null,
                        note: "Unreadable",
                      },
                    ],
                  }),
                },
              },
            ],
          };
        },
      },
    },
  };
  assert.equal((await detect(image, [], client))[0].count, 2);
  assert.match(
    request.messages[1].content[1].image_url.url,
    /^data:image\/png;base64,/,
  );
  assert.equal(request.store, false);
  assert.equal(request.response_format.json_schema.strict, true);
  for (const response of [
    { choices: [{ finish_reason: "stop", message: { refusal: "No" } }] },
    { choices: [{ finish_reason: "length", message: { content: "{}" } }] },
    {
      choices: [
        { finish_reason: "stop", message: { content: "invalid json" } },
      ],
    },
  ]) {
    client.chat.completions.create = async () => response;
    await assert.rejects(() => detect(image, [], client));
  }
  client.chat.completions.create = async () => {
    throw Object.assign(new Error("timeout"), {
      name: "APIConnectionTimeoutError",
    });
  };
  await assert.rejects(() => detect(image, [], client), /timed out/);
});
test("preparation expansion uses usable yield once and rejects circular graphs", () => {
  const cat = {
    preparations: [
      { id: 1, name: "Gravy", yield_quantity: 5, wastage_percent: 0 },
    ],
    components: [
      { preparation_id: 1, inventory_item_id: 3, quantity_required: 2 },
      { preparation_id: 1, inventory_item_id: 4, quantity_required: 300 },
    ],
  };
  const quantities = expandPreparation(cat, 1, 0.15);
  assert.equal(quantities.get(3), 0.06);
  assert.equal(quantities.get(4), 9);
  cat.preparations[0].wastage_percent = 10;
  assert.equal(expandPreparation(cat, 1, 0.45).get(3), 0.2);
  cat.components.push({
    preparation_id: 1,
    component_preparation_id: 1,
    quantity_required: 1,
  });
  assert.throws(() => assertAcyclic(cat), /Circular/);
});
