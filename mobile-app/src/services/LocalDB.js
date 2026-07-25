// src/services/LocalDB.js
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ===== DETECT WEB PLATFORM =====
const isWeb = Platform.OS === 'web';

class LocalDB {
    constructor() {
        this.db = null;
        this.initialized = false;
        this.isWeb = isWeb;
    }

    async init() {
        if (this.initialized) return;
        
        try {
            if (this.isWeb) {
                // ===== WEB: Use AsyncStorage =====
                console.log('📦 Using AsyncStorage for web');
                this.initialized = true;
            } else {
                // ===== NATIVE: Use SQLite =====
                const SQLite = await import('expo-sqlite');
                this.db = await SQLite.openDatabaseAsync('servon.db');
                await this.createTablesNative();
                console.log('📦 SQLite initialized for native');
                this.initialized = true;
            }
        } catch (error) {
            console.error('❌ Database init failed:', error);
            // Fallback to AsyncStorage if SQLite fails
            this.isWeb = true;
            this.initialized = true;
        }
    }

    // ===== NATIVE: SQLite Table Creation =====
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

    // ===== WEB: AsyncStorage Methods =====
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

    // ===== ORDER OPERATIONS (Cross-Platform) =====

    async saveOrders(orders) {
        if (!orders || orders.length === 0) return;

        try {
            if (this.isWeb) {
                // ===== WEB: Save to AsyncStorage =====
                const existing = await this.getData('orders') || [];
                const merged = [...existing, ...orders];
                // Remove duplicates by id
                const unique = merged.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
                await this.setData('orders', unique);
            } else {
                // ===== NATIVE: Save to SQLite =====
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
            }
        } catch (error) {
            console.error('Save orders error:', error);
        }
    }

    async getOrders(status = null, limit = 100) {
        try {
            if (this.isWeb) {
                // ===== WEB: Get from AsyncStorage =====
                const allOrders = await this.getData('orders') || [];
                let filtered = allOrders;
                if (status && status !== 'all' && status !== 'PREVIOUS') {
                    filtered = allOrders.filter(o => o.status === status);
                }
                return filtered.slice(0, limit);
            } else {
                // ===== NATIVE: Get from SQLite =====
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
            }
        } catch (error) {
            console.error('Get orders error:', error);
            return [];
        }
    }

    async getOrdersByDate(date, status = null) {
        try {
            if (this.isWeb) {
                // ===== WEB: Filter by date =====
                const allOrders = await this.getData('orders') || [];
                let filtered = allOrders.filter(o => {
                    const orderDate = new Date(o.created_at).toISOString().split('T')[0];
                    return orderDate === date;
                });
                if (status && status !== 'all' && status !== 'PREVIOUS') {
                    filtered = filtered.filter(o => o.status === status);
                }
                return filtered;
            } else {
                // ===== NATIVE: SQLite date query =====
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
            }
        } catch (error) {
            console.error('Get orders by date error:', error);
            return [];
        }
    }

    async getUnsyncedOrders() {
        try {
            if (this.isWeb) {
                const allOrders = await this.getData('orders') || [];
                return allOrders.filter(o => o.is_synced === 0);
            } else {
                const query = `SELECT * FROM orders WHERE is_synced = 0 ORDER BY created_at ASC`;
                const result = await this.db.getAllAsync(query);
                return result.map(row => ({
                    ...row,
                    items: JSON.parse(row.items || '[]')
                }));
            }
        } catch (error) {
            console.error('Get unsynced orders error:', error);
            return [];
        }
    }

    async updateOrderStatus(orderId, status) {
        try {
            if (this.isWeb) {
                // ===== WEB: Update in AsyncStorage =====
                const allOrders = await this.getData('orders') || [];
                const updated = allOrders.map(o => 
                    o.id === orderId ? { ...o, status, updated_at: new Date().toISOString(), is_synced: 0 } : o
                );
                await this.setData('orders', updated);
            } else {
                // ===== NATIVE: Update in SQLite =====
                const query = `UPDATE orders SET status = ?, updated_at = ?, is_synced = 0 WHERE id = ?`;
                await this.db.runAsync(query, [status, new Date().toISOString(), orderId]);
            }
            
            // Track as offline action
            await this.queueAction('UPDATE', 'orders', orderId, { status });
        } catch (error) {
            console.error('Update order status error:', error);
        }
    }

