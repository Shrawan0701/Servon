// Migrate cached data and queued work once per account.
export default function migrateLegacyPOS({ orders = [], tables = [], menu = [], profile = null, dues = [], actions = [] }) {
  const locals = new Map(orders.filter((o) => String(o.id).startsWith('local_order_')).map((o) => [String(o.id), o]));
  const migrated = actions.filter((a) => !(locals.has(String(a.record_id)) && a.action_type !== 'CREATE')).map((a) => ({ ...a, status: 'pending', next_attempt_at: 0, legacy: true }));
  for (const a of migrated) if (a.table_name === 'orders' && a.action_type === 'CREATE' && locals.has(String(a.record_id))) a.data = { order: { ...locals.get(String(a.record_id)) } };
  for (const [id, order] of locals) {
    if (order.status !== 'CONFIRMED' && migrated.some((a) => a.table_name === 'orders' && String(a.record_id) === id && a.action_type === 'CREATE')) migrated.push({ id: `legacy-status-${id}`, action_type: 'UPDATE', table_name: 'orders', record_id: id, data: { status: order.status }, created_at: order.updated_at, status: 'pending', retry_count: 0 });
  }
  migrated.sort((a, b) => (a.table_name === 'tables' && a.action_type === 'CREATE' ? -1 : 0) - (b.table_name === 'tables' && b.action_type === 'CREATE' ? -1 : 0) || new Date(a.created_at) - new Date(b.created_at));
  return { orders, tables, menu, profile, dues, actions: migrated };
}
