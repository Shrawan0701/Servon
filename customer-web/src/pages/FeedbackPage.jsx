import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
// If using Next.js, use useRouter and useSearchParams from next/navigation
import axios from "axios";

export default function FeedbackPage() {
  const { businessId } = useParams();
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get("table") || "Unknown";

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return alert("Please select a star rating!");
    setLoading(true);

    try {
      await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/reviews`, {
        businessId,
        tableNumber,
        rating,
        comment
      });
      setSubmitted(true);
    } catch (err) {
      alert("Failed to submit feedback. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: 40, textAlign: "center", minHeight: "100vh", backgroundColor: "#fff" }}>
        <h1 style={{ fontSize: 60, margin: 0 }}>🎉</h1>
        <h2 style={{ marginTop: 20, fontWeight: "800" }}>Thank you!</h2>
        <p style={{ color: "#6B7280", marginTop: 10 }}>Your feedback helps us improve.</p>
        
        {/* SMART PRO SAAS TRICK */}
       
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 30, minHeight: "100vh", backgroundColor: "#fff" }}>
      <h2 style={{ fontWeight: "800", fontSize: 24, textAlign: "center", marginBottom: 10 }}>How was your meal?</h2>
      <p style={{ textAlign: "center", color: "#6B7280", marginBottom: 30 }}>Table {tableNumber}</p>

      {/* Star Rating UI */}
      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 30 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span 
            key={star}
            onClick={() => setRating(star)}
            style={{ 
              fontSize: 40, 
              cursor: "pointer", 
              color: star <= rating ? "#F59E0B" : "#E5E7EB",
              transition: "color 0.2s"
            }}
          >
            ★
          </span>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ fontWeight: "600", display: "block", marginBottom: 8 }}>Any specific comments?</label>
        <textarea 
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell us what you loved, or what we can improve..."
          rows={4}
          style={{ width: "100%", padding: 15, borderRadius: 12, border: "1px solid #E5E7EB", resize: "none", fontFamily: "inherit" }}
        />
      </div>

      <button 
        onClick={handleSubmit}
        disabled={loading || rating === 0}
        style={{ 
          width: "100%", padding: 16, borderRadius: 12, 
          backgroundColor: rating === 0 ? "#D1D5DB" : "#10B981", 
          color: "#fff", fontWeight: "800", border: "none", fontSize: 16,
          cursor: rating === 0 ? "not-allowed" : "pointer"
        }}
      >
        {loading ? "Submitting..." : "Submit Feedback"}
      </button>
    </div>
  );
}