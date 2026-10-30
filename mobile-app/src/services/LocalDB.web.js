import AsyncStorage from '@react-native-async-storage/async-storage';
import POSRepository from './POSRepository';
import migrateLegacyPOS from './migrateLegacyPOS';

const read = async (key) => { const value = await AsyncStorage.getItem(key); return value ? JSON.parse(value) : null; };
let databasePromise;
function database() {
  if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('servon-pos', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { databasePromise = null; reject(request.error); };
  });
  return databasePromise;
}
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('servon-pos-changes') : null;
async function readSnapshot(scope) {
  if (typeof indexedDB === 'undefined') return read(`servon-pos-v1:${scope}`);
  const db = await database();
  const stored = await new Promise((resolve, reject) => {
    const request = db.transaction('snapshots', 'readonly').objectStore('snapshots').get(scope);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  if (stored) return stored;
  // Preserve snapshots produced before the IndexedDB adapter was installed.
  return read(`servon-pos-v1:${scope}`);
}
async function writeSnapshot(scope, state) {
  if (typeof indexedDB === 'undefined') await AsyncStorage.setItem(`servon-pos-v1:${scope}`, JSON.stringify(state));
  else {
    const db = await database();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('snapshots', 'readwrite');
      const store = tx.objectStore('snapshots');
      const current = store.get(scope);
      let conflict = false;
      current.onsuccess = () => {
        if (Number(current.result?.storage_revision || 0) !== Number(state.storage_revision || 0)) {
          conflict = true; tx.abort(); return;
        }
        store.put({ ...state, storage_revision: Number(state.storage_revision || 0) + 1 }, scope);
      };
      tx.oncomplete = () => { state.storage_revision = Number(state.storage_revision || 0) + 1; resolve(); };
      tx.onerror = () => reject(tx.error || new Error('Unable to save on this device'));
      tx.onabort = () => reject(conflict ? Object.assign(new Error('Another tab saved a change'), { code: 'POS_WRITE_CONFLICT' }) : tx.error || new Error('Save was interrupted'));
    });
  }
  channel?.postMessage({ scope });
}
const repository = new POSRepository({
  shared: true,
  scope: async () => (await read('business'))?.id || 'guest',
  read: readSnapshot,
  write: writeSnapshot,
  lock: (scope, fn) => typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request(`servon-pos:${scope}`, fn)
    : fn(),
  async migrate(scope) {
    if (scope === 'guest') return {};
    const owner = await AsyncStorage.getItem('servon-pos-legacy-owner');
    if (owner && owner !== scope) return {};
    await AsyncStorage.setItem('servon-pos-legacy-owner', scope);
    const [orders, tables, menu, profile, dues, actions] = await Promise.all(['orders', 'tables', 'menu_items', 'profile', 'customer_outstandings', 'offline_actions'].map(read));
    return migrateLegacyPOS({ orders: orders || [], tables: tables || [], menu: menu || [], profile, dues: dues || [], actions: actions || [] });
  },
});
if (typeof window !== 'undefined') window.addEventListener('storage', (event) => {
  if (event.key?.startsWith('servon-pos-v1:')) { repository.state = null; repository.notify(); }
});
if (channel) channel.onmessage = () => { repository.state = null; repository.notify(); };
export default repository;
