import localDB from './LocalDB';
import networkMonitor from './NetworkMonitor';
import API from '../api';
import { refreshPOSData } from './refreshPOSData';

export class SyncManager {
  constructor(db = localDB, network = networkMonitor, api = API) {
    this.db = db; this.network = network; this.api = api;
    this.isSyncing = false; this.isInitialized = false;
    this.listeners = new Set(); this.syncErrors = [];
    this.lastSyncStatus = 'idle'; this.pendingActions = 0;
  }
  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.unsubscribeNetwork = this.network.subscribe((online) => { if (online) this.schedule(); });
    this.unsubscribeData = this.db.subscribe(() => {
      this.db.getPendingActionsCount().then((count) => { this.pendingActions = count; this.updateStatus(this.lastSyncStatus); if (count) this.schedule(); }).catch(() => {});
    });
    this.syncInterval = setInterval(() => this.startSync(), 15000);
    this.schedule();
  }
  schedule() {
    if (!this.isInitialized || !this.network.isOnline || this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.startSync(); }, 150);
  }
  stopPeriodicSync() {
    clearInterval(this.syncInterval); clearTimeout(this.timer);
    this.timer = null; this.unsubscribeNetwork?.(); this.unsubscribeData?.();
    this.isInitialized = false; this.controller?.abort();
  }
  setStatusCallback(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  updateStatus(status, extra = {}) { for (const fn of this.listeners) fn({ status, isSyncing: this.isSyncing, pendingActions: this.pendingActions, errors: this.syncErrors.slice(-5), ...extra }); }
  async startSync({ retry = false } = {}) {
    if (this.isSyncing || !this.network.isOnline) return;
    this.isSyncing = true; this.updateStatus('syncing');
    try {
      if (retry) await this.db.retryFailed();
      const uploaded = await this.uploadPendingActions();
      this.pendingActions = await this.db.getPendingActionsCount();
      this.lastSyncStatus = this.pendingActions ? 'pending' : 'success';
      if (uploaded && !this.pendingActions) await this.db.updateLastSyncTimestamp(new Date().toISOString());
      this.updateStatus(this.lastSyncStatus, { uploaded });
      refreshPOSData(['orders', 'dues']).catch(() => {});
    } catch (error) {
      this.lastSyncStatus = error.response?.status === 401 ? 'auth_required' : 'error';
      this.updateStatus(this.lastSyncStatus);
    } finally {
      this.isSyncing = false; this.updateStatus(this.lastSyncStatus);
    }
  }
  async uploadPendingActions() {
    let uploaded = 0;
    const scope = await this.db.run(() => this.db.scope);
    // Re-read after each acknowledgement so dependent IDs are always current.
    for (let n = 0; n < 100 && this.network.isOnline; n++) {
      const actions = await this.db.getActions();
      const aliases = await this.db.run((s) => s.aliases);
      const resolve = (id) => { let value = String(id); for (let n = 0; aliases[value] && n < 10; n++) value = String(aliases[value]); return value; };
      // A conflict must hold its dependent edits, not unrelated sales.
      const held = new Set();
      let action;
      for (const candidate of actions) {
        const own = candidate.action_type === 'CHECKOUT'
          ? candidate.data.orders.map((o) => `orders:${resolve(o.id)}`)
          : [`${candidate.table_name}:${resolve(candidate.record_id)}`];
        const dependencies = [...own];
        if (candidate.action_type === 'CREATE' && candidate.table_name === 'orders') dependencies.push(`tables:${resolve(candidate.data.order.table_id || candidate.data.order.tableId)}`);
        if (candidate.table_name === 'customer_outstandings' && candidate.data.orderId) dependencies.push(`orders:${resolve(candidate.data.orderId)}`);
        if (candidate.status === 'blocked' || Number(candidate.next_attempt_at || 0) > Date.now() || dependencies.some((key) => held.has(key))) {
          own.forEach((key) => held.add(key));
          continue;
        }
        action = candidate; break;
      }
      if (!action) break;
      try {
        if (await this.db.run(() => this.db.scope) !== scope) break;
        const response = await this.send(action, scope);
        if (await this.db.run(() => this.db.scope) !== scope) break;
        await this.db.acknowledge(action.id, response?.data);
        uploaded++;
      } catch (error) {
        if (await this.db.run(() => this.db.scope) !== scope) break;
        const code = error.response?.status;
        const message = error.response?.data?.error || error.message || 'Unable to upload saved changes';
        const stockUnavailable = code === 400 && /stock|inventory/i.test(message);
        const blocked = code && code < 500 && ![401, 408, 429].includes(code) && !stockUnavailable;
        this.syncErrors.push({ actionId: action.id, message, blocked: !!blocked });
        this.syncErrors = this.syncErrors.slice(-20);
        const delay = Math.min(60000, 1000 * 2 ** Math.min(6, action.retry_count || 0));
        await this.db.updateActionStatus(action.id, code === 401 ? 'auth_required' : blocked ? 'blocked' : 'pending', code === 401 ? 'Sign in again to upload saved changes. Your local work is kept.' : message, Date.now() + delay);
        if (code === 401) throw error;
        if (blocked) continue;
        break;
      }
    }
    return uploaded;
  }
  async send(action, scope) {
    const id = await this.db.resolveId(action.record_id);
    const data = action.data;
    let method, url, body;
    const key = action.legacy && action.action_type === 'CREATE' && action.table_name === 'orders' ? `sync-create-${action.record_id}` : `pos-${action.id}`;
    if (action.table_name === 'orders') {
      if (action.action_type === 'CREATE') {
        const order = data.order;
        method = 'post'; url = '/orders/place';
        body = { businessId: scope, tableId: await this.db.resolveId(order.table_id || order.tableId), items: order.items, totalAmount: order.total_amount, orderSource: order.order_source || 'staff', initialStatus: order.status || 'CONFIRMED' };
        if (!action.legacy) Object.assign(body, { clientCreatedAt: order.created_at, specialInstructions: order.special_instructions || '' });
      } else if (action.action_type === 'APPEND_ITEMS') { method = 'post'; url = `/orders/${id}/items`; body = { items: data.items }; }
      else if (action.action_type === 'REMOVE_ITEM') { method = 'delete'; url = `/orders/${id}/items/${data.itemId}`; }
      else if (action.action_type === 'UPDATE') { method = 'patch'; url = `/orders/${id}/status`; body = { status: data.status }; }
      else if (action.action_type === 'CHECKOUT') {
        method = 'post'; url = '/orders/checkout';
        body = { orders: await Promise.all(data.orders.map(async (o) => ({ ...o, id: await this.db.resolveId(o.id) }))) };
      }
    } else if (action.table_name === 'customer_outstandings') {
      if (action.action_type === 'CREATE') { method = 'post'; url = '/orders/outstanding'; body = { ...data, orderId: data.orderId ? await this.db.resolveId(data.orderId) : null }; }
      else if (action.action_type === 'CLEAR') { method = 'delete'; url = `/orders/outstanding/${id}`; }
    } else if (action.table_name === 'tables') {
      if (action.action_type === 'CREATE') { method = 'post'; url = '/tables'; body = { tableNumber: data.tableNumber }; }
      else if (action.action_type === 'DELETE') { method = 'delete'; url = `/tables/${id}`; }
    }
    if (!url) throw Object.assign(new Error('Unsupported saved action. Please contact support.'), { response: { status: 422 } });
    this.controller = new AbortController();
    return this.api.request({ method, url, data: body, timeout: 8000, signal: this.controller.signal, posBusinessId: scope, headers: { 'Idempotency-Key': key } });
  }
  async getSyncStatus() { return { status: this.lastSyncStatus, isSyncing: this.isSyncing, pendingActions: await this.db.getPendingActionsCount(), unsyncedOrders: (await this.db.getUnsyncedOrders()).length, lastSyncTime: await this.db.getLastSyncTimestamp(), isOnline: this.network.isOnline, errors: this.syncErrors.slice(-5) }; }
  getPendingCount() { return this.db.getPendingActionsCount(); }
}
export default new SyncManager();
