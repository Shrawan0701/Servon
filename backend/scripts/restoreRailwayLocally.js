// Read-only source backup; restores into a NEW local DB, validates it, then
// atomically swaps names. The former local DB and both dump files are kept.
require("../config/env");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Client } = require("pg");
const dotenv = require("dotenv");

const sourceFile = path.join(__dirname, "../.env.railway.local");
const sourceUrl =
  process.env.RAILWAY_DATABASE_URL ||
  (fs.existsSync(sourceFile)
    ? dotenv.parse(fs.readFileSync(sourceFile)).RAILWAY_DATABASE_URL
    : "");
const localUrl = process.env.DATABASE_URL;
const quote = (value) => '"' + String(value).replaceAll('"', '""') + '"';
function parseUrl(value) {
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("A PostgreSQL connection URL is required");
  return url;
}
function dbUrl(url, database) {
  const result = new URL(url);
  result.pathname = "/" + database;
  return result.toString();
}
function safeError(error) {
  let message = String(error?.message || error);
  for (const value of [sourceUrl, localUrl]) {
    if (!value) continue;
    message = message.replaceAll(value, "[connection redacted]");
    try {
      const password = decodeURIComponent(new URL(value).password);
      if (password) message = message.replaceAll(password, "[redacted]");
    } catch {}
  }
  return message;
}
function pgEnvironment(url, { database, remote = false, ssl = false } = {}) {
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: database || decodeURIComponent(url.pathname.slice(1)),
    PGCONNECT_TIMEOUT: "15",
    PGSSLMODE: ssl ? "require" : "disable",
    PGOPTIONS: remote
      ? "-c default_transaction_read_only=on -c lock_timeout=15000"
      : "",
  };
}
function run(binary, args, env) {
  const result = spawnSync(binary, args, {
    env,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      path.basename(binary) + " failed: " + result.stderr.slice(-3000),
    );
  return result.stdout;
}
async function sourceConnection(connectionString) {
  const normalized = new URL(connectionString);
  const requestedMode = normalized.searchParams.get("sslmode");
  normalized.searchParams.delete("sslmode");
  let client = new Client({
    connectionString: normalized.toString(),
    ssl: requestedMode === "disable" ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  try {
    await client.connect();
    return { client, ssl: requestedMode !== "disable" };
  } catch (error) {
    await client.end();
    if (
      !/does not support SSL/.test(error.message) ||
      requestedMode === "require"
    )
      throw error;
    client = new Client({
      connectionString: normalized.toString(),
      ssl: false,
      connectionTimeoutMillis: 15000,
    });
    await client.connect();
    return { client, ssl: false };
  }
}
async function describe(client) {
  const tables = (
    await client.query(
      `SELECT n.nspname AS schema,c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' ORDER BY 1,2`,
    )
  ).rows;
  const columns = (
    await client.query(
      `SELECT n.nspname AS schema,c.relname AS table_name,a.attname AS column_name,pg_catalog.format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS not_null,a.attidentity AS identity,a.attgenerated AS generated FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid WHERE c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' ORDER BY n.nspname,c.relname,a.attnum`,
    )
  ).rows;
  const counts = [];
  for (const table of tables) {
    const result = await client.query(
      `SELECT COUNT(*)::text AS rows FROM ${quote(table.schema)}.${quote(table.name)}`,
    );
    counts.push({ ...table, rows: result.rows[0].rows });
  }
  return { tables, columns, counts };
}
async function main() {
  if (!sourceUrl)
    throw new Error(
      "Set RAILWAY_DATABASE_URL in backend/.env.railway.local first",
    );
  const source = parseUrl(sourceUrl),
    local = parseUrl(localUrl);
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(local.hostname) ||
    decodeURIComponent(local.pathname.slice(1)) !== "servon"
  )
    throw new Error("Restore target must be the LOCAL servon database");
  if (
    ["localhost", "127.0.0.1", "[::1]"].includes(source.hostname) ||
    source.hostname.endsWith(".railway.internal")
  )
    throw new Error("Use the public Railway source URL");
  const bin =
    process.env.PG18_BIN ||
    path.join(process.env.LOCALAPPDATA, "Servon/tools/postgresql18/pgsql/bin");
  const dump = path.join(bin, "pg_dump.exe"),
    restore = path.join(bin, "pg_restore.exe");
  if (!fs.existsSync(dump) || !fs.existsSync(restore))
    throw new Error(
      "PostgreSQL 18 client binaries are required; set PG18_BIN to their bin directory",
    );
  const stamp = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace(/[^0-9]/g, "");
  const stage = `servon_restore_${stamp}`,
    archived = `servon_before_railway_${stamp}`;
  const directory = path.join(process.env.LOCALAPPDATA, "Servon/backups");
  fs.mkdirSync(directory, { recursive: true });
  const oldDump = path.join(
    directory,
    `servon-local-before-railway-${stamp}.dump`,
  );
  const newDump = path.join(directory, `servon-railway-${stamp}.dump`);
  const manifestFile = path.join(directory, `servon-railway-${stamp}.json`);
  let remote,
    admin,
    staging,
    snapshotOpen = false,
    switched = false,
    localConnectionsDisabled = false;
  try {
    const connection = await sourceConnection(sourceUrl);
    remote = connection.client;
    const remoteVersion = (
      await remote.query("SELECT current_setting('server_version') AS version")
    ).rows[0].version;
    const toolVersion = run(dump, ["--version"], process.env);
    if (
      Number(toolVersion.match(/PostgreSQL\) (\d+)/)?.[1] || 0) <
      Number(remoteVersion.split(".")[0])
    )
      throw new Error("The pg_dump client is older than the Railway server");
    console.log(
      `Railway PostgreSQL ${remoteVersion}; creating read-only consistent backup.`,
    );
    run(dump, ["--format=custom", "--file", oldDump], pgEnvironment(local));
    run(restore, ["--list", oldDump], process.env);
    console.log("Current local servon backup verified: " + oldDump);

    await remote.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    snapshotOpen = true;
    const snapshot = (await remote.query("SELECT pg_export_snapshot() AS id"))
      .rows[0].id;
    run(
      dump,
      [
        "--format=custom",
        "--no-owner",
        "--no-acl",
        "--snapshot",
        snapshot,
        "--file",
        newDump,
      ],
      pgEnvironment(source, { remote: true, ssl: connection.ssl }),
    );
    run(restore, ["--list", newDump], process.env);
    const expected = await describe(remote);
    await remote.query("COMMIT");
    snapshotOpen = false;
    console.log(
      `Railway backup saved; snapshot contains ${expected.tables.length} user tables.`,
    );
    const manifest = {
      captured_at: new Date().toISOString(),
      source_database: decodeURIComponent(source.pathname.slice(1)),
      source_version: remoteVersion,
      target_database: "servon",
      previous_database: archived,
      staged_database: stage,
      local_backup: oldDump,
      railway_backup: newDump,
      ...expected,
      validated: false,
      switched: false,
    };
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));

    admin = new Client({
      connectionString: dbUrl(localUrl, "postgres"),
      ssl: false,
      connectionTimeoutMillis: 15000,
    });
    await admin.connect();
    const lock = await admin.query(
      "SELECT pg_try_advisory_lock(hashtext('servon_local_restore')) AS locked",
    );
    if (!lock.rows[0].locked)
      throw new Error("Another local restore is already running");
    await admin.query(`CREATE DATABASE ${quote(stage)} TEMPLATE template0`);
    console.log("Restoring into a separate local staging database: " + stage);
    run(
      restore,
      [
        "--single-transaction",
        "--exit-on-error",
        "--no-owner",
        "--no-acl",
        "--dbname",
        stage,
        newDump,
      ],
      pgEnvironment(local, { database: stage }),
    );
    staging = new Client({
      connectionString: dbUrl(localUrl, stage),
      ssl: false,
    });
    await staging.connect();
    const actual = await describe(staging);
    for (const key of ["tables", "columns", "counts"])
      if (JSON.stringify(expected[key]) !== JSON.stringify(actual[key]))
        throw new Error(
          `Staging validation failed for ${key}. Existing local servon was not replaced.`,
        );
    await staging.end();
    staging = null;
    manifest.validated = true;
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
    console.log(
      "Staging validated: table list, column definitions and every table row count match the Railway backup snapshot.",
    );

    // Only the confirmed loopback target is changed. Keep the previous DB,
    // prevent reconnect races, terminate LOCAL sessions and swap names atomically.
    await admin.query(
      `ALTER DATABASE ${quote("servon")} ALLOW_CONNECTIONS false`,
    );
    localConnectionsDisabled = true;
    await admin.query(`ALTER DATABASE ${quote(stage)} ALLOW_CONNECTIONS false`);
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ($1,$2) AND pid<>pg_backend_pid()",
      ["servon", stage],
    );
    await admin.query("BEGIN");
    try {
      await admin.query(
        `ALTER DATABASE ${quote("servon")} RENAME TO ${quote(archived)}`,
      );
      await admin.query(
        `ALTER DATABASE ${quote(stage)} RENAME TO ${quote("servon")}`,
      );
      await admin.query(
        `ALTER DATABASE ${quote("servon")} ALLOW_CONNECTIONS true`,
      );
      await admin.query("COMMIT");
      switched = true;
    } catch (error) {
      await admin.query("ROLLBACK");
      throw error;
    }
    manifest.switched = true;
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
    console.log(
      "Restore complete. Local servon now contains the verified Railway snapshot.",
    );
    console.log("Previous local database retained as: " + archived);
    console.log("Restore report: " + manifestFile);
  } finally {
    if (snapshotOpen && remote) await remote.query("ROLLBACK").catch(() => {});
    if (staging) await staging.end().catch(() => {});
    if (admin) {
      if (localConnectionsDisabled && !switched)
        await admin
          .query("ALTER DATABASE servon ALLOW_CONNECTIONS true")
          .catch(() => {});
      await admin.end().catch(() => {});
    }
    if (remote) await remote.end().catch(() => {});
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(safeError(error));
    process.exitCode = 1;
  });
module.exports = { describe, quote, dbUrl, pgEnvironment, run, safeError };
