const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");
const subscription = require("../middleware/subscription");

// Validate that known guest counts add up to the reported total.
// If NO breakdown (male/female/children) is provided we allow an
// unclassified total; as soon as any breakdown value is supplied the
// counts must reconcile exactly unless allowUnclassified is set.
function validateCounts({ total, male, female, children, allowUnclassified }) {
  const tot = total === "" || total == null ? 0 : parseInt(total, 10);
  const m = male === "" || male == null ? 0 : parseInt(male, 10);
  const f = female === "" || female == null ? 0 : parseInt(female, 10);
  const c = children === "" || children == null ? 0 : parseInt(children, 10);

  if (Number.isNaN(tot) || tot < 0) return { error: "Total guests must be a valid non-negative number." };
  if ([m, f, c].some(Number.isNaN)) return { error: "Guest counts must be valid numbers." };
  if (m < 0 || f < 0 || c < 0) return { error: "Guest counts cannot be negative." };

  const hasBreakdown = m > 0 || f > 0 || c > 0;
  if (hasBreakdown && !allowUnclassified && m + f + c !== tot) {
    return { error: "Male + Female + Children must equal Total Guests." };
  }
  return { total: tot, male: m, female: f, children: c };
}

// ─── GET ALL ROOMS ────────────────────────────────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM hotel_rooms
       WHERE business_id = $1
       ORDER BY created_at ASC`,
      [req.businessId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch rooms error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── ADD ROOM (room number only, empty/available) ─────────────────────
router.post("/", auth, subscription, async (req, res) => {
  const { roomNumber } = req.body;
  if (!roomNumber || !String(roomNumber).trim()) {
    return res.status(400).json({ error: "Room number is required." });
  }
  try {
    const existing = await pool.query(
      "SELECT id FROM hotel_rooms WHERE business_id = $1 AND room_number = $2",
      [req.businessId, String(roomNumber).trim()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Room number already exists." });
    }
    const result = await pool.query(
      `INSERT INTO hotel_rooms (business_id, room_number, status, total_guests, male, female, children)
       VALUES ($1, $2, 'AVAILABLE', 0, 0, 0, 0)
       RETURNING *`,
      [req.businessId, String(roomNumber).trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Add room error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── CHECK IN (occupies the room with guest counts) ───────────────────
router.post("/:id/check-in", auth, async (req, res) => {
  const { total, male, female, children, allowUnclassified } = req.body;
  const counts = validateCounts({ total, male, female, children, allowUnclassified });
  if (counts.error) return res.status(400).json({ error: counts.error });

  try {
    const room = await pool.query(
      "SELECT * FROM hotel_rooms WHERE id = $1 AND business_id = $2",
      [req.params.id, req.businessId]
    );
    if (room.rows.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }
    if (room.rows[0].status === "OCCUPIED" && counts.total > 0) {
      return res.status(409).json({ error: "Room is already occupied." });
    }
    const result = await pool.query(
      `UPDATE hotel_rooms
       SET status = 'OCCUPIED',
           total_guests = $1,
           male = $2,
           female = $3,
           children = $4,
           checked_in_at = COALESCE(checked_in_at, NOW()),
           updated_at = NOW()
       WHERE id = $5 AND business_id = $6
       RETURNING *`,
      [counts.total, counts.male, counts.female, counts.children, req.params.id, req.businessId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Check-in room error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── EDIT ROOM / OCCUPANCY DETAILS ────────────────────────────────────
router.patch("/:id", auth, async (req, res) => {
  const { roomNumber, total, male, female, children, allowUnclassified } = req.body;
  const counts = validateCounts({ total, male, female, children, allowUnclassified });
  if (counts.error) return res.status(400).json({ error: counts.error });

  try {
    const current = await pool.query(
      "SELECT * FROM hotel_rooms WHERE id = $1 AND business_id = $2",
      [req.params.id, req.businessId]
    );
    if (current.rows.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    let newNumber = current.rows[0].room_number;
    if (roomNumber && String(roomNumber).trim() !== newNumber) {
      const dup = await pool.query(
        "SELECT id FROM hotel_rooms WHERE business_id = $1 AND room_number = $2 AND id <> $3",
        [req.businessId, String(roomNumber).trim(), req.params.id]
      );
      if (dup.rows.length > 0) {
        return res.status(409).json({ error: "Room number already exists." });
      }
      newNumber = String(roomNumber).trim();
    }

    const newStatus = counts.total > 0 ? "OCCUPIED" : "AVAILABLE";
    const result = await pool.query(
      `UPDATE hotel_rooms
       SET room_number = $1,
           status = $2,
           total_guests = $3,
           male = $4,
           female = $5,
           children = $6,
           checked_in_at = CASE WHEN $2 = 'OCCUPIED' THEN COALESCE(checked_in_at, NOW()) ELSE NULL END,
           updated_at = NOW()
       WHERE id = $7 AND business_id = $8
       RETURNING *`,
      [newNumber, newStatus, counts.total, counts.male, counts.female, counts.children, req.params.id, req.businessId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update room error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── CHECK OUT (clears room, sets available) ──────────────────────────
router.post("/:id/check-out", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE hotel_rooms
       SET status = 'AVAILABLE',
           total_guests = 0,
           male = 0,
           female = 0,
           children = 0,
           checked_in_at = NULL,
           updated_at = NOW()
       WHERE id = $1 AND business_id = $2
       RETURNING *`,
      [req.params.id, req.businessId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Check-out room error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── DELETE ROOM ──────────────────────────────────────────────────────
router.delete("/:id", auth, subscription, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM hotel_rooms WHERE id = $1 AND business_id = $2 RETURNING id",
      [req.params.id, req.businessId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }
    res.json({ message: "Room deleted" });
  } catch (err) {
    console.error("Delete room error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;