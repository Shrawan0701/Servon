const { fail, number, convert, round } = require("./inventoryUnits");
async function catalogue(db, businessId) {
  const [stock, preps, components] = await Promise.all([
    db.query(
      "SELECT * FROM inventory_items WHERE business_id=$1 AND NOT archived ORDER BY id",
      [businessId],
    ),
    db.query(
      "SELECT * FROM inventory_preparations WHERE business_id=$1 ORDER BY name",
      [businessId],
    ),
    db.query(
      "SELECT * FROM inventory_preparation_components WHERE business_id=$1 ORDER BY id",
      [businessId],
    ),
  ]);
  return {
    stock: stock.rows,
    preparations: preps.rows,
    components: components.rows,
  };
}
function validateIngredients(ingredients, cat) {
  if (!Array.isArray(ingredients) || ingredients.length > 150)
    fail("Supply at most 150 ingredients");
  const seen = new Set();
  return ingredients.map((ing) => {
    if (!ing || typeof ing !== "object" || Array.isArray(ing))
      fail("Each ingredient must be an object");
    const isPrep =
      ing.preparation_id !== undefined && ing.preparation_id !== null;
    if (isPrep && ing.inventory_item_id != null)
      fail("Choose either a stock item or a preparation");
    const id = number(
      isPrep ? ing.preparation_id : ing.inventory_item_id,
      "Ingredient ID",
      { integer: true },
    );
    const key = `${isPrep ? "p" : "i"}:${id}`;
    if (seen.has(key)) fail("An ingredient can only be added once");
    seen.add(key);
    const record = (isPrep ? cat.preparations : cat.stock).find(
      (x) => Number(x.id) === id && !x.archived,
    );
    if (!record) fail("Ingredient not found in this restaurant", 404);
    const targetUnit = isPrep ? record.yield_unit : record.unit;
    return {
      inventory_item_id: isPrep ? null : id,
      preparation_id: isPrep ? id : null,
      quantity_required: convert(
        ing.quantity_required,
        ing.unit || targetUnit,
        targetUnit,
      ),
      is_stock_source: ing.is_stock_source === true,
    };
  });
}
async function ownedMenu(db, businessId, id) {
  const result = await db.query(
    "SELECT id FROM menu_items WHERE business_id=$1 AND id=$2",
    [businessId, id],
  );
  if (!result.rowCount) fail("Menu item not found", 404);
}
async function readRecipe(db, businessId, id) {
  await ownedMenu(db, businessId, id);
  const result = await db.query(
    `SELECT mi.inventory_item_id, NULL::integer AS preparation_id, mi.quantity_required, ii.name, ii.unit, ii.current_stock, mi.is_stock_source
    FROM menu_item_ingredients mi JOIN inventory_items ii ON ii.id=mi.inventory_item_id AND ii.business_id=mi.business_id
    WHERE mi.menu_item_id=$1 AND mi.business_id=$2
    UNION ALL SELECT NULL,p.preparation_id,p.quantity_required,ip.name,ip.yield_unit,NULL,false
    FROM menu_item_preparations p JOIN inventory_preparations ip ON ip.id=p.preparation_id AND ip.business_id=p.business_id
    WHERE p.menu_item_id=$1 AND p.business_id=$2`,
    [id, businessId],
  );
  return result.rows;
}
async function saveRecipe(
  db,
  businessId,
  id,
  ingredients,
  mode = "replace",
  cat,
) {
  if (!["merge", "replace"].includes(mode))
    fail("Mode must be merge or replace");
  await ownedMenu(db, businessId, id);
  const rows = validateIngredients(
    ingredients,
    cat || (await catalogue(db, businessId)),
  );
  if (rows.some((row) => row.is_stock_source)) {
    const menu = (await db.query("SELECT menu_type,size_ml FROM menu_items WHERE business_id=$1 AND id=$2", [businessId, id])).rows[0];
    const stock = (cat || await catalogue(db, businessId)).stock;
    if (menu?.menu_type !== "liquor" || !(Number(menu.size_ml) > 0) ||
      rows.some((row) => !row.is_stock_source || row.preparation_id ||
        !["ml", "litre"].includes(stock.find((s) => Number(s.id) === row.inventory_item_id)?.unit)))
      fail("Alternative bottle sources require liquor servings and volume stock");
    for (const row of rows) {
      const source = stock.find((s) => Number(s.id) === row.inventory_item_id);
      row.quantity_required = round(Number(menu.size_ml) / (source.unit === "litre" ? 1000 : 1));
    }
  }
  if (mode === "merge") {
    const before = await readRecipe(db, businessId, id);
    const combined = [...before.filter((old) => !rows.some((row) =>
      row.inventory_item_id != null && Number(row.inventory_item_id) === Number(old.inventory_item_id))), ...rows];
    if (combined.some((row) => row.is_stock_source) && combined.some((row) => !row.is_stock_source))
      fail("Bottle sources cannot be mixed with a multi-ingredient recipe", 409);
  }
  if (mode === "replace") {
    await db.query(
      "DELETE FROM menu_item_ingredients WHERE business_id=$1 AND menu_item_id=$2",
      [businessId, id],
    );
    await db.query(
      "DELETE FROM menu_item_preparations WHERE business_id=$1 AND menu_item_id=$2",
      [businessId, id],
    );
  }
  for (const ing of rows) {
    if (ing.preparation_id) {
      await db.query(
        `INSERT INTO menu_item_preparations(business_id,menu_item_id,preparation_id,quantity_required) VALUES($1,$2,$3,$4)
        ON CONFLICT(menu_item_id,preparation_id) DO UPDATE SET quantity_required=EXCLUDED.quantity_required WHERE menu_item_preparations.business_id=EXCLUDED.business_id`,
        [businessId, id, ing.preparation_id, ing.quantity_required],
      );
    } else {
      // Delete+insert also supports legacy databases without an ingredient unique index.
      await db.query(
        "DELETE FROM menu_item_ingredients WHERE business_id=$1 AND menu_item_id=$2 AND inventory_item_id=$3",
        [businessId, id, ing.inventory_item_id],
      );
      await db.query(
        "INSERT INTO menu_item_ingredients(business_id,menu_item_id,inventory_item_id,quantity_required,is_stock_source) VALUES($1,$2,$3,$4,$5)",
        [businessId, id, ing.inventory_item_id, ing.quantity_required, ing.is_stock_source],
      );
    }
  }
  return readRecipe(db, businessId, id);
}
function assertAcyclic(cat) {
  const visiting = new Set(),
    done = new Set();
  function visit(id, depth = 0) {
    if (depth > 20) fail("Preparations may be nested at most 20 levels");
    if (visiting.has(id))
      fail("Circular preparation references are not allowed");
    if (done.has(id)) return;
    visiting.add(id);
    for (const c of cat.components.filter(
      (c) => Number(c.preparation_id) === id,
    )) {
      if (c.component_preparation_id)
        visit(Number(c.component_preparation_id), depth + 1);
    }
    visiting.delete(id);
    done.add(id);
  }
  cat.preparations.forEach((p) => visit(Number(p.id)));
}
function expandPreparation(cat, id, quantity, output = new Map(), path = []) {
  id = Number(id);
  if (path.includes(id) || path.length > 20) fail("Invalid preparation graph");
  const prep = cat.preparations.find((p) => Number(p.id) === id);
  if (!prep) fail("Preparation not found");
  const yieldAmount =
    number(prep.yield_quantity) * (1 - Number(prep.wastage_percent) / 100);
  const components = cat.components.filter(
    (c) => Number(c.preparation_id) === id,
  );
  if (!components.length) fail(`Preparation ${prep.name} has no ingredients`);
  for (const c of components) {
    const amount = (Number(c.quantity_required) * quantity) / yieldAmount;
    if (c.component_preparation_id)
      expandPreparation(cat, c.component_preparation_id, amount, output, [
        ...path,
        id,
      ]);
    else
      output.set(
        Number(c.inventory_item_id),
        (output.get(Number(c.inventory_item_id)) || 0) + amount,
      );
  }
  return output;
}
async function consumptionForMenu(db, businessId, id, cat) {
  const recipe = await readRecipe(db, businessId, id),
    output = new Map();
  for (const row of recipe) {
    if (row.preparation_id)
      expandPreparation(
        cat,
        row.preparation_id,
        Number(row.quantity_required),
        output,
      );
    else
      output.set(
        Number(row.inventory_item_id),
        (output.get(Number(row.inventory_item_id)) || 0) +
          Number(row.quantity_required),
      );
  }
  return [...output].map(([inventory_item_id, quantity]) => ({
    inventory_item_id,
    quantity: round(quantity),
  }));
}
// Allocate the requested volume once across alternative package sizes. Prefer
// a bottle matching the serving size, then consume older linked stock first.
// Quantities are totals (not per-serving averages) to preserve exact refunds.
async function allocateForMenu(db, businessId, id, cat, servings) {
  const recipe = await readRecipe(db, businessId, id);
  if (!recipe.length || !recipe.every((row) => row.is_stock_source))
    return (await consumptionForMenu(db, businessId, id, cat)).map((row) => ({
      ...row, quantity: round(row.quantity * servings),
    }));
  const menu = (await db.query("SELECT size_ml FROM menu_items WHERE business_id=$1 AND id=$2", [businessId, id])).rows[0];
  let remaining = round(number(menu?.size_ml, "Menu serving size") * servings);
  const candidates = recipe.map((row) => ({ row, stock: cat.stock.find((s) => Number(s.id) === Number(row.inventory_item_id)) }))
    .filter(({ stock }) => stock && ["ml", "litre"].includes(stock.unit))
    .sort((a, b) => {
      const size = (s) => Number(s.bottle_size) * (s.unit === "litre" ? 1000 : 1);
      return Number(size(b.stock) === Number(menu.size_ml)) - Number(size(a.stock) === Number(menu.size_ml)) || a.stock.id - b.stock.id;
    });
  const result = [];
  for (const { stock } of candidates) {
    const factor = stock.unit === "litre" ? 1000 : 1;
    const used = Math.min(remaining, round(Number(stock.current_stock) * factor));
    if (used > 0) {
      const quantity = round(used / factor);
      result.push({ inventory_item_id: stock.id, quantity });
      remaining = round(remaining - quantity * factor);
    }
    if (remaining <= 0) break;
  }
  if (remaining > 0) fail("Insufficient stock across linked bottle sizes", 409);
  result.alternativeSources = true;
  return result;
}
module.exports = {
  catalogue,
  validateIngredients,
  readRecipe,
  saveRecipe,
  ownedMenu,
  assertAcyclic,
  expandPreparation,
  consumptionForMenu,
  allocateForMenu,
};
