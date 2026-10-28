const crypto = require("node:crypto");
const pool = require("../db");
const { lockTenant } = require("../services/inventoryTransaction");
// Buffer the HTTP response until order updates and stock movements commit.
// The same business lock is used throughout the inventory subsystem.
module.exports = (handler) => async (req, res) => {
  let db;
  let status = 200,
    body;
  const response = {
    status(code) {
      status = code;
      return this;
    },
    json(value) {
      body = value;
      return this;
    },
  };
  try {
    db = await pool.connect();
    req.afterCommit = [];
    await db.query("BEGIN");
    let businessId = req.businessId || req.body.businessId;
    if (!businessId && req.params.id) {
      const found = await db.query(
        "SELECT business_id FROM orders WHERE id=$1",
        [req.params.id],
      );
      businessId = found.rows[0]?.business_id;
    }
    if (!businessId) {
      await db.query("ROLLBACK");
      return res.status(404).json({ error: "Order not found" });
    }
    await lockTenant(db, businessId);
    const key = req.headers["idempotency-key"];
    const fingerprint = crypto
      .createHash("sha256")
      .update(JSON.stringify([req.method, req.originalUrl, req.body]))
      .digest("hex");
    if (key) {
      if (typeof key !== "string" || key.length > 150)
        throw Object.assign(new Error("Invalid idempotency key"), {
          status: 400,
        });
      const previous = await db.query(
        "SELECT * FROM inventory_request_keys WHERE business_id=$1 AND request_key=$2",
        [businessId, key],
      );
      if (previous.rowCount) {
        await db.query("ROLLBACK");
        if (previous.rows[0].fingerprint !== fingerprint)
          return res.status(409).json({
            error: "Idempotency key was already used for a different request",
          });
        return res
          .status(previous.rows[0].status)
          .json(previous.rows[0].response);
      }
    }
    await handler(req, response, db);
    if (status >= 400) await db.query("ROLLBACK");
    else {
      if (key)
        await db.query(
          "INSERT INTO inventory_request_keys(business_id,request_key,fingerprint,response,status) VALUES($1,$2,$3,$4,$5)",
          [businessId, key, fingerprint, JSON.stringify(body), status],
        );
      await db.query("COMMIT");
    }
    res.status(status).json(body);
    if (status < 400)
      for (const callback of req.afterCommit)
        Promise.resolve()
          .then(callback)
          .catch((error) =>
            console.warn(
              JSON.stringify({
                event: "order_after_commit_failed",
                type: error.name,
              }),
            ),
          );
  } catch (error) {
    if (db) await db.query("ROLLBACK");
    console.warn(
      JSON.stringify({
        event: "order_transaction_failed",
        status: error.status || 500,
        code: error.code || null,
      }),
    );
    res.status(error.status || 500).json({
      error: error.status ? error.message : "Order could not be saved",
    });
  } finally {
    if (db) db.release();
  }
};
