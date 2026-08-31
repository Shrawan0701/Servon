import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getBusinessProfile, placeOrder, servonVoicePublic } from "../api";
import { useLocale } from "../context/LocaleContext";

// Voice Order Modal — mini-cart + checkout for the voice order path.
// Detected items are reviewed/adjusted HERE, never on the Cart page.
// Confirmation reuses the EXISTING customer QR order flow (/orders/place).
export default function VoiceOrderModal({ open, onClose, businessId, tableId, menuItems }) {
  const { t } = useLocale();
  const navigate = useNavigate();

  const [stage, setStage] = useState("idle"); // idle | listening | thinking | review
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [cart, setCart] = useState([]);
  const [ambiguities, setAmbiguities] = useState([]);
  const [unavailableNames, setUnavailableNames] = useState([]);
  const [transcript, setTranscript] = useState("");
  const [placing, setPlacing] = useState(false);

  const streamRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const menuItemsRef = useRef(menuItems);
  menuItemsRef.current = menuItems || [];

  useEffect(() => {
    if (!open) return;
    setStage("idle");
    setError("");
    setCart([]);
    setAmbiguities([]);
    setUnavailableNames([]);
    setTranscript("");
    setPlacing(false);
    if (businessId) {
      getBusinessProfile(businessId)
        .then((res) => setProfile(res.data))
        .catch(() => {});
    }
  }, [open, businessId]);

  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
      try {
        if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
      } catch {}
      try {
        if (streamRef.current) streamRef.current.getTracks().forEach((tr) => tr.stop());
      } catch {}
    },
    []
  );

  const stopRecording = useCallback(() => {
    clearTimeout(timerRef.current);
    try {
      const rec = recRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
    } catch {}
  }, []);

  const cancelRecording = useCallback(() => {
    clearTimeout(timerRef.current);
    try {
      const rec = recRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
    } catch {}
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach((tr) => tr.stop());
    } catch {}
    streamRef.current = null;
    recRef.current = null;
    setStage("idle");
  }, []);

  // Process the AI result into the mini-cart
  const applyIntent = useCallback(
    (intent) => {
      if (!intent || intent.type !== "CREATE_ORDER") {
        setError(t("notFound"));
        setStage("review");
        return;
      }
      const freshUnavailable = [];
      const missing = [];
      setCart((prev) => {
        const next = prev.map((i) => ({ ...i }));
        (intent.items || []).forEach((it) => {
          const full =
            menuItemsRef.current.find((m) => String(m.id) === String(it.menuItem && it.menuItem.id)) ||
            it.menuItem ||
            {};
          if (!full.is_available) {
            freshUnavailable.push(full.name || it.requestedName);
            return;
          }
          const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
          const existing = next.find((i) => String(i.id) === String(full.id));
          if (existing) {
            existing.quantity += qty;
          } else {
            next.push({
              id: full.id,
              name: full.name,
              price: parseFloat(full.price) || 0,
              image_url: full.image_url,
              quantity: qty,
            });
          }
        });
        return next;
      });
      (intent.ambiguities || []).forEach((a) => {
        if (a.options && a.options.length > 0) setAmbiguities((prev) => [...prev, a]);
        else missing.push(a.requestedName);
      });
      setUnavailableNames(freshUnavailable);
      if (missing.length > 0) setError(`${missing.join(", ")} — ${t("notFound")}`);
      setStage("review");
    },
    [t]
  );

  // Start listening: record audio, send to the existing voice/AI pipeline
  const startRecording = useCallback(async () => {
    setError("");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === "undefined") {
      setError(t("micUnsupported"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      recRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
        recRef.current = null;
        setStage("thinking");
        try {
          const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
          const fd = new FormData();
          fd.append("businessId", businessId);
          fd.append("audio", blob, "servon-customer-voice.webm");
          const res = await servonVoicePublic(fd);
          const payload = res.data || {};
          setTranscript(payload.transcript || "");
          if (!payload.success || !payload.intent) {
            setError(payload.error || t("notFound"));
            setStage("review");
            return;
          }
          applyIntent(payload.intent);
        } catch (err) {
          setError((err.response && err.response.data && err.response.data.error) || t("orderFailed"));
          setStage("review");
        }
      };
      rec.start();
      setStage("listening");
      timerRef.current = setTimeout(() => stopRecording(), 8000);
    } catch {
      setError(t("micUnsupported"));
      setStage("idle");
    }
  }, [businessId, stopRecording, t, applyIntent]);

  // Mini-cart mutations
  const inc = (id) =>
    setCart((prev) => prev.map((i) => (String(i.id) === String(id) ? { ...i, quantity: i.quantity + 1 } : i)));
  const dec = (id) =>
    setCart((prev) =>
      prev
        .map((i) => (String(i.id) === String(id) ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0)
    );
  const removeItem = (id) => setCart((prev) => prev.filter((i) => String(i.id) !== String(id)));
  const pickAmbiguity = (requestedName, option) => {
    if (!option.is_available) return;
    setCart((prev) => {
      const existing = prev.find((i) => String(i.id) === String(option.id));
      if (existing) {
        return prev.map((i) => (String(i.id) === String(option.id) ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          id: option.id,
          name: option.name,
          price: parseFloat(option.price) || 0,
          image_url: option.image_url,
          quantity: 1,
        },
      ];
    });
    setAmbiguities((prev) => prev.filter((a) => a.requestedName !== requestedName));
  };

  // Amounts — same tax rules as the existing CartPage / QR ordering flow
  const subtotal = useMemo(() => cart.reduce((sum, i) => sum + i.price * i.quantity, 0), [cart]);
  const { cgstPercent, sgstPercent, cgstAmount, sgstAmount, grandTotal } = useMemo(() => {
    const cP = parseFloat(profile && profile.cgst_percentage) || 0;
    const sP = parseFloat(profile && profile.sgst_percentage) || 0;
    const cgst = (subtotal * cP) / 100;
    const sgst = (subtotal * sP) / 100;
    return {
      cgstPercent: cP,
      sgstPercent: sP,
      cgstAmount: cgst,
      sgstAmount: sgst,
      grandTotal: subtotal + cgst + sgst,
    };
  }, [subtotal, profile]);

  // Confirm — reuses the EXISTING /orders/place QR order API (no new backend flow)
  const handleConfirm = async () => {
    if (cart.length === 0) return;
    setPlacing(true);
    setError("");
    try {
      const orderItems = cart.map((i) => ({
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
      const res = await placeOrder({
        businessId,
        tableId,
        items: orderItems,
        totalAmount: subtotal, // backend computes final total (GST/discount)
        specialInstructions: "",
        orderId: activeOrderId,
      });
      sessionStorage.setItem("activeOrderId", res.data.id);
      onClose();
      navigate(`/order-success/${res.data.id}`, { state: { businessId, tableId } });
    } catch (err) {
      setError((err.response && err.response.data && err.response.data.error) || t("orderFailed"));
    } finally {
      setPlacing(false);
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={() => stage !== "listening" && stage !== "thinking" && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 10000,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          width: "100%",
          maxWidth: 440,
          maxHeight: "92vh",
          overflowY: "auto",
          borderRadius: "20px 20px 0 0",
          padding: "18px 18px 24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>🎤 {t("voiceOrder")}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>
            ✕
          </button>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", color: "#b91c1c", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}
        {unavailableNames.length > 0 && (
          <div style={{ background: "#fffbeb", color: "#92400e", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>
            {t("unavailableNote")}
          </div>
        )}

        {stage === "idle" && (
          <div style={{ textAlign: "center", padding: "18px 6px 8px" }}>
            <div style={{ fontSize: 42, marginBottom: 10 }}>🎙️</div>
            <div style={{ color: "#555", fontSize: 14, marginBottom: 16 }}>{t("tapMic")}</div>
            <button
              onClick={startRecording}
              style={{ width: 72, height: 72, borderRadius: "50%", border: "none", background: "#111", color: "#fff", fontSize: 28, cursor: "pointer" }}
            >
              🎤
            </button>
          </div>
        )}

        {stage === "listening" && (
          <div style={{ textAlign: "center", padding: "24px 6px" }}>
            <div style={{ fontSize: 42, marginBottom: 10 }}>🎙️</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{t("listening")}</div>
            <button
              onClick={cancelRecording}
              style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", fontSize: 13, cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        )}

        {stage === "thinking" && (
          <div style={{ textAlign: "center", padding: "24px 6px" }}>
            <div style={{ fontSize: 42, marginBottom: 10 }}>🤔</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{t("understanding")}</div>
            {transcript && <div style={{ color: "#666", fontSize: 13, fontStyle: "italic" }}>“{transcript}”</div>}
          </div>
        )}

        {stage === "review" && (
          <div>
            {ambiguities.map((amb) => (
              <div key={amb.requestedName} style={{ background: "#f8f9fa", borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                  “{amb.requestedName}” — {t("pickOne")}
                </div>
                {amb.options.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => pickAmbiguity(amb.requestedName, opt)}
                    style={{ display: "block", width: "100%", textAlign: "left", background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: "8px 10px", marginBottom: 6, fontSize: 13, cursor: "pointer" }}
                  >
                    {opt.name} · ₹{parseFloat(opt.price) || 0}
                  </button>
                ))}
              </div>
            ))}

            {cart.length === 0 ? (
              <div style={{ textAlign: "center", color: "#666", padding: 14, fontSize: 14 }}>{t("cartEmpty")}</div>
            ) : (
              <div>
                {cart.map((item) => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f0f0f0" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                        <button className="qty-btn" onClick={() => dec(item.id)}>–</button>
                        <span style={{ fontWeight: 700, minWidth: 18, textAlign: "center" }}>{item.quantity}</span>
                        <button className="qty-btn" onClick={() => inc(item.id)}>+</button>
                        <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", color: "#c00", fontSize: 12, marginLeft: 8, cursor: "pointer" }}>
                          {t("removeItem")}
                        </button>
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, minWidth: 60, textAlign: "right" }}>
                      ₹{(item.price * item.quantity).toFixed(0)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ background: "#f8f9fa", borderRadius: 10, padding: "12px 14px", marginTop: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>{t("billSummary")}</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span>{t("subtotal")}</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {cgstAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
                  <span>CGST ({cgstPercent}%)</span>
                  <span>₹{cgstAmount.toFixed(2)}</span>
                </div>
              )}
              {sgstAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
                  <span>SGST ({sgstPercent}%)</span>
                  <span>₹{sgstAmount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 16, borderTop: "1px solid #ddd", marginTop: 8, paddingTop: 8 }}>
                <span>{t("grandTotal")}</span>
                <span>₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={startRecording}
              style={{ width: "100%", marginTop: 14, padding: "12px", background: "#fff", border: "1.5px solid #111", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer" }}
            >
              🎤 {t("speakAgain")}
            </button>

            <button
              onClick={handleConfirm}
              disabled={placing || cart.length === 0}
              style={{ width: "100%", marginTop: 10, padding: "14px", background: "#111", color: "#fff", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 800, cursor: cart.length === 0 ? "not-allowed" : "pointer", opacity: placing || cart.length === 0 ? 0.6 : 1 }}
            >
              {placing ? t("placingOrder") : t("confirmOrder", { total: grandTotal.toFixed(0) })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
