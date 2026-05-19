import { useState, useCallback, useEffect } from "react";
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
  useWindowDimensions
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
} from "../api";
import SubscriptionBanner from "../components/SubscriptionBanner";
import io from "socket.io-client";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const isWeb = Platform.OS === "web";

// ─── Web-only: inject Google Font + global CSS ───────────────────────────────
if (isWeb && typeof document !== "undefined") {
  if (!document.getElementById("servon-font")) {
    const link = document.createElement("link");
    link.id = "servon-font";
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap";
    document.head.appendChild(link);
  }
  if (!document.getElementById("servon-web-css")) {
    const style = document.createElement("style");
    style.id = "servon-web-css";
    style.textContent = `
      * { box-sizing: border-box; }
      body { font-family: 'DM Sans', sans-serif !important; background: #F5F3EF !important; }

      /* ── Stat cards ── */
      .servon-stat-card {
        background: #fff;
        border: 1px solid #EAE6E0;
        border-radius: 16px;
        padding: 20px 22px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        transition: box-shadow 0.18s ease, transform 0.18s ease;
        min-width: 0;
        position: relative;
        overflow: hidden;
      }
      .servon-stat-card::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 3px;
        border-radius: 16px 16px 0 0;
        opacity: 0;
        transition: opacity 0.18s ease;
      }
      .servon-stat-card:hover {
        box-shadow: 0 8px 28px rgba(0,0,0,0.08);
        transform: translateY(-2px);
      }
      .servon-stat-card:hover::before { opacity: 1; }
      .servon-stat-card.accent-blue::before  { background: #3B82F6; }
      .servon-stat-card.accent-green::before { background: #10B981; }
      .servon-stat-card.accent-amber::before { background: #F59E0B; }
      .servon-stat-card.accent-red::before   { background: #EF4444; }

      .servon-stat-icon {
        width: 42px; height: 42px;
        border-radius: 12px;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .servon-stat-value {
        font-family: 'DM Sans', sans-serif;
        font-size: 28px;
        font-weight: 700;
        color: #111827;
        line-height: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .servon-stat-label {
        font-size: 12px;
        font-weight: 500;
        color: #9CA3AF;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        margin-top: 4px;
      }

      /* ── Stats grid ── */
      .servon-stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
        padding: 0 24px;
        margin-bottom: 28px;
      }
      @media (max-width: 860px) {
        .servon-stats-grid { grid-template-columns: repeat(2, 1fr); }
      }
      @media (max-width: 500px) {
        .servon-stats-grid { grid-template-columns: 1fr; padding: 0 16px; }
      }

      /* ── Order cards ── */
      .servon-order-card {
        background: #fff;
        border: 1px solid #EAE6E0;
        border-radius: 16px;
        padding: 18px 20px;
        margin-bottom: 14px;
        transition: box-shadow 0.18s ease;
        position: relative;
        overflow: hidden;
      }
      .servon-order-card:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.07); }

      /* ── Status action buttons ── */
      .servon-action-btn {
        border: none; outline: none; cursor: pointer;
        font-family: 'DM Sans', sans-serif;
        font-size: 12px; font-weight: 600;
        padding: 7px 14px;
        border-radius: 8px;
        transition: opacity 0.14s, transform 0.14s;
      }
      .servon-action-btn:hover { opacity: 0.85; transform: scale(0.97); }

      /* ── Header ── */
      .servon-web-header {
        background: rgba(255,255,255,0.85);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-bottom: 1px solid #EAE6E0;
        position: sticky; top: 0; z-index: 100;
      }

      /* ── Notification panel ── */
      .servon-notif-panel {
        position: fixed;
        top: 0; right: 0; bottom: 0;
        width: 380px;
        background: #fff;
        border-left: 1px solid #EAE6E0;
        z-index: 200;
        display: flex; flex-direction: column;
        animation: slideIn 0.22s ease;
      }
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to   { transform: translateX(0);   opacity: 1; }
      }
      .servon-notif-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.25);
        z-index: 199;
        backdrop-filter: blur(2px);
        animation: fadeIn 0.2s ease;
      }
      @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }

      /* ── Empty state ── */
      .servon-empty {
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        padding: 60px 20px;
        border: 1.5px dashed #D1C9BC;
        border-radius: 16px;
        background: #FAFAF8;
        color: #9CA3AF;
        gap: 10px;
      }

      /* ── Section heading ── */
      .servon-section-head {
        display: flex; align-items: center; gap: 10px;
        margin-bottom: 14px;
      }
      .servon-section-title {
        font-size: 17px; font-weight: 700; color: #111827;
      }
      .servon-count-pill {
        background: #111827; color: #fff;
        font-size: 11px; font-weight: 600;
        padding: 2px 8px; border-radius: 20px;
      }

      /* ── Live dot ── */
      .servon-live-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: #10B981;
        box-shadow: 0 0 0 0 rgba(16,185,129,0.6);
        animation: pulse 1.8s infinite;
        display: inline-block;
        margin-right: 6px;
      }
      @keyframes pulse {
        0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
        70%  { box-shadow: 0 0 0 7px rgba(16,185,129,0); }
        100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
      }

      /* ── Scrollbar ── */
      ::-webkit-scrollbar { width: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #D1C9BC; border-radius: 3px; }
    `;
    document.head.appendChild(style);
  }
}

