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
                table_number INTEGER,
                items TEXT,
                total_amount REAL,
                status TEXT,
                special_instructions TEXT,
                created_at DATETIME,
                updated_at DATETIME,
                is_synced INTEGER DEFAULT 0
            )
        `);

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
                (id, table_number, items, total_amount, status, special_instructions, created_at, updated_at, is_synced)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            for (const order of orders) {
                await this.db.runAsync(insertQuery, [
                    order.id,
                    order.table_number,
                    JSON.stringify(order.items || []),
                    order.total_amount || 0,
                    order.status || 'EDITABLE',
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