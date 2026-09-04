import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { LanguageSelector, useLocale } from "../context/LocaleContext";
import { localizedItemName } from "../utils/itemName";

export default function FeedbackPage() {
  const { t, language } = useLocale();
  const { businessId } = useParams();
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get("table") || "Unknown";
  const orderId = searchParams.get("orderId");

  const [orderedItems, setOrderedItems] = useState([]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  // ─── FETCH ITEMS FOR THIS SPECIFIC ORDER ─────────────────────────
  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        if (orderId) {
          const res = await axios.get(`${API_BASE}/orders/${orderId}`);
          const rawItems = res.data?.items;
          const items = Array.isArray(rawItems) ? rawItems : JSON.parse(rawItems || "[]");
          setOrderedItems(items);
        } else if (tableNumber !== "Unknown") {
          // Fallback: search today's active table orders if no orderId passed
          const res = await axios.get(`${API_BASE}/orders?businessId=${businessId}&table=${tableNumber}`);
          const rawItems = res.data?.[0]?.items;
          const items = Array.isArray(rawItems) ? rawItems : JSON.parse(rawItems || "[]");
          setOrderedItems(items);
        }
      } catch (err) {
        console.error("Failed to fetch order items for feedback:", err);
      }
    };

    fetchOrderDetails();
  }, [businessId, tableNumber, orderId, API_BASE]);

  // ─── SUBMIT FEEDBACK ──────────────────────────────────────────────
  const handleSubmit = async () => {
    if (rating === 0) return alert(t("ratingNeeded"));
    setLoading(true);

    try {
      await axios.post(`${API_BASE}/reviews`, {
        businessId,
        tableNumber,
        orderId,
        items: orderedItems, // Sends only the items belonging to this order
        rating,
        comment,
      });
      setSubmitted(true);
    } catch (err) {
      alert(t("feedbackFailed"));
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: 40, textAlign: "center", minHeight: "100vh", backgroundColor: "#fff" }}>
        <h1 style={{ fontSize: 60, margin: 0 }}>🎉</h1>
        <h2 style={{ marginTop: 20, fontWeight: "800" }}>{t("feedbackThanks")}</h2>
        <p style={{ color: "#6B7280", marginTop: 10 }}>{t("feedbackHelp")}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 30, minHeight: "100vh", backgroundColor: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}><LanguageSelector /></div>
      <h2 style={{ fontWeight: "800", fontSize: 24, textAlign: "center", marginBottom: 5 }}>{t("mealQuestion")}</h2>
      <p style={{ textAlign: "center", color: "#6B7280", marginBottom: 20 }}>{t("table")} {tableNumber}</p>

      {/* DISPLAY SPECIFIC ORDERED ITEMS */}
      {orderedItems.length > 0 && (
        <div style={{ backgroundColor: "#F9FAFB", borderRadius: 12, padding: 12, marginBottom: 25, border: "1px solid #F3F4F6" }}>
          <span style={{ fontSize: 12, fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 8 }}>
            {t("yourOrder")}
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {orderedItems.map((item, idx) => (
              <span
                key={idx}
                style={{
                  backgroundColor: "#ECEFF1",
                  fontSize: 13,
                  fontWeight: "600",
                  padding: "4px 10px",
                  borderRadius: 20,
                  color: "#374151",
                }}
              >
                {localizedItemName(item, language)} × {item.quantity || 1}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* STAR RATING */}
      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 30 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            onClick={() => setRating(star)}
            style={{
              fontSize: 40,
              cursor: "pointer",
              color: star <= rating ? "#F59E0B" : "#E5E7EB",
              transition: "color 0.2s",
            }}
          >
            ★
          </span>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ fontWeight: "600", display: "block", marginBottom: 8 }}>{t("comments")}</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("commentsPlaceholder")}
          rows={4}
          style={{ width: "100%", padding: 15, borderRadius: 12, border: "1px solid #E5E7EB", resize: "none", fontFamily: "inherit" }}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || rating === 0}
        style={{
          width: "100%",
          padding: 16,
          borderRadius: 12,
          backgroundColor: rating === 0 ? "#D1D5DB" : "#10B981",
          color: "#fff",
          fontWeight: "800",
          border: "none",
          fontSize: 16,
          cursor: rating === 0 ? "not-allowed" : "pointer",
        }}
      >
        {loading ? t("submitting") : t("submitFeedback")}
      </button>
    </div>
  );
}