export default function DashboardScreen() {
  const { business, updateBusiness, isChefMode } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const isSmallWeb = isWeb && screenWidth < 600;

  const [analytics, setAnalytics] = useState(null);
  const [liveOrders, setLiveOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const isToday = (someDate) => {
    const today = new Date();
    const d = new Date(someDate);
    return d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
  };

  useFocusEffect(
    useCallback(() => {
      loadData();

      const socket = io(process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000", {
        transports: ["websocket"],
      });

      socket.on("connect", () => {
        if (business?.id) socket.emit("join_business", business.id);
      });

      socket.on("new_order", ({ order, notification, tableNumber }) => {
        if (isToday(order.created_at)) {
          setLiveOrders((prev) => [{ ...order, table_number: tableNumber }, ...prev]);
        }
        setNotifications((prev) => [notification, ...prev]);
      });

      socket.on("order_updated", (updatedOrder) => {
        setLiveOrders((prev) =>
          prev.map((o) => (o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o))
        );
      });

      return () => socket.disconnect();
    }, [business?.id])
  );

  const loadData = async () => {
    try {
      const [analyticsRes, ordersRes, notifRes, subRes] = await Promise.all([
        getAnalytics(),
        getOrders(),
        getNotifications(),
        getSubscriptionDetails()
      ]);

      setAnalytics(analyticsRes.data);

      const todaysLive = ordersRes.data.filter((o) =>
        isToday(o.created_at) && !["PAID", "REJECTED"].includes(o.status)
      );

      setLiveOrders(todaysLive);
      setNotifications(notifRes.data);

      if (subRes.data?.subscription_status) {
        updateBusiness({
          subscription_status: subRes.data.subscription_status,
          subscription_end_date: subRes.data.subscription_end_date
        });
        checkAndShowWarning(subRes.data.subscription_end_date);
      }
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const checkAndShowWarning = (freshEndDateStr) => {
    try {
      const endDateStr = freshEndDateStr || business?.subscription_end_date;
      if (!endDateStr) return;
      const endDate = new Date(endDateStr);
      const today = new Date();
      const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 3) {
        if (Platform.OS === "web") {
          if (daysLeft < 0) {
            window.alert("Your Servon plan has expired! The app is still running, but please go to your Profile to renew.");
          } else {
            window.alert(`Your Servon plan expires in ${daysLeft} days. Please renew soon!`);
          }
        } else {
          if (daysLeft < 0) {
            Alert.alert("Subscription Expired", "Your Servon plan has expired! Please go to your Profile to renew.", [
              { text: "Will do!", style: "cancel" },
              { text: "Renew Now", onPress: () => navigation.navigate("Profile") }
            ]);
          } else {
            Alert.alert("Renewal Reminder", `Your Servon plan expires in ${daysLeft} days. Please renew soon!`, [
              { text: "Got it", style: "cancel" },
              { text: "Renew Now", onPress: () => navigation.navigate("Profile") }
            ]);
          }
        }
      }
    } catch (err) {
      console.log("Warning popup error:", err);
    }
  };

  const handleStatusUpdate = async (orderId, status) => {
    try {
      await updateOrderStatus(orderId, status);
      if (["SERVED", "REJECTED"].includes(status)) {
        setLiveOrders((prev) => prev.filter((o) => o.id !== orderId));
      } else {
        setLiveOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
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
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      } catch (err) {
        console.error("Failed to mark notifications as read", err);
      }
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
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
      <div style={{ minHeight: "100vh", background: "#F5F3EF", fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── STICKY HEADER ── */}
        <div className="servon-web-header">
          <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 28px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {/* Brand */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: "#111827", letterSpacing: "-0.5px" }}>
                Servon<span style={{ color: "#22C55E" }}>.</span>
              </span>
            </div>

            {/* Right actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Notification bell */}
              <button
                onClick={handleOpenNotifications}
                style={{
                  position: "relative", background: unreadCount > 0 ? "#F0FDF4" : "#F9F8F6",
                  border: `1px solid ${unreadCount > 0 ? "#BBF7D0" : "#EAE6E0"}`,
                  borderRadius: 10, width: 38, height: 38,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", transition: "background 0.15s"
                }}
              >
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

              {/* Profile */}
              <button
                onClick={() => navigation.navigate("Profile")}
                style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "#111827", color: "#fff",
                  fontSize: 14, fontWeight: 600,
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "opacity 0.15s"
                }}
              >
                {ownerInitial}
              </button>
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "32px 28px 60px" }}>

          {/* Page title row */}
          <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#111827", letterSpacing: "-0.4px" }}>
                Good {getGreeting()}, {business?.owner_name?.split(" ")[0] || "there"} 👋
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9CA3AF" }}>{todayStr}</p>
            </div>
            <button
              onClick={() => { setRefreshing(true); loadData(); }}
              style={{
                background: "#fff", border: "1px solid #EAE6E0",
                borderRadius: 10, padding: "8px 16px",
                fontSize: 13, fontWeight: 500, color: "#374151",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                transition: "box-shadow 0.15s"
              }}
            >
              <Ionicons name="refresh-outline" size={14} color="#374151" />
              Refresh
            </button>
          </div>

          <SubscriptionBanner />

          {/* ── STAT CARDS ── */}
          <div className="servon-stats-grid" style={{ marginTop: 10 }}>
            <WebStatCard
              label="Orders Today"
              value={analytics?.today?.totalOrders ?? 0}
              icon="cube"
              color="#3B82F6"
              bg="#EFF6FF"
              accent="blue"
            />
            {!isChefMode && (
              <WebStatCard
                label="Revenue Today"
                value={`₹${(analytics?.today?.totalRevenue ?? 0).toFixed(0)}`}
                icon="wallet"
                color="#10B981"
                bg="#ECFDF5"
                accent="green"
              />
            )}
            <WebStatCard
              label="Active Tables"
              value={activeTableCount}
              icon="grid"
              color="#F59E0B"
              bg="#FFFBEB"
              accent="amber"
            />
            <WebStatCard
              label="Top Item"
              value={analytics?.today?.mostOrderedItem?.name || "-"}
              icon="flame"
              color="#EF4444"
              bg="#FEF2F2"
              accent="red"
              isText
            />
          </div>

          {/* ── LIVE ORDERS ── */}
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
              <div style={{
                display: "grid",
                gridTemplateColumns: screenWidth > 900 ? "repeat(2, 1fr)" : "1fr",
                gap: 14
              }}>
                {liveOrders.map((order) => (
                  <WebOrderCard key={order.id} order={order} onStatusUpdate={handleStatusUpdate} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── NOTIFICATION SIDE PANEL ── */}
        {showNotifications && (
          <>
            <div className="servon-notif-overlay" onClick={() => setShowNotifications(false)} />
            <div className="servon-notif-panel">
              {/* Panel header */}
              <div style={{
                padding: "20px 24px 16px",
                borderBottom: "1px solid #EAE6E0",
                display: "flex", alignItems: "center", justifyContent: "space-between"
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#111827" }}>Notifications</p>
                  {unreadCount > 0 && (
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9CA3AF" }}>
                      {unreadCount} unread
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowNotifications(false)}
                  style={{
                    background: "#F3F4F6", border: "none", borderRadius: 8,
                    width: 32, height: 32, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}
                >
                  <Ionicons name="close" size={16} color="#374151" />
                </button>
              </div>

              {/* Notification list */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 24px" }}>
                {notifications.length === 0 ? (
                  <div style={{ textAlign: "center", marginTop: 60, color: "#9CA3AF", fontSize: 14 }}>
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n, index) => (
                    <div
                      key={n.id || index}
                      style={{
                        padding: "14px 16px",
                        borderRadius: 12,
                        background: n.is_read ? "#FAFAF8" : "#F0FDF4",
                        border: `1px solid ${n.is_read ? "#EAE6E0" : "#BBF7D0"}`,
                        marginBottom: 10,
                      }}
                    >
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
      </div>
    );
  }

  // ─── NATIVE (ANDROID / IOS) — UNCHANGED ─────────────────────────────────────
  const statCardStyle = null;

  return (
    <View style={styles.container}>
      {/* FIXED HEADER */}
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + 15 }]}>
        <View style={styles.headerInner}>
          <Text style={styles.brandText}>
            Servon<Text style={styles.brandAccent}>.</Text>
          </Text>
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
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        <View style={styles.responsiveContent}>
          <SubscriptionBanner />

          <View style={[styles.statsGrid, isSmallWeb && styles.statsGridSmall]}>
            <StatCard label="Orders Today" value={analytics?.today?.totalOrders ?? 0} icon="cube" color="#3B82F6" bg="#EFF6FF" extraStyle={statCardStyle} />
            {!isChefMode && (
              <StatCard label="Revenue Today" value={`₹${(analytics?.today?.totalRevenue ?? 0).toFixed(0)}`} icon="wallet" color="#10B981" bg="#ECFDF5" extraStyle={statCardStyle} />
            )}
            <StatCard label="Active Tables" value={activeTableCount} icon="grid" color="#F59E0B" bg="#FFFBEB" extraStyle={statCardStyle} />
            <StatCard label="Top Item" value={analytics?.today?.mostOrderedItem?.name || "-"} icon="flame" color="#EF4444" bg="#FEF2F2" isText extraStyle={statCardStyle} />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Live Orders</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{liveOrders.length}</Text>
              </View>
            </View>

            {liveOrders.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="restaurant-outline" size={32} color="#9CA3AF" />
                </View>
                <Text style={styles.emptyText}>No active orders right now</Text>
                <Text style={styles.emptySubText}>Waiting for customers to scan QR</Text>
              </View>
            ) : (
              liveOrders.map((order) => (
                <OrderCard key={order.id} order={order} onStatusUpdate={handleStatusUpdate} />
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* NOTIFICATIONS MODAL */}
      <Modal visible={showNotifications} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderTop}>
              <Text style={styles.modalTitleText}>Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotifications(false)}>
                <Ionicons name="close-circle" size={28} color="#D1D5DB" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.notifList} showsVerticalScrollIndicator={false}>
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
    </View>
  );
}

/* ── HELPERS ────────────────────────────────────────────────────────────────── */

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

/* ── WEB-ONLY COMPONENTS ────────────────────────────────────────────────────── */

function WebStatCard({ label, value, icon, color, bg, accent, isText }) {
  return (
    <div className={`servon-stat-card accent-${accent}`}>
      <div className="servon-stat-icon" style={{ background: bg }}>
        <Ionicons name={icon} size={18} color={color} />
      </div>
      <div>
        <div
          className="servon-stat-value"
          style={isText ? { fontSize: 18, fontWeight: 600 } : {}}
          title={String(value)}
        >
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
      {/* Left accent bar colored by status */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: color, borderRadius: "16px 0 0 16px" }} />

      <div style={{ paddingLeft: 8 }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              background: "#F3F4F6", borderRadius: 8,
              padding: "4px 10px", fontSize: 13, fontWeight: 600, color: "#374151"
            }}>
              Table {order.table_number || "?"}
            </span>
            <span style={{
              background: `${color}18`, color: color,
              borderRadius: 20, padding: "3px 10px",
              fontSize: 11, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 4
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
              {order.status}
            </span>
          </div>
          <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>
            {elapsed < 1 ? "Just now" : `${elapsed}m ago`}
          </span>
        </div>

        {/* Items */}
        <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 10, marginBottom: 10 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{
                background: "#F3F4F6", borderRadius: 6,
                padding: "2px 7px", fontSize: 11, fontWeight: 700, color: "#374151"
              }}>{item.quantity}×</span>
              <span style={{ fontSize: 13, color: "#1F2937", fontWeight: 500 }}>{item.name}</span>
            </div>
          ))}
        </div>

        {/* Special instructions */}
        {order.special_instructions && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 6,
            background: "#FFFBEB", borderRadius: 8, padding: "8px 10px", marginBottom: 10
          }}>
            <Ionicons name="information-circle" size={14} color="#F59E0B" style={{ marginTop: 1 }} />
            <span style={{ fontSize: 12, color: "#92400E", lineHeight: 1.5 }}>{order.special_instructions}</span>
          </div>
        )}

        {/* Footer: total + action buttons */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #F3F4F6", paddingTop: 10 }}>
          <div>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>Total </span>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#111827" }}>₹{order.total_amount}</span>
          </div>

          {/* Contextual action buttons per status */}
         
        </div>
      </div>
    </div>
  );
}

