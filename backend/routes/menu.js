const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");
const subscription = require("../middleware/subscription");
const { translateMenuItemName } = require("../services/menuTranslationService");

const normalizeFoodType = (value) => (value === "non_veg" ? "non_veg" : "veg");
const normalizeMenuType = (value) => (value === "liquor" ? "liquor" : "food");
const LIQUOR_CATEGORIES = new Set(["Whisky", "Beer", "Rum", "Vodka", "Gin", "Brandy", "Wine", "Other", "Liquor"]);
const FOOD_CATEGORY_CODES = new Set([1, 2, 3, 4, 5, 6, 7]);
const LIQUOR_BRAND_CODES = new Map([
  [10, "Tuborg Strong"], [11, "Tuborg"], [12, "Tuborg Classic"], [13, "Kingfisher"], [14, "Kingfisher Ultra"], [15, "Carlsberg Beer"], [16, "Heineken Beer"], [17, "Budweiser"], [18, "Godfather Beer"], [19, "London Beer"], [20, "Breezer"],
  [21, "Royal Stag"], [22, "Royal Stag Double"], [23, "Royal Green"], [24, "Signature"], [25, "Imperial Blue"], [26, "McDowell's Rum"], [27, "McDowell's"], [28, "McDowell's Platinum"], [29, "B7"], [30, "DSP Black"], [31, "Goa"], [32, "Grand Masters"], [33, "Iconiq White"], [34, "Royal Challenge"], [35, "Oaksmith Silver"], [36, "Oaksmith Gold"], [37, "Oaken"], [38, "Antiquity"], [39, "Green Label"], [40, "Officer's Choice"], [41, "Jameson"], [42, "Black Dog"], [43, "Teachers"], [44, "Black & White"], [45, "VAT 69"], [46, "Ballantine's"], [47, "Haywards 2000"], [48, "Haywards"], [49, "Masters Delight"], [50, "Classic Gold"], [51, "Brown Man"], [52, "Premium Whisky"], [53, "Barrel Whisky"], [54, "X-Treme Whisky"], [55, "Empire"], [56, "Blenders Reserve"], [57, "After Dark"], [58, "Amber Whisky"], [59, "Vulcan Blue"], [60, "Alpha Bull"], [61, "Kalani White"],
  [62, "Bullet Rum"], [63, "Old Monk"], [64, "Dark Old Rum"], [65, "Gold Medal Rum"], [66, "Mad Rum"], [67, "Blak Bacardi"],
  [68, "Smirnoff"], [69, "Vodka"], [70, "Xclamation"], [71, "Xclamation Vodka"], [72, "Silver Kastle Vodka"], [73, "Gold Medal Vodka"], [74, "Shaky Vodka Jamun"], [75, "Smirnoff Jamun"],
  [76, "Bombay"], [77, "Bombay Quarter"], [78, "Lemon Duet Gin"], [79, "Knight Fox Gin"],
  [80, "Doctor Brandy"],
  [81, "Let's Go Cranberry"], [82, "Bacardi Limon"], [83, "Magic Moments"], [84, "Magik Moments"], [85, "Magic Moment"],
  [86, "OC Blue"], [87, "REO Wain"], [88, "B10 Sterling"], [89, "Red Label"], [90, "100 Pipers"], [91, "Romeno"], [92, "Danona"], [93, "Khata Khat"], [94, "Royal Barrel"], [95, "Mumbai Malti"], [96, "Cannon"], [97, "Bullet Strong"],
]);
const foodMenuGroup = (foodType) => (normalizeFoodType(foodType) === "non_veg" ? "non_veg" : "veg");
const normalizeCategoryCode = (value, menuType, foodType) => {
  if (normalizeMenuType(menuType) === "liquor") return null;
  const parsed = Number.parseInt(value, 10);
  if (!FOOD_CATEGORY_CODES.has(parsed)) return null;
  const group = foodMenuGroup(foodType);
  if (group === "non_veg") return parsed === 7 ? 7 : null;
  return parsed >= 1 && parsed <= 6 ? parsed : null;
};
const normalizeLiquorBrandCode = (value) => {
  const parsed = Number.parseInt(value, 10);
  return LIQUOR_BRAND_CODES.has(parsed) ? parsed : null;
};
const inferLiquorBrandCode = (name) => {
  const normalized = String(name || "").trim().toLowerCase();
  const match = [...LIQUOR_BRAND_CODES.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .find(([, label]) => normalized === label.toLowerCase() || normalized.startsWith(`${label.toLowerCase()} `));
  return match?.[0] || null;
};

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
    const requestedCode = req.query.category_code !== undefined ? Number.parseInt(req.query.category_code, 10) : null;
    const requestedLiquorBrandCode = req.query.liquor_brand_code !== undefined ? normalizeLiquorBrandCode(req.query.liquor_brand_code) : null;
    if (req.query.category_code !== undefined && requestedCode !== 8 && !FOOD_CATEGORY_CODES.has(requestedCode)) {
      return res.json([]);
    }
    if (req.query.liquor_brand_code !== undefined && !requestedLiquorBrandCode) {
      return res.json([]);
    }
    const business = await pool.query("SELECT liquor_available FROM businesses WHERE id = $1", [req.businessId]);
    const liquorAvailable = business.rows[0]?.liquor_available === true;
    if (requestedLiquorBrandCode) {
      if (!liquorAvailable) return res.json([]);
      const result = await pool.query(
        `SELECT * FROM menu_items
         WHERE business_id = $1
         AND is_available = true
         AND COALESCE(menu_type, 'food') = 'liquor'
         AND liquor_brand_code = $2
         ORDER BY name, size_ml`,
        [req.businessId, requestedLiquorBrandCode]
      );
      return res.json(result.rows);
    }
    if (requestedCode === 8) return res.json([]);
    if (requestedCode) {
      const result = await pool.query(
        `SELECT * FROM menu_items
         WHERE business_id = $1
         AND is_available = true
         AND COALESCE(menu_type, 'food') <> 'liquor'
         AND category_code = $2
         ORDER BY category, name`,
        [req.businessId, requestedCode]
      );
      return res.json(result.rows);
    }
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
    thali_custom,
    category_code,
    liquor_brand_code
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
    const finalMenuGroup = finalMenuType === "liquor" ? "liquor" : foodMenuGroup(finalFoodType);
    const finalCategoryCode = normalizeCategoryCode(category_code, finalMenuType, finalFoodType);
    const finalLiquorBrandCode = finalMenuType === "liquor"
      ? (normalizeLiquorBrandCode(liquor_brand_code) || inferLiquorBrandCode(name))
      : null;
    if (finalMenuType !== "liquor" && !finalCategoryCode) {
      return res.status(400).json({ error: "Valid category code is required" });
    }
    if (finalMenuType === "liquor" && !finalLiquorBrandCode) {
      return res.status(400).json({ error: "Valid liquor brand code is required" });
    }
    const translations = await translateMenuItemName(name);

    const result = await pool.query(
      'INSERT INTO menu_items (business_id,name,name_mr,name_hi,description,price,image_url,category,food_type,menu_type,menu_group,category_code,liquor_brand_code,liquor_code,size_ml,is_available,is_thali,thali_includes,thali_custom) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *',
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
        finalMenuGroup,
        finalCategoryCode,
        finalLiquorBrandCode,
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
    thali_custom,
    category_code,
    liquor_brand_code
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
    const finalMenuGroup = finalMenuType === "liquor" ? "liquor" : foodMenuGroup(finalFoodType);
    const finalCategoryCode = finalMenuType === "liquor"
      ? null
      : normalizeCategoryCode(
          category_code !== undefined ? category_code : existing.rows[0].category_code,
          finalMenuType,
          finalFoodType
        );
    const finalLiquorBrandCode = finalMenuType === "liquor"
      ? (normalizeLiquorBrandCode(liquor_brand_code !== undefined ? liquor_brand_code : existing.rows[0].liquor_brand_code) || inferLiquorBrandCode(finalName))
      : null;
    if (finalMenuType !== "liquor" && !finalCategoryCode) {
      return res.status(400).json({ error: "Valid category code is required" });
    }
    if (finalMenuType === "liquor" && !finalLiquorBrandCode) {
      return res.status(400).json({ error: "Valid liquor brand code is required" });
    }

    const result = await pool.query(
      'UPDATE menu_items SET name = $1,name_mr = $2,name_hi = $3,description = $4,price = $5,image_url = $6,category = $7,food_type = $8,menu_type = $9,menu_group = $10,category_code = $11,liquor_brand_code = $12,liquor_code = $13,size_ml = $14,is_available = $15,is_thali = $16,thali_includes = $17,thali_custom = $18,updated_at = NOW() WHERE id = $19 AND business_id = $20 RETURNING *',
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
        finalMenuGroup,
        finalCategoryCode,
        finalLiquorBrandCode,
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
