const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');

function moduleFrom(file, imports = {}) {
  const { code } = babel.transformSync(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), {
    configFile: false, babelrc: false, plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  });
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => {
    if (!(name in imports)) throw new Error(`Unexpected import ${name}`);
    return imports[name];
  }, console, setTimeout, clearTimeout, setInterval, clearInterval, AbortController });
  return exports;
}
const totalsModule = moduleFrom('utils/billTotals.js');
const Repository = moduleFrom('services/POSRepository.js', { '../utils/billTotals': totalsModule }).default;
const migrateLegacy = moduleFrom('services/migrateLegacyPOS.js').default;
const clone = (value) => JSON.parse(JSON.stringify(value));
function storage() {
  const snapshots = {};
  return {
    account: 'business-1', fail: false,
    async scope() { return this.account; },
    async read(scope) { return snapshots[scope] ? clone(snapshots[scope]) : null; },
    async write(scope, state) { if (this.fail) throw new Error('Storage full'); snapshots[scope] = clone(state); },
    async migrate() { return {}; },
  };
}
function worker(db, api) {
  const { SyncManager } = moduleFrom('services/SyncManager.js', {
    './LocalDB': { __esModule: true, default: db }, './NetworkMonitor': { __esModule: true, default: { isOnline: true } },
    '../api': { __esModule: true, default: api }, './refreshPOSData': { refreshPOSData: async () => {} },
  });
  return new SyncManager(db, { isOnline: true }, api);
}
const item = { id: 'beer', name: 'Bottle', price: 100, quantity: 1 };
const orderInput = { tableId: 'table-1', tableNumber: '1', items: [item] };

test('concurrent local sales and queue writes survive reopening with no lost orders', async () => {
  const adapter = storage(), db = new Repository(adapter);
  const orders = await Promise.all(Array.from({ length: 30 }, () => db.createLocalOrder(orderInput)));
  assert.equal(new Set(orders.map((o) => o.id)).size, 30);
  const reopened = new Repository(adapter);
  assert.equal((await reopened.getOrders()).length, 30);
  assert.equal(await reopened.getPendingActionsCount(), 30);
});

test('a failed durable write rejects the save and leaves neither a partial sale nor a partial queue entry', async () => {
  const adapter = storage(), db = new Repository(adapter);
  await db.init(); adapter.fail = true;
  await assert.rejects(db.createLocalOrder(orderInput), /Storage full/);
  adapter.fail = false;
  assert.equal((await db.getOrders()).length, 0);
  assert.equal(await db.getPendingActionsCount(), 0);
  const order = await db.createLocalOrder(orderInput);
  adapter.fail = true;
  await assert.rejects(db.appendOrderItems(order.id, [item]), /Storage full/);
  adapter.fail = false;
  assert.equal((await db.getOrderById(order.id)).items[0].quantity, 1);
});

test('account caches and pending changes stay separated', async () => {
  const adapter = storage(), db = new Repository(adapter);
  await db.createLocalOrder(orderInput);
  adapter.account = 'business-2';
  assert.equal((await db.getOrders()).length, 0);
  assert.equal(await db.getPendingActionsCount(), 0);
  adapter.account = 'business-1';
  assert.equal((await db.getOrders()).length, 1);
  assert.equal(await db.getPendingActionsCount(), 1);
});

