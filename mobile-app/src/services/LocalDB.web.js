import AsyncStorage from '@react-native-async-storage/async-storage';

class LocalDB {
    constructor() {
        this.initialized = false;
        this.isWeb = true;
    }

    async init() {
        if (this.initialized) return;
        console.log('📦 Using AsyncStorage for web');
        this.initialized = true;
    }

    // ===== WEB: AsyncStorage Helpers =====

    async getData(key) {
        try {
            const data = await AsyncStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('AsyncStorage read error:', error);
            return null;
        }
    }

    async setData(key, value) {
        try {
            await AsyncStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('AsyncStorage write error:', error);
        }
    }

    // ===== ORDER OPERATIONS =====

    async saveOrders(orders) {
        if (!orders || orders.length === 0) return;

        try {
            const existing = await this.getData('orders') || [];
            const byId = new Map(existing.map((order) => [String(order.id), order]));
            (orders || []).forEach((order) => byId.set(String(order.id), order));
            await this.setData('orders', Array.from(byId.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
        } catch (error) {
            console.error('Save orders error:', error);
        }
    }

    async getOrderById(orderId) {
        const allOrders = await this.getData('orders') || [];
        return allOrders.find(o => String(o.id) === String(orderId)) || null;
    }

    calculateOrderTotal(items = []) {
        return items.reduce((sum, item) => sum + (Number(item.price || 0) * (Number(item.quantity || 0))), 0);
    }

    async createLocalOrder({ tableId, tableNumber, items, totalAmount, orderSource = 'staff', initialStatus = 'CONFIRMED', specialInstructions = '' }) {
        const now = new Date().toISOString();
        const order = {
            id: `local_order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            table_id: tableId || null,
            table_number: tableNumber,
            items: items || [],
            total_amount: totalAmount ?? this.calculateOrderTotal(items || []),
            status: initialStatus,
            order_source: orderSource,
            special_instructions: specialInstructions || '',
            created_at: now,
            updated_at: now,
            is_synced: 0,
        };
        const allOrders = await this.getData('orders') || [];
        await this.setData('orders', [order, ...allOrders]);
        await this.queueAction('CREATE', 'orders', order.id, { order }, 0);
        return order;
    }

    async appendOrderItems(orderId, items = []) {
        const allOrders = await this.getData('orders') || [];
        let updatedOrder = null;
        const updated = allOrders.map((order) => {
            if (String(order.id) !== String(orderId)) return order;
            const merged = [...(order.items || [])];
            items.forEach((item) => {
                const found = merged.find((existing) => String(existing.id || existing.menu_item_id || existing.menuItemId) === String(item.id || item.menu_item_id || item.menuItemId));
                if (found) found.quantity = (Number(found.quantity || 0) + Number(item.quantity || 1));
                else merged.push({ ...item, quantity: Number(item.quantity || 1) });
            });
            updatedOrder = { ...order, items: merged, total_amount: this.calculateOrderTotal(merged), updated_at: new Date().toISOString(), is_synced: 0 };
            return updatedOrder;
        });
        await this.setData('orders', updated);
        if (updatedOrder && !String(orderId).startsWith('local_order_')) {
            await this.queueAction('APPEND_ITEMS', 'orders', orderId, { items }, 1);
        }
        return updatedOrder;
    }

    async removeOrderItem(orderId, itemId) {
        const allOrders = await this.getData('orders') || [];
        let updatedOrder = null;
        const updated = allOrders.map((order) => {
            if (String(order.id) !== String(orderId)) return order;
            const remaining = (order.items || []).filter((item) => String(item.id || item.menu_item_id || item.menuItemId) !== String(itemId));
            updatedOrder = {
                ...order,
                items: remaining,
                total_amount: this.calculateOrderTotal(remaining),
                status: remaining.length === 0 ? 'REJECTED' : order.status,
                updated_at: new Date().toISOString(),
                is_synced: 0,
            };
            return updatedOrder;
        });
        await this.setData('orders', updated);
        if (updatedOrder && !String(orderId).startsWith('local_order_')) {
            await this.queueAction('REMOVE_ITEM', 'orders', orderId, { itemId }, 1);
        }
        return updatedOrder;
    }

    async getOrders(status = null, limit = 100) {
        try {
            const allOrders = await this.getData('orders') || [];
            let filtered = allOrders;
            if (status && status !== 'all' && status !== 'PREVIOUS') {
                filtered = allOrders.filter(o => o.status === status);
            }
            return filtered.slice(0, limit);
        } catch (error) {
            console.error('Get orders error:', error);
            return [];
        }
    }

    async getOrdersByDate(date, status = null) {
        try {
            const allOrders = await this.getData('orders') || [];
            let filtered = allOrders.filter(o => {
                const orderDate = new Date(o.created_at).toISOString().split('T')[0];
                return orderDate === date;
            });
            if (status && status !== 'all' && status !== 'PREVIOUS') {
                filtered = filtered.filter(o => o.status === status);
            }
            return filtered;
        } catch (error) {
            console.error('Get orders by date error:', error);
            return [];
        }
    }

    async getUnsyncedOrders() {
        try {
            const allOrders = await this.getData('orders') || [];
            return allOrders.filter(o => o.is_synced === 0);
        } catch (error) {
            console.error('Get unsynced orders error:', error);
            return [];
        }
    }

    async updateOrderStatus(orderId, status) {
        try {
            const allOrders = await this.getData('orders') || [];
            const updated = allOrders.map(o => 
                o.id === orderId ? { ...o, status, updated_at: new Date().toISOString(), is_synced: 0 } : o
            );
            await this.setData('orders', updated);
            await this.queueAction('UPDATE', 'orders', orderId, { status });
        } catch (error) {
            console.error('Update order status error:', error);
        }
    }

    async markAsSynced(orderId) {
        try {
            const allOrders = await this.getData('orders') || [];
            const updated = allOrders.map(o => 
                o.id === orderId ? { ...o, is_synced: 1 } : o
            );
            await this.setData('orders', updated);
        } catch (error) {
            console.error('Mark as synced error:', error);
        }
    }

    async replaceLocalOrderId(localId, serverOrder) {
        const allOrders = await this.getData('orders') || [];
        const updated = allOrders.map(o => String(o.id) === String(localId) ? { ...serverOrder, is_synced: 1 } : o);
        await this.setData('orders', updated);
        await this.replaceQueuedRecordId(localId, serverOrder.id);
    }

    async deleteOrder(orderId) {
        try {
            const allOrders = await this.getData('orders') || [];
            const filtered = allOrders.filter(o => o.id !== orderId);
            await this.setData('orders', filtered);
            await this.queueAction('DELETE', 'orders', orderId, { id: orderId });
        } catch (error) {
            console.error('Delete order error:', error);
        }
    }

    // ===== OFFLINE ACTIONS QUEUE =====

    async queueAction(actionType, tableName, recordId, data, priority = 1) {
        const id = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const action = {
            id,
            action_type: actionType,
            table_name: tableName,
            record_id: recordId,
            data: data,
            priority,
            created_at: new Date().toISOString(),
            status: 'pending',
            retry_count: 0
        };

        try {
            const actions = await this.getData('offline_actions') || [];
            actions.push(action);
            await this.setData('offline_actions', actions);
            console.log(`📝 Queued action: ${actionType} on ${tableName}`);
        } catch (error) {
            console.error('Queue action error:', error);
        }
    }

    async replaceQueuedRecordId(oldId, newId) {
        const actions = await this.getData('offline_actions') || [];
        const updated = actions.map((action) => {
            if (String(action.record_id) !== String(oldId)) return action;
            return { ...action, record_id: newId, data: { ...action.data, orderId: newId } };
        });
        await this.setData('offline_actions', updated);
    }

    async getPendingActions(limit = 50) {
        try {
            const actions = await this.getData('offline_actions') || [];
            return actions
                .filter(a => a.status === 'pending')
                .sort((a, b) => a.priority - b.priority || new Date(a.created_at) - new Date(b.created_at))
                .slice(0, limit);
        } catch (error) {
            console.error('Get pending actions error:', error);
            return [];
        }
    }

    async getPendingActionsCount() {
        try {
            const actions = await this.getData('offline_actions') || [];
            return actions.filter(a => a.status === 'pending').length;
        } catch (error) {
            console.error('Get pending count error:', error);
            return 0;
        }
    }

    async updateActionStatus(actionId, status, error = null) {
        try {
            const actions = await this.getData('offline_actions') || [];
            const updated = actions.map(a => {
                if (a.id === actionId) {
                    const newAction = { ...a, status };
                    if (error) newAction.retry_count = (a.retry_count || 0) + 1;
                    return newAction;
                }
                return a;
            });
            await this.setData('offline_actions', updated);
        } catch (error) {
            console.error('Update action status error:', error);
        }
    }

    async removeAction(actionId) {
        try {
            const actions = await this.getData('offline_actions') || [];
            const filtered = actions.filter(a => a.id !== actionId);
            await this.setData('offline_actions', filtered);
        } catch (error) {
            console.error('Remove action error:', error);
        }
    }

    async clearCompletedActions() {
        try {
            const actions = await this.getData('offline_actions') || [];
            const filtered = actions.filter(a => a.status !== 'completed');
            await this.setData('offline_actions', filtered);
        } catch (error) {
            console.error('Clear completed actions error:', error);
        }
    }

    // ===== CACHE OPERATIONS =====

    async getCache(key) {
        try {
            const cache = await this.getData('cache') || {};
            const item = cache[key];
            if (item && new Date(item.expires_at) > new Date()) {
                return item.value;
            }
            return null;
        } catch (error) {
            console.error('Get cache error:', error);
            return null;
        }
    }

    async setCache(key, value, ttlSeconds = 3600) {
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
        try {
            const cache = await this.getData('cache') || {};
            cache[key] = { value, expires_at: expiresAt };
            await this.setData('cache', cache);
        } catch (error) {
            console.error('Set cache error:', error);
        }
    }

    async saveMenu(items) {
        await this.setData('menu_items', items || []);
    }

    async getMenu(params = null) {
        const items = await this.getData('menu_items') || [];
        if (!params) return items;
        return items.filter((item) => {
            if (params.category_code && String(item.category_code) !== String(params.category_code)) return false;
            if (params.liquor_brand_code && String(item.liquor_brand_code) !== String(params.liquor_brand_code)) return false;
            return true;
        });
    }

    async saveTables(tables) {
        await this.setData('tables', tables || []);
    }

    async getTables() {
        return await this.getData('tables') || [];
    }

    async addLocalTable(tableNumber) {
        const table = {
            id: `local_table_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            table_number: Number(tableNumber) || tableNumber,
            created_at: new Date().toISOString(),
            is_synced: 0,
        };
        const tables = await this.getTables();
        await this.setData('tables', [...tables, table]);
        await this.queueAction('CREATE', 'tables', table.id, { tableNumber: String(tableNumber) }, 1);
        return table;
    }

    async deleteLocalTable(tableId) {
        const tables = await this.getTables();
        await this.setData('tables', tables.filter((table) => String(table.id) !== String(tableId)));
        if (!String(tableId).startsWith('local_table_')) {
            await this.queueAction('DELETE', 'tables', tableId, { id: tableId }, 1);
        }
    }

    async saveProfile(profile) {
        await this.setData('profile', profile || null);
    }

    async getProfile() {
        return await this.getData('profile');
    }

    async saveCustomerOutstanding(record) {
        const now = new Date().toISOString();
        const data = {
            id: `local_outstanding_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            customer_name: record.customerName || record.customer_name,
            phone_number: record.phoneNumber || record.phone_number,
            total_amount: record.totalAmount || record.total_amount,
            paid_amount: record.paidAmount || record.paid_amount || 0,
            remaining_amount: record.remainingAmount || record.remaining_amount || 0,
            order_id: record.orderId || record.order_id || null,
            created_at: now,
            is_synced: 0,
        };
        const records = await this.getData('customer_outstandings') || [];
        await this.setData('customer_outstandings', [data, ...records]);
        await this.queueAction('CREATE', 'customer_outstandings', data.id, { ...record, localOutstandingId: data.id }, 1);
        return data;
    }

    async getCustomerOutstandings() {
        const records = await this.getData('customer_outstandings') || [];
        return records.filter((record) => Number(record.remaining_amount || 0) > 0);
    }

    async clearExpiredCache() {
        try {
            const cache = await this.getData('cache') || {};
            const now = new Date();
            for (const key in cache) {
                if (new Date(cache[key].expires_at) <= now) {
                    delete cache[key];
                }
            }
            await this.setData('cache', cache);
        } catch (error) {
            console.error('Clear expired cache error:', error);
        }
    }

    // ===== SYNC METADATA =====

    async getLastSyncTimestamp() {
        try {
            const metadata = await this.getData('sync_metadata') || {};
            return metadata.last_sync || null;
        } catch (error) {
            console.error('Get last sync error:', error);
            return null;
        }
    }

    async updateLastSyncTimestamp(timestamp) {
        try {
            const metadata = await this.getData('sync_metadata') || {};
            metadata.last_sync = timestamp;
            await this.setData('sync_metadata', metadata);
        } catch (error) {
            console.error('Update last sync error:', error);
        }
    }

    // ===== UTILITY =====

    async clearAllData() {
        try {
            await AsyncStorage.multiRemove(['orders', 'offline_actions', 'cache', 'sync_metadata', 'menu_items', 'tables', 'profile', 'customer_outstandings']);
            console.log('🗑️ All local data cleared');
        } catch (error) {
            console.error('Clear all data error:', error);
        }
    }

    async getStats() {
        try {
            const orders = await this.getData('orders') || [];
            const actions = await this.getData('offline_actions') || [];
            return {
                totalOrders: orders.length,
                pendingActions: actions.filter(a => a.status === 'pending').length,
                unsyncedOrders: orders.filter(o => o.is_synced === 0).length,
            };
        } catch (error) {
            console.error('Get stats error:', error);
            return { totalOrders: 0, pendingActions: 0, unsyncedOrders: 0 };
        }
    }
}

const localDB = new LocalDB();
export default localDB;
