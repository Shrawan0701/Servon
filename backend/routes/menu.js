const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");
const subscription = require("../middleware/subscription");
const { translateMenuItemName } = require("../services/menuTranslationService");

const normalizeFoodType = (value) => (value === "non_veg" ? "non_veg" : "veg");
const normalizeMenuType = (value) => (value === "liquor" ? "liquor" : "food");
const LIQUOR_CATEGORIES = new Set(["Whisky", "Beer", "Rum", "Vodka", "Gin", "Brandy", "Wine", "Other"]);

// Get all menu items for a business (public)
router.get("/public/:businessId", async (req, res) => {
  try {
    const business = await pool.query("SELECT liquor_available FROM businesses WHERE id = $1", [req.params.businessId]);
    const liquorAvailable = business.rows[0]?.liquor_available === true;
    const result = await pool.query(
      `SELECT * FROM menu_items 
       WHERE business_id = $1 
       AND is_available = true
       AND ($2::boolean = true OR COALESCE(menu_type, 'food') <> 'liquor')
       ORDER BY menu_type, category, name, size_ml`,
      [req.params.businessId, liquorAvailable]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/settings/public/:businessId", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, liquor_available FROM businesses WHERE id = $1",
      [req.params.businessId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Business not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Get all menu items (business owner)
router.get("/", auth, async (req, res) => {
  try {
    const business = await pool.query("SELECT liquor_available FROM businesses WHERE id = $1", [req.businessId]);
    const liquorAvailable = business.rows[0]?.liquor_available === true;
    const result = await pool.query(
      `SELECT * FROM menu_items 
       WHERE business_id = $1
       AND ($2::boolean = true OR COALESCE(menu_type, 'food') <> 'liquor')
       ORDER BY menu_type, category, name, size_ml`,
      [req.businessId, liquorAvailable]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Add menu item (Combined Logic)
router.post("/", auth, subscription, async (req, res) => {
  const {
    name,
    description,
    price,
    category,
    image_url,
    food_type,
    menu_type,
    liquor_code,
    size_ml,
    is_available,
    is_thali,
    thali_includes,
    thali_custom
  } = req.body;

  const finalMenuType = normalizeMenuType(menu_type);
  if (!name || !price || !category) {
    return res
      .status(400)
      .json({ error: "Name, price,and category are required" });
  }

  try {
    const business = await pool.query("SELECT liquor_available FROM businesses WHERE id = $1", [req.businessId]);
    if (finalMenuType === "liquor" && business.rows[0]?.liquor_available !== true) {
      return res.status(403).json({ error: "Liquor is not enabled for this restaurant" });
    }
    if (finalMenuType === "liquor" && !LIQUOR_CATEGORIES.has(category)) {
      return res.status(400).json({ error: "Invalid liquor category" });
    }
    const finalFoodType = normalizeFoodType(food_type);
    const translations = await translateMenuItemName(name);

    const result = await pool.query(
      'INSERT INTO menu_items (business_id,name,name_mr,name_hi,description,price,image_url,category,food_type,menu_type,liquor_code,size_ml,is_available,is_thali,thali_includes,thali_custom) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *',
      [
        req.businessId,
        name,
        translations.name_mr,
        translations.name_hi,
        description,
        price,
        finalMenuType === "liquor" ? null : (image_url || null),
        category,
        finalFoodType,
        finalMenuType,
        finalMenuType === "liquor" ? (liquor_code || null) : null,
        finalMenuType === "liquor" ? (parseFloat(size_ml) || null) : null,
        is_available !== undefined ? Boolean(is_available) : true,
        finalMenuType === "liquor" ? false : (is_thali || false),
        finalMenuType === "liquor" ? "[]" : JSON.stringify(thali_includes || []),
        finalMenuType === "liquor" ? "" : (thali_custom || ""),
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Add menu error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update menu item (Combined Logic)
router.put("/:id", auth, subscription, async (req, res) => {
  const {
    name,
    description,
    price,
    category,
    image_url,
    food_type,
    menu_type,
    liquor_code,
    size_ml,
    is_available,
    is_thali,
    thali_includes,
    thali_custom
  } = req.body;

  try {
    const existing = await pool.query(
      "SELECT * FROM menu_items WHERE id = $1 AND business_id = $2",
      [req.params.id, req.businessId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }

    const finalImageUrl = image_url !== undefined ? image_url : existing.rows[0].image_url;
    const finalMenuType = menu_type !== undefined
      ? normalizeMenuType(menu_type)
      : normalizeMenuType(existing.rows[0].menu_type);
    const business = await pool.query("SELECT liquor_available FROM businesses WHERE id = $1", [req.businessId]);
    if (finalMenuType === "liquor" && business.rows[0]?.liquor_available !== true) {
      return res.status(403).json({ error: "Liquor is not enabled for this restaurant" });
    }
    if (finalMenuType === "liquor" && !LIQUOR_CATEGORIES.has(category || existing.rows[0].category)) {
      return res.status(400).json({ error: "Invalid liquor category" });
    }
    const finalName = typeof name === "string" && name.trim() ? name.trim() : existing.rows[0].name;
    const nameChanged = finalName !== existing.rows[0].name;
    const missingTranslation = !existing.rows[0].name_mr || !existing.rows[0].name_hi;
    const translations = nameChanged || missingTranslation
      ? await translateMenuItemName(finalName)
      : { name_mr: null, name_hi: null };
    const finalFoodType = food_type !== undefined
      ? normalizeFoodType(food_type)
      : normalizeFoodType(existing.rows[0].food_type);

    const result = await pool.query(
      'UPDATE menu_items SET name = $1,name_mr = $2,name_hi = $3,description = $4,price = $5,image_url = $6,category = $7,food_type = $8,menu_type = $9,liquor_code = $10,size_ml = $11,is_available = $12,is_thali = $13,thali_includes = $14,thali_custom = $15,updated_at = NOW() WHERE id = $16 AND business_id = $17 RETURNING *',
      [
        finalName,
        nameChanged
          ? translations.name_mr
          : (existing.rows[0].name_mr || translations.name_mr),
        nameChanged
          ? translations.name_hi
          : (existing.rows[0].name_hi || translations.name_hi),
        description !== undefined ? description : existing.rows[0].description,
        price || existing.rows[0].price,
        finalMenuType === "liquor" ? null : finalImageUrl,
        category || existing.rows[0].category,
        finalFoodType,
        finalMenuType,
        finalMenuType === "liquor" ? (liquor_code !== undefined ? liquor_code : existing.rows[0].liquor_code) : null,
        finalMenuType === "liquor" ? (size_ml !== undefined ? (parseFloat(size_ml) || null) : existing.rows[0].size_ml) : null,
        is_available !== undefined ? Boolean(is_available) : existing.rows[0].is_available,
        finalMenuType === "liquor" ? false : (is_thali !== undefined ? is_thali : existing.rows[0].is_thali),
        finalMenuType === "liquor" ? "[]" : JSON.stringify(thali_includes !== undefined ? thali_includes : (existing.rows[0].thali_includes || [])),
        finalMenuType === "liquor" ? "" : (thali_custom !== undefined ? thali_custom : (existing.rows[0].thali_custom || "")),
        req.params.id,
        req.businessId,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update menu error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
// Toggle availability
router.patch("/:id/availability", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE menu_items 
       SET is_available = NOT is_available,
           updated_at = NOW()
       WHERE id = $1 AND business_id = $2
       RETURNING *`,
      [req.params.id, req.businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Delete menu item
router.delete("/:id", auth, subscription, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM menu_items WHERE id = $1 AND business_id = $2 RETURNING id",
      [req.params.id, req.businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json({ message: "Item deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
