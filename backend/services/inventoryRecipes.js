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
    `SELECT mi.inventory_item_id, NULL::integer AS preparation_id, mi.quantity_required, ii.name, ii.unit, ii.current_stock
    FROM menu_item_ingredients mi JOIN inventory_items ii ON ii.id=mi.inventory_item_id AND ii.business_id=mi.business_id
    WHERE mi.menu_item_id=$1 AND mi.business_id=$2
    UNION ALL SELECT NULL,p.preparation_id,p.quantity_required,ip.name,ip.yield_unit,NULL
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
        "INSERT INTO menu_item_ingredients(business_id,menu_item_id,inventory_item_id,quantity_required) VALUES($1,$2,$3,$4)",
        [businessId, id, ing.inventory_item_id, ing.quantity_required],
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
module.exports = {
  catalogue,
  validateIngredients,
  readRecipe,
  saveRecipe,
  ownedMenu,
  assertAcyclic,
  expandPreparation,
  consumptionForMenu,
};
