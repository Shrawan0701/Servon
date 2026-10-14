import * as SQLite from 'expo-sqlite';

class LocalDB {
    constructor() {
        this.db = null;
        this.initialized = false;
        this.isWeb = false;
    }

    async init() {
        if (this.initialized) return;

        try {
            this.db = await SQLite.openDatabaseAsync('servon.db');
            await this.createTablesNative();
            console.log('📦 SQLite initialized for native');
            this.initialized = true;
        } catch (error) {
            console.error('❌ Database init failed:', error);
        }
    }

    async createTablesNative() {
        await this.db.execAsync(`
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                table_id TEXT,
                table_number INTEGER,
                items TEXT,
                total_amount REAL,
                status TEXT,
                order_source TEXT DEFAULT 'customer',
                special_instructions TEXT,
                created_at DATETIME,
                updated_at DATETIME,
                is_synced INTEGER DEFAULT 0
            )
        `);

        try {
            await this.db.execAsync(`ALTER TABLE orders ADD COLUMN table_id TEXT;`);
        } catch (error) {
            if (!String(error?.message || '').toLowerCase().includes('duplicate column')) {
                console.warn('Order table_id migration skipped:', error.message);
            }
        }

        try {
            await this.db.execAsync(`ALTER TABLE orders ADD COLUMN order_source TEXT DEFAULT 'customer';`);
        } catch (error) {
            if (!String(error?.message || '').toLowerCase().includes('duplicate column')) {
                console.warn('Order source migration skipped:', error.message);
            }
        }

        await this.db.execAsync(`
            CREATE TABLE IF NOT EXISTS offline_actions (
                id TEXT PRIMARY KEY,
                action_type TEXT,
                table_name TEXT,
                record_id TEXT,
                data TEXT,
                priority INTEGER DEFAULT 1,
                created_at DATETIME,
                status TEXT DEFAULT 'pending',
                retry_count INTEGER DEFAULT 0
            )
        `);

        await this.db.execAsync(`
            CREATE TABLE IF NOT EXISTS cache (
                key TEXT PRIMARY KEY,
                value TEXT,
                expires_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await this.db.execAsync(`
            CREATE TABLE IF NOT EXISTS menu_items (
                id TEXT PRIMARY KEY,
                data TEXT,
                updated_at DATETIME
            )
        `);

        await this.db.execAsync(`
            CREATE TABLE IF NOT EXISTS tables_cache (
                id TEXT PRIMARY KEY,
                data TEXT,
                updated_at DATETIME
            )
        `);

        await this.db.execAsync(`
            CREATE TABLE IF NOT EXISTS customer_outstandings (
                id TEXT PRIMARY KEY,
                data TEXT,
                remaining_amount REAL,
                created_at DATETIME,
                is_synced INTEGER DEFAULT 0
            )
        `);

        await this.db.execAsync(`
            CREATE TABLE IF NOT EXISTS sync_metadata (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await this.db.execAsync(`
            CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
            CREATE INDEX IF NOT EXISTS idx_orders_synced ON orders(is_synced);
            CREATE INDEX IF NOT EXISTS idx_actions_status ON offline_actions(status);
        `);
    }

    // ===== ORDER OPERATIONS =====

    async saveOrders(orders) {
        if (!orders || orders.length === 0) return;

        try {
            const insertQuery = `
                INSERT OR REPLACE INTO orders 
                (id, table_id, table_number, items, total_amount, status, order_source, special_instructions, created_at, updated_at, is_synced)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            for (const order of orders) {
                await this.db.runAsync(insertQuery, [
                    order.id,
                    order.table_id || order.tableId || null,
                    order.table_number,
                    JSON.stringify(order.items || []),
                    order.total_amount || 0,
                    order.status || 'EDITABLE',
                    order.order_source || 'customer',
                    order.special_instructions || '',
                    order.created_at || new Date().toISOString(),
                    new Date().toISOString(),
                    1
                ]);
            }
        } catch (error) {
            console.error('Save orders error:', error);
        }
    }

    async getOrderById(orderId) {
        try {
            const row = await this.db.getFirstAsync(`SELECT * FROM orders WHERE id = ?`, [orderId]);
            return row ? { ...row, items: JSON.parse(row.items || '[]') } : null;
        } catch (error) {
            console.error('Get order by id error:', error);
            return null;
        }
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
        await this.db.runAsync(
            `INSERT OR REPLACE INTO orders (id, table_id, table_number, items, total_amount, status, order_source, special_instructions, created_at, updated_at, is_synced)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [order.id, order.table_id, order.table_number, JSON.stringify(order.items), order.total_amount, order.status, order.order_source, order.special_instructions, order.created_at, order.updated_at, 0]
        );
        await this.queueAction('CREATE', 'orders', order.id, { order }, 0);
        return order;
    }

    async appendOrderItems(orderId, items = []) {
        const order = await this.getOrderById(orderId);
        if (!order) return null;
        const merged = [...(order.items || [])];
        items.forEach((item) => {
            const found = merged.find((existing) => String(existing.id || existing.menu_item_id || existing.menuItemId) === String(item.id || item.menu_item_id || item.menuItemId));
            if (found) found.quantity = Number(found.quantity || 0) + Number(item.quantity || 1);
            else merged.push({ ...item, quantity: Number(item.quantity || 1) });
        });
        const updatedOrder = { ...order, items: merged, total_amount: this.calculateOrderTotal(merged), updated_at: new Date().toISOString(), is_synced: 0 };
        await this.db.runAsync(
            `UPDATE orders SET items = ?, total_amount = ?, updated_at = ?, is_synced = 0 WHERE id = ?`,
            [JSON.stringify(merged), updatedOrder.total_amount, updatedOrder.updated_at, orderId]
        );
        if (!String(orderId).startsWith('local_order_')) await this.queueAction('APPEND_ITEMS', 'orders', orderId, { items }, 1);
        return updatedOrder;
    }

    async removeOrderItem(orderId, itemId) {
        const order = await this.getOrderById(orderId);
        if (!order) return null;
        const remaining = (order.items || []).filter((item) => String(item.id || item.menu_item_id || item.menuItemId) !== String(itemId));
        const updatedOrder = {
            ...order,
            items: remaining,
            total_amount: this.calculateOrderTotal(remaining),
            status: remaining.length === 0 ? 'REJECTED' : order.status,
            updated_at: new Date().toISOString(),
            is_synced: 0,
        };
        await this.db.runAsync(
            `UPDATE orders SET items = ?, total_amount = ?, status = ?, updated_at = ?, is_synced = 0 WHERE id = ?`,
            [JSON.stringify(remaining), updatedOrder.total_amount, updatedOrder.status, updatedOrder.updated_at, orderId]
        );
        if (!String(orderId).startsWith('local_order_')) await this.queueAction('REMOVE_ITEM', 'orders', orderId, { itemId }, 1);
        return updatedOrder;
    }

    async getOrders(status = null, limit = 100) {
        try {
            let query = `SELECT * FROM orders WHERE 1=1`;
            const params = [];

            if (status && status !== 'all' && status !== 'PREVIOUS') {
                query += ` AND status = ?`;
                params.push(status);
            }

            query += ` ORDER BY created_at DESC LIMIT ?`;
            params.push(limit);

            const result = await this.db.getAllAsync(query, params);
            return result.map(row => ({
                ...row,
                items: JSON.parse(row.items || '[]')
            }));
        } catch (error) {
            console.error('Get orders error:', error);
            return [];
        }
    }

    async getOrdersByDate(date, status = null) {
        try {
            let query = `SELECT * FROM orders WHERE DATE(created_at) = DATE(?)`;
            const params = [date];

            if (status && status !== 'all' && status !== 'PREVIOUS') {
                query += ` AND status = ?`;
                params.push(status);
            }

            query += ` ORDER BY created_at DESC`;

            const result = await this.db.getAllAsync(query, params);
            return result.map(row => ({
                ...row,
                items: JSON.parse(row.items || '[]')
            }));
        } catch (error) {
            console.error('Get orders by date error:', error);
            return [];
        }
    }

    async getUnsyncedOrders() {
        try {
            const query = `SELECT * FROM orders WHERE is_synced = 0 ORDER BY created_at ASC`;
            const result = await this.db.getAllAsync(query);
            return result.map(row => ({
                ...row,
                items: JSON.parse(row.items || '[]')
            }));
        } catch (error) {
            console.error('Get unsynced orders error:', error);
            return [];
        }
    }

    async updateOrderStatus(orderId, status) {
        try {
            const query = `UPDATE orders SET status = ?, updated_at = ?, is_synced = 0 WHERE id = ?`;
            await this.db.runAsync(query, [status, new Date().toISOString(), orderId]);
            await this.queueAction('UPDATE', 'orders', orderId, { status });
        } catch (error) {
            console.error('Update order status error:', error);
        }
    }

    async markAsSynced(orderId) {
        try {
            await this.db.runAsync(`UPDATE orders SET is_synced = 1 WHERE id = ?`, [orderId]);
        } catch (error) {
            console.error('Mark as synced error:', error);
        }
    }

    async replaceLocalOrderId(localId, serverOrder) {
        try {
            await this.db.runAsync(`DELETE FROM orders WHERE id = ?`, [localId]);
            await this.saveOrders([{ ...serverOrder, is_synced: 1 }]);
            await this.replaceQueuedRecordId(localId, serverOrder.id);
        } catch (error) {
            console.error('Replace local order id error:', error);
        }
    }

    async deleteOrder(orderId) {
        try {
            await this.db.runAsync(`DELETE FROM orders WHERE id = ?`, [orderId]);
            await this.queueAction('DELETE', 'orders', orderId, { id: orderId });
        } catch (error) {
            console.error('Delete order error:', error);
        }
    }

    // ===== OFFLINE ACTIONS QUEUE =====

    async queueAction(actionType, tableName, recordId, data, priority = 1) {
        const id = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            const query = `
                INSERT INTO offline_actions 
                (id, action_type, table_name, record_id, data, priority, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            await this.db.runAsync(query, [
                id,
                actionType,
                tableName,
                recordId,
                JSON.stringify(data),
                priority,
                new Date().toISOString()
            ]);
            console.log(`📝 Queued action: ${actionType} on ${tableName}`);
        } catch (error) {
            console.error('Queue action error:', error);
        }
    }

    async replaceQueuedRecordId(oldId, newId) {
        const actions = await this.db.getAllAsync(`SELECT * FROM offline_actions WHERE record_id = ?`, [oldId]);
        for (const action of actions) {
            const data = JSON.parse(action.data || '{}');
            await this.db.runAsync(
                `UPDATE offline_actions SET record_id = ?, data = ? WHERE id = ?`,
                [newId, JSON.stringify({ ...data, orderId: newId }), action.id]
            );
        }
    }

    async getPendingActions(limit = 50) {
        try {
            const query = `
                SELECT * FROM offline_actions 
                WHERE status = 'pending' 
                ORDER BY priority ASC, created_at ASC 
                LIMIT ?
            `;
            const result = await this.db.getAllAsync(query, [limit]);
            return result.map(row => ({
                ...row,
                data: JSON.parse(row.data)
            }));
        } catch (error) {
            console.error('Get pending actions error:', error);
            return [];
        }
    }

    async getPendingActionsCount() {
        try {
            const query = `SELECT COUNT(*) as count FROM offline_actions WHERE status = 'pending'`;
            const result = await this.db.getFirstAsync(query);
            return result?.count || 0;
        } catch (error) {
            console.error('Get pending count error:', error);
            return 0;
        }
    }

    async updateActionStatus(actionId, status, error = null) {
        try {
            let query = `UPDATE offline_actions SET status = ?`;
            const params = [status];
            if (error) {
                query += `, retry_count = retry_count + 1`;
            }
            query += ` WHERE id = ?`;
            params.push(actionId);
            await this.db.runAsync(query, params);
        } catch (error) {
            console.error('Update action status error:', error);
        }
    }

    async removeAction(actionId) {
        try {
            await this.db.runAsync(`DELETE FROM offline_actions WHERE id = ?`, [actionId]);
        } catch (error) {
            console.error('Remove action error:', error);
        }
    }

    async clearCompletedActions() {
        try {
            await this.db.runAsync(`DELETE FROM offline_actions WHERE status = 'completed'`);
        } catch (error) {
            console.error('Clear completed actions error:', error);
        }
    }

    // ===== CACHE OPERATIONS =====

    async getCache(key) {
        try {
            const query = `SELECT * FROM cache WHERE key = ? AND expires_at > datetime('now')`;
            const result = await this.db.getFirstAsync(query, [key]);
            if (result) {
                return JSON.parse(result.value);
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
            const query = `
                INSERT OR REPLACE INTO cache (key, value, expires_at)
                VALUES (?, ?, ?)
            `;
            await this.db.runAsync(query, [key, JSON.stringify(value), expiresAt]);
        } catch (error) {
            console.error('Set cache error:', error);
        }
    }

    async saveMenu(items) {
        await this.db.runAsync(`DELETE FROM menu_items`);
        for (const item of items || []) {
            await this.db.runAsync(`INSERT OR REPLACE INTO menu_items (id, data, updated_at) VALUES (?, ?, ?)`, [String(item.id), JSON.stringify(item), new Date().toISOString()]);
        }
    }

    async getMenu(params = null) {
        const rows = await this.db.getAllAsync(`SELECT data FROM menu_items`);
        const items = rows.map((row) => JSON.parse(row.data));
        if (!params) return items;
        return items.filter((item) => {
            if (params.category_code && String(item.category_code) !== String(params.category_code)) return false;
            if (params.liquor_brand_code && String(item.liquor_brand_code) !== String(params.liquor_brand_code)) return false;
            return true;
        });
    }

    async saveTables(tables) {
        await this.db.runAsync(`DELETE FROM tables_cache`);
        for (const table of tables || []) {
            await this.db.runAsync(`INSERT OR REPLACE INTO tables_cache (id, data, updated_at) VALUES (?, ?, ?)`, [String(table.id || table.table_number), JSON.stringify(table), new Date().toISOString()]);
        }
    }

    async getTables() {
        const rows = await this.db.getAllAsync(`SELECT data FROM tables_cache`);
        return rows.map((row) => JSON.parse(row.data));
    }

    async addLocalTable(tableNumber) {
        const table = {
            id: `local_table_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            table_number: Number(tableNumber) || tableNumber,
            created_at: new Date().toISOString(),
            is_synced: 0,
        };
        await this.db.runAsync(
            `INSERT OR REPLACE INTO tables_cache (id, data, updated_at) VALUES (?, ?, ?)`,
            [String(table.id), JSON.stringify(table), new Date().toISOString()]
        );
        await this.queueAction('CREATE', 'tables', table.id, { tableNumber: String(tableNumber) }, 1);
        return table;
    }

    async deleteLocalTable(tableId) {
        await this.db.runAsync(`DELETE FROM tables_cache WHERE id = ?`, [String(tableId)]);
        if (!String(tableId).startsWith('local_table_')) {
            await this.queueAction('DELETE', 'tables', tableId, { id: tableId }, 1);
        }
    }

    async saveProfile(profile) {
        await this.setCache('profile', profile || null, 60 * 60 * 24 * 365);
    }

    async getProfile() {
        return await this.getCache('profile');
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
        await this.db.runAsync(
            `INSERT OR REPLACE INTO customer_outstandings (id, data, remaining_amount, created_at, is_synced) VALUES (?, ?, ?, ?, 0)`,
            [data.id, JSON.stringify(data), Number(data.remaining_amount || 0), data.created_at]
        );
        await this.queueAction('CREATE', 'customer_outstandings', data.id, { ...record, localOutstandingId: data.id }, 1);
        return data;
    }

    async cacheCustomerOutstandings(records) {
        await this.db.runAsync(`DELETE FROM customer_outstandings WHERE is_synced = 1`);
        await this.db.runAsync(`
            DELETE FROM customer_outstandings
            WHERE is_synced = 0
              AND id NOT IN (
                SELECT record_id FROM offline_actions
                WHERE status = 'pending' AND table_name = 'customer_outstandings'
              )
        `);
        for (const record of records || []) {
            const data = { ...record, is_synced: record.is_synced ?? 1 };
            await this.db.runAsync(
                `INSERT OR REPLACE INTO customer_outstandings (id, data, remaining_amount, created_at, is_synced) VALUES (?, ?, ?, ?, ?)`,
                [String(data.id), JSON.stringify(data), Number(data.remaining_amount || 0), data.created_at || new Date().toISOString(), data.is_synced ? 1 : 0]
            );
        }
    }

    async getCustomerOutstandings() {
        const rows = await this.db.getAllAsync(`SELECT data FROM customer_outstandings WHERE remaining_amount > 0 ORDER BY created_at DESC`);
        return rows.map((row) => JSON.parse(row.data));
    }

    async clearCustomerOutstanding(id) {
        await this.db.runAsync(`DELETE FROM customer_outstandings WHERE id = ?`, [String(id)]);
    }

    async clearExpiredCache() {
        try {
            await this.db.runAsync(`DELETE FROM cache WHERE expires_at <= datetime('now')`);
        } catch (error) {
            console.error('Clear expired cache error:', error);
        }
    }

    // ===== SYNC METADATA =====

    async getLastSyncTimestamp() {
        try {
            const query = `SELECT value FROM sync_metadata WHERE key = 'last_sync'`;
            const result = await this.db.getFirstAsync(query);
            return result?.value || null;
        } catch (error) {
            console.error('Get last sync error:', error);
            return null;
        }
    }

    async updateLastSyncTimestamp(timestamp) {
        try {
            const query = `
                INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
                VALUES ('last_sync', ?, ?)
            `;
            await this.db.runAsync(query, [timestamp, new Date().toISOString()]);
        } catch (error) {
            console.error('Update last sync error:', error);
        }
    }

    // ===== UTILITY =====

    async clearAllData() {
        try {
            await this.db.execAsync(`
                DELETE FROM orders;
                DELETE FROM offline_actions;
                DELETE FROM cache;
                DELETE FROM sync_metadata;
                DELETE FROM menu_items;
                DELETE FROM tables_cache;
                DELETE FROM customer_outstandings;
            `);
            console.log('🗑️ All local data cleared');
        } catch (error) {
            console.error('Clear all data error:', error);
        }
    }

    async getStats() {
        try {
            const orderCount = await this.db.getFirstAsync(`SELECT COUNT(*) as count FROM orders`);
            const pendingActions = await this.db.getFirstAsync(`SELECT COUNT(*) as count FROM offline_actions WHERE status = 'pending'`);
            const unsyncedOrders = await this.db.getFirstAsync(`SELECT COUNT(*) as count FROM orders WHERE is_synced = 0`);
            
            return {
                totalOrders: orderCount?.count || 0,
                pendingActions: pendingActions?.count || 0,
                unsyncedOrders: unsyncedOrders?.count || 0,
            };
        } catch (error) {
            console.error('Get stats error:', error);
            return { totalOrders: 0, pendingActions: 0, unsyncedOrders: 0 };
        }
    }
}

const localDB = new LocalDB();
export default localDB;
