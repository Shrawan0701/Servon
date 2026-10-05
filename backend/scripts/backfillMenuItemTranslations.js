require("dotenv").config();

const pool = require("../db");
const { translateMenuItemName } = require("../services/menuTranslationService");

function isMissing(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

async function main() {
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Math.max(1, parseInt(limitArg.split("=")[1], 10) || 0) : null;

  const query = `
    SELECT id, name, name_mr, name_hi
    FROM menu_items
    WHERE name IS NOT NULL
      AND TRIM(name) <> ''
      AND (
        name_mr IS NULL OR TRIM(name_mr) = ''
        OR name_hi IS NULL OR TRIM(name_hi) = ''
      )
    ORDER BY created_at ASC
    ${limit ? "LIMIT $1" : ""}
  `;
  const { rows } = await pool.query(query, limit ? [limit] : []);

  console.log(`Found ${rows.length} menu item(s) needing translations.`);

  let updated = 0;
  let skipped = 0;

  for (const item of rows) {
    const translations = await translateMenuItemName(item.name);
    const nextMr = isMissing(item.name_mr) ? translations.name_mr : null;
    const nextHi = isMissing(item.name_hi) ? translations.name_hi : null;

    if (!nextMr && !nextHi) {
      skipped += 1;
      console.log(`Skipped ${item.id} (${item.name}) - no translation returned.`);
      continue;
    }

    await pool.query(
      `
        UPDATE menu_items
        SET
          name_mr = CASE
            WHEN (name_mr IS NULL OR TRIM(name_mr) = '') THEN COALESCE($2, name_mr)
            ELSE name_mr
          END,
          name_hi = CASE
            WHEN (name_hi IS NULL OR TRIM(name_hi) = '') THEN COALESCE($3, name_hi)
            ELSE name_hi
          END,
          updated_at = NOW()
        WHERE id = $1
      `,
      [item.id, nextMr, nextHi]
    );
    updated += 1;
    console.log(`Updated ${item.id} (${item.name})`);
  }

  console.log(`Done. Updated: ${updated}. Skipped: ${skipped}.`);
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
