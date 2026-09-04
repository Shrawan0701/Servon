import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { placeOrder, getBusinessProfile } from "../api";
import { LanguageSelector, useLocale } from "../context/LocaleContext";
import { localizedItemName } from "../utils/itemName";

// --- Helper Functions ---

function getThaliContents(item, allItems, language) {
  let includes = item.thali_includes || [];
  if (typeof includes === "string") {
    includes = includes.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(includes)) {
    includes = [];
  }

  const picked = includes.map(String);
  const pickedNames = allItems
    .filter((i) => picked.includes(String(i.id)))
    .map((i) => localizedItemName(i, language));
  const custom = (item.thali_custom || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...pickedNames, ...custom];
}

function ThaliContents({ item, allItems, language }) {
  const contents = getThaliContents(item, allItems, language);
  if (!contents.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
      {contents.map((name, i) => (
        <span key={i} style={styles.thaliChip}>{name}</span>
      ))}
    </div>
  );
}

// --- Main Component ---

export default function CartPage() {
  const { t, language } = useLocale();
  const { businessId, tableId } = useParams();
  const navigate = useNavigate();
  const { cartItems, addToCart, removeFromCart } = useCart();

  const [instructions, setInstructions] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState(null);
  const [businessProfile, setBusinessProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // ─── FETCH BUSINESS PROFILE (GST RATES) ──────────────────────────
  useEffect(() => {
    const fetchProfile = async () => {
      if (!businessId) return;
      setProfileLoading(true);
      try {
        const res = await getBusinessProfile(businessId);
        setBusinessProfile(res.data);
      } catch (err) {
        console.error("Failed to fetch business profile:", err);
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, [businessId]);

  // ─── COMPUTE SUBTOTAL & GST ──────────────────────────────────────
// ─── COMPUTE SUBTOTAL & GST ──────────────────────────────────────
const subtotal = useMemo(
  () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
  [cartItems]
);

const { cgstAmount, sgstAmount, gstTotal, grandTotal, cgstPercent, sgstPercent } = useMemo(() => {
  const cgstP = parseFloat(businessProfile?.cgst_percentage) || 0;
  const sgstP = parseFloat(businessProfile?.sgst_percentage) || 0;
  const cgst = (subtotal * cgstP) / 100;
  const sgst = (subtotal * sgstP) / 100;
  return {
    cgstPercent: cgstP,
    sgstPercent: sgstP,
    cgstAmount: cgst,
    sgstAmount: sgst,
    gstTotal: cgst + sgst,
    grandTotal: subtotal + cgst + sgst,
  };
}, [subtotal, businessProfile]);

  // ─── HANDLERS ──────────────────────────────────────────────────────
  const handleConfirmOrder = async () => {
    setPlacing(true);
    setError(null);

    try {
      const orderItems = cartItems.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        imageUrl: i.image_url,
        is_thali: i.is_thali || false,
        thali_includes: i.thali_includes || [],
        thali_custom: i.thali_custom || "",
      }));

      const activeOrderId = sessionStorage.getItem("activeOrderId");

      // Send subtotal (backed will add GST & discount if any)
      const res = await placeOrder({
        businessId,
        tableId,
        items: orderItems,
        totalAmount: subtotal,   // backend will compute final total
        specialInstructions: instructions,
        orderId: activeOrderId,
      });

      sessionStorage.setItem("activeOrderId", res.data.id);

      navigate(`/order-success/${res.data.id}`, {
        state: { businessId, tableId },
      });
    } catch (err) {
      setError(
        err.response?.data?.error || t("orderFailed")
      );
    } finally {
      setPlacing(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div
        className="d-flex flex-column align-items-center justify-content-center"
        style={{ height: "100vh" }}
      >
        <div style={{ fontSize: 48 }}>🛒</div>
        <h5 className="mt-3">{t("cartEmpty")}</h5>
        <button className="btn btn-dark mt-3" onClick={() => navigate(-1)}>
          {t("goBackMenu")}
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.backBtn}>←</button>
        <h5 className="mb-0 fw-bold">{t("yourCart")}</h5>
        <div style={{ marginLeft: "auto" }}><LanguageSelector /></div>
      </div>

      <div style={styles.content}>
        {cartItems.map((item) => (
          <div key={item.id} style={styles.cartItem}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{localizedItemName(item, language)}</span>
                {item.is_thali && <span style={styles.thaliBadge}>{t("thali")}</span>}
              </div>
              <div style={{ color: "#888", fontSize: 13, marginTop: 2 }}>{t("each", { price: item.price })}</div>
              {item.is_thali && <ThaliContents item={item} allItems={cartItems} language={language} />}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <button className="qty-btn" onClick={() => removeFromCart(item.id)}>–</button>
                <span style={{ fontWeight: 700, minWidth: 20, textAlign: "center" }}>{item.quantity}</span>
                <button className="qty-btn" onClick={() => addToCart(item)}>+</button>
              </div>
            </div>
            <div style={{ fontWeight: 700, minWidth: 60, textAlign: "right", paddingTop: 2 }}>
              ₹{(item.price * item.quantity).toFixed(0)}
            </div>
          </div>
        ))}

        {/* Special Instructions */}
        <div style={styles.instructionsContainer}>
          <label style={styles.label}>{t("specialInstructions")}</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={t("instructionsPlaceholder")}
            rows={3}
            style={styles.textarea}
          />
        </div>

        {/* Bill Summary with GST */}
       {/* Bill Summary */}
<div style={styles.billSummary}>
  <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 15 }}>{t("billSummary")}</div>
  {cartItems.map((item) => (
    <div key={item.id} style={styles.billRow}>
      <span>{localizedItemName(item, language)} × {item.quantity}</span>
      <span>₹{(item.price * item.quantity).toFixed(2)}</span>
    </div>
  ))}
  <div style={styles.billSubtotal}>
    <span>{t("subtotal")}</span>
    <span>₹{subtotal.toFixed(2)}</span>
  </div>
  {cgstAmount > 0 && (
    <div style={styles.billRowMuted}>
      <span>CGST ({cgstPercent}%)</span>
      <span>₹{cgstAmount.toFixed(2)}</span>
    </div>
  )}
  {sgstAmount > 0 && (
    <div style={styles.billRowMuted}>
      <span>SGST ({sgstPercent}%)</span>
      <span>₹{sgstAmount.toFixed(2)}</span>
    </div>
  )}
  <div style={styles.billGrandTotal}>
    <span>{t("grandTotal")}</span>
    <span>₹{grandTotal.toFixed(2)}</span>
  </div>
</div>

        {error && <div className="alert alert-danger mt-3" style={{ fontSize: 14 }}>{error}</div>}

        <div style={styles.paymentNotice}>
          {t("paymentNotice")}
        </div>

        <button
          className="confirm-btn mt-2"
          onClick={handleConfirmOrder}
          disabled={placing}
          style={styles.confirmBtn}
        >
          {placing
            ? t("placingOrder")
            : t("confirmOrder", { total: grandTotal.toFixed(0) })}
        </button>
      </div>
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────
const styles = {
  container: {
    maxWidth: 480,
    margin: "0 auto",
    minHeight: "100vh",
    background: "#fff",
  },
  header: {
    padding: "16px 20px",
    borderBottom: "1px solid #ebebeb",
    position: "sticky",
    top: 0,
    background: "#fff",
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    background: "none",
    border: "none",
    fontSize: 22,
    cursor: "pointer",
  },
  content: {
    padding: "16px 20px",
  },
  cartItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottom: "1px solid #f0f0f0",
    gap: 10,
  },
  thaliBadge: {
    background: "#111",
    color: "#fff",
    fontSize: 10,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 20,
  },
  thaliBadgeSmall: {
    background: "#e5e7eb",
    color: "#374151",
    fontSize: 10,
    fontWeight: 600,
    padding: "1px 6px",
    borderRadius: 4,
    verticalAlign: "middle",
  },
  thaliChip: {
    fontSize: 10,
    fontWeight: 500,
    color: "#854F0B",
    background: "#FAEEDA",
    borderRadius: 4,
    padding: "2px 6px",
  },
  instructionsContainer: {
    marginTop: 12,
  },
  label: {
    fontWeight: 600,
    fontSize: 14,
    marginBottom: 6,
    display: "block",
  },
  textarea: {
    width: "100%",
    border: "1px solid #ddd",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
  },
  billSummary: {
    marginTop: 20,
    background: "#f8f9fa",
    borderRadius: 10,
    padding: "14px 16px",
  },
  billRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 14,
    marginBottom: 4,
  },
  billRowMuted: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 4,
  },
  billSubtotal: {
    display: "flex",
    justifyContent: "space-between",
    fontWeight: 600,
    margin: "6px 0",
    borderTop: "1px dashed #ddd",
    paddingTop: 8,
  },
  billGrandTotal: {
    display: "flex",
    justifyContent: "space-between",
    fontWeight: 800,
    fontSize: 16,
    borderTop: "1px solid #ddd",
    marginTop: 10,
    paddingTop: 10,
  },
  paymentNotice: {
    marginTop: 24,
    textAlign: "center",
    color: "#666",
    fontSize: 13,
    fontWeight: 500,
  },
  confirmBtn: {
    width: "100%",
    marginTop: 8,
    padding: "14px",
    background: "#111",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    transition: "opacity 0.2s",
    ":disabled": { opacity: 0.6 },
  },
};
