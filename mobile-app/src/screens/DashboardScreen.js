import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Modal,
  Alert,
  Dimensions,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import {
  getAnalytics,
  getOrders,
  getNotifications,
  updateOrderStatus,
  getSubscriptionDetails,
  markAllNotificationsRead,
  getDailySummary,
  deleteConversation,
  clearAllConversations
} from "../api";
import API from "../api";
import SubscriptionBanner from "../components/SubscriptionBanner";
import io from "socket.io-client";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const isWeb = Platform.OS === "web";

// ─── Web-only CSS ──────────────────────────────────────────────────────────────
if (isWeb && typeof document !== "undefined") {
  if (!document.getElementById("servon-font")) {
    const link = document.createElement("link");
    link.id = "servon-font";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap";
    document.head.appendChild(link);
  }
  if (!document.getElementById("servon-web-css")) {
    const style = document.createElement("style");
    style.id = "servon-web-css";
    style.textContent = `
      * { box-sizing: border-box; }
      body { font-family: 'DM Sans', sans-serif !important; background: #F5F3EF !important; }
      
      .servon-stat-card {
        background: #fff; border: 1px solid #EAE6E0; border-radius: 16px;
        padding: 20px 22px; display: flex; flex-direction: column; gap: 14px;
        transition: box-shadow 0.18s ease, transform 0.18s ease;
        position: relative; overflow: hidden;
      }
      .servon-stat-card::before {
        content: ''; position: absolute; top: 0; left: 0; right: 0;
        height: 3px; border-radius: 16px 16px 0 0;
        opacity: 0; transition: opacity 0.18s ease;
      }
      .servon-stat-card:hover { box-shadow: 0 8px 28px rgba(0,0,0,0.08); transform: translateY(-2px); }
      .servon-stat-card:hover::before { opacity: 1; }
      .servon-stat-card.accent-blue::before { background: #3B82F6; }
      .servon-stat-card.accent-green::before { background: #10B981; }
      .servon-stat-card.accent-amber::before { background: #F59E0B; }
      .servon-stat-card.accent-red::before { background: #EF4444; }
      
      .servon-stat-icon {
        width: 42px; height: 42px; border-radius: 12px;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .servon-stat-value {
        font-family: 'DM Sans', sans-serif;
        font-size: 28px; font-weight: 700; color: #111827;
        line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .servon-stat-label {
        font-size: 12px; font-weight: 500; color: #9CA3AF;
        letter-spacing: 0.04em; text-transform: uppercase; margin-top: 4px;
      }
      
      .servon-stats-grid {
        display: grid; grid-template-columns: repeat(4, 1fr);
        gap: 14px; padding: 0 24px; margin-bottom: 28px;
      }
      @media (max-width: 860px) { .servon-stats-grid { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 500px) { .servon-stats-grid { grid-template-columns: 1fr; padding: 0 16px; } }
      
      .servon-order-card {
        background: #fff; border: 1px solid #EAE6E0; border-radius: 16px;
        padding: 18px 20px; margin-bottom: 14px;
        transition: box-shadow 0.18s ease; position: relative; overflow: hidden;
      }
      .servon-order-card:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.07); }
      
      .servon-web-header {
        background: rgba(255,255,255,0.85); backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-bottom: 1px solid #EAE6E0; position: sticky; top: 0; z-index: 100;
      }
      
      .servon-notif-panel {
        position: fixed; top: 0; right: 0; bottom: 0;
        width: 380px; background: #fff; border-left: 1px solid #EAE6E0;
        z-index: 200; display: flex; flex-direction: column;
        animation: slideIn 0.22s ease;
      }
      @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      
      .servon-notif-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.25);
        z-index: 199; backdrop-filter: blur(2px); animation: fadeIn 0.2s ease;
      }
      @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
      
      .servon-empty {
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        padding: 60px 20px; border: 1.5px dashed #D1C9BC;
        border-radius: 16px; background: #FAFAF8; color: #9CA3AF; gap: 10px;
      }
      
      .servon-section-head {
        display: flex; align-items: center; gap: 10px; margin-bottom: 14px;
      }
      .servon-section-title { font-size: 17px; font-weight: 700; color: #111827; }
      .servon-count-pill {
        background: #111827; color: #fff;
        font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px;
      }
      
      .servon-live-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: #10B981; display: inline-block; margin-right: 6px;
        animation: pulse 1.8s infinite;
      }
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
        70% { box-shadow: 0 0 0 7px rgba(16,185,129,0); }
        100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
      }
      
      ::-webkit-scrollbar { width: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #D1C9BC; border-radius: 3px; }
      
      .servon-summary-overlay, .servon-insight-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center;
        z-index: 300; backdrop-filter: blur(4px); animation: fadeIn 0.25s ease;
      }
      .servon-summary-modal {
        background: #fff; border-radius: 24px; padding: 32px;
        max-width: 480px; width: 90%; max-height: 80vh; overflow-y: auto;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
        animation: slideUp 0.3s ease;
      }
      .servon-insight-modal {
        background: #fff; border-radius: 24px; padding: 20px 18px;
        max-width: 340px; width: 85%;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
        animation: slideUp 0.3s ease; text-align: center;
      }
      @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      
      .servon-insight-header, .servon-summary-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 8px;
      }
      .servon-summary-title { font-size: 22px; font-weight: 800; color: #111827; letter-spacing: -0.3px; }
      .servon-insight-title { font-size: 16px; font-weight: 700; color: #111827; }
      
      .servon-summary-text {
        font-size: 15px; color: #374151; line-height: 1.7;
        margin-bottom: 24px; background: #F9FAFB; padding: 16px;
        border-radius: 12px; border: 1px solid #F3F4F6;
      }
      .servon-insight-text {
        font-size: 17px; color: #1F2937; margin-bottom: 24px;
        line-height: 1.6; font-weight: 500;
      }
      
      .servon-summary-stats {
        display: flex; justify-content: space-around;
        border-top: 1px solid #E5E7EB; padding-top: 20px; margin-bottom: 24px;
      }
      .servon-summary-stat { text-align: center; }
      .servon-summary-stat-value { font-size: 22px; font-weight: 800; color: #111827; }
      .servon-summary-stat-label {
        font-size: 12px; color: #6B7280; margin-top: 4px;
        font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em;
      }
      
      .servon-summary-btn, .servon-insight-btn {
        background: #111827; color: #fff; border: none; border-radius: 12px;
        padding: 14px; width: 100%; font-size: 16px; font-weight: 700;
        cursor: pointer; transition: background 0.15s;
      }
      .servon-insight-btn { padding: 12px 32px; font-size: 15px; }
      .servon-summary-btn:hover, .servon-insight-btn:hover { background: #1F2937; }
      
      .servon-insight-icon-wrapper {
        width: 48px; height: 48px; border-radius: 50%;
        background: #F3F4F6; display: flex; align-items: center; justify-content: center;
        margin: 0 auto 16px;
      }
      .servon-insight-footer {
        display: flex; align-items: center; justify-content: center;
        gap: 6px; font-size: 13px; color: #9CA3AF; margin-top: 14px;
      }
    `;
    document.head.appendChild(style);
  }
}

