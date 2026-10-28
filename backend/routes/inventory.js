const express = require("express");
const crypto = require("node:crypto");
const pool = require("../db");
const auth = require("../middleware/auth");
const owner = require("../middleware/inventoryOwner");
const { transaction } = require("../services/inventoryTransaction");
const {
  fail,
  number,
  round,
  physicalQuantity,
} = require("../services/inventoryUnits");
const recipes = require("../services/inventoryRecipes");
const vision = require("../services/inventoryVision");
const router = express.Router();
router.use(auth);
const route = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "inventory_request_failed",
        method: req.method,
        path: req.route?.path,
        status: error.status || 500,
        code: error.code || null,
      }),
    );
    res
      .status(
        error.status ||
          (["23503", "23505", "23514", "22P02"].includes(error.code)
            ? 400
            : 500),
      )
      .json({
        error: error.status
          ? error.message
          : "Inventory request could not be completed. Check the data and retry.",
      });
  }
};
const name = (value) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 255)
    fail("A name of 1–255 characters is required");
  return value.trim();
};
const unit = (value) => {
  if (!["kg", "gm", "ml", "litre", "pcs"].includes(value))
    fail("Unsupported stock unit");
  return value;
};
const actor = (req) => String(req.actor || `business:${req.businessId}`);
async function log(db, req, id, amount, reason, extra = {}) {
  await db.query(
    `INSERT INTO inventory_stock_logs(business_id,inventory_item_id,change_amount,reason,actor,unit,note,physical_count_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      req.businessId,
      id,
      amount,
      reason,
      actor(req),
      extra.unit || null,
      extra.note || null,
      extra.countId || null,
    ],
  );
}
router.get(
  "/",
  route(async (req, res) =>
    res.json(
      (
        await pool.query(
          "SELECT *, (current_stock<=low_stock_threshold) AS is_low FROM inventory_items WHERE business_id=$1 AND NOT archived ORDER BY name",
          [req.businessId],
        )
      ).rows,
    ),
  ),
);
router.get(
  "/alerts/count",
  route(async (req, res) =>
    res.json(
      (
        await pool.query(
          "SELECT COUNT(*)::int AS count FROM inventory_items WHERE business_id=$1 AND NOT archived AND current_stock<=low_stock_threshold",
          [req.businessId],
        )
      ).rows[0],
    ),
  ),
);
router.get(
  "/history",
  route(async (req, res) => {
    const limit = 50,
      offset = Math.max(
        0,
        Math.min(100000, parseInt(req.query.offset, 10) || 0),
      );
    res.json(
      (
        await pool.query(
          `SELECT l.*,i.name FROM inventory_stock_logs l LEFT JOIN inventory_items i ON i.id=l.inventory_item_id AND i.business_id=l.business_id
    WHERE l.business_id=$1 ORDER BY l.created_at DESC,l.id DESC LIMIT $2 OFFSET $3`,
          [req.businessId, limit, offset],
        )
      ).rows,
    );
  }),
);
router.post(
  "/",
  owner,
  route(async (req, res) => {
    const b = req.body,
      stockUnit = unit(b.unit),
      qty = number(b.current_stock ?? 0, "Stock", { zero: true }),
      threshold = number(b.low_stock_threshold ?? 0, "Threshold", {
        zero: true,
      });
    const bottleSize =
      ["ml", "litre"].includes(stockUnit) && b.bottle_size != null
        ? number(b.bottle_size, "Bottle size")
        : null;
    const result = await transaction(req.businessId, async (db) => {
      const duplicate = await db.query(
        "SELECT id FROM inventory_items WHERE business_id=$1 AND NOT archived AND lower(trim(name))=lower($2) AND unit=$3",
        [req.businessId, name(b.name), stockUnit],
      );
      if (duplicate.rowCount)
        fail(
          "A stock item with this name and unit already exists. Use Add Stock.",
          409,
        );
      const r = await db.query(
        "INSERT INTO inventory_items(business_id,name,unit,current_stock,low_stock_threshold,bottle_size) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
        [req.businessId, name(b.name), stockUnit, qty, threshold, bottleSize],
      );
      await log(db, req, r.rows[0].id, qty, "opening_stock", {
        unit: stockUnit,
      });
      return r.rows[0];
    });
    res.status(201).json(result);
  }),
);
router.get(
  "/recipes",
  route(async (req, res) =>
    res.json(
      (
        await pool.query(
          `SELECT m.id,m.name,m.category,m.menu_type,m.liquor_brand_code,m.size_ml,
  ((SELECT COUNT(*) FROM menu_item_ingredients i WHERE i.menu_item_id=m.id AND i.business_id=m.business_id)+
   (SELECT COUNT(*) FROM menu_item_preparations p WHERE p.menu_item_id=m.id AND p.business_id=m.business_id))::int AS ingredient_count
  FROM menu_items m WHERE m.business_id=$1 ORDER BY m.category,m.name`,
          [req.businessId],
        )
      ).rows,
    ),
  ),
);

// Preview uses exactly the same validation as apply. An apply is all-or-nothing;
// failures identify the offending dish and leave every selected dish unchanged.
router.post(
  "/recipes/bulk",
  owner,
  route(async (req, res) => {
    const { changes, mode = "merge", preview = false } = req.body;
    if (!Array.isArray(changes) || !changes.length || changes.length > 250)
      fail("Choose between 1 and 250 menu items");
    if (!["merge", "replace"].includes(mode)) fail("Choose merge or replace");
    const seen = new Set();
    const result = await transaction(req.businessId, async (db) => {
      const cat = await recipes.catalogue(db, req.businessId),
        output = [];
      for (const change of changes) {
        if (
          !change ||
          typeof change !== "object" ||
          typeof change.menu_item_id !== "string"
        )
          fail("Each bulk change requires a menu item ID");
        if (seen.has(change.menu_item_id))
          fail("Duplicate menu item in bulk operation");
        seen.add(change.menu_item_id);
        try {
          const before = await recipes.readRecipe(
            db,
            req.businessId,
            change.menu_item_id,
          );
          const validated = recipes.validateIngredients(
            change.ingredients,
            cat,
          );
          const key = (r) =>
            r.preparation_id
              ? `p:${r.preparation_id}`
              : `i:${r.inventory_item_id}`;
          const after = new Map(
            (mode === "merge" ? before : []).map((r) => [key(r), r]),
          );
          validated.forEach((r) => after.set(key(r), r));
          output.push({
            menu_item_id: change.menu_item_id,
            before,
            after: [...after.values()],
            status: preview ? "preview" : "saved",
          });
          if (!preview)
            await recipes.saveRecipe(
              db,
              req.businessId,
              change.menu_item_id,
              change.ingredients,
              mode,
              cat,
            );
        } catch (error) {
          error.message = `Menu item ${change.menu_item_id}: ${error.message}`;
          throw error;
        }
      }
      const token = crypto
        .createHash("sha256")
        .update(JSON.stringify(output.map((r) => [r.menu_item_id, r.before])))
        .digest("hex");
      if (
        !preview &&
        req.body.preview_token &&
        req.body.preview_token !== token
      )
        fail(
          "A recipe changed after preview. Preview the operation again.",
          409,
        );
      return { mode, preview, preview_token: token, results: output };
    });
    res.json(result);
  }),
);
router.get(
  "/recipes/:menuItemId",
  route(async (req, res) =>
    res.json(
      await recipes.readRecipe(pool, req.businessId, req.params.menuItemId),
    ),
  ),
);
router.put(
  "/recipes/:menuItemId",
  owner,
  route(async (req, res) =>
    res.json(
      await transaction(req.businessId, (db) =>
        recipes.saveRecipe(
          db,
          req.businessId,
          req.params.menuItemId,
          req.body.ingredients,
        ),
      ),
    ),
  ),
);

router.get(
  "/preparations",
  route(async (req, res) => {
    const cat = await recipes.catalogue(pool, req.businessId);
    res.json(
      cat.preparations
        .filter((p) => !p.archived)
        .map((p) => ({
          ...p,
          ingredients: cat.components
            .filter((c) => c.preparation_id === p.id)
            .map((c) => ({
              inventory_item_id: c.inventory_item_id,
              preparation_id: c.component_preparation_id,
              quantity_required: c.quantity_required,
            })),
        })),
    );
  }),
);
async function savePreparation(req, id) {
  return transaction(req.businessId, async (db) => {
    const b = req.body,
      cat = await recipes.catalogue(db, req.businessId);
    const ingredients = recipes.validateIngredients(b.ingredients, cat);
    if (!ingredients.length)
      fail("Add at least one ingredient to the preparation");
    const values = [
      name(b.name),
      number(b.yield_quantity, "Batch yield"),
      unit(b.yield_unit),
      number(b.wastage_percent ?? 0, "Wastage", { zero: true }),
    ];
    if (values[3] >= 100) fail("Wastage must be less than 100%");
    let row;
    if (id) {
      const result = await db.query(
        `UPDATE inventory_preparations SET name=$1,yield_quantity=$2,yield_unit=$3,wastage_percent=$4,version=version+1,updated_at=NOW()
      WHERE id=$5 AND business_id=$6 AND version=$7 AND NOT archived RETURNING *`,
        [...values, id, req.businessId, b.version],
      );
      if (!result.rowCount)
        fail(
          "Preparation changed or is unavailable. Reload before saving.",
          409,
        );
      row = result.rows[0];
      const old = cat.preparations.find((p) => Number(p.id) === Number(id));
      if (old.yield_unit !== row.yield_unit)
        fail(
          "Keep the existing yield unit to preserve linked recipes. Create a separate preparation for a different unit.",
        );
      await db.query(
        "DELETE FROM inventory_preparation_components WHERE business_id=$1 AND preparation_id=$2",
        [req.businessId, id],
      );
    } else {
      const result = await db.query(
        "INSERT INTO inventory_preparations(name,yield_quantity,yield_unit,wastage_percent,business_id) VALUES($1,$2,$3,$4,$5) RETURNING *",
        [...values, req.businessId],
      );
      row = result.rows[0];
    }
    for (const c of ingredients)
      await db.query(
        "INSERT INTO inventory_preparation_components(business_id,preparation_id,inventory_item_id,component_preparation_id,quantity_required) VALUES($1,$2,$3,$4,$5)",
        [
          req.businessId,
          row.id,
          c.inventory_item_id,
          c.preparation_id,
          c.quantity_required,
        ],
      );
    recipes.assertAcyclic(await recipes.catalogue(db, req.businessId));
    return { ...row, ingredients };
  });
}
router.post(
  "/preparations",
  owner,
  route(async (req, res) => res.status(201).json(await savePreparation(req))),
);
router.put(
  "/preparations/:id",
  owner,
  route(async (req, res) =>
    res.json(await savePreparation(req, req.params.id)),
  ),
);
router.delete(
  "/preparations/:id",
  owner,
  route(async (req, res) => {
    res.json(
      await transaction(req.businessId, async (db) => {
        const used = await db.query(
          `SELECT 1 FROM menu_item_preparations WHERE preparation_id=$1 AND business_id=$2 UNION ALL
      SELECT 1 FROM inventory_preparation_components WHERE component_preparation_id=$1 AND business_id=$2`,
          [req.params.id, req.businessId],
        );
        if (used.rowCount)
          fail("Remove this preparation from recipes before archiving it", 409);
        const r = await db.query(
          "UPDATE inventory_preparations SET archived=true WHERE id=$1 AND business_id=$2 RETURNING id",
          [req.params.id, req.businessId],
        );
        if (!r.rowCount) fail("Preparation not found", 404);
        return { archived: true };
      }),
    );
  }),
);

router.get(
  "/scans",
  route(async (req, res) =>
    res.json(
      (
        await pool.query(
          "SELECT id,status,detections,provider,model,error,created_by,confirmed_by,confirmed_at,created_at FROM inventory_scans WHERE business_id=$1 ORDER BY created_at DESC LIMIT 50",
          [req.businessId],
        )
      ).rows,
    ),
  ),
);
router.post(
  "/scans",
  route(async (req, res) => {
    if (Object.keys(req.files || {}).length !== 1)
      fail("Upload exactly one image");
    const image = vision.validateImage(req.files?.image);
    const all = (
      await pool.query(
        "SELECT * FROM inventory_items WHERE business_id=$1 AND NOT archived ORDER BY id",
        [req.businessId],
      )
    ).rows;
    const selected = req.body.inventory_item_id;
    const stock = selected
      ? all.filter((s) => String(s.id) === String(selected))
      : all;
    if (!stock.length)
      fail("Choose an existing inventory item or add stock items first");
    if (stock.length > 1000)
      fail(
        "Select a stock item before scanning a catalogue of more than 1000 items",
      );
    const catalogueKey = crypto
      .createHash("sha256")
      .update(
        JSON.stringify(stock.map((s) => [s.id, s.name, s.unit, s.bottle_size])),
      )
      .digest("hex");
    const reservation = await transaction(req.businessId, async (db) => {
      const existing = await db.query(
        "SELECT * FROM inventory_scans WHERE business_id=$1 AND image_hash=$2 AND catalogue_key=$3 FOR UPDATE",
        [req.businessId, image.hash, catalogueKey],
      );
      if (existing.rowCount) {
        const scan = existing.rows[0];
        if (
          scan.status !== "failed" &&
          !(
            scan.status === "processing" &&
            Date.now() - new Date(scan.created_at).getTime() > 120000
          )
        )
          return { scan, cached: true };
        await db.query(
          "UPDATE inventory_scans SET status='processing',error=NULL,created_at=NOW() WHERE id=$1 AND business_id=$2",
          [scan.id, req.businessId],
        );
        return { scan, cached: false };
      }
      const recent = await db.query(
        "SELECT COUNT(*)::int AS n FROM inventory_scans WHERE business_id=$1 AND created_at>NOW()-INTERVAL '1 minute'",
        [req.businessId],
      );
      if (recent.rows[0].n >= 6)
        fail("Please wait a minute before scanning another image", 429);
      const snapshot = (
        await db.query(
          `SELECT i.id,i.current_stock,i.unit,COALESCE((SELECT MAX(l.id) FROM inventory_stock_logs l WHERE l.business_id=i.business_id AND l.inventory_item_id=i.id),0) AS last_log_id FROM inventory_items i WHERE i.business_id=$1 AND NOT i.archived`,
          [req.businessId],
        )
      ).rows;
      const inserted = await db.query(
        `INSERT INTO inventory_scans(business_id,image_hash,catalogue_key,status,provider,model,created_by,expected_snapshot) VALUES($1,$2,$3,'processing',$4,$5,$6,$7) RETURNING *`,
        [
          req.businessId,
          image.hash,
          catalogueKey,
          process.env.INVENTORY_VISION_PROVIDER || "openai",
          process.env.INVENTORY_VISION_MODEL || "gpt-4o-mini",
          actor(req),
          JSON.stringify(
            Object.fromEntries(
              snapshot.map((s) => [
                s.id,
                {
                  quantity: s.current_stock,
                  unit: s.unit,
                  last_log_id: s.last_log_id,
                },
              ]),
            ),
          ),
        ],
      );
      return { scan: inserted.rows[0], cached: false };
    });
    if (reservation.cached) {
      if (reservation.scan.status === "processing")
        fail(
          "This photo is already being analyzed. Reload scan history shortly.",
          409,
        );
      return res.json(reservation.scan);
    }
    try {
      const detections = await vision.detect(image, stock);
      const saved = await pool.query(
        "UPDATE inventory_scans SET status='review',detections=$1 WHERE id=$2 AND business_id=$3 RETURNING *",
        [JSON.stringify(detections), reservation.scan.id, req.businessId],
      );
      res.status(201).json(saved.rows[0]);
    } catch (error) {
      await pool.query(
        "UPDATE inventory_scans SET status='failed',error=$1 WHERE id=$2 AND business_id=$3",
        [
          error.status ? error.message : "Image analysis failed",
          reservation.scan.id,
          req.businessId,
        ],
      );
      throw error;
    }
  }),
);
async function scanDetail(db, businessId, id) {
  const s = await db.query(
    "SELECT * FROM inventory_scans WHERE id=$1 AND business_id=$2",
    [id, businessId],
  );
  if (!s.rowCount) fail("Scan not found", 404);
  const counts = await db.query(
    `SELECT c.*,i.name,i.current_stock FROM inventory_physical_counts c JOIN inventory_items i ON i.id=c.inventory_item_id AND i.business_id=c.business_id WHERE c.scan_id=$1 AND c.business_id=$2 ORDER BY c.id`,
    [id, businessId],
  );
  return { ...s.rows[0], counts: counts.rows };
}
router.get(
  "/scans/:id",
  route(async (req, res) =>
    res.json(await scanDetail(pool, req.businessId, req.params.id)),
  ),
);
router.post(
  "/scans/:id/confirm",
  route(async (req, res) => {
    res.json(
      await transaction(req.businessId, async (db) => {
        const scan = await scanDetail(db, req.businessId, req.params.id);
        if (["confirmed", "reconciled"].includes(scan.status)) return scan;
        if (scan.status !== "review")
          fail("Only a completed scan can be confirmed", 409);
        const rows = req.body.counts;
        if (!Array.isArray(rows) || !rows.length || rows.length > 100)
          fail("Review and map at least one detected product");
        const seen = new Set();
        for (const row of rows) {
          if (!row || typeof row !== "object" || Array.isArray(row))
            fail("Each physical count must be an object");
          const id = number(row.inventory_item_id, "Stock item", {
            integer: true,
          });
          if (seen.has(id))
            fail("Combine counts for the same stock item before confirming");
          seen.add(id);
          const stock = await db.query(
            "SELECT * FROM inventory_items WHERE id=$1 AND business_id=$2 AND NOT archived FOR UPDATE",
            [id, req.businessId],
          );
          if (!stock.rowCount) fail("Stock item not found", 404);
          const item = stock.rows[0],
            physical = physicalQuantity(row, item);
          const baseline = scan.expected_snapshot[id];
          if (!baseline || baseline.unit !== item.unit)
            fail(
              "This stock item changed after the scan. Take a new photograph.",
              409,
            );
          await db.query(
            `INSERT INTO inventory_physical_counts(business_id,scan_id,inventory_item_id,expected_stock,physical_stock,unit,full_bottles,bottle_size_ml,opened_ml)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              req.businessId,
              scan.id,
              id,
              baseline.quantity,
              physical.quantity,
              item.unit,
              physical.full_bottles,
              physical.bottle_size_ml,
              physical.opened_ml,
            ],
          );
        }
        await db.query(
          "UPDATE inventory_scans SET status='confirmed',confirmed_at=NOW(),confirmed_by=$1 WHERE id=$2 AND business_id=$3",
          [actor(req), scan.id, req.businessId],
        );
        return scanDetail(db, req.businessId, scan.id);
      }),
    );
  }),
);
router.post(
  "/scans/:id/reconcile",
  owner,
  route(async (req, res) => {
    const note = name(req.body.note);
    res.json(
      await transaction(req.businessId, async (db) => {
        const scan = await scanDetail(db, req.businessId, req.params.id);
        if (scan.status === "reconciled") return scan;
        if (scan.status !== "confirmed")
          fail("Confirm the physical count first", 409);
        for (const count of scan.counts) {
          const stock = await db.query(
            "SELECT current_stock,unit FROM inventory_items WHERE id=$1 AND business_id=$2 AND NOT archived FOR UPDATE",
            [count.inventory_item_id, req.businessId],
          );
          if (!stock.rowCount || stock.rows[0].unit !== count.unit)
            fail("Stock unit has changed. Make a new physical count.", 409);
          const conflicting = await db.query(
            "SELECT 1 FROM inventory_stock_logs WHERE business_id=$1 AND inventory_item_id=$2 AND id>$3 AND reason IN ('scan_reconciliation','manual_adjustment') LIMIT 1",
            [
              req.businessId,
              count.inventory_item_id,
              scan.expected_snapshot[count.inventory_item_id].last_log_id || 0,
            ],
          );
          if (conflicting.rowCount)
            fail(
              "Another physical adjustment was applied after this photo. Take a new count to avoid adjusting the same discrepancy twice.",
              409,
            );
          // Apply the observed variance, never overwrite movements made since count.
          const variance = Number(count.variance),
            after = Number(stock.rows[0].current_stock) + variance;
          if (after < 0)
            fail(
              "Stock moved below this variance. Investigate and make a new count.",
              409,
            );
          await db.query(
            "UPDATE inventory_items SET current_stock=current_stock+$1,updated_at=NOW() WHERE id=$2 AND business_id=$3",
            [variance, count.inventory_item_id, req.businessId],
          );
          await log(
            db,
            req,
            count.inventory_item_id,
            variance,
            "scan_reconciliation",
            { unit: count.unit, note, countId: count.id },
          );
          await db.query(
            "UPDATE inventory_physical_counts SET reconciled_by=$1,reconciled_at=NOW(),reconciliation_note=$2 WHERE id=$3 AND business_id=$4",
            [actor(req), note, count.id, req.businessId],
          );
        }
        await db.query(
          "UPDATE inventory_scans SET status='reconciled' WHERE id=$1 AND business_id=$2",
          [scan.id, req.businessId],
        );
        return scanDetail(db, req.businessId, scan.id);
      }),
    );
  }),
);

