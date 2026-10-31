const { fail, number, round } = require("./inventoryUnits");
const recipes = require("./inventoryRecipes");
const { productKey } = require("./inventoryProducts");

// Use the existing recipe machinery: orders need no second deduction path.
async function linkStockToMenu(db, businessId, stock, links) {
  if (!Array.isArray(links) || links.length > 100)
    fail("Choose at most 100 menu items");
  const seen = new Set();
  for (const link of links) {
    if (
      !link ||
      typeof link.menu_item_id !== "string" ||
      seen.has(link.menu_item_id)
    )
      fail("Choose each menu item only once");
    seen.add(link.menu_item_id);
    const result = await db.query(
      "SELECT id,name,menu_type,size_ml FROM menu_items WHERE business_id=$1 AND id=$2",
      [businessId, link.menu_item_id],
    );
    if (!result.rowCount) fail("Menu item not found", 404);
    const menu = result.rows[0];
    let amount;
    if (menu.menu_type === "liquor") {
      if (!["ml", "litre"].includes(stock.unit))
        fail("Use ml or litres stock for liquor servings");
      amount = round(
        number(menu.size_ml, "Menu serving size") /
          (stock.unit === "litre" ? 1000 : 1),
      );
    } else {
      amount = number(link.quantity_required, "Stock used per sale");
    }
    const before = await recipes.readRecipe(db, businessId, menu.id);
    if (menu.menu_type === "liquor") {
      // Upgrade an existing simple link to an alternative source set. Explicit
      // multi-ingredient recipes and unrelated products keep their protection.
      if (before.length && !before.every((row) => row.is_stock_source)) {
        const sameProduct = before.length === 1 && before[0].inventory_item_id &&
          ["ml", "litre"].includes(before[0].unit) &&
          (Number(before[0].inventory_item_id) === Number(stock.id) ||
            (productKey(stock.name) && productKey(before[0].name) === productKey(stock.name)));
        if (!sameProduct) fail("This menu item uses a different product or recipe. Edit its dish ingredients to change the product.", 409);
      } else if (before.length && !before.some((row) => Number(row.inventory_item_id) === Number(stock.id)) &&
        !before.some((row) => productKey(row.name) && productKey(row.name) === productKey(stock.name))) {
        fail("This menu item uses a different product. Choose a bottle size of the same product.", 409);
      }
      const sources = before.filter((row) => Number(row.inventory_item_id) !== Number(stock.id)).map((row) => ({
        inventory_item_id: row.inventory_item_id,
        quantity_required: row.quantity_required,
        unit: row.unit,
        is_stock_source: true,
      }));
      sources.push({ inventory_item_id: stock.id, quantity_required: amount, unit: stock.unit, is_stock_source: true });
      await recipes.saveRecipe(db, businessId, menu.id, sources, "replace");
      continue;
    }
    if (before.length) {
      const cat = await recipes.catalogue(db, businessId);
      const consumption = await recipes.consumptionForMenu(
        db,
        businessId,
        menu.id,
        cat,
      );
      if (
        !consumption.some(
          (ingredient) =>
            Number(ingredient.inventory_item_id) === Number(stock.id),
        )
      )
        fail(
          "A selected menu item already uses different stock. Change it in Dish ingredients first.",
          409,
        );
      // Keep existing multi-ingredient/preparation recipes exactly as configured.
      if (
        before.length !== 1 ||
        Number(before[0].inventory_item_id) !== Number(stock.id)
      )
        continue;
    }
    await recipes.saveRecipe(
      db,
      businessId,
      menu.id,
      [
        {
          inventory_item_id: stock.id,
          quantity_required: amount,
          unit: stock.unit,
        },
      ],
      "merge",
    );
  }
}

module.exports = { linkStockToMenu };
