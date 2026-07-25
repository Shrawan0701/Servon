// src/hooks/useOfflineData.js
import { useState, useEffect, useCallback } from 'react';
import localDB from '../services/LocalDB';
import api from '../services/OfflineAPI';
import networkMonitor from '../services/NetworkMonitor';
import syncManager from '../services/SyncManager';

export function useOfflineData(endpoint, options = {}) {
    const {
        cache = true,
        ttl = 3600,
        autoRefresh = true,
        refreshInterval = 60000
    } = options;

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isOffline, setIsOffline] = useState(!networkMonitor.isOnline);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async (forceRefresh = false) => {
        try {
            setLoading(true);
            setError(null);

            if (!forceRefresh) {
                const cached = await localDB.getCache(endpoint);
                if (cached) {
                    setData(cached);
                    setLoading(false);
                }
            }

            if (networkMonitor.isOnline) {
                const freshData = await api.get(endpoint, {}, { cache, ttl });
                setData(freshData);
                setError(null);
            } else {
                if (!data) {
                    if (endpoint.includes('/orders')) {
                        const localOrders = await localDB.getOrders();
                        if (localOrders.length > 0) {
                            setData(localOrders);
                        }
                    }
                }
                setIsOffline(true);
            }

        } catch (err) {
            console.error('Load data error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [endpoint, cache, ttl]);

    const refreshData = useCallback(async () => {
        setRefreshing(true);
        await loadData(true);
    }, [loadData]);

    const syncNow = useCallback(async () => {
        await syncManager.startSync();
        await loadData(true);
    }, [loadData]);

    useEffect(() => {
        const unsubscribe = networkMonitor.subscribe((isOnline) => {
            setIsOffline(!isOnline);
            if (isOnline) {
                loadData(true);
            }
        });

        return () => unsubscribe();
    }, [loadData]);

    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            if (networkMonitor.isOnline) {
                loadData(true);
            }
        }, refreshInterval);

        return () => clearInterval(interval);
    }, [autoRefresh, refreshInterval, loadData]);

    useEffect(() => {
        loadData();
    }, []);

    return {
        data,
        loading,
        error,
        refreshing,
        isOffline,
        refreshData,
        syncNow,
        setData
    };
}