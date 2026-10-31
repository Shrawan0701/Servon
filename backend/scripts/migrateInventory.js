require("../config/env");
const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  connectionTimeoutMillis: 10000,
});
(async () => {
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '15s'");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('servon_inventory_migrations'))",
    );
    await client.query(
      "CREATE TABLE IF NOT EXISTS inventory_schema_versions(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
    );
    const version = "20261028_inventory_upgrade";
    const applied = await client.query(
      "SELECT 1 FROM inventory_schema_versions WHERE version=$1",
      [version],
    );
    if (!applied.rowCount) {
      const columns = await client.query(
        "SELECT table_name,column_name,data_type,numeric_scale FROM information_schema.columns WHERE table_schema=current_schema() AND table_name IN ('inventory_items','menu_item_ingredients','inventory_stock_logs')",
      );
      const id = columns.rows.find(
        (c) => c.table_name === "inventory_items" && c.column_name === "id",
      );
      if (id && id.data_type !== "integer")
        throw new Error(
          "Existing inventory_items.id is not an integer. Review the deployed schema before applying this migration.",
        );
      for (const c of columns.rows)
        if (
          [
            "current_stock",
            "low_stock_threshold",
            "quantity_required",
            "change_amount",
          ].includes(c.column_name) &&
          Number(c.numeric_scale) > 6
        )
          throw new Error(
            `${c.table_name}.${c.column_name} has more than six decimal places. Review precision before migrating.`,
          );
      await client.query(
        fs.readFileSync(
          path.join(__dirname, "../db/migrations", `${version}.sql`),
          "utf8",
        ),
      );
      await client.query(
        "INSERT INTO inventory_schema_versions(version) VALUES($1)",
        [version],
      );
    }
    const bottleVersion = "20261031_inventory_bottle_sources";
    const bottleApplied = await client.query("SELECT 1 FROM inventory_schema_versions WHERE version=$1", [bottleVersion]);
    if (!bottleApplied.rowCount) {
      await client.query(fs.readFileSync(path.join(__dirname, "../db/migrations", `${bottleVersion}.sql`), "utf8"));
      await client.query("INSERT INTO inventory_schema_versions(version) VALUES($1)", [bottleVersion]);
    }
    await client.query("COMMIT");
    console.log(
      applied.rowCount && bottleApplied.rowCount
        ? "Inventory migration already applied"
        : "Inventory migration applied",
    );
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    console.error("Inventory migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await pool.end();
  }
})();
