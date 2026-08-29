const pool = require("../db");
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Normalize a name into a compact key for matching.
const normalize = (s = "") =>
  String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ");

const similarity = (a, b) => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.8;
  const aWords = a.split(" ").filter(Boolean);
  const bWords = b.split(" ").filter(Boolean);
  let hits = 0;
  aWords.forEach((w) => {
    if (bWords.includes(w)) hits += 1;
  });
  return Math.min(1, hits / Math.max(aWords.length, bWords.length));
};

// Map a spoken menu name to the closest existing menu item(s).
function resolveMenuItem(menu, spokenName) {
  const target = normalize(spokenName);
  const scored = menu
    .map((m) => ({ item: m, score: similarity(target, normalize(m.name)) }))
    .filter((s) => s.score >= 0.5)
    .sort((x, y) => y.score - x.score);

  if (scored.length === 0) return { kind: "NOT_FOUND", requestedName: spokenName };
  if (scored.length === 1 && scored[0].score === 1) {
    return { kind: "EXACT", requestedName: spokenName, item: scored[0].item };
  }
  // Multiple close matches — surface options for the human to choose.
  const exact = scored.find((s) => s.score === 1);
  if (exact && scored.length === 1) {
    return { kind: "EXACT", requestedName: spokenName, item: exact.item };
  }
  if (exact && scored.length > 1) {
    return { kind: "EXACT", requestedName: spokenName, item: exact.item, options: scored.slice(0, 5).map((s) => s.item) };
  }
  return { kind: "AMBIGUOUS", requestedName: spokenName, options: scored.slice(0, 5).map((s) => s.item) };
}

function resolveTableNumber(tables, raw) {
  const value = String(raw || "").trim();
  if (value !== String(parseInt(value, 10))) return null;
  return tables.find((t) => String(t.table_number) === String(parseInt(value, 10))) || null;
}

function resolveRoomNumber(rooms, raw) {
  const value = String(raw || "").trim();
  if (value !== String(parseInt(value, 10))) return null;
  return rooms.find((r) => String(r.room_number) === String(parseInt(value, 10))) || null;
}

/**
 * Unified Servon voice assistant.
 * 1) Loads the business's live menu, tables and rooms.
 * 2) Asks OpenAI to convert the spoken request into a strict structured intent.
 * 3) Resolves the extracted values against the authoritative database
 *    (exact table/room IDs, authoritative menu prices, ambiguity flags).
 *
 * The AI never invents IDs, prices, tax rates, or quantities — it only
 * extracts what the staff said. The backend/database decides what is valid.
 */
async function resolveVoiceAction(transcript, businessId) {
  // ── Load authoritative data scoped to this business ──────────────────
  const [menuRes, tableRes, roomRes, bizRes] = await Promise.all([
    pool.query(
      `SELECT id, name, price, category, is_available FROM menu_items
       WHERE business_id = $1 ORDER BY category, name`,
      [businessId]
    ),
    pool.query(
      "SELECT id, table_number FROM tables WHERE business_id = $1 ORDER BY table_number",
      [businessId]
    ),
    pool.query(
      `SELECT id, room_number, status, total_guests FROM hotel_rooms
       WHERE business_id = $1 ORDER BY room_number`,
      [businessId]
    ),
    pool.query(
      "SELECT cgst_percentage, sgst_percentage FROM businesses WHERE id = $1",
      [businessId]
    ),
  ]);

  const menu = menuRes.rows;
  const tables = tableRes.rows;
  const rooms = roomRes.rows;
  const cgstPercent = parseFloat(bizRes.rows[0]?.cgst_percentage || 0);
  const sgstPercent = parseFloat(bizRes.rows[0]?.sgst_percentage || 0);

  const menuBlock = menu
    .map((m, idx) => `${idx + 1}. ${m.name} (${m.category || "—"}, ₹${parseFloat(m.price)})`)
    .join("\n");
  const tablesBlock = tables.map((t) => t.table_number).join(", ") || "(none yet)";
  const roomsBlock = rooms.map((r) => r.room_number).join(", ") || "(none yet)";

  const prompt = `
You are the ordering/assistant brain for a hotel-restaurant's staff app called Servon.

The staff member spoke into the microphone. Convert their speech (English, Hindi,
Marathi, or a natural mix) into a SINGLE strict JSON object. Do NOT write anything
except the JSON object.

EXACT MENU ITEMS (use only these names when matching):
${menuBlock}

KNOWN TABLE NUMBERS: ${tablesBlock}
KNOWN ROOM NUMBERS: ${roomsBlock}

Return JSON with this exact shape (null when not mentioned):
{
  "intent": "CREATE_ORDER" | "ROOM_CHECK_IN" | "ROOM_EDIT" | "ROOM_CHECK_OUT" | "UNKNOWN",
  "table": "spoken table number as string or null",
  "items": [ { "name": "menu item name AS SPOKEN", "quantity": 2 } ],
  "room": "spoken room number as string or null",
  "guests": { "total": 0, "male": 0, "female": 0, "children": 0 },
  "action": "check_in" | "check_out" | "edit" | null
}

RULES:
- "intent" must be CREATE_ORDER when the staff talks about ordering food for a TABLE.
- "intent" must be ROOM_* when they talk about a ROOM and guests staying in it.
- For rooms, extract the room number into "room" and guest counts into "guests".
  A check-out intent has no guest counts. If they want to change an existing
  room's occupancy, use ROOM_EDIT.
- For orders, extract the spoken table number into "table" and each dish + quantity
  into "items". Put the dish name exactly as spoken (don't translate it). Only include
  quantities the staff actually said.
- NEVER invent prices, IDs, tax rates, restaurant IDs, or menu items that were not spoken.
- If the request is unclear, set "intent" to "UNKNOWN".
- Do not output markdown, commentary, or arrays outside the JSON.

USER SPOKE: "${transcript}"
`;

  let intent;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You convert staff speech into strict structured JSON for a restaurant/hotel assistant." },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      max_tokens: 700,
    });
    intent = JSON.parse(response.choices[0].message.content.trim());
  } catch (err) {
    console.error("Servon action AI extraction error:", err.message);
    return {
      success: false,
      transcript,
      error: "I couldn't understand the request clearly. Please try again.",
      intent: null,
    };
  }

  return resolveIntent({ intent, transcript, menu, tables, rooms, cgstPercent, sgstPercent });
}

