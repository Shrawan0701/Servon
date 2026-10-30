import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import POSRepository from './POSRepository';
import migrateLegacyPOS from './migrateLegacyPOS';

let connection;
async function database() {
  if (!connection) connection = (async () => {
    const db = await SQLite.openDatabaseAsync('servon.db');
    await db.execAsync('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS pos_snapshots (business_id TEXT PRIMARY KEY, data TEXT NOT NULL);');
    return db;
  })();
  return connection;
}
async function legacyRows(table) {
  try { return await (await database()).getAllAsync(`SELECT * FROM ${table}`); }
  catch (error) { if (/no such table/i.test(error.message)) return []; throw error; }
}
export default new POSRepository({
  scope: async () => JSON.parse(await AsyncStorage.getItem('business') || 'null')?.id || 'guest',
  async read(scope) {
    const row = await (await database()).getFirstAsync('SELECT data FROM pos_snapshots WHERE business_id = ?', [scope]);
    return row ? JSON.parse(row.data) : null;
  },
  async write(scope, state) {
    await (await database()).runAsync('INSERT OR REPLACE INTO pos_snapshots (business_id, data) VALUES (?, ?)', [scope, JSON.stringify(state)]);
  },
  async migrate(scope) {
    if (scope === 'guest') return {};
    const owner = await AsyncStorage.getItem('servon-pos-legacy-owner');
    if (owner && owner !== scope) return {};
    await AsyncStorage.setItem('servon-pos-legacy-owner', scope);
    const [orderRows, tableRows, menuRows, dueRows, actionRows, cacheRows] = await Promise.all(['orders', 'tables_cache', 'menu_items', 'customer_outstandings', 'offline_actions', 'cache'].map(legacyRows));
    return migrateLegacyPOS({
      orders: orderRows.map((o) => ({ ...o, items: JSON.parse(o.items || '[]') })),
      tables: tableRows.map((r) => JSON.parse(r.data)), menu: menuRows.map((r) => JSON.parse(r.data)),
      dues: dueRows.map((r) => JSON.parse(r.data)), actions: actionRows.map((a) => ({ ...a, data: JSON.parse(a.data || '{}') })),
      profile: JSON.parse(cacheRows.find((r) => r.key === 'profile')?.value || 'null'),
    });
  },
});
