const pool = require("../db");
async function lockTenant(client, businessId) {
  await client.query("SET LOCAL lock_timeout = '15s'");
  await client.query("SET LOCAL statement_timeout = '30s'");
  // One lock ordering for orders, restocks, recipes and counts. Branches cannot
  // bypass isolation: only the authenticated business is accepted by callers.
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
    `inventory:${businessId}`,
  ]);
}
async function transaction(businessId, fn, suppliedClient) {
  if (suppliedClient) {
    await lockTenant(suppliedClient, businessId);
    return fn(suppliedClient);
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await lockTenant(client, businessId);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
module.exports = { transaction, lockTenant };
