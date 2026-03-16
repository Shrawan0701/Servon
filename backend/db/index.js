const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

// Force an immediate connection test
pool.connect((err, client, release) => {
  if (err) {
    console.error("CRITICAL: Database connection failed!", err.stack);
  } else {
    console.log("PostgreSQL successfully connected!");
    release(); // Return the client back to the pool
  }
});

module.exports = pool;