    async markAsSynced(orderId) {
        try {
            if (this.isWeb) {
                const allOrders = await this.getData('orders') || [];
                const updated = allOrders.map(o => 
                    o.id === orderId ? { ...o, is_synced: 1 } : o
                );
                await this.setData('orders', updated);
            } else {
                await this.db.runAsync(`UPDATE orders SET is_synced = 1 WHERE id = ?`, [orderId]);
            }
        } catch (error) {
            console.error('Mark as synced error:', error);
        }
    }

    async deleteOrder(orderId) {
        try {
            if (this.isWeb) {
                const allOrders = await this.getData('orders') || [];
                const filtered = allOrders.filter(o => o.id !== orderId);
                await this.setData('orders', filtered);
            } else {
                await this.db.runAsync(`DELETE FROM orders WHERE id = ?`, [orderId]);
            }
            await this.queueAction('DELETE', 'orders', orderId, { id: orderId });
        } catch (error) {
            console.error('Delete order error:', error);
        }
    }

    // ===== OFFLINE ACTIONS QUEUE (Cross-Platform) =====

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
            if (this.isWeb) {
                const actions = await this.getData('offline_actions') || [];
                actions.push(action);
                await this.setData('offline_actions', actions);
            } else {
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
            }
            console.log(`📝 Queued action: ${actionType} on ${tableName}`);
        } catch (error) {
            console.error('Queue action error:', error);
        }
    }

    async getPendingActions(limit = 50) {
        try {
            if (this.isWeb) {
                const actions = await this.getData('offline_actions') || [];
                return actions
                    .filter(a => a.status === 'pending')
                    .sort((a, b) => a.priority - b.priority || new Date(a.created_at) - new Date(b.created_at))
                    .slice(0, limit);
            } else {
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
            }
        } catch (error) {
            console.error('Get pending actions error:', error);
            return [];
        }
    }

    async getPendingActionsCount() {
        try {
            if (this.isWeb) {
                const actions = await this.getData('offline_actions') || [];
                return actions.filter(a => a.status === 'pending').length;
            } else {
                const query = `SELECT COUNT(*) as count FROM offline_actions WHERE status = 'pending'`;
                const result = await this.db.getFirstAsync(query);
                return result?.count || 0;
            }
        } catch (error) {
            console.error('Get pending count error:', error);
            return 0;
        }
    }

    async updateActionStatus(actionId, status, error = null) {
        try {
            if (this.isWeb) {
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
            } else {
                let query = `UPDATE offline_actions SET status = ?`;
                const params = [status];
                if (error) {
                    query += `, retry_count = retry_count + 1`;
                }
                query += ` WHERE id = ?`;
                params.push(actionId);
                await this.db.runAsync(query, params);
            }
        } catch (error) {
            console.error('Update action status error:', error);
        }
    }

    async removeAction(actionId) {
        try {
            if (this.isWeb) {
                const actions = await this.getData('offline_actions') || [];
                const filtered = actions.filter(a => a.id !== actionId);
                await this.setData('offline_actions', filtered);
            } else {
                await this.db.runAsync(`DELETE FROM offline_actions WHERE id = ?`, [actionId]);
            }
        } catch (error) {
            console.error('Remove action error:', error);
        }
    }

    async clearCompletedActions() {
        try {
            if (this.isWeb) {
                const actions = await this.getData('offline_actions') || [];
                const filtered = actions.filter(a => a.status !== 'completed');
                await this.setData('offline_actions', filtered);
            } else {
                await this.db.runAsync(`DELETE FROM offline_actions WHERE status = 'completed'`);
            }
        } catch (error) {
            console.error('Clear completed actions error:', error);
        }
    }

    // ===== CACHE OPERATIONS =====

    async getCache(key) {
        try {
            if (this.isWeb) {
                const cache = await this.getData('cache') || {};
                const item = cache[key];
                if (item && new Date(item.expires_at) > new Date()) {
                    return item.value;
                }
                return null;
            } else {
                const query = `SELECT * FROM cache WHERE key = ? AND expires_at > datetime('now')`;
                const result = await this.db.getFirstAsync(query, [key]);
                if (result) {
                    return JSON.parse(result.value);
                }
                return null;
            }
        } catch (error) {
            console.error('Get cache error:', error);
            return null;
        }
    }

    async setCache(key, value, ttlSeconds = 3600) {
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
        try {
            if (this.isWeb) {
                const cache = await this.getData('cache') || {};
                cache[key] = { value, expires_at: expiresAt };
                await this.setData('cache', cache);
            } else {
                const query = `
                    INSERT OR REPLACE INTO cache (key, value, expires_at)
                    VALUES (?, ?, ?)
                `;
                await this.db.runAsync(query, [key, JSON.stringify(value), expiresAt]);
            }
        } catch (error) {
            console.error('Set cache error:', error);
        }
    }

    async clearExpiredCache() {
        try {
            if (this.isWeb) {
                const cache = await this.getData('cache') || {};
                const now = new Date();
                for (const key in cache) {
                    if (new Date(cache[key].expires_at) <= now) {
                        delete cache[key];
                    }
                }
                await this.setData('cache', cache);
            } else {
                await this.db.runAsync(`DELETE FROM cache WHERE expires_at <= datetime('now')`);
            }
        } catch (error) {
            console.error('Clear expired cache error:', error);
        }
    }

    // ===== SYNC METADATA =====

    async getLastSyncTimestamp() {
        try {
            if (this.isWeb) {
                const metadata = await this.getData('sync_metadata') || {};
                return metadata.last_sync || null;
            } else {
                const query = `SELECT value FROM sync_metadata WHERE key = 'last_sync'`;
                const result = await this.db.getFirstAsync(query);
                return result?.value || null;
            }
        } catch (error) {
            console.error('Get last sync error:', error);
            return null;
        }
    }

    async updateLastSyncTimestamp(timestamp) {
        try {
            if (this.isWeb) {
                const metadata = await this.getData('sync_metadata') || {};
                metadata.last_sync = timestamp;
                await this.setData('sync_metadata', metadata);
            } else {
                const query = `
                    INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
                    VALUES ('last_sync', ?, ?)
                `;
                await this.db.runAsync(query, [timestamp, new Date().toISOString()]);
            }
        } catch (error) {
            console.error('Update last sync error:', error);
        }
    }

    // ===== UTILITY =====

    async clearAllData() {
        try {
            if (this.isWeb) {
                await AsyncStorage.multiRemove(['orders', 'offline_actions', 'cache', 'sync_metadata']);
            } else {
                await this.db.execAsync(`
                    DELETE FROM orders;
                    DELETE FROM offline_actions;
                    DELETE FROM cache;
                    DELETE FROM sync_metadata;
                `);
            }
            console.log('🗑️ All local data cleared');
        } catch (error) {
            console.error('Clear all data error:', error);
        }
    }

    async getStats() {
        try {
            if (this.isWeb) {
                const orders = await this.getData('orders') || [];
                const actions = await this.getData('offline_actions') || [];
                return {
                    totalOrders: orders.length,
                    pendingActions: actions.filter(a => a.status === 'pending').length,
                    unsyncedOrders: orders.filter(o => o.is_synced === 0).length,
                };
            } else {
                const orderCount = await this.db.getFirstAsync(`SELECT COUNT(*) as count FROM orders`);
                const pendingActions = await this.db.getFirstAsync(`SELECT COUNT(*) as count FROM offline_actions WHERE status = 'pending'`);
                const unsyncedOrders = await this.db.getFirstAsync(`SELECT COUNT(*) as count FROM orders WHERE is_synced = 0`);
                
                return {
                    totalOrders: orderCount?.count || 0,
                    pendingActions: pendingActions?.count || 0,
                    unsyncedOrders: unsyncedOrders?.count || 0,
                };
            }
        } catch (error) {
            console.error('Get stats error:', error);
            return { totalOrders: 0, pendingActions: 0, unsyncedOrders: 0 };
        }
    }
}

const localDB = new LocalDB();
export default localDB;