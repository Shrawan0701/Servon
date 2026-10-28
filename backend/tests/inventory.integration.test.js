const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const target = process.env.INVENTORY_TEST_DATABASE_URL;

test(
  "PostgreSQL inventory, HTTP authorization, and order lifecycle",
  { skip: !target, timeout: 120000 },
  async (t) => {
    const url = new URL(target);
    assert.ok(
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname),
      "Integration tests require a local isolated PostgreSQL database",
    );
    assert.ok(
      url.pathname.endsWith("_test"),
      "Test database name must end with _test",
    );
    const schema = `inventory_test_${crypto.randomBytes(6).toString("hex")}`;
    const { Pool } = require("pg");
    const admin = new Pool({ connectionString: target });
    await admin.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await admin.query(`CREATE SCHEMA ${schema}`);
    url.searchParams.set("options", `-c search_path=${schema},public`);
    process.env.DATABASE_URL = url.toString();
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "inventory-test-only-secret";
    const pool = require("../db");
    let server;
    try {
      await pool.query(`CREATE TABLE businesses(id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),business_name TEXT DEFAULT 'Test',subscription_status TEXT DEFAULT 'ACTIVE',subscription_end_date TIMESTAMPTZ DEFAULT NOW()+INTERVAL '1 year',trial_end_date TIMESTAMPTZ,push_token TEXT,cgst_percentage NUMERIC DEFAULT 0,sgst_percentage NUMERIC DEFAULT 0);
      CREATE TABLE tables(id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),business_id UUID REFERENCES businesses(id),table_number TEXT);
      CREATE TABLE menu_items(id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),business_id UUID REFERENCES businesses(id),name TEXT,category TEXT,menu_type TEXT DEFAULT 'food',liquor_brand_code TEXT,size_ml NUMERIC,name_mr TEXT,name_hi TEXT);
      CREATE TABLE orders(id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),business_id UUID REFERENCES businesses(id),table_id UUID REFERENCES tables(id),items JSONB NOT NULL,total_amount NUMERIC DEFAULT 0,status TEXT DEFAULT 'CONFIRMED',special_instructions TEXT,discount_type TEXT,discount_value NUMERIC,discount_amount NUMERIC,subtotal_before_discount NUMERIC,gst_amount NUMERIC,order_source TEXT,created_at TIMESTAMPTZ DEFAULT NOW(),updated_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE notifications(id SERIAL PRIMARY KEY,business_id UUID,order_id UUID,message TEXT,type TEXT);
      CREATE TABLE inventory_items(id SERIAL PRIMARY KEY,business_id UUID REFERENCES businesses(id),name TEXT,unit TEXT,current_stock NUMERIC(12,2) DEFAULT 0,low_stock_threshold NUMERIC(12,2) DEFAULT 0,bottle_size NUMERIC,created_at TIMESTAMPTZ DEFAULT NOW(),updated_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE menu_item_ingredients(id SERIAL PRIMARY KEY,business_id UUID,menu_item_id UUID REFERENCES menu_items(id),inventory_item_id INTEGER REFERENCES inventory_items(id),quantity_required NUMERIC(12,3));
      CREATE TABLE inventory_stock_logs(id SERIAL PRIMARY KEY,business_id UUID,inventory_item_id INTEGER REFERENCES inventory_items(id),change_amount NUMERIC(12,2),reason TEXT,order_id UUID REFERENCES orders(id),created_at TIMESTAMPTZ DEFAULT NOW());`);
      const business = (
        await pool.query("INSERT INTO businesses DEFAULT VALUES RETURNING id")
      ).rows[0].id;
      const other = (
        await pool.query("INSERT INTO businesses DEFAULT VALUES RETURNING id")
      ).rows[0].id;
      const table = (
        await pool.query(
          "INSERT INTO tables(business_id,table_number) VALUES($1,'1') RETURNING id",
          [business],
        )
      ).rows[0].id;
      const foreignTable = (
        await pool.query(
          "INSERT INTO tables(business_id,table_number) VALUES($1,'2') RETURNING id",
          [other],
        )
      ).rows[0].id;
      const menuIds = [];
      for (const name of [
        "Paneer bhaji",
        "Paneer masala",
        "Unconfigured",
        "Legacy dish",
      ])
        menuIds.push(
          (
            await pool.query(
              "INSERT INTO menu_items(business_id,name,category) VALUES($1,$2,'Curry') RETURNING id",
              [business, name],
            )
          ).rows[0].id,
        );
      const foreignMenu = (
        await pool.query(
          "INSERT INTO menu_items(business_id,name) VALUES($1,'Other restaurant') RETURNING id",
          [other],
        )
      ).rows[0].id;
      const tomato = (
        await pool.query(
          "INSERT INTO inventory_items(business_id,name,unit,current_stock) VALUES($1,'Tomato','kg',100) RETURNING id",
          [business],
        )
      ).rows[0].id;
      const legacy = (
        await pool.query(
          "INSERT INTO orders(business_id,items) VALUES($1,$2) RETURNING id",
          [business, JSON.stringify([{ id: menuIds[3], quantity: 1 }])],
        )
      ).rows[0].id;
      const historicalUnconfigured = (
        await pool.query(
          "INSERT INTO orders(business_id,table_id,items) VALUES($1,$2,$3) RETURNING id",
          [
            business,
            table,
            JSON.stringify([{ id: menuIds[2], quantity: 2, price: 50 }]),
          ],
        )
      ).rows[0].id;
      await pool.query(
        "INSERT INTO inventory_stock_logs(business_id,inventory_item_id,change_amount,reason,order_id) VALUES($1,$2,-1,'order_deduction',$3)",
        [business, tomato, legacy],
      );
      const migrationPath = path.join(
        __dirname,
        "../scripts/migrateInventory.js",
      );
      const first = execFileSync(process.execPath, [migrationPath], {
        cwd: path.join(__dirname, ".."),
        env: process.env,
        encoding: "utf8",
      });
      const second = execFileSync(process.execPath, [migrationPath], {
        cwd: path.join(__dirname, ".."),
        env: process.env,
        encoding: "utf8",
      });
      await t.test(
        "versioned migration preserves legacy stock and reruns safely",
        async () => {
          assert.match(first, /migration applied/);
          assert.match(second, /already applied/);
          assert.equal(
            Number(
              (
                await pool.query(
                  "SELECT current_stock FROM inventory_items WHERE id=$1",
                  [tomato],
                )
              ).rows[0].current_stock,
            ),
            100,
          );
          assert.equal(
            (
              await pool.query(
                "SELECT * FROM inventory_order_state WHERE order_id=$1",
                [legacy],
              )
            ).rowCount,
            1,
          );
        },
      );
      const express = require("express"),
        fileUpload = require("express-fileupload"),
        jwt = require("jsonwebtoken");
      const app = express();
      app.use(express.json());
      app.use(fileUpload({ limits: { fileSize: 5 * 1024 * 1024 } }));
      app.use("/api/inventory", require("../routes/inventory"));
      app.use("/api/orders", require("../routes/orders"));
      server = app.listen(0, "127.0.0.1");
      await new Promise((r) => server.once("listening", r));
      const base = `http://127.0.0.1:${server.address().port}/api`;
      const token = jwt.sign({ businessId: business }, process.env.JWT_SECRET),
        foreignToken = jwt.sign({ businessId: other }, process.env.JWT_SECRET),
        staffToken = jwt.sign(
          { businessId: business, staffId: "staff", role: "staff" },
          process.env.JWT_SECRET,
        );
      async function request(method, endpoint, body, options = {}) {
        const headers = {
          Authorization: `Bearer ${options.token || token}`,
          ...options.headers,
        };
        if (!(body instanceof FormData) && body !== undefined)
          headers["Content-Type"] = "application/json";
        const r = await fetch(base + endpoint, {
          method,
          headers,
          body:
            body === undefined
              ? undefined
              : body instanceof FormData
                ? body
                : JSON.stringify(body),
        });
        return { status: r.status, data: await r.json() };
      }
      async function add(name, unit, qty = 100) {
        const r = await request("POST", "/inventory", {
          name,
          unit,
          current_stock: qty,
        });
        assert.equal(r.status, 201, JSON.stringify(r.data));
        return r.data.id;
      }
      async function balance(id) {
        return Number(
          (
            await pool.query(
              "SELECT current_stock FROM inventory_items WHERE id=$1",
              [id],
            )
          ).rows[0].current_stock,
        );
      }
      const paneer = await add("Paneer", "kg"),
        oil = await add("Oil", "ml", 10000),
        onion = await add("Onion", "kg"),
        beer = await add("Kingfisher 650ml", "ml", 9750),
        pieces = await add("Cola", "pcs", 15);
      const foreignStock = await add("Foreign stock", "kg", 2).then(
        async (id) => {
          await pool.query(
            "UPDATE inventory_items SET business_id=$1 WHERE id=$2",
            [other, id],
          );
          return id;
        },
      );
      let preparation;
      await t.test(
        "shared preparation, unit-aware recipe and safe bulk merge",
        async () => {
          let r = await request("POST", "/inventory/preparations", {
            name: "Base gravy",
            yield_quantity: 5,
            yield_unit: "kg",
            ingredients: [
              { inventory_item_id: tomato, quantity_required: 2, unit: "kg" },
              { inventory_item_id: onion, quantity_required: 2, unit: "kg" },
              { inventory_item_id: oil, quantity_required: 300, unit: "ml" },
            ],
          });
          assert.equal(r.status, 201, JSON.stringify(r.data));
          preparation = r.data;
          r = await request("PUT", `/inventory/recipes/${menuIds[0]}`, {
            ingredients: [
              { inventory_item_id: paneer, quantity_required: 150, unit: "gm" },
              { inventory_item_id: oil, quantity_required: 10, unit: "ml" },
            ],
          });
          assert.equal(r.status, 200);
          assert.equal(
            Number(
              r.data.find((x) => x.inventory_item_id === paneer)
                .quantity_required,
            ),
            0.15,
          );
          const changes = [
            {
              menu_item_id: menuIds[0],
              ingredients: [
                {
                  preparation_id: preparation.id,
                  quantity_required: 150,
                  unit: "gm",
                },
              ],
            },
            {
              menu_item_id: menuIds[1],
              ingredients: [
                {
                  preparation_id: preparation.id,
                  quantity_required: 200,
                  unit: "gm",
                },
              ],
            },
          ];
          const preview = await request("POST", "/inventory/recipes/bulk", {
            mode: "merge",
            preview: true,
            changes,
          });
          assert.equal(preview.status, 200);
          assert.equal(preview.data.results[0].after.length, 3);
          assert.equal(
            (await request("GET", `/inventory/recipes/${menuIds[0]}`)).data
              .length,
            2,
          );
          r = await request("POST", "/inventory/recipes/bulk", {
            mode: "merge",
            preview_token: preview.data.preview_token,
            changes,
          });
          assert.equal(r.status, 200, JSON.stringify(r.data));
          assert.equal(
            (await request("GET", `/inventory/recipes/${menuIds[0]}`)).data
              .length,
            3,
          );
        },
      );
      await t.test(
        "bulk failure rolls back all dishes and stale previews are rejected",
        async () => {
          const good = {
            menu_item_id: menuIds[0],
            ingredients: [
              { inventory_item_id: tomato, quantity_required: 0.3 },
            ],
          };
          const r = await request("POST", "/inventory/recipes/bulk", {
            mode: "merge",
            changes: [
              good,
              { menu_item_id: foreignMenu, ingredients: good.ingredients },
            ],
          });
          assert.equal(r.status, 404);
          assert.ok(
            !(
              await request("GET", `/inventory/recipes/${menuIds[0]}`)
            ).data.some((x) => x.inventory_item_id === tomato),
          );
          assert.equal(
            (
              await request("POST", "/inventory/recipes/bulk", {
                changes: [good],
                preview_token: "stale",
              })
            ).status,
            409,
          );
          assert.ok(
            !(
              await request("GET", `/inventory/recipes/${menuIds[0]}`)
            ).data.some((x) => x.inventory_item_id === tomato),
          );
        },
      );
      const {
        deductInventoryForOrder,
        reverseDeductionsForOrder,
      } = require("../utils/inventoryHelper");
      let orderId;
      await t.test(
        "two servings deduct direct and expanded ingredients exactly once on confirmation retries",
        async () => {
          const items = [{ id: menuIds[0], quantity: 2, price: 100 }];
          const result = await request(
            "POST",
            "/orders/place",
            { businessId: business, tableId: table, items },
            { headers: { "Idempotency-Key": "place-once" } },
          );
          assert.equal(result.status, 201, JSON.stringify(result.data));
          orderId = result.data.id;
          assert.equal(await balance(tomato), 99.88);
          assert.equal(await balance(onion), 99.88);
          assert.equal(await balance(paneer), 99.7);
          assert.equal(await balance(oil), 9962);
          const replay = await request(
            "POST",
            "/orders/place",
            { businessId: business, tableId: table, items },
            { headers: { "Idempotency-Key": "place-once" } },
          );
          assert.equal(replay.data.id, orderId);
          assert.equal(await balance(tomato), 99.88);
          await Promise.all([
            deductInventoryForOrder(business, orderId, items),
            deductInventoryForOrder(business, orderId, items),
          ]);
          assert.equal(await balance(paneer), 99.7);
        },
      );
      await t.test(
        "append request retries and removing an item update the same ledger atomically",
        async () => {
          const body = { items: [{ id: menuIds[1], quantity: 1, price: 100 }] },
            options = { headers: { "Idempotency-Key": "append-once" } };
          let r = await request(
            "POST",
            `/orders/${orderId}/items`,
            body,
            options,
          );
          assert.equal(r.status, 200, JSON.stringify(r.data));
          assert.equal(await balance(tomato), 99.8);
          r = await request("POST", `/orders/${orderId}/items`, body, options);
          assert.equal(r.status, 200);
          assert.equal(await balance(tomato), 99.8);
          r = await request("DELETE", `/orders/${orderId}/items/${menuIds[1]}`);
          assert.equal(r.status, 200);
          assert.equal(await balance(tomato), 99.88);
        },
      );
      await t.test(
        "recipe changes do not alter cancellation refunds; repeated reject is harmless",
        async () => {
          const r = await request("PUT", `/inventory/recipes/${menuIds[0]}`, {
            ingredients: [
              { inventory_item_id: paneer, quantity_required: 0.9 },
            ],
          });
          assert.equal(r.status, 200);
          assert.equal(
            (
              await request("PATCH", `/orders/${orderId}/status`, {
                status: "REJECTED",
              })
            ).status,
            200,
          );
          assert.equal(await balance(paneer), 100);
          assert.equal(await balance(tomato), 100);
          assert.equal(await balance(oil), 10000);
          await reverseDeductionsForOrder(business, orderId);
          assert.equal(await balance(paneer), 100);
          assert.equal(
            (
              await request("PATCH", `/orders/${orderId}/status`, {
                status: "REJECTED",
              })
            ).status,
            200,
          );
          assert.equal(await balance(paneer), 100);
          assert.equal(
            (
              await request("PATCH", `/orders/${orderId}/status`, {
                status: "CONFIRMED",
              })
            ).status,
            409,
          );
        },
      );
      await t.test(
        "concurrent distinct orders keep correct balances and insufficient stock rolls back order creation",
        async () => {
          await request("PUT", `/inventory/recipes/${menuIds[1]}`, {
            ingredients: [
              {
                inventory_item_id: paneer,
                quantity_required: 0.15,
                unit: "kg",
              },
            ],
          });
          const input = {
            businessId: business,
            tableId: table,
            items: [{ id: menuIds[1], quantity: 1, price: 100 }],
          };
          const results = await Promise.all(
            Array.from({ length: 8 }, () =>
              request("POST", "/orders/place", input),
            ),
          );
          results.forEach((r) =>
            assert.equal(r.status, 201, JSON.stringify(r.data)),
          );
          assert.equal(await balance(paneer), 98.8);
          const count = Number(
            (await pool.query("SELECT COUNT(*) FROM orders")).rows[0].count,
          );
          const rejected = await request("POST", "/orders/place", {
            ...input,
            items: [{ id: menuIds[1], quantity: 1000, price: 100 }],
          });
          assert.equal(rejected.status, 400);
          assert.equal(await balance(paneer), 98.8);
          assert.equal(
            Number(
              (await pool.query("SELECT COUNT(*) FROM orders")).rows[0].count,
            ),
            count,
          );
        },
      );
      await t.test(
        "legacy orders are not rededucted and unconfigured dishes do not invent consumption",
        async () => {
          await deductInventoryForOrder(business, legacy, [
            { id: menuIds[3], quantity: 1 },
          ]);
          assert.equal(await balance(tomato), 100);
          await reverseDeductionsForOrder(business, legacy);
          await reverseDeductionsForOrder(business, legacy);
          assert.equal(await balance(tomato), 101);
          const r = await request("POST", "/orders/place", {
            businessId: business,
            tableId: table,
            items: [{ id: menuIds[2], quantity: 2, price: 50 }],
          });
          assert.equal(r.status, 201);
          assert.equal(await balance(paneer), 98.8);
        },
      );
      await t.test(
        "tenant ownership and adjustment permission are enforced for every new resource type",
        async () => {
          assert.equal(
            (await request("GET", `/inventory/recipes/${foreignMenu}`)).status,
            404,
          );
          assert.equal(
            (
              await request("PUT", `/inventory/recipes/${menuIds[0]}`, {
                ingredients: [
                  { inventory_item_id: foreignStock, quantity_required: 1 },
                ],
              })
            ).status,
            404,
          );
          assert.equal(
            (
              await request(
                "PATCH",
                `/inventory/${tomato}/restock`,
                { amount: 1 },
                { token: foreignToken },
              )
            ).status,
            404,
          );
          assert.equal(
            (
              await request(
                "PATCH",
                `/inventory/${tomato}/adjust`,
                { new_stock: 500 },
                { token: staffToken },
              )
            ).status,
            403,
          );
          assert.equal(
            (
              await request(
                "PUT",
                `/inventory/preparations/${preparation.id}`,
                preparation,
                { token: foreignToken },
              )
            ).status,
            404,
          );
          assert.equal(
            (
              await request("POST", "/orders/place", {
                businessId: business,
                tableId: foreignTable,
                items: [{ id: menuIds[0], quantity: 1 }],
              })
            ).status,
            404,
          );
          assert.equal(
            (
              await request(
                "PATCH",
                `/orders/${orderId}/status`,
                { status: "PAID" },
                { token: foreignToken },
              )
            ).status,
            404,
          );
        },
      );
      await t.test(
        "preparation circular references, duplicate ingredients and incompatible units are rejected without partial saves",
        async () => {
          const r = await request("POST", "/inventory/preparations", {
            name: "Paste",
            yield_quantity: 1,
            yield_unit: "kg",
            ingredients: [
              { preparation_id: preparation.id, quantity_required: 1 },
            ],
          });
          assert.equal(r.status, 201);
          assert.equal(
            (
              await request(
                "PUT",
                `/inventory/preparations/${preparation.id}`,
                {
                  ...preparation,
                  ingredients: [
                    { preparation_id: r.data.id, quantity_required: 1 },
                  ],
                },
              )
            ).status,
            400,
          );
          assert.equal(
            (
              await request("PUT", `/inventory/recipes/${menuIds[0]}`, {
                ingredients: [
                  {
                    inventory_item_id: tomato,
                    quantity_required: 1,
                    unit: "ml",
                  },
                ],
              })
            ).status,
            400,
          );
          assert.equal(
            (
              await request("PUT", `/inventory/recipes/${menuIds[0]}`, {
                ingredients: [
                  { inventory_item_id: tomato, quantity_required: 1 },
                  { inventory_item_id: tomato, quantity_required: 2 },
                ],
              })
            ).status,
            400,
          );
        },
      );
      let scanId;
      const vision = require("../services/inventoryVision");
      const originalDetect = vision.detect;
      let calls = 0;
      vision.detect = async () => {
        calls++;
        return [
          {
            label: "Unreadable bottle",
            count: 12,
            confidence: 0.3,
            inventory_item_id: null,
            needs_review: true,
          },
        ];
      };
      await t.test(
        "photo produces reviewable unknown detection, caches analysis, and never silently writes expected stock",
        async () => {
          const upload = () => {
            const f = new FormData();
            f.append(
              "image",
              new Blob(
                [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])],
                { type: "image/png" },
              ),
              "stock.png",
            );
            return f;
          };
          let r = await request("POST", "/inventory/scans", upload());
          assert.equal(r.status, 201, JSON.stringify(r.data));
          scanId = r.data.id;
          assert.equal(r.data.status, "review");
          assert.equal(r.data.detections[0].inventory_item_id, null);
          assert.equal(await balance(pieces), 15);
          r = await request("POST", "/inventory/scans", upload());
          assert.equal(r.status, 200);
          assert.equal(calls, 1);
          assert.equal(
            (
              await request("GET", `/inventory/scans/${scanId}`, undefined, {
                token: foreignToken,
              })
            ).status,
            404,
          );
          assert.equal(
            (
              await request("POST", `/inventory/scans/${scanId}/confirm`, {
                counts: [{ inventory_item_id: foreignStock, full_bottles: 12 }],
              })
            ).status,
            404,
          );
          assert.equal(
            (
              await request("POST", `/inventory/scans/${scanId}/confirm`, {
                counts: [
                  { inventory_item_id: pieces, full_bottles: 12 },
                  { inventory_item_id: pieces, full_bottles: 12 },
                ],
              })
            ).status,
            400,
          );
          assert.equal(
            (
              await pool.query(
                "SELECT 1 FROM inventory_physical_counts WHERE scan_id=$1",
                [scanId],
              )
            ).rowCount,
            0,
          );
          r = await request("POST", `/inventory/scans/${scanId}/confirm`, {
            counts: [
              { inventory_item_id: pieces, full_bottles: 12 },
              {
                inventory_item_id: beer,
                full_bottles: 3,
                bottle_size_ml: 650,
                opened_ml: 90,
              },
            ],
          });
          assert.equal(r.status, 200, JSON.stringify(r.data));
          assert.equal(
            r.data.counts.find((c) => c.inventory_item_id === pieces).variance,
            "-3.000000",
          );
          assert.equal(
            Number(
              r.data.counts.find((c) => c.inventory_item_id === beer)
                .physical_stock,
            ),
            2040,
          );
          assert.equal(await balance(pieces), 15);
          assert.equal(await balance(beer), 9750);
          assert.equal(
            (
              await request("POST", `/inventory/scans/${scanId}/confirm`, {
                counts: [],
              })
            ).status,
            200,
          );
        },
      );
      await t.test(
        "reconciliation preserves intervening movements, authorizes owner and applies variance only once",
        async () => {
          assert.equal(
            (
              await request("PATCH", `/inventory/${pieces}/restock`, {
                amount: 2,
              })
            ).status,
            200,
          );
          assert.equal(
            (
              await request(
                "POST",
                `/inventory/scans/${scanId}/reconcile`,
                { note: "Shelf count checked" },
                { token: staffToken },
              )
            ).status,
            403,
          );
          assert.equal(
            (
              await request(
                "POST",
                `/inventory/scans/${scanId}/reconcile`,
                { note: "Other business" },
                { token: foreignToken },
              )
            ).status,
            404,
          );
          const results = await Promise.all([
            request("POST", `/inventory/scans/${scanId}/reconcile`, {
              note: "Shelf count checked",
            }),
            request("POST", `/inventory/scans/${scanId}/reconcile`, {
              note: "Retry",
            }),
          ]);
          results.forEach((r) =>
            assert.equal(r.status, 200, JSON.stringify(r.data)),
          );
          assert.equal(await balance(pieces), 14);
          assert.equal(await balance(beer), 2040);
          assert.equal(
            (
              await pool.query(
                "SELECT * FROM inventory_stock_logs WHERE reason='scan_reconciliation'",
              )
            ).rowCount,
            2,
          );
        },
      );
      await t.test(
        "overlapping photo counts cannot apply the same shortage twice",
        async () => {
          const form = new FormData();
          form.append(
            "image",
            new Blob(
              [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 1])],
              { type: "image/png" },
            ),
            "second.png",
          );
          const r = await request("POST", "/inventory/scans", form);
          assert.equal(r.status, 201, JSON.stringify(r.data));
          const secondId = r.data.id;
          assert.equal(
            (
              await request("POST", `/inventory/scans/${secondId}/confirm`, {
                counts: [{ inventory_item_id: pieces, full_bottles: 12 }],
              })
            ).status,
            200,
          );
          assert.equal(
            (
              await request("PATCH", `/inventory/${pieces}/adjust`, {
                new_stock: 13,
                note: "Separate count checked",
              })
            ).status,
            200,
          );
          assert.equal(
            (
              await request("POST", `/inventory/scans/${secondId}/reconcile`, {
                note: "Stale count",
              })
            ).status,
            409,
          );
          assert.equal(await balance(pieces), 13);
        },
      );
      await t.test(
        "failed vision requests are recorded without fabricating results or stock changes",
        async () => {
          vision.detect = async () => {
            throw Object.assign(
              new Error("Inventory scanning is unavailable"),
              { status: 503 },
            );
          };
          const form = new FormData();
          form.append(
            "image",
            new Blob(
              [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 2])],
              { type: "image/png" },
            ),
            "failed.png",
          );
          const r = await request("POST", "/inventory/scans", form);
          assert.equal(r.status, 503);
          const scans = await request("GET", "/inventory/scans");
          assert.ok(
            scans.data.some(
              (s) => s.status === "failed" && s.detections.length === 0,
            ),
          );
          assert.equal(await balance(pieces), 13);
        },
      );
      vision.detect = originalDetect;
      await t.test(
        "historical unconfigured sales stay unchanged when recipes are added after deployment",
        async () => {
          const before = await balance(paneer);
          await request("PUT", `/inventory/recipes/${menuIds[2]}`, {
            ingredients: [{ inventory_item_id: paneer, quantity_required: 1 }],
          });
          await deductInventoryForOrder(business, historicalUnconfigured, [
            { id: menuIds[2], quantity: 2, price: 50 },
          ]);
          assert.equal(await balance(paneer), before);
          const r = await request(
            "POST",
            `/orders/${historicalUnconfigured}/items`,
            { items: [{ id: menuIds[1], quantity: 1, price: 100 }] },
          );
          assert.equal(r.status, 200, JSON.stringify(r.data));
          assert.equal(await balance(paneer), Number((before - 0.15).toFixed(6)));
          assert.equal(
            (
              await request(
                "PATCH",
                `/orders/${historicalUnconfigured}/status`,
                { status: "REJECTED" },
              )
            ).status,
            200,
          );
          assert.equal(await balance(paneer), before);
        },
      );
      await t.test(
        "liquor volume recipes use trusted menu serving sizes and refund once",
        async () => {
          const litreStock = await add("Example liquor", "litre", 2);
          const liquorMenu = (
            await pool.query(
              "INSERT INTO menu_items(business_id,name,menu_type,size_ml) VALUES($1,'Example liquor 30ml','liquor',30) RETURNING id",
              [business],
            )
          ).rows[0].id;
          const r = await request("POST", "/orders/place", {
            businessId: business,
            tableId: table,
            items: [{ id: liquorMenu, quantity: 2, price: 50, size_ml: 99999 }],
          });
          assert.equal(r.status, 201, JSON.stringify(r.data));
          assert.equal(await balance(litreStock), 1.94);
          await request("PATCH", `/orders/${r.data.id}/status`, {
            status: "REJECTED",
          });
          assert.equal(await balance(litreStock), 2);
        },
      );
      await t.test(
        "concurrent orders cannot both spend the last available piece",
        async () => {
          const limited = await add("Limited packaged drink", "pcs", 1);
          const m = (
            await pool.query(
              "INSERT INTO menu_items(business_id,name) VALUES($1,'Limited drink') RETURNING id",
              [business],
            )
          ).rows[0].id;
          await request("PUT", `/inventory/recipes/${m}`, {
            ingredients: [{ inventory_item_id: limited, quantity_required: 1 }],
          });
          const input = {
            businessId: business,
            tableId: table,
            items: [{ id: m, quantity: 1, price: 10 }],
          };
          const results = await Promise.all([
            request("POST", "/orders/place", input),
            request("POST", "/orders/place", input),
          ]);
          assert.deepEqual(results.map((r) => r.status).sort(), [201, 400]);
          assert.equal(await balance(limited), 0);
        },
      );
      await t.test(
        "existing stock workflow validates restocks, logs adjustments and preserves deleted-item audit history",
        async () => {
          assert.equal(
            (
              await request("PATCH", `/inventory/${tomato}/restock`, {
                amount: -1,
              })
            ).status,
            400,
          );
          assert.equal(
            (
              await request("PATCH", `/inventory/${tomato}/adjust`, {
                new_stock: 10,
              })
            ).status,
            200,
          );
          assert.equal(await balance(tomato), 10);
          assert.equal(
            (await request("GET", "/inventory/history")).status,
            200,
          );
          const removable = await add("Temporary stock", "pcs", 1);
          assert.equal(
            (await request("DELETE", `/inventory/${removable}`)).status,
            200,
          );
          assert.ok(
            !(await request("GET", "/inventory")).data.some(
              (i) => i.id === removable,
            ),
          );
          assert.equal(
            (
              await pool.query(
                "SELECT * FROM inventory_stock_logs WHERE inventory_item_id=$1",
                [removable],
              )
            ).rowCount,
            1,
          );
          assert.equal(
            (await request("DELETE", `/inventory/${tomato}`)).status,
            409,
          );
        },
      );
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