/* ── NATIVE-ONLY COMPONENTS (unchanged) ─────────────────────────────────────── */

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

/* ── NATIVE STYLESHEET (unchanged) ─────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF8F5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  responsiveContent: {
    width: '100%',
    alignSelf: 'center',
    ...Platform.select({
      web: { maxWidth: 1100, paddingTop: 20 }
    })
  },

  header: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E2D9",
    paddingBottom: 14,
  },
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    width: '100%',
    alignSelf: 'center',
    ...Platform.select({
      web: { maxWidth: 1100 }
    })
  },
  brandText: { fontSize: 24, fontWeight: "700", color: "#111827" },
  brandAccent: { color: "#22C55E" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconBtn: { padding: 6 },
  badge: {
    position: "absolute",
    top: -2, right: -2,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    minWidth: 16, height: 16,
    alignItems: "center", justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "600" },
  profileAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#111827",
    alignItems: "center", justifyContent: "center",
  },
  profileAvatarText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  statsGrid: {
    flexDirection: "row", flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 10,
    ...Platform.select({ web: { gap: 16 } })
  },
  statsGridSmall: {
    ...Platform.select({ web: { gap: 12, justifyContent: "flex-start" } })
  },

  statCard: {
    backgroundColor: "#fff",
    width: "48%",
    borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: "#E8E2D9",
    ...Platform.select({
      web: { width: "23.5%", minWidth: 200 },
      ios: { shadowColor: "#A89880", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
      android: { elevation: 2 },
    }),
  },
  iconContainer: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  statValue: { fontSize: 22, fontWeight: "700", color: "#111827" },
  statLabel: { fontSize: 12, color: "#6B7280", marginTop: 2 },

  section: { paddingHorizontal: 20, paddingBottom: 30, marginTop: 6 },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  countBadge: { backgroundColor: "#111827", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, marginLeft: 8 },
  countBadgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },

  emptyCard: { backgroundColor: "#fff", padding: 30, borderRadius: 14, alignItems: "center", borderWidth: 1, borderColor: "#E8E2D9" },
  emptyIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyText: { fontSize: 15, fontWeight: "600", color: "#374151" },
  emptySubText: { fontSize: 13, color: "#9CA3AF", marginTop: 2 },

  orderCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: "#E8E2D9",
    ...Platform.select({
      ios: { shadowColor: "#A89880", shadowOpacity: 0.04, shadowRadius: 10 },
      android: { elevation: 2 },
    }),
  },
  orderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tableIndicator: { backgroundColor: "#F3F4F6", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  orderTable: { fontSize: 14, fontWeight: "600" },
  statusPill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: "600" },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  divider: { height: 1, backgroundColor: "#F3F4F6", marginVertical: 12 },
  orderItemRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  qtyBadge: { backgroundColor: "#F3F4F6", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, marginRight: 10 },
  qtyText: { fontSize: 12, fontWeight: "700" },
  orderItemName: { fontSize: 14, color: "#1F2937", flex: 1, fontWeight: "500" },
  noteBox: { flexDirection: "row", backgroundColor: "#FFFBEB", padding: 10, borderRadius: 8, marginTop: 6, alignItems: "center" },
  orderNote: { fontSize: 12, marginLeft: 6, flex: 1, color: "#92400E" },
  orderFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderTotalLabel: { fontSize: 13, color: "#6B7280" },
  orderTotalValue: { fontSize: 17, fontWeight: "800", color: "#111827" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: "80%",
    alignSelf: 'center', width: '100%',
    ...Platform.select({ web: { maxWidth: 600 } })
  },
  modalHeaderTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  modalTitleText: { fontSize: 20, fontWeight: "800" },
  notifItem: { padding: 16, borderRadius: 12, backgroundColor: "#F9FAFB", marginBottom: 12, borderWidth: 1, borderColor: "#E8E2D9" },
  notifItemUnread: { backgroundColor: "#ECFDF5", borderColor: "#10B98130" },
  notifTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  notifMessage: { fontSize: 13, marginTop: 4, color: "#4B5563", lineHeight: 18 },
  notifTime: { fontSize: 11, marginTop: 8, color: "#9CA3AF", fontWeight: "600" },
  emptyNotif: { textAlign: "center", marginTop: 40, color: "#9CA3AF", fontSize: 14 },
  notifList: { paddingBottom: 20 },
});