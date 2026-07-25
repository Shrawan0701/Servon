// src/components/SyncStatus.js
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Platform
} from 'react-native';
import {
    Wifi,
    WifiOff,
    RefreshCw,
    CheckCircle,
    AlertCircle,
    Clock,
    Database,
    Cloud
} from 'lucide-react-native';
import syncManager from '../services/SyncManager';

export function SyncStatus() {
    const [status, setStatus] = useState({
        status: 'idle',
        isSyncing: false,
        pendingActions: 0,
        unsyncedOrders: 0,
        lastSyncTime: null,
        isOnline: true
    });

    useEffect(() => {
        const updateStatus = async () => {
            try {
                const newStatus = await syncManager.getSyncStatus();
                setStatus(newStatus);
            } catch (error) {
                console.error('Status update error:', error);
            }
        };

        updateStatus();

        const unsubscribe = syncManager.setStatusCallback(async () => {
            const newStatus = await syncManager.getSyncStatus();
            setStatus(newStatus);
        });

        const interval = setInterval(updateStatus, 10000);

        return () => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
            clearInterval(interval);
        };
    }, []);

    const handleSyncPress = () => {
        syncManager.startSync();
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return 'Never';
        try {
            const date = new Date(timestamp);
            return date.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch {
            return 'Never';
        }
    };

    const getSyncStatusIcon = () => {
        if (status.isSyncing) {
            return <RefreshCw size={16} color="#D97706" />;
        }
        if (status.status === 'error') {
            return <AlertCircle size={16} color="#DC2626" />;
        }
        if (status.pendingActions > 0) {
            return <Clock size={16} color="#D97706" />;
        }
        return <CheckCircle size={16} color="#059669" />;
    };

    const getSyncStatusText = () => {
        if (status.isSyncing) return 'Syncing...';
        if (status.status === 'error') return 'Sync Failed';
        if (status.pendingActions > 0) return `${status.pendingActions} pending`;
        return 'Up to date';
    };

    const getSyncStatusColor = () => {
        if (status.isSyncing) return '#D97706';
        if (status.status === 'error') return '#DC2626';
        if (status.pendingActions > 0) return '#D97706';
        return '#059669';
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Sync Status</Text>
                <View style={[styles.statusBadge, { backgroundColor: getSyncStatusColor() + '15' }]}>
                    {getSyncStatusIcon()}
                    <Text style={[styles.statusText, { color: getSyncStatusColor() }]}>
                        {getSyncStatusText()}
                    </Text>
                </View>
            </View>

            <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                    <View style={styles.statIconContainer}>
                        <Cloud size={18} color="#6B7280" />
                    </View>
                    <Text style={styles.statLabel}>Network</Text>
                    <View style={styles.statRow}>
                        {status.isOnline ? (
                            <Wifi size={14} color="#059669" />
                        ) : (
                            <WifiOff size={14} color="#DC2626" />
                        )}
                        <Text style={[
                            styles.statValue,
                            status.isOnline ? styles.online : styles.offline
                        ]}>
                            {status.isOnline ? 'Online' : 'Offline'}
                        </Text>
                    </View>
                </View>

                <View style={styles.statItem}>
                    <View style={styles.statIconContainer}>
                        <Database size={18} color="#6B7280" />
                    </View>
                    <Text style={styles.statLabel}>Local Orders</Text>
                    <Text style={styles.statValue}>
                        {status.unsyncedOrders > 0 ? (
                            <Text style={styles.hasPending}>{status.unsyncedOrders}</Text>
                        ) : (
                            status.unsyncedOrders
                        )}
                    </Text>
                </View>

                <View style={styles.statItem}>
                    <View style={styles.statIconContainer}>
                        <Clock size={18} color="#6B7280" />
                    </View>
                    <Text style={styles.statLabel}>Last Sync</Text>
                    <Text style={styles.statValue}>{formatTime(status.lastSyncTime)}</Text>
                </View>
            </View>

            <TouchableOpacity
                style={[
                    styles.syncButton,
                    status.isSyncing && styles.syncButtonDisabled,
                    !status.isOnline && styles.syncButtonOffline
                ]}
                onPress={handleSyncPress}
                disabled={status.isSyncing || !status.isOnline}
                activeOpacity={0.8}
            >
                {status.isSyncing ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                    <View style={styles.syncButtonContent}>
                        <RefreshCw size={18} color="#FFFFFF" />
                        <Text style={styles.syncButtonText}>
                            {!status.isOnline ? 'Offline - Waiting for connection' : 'Sync Now'}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 16,
        marginVertical: 8,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
            },
            android: {
                elevation: 2,
            },
            web: {
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            },
        }),
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 14,
        gap: 8,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 6,
    },
    statIconContainer: {
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 11,
        color: '#6B7280',
        fontWeight: '500',
        marginBottom: 2,
    },
    statRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
    },
    online: {
        color: '#059669',
    },
    offline: {
        color: '#DC2626',
    },
    hasPending: {
        color: '#D97706',
    },
    syncButton: {
        backgroundColor: '#111827',
        borderRadius: 10,
        paddingVertical: 12,
        alignItems: 'center',
    },
    syncButtonDisabled: {
        backgroundColor: '#9CA3AF',
    },
    syncButtonOffline: {
        backgroundColor: '#6B7280',
    },
    syncButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    syncButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 14,
    },
});