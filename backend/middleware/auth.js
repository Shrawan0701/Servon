const jwt = require("jsonwebtoken");
const pool = require("../db");

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  let token;

  // 1. Check if token is in Header
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } 
  // 2. If not in header, check if it's in the URL Query (for window.open)
  else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Use whatever key you stored in the JWT (decoded.id or decoded.businessId)
    req.businessId = decoded.businessId || decoded.id;
    
    // ✅ Get branch ID from header or query
    const branchId = req.headers["x-branch-id"] || req.query.branchId;
    
    if (branchId) {
      // ✅ Verify branch belongs to this business (directly or as parent)
      const branchCheck = await pool.query(
        `SELECT id, is_branch, parent_id FROM businesses 
         WHERE id = $1 AND (id = $2 OR parent_id = $2)`,
        [branchId, req.businessId]
      );
      
      if (branchCheck.rows.length > 0) {
        req.branchId = branchId;
      } else {
        // Invalid branch, fall back to main business
        req.branchId = req.businessId;
      }
    } else {
      // ✅ Default to main business
      req.branchId = req.businessId;
    }
    
    // ✅ Get the main business (parent) for subscription checks
    const businessCheck = await pool.query(
      `SELECT parent_id, is_branch FROM businesses WHERE id = $1`,
      [req.businessId]
    );
    
    if (businessCheck.rows[0]?.is_branch && businessCheck.rows[0]?.parent_id) {
      // If logged in as a branch, use parent for subscription
      req.parentBusinessId = businessCheck.rows[0].parent_id;
    } else {
      req.parentBusinessId = req.businessId;
    }
    
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};