require("../config/env");
const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  connectionTimeoutMillis: 8000,
});
(async () => {
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN READ ONLY");
    const columns = await client.query(
      `SELECT table_name,column_name,data_type,numeric_precision,numeric_scale FROM information_schema.columns WHERE table_schema=current_schema() AND table_name IN ('inventory_items','menu_item_ingredients','inventory_stock_logs','businesses','orders','menu_items') ORDER BY table_name,ordinal_position`,
    );
    console.log("Database schema (read only):");
    console.table(columns.rows);
    const constraints = await client.query(
      `SELECT conrelid::regclass::text AS table_name, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid IN (to_regclass('inventory_items'),to_regclass('menu_item_ingredients'),to_regclass('inventory_stock_logs'))`,
    );
    console.table(constraints.rows);
    const names = new Set(columns.rows.map((c) => c.table_name));
    for (const table of [
      "inventory_items",
      "menu_item_ingredients",
      "inventory_stock_logs",
    ])
      if (!names.has(table))
        console.log(`${table}: absent; inventory migration creates it.`);
    const required = {
      businesses: ["id"],
      menu_items: ["id"],
      orders: ["id", "business_id", "items"],
    };
    for (const [table, fields] of Object.entries(required)) {
      for (const field of fields)
        if (
          !columns.rows.some(
            (c) => c.table_name === table && c.column_name === field,
          )
        )
          throw new Error(`Missing prerequisite: ${table}.${field}`);
    }
    await client.query("COMMIT");
    console.log("Inspection finished. No database changes were made.");
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    console.log("Schema inspection unavailable:", error.code || error.message);
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await pool.end();
  }
})();