router.put(
  "/:id",
  owner,
  route(async (req, res) =>
    res.json(
      await transaction(req.businessId, async (db) => {
        const existing = await db.query(
          "SELECT * FROM inventory_items WHERE id=$1 AND business_id=$2 FOR UPDATE",
          [req.params.id, req.businessId],
        );
        if (!existing.rowCount) fail("Item not found", 404);
        const old = existing.rows[0],
          b = req.body,
          newUnit = b.unit ? unit(b.unit) : old.unit;
        if (newUnit !== old.unit)
          fail(
            "Stock units cannot be changed after creation. Keep the stock unit and use recipe unit conversions.",
          );
        const size =
          b.bottle_size === undefined
            ? old.bottle_size
            : b.bottle_size === null
              ? null
              : number(b.bottle_size, "Bottle size");
        const r = await db.query(
          "UPDATE inventory_items SET name=$1,low_stock_threshold=$2,bottle_size=$3,updated_at=NOW() WHERE id=$4 AND business_id=$5 RETURNING *",
          [
            b.name ? name(b.name) : old.name,
            b.low_stock_threshold === undefined
              ? old.low_stock_threshold
              : number(b.low_stock_threshold, "Threshold", { zero: true }),
            ["ml", "litre"].includes(newUnit) ? size : null,
            req.params.id,
            req.businessId,
          ],
        );
        return r.rows[0];
      }),
    ),
  ),
);
router.patch(
  "/:id/restock",
  owner,
  route(async (req, res) =>
    res.json(
      await transaction(req.businessId, async (db) => {
        const amount = number(req.body.amount, "Restock amount");
        const size =
          req.body.bottle_size == null
            ? null
            : number(req.body.bottle_size, "Bottle size");
        const r = await db.query(
          `UPDATE inventory_items SET current_stock=current_stock+$1,bottle_size=COALESCE($4,bottle_size),updated_at=NOW() WHERE id=$2 AND business_id=$3 RETURNING *`,
          [amount, req.params.id, req.businessId, size],
        );
        if (!r.rowCount) fail("Item not found", 404);
        await log(db, req, r.rows[0].id, amount, "restock", {
          unit: r.rows[0].unit,
        });
        return r.rows[0];
      }),
    ),
  ),
);
router.patch(
  "/:id/adjust",
  owner,
  route(async (req, res) =>
    res.json(
      await transaction(req.businessId, async (db) => {
        const value = number(req.body.new_stock, "Stock", { zero: true });
        const existing = await db.query(
          "SELECT * FROM inventory_items WHERE id=$1 AND business_id=$2 FOR UPDATE",
          [req.params.id, req.businessId],
        );
        if (!existing.rowCount) fail("Item not found", 404);
        const r = await db.query(
          "UPDATE inventory_items SET current_stock=$1,updated_at=NOW() WHERE id=$2 AND business_id=$3 RETURNING *",
          [value, req.params.id, req.businessId],
        );
        await log(
          db,
          req,
          r.rows[0].id,
          round(value - Number(existing.rows[0].current_stock)),
          "manual_adjustment",
          {
            unit: r.rows[0].unit,
            note: req.body.note ? name(req.body.note) : null,
          },
        );
        return r.rows[0];
      }),
    ),
  ),
);
router.delete(
  "/:id",
  owner,
  route(async (req, res) =>
    res.json(
      await transaction(req.businessId, async (db) => {
        const used = await db.query(
          `SELECT 1 FROM menu_item_ingredients WHERE inventory_item_id=$1 AND business_id=$2 UNION ALL
    SELECT 1 FROM inventory_preparation_components WHERE inventory_item_id=$1 AND business_id=$2`,
          [req.params.id, req.businessId],
        );
        if (used.rowCount)
          fail(
            "Remove this stock item from recipes and preparations before deleting it",
            409,
          );
        const r = await db.query(
          "UPDATE inventory_items SET archived=true,updated_at=NOW() WHERE id=$1 AND business_id=$2 AND NOT archived RETURNING id",
          [req.params.id, req.businessId],
        );
        if (!r.rowCount) fail("Item not found", 404);
        return { message: "Item deleted; audit history preserved" };
      }),
    ),
  ),
);
module.exports = router;
