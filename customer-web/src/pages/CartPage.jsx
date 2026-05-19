import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { placeOrder } from "../api";

// --- Helper Functions from Friend's Push ---

// Resolves thali contents from allItems + thali_custom string
function getThaliContents(item, allItems) {
  const picked = (item.thali_includes || []).map(String);
  const pickedNames = allItems
    .filter((i) => picked.includes(String(i.id)))
    .map((i) => i.name);
  const custom = (item.thali_custom || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...pickedNames, ...custom];
}

// Amber chips showing what's in the thali
function ThaliContents({ item, allItems }) {
  const contents = getThaliContents(item, allItems);
  if (!contents.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
      {contents.map((name, i) => (
        <span key={i} style={styles.thaliChip}>
          {name}
        </span>
      ))}
    </div>
  );
}

// --- Main Component ---

export default function CartPage() {
  const { businessId, tableId } = useParams();
  const navigate = useNavigate();
  const { cartItems, addToCart, removeFromCart, totalAmount } = useCart();

  const [instructions, setInstructions] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState(null);

  // Using cartItems as the lookup pool for Thali contents
  const allItems = cartItems;

  if (cartItems.length === 0) {
    return (
      <div
        className="d-flex flex-column align-items-center justify-content-center"
        style={{ height: "100vh" }}
      >
        <div style={{ fontSize: 48 }}>🛒</div>
        <h5 className="mt-3">Your cart is empty</h5>
        <button className="btn btn-dark mt-3" onClick={() => navigate(-1)}>
          Go Back to Menu
        </button>
      </div>
    );
  }

  const handleConfirmOrder = async () => {
    setPlacing(true);
    setError(null);

    try {
      // Combined item mapping: mapping your basic fields + friend's thali fields
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

      // Check if we are editing an active order (Your logic)
      const activeOrderId = sessionStorage.getItem("activeOrderId");

      const res = await placeOrder({
        businessId,
        tableId,
        items: orderItems,
        totalAmount,
        specialInstructions: instructions,
        orderId: activeOrderId, // Send orderId to backend if it exists
      });

      // Save the active order ID so we can edit it if needed
      sessionStorage.setItem("activeOrderId", res.data.id);

      navigate(`/order-success/${res.data.id}`, {
        state: { businessId, tableId },
      });
    } catch (err) {
      setError(
        err.response?.data?.error || "Failed to place order. Please try again."
      );
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        minHeight: "100vh",
        background: "#fff",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #ebebeb",
          position: "sticky",
          top: 0,
          background: "#fff",
          zIndex: 10,
        }}
      >
        <div className="d-flex align-items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            style={{
              background: "none",
              border: "none",
              fontSize: 22,
              cursor: "pointer",
            }}
          >
            ←
          </button>
          <h5 className="mb-0 fw-bold">Your Cart</h5>
        </div>
      </div>

      {/* Cart Items */}
      <div style={{ padding: "16px 20px" }}>
        {cartItems.map((item) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start", // Changed to flex-start to accommodate Thali chips
              marginBottom: 16,
              paddingBottom: 16,
              borderBottom: "1px solid #f0f0f0",
              gap: 10,
            }}
          >
            <div style={{ flex: 1 }}>
              {/* Name + Thali Badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{item.name}</span>
                {item.is_thali && <span style={styles.thaliBadge}>Thali</span>}
              </div>

              <div style={{ color: "#888", fontSize: 13, marginTop: 2 }}>
                ₹{item.price} each
              </div>

              {/* Thali contents chips (Friend's logic) */}
              {item.is_thali && <ThaliContents item={item} allItems={allItems} />}

              {/* Qty controls below name/chips */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <button className="qty-btn" onClick={() => removeFromCart(item.id)}>
                  –
                </button>
                <span style={{ fontWeight: 700, minWidth: 20, textAlign: "center" }}>
                  {item.quantity}
                </span>
                <button className="qty-btn" onClick={() => addToCart(item)}>
                  +
                </button>
              </div>
            </div>

            <div style={{ fontWeight: 700, minWidth: 60, textAlign: "right", paddingTop: 2 }}>
              ₹{(item.price * item.quantity).toFixed(0)}
            </div>
          </div>
        ))}

        {/* Special Instructions */}
        <div style={{ marginTop: 12 }}>
          <label
            style={{
              fontWeight: 600,
              fontSize: 14,
              marginBottom: 6,
              display: "block",
            }}
          >
            Special Instructions
          </label>

          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="E.g. No onions, extra spicy..."
            rows={3}
            style={{
              width: "100%",
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 14,
              resize: "none",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Bill Summary */}
        <div
          style={{
            marginTop: 20,
            background: "#f8f9fa",
            borderRadius: 10,
            padding: "14px 16px",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 15 }}>
            Bill Summary
          </div>

          {cartItems.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
                marginBottom: 4,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {item.name}
                {item.is_thali && <span style={styles.thaliBadgeSmall}>Thali</span>}
                {" "}× {item.quantity}
              </span>
              <span>₹{(item.price * item.quantity).toFixed(0)}</span>
            </div>
          ))}

          <div
            style={{
              borderTop: "1px solid #ddd",
              marginTop: 10,
              paddingTop: 10,
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            <span>Total</span>
            <span>₹{totalAmount.toFixed(0)}</span>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger mt-3" style={{ fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* Payment notice for the customer */}
        <div 
          style={{ 
            marginTop: 24, 
            textAlign: "center", 
            color: "#666", 
            fontSize: 13, 
            fontWeight: 500 
          }}
        >
          Confirm your order and pay on bill table
        </div>

        <button
          className="confirm-btn mt-2"
          onClick={handleConfirmOrder}
          disabled={placing}
        >
          {placing
            ? "Placing Order..."
            : `Confirm Order · ₹${totalAmount.toFixed(0)}`}
        </button>
      </div>
    </div>
  );
}

const styles = {
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
};