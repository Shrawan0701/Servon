import { billTotals } from '../utils/billTotals';
// One durable commit contains both the visible state and its upload commands.
// Commands are immutable: retries always send the same body/idempotency key.
const copy = (value) => JSON.parse(JSON.stringify(value));
const uid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
const empty = () => ({ version: 1, orders: [], tables: [], menu: [], profile: null, dues: [], receipts: [], actions: [], aliases: {}, cache: {}, lastSync: null });
const itemId = (item) => String(item.id || item.menu_item_id || item.menuItemId);
const localId = (id) => String(id).startsWith('local_');

export default class POSRepository {
  constructor(adapter) {
    this.adapter = adapter;
    this.tail = Promise.resolve();
    this.listeners = new Set();
    this.state = null;
    this.scope = null;
  }

  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  notify() { for (const listener of this.listeners) { try { listener(); } catch (_) {} } }

  async run(fn, write = false) {
    const execute = async () => {
      const scope = await this.adapter.scope();
      const work = async () => {
        // Web Locks serialize tabs; re-read under that lock to avoid lost writes.
        if (!this.state || scope !== this.scope || this.adapter.shared) {
          const stored = await this.adapter.read(scope);
          this.state = stored ? { ...empty(), ...stored } : { ...empty(), ...await this.adapter.migrate(scope) };
          this.scope = scope;
          if (!stored) await this.adapter.write(scope, this.state);
        }
        const next = write ? copy(this.state) : this.state;
        const result = await fn(next);
        if (write) {
          await this.adapter.write(scope, next); // Failure propagates; UI must not claim a save.
          this.state = next;
          this.notify();
        }
        return result === undefined ? undefined : copy(result);
      };
      const retry = async () => {
        for (let attempt = 0; ; attempt++) {
          try { return await work(); }
          catch (error) {
            if (error.code !== 'POS_WRITE_CONFLICT' || attempt >= 5) throw error;
            this.state = null;
          }
        }
      };
      return this.adapter.lock ? this.adapter.lock(scope, retry) : retry();
    };
    const result = this.tail.then(execute, execute);
    this.tail = result.catch(() => {});
    return result;
  }

  init() { return this.run(() => true); }
  resolve(s, id) { let value = String(id); for (let n = 0; s.aliases[value] && n < 10; n++) value = String(s.aliases[value]); return value; }
  resolveId(id) { return this.run((s) => this.resolve(s, id)); }
  find(s, list, id) { return s[list].find((row) => String(row.id) === this.resolve(s, id)); }
  enqueue(s, action_type, table_name, record_id, data) {
    const action = { id: uid('action'), action_type, table_name, record_id: String(record_id), data: copy(data), created_at: new Date().toISOString(), status: 'pending', retry_count: 0, next_attempt_at: 0 };
    s.actions.push(action);
    return action;
  }
  pending(s, table, id) { return s.actions.some((a) => a.table_name === table && (this.resolve(s, a.record_id) === String(id) || a.data.orders?.some((o) => this.resolve(s, o.id) === String(id)))); }

