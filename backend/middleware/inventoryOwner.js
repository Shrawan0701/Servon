// This checkout issues business-owner tokens. Future staff tokens need an
// explicit permission before they may reconcile or adjust physical stock.
module.exports = (req, res, next) => {
  const claims = req.auth || {};
  if (
    (claims.staffId ||
      (claims.role && !["owner", "admin"].includes(claims.role))) &&
    !claims.permissions?.includes("inventory:adjust")
  )
    return res
      .status(403)
      .json({
        error: "Owner permission is required for inventory adjustments",
      });
  next();
};
