import API from '../api';
import localDB from './LocalDB';
import networkMonitor from './NetworkMonitor';

const inFlight = new Map();
const resources = {
  orders: ['/orders', (rows) => localDB.saveOrders(rows)],
  menu: ['/menu', (rows) => localDB.saveMenu(rows)],
  tables: ['/tables', (rows) => localDB.saveTables(rows)],
  profile: ['/profile', (profile) => localDB.saveProfile(profile)],
  dues: ['/orders/outstanding', (data) => localDB.cacheCustomerOutstandings(data.records || [])],
};
export async function refreshPOSData(names = Object.keys(resources)) {
  if (!networkMonitor.isOnline) return;
  const scope = await localDB.run(() => localDB.scope);
  return Promise.allSettled(names.map((name) => {
    const key = `${scope}:${name}`;
    if (inFlight.has(key)) return inFlight.get(key);
    const [url, save] = resources[name];
    const task = API.get(url, { timeout: 6000, posBusinessId: scope }).then(async (res) => {
      if (await localDB.run(() => localDB.scope) === scope) await save(res.data);
    }).finally(() => inFlight.delete(key));
    inFlight.set(key, task);
    return task;
  }));
}