  calculateOrderTotal(items = []) { return Math.round(items.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0), 0) * 100) / 100; }
  totals(s, order) {
    const subtotal = this.calculateOrderTotal(order.items);
    const discount = order.discount_type === 'percentage' ? subtotal * Number(order.discount_value || 0) / 100 : order.discount_type === 'flat' ? Math.min(subtotal, Number(order.discount_value || 0)) : 0;
    const gst = (subtotal - discount) * (Number(s.profile?.cgst_percentage || 0) + Number(s.profile?.sgst_percentage || 0)) / 100;
    return { subtotal_before_discount: subtotal, discount_amount: discount, gst_amount: gst, total_amount: Math.round((subtotal - discount + gst) * 100) / 100 };
  }

  createLocalOrder(input) {
    return this.run((s) => {
      if (!input.tableId || !input.items?.length) throw new Error('Choose a table and add at least one item.');
      const now = new Date().toISOString();
      const order = { id: uid('local_order'), table_id: this.resolve(s, input.tableId), table_number: input.tableNumber, items: copy(input.items), status: input.initialStatus || 'CONFIRMED', order_source: input.orderSource || 'staff', special_instructions: input.specialInstructions || '', created_at: now, updated_at: now, is_synced: 0 };
      Object.assign(order, this.totals(s, order));
      s.orders.unshift(order);
      this.enqueue(s, 'CREATE', 'orders', order.id, { order });
      return order;
    }, true);
  }
  getOrderById(id) { return this.run((s) => this.find(s, 'orders', id) || null); }
  getOrders(status = null, limit = 10000) { return this.run((s) => s.orders.filter((o) => !status || ['all', 'PREVIOUS'].includes(status) || o.status === status).slice(0, limit)); }
  getOrdersByDate(date, status = null) { return this.run((s) => s.orders.filter((o) => { const d = new Date(o.created_at); const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return day === date && (!status || status === 'all' || o.status === status); })); }
  getUnsyncedOrders() { return this.run((s) => s.orders.filter((o) => !o.is_synced)); }

  saveOrders(rows = []) {
    return this.run((s) => {
      const map = new Map(s.orders.map((o) => [String(o.id), o]));
      for (const row of rows) {
        const id = this.resolve(s, row.id), existing = map.get(id);
        if (existing && this.pending(s, 'orders', id)) continue;
        // Ignore an older background response that arrived after a newer save.
        if (existing && new Date(existing.updated_at) > new Date(row.updated_at)) continue;
        map.set(id, { ...existing, ...row, id, items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items || [], is_synced: 1 });
      }
      s.orders = [...map.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }, true);
  }

  appendOrderItems(id, items = []) {
    return this.run((s) => {
      const order = this.find(s, 'orders', id);
      if (!order || ['PAID', 'REJECTED'].includes(order.status)) throw new Error('This order cannot be edited.');
      for (const item of items) {
        const found = order.items.find((i) => itemId(i) === itemId(item));
        if (found) found.quantity = Number(found.quantity || 0) + Number(item.quantity || 1);
        else order.items.push(copy(item));
      }
      Object.assign(order, this.totals(s, order), { updated_at: new Date().toISOString(), is_synced: 0 });
      this.enqueue(s, 'APPEND_ITEMS', 'orders', order.id, { items });
      return order;
    }, true);
  }
  removeOrderItem(id, removeId) {
    return this.run((s) => {
      const order = this.find(s, 'orders', id);
      if (!order || ['PAID', 'REJECTED'].includes(order.status)) throw new Error('This order cannot be edited.');
      order.items = order.items.filter((item) => itemId(item) !== String(removeId));
      if (!order.items.length) order.status = 'REJECTED';
      Object.assign(order, this.totals(s, order), { updated_at: new Date().toISOString(), is_synced: 0 });
      this.enqueue(s, 'REMOVE_ITEM', 'orders', order.id, { itemId: removeId });
      return order;
    }, true);
  }
  updateOrderStatus(id, status) {
    return this.run((s) => {
      const order = this.find(s, 'orders', id);
      if (!order) throw new Error('Order not found on this device.');
      order.status = status; order.updated_at = new Date().toISOString(); order.is_synced = 0;
      this.enqueue(s, 'UPDATE', 'orders', order.id, { status });
      return order;
    }, true);
  }

  checkout(orderIds, discount = { type: 'none', value: 0 }, outstanding = null, receiptHtml = null) {
    return this.run((s) => {
      const orders = orderIds.map((id) => this.find(s, 'orders', id));
      if (!orders.length || new Set(orderIds.map((id) => this.resolve(s, id))).size !== orderIds.length) throw new Error('Choose unique orders for this bill.');
      if (orders.some((o) => !o || ['PAID', 'REJECTED'].includes(o.status))) throw new Error('This bill has already been closed. Refresh the orders.');
      const bill = billTotals(orders, discount, s.profile);
      for (let index = 0; index < orders.length; index++) {
        Object.assign(orders[index], bill.orderTotals[index], { status: 'PAID', updated_at: new Date().toISOString(), is_synced: 0 });
      }
      // One server transaction closes precisely the orders on the printed bill.
      this.enqueue(s, 'CHECKOUT', 'orders', orders[0].id, { orders: orders.map((o) => ({ id: o.id, discount_type: o.discount_type, discount_value: o.discount_value, expected_total: o.total_amount, expected_items: o.items.map((i) => ({ id: itemId(i), price: Number(i.price), quantity: Number(i.quantity) })) })) });
      if (outstanding) this.addDue(s, { ...outstanding, orderId: orders[0].id });
      if (receiptHtml) s.receipts.push({ id: uid('receipt'), orderIds: orders.map((o) => o.id), html: receiptHtml, created_at: new Date().toISOString() });
      return orders;
    }, true);
  }
  getReceipt(orderId) { return this.run((s) => [...s.receipts].reverse().find((r) => r.orderIds.some((id) => this.resolve(s, id) === this.resolve(s, orderId))) || null); }

  saveMenu(rows) { return this.run((s) => { s.menu = rows || []; }, true); }
  getMenu(params) { return this.run((s) => s.menu.filter((i) => !params || Object.entries(params).every(([key, value]) => value == null || String(i[key]) === String(value)))); }
  saveProfile(profile) { return this.run((s) => { s.profile = profile; }, true); }
  getProfile() { return this.run((s) => s.profile); }
  saveTables(rows) { return this.run((s) => { const dirty = s.tables.filter((t) => this.pending(s, 'tables', t.id)); s.tables = [...dirty, ...(rows || []).filter((t) => !this.pending(s, 'tables', t.id))].filter((t) => !s.actions.some((a) => a.table_name === 'tables' && a.action_type === 'DELETE' && this.resolve(s, a.record_id) === String(t.id))); }, true); }
  getTables() { return this.run((s) => s.tables); }
  addLocalTable(tableNumber) { return this.run((s) => { if (s.tables.some((t) => String(t.table_number) === String(tableNumber))) throw new Error('Table already exists.'); const table = { id: uid('local_table'), table_number: tableNumber, is_synced: 0 }; s.tables.push(table); this.enqueue(s, 'CREATE', 'tables', table.id, { tableNumber }); return table; }, true); }
  deleteLocalTable(id) { return this.run((s) => { id = this.resolve(s, id); s.tables = s.tables.filter((t) => String(t.id) !== id); this.enqueue(s, 'DELETE', 'tables', id, {}); }, true); }

  addDue(s, record) {
    const due = { id: uid('local_outstanding'), customer_name: record.customerName, phone_number: record.phoneNumber || null, total_amount: record.totalAmount, paid_amount: record.paidAmount || 0, remaining_amount: record.remainingAmount, order_id: record.orderId ? this.resolve(s, record.orderId) : null, created_at: new Date().toISOString(), is_synced: 0 };
    s.dues.unshift(due);
    this.enqueue(s, 'CREATE', 'customer_outstandings', due.id, { ...record, orderId: due.order_id });
    return due;
  }
  saveCustomerOutstanding(record) { return this.run((s) => this.addDue(s, record), true); }
  getCustomerOutstandings() { return this.run((s) => s.dues.filter((d) => Number(d.remaining_amount) > 0)); }
  clearCustomerOutstanding(id) { return this.run((s) => { const due = this.find(s, 'dues', id); if (!due) return; due.remaining_amount = 0; due.paid_amount = due.total_amount; due.is_synced = 0; this.enqueue(s, 'CLEAR', 'customer_outstandings', due.id, {}); }, true); }
  cacheCustomerOutstandings(rows) { return this.run((s) => { const dirty = s.dues.filter((d) => this.pending(s, 'customer_outstandings', d.id)); s.dues = [...dirty, ...(rows || []).filter((d) => !this.pending(s, 'customer_outstandings', d.id))]; }, true); }

  queueAction(type, table, id, data) { return this.run((s) => this.enqueue(s, type, table, id, data), true); }
  getPendingActions(limit = 50) { return this.run((s) => s.actions.filter((a) => a.status !== 'blocked' && Number(a.next_attempt_at || 0) <= Date.now()).slice(0, limit)); }
  getActions() { return this.run((s) => s.actions); }
  getPendingActionsCount() { return this.run((s) => s.actions.length); }
  retryFailed() { return this.run((s) => { for (const a of s.actions) { a.status = 'pending'; a.next_attempt_at = 0; } }, true); }
  updateActionStatus(id, status, error, nextAttempt = 0) { return this.run((s) => { const a = s.actions.find((a) => a.id === id); if (a) Object.assign(a, { status, error, retry_count: (a.retry_count || 0) + 1, next_attempt_at: nextAttempt }); }, true); }
  removeAction(id) { return this.acknowledge(id); }
  acknowledge(actionId, remote = null) {
    return this.run((s) => {
      const action = s.actions.find((a) => a.id === actionId);
      if (!action) return;
      const list = action.table_name === 'orders' ? 'orders' : action.table_name === 'tables' ? 'tables' : 'dues';
      const oldId = this.resolve(s, action.record_id);
      if (action.action_type === 'CREATE' && remote?.id && String(remote.id) !== oldId) {
        const newId = String(remote.id);
        s.aliases[oldId] = newId;
        const row = s[list].find((o) => String(o.id) === oldId);
        if (row) {
          s[list] = s[list].filter((other) => other === row || String(other.id) !== newId);
          row.id = newId;
        }
        for (const order of s.orders) if (String(order.table_id) === oldId) order.table_id = newId;
        for (const due of s.dues) if (String(due.order_id) === oldId) due.order_id = newId;
        // Queued payloads remain unchanged. Resolve aliases only when uploading;
        // this keeps a timed-out request's idempotency fingerprint stable.
      }
      s.actions = s.actions.filter((a) => a.id !== actionId);
      if (action.action_type === 'CHECKOUT' && remote?.orders) {
        for (const saved of remote.orders) {
          const order = this.find(s, 'orders', saved.id);
          if (order && !this.pending(s, 'orders', order.id)) Object.assign(order, saved, { is_synced: 1 });
        }
        return;
      }
      const row = this.find(s, list, action.record_id);
      if (row && !this.pending(s, action.table_name, row.id)) {
        if (remote) Object.assign(row, remote);
        row.is_synced = 1;
      }
      for (const order of s.orders) if (!this.pending(s, 'orders', order.id) && !localId(order.id)) order.is_synced = 1;
    }, true);
  }
  markAsSynced(id) { return this.run((s) => { const order = this.find(s, 'orders', id); if (order && !this.pending(s, 'orders', order.id)) order.is_synced = 1; }, true); }
  getCache(key) { return this.run((s) => s.cache[key]?.expires > Date.now() ? s.cache[key].value : null); }
  setCache(key, value, ttl = 3600) { return this.run((s) => { s.cache[key] = { value, expires: Date.now() + ttl * 1000 }; }, true); }
  clearExpiredCache() { return this.run((s) => { for (const key of Object.keys(s.cache)) if (s.cache[key].expires <= Date.now()) delete s.cache[key]; }, true); }
  clearCompletedActions() { return Promise.resolve(); }
  getLastSyncTimestamp() { return this.run((s) => s.lastSync); }
  updateLastSyncTimestamp(value) { return this.run((s) => { s.lastSync = value; }, true); }
  getStats() { return this.run((s) => ({ totalOrders: s.orders.length, pendingActions: s.actions.length, unsyncedOrders: s.orders.filter((o) => !o.is_synced).length })); }
  clearAllData() { return this.run((s) => Object.assign(s, empty()), true); }
}
