// src/hooks/useNetworkStatus.js
import { useState, useEffect } from 'react';
import networkMonitor from '../services/NetworkMonitor';
import localDB from '../services/LocalDB';
import syncManager from '../services/SyncManager';

export function useNetworkStatus() {
    const [isOnline, setIsOnline] = useState(networkMonitor.isOnline);
    const [pendingActions, setPendingActions] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        const updatePendingCount = async () => {
            try {
                const count = await localDB.getPendingActionsCount();
                setPendingActions(count);
            } catch (error) {
                console.error('Pending count error:', error);
            }
        };

        updatePendingCount();

        const unsubscribe = networkMonitor.subscribe((status) => {
            setIsOnline(status);
            if (status) {
                updatePendingCount();
            }
        });

        const syncUnsubscribe = syncManager.setStatusCallback((status) => {
            setIsSyncing(status.isSyncing);
            updatePendingCount();
        });

        const interval = setInterval(updatePendingCount, 5000);

        return () => {
            unsubscribe();
            if (typeof syncUnsubscribe === 'function') {
                syncUnsubscribe();
            }
            clearInterval(interval);
        };
    }, []);

    return {
        isOnline,
        pendingActions,
        isSyncing,
        hasPendingActions: pendingActions > 0
    };
}