test('stale server downloads cannot undo edits, cancellation, a paid bill or cleared dues', async () => {
  const db = new Repository(storage());
  const remote = { id: 'order-1', table_id: 'table-1', table_number: '1', items: [item], status: 'CONFIRMED', total_amount: 100, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  await db.saveOrders([remote]);
  await db.appendOrderItems(remote.id, [item]);
  await db.saveOrders([remote]);
  assert.equal((await db.getOrderById(remote.id)).items[0].quantity, 2);
  await db.updateOrderStatus(remote.id, 'REJECTED');
  await db.saveOrders([remote]);
  assert.equal((await db.getOrderById(remote.id)).status, 'REJECTED');
  await db.cacheCustomerOutstandings([{ id: 'due-1', remaining_amount: 100, total_amount: 100 }]);
  await db.clearCustomerOutstanding('due-1');
  await db.cacheCustomerOutstandings([{ id: 'due-1', remaining_amount: 100, total_amount: 100 }]);
  assert.equal((await db.getCustomerOutstandings()).length, 0);
});

test('a full offline table, order, item edit, checkout and outstanding chain uploads in dependency order', async () => {
  const db = new Repository(storage());
  const table = await db.addLocalTable('9');
  const order = await db.createLocalOrder({ ...orderInput, tableId: table.id, tableNumber: '9' });
  await db.appendOrderItems(order.id, [{ ...item, id: 'food', price: 50 }]);
  await db.removeOrderItem(order.id, item.id);
  await db.checkout([order.id], { type: 'percentage', value: 10 }, { customerName: 'Customer', phoneNumber: '', totalAmount: '45.00', paidAmount: '10.00', remainingAmount: '35.00' });
  const due = (await db.getCustomerOutstandings())[0];
  await db.clearCustomerOutstanding(due.id);
  const requests = [];
  const api = { async request(config) {
    requests.push(clone({ url: config.url, method: config.method, data: config.data }));
    if (config.url === '/tables') return { data: { id: 'table-server', table_number: '9' } };
    if (config.url === '/orders/place') { assert.equal(config.data.tableId, 'table-server'); return { data: { id: 'order-server' } }; }
    if (config.url.includes('/items')) { assert.match(config.url, /order-server/); return { data: {} }; }
    if (config.url === '/orders/checkout') { assert.equal(config.data.orders[0].id, 'order-server'); return { data: { orders: [] } }; }
    if (config.url === '/orders/outstanding') { assert.equal(config.data.orderId, 'order-server'); return { data: { id: 'due-server' } }; }
    assert.equal(config.url, '/orders/outstanding/due-server');
    return { data: { success: true } };
  } };
  assert.equal(await worker(db, api).uploadPendingActions(), 7);
  assert.equal(await db.getPendingActionsCount(), 0);
  assert.equal((await db.getOrderById(order.id)).id, 'order-server');
  assert.equal((await db.getOrderById(order.id)).items.length, 1);
  assert.equal((await db.getOrderById(order.id)).status, 'PAID');
  assert.equal((await db.getCustomerOutstandings()).length, 0);
  assert.equal(requests.length, 7);
});

test('a timeout after the server commits retries the identical request and never duplicates the sale', async () => {
  const db = new Repository(storage());
  const order = await db.createLocalOrder(orderInput);
  const seen = new Map(); let calls = 0, sales = 0;
  const api = { async request(config) {
    calls++;
    const key = config.headers['Idempotency-Key'];
    const body = JSON.stringify(config.data);
    if (!seen.has(key)) { seen.set(key, body); sales++; throw new Error('Connection lost after commit'); }
    assert.equal(seen.get(key), body);
    return { data: { id: 'saved-order' } };
  } };
  const sync = worker(db, api);
  assert.equal(await sync.uploadPendingActions(), 0);
  assert.equal(await db.getPendingActionsCount(), 1);
  // Edit while the timed-out CREATE waits: its original payload cannot change.
  await db.appendOrderItems(order.id, [{ ...item, quantity: 2 }]);
  await db.retryFailed();
  api.request = new Proxy(api.request, { apply(target, self, [config]) {
    if (config.url.includes('/items')) return Promise.resolve({ data: {} });
    return Reflect.apply(target, self, [config]);
  } });
  assert.equal(await sync.uploadPendingActions(), 2);
  assert.equal(sales, 1); assert.equal(calls, 2);
  assert.equal((await db.getOrderById(order.id)).items[0].quantity, 3);
});

test('editing during an in-flight upload preserves newer edits and remaps subsequent queued actions', async () => {
  const db = new Repository(storage());
  const order = await db.createLocalOrder(orderInput);
  let release, entered;
  const started = new Promise((resolve) => { entered = resolve; });
  const response = new Promise((resolve) => { release = resolve; });
  const api = { async request(config) {
    if (config.url === '/orders/place') { entered(); return response; }
    assert.equal(config.url, '/orders/server-id/items');
    return { data: { id: 'server-id', items: [{ ...item, quantity: 3 }], status: 'CONFIRMED' } };
  } };
  const task = worker(db, api).uploadPendingActions();
  await started;
  await db.appendOrderItems(order.id, [{ ...item, quantity: 2 }]);
  // A socket can announce the server order before its HTTP response arrives.
  await db.saveOrders([{ id: 'server-id', items: [item], status: 'CONFIRMED' }]);
  release({ data: { id: 'server-id', items: [item], status: 'CONFIRMED' } });
  assert.equal(await task, 2);
  assert.equal((await db.getOrders()).length, 1);
  assert.equal((await db.getOrderById(order.id)).items[0].quantity, 3);
});

test('permanent sync errors remain recorded and prevent dependent commands from uploading', async () => {
  const db = new Repository(storage());
  const order = await db.createLocalOrder(orderInput);
  await db.appendOrderItems(order.id, [item]);
  let calls = 0;
  const sync = worker(db, { async request() { calls++; throw { response: { status: 409, data: { error: 'Order changed on another device' } } }; } });
  assert.equal(await sync.uploadPendingActions(), 0);
  assert.equal((await db.getActions())[0].status, 'blocked');
  assert.equal(await db.getPendingActionsCount(), 2);
  await sync.uploadPendingActions();
  assert.equal(calls, 1);
  assert.equal((await db.getOrderById(order.id)).items[0].quantity, 2);
});

test('checkout saves all paid states and outstanding dues in one commit and protects every order on the bill', async () => {
  const adapter = storage(), db = new Repository(adapter);
  const now = new Date().toISOString();
  const rows = ['one', 'two'].map((id) => ({ id, table_number: '1', items: [item], status: 'CONFIRMED', total_amount: 100, created_at: now, updated_at: now }));
  await db.saveOrders(rows);
  adapter.fail = true;
  await assert.rejects(db.checkout(['one', 'two'], { type: 'none', value: 0 }, { customerName: 'A', totalAmount: 200, remainingAmount: 200 }), /Storage full/);
  adapter.fail = false;
  assert.equal((await db.getOrderById('one')).status, 'CONFIRMED');
  assert.equal((await db.getCustomerOutstandings()).length, 0);
  await db.checkout(['one', 'two'], { type: 'percentage', value: 10 });
  await db.saveOrders(rows);
  assert.equal((await db.getOrderById('two')).status, 'PAID');
  assert.equal((await db.getOrderById('two')).total_amount, 90);
  await assert.rejects(db.checkout(['one', 'two']), /already been closed/);
});

test('legacy data migration preserves failed work, fixes table dependencies and queues final paid status', () => {
  const order = { id: 'local_order_1', status: 'PAID', items: [item], table_id: 'local_table_1' };
  const migrated = migrateLegacy({ orders: [order], actions: [
    { id: 'a', table_name: 'orders', action_type: 'CREATE', record_id: order.id, data: { order }, status: 'failed', created_at: '2026-10-31' },
    { id: 'b', table_name: 'tables', action_type: 'CREATE', record_id: 'local_table_1', data: { tableNumber: '1' }, created_at: '2026-10-31' },
  ] });
  assert.equal(migrated.actions[0].table_name, 'tables');
  assert.ok(migrated.actions.every((a) => a.status === 'pending'));
  assert.equal(migrated.actions.at(-1).data.status, 'PAID');
});

test('a slow upload does not block new sales or browsing cached data', async () => {
  const db = new Repository(storage());
  await db.saveMenu([item]);
  await db.createLocalOrder(orderInput);
  let release, started;
  const entered = new Promise((r) => { started = r; });
  const response = new Promise((r) => { release = r; });
  let requests = 0;
  const sync = worker(db, { async request() { if (++requests === 1) { started(); return response; } return { data: { id: 'server-order-2' } }; } });
  const uploading = sync.uploadPendingActions();
  await entered;
  const sale = await Promise.race([db.createLocalOrder(orderInput), new Promise((_, reject) => setTimeout(() => reject(new Error('Local save waited on network')), 1000))]);
  assert.ok(sale.id);
  assert.equal((await db.getMenu()).length, 1);
  release({ data: { id: 'server-order' } });
  await uploading;
});

test('saved receipts survive reloading and order-ID replacement', async () => {
  const adapter = storage(), db = new Repository(adapter);
  const order = await db.createLocalOrder(orderInput);
  await db.checkout([order.id], { type: 'flat', value: 5 }, null, '<html>Original bill: 95.00</html>');
  const create = (await db.getActions())[0];
  await db.acknowledge(create.id, { id: 'receipt-server-order' });
  const reopened = new Repository(adapter);
  assert.equal((await reopened.getReceipt('receipt-server-order')).html, '<html>Original bill: 95.00</html>');
  assert.equal((await reopened.getReceipt(order.id)).html, '<html>Original bill: 95.00</html>');
});

test('compare-and-swap retries prevent two storage clients from losing a sale', async () => {
  const saved = {};
  const adapter = {
    shared: true,
    scope: async () => 'one-business',
    read: async (scope) => saved[scope] ? clone(saved[scope]) : null,
    migrate: async () => ({}),
    async write(scope, state) {
      await new Promise((r) => setTimeout(r, 1));
      if (Number(saved[scope]?.storage_revision || 0) !== Number(state.storage_revision || 0))
        throw Object.assign(new Error('Concurrent write'), { code: 'POS_WRITE_CONFLICT' });
      state.storage_revision = Number(state.storage_revision || 0) + 1;
      saved[scope] = clone(state);
    },
  };
  const first = new Repository(adapter), second = new Repository(adapter);
  await Promise.all([first.createLocalOrder(orderInput), second.createLocalOrder(orderInput)]);
  assert.equal((await first.getOrders()).length, 2);
  assert.equal(await second.getPendingActionsCount(), 2);
});

test('bill preview, persisted totals and per-order discounts agree with GST and rounding', () => {
  const result = totalsModule.billTotals([
    { id: 'one', items: [{ price: 100, quantity: 1 }] },
    { id: 'two', items: [{ price: 50, quantity: 1 }] },
  ], { type: 'flat', value: 15 }, { cgst_percentage: 2.5, sgst_percentage: 2.5 });
  assert.equal(result.subtotal, 150);
  assert.equal(result.discountAmount, 15);
  assert.equal(result.orderTotals[0].discount_value, 10);
  assert.equal(result.orderTotals[1].discount_value, 5);
  assert.equal(result.grandTotal, 141.75);
});

test('a conflicted order holds its edits while unrelated sales continue syncing', async () => {
  const db = new Repository(storage());
  const first = await db.createLocalOrder(orderInput);
  await db.appendOrderItems(first.id, [item]);
  const second = await db.createLocalOrder({ ...orderInput, tableId: 'table-2', tableNumber: '2' });
  const sync = worker(db, { async request(config) {
    if (config.data.tableId === 'table-1') throw { response: { status: 409, data: { error: 'Order conflict' } } };
    assert.equal(config.data.tableId, 'table-2');
    return { data: { id: 'second-saved' } };
  } });
  assert.equal(await sync.uploadPendingActions(), 1);
  assert.equal(await db.getPendingActionsCount(), 2);
  assert.equal((await db.getActions())[0].status, 'blocked');
  assert.equal((await db.getOrderById(second.id)).id, 'second-saved');
});

test('stock shortages stay retryable so replenishment can unblock a saved order', async () => {
  const db = new Repository(storage());
  await db.createLocalOrder(orderInput);
  let available = false;
  const sync = worker(db, { async request() {
    if (!available) throw { response: { status: 400, data: { error: 'Insufficient stock' } } };
    return { data: { id: 'replenished-order' } };
  } });
  await sync.uploadPendingActions();
  assert.equal((await db.getActions())[0].status, 'pending');
  available = true;
  await db.retryFailed();
  assert.equal(await sync.uploadPendingActions(), 1);
  assert.equal(await db.getPendingActionsCount(), 0);
});
