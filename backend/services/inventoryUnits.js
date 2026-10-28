const UNITS = {
  kg: ["weight", 1000],
  gm: ["weight", 1],
  g: ["weight", 1],
  litre: ["volume", 1000],
  l: ["volume", 1000],
  ml: ["volume", 1],
  pcs: ["count", 1],
  bottles: ["count", 1],
};
function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function number(
  value,
  label = "Quantity",
  { zero = false, integer = false } = {},
) {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    String(value).trim() === ""
  )
    fail(`${label} is required`);
  const n = Number(value);
  if (
    !Number.isFinite(n) ||
    n < 0 ||
    (!zero && n === 0) ||
    n > 1e9 ||
    (integer && !Number.isSafeInteger(n))
  )
    fail(
      `${label} must be ${integer ? "a whole" : "a valid"} ${zero ? "non-negative" : "positive"} number`,
    );
  return n;
}
function convert(quantity, from, to) {
  const a = UNITS[from],
    b = UNITS[to];
  if (!a || !b || a[0] !== b[0]) fail(`Incompatible units: ${from} and ${to}`);
  return number(round((number(quantity) * a[1]) / b[1]), "Converted quantity");
}
function round(n) {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}
function physicalQuantity(row, item) {
  if (row.full_bottles !== undefined && row.full_bottles !== null) {
    const full = number(row.full_bottles, "Full bottles", {
      zero: true,
      integer: true,
    });
    const opened = number(row.opened_ml ?? 0, "Opened stock in ml", {
      zero: true,
    });
    if (UNITS[item.unit]?.[0] === "volume") {
      const size = number(row.bottle_size_ml, "Bottle size in ml");
      if (opened >= size)
        fail(
          "Opened stock must be less than one bottle. Include other full bottles in the full-bottle count.",
        );
      const total = full * size + opened;
      return {
        quantity: number(
          item.unit === "litre" ? round(total / 1000) : round(total),
          "Physical stock",
          { zero: true },
        ),
        full_bottles: full,
        bottle_size_ml: size,
        opened_ml: opened,
      };
    }
    if (item.unit !== "pcs" || opened !== 0)
      fail("Bottle counts require a pieces or volume stock item");
    return {
      quantity: full,
      full_bottles: full,
      bottle_size_ml: null,
      opened_ml: 0,
    };
  }
  return {
    quantity: number(row.physical_stock, "Physical count", { zero: true }),
    full_bottles: null,
    bottle_size_ml: null,
    opened_ml: null,
  };
}
module.exports = { UNITS, fail, number, convert, round, physicalQuantity };
