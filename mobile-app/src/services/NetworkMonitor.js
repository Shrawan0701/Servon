// src/services/NetworkMonitor.js
import { Platform } from 'react-native';

class NetworkMonitor {
    constructor() {
        this.isOnline = true;
        this.listeners = [];
        this.connectionType = 'unknown';
        this.isNative = Platform.OS !== 'web';

        if (this.isNative) {
            this.setupNativeListener();
        } else {
            this.setupWebListener();
        }
    }

    async setupNativeListener() {
        try {
            const NetInfo = await import('@react-native-community/netinfo');
            NetInfo.default.addEventListener(state => {
                const wasOnline = this.isOnline;
                this.isOnline = state.isConnected && state.isInternetReachable !== false;
                this.connectionType = state.type;

                if (wasOnline !== this.isOnline) {
                    console.log(`Network: ${this.isOnline ? 'ONLINE' : 'OFFLINE'}`);
                    this.notifyListeners(this.isOnline);
                }
            });

            const state = await NetInfo.default.fetch();
            this.isOnline = state.isConnected && state.isInternetReachable !== false;
        } catch (error) {
            console.error('NetInfo setup error:', error);
            this.setupWebListener();
        }
    }

    setupWebListener() {
        this.isOnline = navigator.onLine;
        this.connectionType = 'web';

        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('Network: ONLINE');
            this.notifyListeners(true);
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('Network: OFFLINE');
            this.notifyListeners(false);
        });

        setInterval(() => {
            const wasOnline = this.isOnline;
            this.isOnline = navigator.onLine;
            if (wasOnline !== this.isOnline) {
                this.notifyListeners(this.isOnline);
            }
        }, 30000);
    }

    async checkConnectivity() {
        if (this.isNative) {
            try {
                const NetInfo = await import('@react-native-community/netinfo');
                const state = await NetInfo.default.fetch();
                this.isOnline = state.isConnected && state.isInternetReachable !== false;
                return this.isOnline;
            } catch (error) {
                return navigator.onLine;
            }
        }
        this.isOnline = navigator.onLine;
        return this.isOnline;
    }

    subscribe(callback) {
        this.listeners.push(callback);
        callback(this.isOnline);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    notifyListeners(isOnline) {
        this.listeners.forEach(callback => callback(isOnline));
    }

    getStatus() {
        return {
            isOnline: this.isOnline,
            connectionType: this.connectionType
        };
    }
}

const networkMonitor = new NetworkMonitor();
export default networkMonitor;