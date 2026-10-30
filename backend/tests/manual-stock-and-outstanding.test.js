const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Run the actual route handlers with a database double, without connecting to
// the developer's database or requiring production credentials.
function loadRoutes(file, db) {
  const routes = new Map();
  const owner = () => {};
  const auth = () => {};
  const router = { use() {} };
  for (const method of ["get", "post", "put", "patch", "delete"])
    router[method] = (url, ...handlers) => routes.set(`${method} ${url}`, handlers);
  const filename = path.join(__dirname, "../routes", file);
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    require(name) {
      if (name === "express") return { Router: () => router };
      if (name === "../db") return db;
      if (name === "../middleware/auth") return auth;
      if (name === "../middleware/inventoryOwner") return owner;
      if (name === "../middleware/orderTransaction") return (handler) => handler;
      if (name === "../services/inventoryTransaction")
        return { transaction: async (_businessId, fn) => fn(db) };
      if (name === "../services/inventoryUnits") return require(name);
      if (name.startsWith("node:")) return require(name);
      return {};
    },
    module: { exports: {} },
    console: { warn() {}, error() {} },
    process: { env: {} },
  }, { filename });
  return { routes, owner, auth };
}

async function call(handler, body, businessId = "business-a") {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; return this; },
  };
  await handler({ body, businessId, params: { id: 7 }, method: "PATCH" }, res);
  return res;
}

test("manual reduction subtracts from current stock, logs the change and rejects invalid or excess amounts", async () => {
  let balance = 4320;
  let itemAvailable = true;
  const logs = [];
  const db = { async query(sql, args) {
    if (sql.startsWith("SELECT")) {
      assert.match(sql, /business_id=\$2 AND NOT archived FOR UPDATE/);
      assert.equal(args[1], "business-a");
      return { rowCount: itemAvailable ? 1 : 0, rows: [{ id: 7, unit: "ml", current_stock: balance }] };
    }
    if (sql.startsWith("UPDATE")) {
      balance -= args[0];
      return { rows: [{ id: 7, unit: "ml", current_stock: balance }] };
    }
    logs.push(args);
    return { rows: [] };
  } };
  const { routes, owner } = loadRoutes("inventory.js", db);
  const handlers = routes.get("patch /:id/reduce");
  assert.equal(handlers[0], owner);
  const handler = handlers.at(-1);
  const reduced = await call(handler, { amount: 2 * 180 });
  assert.equal(reduced.statusCode, 200);
  assert.equal(reduced.data.current_stock, 3960);
  assert.equal(logs[0][2], -360);
  assert.equal(logs[0][3], "manual_adjustment");
  for (const amount of [0, -1, "bad", Infinity, 0.0000001, 4000]) {
    assert.equal((await call(handler, { amount })).statusCode, 400);
    assert.equal(balance, 3960);
    assert.equal(logs.length, 1);
  }
  assert.equal((await call(handler, { amount: 3960 })).statusCode, 200);
  assert.equal(balance, 0);
  itemAvailable = false;
  assert.equal((await call(handler, { amount: 1 })).statusCode, 404);
});

test("outstanding accepts an omitted phone, stores NULL, and still rejects invalid provided numbers", async () => {
  const saved = [];
  const db = { async query(_sql, args) {
    saved.push(args);
    return { rows: [{ phone_number: args[3] }] };
  } };
  const { routes, auth } = loadRoutes("orders.js", db);
  const handlers = routes.get("post /outstanding");
  assert.equal(handlers[0], auth);
  const handler = handlers.at(-1);
  const body = { customerName: "Customer", totalAmount: "25.00", paidAmount: "10.00", remainingAmount: "15.00" };
  for (const phoneNumber of [undefined, "", "   "]) {
    assert.equal((await call(handler, { ...body, phoneNumber })).statusCode, 201);
    assert.equal(saved.at(-1)[3], null);
  }
  assert.equal((await call(handler, { ...body, phoneNumber: "9876543210" })).statusCode, 201);
  assert.equal(saved.at(-1)[3], "9876543210");
  for (const phoneNumber of ["123", "12345678901", "abcdefghij"])
    assert.equal((await call(handler, { ...body, phoneNumber })).statusCode, 400);
  assert.equal((await call(handler, { ...body, customerName: "" })).statusCode, 400);
  assert.equal((await call(handler, { ...body, paidAmount: "30.00" })).statusCode, 400);
  assert.equal(saved.length, 4);
});
