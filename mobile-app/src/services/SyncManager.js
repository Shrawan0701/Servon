import localDB from './LocalDB';
import networkMonitor from './NetworkMonitor';
import { getOrders, updateOrderStatus } from '../api';

class SyncManager {
    constructor() {
        this.isSyncing = false;
        this.syncInterval = null;
        this.onSyncStatusChange = null;
        this.isInitialized = false;
        this.pendingActions = 0;
        this.lastSyncStatus = 'idle';
        this.syncErrors = [];
    }

    init() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        this.startPeriodicSync(60000);
        console.log('🔄 Sync manager initialized');
        
        if (networkMonitor.isOnline) {
            setTimeout(() => this.startSync(), 3000);
        }
    }

    startPeriodicSync(intervalMs = 60000) {
        if (this.syncInterval) clearInterval(this.syncInterval);
        this.syncInterval = setInterval(() => {
            if (networkMonitor.isOnline && !this.isSyncing) {
                this.startSync();
            }
        }, intervalMs);
    }

    stopPeriodicSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        this.isInitialized = false; // Reset so it can re-initialize on login
    }

    setStatusCallback(callback) {
        this.onSyncStatusChange = callback;
        return () => {
            this.onSyncStatusChange = null;
        };
    }

    async startSync() {
        if (this.isSyncing || !networkMonitor.isOnline) {
            console.log('⏸️ Sync skipped');
            return;
        }

        this.isSyncing = true;
        this.lastSyncStatus = 'syncing';
        this.updateStatus('syncing');

        try {
            const uploaded = await this.uploadPendingActions();
            const downloaded = await this.downloadRemoteChanges();
            await localDB.updateLastSyncTimestamp(new Date().toISOString());

            console.log(`✅ Sync: Uploaded ${uploaded}, Downloaded ${downloaded}`);

            this.pendingActions = await localDB.getPendingActionsCount();
            this.lastSyncStatus = 'success';

            this.updateStatus('success', {
                uploaded,
                downloaded
            });

        } catch (error) {
            // Silently skip if it's unauthorized (401)
            if (error?.response?.status !== 401) {
                console.error('❌ Sync failed:', error.message);
            }
            this.lastSyncStatus = 'error';
            this.updateStatus('error', { error: error.message });
        } finally {
            this.isSyncing = false;
            this.updateStatus('idle');
        }
    }

    async uploadPendingActions() {
        const actions = await localDB.getPendingActions(50);
        let uploaded = 0;

        for (const action of actions) {
            try {
                if (action.action_type === 'UPDATE' && action.table_name === 'orders') {
                    await updateOrderStatus(action.record_id, action.data.status);
                    await localDB.markAsSynced(action.record_id);
                    await localDB.removeAction(action.id);
                    uploaded++;
                }
            } catch (error) {
                console.error('Action failed:', action.id, error.message);
                await localDB.updateActionStatus(action.id, 'failed', error.message);
            }
        }

        return uploaded;
    }

    async downloadRemoteChanges() {
        try {
            const response = await getOrders();
            const freshOrders = response.data || [];
            await localDB.saveOrders(freshOrders);
            return freshOrders.length;
        } catch (error) {
            if (error?.response?.status !== 401) {
                console.error('Download failed:', error.message);
            }
            return 0;
        }
    }

    async getSyncStatus() {
        const pendingActions = await localDB.getPendingActionsCount();
        const unsyncedOrders = await localDB.getUnsyncedOrders();
        const lastSyncTime = await localDB.getLastSyncTimestamp();

        return {
            status: this.lastSyncStatus,
            isSyncing: this.isSyncing,
            pendingActions: pendingActions,
            unsyncedOrders: unsyncedOrders.length || 0,
            lastSyncTime: lastSyncTime,
            isOnline: networkMonitor.isOnline,
            errors: this.syncErrors.slice(-5)
        };
    }

    updateStatus(status, data = {}) {
        if (this.onSyncStatusChange) {
            this.onSyncStatusChange({ 
                status, 
                isSyncing: this.isSyncing, 
                pendingActions: this.pendingActions,
                ...data 
            });
        }
    }

    async getPendingCount() {
        this.pendingActions = await localDB.getPendingActionsCount();
        return this.pendingActions;
    }
}

const syncManager = new SyncManager();
export default syncManager;