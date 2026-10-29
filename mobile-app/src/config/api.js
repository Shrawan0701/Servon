// One backend origin for login, REST requests, sockets and download links.
// Expo embeds EXPO_PUBLIC_* values; use .env.development.local for local work
// and the existing hosting/build environment for production.
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  (__DEV__ ? 'http://localhost:5000' : 'https://servon.onrender.com')
).replace(/\/+$/, '').replace(/\/api$/, '');

export const ADVISOR_API_BASE_URL = (
  process.env.EXPO_PUBLIC_ADVISOR_API_URL || `${API_BASE_URL}/api`
).replace(/\/+$/, '');
