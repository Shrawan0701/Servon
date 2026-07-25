// src/services/OfflineAPI.js
import localDB from './LocalDB';
import networkMonitor from './NetworkMonitor';

class OfflineAPI {
    constructor(baseURL) {
        this.baseURL = baseURL;
        this.timeout = 10000;
    }

    async request(config) {
        const { method, url, data, params, cache = true, ttl = 3600 } = config;

        const fullUrl = this.buildURL(url, params);
        const cacheKey = method === 'GET' ? fullUrl : null;

        if (method === 'GET' && cache) {
            const cached = await localDB.getCache(cacheKey);
            if (cached) {
                console.log(`Cache hit: ${url}`);
                return cached;
            }
        }

        const isOnline = await networkMonitor.checkConnectivity();

        if (!isOnline) {
            if (method === 'GET') {
                const cached = await localDB.getCache(cacheKey);
                if (cached) {
                    console.log(`Offline cache hit: ${url}`);
                    return cached;
                }
                throw new Error('No internet connection and no cached data available');
            }

            await localDB.queueAction(
                method,
                url,
                'pending',
                data,
                method === 'POST' || method === 'DELETE' ? 1 : 2
            );
            throw new Error('No internet connection. Changes will sync when online.');
        }

        try {
            const response = await this.fetchWithTimeout(fullUrl, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeaders()
                },
                body: data ? JSON.stringify(data) : undefined
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `HTTP ${response.status}`);
            }

            if (method === 'GET' && cache && result) {
                await localDB.setCache(cacheKey, result, ttl);
            }

            if (method !== 'GET' && !data?._skipOfflineQueue) {
                await localDB.queueAction(
                    method,
                    url,
                    'synced',
                    data || { id: result.id }
                );
            }

            return result;

        } catch (error) {
            if (method === 'GET') {
                const cached = await localDB.getCache(cacheKey);
                if (cached) {
                    console.log(`Request failed, using cached data: ${url}`);
                    return cached;
                }
            }
            throw error;
        }
    }

    async fetchWithTimeout(url, options) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    buildURL(url, params = {}) {
        const fullUrl = `${this.baseURL}${url}`;
        if (Object.keys(params).length === 0) return fullUrl;
        const queryString = new URLSearchParams(params).toString();
        return `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}${queryString}`;
    }

    getAuthHeaders() {
        return {};
    }

    async get(url, params = {}, options = {}) {
        return this.request({
            method: 'GET',
            url,
            params,
            ...options
        });
    }

    async post(url, data, options = {}) {
        return this.request({
            method: 'POST',
            url,
            data,
            ...options
        });
    }

    async put(url, data, options = {}) {
        return this.request({
            method: 'PUT',
            url,
            data,
            ...options
        });
    }

    async delete(url, options = {}) {
        return this.request({
            method: 'DELETE',
            url,
            ...options
        });
    }
}

const api = new OfflineAPI('https://api.servon.com');
export default api;