const pool = require("../db"); 

module.exports = async (req, res, next) => { 
  try { 
    const result = await pool.query( 
      "SELECT subscription_status, subscription_end_date FROM businesses WHERE id = $1", 
      [req.businessId] 
    ); 
    const business = result.rows[0]; 
    if (!business) return res.status(404).json({ error: "Business not found" }); 
    
    const now = new Date(); 
    
    // If the plan is officially expired by date but still says ACTIVE, update it silently.
    if (business.subscription_status === "ACTIVE" && business.subscription_end_date && new Date(business.subscription_end_date) < now) { 
      await pool.query( 
        "UPDATE businesses SET subscription_status = 'EXPIRED' WHERE id = $1", 
        [req.businessId] 
      ); 
    } 
 
    // WE DO NOT BLOCK ANYMORE! Let them through to use the app.
    next(); 
  } catch (err) { 
    console.error("Subscription middleware error:", err); 
    res.status(500).json({ error: "Server error" }); 
  } 
};