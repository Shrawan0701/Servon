import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useCart } from "../context/CartContext";

export default function OrderSuccessPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCart } = useCart();

  // Retrieve the IDs passed from the CartPage
  const { businessId, tableId } = location.state || {};

  const [timeLeft, setTimeLeft] = useState(60);

  // 60-Second Countdown Timer
  useEffect(() => {
    if (timeLeft <= 0) {
      sessionStorage.removeItem("activeOrderId");
      clearCart();
      return;
    }

    const timerId = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timerId);
  }, [timeLeft, clearCart]);

  const handleEditOrder = () => {
    // Route back to the specific restaurant and table menu
    if (businessId && tableId) {
      navigate(`/menu/${businessId}/${tableId}`);
    } else {
      // Safe fallback just in case they refreshed the page
      navigate(-1);
    }
  };

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
        Order Placed!
      </h1>
      <p style={{ fontSize: 16, color: "#4B5563", maxWidth: 400, marginBottom: 40, lineHeight: 1.5 }}>
        Your order has been sent to the kitchen. The restaurant will start preparing it shortly.
      </p>

      {timeLeft > 0 ? (
        <div style={{ marginBottom: 40, width: "100%", maxWidth: 300 }}>
          <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 8, fontWeight: 500 }}>
            Edit window closes in
          </p>
          <div style={{ fontSize: 56, fontWeight: 900, color: "#111827", marginBottom: 20 }}>
            {timeLeft}s
          </div>
          
          {/* THE EDIT BUTTON */}
          <button 
            onClick={handleEditOrder}
            style={{ 
              backgroundColor: "#111827", 
              color: "#fff", 
              border: "none", 
              borderRadius: 12, 
              padding: "14px 24px", 
              fontSize: 16, 
              fontWeight: 700, 
              cursor: "pointer", 
              width: "100%",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
            }}
          >
            Edit Order
          </button>
          
          <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 16 }}>
            Go back to menu to modify your order
          </p>
        </div>
      ) : (
        <div style={{ 
          backgroundColor: "#ECFDF5", 
          padding: "20px 32px", 
          borderRadius: 16, 
          border: "1px solid #A7F3D0", 
          marginBottom: 40 
        }}>
          <p style={{ color: "#065F46", fontSize: 16, fontWeight: 700, margin: 0 }}>
            🔥 Order is now being prepared!
          </p>
        </div>
      )}

      <p style={{ fontSize: 13, color: "#9CA3AF" }}>Order ID: {orderId}</p>

      {/* Show a "Order More" button when the timer expires so they aren't stuck on this page forever */}
      {timeLeft === 0 && businessId && tableId && (
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
          Order More Items
        </button>
      )}

    </div>
  );
}