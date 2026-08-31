// src/components/NotificationBell.js

import React from 'react';
import {
    View,
    Text as NativeText,
    TouchableOpacity,
    StyleSheet,
} from "react-native";
import LocalizedText from "./LocalizedText";

export default function NotificationBell({ unreadCount = 0, onPress }) {
    return (
        <TouchableOpacity onPress={onPress} style={styles.container}>
            <LocalizedText translate style={styles.bellIcon}>🔔</LocalizedText>
            {unreadCount > 0 && (
                <View style={styles.badge}>
                    <LocalizedText style={styles.badgeText}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </LocalizedText>
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 8,
        position: 'relative',
    },
    bellIcon: {
        fontSize: 24,
    },
    badge: {
        position: 'absolute',
        top: 2,
        right: 2,
        backgroundColor: '#FF4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: 'white',
        fontSize: 11,
        fontWeight: 'bold',
    },
});