// ─── INSIGHT ICON HELPERS ──────────────────────────────────────────────────────
const getInsightIcon = (type, native = false) => {
  const size = native ? 28 : 32;
  const icons = {
    orders: <Ionicons name="cube-outline" size={size} color="#3B82F6" />,
    revenue: <Ionicons name="wallet-outline" size={size} color="#10B981" />,
    top_item: <Ionicons name="restaurant-outline" size={size} color="#F59E0B" />,
    peak_hour: <Ionicons name="time-outline" size={size} color="#8B5CF6" />,
    avg_order: <Ionicons name="trending-up-outline" size={size} color="#EC4899" />,
    recommendation: <Ionicons name="bulb-outline" size={size} color="#F59E0B" />,
  };
  return icons[type] || icons.orders;
};

export default function DashboardScreen() {
  const { business, updateBusiness, isChefMode } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [analytics, setAnalytics] = useState(null);
  const [liveOrders, setLiveOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [dailySummary, setDailySummary] = useState(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [nextInsight, setNextInsight] = useState(null);
  const [showInsightModal, setShowInsightModal] = useState(false);
  const [seenInsights, setSeenInsights] = useState(new Set());

  const isToday = (date) => {
    const today = new Date();
    const d = new Date(date);
    return d.getDate() === today.getDate() && 
           d.getMonth() === today.getMonth() && 
           d.getFullYear() === today.getFullYear();
  };

  const fetchNextInsight = async (silent = false) => {
    try {
      const res = await API.get("/analytics/next-insight");
      const insightId = res.data.id || res.data.insight;
      
      if (!res.data.hasNext || seenInsights.has(insightId)) return;
      
      setNextInsight(res.data);
      if (!silent) setShowInsightModal(true);
    } catch (err) {
      console.error("Failed to fetch insight:", err);
    }
  };

  const handleInsightDismiss = () => {
    if (nextInsight) {
      const insightId = nextInsight.id || nextInsight.insight;
      setSeenInsights(prev => new Set([...prev, insightId]));
    }
    setShowInsightModal(false);
  };

  const loadData = async () => {
    try {
      const [analyticsRes, ordersRes, notifRes, subRes] = await Promise.all([
        getAnalytics(), getOrders(), getNotifications(), getSubscriptionDetails()
      ]);

      setAnalytics(analyticsRes.data);
      setLiveOrders(ordersRes.data.filter(o => 
        isToday(o.created_at) && !["PAID", "REJECTED"].includes(o.status)
      ));
      setNotifications(notifRes.data);

      if (subRes.data?.subscription_status) {
        updateBusiness({
          subscription_status: subRes.data.subscription_status,
          subscription_end_date: subRes.data.subscription_end_date
        });
        checkAndShowWarning(subRes.data.subscription_end_date);
      }

      // Fetch summary and insight silently
      try {
        const summaryRes = await getDailySummary();
        if (summaryRes.data.hasSummary && summaryRes.data.is_new) {
          setDailySummary(summaryRes.data);
          setShowSummaryModal(true);
        }
      } catch (err) { console.error('Summary fetch error:', err); }

      await fetchNextInsight(true);

    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const checkAndShowWarning = (endDateStr) => {
    try {
      const endDate = new Date(endDateStr || business?.subscription_end_date);
      const daysLeft = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 3 && daysLeft > 0) {
        const msg = daysLeft < 0 ? "Your Servon plan has expired!" : `Your Servon plan expires in ${daysLeft} days.`;
        if (Platform.OS === "web") {
          window.alert(`${msg} Please renew soon!`);
        } else {
          Alert.alert("Subscription Reminder", msg, [
            { text: "Got it", style: "cancel" },
            { text: "Renew Now", onPress: () => navigation.navigate("Profile") }
          ]);
        }
      }
    } catch (err) { console.log("Warning popup error:", err); }
  };

  const handleStatusUpdate = async (orderId, status) => {
    try {
      await updateOrderStatus(orderId, status);
      if (["SERVED", "REJECTED"].includes(status)) {
        setLiveOrders(prev => prev.filter(o => o.id !== orderId));
      } else {
        setLiveOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      }
    } catch (err) {
      console.error("Status update error:", err);
    }
  };

  const handleOpenNotifications = async () => {
    setShowNotifications(true);
    if (unreadCount > 0) {
      try {
        await markAllNotificationsRead();
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      } catch (err) {
        console.error("Failed to mark notifications as read", err);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
      const socket = io(process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000", {
        transports: ["websocket"],
      });
      socket.on("connect", () => business?.id && socket.emit("join_business", business.id));
      socket.on("new_order", ({ order, notification, tableNumber }) => {
        if (isToday(order.created_at)) setLiveOrders(prev => [{ ...order, table_number: tableNumber }, ...prev]);
        setNotifications(prev => [notification, ...prev]);
      });
      socket.on("order_updated", (updatedOrder) => {
        setLiveOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
      });
      return () => socket.disconnect();
    }, [business?.id])
  );

  // ─── HOURLY INSIGHT TIMER ──────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    const interval = setInterval(() => {
      if (!showInsightModal) fetchNextInsight(false);
    }, 3600000); // 10 sec for testing, change to 3600000 for production
    return () => clearInterval(interval);
  }, [loading, showInsightModal]);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const ownerInitial = business?.owner_name ? business.owner_name.charAt(0).toUpperCase() : "S";
  const activeTableCount = new Set(liveOrders.map(o => o.table_number)).size;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111" />
      </View>
    );
  }

  // ─── WEB RENDER ─────────────────────────────────────────────────────────────
  if (isWeb) {
    const todayStr = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

    return (
      <div style={{ minHeight: "100vh", background: "#F5F3EF", fontFamily: "'DM Sans', sans-serif", overflowY: "auto" }}>
        {/* HEADER */}
        <div className="servon-web-header">
          <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 28px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#111827", letterSpacing: "-0.5px" }}>
              Servon<span style={{ color: "#22C55E" }}>.</span>
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={handleOpenNotifications} style={{
                position: "relative", background: unreadCount > 0 ? "#F0FDF4" : "#F9F8F6",
                border: `1px solid ${unreadCount > 0 ? "#BBF7D0" : "#EAE6E0"}`,
                borderRadius: 10, width: 38, height: 38,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer"
              }}>
                <Ionicons name="notifications-outline" size={18} color={unreadCount > 0 ? "#16A34A" : "#374151"} />
                {unreadCount > 0 && (
                  <span style={{
                    position: "absolute", top: -4, right: -4,
                    background: "#EF4444", color: "#fff",
                    fontSize: 9, fontWeight: 700,
                    width: 16, height: 16, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: "2px solid #F5F3EF"
                  }}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              <button onClick={() => navigation.navigate("Profile")} style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "#111827", color: "#fff",
                fontSize: 14, fontWeight: 600,
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {ownerInitial}
              </button>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "32px 28px 60px" }}>
          <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#111827", letterSpacing: "-0.4px" }}>
                Good {getGreeting()}, {business?.owner_name?.split(" ")[0] || "there"} 👋
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9CA3AF" }}>{todayStr}</p>
            </div>
            <button onClick={() => { setRefreshing(true); loadData(); }} style={{
              background: "#fff", border: "1px solid #EAE6E0", borderRadius: 10,
              padding: "8px 16px", fontSize: 13, fontWeight: 500, color: "#374151",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6
            }}>
              <Ionicons name="refresh-outline" size={14} color="#374151" />
              Refresh
            </button>
          </div>

          <SubscriptionBanner />

          <div className="servon-stats-grid" style={{ marginTop: 10 }}>
            <WebStatCard label="Orders Today" value={analytics?.today?.totalOrders ?? 0} icon="cube" color="#3B82F6" bg="#EFF6FF" accent="blue" />
            {!isChefMode && <WebStatCard label="Revenue Today" value={`₹${(analytics?.today?.totalRevenue ?? 0).toFixed(0)}`} icon="wallet" color="#10B981" bg="#ECFDF5" accent="green" />}
            <WebStatCard label="Active Tables" value={activeTableCount} icon="grid" color="#F59E0B" bg="#FFFBEB" accent="amber" />
            <WebStatCard label="Top Item" value={analytics?.today?.mostOrderedItem?.name || "-"} icon="flame" color="#EF4444" bg="#FEF2F2" accent="red" isText />
          </div>

          <TouchableOpacity style={styles.advisorBtn} onPress={() => navigation.navigate("Advisor")}>
            <Ionicons name="sparkles-outline" size={20} color="#fff" />
            <Text style={styles.advisorBtnText}>AI Business Advisor</Text>
          </TouchableOpacity>

          <div style={{ marginTop: 8 }}>
            <div className="servon-section-head">
              <span className="servon-live-dot" />
              <span className="servon-section-title">Live Orders</span>
              <span className="servon-count-pill">{liveOrders.length}</span>
            </div>

            {liveOrders.length === 0 ? (
              <div className="servon-empty">
                <Ionicons name="restaurant-outline" size={36} color="#C4BAB0" />
                <span style={{ fontSize: 15, fontWeight: 600, color: "#6B7280" }}>No active orders right now</span>
                <span style={{ fontSize: 13, color: "#B3ACA4" }}>Waiting for customers to scan QR</span>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: screenWidth > 900 ? "repeat(2, 1fr)" : "1fr", gap: 14 }}>
                {liveOrders.map(order => <WebOrderCard key={order.id} order={order} onStatusUpdate={handleStatusUpdate} />)}
              </div>
            )}
          </div>
        </div>

        {/* NOTIFICATION PANEL */}
        {showNotifications && (
          <>
            <div className="servon-notif-overlay" onClick={() => setShowNotifications(false)} />
            <div className="servon-notif-panel">
              <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #EAE6E0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#111827" }}>Notifications</p>
                  {unreadCount > 0 && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9CA3AF" }}>{unreadCount} unread</p>}
                </div>
                <button onClick={() => setShowNotifications(false)} style={{
                  background: "#F3F4F6", border: "none", borderRadius: 8,
                  width: 32, height: 32, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <Ionicons name="close" size={16} color="#374151" />
                </button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 24px" }}>
                {notifications.length === 0 ? (
                  <div style={{ textAlign: "center", marginTop: 60, color: "#9CA3AF", fontSize: 14 }}>No notifications yet.</div>
                ) : (
                  notifications.map((n, index) => (
                    <div key={n.id || index} style={{
                      padding: "14px 16px", borderRadius: 12,
                      background: n.is_read ? "#FAFAF8" : "#F0FDF4",
                      border: `1px solid ${n.is_read ? "#EAE6E0" : "#BBF7D0"}`,
                      marginBottom: 10,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>
                          {!n.is_read && <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#22C55E", marginRight: 6, verticalAlign: "middle" }} />}
                          {n.title || "New Order"}
                        </p>
                        <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>
                          {new Date(n.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: "#4B5563", lineHeight: 1.5 }}>{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {/* SUMMARY MODAL */}
        {showSummaryModal && dailySummary && (
          <div className="servon-summary-overlay" onClick={() => setShowSummaryModal(false)}>
            <div className="servon-summary-modal" onClick={e => e.stopPropagation()}>
              <div className="servon-summary-header">
                <span className="servon-summary-title">Daily Summary</span>
                <button onClick={() => setShowSummaryModal(false)} className="servon-summary-close" style={{
                  background: "none", border: "none", fontSize: 20, color: "#6B7280", cursor: "pointer"
                }}>✕</button>
              </div>
              <div className="servon-summary-date" style={{ fontSize: 14, color: "#6B7280", marginBottom: 16, fontWeight: 500 }}>{dailySummary.summary_date}</div>
              <div className="servon-summary-text">{dailySummary.summary_text}</div>
              <div className="servon-summary-stats">
                <div className="servon-summary-stat">
                  <div className="servon-summary-stat-value">{dailySummary.total_orders}</div>
                  <div className="servon-summary-stat-label">Orders</div>
                </div>
                <div className="servon-summary-stat">
                  <div className="servon-summary-stat-value">₹{dailySummary.total_revenue}</div>
                  <div className="servon-summary-stat-label">Revenue</div>
                </div>
                <div className="servon-summary-stat">
                  <div className="servon-summary-stat-value">₹{dailySummary.avg_order_value}</div>
                  <div className="servon-summary-stat-label">Avg Order</div>
                </div>
              </div>
              <button className="servon-summary-btn" onClick={() => setShowSummaryModal(false)}>Got it!</button>
            </div>
          </div>
        )}

        {/* INSIGHT MODAL */}
        {showInsightModal && nextInsight && (
          <div className="servon-insight-overlay" onClick={handleInsightDismiss}>
            <div className="servon-insight-modal" onClick={e => e.stopPropagation()}>
              <div className="servon-insight-header">
                <div className="servon-insight-title-row" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Ionicons name="bulb-outline" size={24} color="#111827" />
                  <span className="servon-insight-title">Insight {nextInsight.order} of 6</span>
                </div>
                <button onClick={handleInsightDismiss} style={{
                  background: "none", border: "none", fontSize: 20, color: "#6B7280", cursor: "pointer"
                }}>✕</button>
              </div>
              <div className="servon-insight-icon-wrapper">{getInsightIcon(nextInsight.type)}</div>
              <div className="servon-insight-text">{nextInsight.insight}</div>
              <button className="servon-insight-btn" onClick={handleInsightDismiss}>Got it!</button>
              <div className="servon-insight-footer">
                <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                <span>Next insight in ~1 hour</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── NATIVE RENDER ──────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + 15 }]}>
        <View style={styles.headerInner}>
          <Text style={styles.brandText}>Servon<Text style={styles.brandAccent}>.</Text></Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={handleOpenNotifications}>
              <Ionicons name="notifications-outline" size={24} color="#374151" />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileAvatar} onPress={() => navigation.navigate("Profile")}>
              <Text style={styles.profileAvatarText}>{ownerInitial}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        <View style={styles.responsiveContent}>
          <SubscriptionBanner />

          <View style={[styles.statsGrid, isWeb && screenWidth < 600 && styles.statsGridSmall]}>
            <StatCard label="Orders Today" value={analytics?.today?.totalOrders ?? 0} icon="cube" color="#3B82F6" bg="#EFF6FF" />
            {!isChefMode && <StatCard label="Revenue Today" value={`₹${(analytics?.today?.totalRevenue ?? 0).toFixed(0)}`} icon="wallet" color="#10B981" bg="#ECFDF5" />}
            <StatCard label="Active Tables" value={activeTableCount} icon="grid" color="#F59E0B" bg="#FFFBEB" />
            <StatCard label="Top Item" value={analytics?.today?.mostOrderedItem?.name || "-"} icon="flame" color="#EF4444" bg="#FEF2F2" isText />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Live Orders</Text>
              <View style={styles.countBadge}><Text style={styles.countBadgeText}>{liveOrders.length}</Text></View>
            </View>

            {liveOrders.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconCircle}><Ionicons name="restaurant-outline" size={32} color="#9CA3AF" /></View>
                <Text style={styles.emptyText}>No active orders right now</Text>
                <Text style={styles.emptySubText}>Waiting for customers to scan QR</Text>
              </View>
            ) : (
              liveOrders.map(order => <OrderCard key={order.id} order={order} onStatusUpdate={handleStatusUpdate} />)
            )}
          </View>
        </View>
      </ScrollView>

      {/* NOTIFICATIONS MODAL */}
      <Modal visible={showNotifications} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderTop}>
              <Text style={styles.modalTitleText}>Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotifications(false)}>
                <Ionicons name="close-circle" size={28} color="#D1D5DB" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.notifList}>
              {notifications.length === 0 ? (
                <Text style={styles.emptyNotif}>No notifications yet.</Text>
              ) : (
                notifications.map((n, index) => (
                  <View key={n.id || index} style={[styles.notifItem, !n.is_read && styles.notifItemUnread]}>
                    <Text style={styles.notifTitle}>{n.title || "New Order"}</Text>
                    <Text style={styles.notifMessage}>{n.message}</Text>
                    <Text style={styles.notifTime}>
                      {new Date(n.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* SUMMARY MODAL */}
      <Modal visible={showSummaryModal} transparent animationType="fade" onRequestClose={() => setShowSummaryModal(false)}>
        <View style={styles.summaryModalOverlay}>
          <View style={styles.summaryModal}>
            <View style={styles.summaryModalHeader}>
              <Text style={styles.summaryModalTitle}>Daily Summary</Text>
              <TouchableOpacity onPress={() => setShowSummaryModal(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.summaryModalDate}>{dailySummary?.summary_date}</Text>
            <View style={styles.summaryModalTextContainer}>
              <Text style={styles.summaryModalText}>{dailySummary?.summary_text}</Text>
            </View>
            <View style={styles.summaryModalStats}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatValue}>{dailySummary?.total_orders}</Text>
                <Text style={styles.summaryStatLabel}>Orders</Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatValue}>₹{dailySummary?.total_revenue}</Text>
                <Text style={styles.summaryStatLabel}>Revenue</Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatValue}>₹{dailySummary?.avg_order_value}</Text>
                <Text style={styles.summaryStatLabel}>Avg Order</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.summaryModalBtn} onPress={() => setShowSummaryModal(false)}>
              <Text style={styles.summaryModalBtnText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* INSIGHT MODAL */}
      <Modal visible={showInsightModal} transparent animationType="fade" onRequestClose={handleInsightDismiss}>
        <View style={styles.insightModalOverlay}>
          <View style={styles.insightModal}>
            <View style={styles.insightModalHeader}>
              <View style={styles.insightModalTitleRow}>
                <Ionicons name="bulb-outline" size={22} color="#111827" />
                <Text style={styles.insightModalTitle}>Insight {nextInsight?.order} of 6</Text>
              </View>
              <TouchableOpacity onPress={handleInsightDismiss} hitSlop={10}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.insightModalIconWrapper}>
              {getInsightIcon(nextInsight?.type, true)}
            </View>
            <Text style={styles.insightModalText}>{nextInsight?.insight}</Text>
            <TouchableOpacity style={styles.insightModalBtn} onPress={handleInsightDismiss}>
              <Text style={styles.insightModalBtnText}>Got it!</Text>
            </TouchableOpacity>
            <View style={styles.insightModalFooter}>
              <Ionicons name="time-outline" size={14} color="#9CA3AF" />
              <Text style={styles.insightModalFooterText}>Next insight in ~1 hour</Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

function WebStatCard({ label, value, icon, color, bg, accent, isText }) {
  return (
    <div className={`servon-stat-card accent-${accent}`}>
      <div className="servon-stat-icon" style={{ background: bg }}>
        <Ionicons name={icon} size={18} color={color} />
      </div>
      <div>
        <div className="servon-stat-value" style={isText ? { fontSize: 18, fontWeight: 600 } : {}} title={String(value)}>
          {value}
        </div>
        <div className="servon-stat-label">{label}</div>
      </div>
    </div>
  );
}

function WebOrderCard({ order, onStatusUpdate }) {
  const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || "[]");
  const color = statusColor(order.status);
  const elapsed = Math.floor((Date.now() - new Date(order.created_at)) / 60000);

  return (
    <div className="servon-order-card">
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: color, borderRadius: "16px 0 0 16px" }} />
      <div style={{ paddingLeft: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ background: "#F3F4F6", borderRadius: 8, padding: "4px 10px", fontSize: 13, fontWeight: 600, color: "#374151" }}>
              Table {order.table_number || "?"}
            </span>
            <span style={{ background: `${color}18`, color, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
              {order.status}
            </span>
          </div>
          <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>
            {elapsed < 1 ? "Just now" : `${elapsed}m ago`}
          </span>
        </div>
        <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 10, marginBottom: 10 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ background: "#F3F4F6", borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 700, color: "#374151" }}>
                {item.quantity}×
              </span>
              <span style={{ fontSize: 13, color: "#1F2937", fontWeight: 500 }}>{item.name}</span>
            </div>
          ))}
        </div>
        {order.special_instructions && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 6, background: "#FFFBEB", borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
            <Ionicons name="information-circle" size={14} color="#F59E0B" style={{ marginTop: 1 }} />
            <span style={{ fontSize: 12, color: "#92400E", lineHeight: 1.5 }}>{order.special_instructions}</span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #F3F4F6", paddingTop: 10 }}>
          <div>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>Total </span>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#111827" }}>₹{order.total_amount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, bg, isText, extraStyle }) {
  return (
    <View style={[styles.statCard, extraStyle]}>
      <View style={[styles.iconContainer, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View>
        <Text style={[styles.statValue, isText && { fontSize: 17, fontWeight: "600" }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

function OrderCard({ order, onStatusUpdate }) {
  const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || "[]");

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.tableIndicator}>
          <Text style={styles.orderTable}>Table {order.table_number || "?"}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: `${statusColor(order.status)}15` }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor(order.status) }]} />
          <Text style={[styles.statusText, { color: statusColor(order.status) }]}>{order.status}</Text>
        </View>
      </View>
      <View style={styles.divider} />
      {items.map((item, i) => (
        <View key={i} style={styles.orderItemRow}>
          <View style={styles.qtyBadge}><Text style={styles.qtyText}>{item.quantity}x</Text></View>
          <Text style={styles.orderItemName}>{item.name}</Text>
        </View>
      ))}
      {order.special_instructions && (
        <View style={styles.noteBox}>
          <Ionicons name="information-circle" size={16} color="#F59E0B" />
          <Text style={styles.orderNote}>{order.special_instructions}</Text>
        </View>
      )}
      <View style={styles.divider} />
      <View style={styles.orderFooter}>
        <Text style={styles.orderTotalLabel}>Total Amount</Text>
        <Text style={styles.orderTotalValue}>₹{order.total_amount}</Text>
      </View>
    </View>
  );
}

const statusColor = (s) => ({
  EDITABLE: "#6B7280",
  CONFIRMED: "#3B82F6",
  PREPARING: "#F59E0B",
  SERVED: "#10B981",
  REJECTED: "#EF4444",
}[s] || "#6B7280");

// ─── STYLES ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3EF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottomWidth: 1,
    borderBottomColor: '#EAE6E0',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandText: { fontSize: 20, fontWeight: '700', color: '#111827', letterSpacing: -0.5 },
  brandAccent: { color: '#22C55E' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { padding: 8, position: 'relative' },
  badge: {
    position: 'absolute', top: 2, right: 2,
    backgroundColor: '#EF4444', borderRadius: 10,
    minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700', paddingHorizontal: 4 },
  profileAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  responsiveContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, maxWidth: 600, alignSelf: 'center', width: '100%' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16, marginBottom: 24 },
  statsGridSmall: { gap: 8 },
  statCard: {
    flex: 1,
    minWidth: Platform.OS === 'web' ? 'calc(50% - 5px)' : '45%',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#EAE6E0',
    borderRadius: 14, padding: 14, flexDirection: 'row',
    alignItems: 'center', gap: 12,
  },
  iconContainer: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 11, fontWeight: '500', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },
  section: { marginTop: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  countBadge: { backgroundColor: '#111827', borderRadius: 16, paddingHorizontal: 8, paddingVertical: 2 },
  countBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  emptyCard: {
    backgroundColor: '#FAFAF8', borderWidth: 1.5, borderColor: '#D1C9BC',
    borderStyle: 'dashed', borderRadius: 16, padding: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  emptySubText: { fontSize: 13, color: '#B3ACA4', marginTop: 4 },
  orderCard: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#EAE6E0',
    borderRadius: 16, padding: 16, marginBottom: 14,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  tableIndicator: { backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  orderTable: { fontSize: 13, fontWeight: '600', color: '#374151' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 10 },
  orderItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  qtyBadge: { backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  qtyText: { fontSize: 11, fontWeight: '700', color: '#374151' },
  orderItemName: { fontSize: 13, fontWeight: '500', color: '#1F2937' },
  noteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#FFFBEB', borderRadius: 8, padding: 8, marginTop: 4 },
  orderNote: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderTotalLabel: { fontSize: 12, color: '#9CA3AF' },
  orderTotalValue: { fontSize: 17, fontWeight: '800', color: '#111827' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 20, paddingHorizontal: 20, maxHeight: '80%',
  },
  modalHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitleText: { fontSize: 18, fontWeight: '700', color: '#111827' },
  notifList: { paddingBottom: 24 },
  emptyNotif: { textAlign: 'center', color: '#9CA3AF', marginTop: 40, fontSize: 14 },
  notifItem: {
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: '#FAFAF8', borderRadius: 12,
    borderWidth: 1, borderColor: '#EAE6E0',
    marginBottom: 10,
  },
  notifItemUnread: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  notifTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  notifMessage: { fontSize: 13, color: '#4B5563', marginBottom: 4 },
  notifTime: { fontSize: 11, color: '#9CA3AF' },
  summaryModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  summaryModal: { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '100%', maxWidth: 400 },
  summaryModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  summaryModalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  summaryModalDate: { fontSize: 14, color: '#6B7280', marginBottom: 16 },
  summaryModalTextContainer: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#F3F4F6', marginBottom: 20 },
  summaryModalText: { fontSize: 15, color: '#374151', lineHeight: 24 },
  summaryModalStats: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 16, marginBottom: 20 },
  summaryStat: { alignItems: 'center' },
  summaryStatValue: { fontSize: 20, fontWeight: '800', color: '#111827' },
  summaryStatLabel: { fontSize: 11, color: '#6B7280', marginTop: 4, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.4 },
  summaryModalBtn: { backgroundColor: '#111827', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  summaryModalBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  insightModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  insightModal: { backgroundColor: '#fff', borderRadius: 20, padding: 18, width: '85%', maxWidth: 340, alignItems: 'center' },
  insightModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: 16 },
  insightModalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  insightModalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  insightModalIconWrapper: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  insightModalText: { fontSize: 15, color: '#1F2937', textAlign: 'center', lineHeight: 26, marginBottom: 24, fontWeight: '500' },
  insightModalBtn: { backgroundColor: '#111827', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 12, width: '100%', alignItems: 'center' },
  insightModalBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  insightModalFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  insightModalFooterText: { fontSize: 13, color: '#9CA3AF' },
  advisorBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, gap: 8, marginTop: 12, alignSelf: 'center' },
  advisorBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});