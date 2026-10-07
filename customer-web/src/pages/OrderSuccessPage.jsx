import { useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { LanguageSelector, useLocale } from "../context/LocaleContext";

export default function OrderSuccessPage() {
  const { t } = useLocale();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCart } = useCart();

  // Retrieve the IDs passed from the CartPage
  const { businessId, tableId } = location.state || {};

  useEffect(() => {
    sessionStorage.removeItem("activeOrderId");
    clearCart();
  }, [clearCart]);

  const handleOrderMore = () => {
    sessionStorage.removeItem("activeOrderId");
    clearCart();
    navigate(`/menu/${businessId}/${tableId}`);
  };

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      justifyContent: "center", 
      minHeight: "100vh", 
      backgroundColor: "#F9FAFB", 
      padding: 20, 
      textAlign: "center" 
    }}>
      
      <h1 style={{ fontSize: 36, fontWeight: 900, color: "#111827", marginBottom: 12 }}>
        {t("orderPlaced")}
      </h1>
      <p style={{ fontSize: 16, color: "#4B5563", maxWidth: 400, marginBottom: 40, lineHeight: 1.5 }}>
        {t("orderSent")}
      </p>

      <div style={{ 
        backgroundColor: "#ECFDF5", 
        padding: "20px 32px", 
        borderRadius: 16, 
        border: "1px solid #A7F3D0", 
        marginBottom: 40 
      }}>
        <p style={{ color: "#065F46", fontSize: 16, fontWeight: 700, margin: 0 }}>
          {t("preparing")}
        </p>
      </div>

      <p style={{ fontSize: 13, color: "#9CA3AF" }}>{t("orderId", { id: orderId })}</p>

      {businessId && tableId && (
        <button 
          onClick={handleOrderMore}
          style={{ 
            marginTop: 32, 
            backgroundColor: "transparent", 
            color: "#111827", 
            border: "2px solid #E5E7EB", 
            borderRadius: 12, 
            padding: "12px 24px", 
            fontSize: 15, 
            fontWeight: 700, 
            cursor: "pointer" 
          }}
        >
          {t("orderMore")}
        </button>
      )}

      <div style={{ position: "fixed", top: 12, right: 12 }}><LanguageSelector /></div>
    </div>
  );
}
