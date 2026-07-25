// src/components/OfflineIndicator.js
import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    TouchableOpacity,
    Platform
} from 'react-native';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react-native';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export function OfflineIndicator({ onPress }) {
    const { isOnline, pendingActions, isSyncing } = useNetworkStatus();
    const [fadeAnim] = React.useState(new Animated.Value(0));

    React.useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: (!isOnline || pendingActions > 0 || isSyncing) ? 1 : 0,
            duration: 300,
            useNativeDriver: true
        }).start();
    }, [isOnline, pendingActions, isSyncing]);

    if (isOnline && pendingActions === 0 && !isSyncing) return null;

    let statusText = '';
    let backgroundColor = '#059669';
    let icon = null;

    if (isSyncing) {
        statusText = 'Syncing changes...';
        backgroundColor = '#D97706';
        icon = <RefreshCw size={18} color="#FFFFFF" style={styles.icon} />;
    } else if (!isOnline) {
        statusText = 'You are offline. Changes will sync when online.';
        backgroundColor = '#DC2626';
        icon = <WifiOff size={18} color="#FFFFFF" style={styles.icon} />;
    } else if (pendingActions > 0) {
        statusText = `${pendingActions} change${pendingActions > 1 ? 's' : ''} pending sync`;
        backgroundColor = '#D97706';
        icon = <AlertCircle size={18} color="#FFFFFF" style={styles.icon} />;
    }

    return (
        <Animated.View style={[
            styles.container,
            { opacity: fadeAnim, backgroundColor }
        ]}>
            <TouchableOpacity onPress={onPress} style={styles.content} activeOpacity={0.8}>
                <View style={styles.row}>
                    {icon}
                    <Text style={styles.text}>{statusText}</Text>
                </View>
                {!isOnline && (
                    <Text style={styles.subText}>Connect to internet to sync your changes</Text>
                )}
                {pendingActions > 0 && isOnline && (
                    <TouchableOpacity onPress={onPress} style={styles.syncNowBtn}>
                        <Text style={styles.syncNowText}>Sync Now</Text>
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingVertical: 10,
        paddingHorizontal: 16,
        zIndex: 999,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            android: {
                elevation: 4,
            },
            web: {
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            },
        }),
    },
    content: {
        alignItems: 'center',
        width: '100%',
        maxWidth: 1200,
        alignSelf: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    icon: {
        marginRight: 4,
    },
    text: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 14,
        textAlign: 'center',
    },
    subText: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 12,
        marginTop: 4,
        textAlign: 'center',
    },
    syncNowBtn: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 6,
        marginTop: 6,
    },
    syncNowText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 12,
    },
});