// Build a fully-resolved, human-confirmable payload from the AI's structured intent.
function resolveIntent({ intent, transcript, menu, tables, rooms, cgstPercent, sgstPercent }) {
  const type = intent.intent || "UNKNOWN";
  const payload = {
    success: true,
    transcript,
    intent: {
      type,
      table: null,
      tableRaw: intent.table || null,
      items: [],
      ambiguities: [],
      unavailable: [],
      room: null,
      roomRaw: intent.room || null,
      guests: intentionNum(intent.guests),
      action: intent.action || null,
      summary: null,
      errors: [],
      warnings: [],
    },
  };

  // ── ORDER intent ────────────────────────────────────────────────────
  if (type === "CREATE_ORDER") {
    const table = resolveTableNumber(tables, intent.table);
    if (intent.table && !table) {
      payload.intent.errors.push(`Table ${intent.table} was not found in this restaurant.`);
    }
    payload.intent.table = table || null;

    const items = Array.isArray(intent.items) ? intent.items : [];
    if (items.length === 0) {
      payload.intent.warnings.push("No dishes were recognised. Please add items or retry.");
    }

    let subtotal = 0;
    for (const it of items) {
      const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
      const resolved = resolveMenuItem(menu, it.name);
      if (resolved.kind === "NOT_FOUND") {
        payload.intent.ambiguities.push({ requestedName: it.name, options: [] });
        payload.intent.warnings.push(`"${it.name}" was not found on your menu.`);
        continue;
      }
      if (resolved.kind === "AMBIGUOUS") {
        payload.intent.ambiguities.push({ requestedName: it.name, options: resolved.options });
        payload.intent.warnings.push(`"${it.name}" could match multiple items — please pick one.`);
        continue;
      }
      const price = parseFloat(resolved.item.price) || 0;
      if (!resolved.item.is_available) {
        payload.intent.unavailable.push({ ...resolved.item, quantity: qty });
        payload.intent.warnings.push(`${resolved.item.name} is currently unavailable.`);
      }
      subtotal += price * qty;
      payload.intent.items.push({
        menuItem: resolved.item,
        requestedName: it.name,
        quantity: qty,
        price,
        lineTotal: +(price * qty).toFixed(2),
        available: !!resolved.item.is_available,
      });
      if (resolved.options && resolved.options.length) {
        payload.intent.ambiguities.push({ requestedName: it.name, options: resolved.options });
      }
    }

    const cgst = subtotal * cgstPercent / 100;
    const sgst = subtotal * sgstPercent / 100;
    payload.intent.summary = {
      subtotal: +subtotal.toFixed(2),
      cgstPercent,
      sgstPercent,
      cgst: +cgst.toFixed(2),
      sgst: +sgst.toFixed(2),
      gstTotal: +(cgst + sgst).toFixed(2),
      grandTotal: +(subtotal + cgst + sgst).toFixed(2),
    };
  }

  // ── ROOM intent ─────────────────────────────────────────────────────
  if (["ROOM_CHECK_IN", "ROOM_EDIT", "ROOM_CHECK_OUT"].includes(type)) {
    const room = resolveRoomNumber(rooms, intent.room);
    if (intent.room && !room) {
      payload.intent.errors.push(`Room ${intent.room} was not found in this hotel.`);
    }
    payload.intent.room = room || null;

    if (type === "ROOM_CHECK_OUT") {
      payload.intent.guests = { total: 0, male: 0, female: 0, children: 0 };
      payload.intent.action = "check_out";
    } else if (type === "ROOM_EDIT") {
      payload.intent.action = "edit";
    } else {
      payload.intent.action = "check_in";
    }

    const { total = 0, male = 0, female = 0, children = 0 } = payload.intent.guests || {};
    if (total > 0 && male + female + children !== total) {
      payload.intent.warnings.push("Guest breakdown doesn't add up to the total — you can still confirm or edit.");
    }
  }

  return payload;
}

function intentionNum(g) {
  const src = g && typeof g === "object" ? g : {};
  return {
    total: parseInt(src.total, 10) || 0,
    male: parseInt(src.male, 10) || 0,
    female: parseInt(src.female, 10) || 0,
    children: parseInt(src.children, 10) || 0,
  };
}

module.exports = { resolveVoiceAction, resolveIntent };