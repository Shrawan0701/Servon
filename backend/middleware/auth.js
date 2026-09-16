const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
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
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};