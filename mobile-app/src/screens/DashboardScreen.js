import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Modal,
  Alert
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

export default function DashboardScreen() {
  // Merged isChefMode into the existing useAuth call
  const { business, updateBusiness, isChefMode } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  
  const [analytics, setAnalytics] = useState(null);
  const [liveOrders, setLiveOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Helper to check if a date is today
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
        // Only add to live list if it's actually from today (safety check)
        if(isToday(order.created_at)) {
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
      
      // --- THE FIX: Filter by Status AND Date ---
      // We only want orders from TODAY that are NOT Paid or Rejected
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
        
        // 🚀 FIRE THE POPUP EVERY TIME DATA LOADS
        checkAndShowWarning(subRes.data.subscription_end_date);
      }
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // --- THE NAGWARE POPUP LOGIC (Triggered on every load/refresh) ---
  const checkAndShowWarning = (freshEndDateStr) => {
    try {
      const endDateStr = freshEndDateStr || business?.subscription_end_date; 
      if (!endDateStr) return;
      
      const endDate = new Date(endDateStr);
      const today = new Date();
      // Calculate days left (will be negative if already expired)
      const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

      // Trigger EVERY TIME if 3 days or less, OR if already expired (negative)
      if (daysLeft <= 3) {
        if (Platform.OS === "web") {
          // Web alerts
          if (daysLeft < 0) {
            window.alert("Your Servon plan has expired! The app is still running, but please go to your Profile to renew and support us.");
          } else {
            window.alert(`Your Servon plan expires in ${daysLeft} days. Please renew soon!`);
          }
        } else {
          // Mobile alerts
          if (daysLeft < 0) {
             Alert.alert(
               "Subscription Expired", 
               "Your Servon plan has expired! The app is still running, but please go to your Profile to renew and support us.", 
               [
                 { text: "Will do!", style: "cancel" },
                 { text: "Renew Now", onPress: () => navigation.navigate("Profile") }
               ]
             );
          } else {
             Alert.alert(
               "Renewal Reminder", 
               `Your Servon plan expires in ${daysLeft} days. Please renew soon!`, 
               [
                 { text: "Got it", style: "cancel" },
                 { text: "Renew Now", onPress: () => navigation.navigate("Profile") }
               ]
             );
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

  // --- THE FIX: Calculate true active tables based on live orders ---
  const activeTableCount = new Set(liveOrders.map(o => o.table_number)).size;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SubscriptionBanner />

      {/* PREMIUM SAAS HEADER */}
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + 15 }]}>
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

          <TouchableOpacity 
            style={styles.profileAvatar} 
            onPress={() => navigation.navigate("Profile")}
          >
            <Text style={styles.profileAvatarText}>{ownerInitial}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        {/* STATS GRID */}
        <View style={styles.statsGrid}>
          <StatCard label="Orders Today" value={analytics?.today?.totalOrders ?? 0} icon="cube" color="#3B82F6" bg="#EFF6FF" />
          
          {/* CHEF MODE LOCK: Hide Revenue */}
          {!isChefMode && (
            <StatCard label="Revenue Today" value={`₹${(analytics?.today?.totalRevenue ?? 0).toFixed(0)}`} icon="wallet" color="#10B981" bg="#ECFDF5" />
          )}

          {/* THE FIX: Use our new activeTableCount here! */}
          <StatCard label="Active Tables" value={activeTableCount} icon="grid" color="#F59E0B" bg="#FFFBEB" />
          
          <StatCard label="Top Item" value={analytics?.today?.mostOrderedItem?.name || "—"} icon="flame" color="#EF4444" bg="#FEF2F2" isText />
        </View>

        {/* LIVE ORDERS SECTION */}
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

/* ---------------- COMPONENTS ---------------- */

function StatCard({ label, value, icon, color, bg, isText }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.iconContainer, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, isText && { fontSize: 17 }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
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

/* ---------------- HELPERS ---------------- */

const statusColor = (s) => ({
  EDITABLE: "#6B7280",
  CONFIRMED: "#3B82F6",
  PREPARING: "#F59E0B",
  SERVED: "#10B981",
  REJECTED: "#EF4444",
}[s] || "#6B7280");

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" }, 
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  brandText: { 
    fontSize: 26, 
    fontWeight: "900", 
    color: "#111827", 
    letterSpacing: -0.5 
  },
  brandAccent: { color: "#10B981" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  iconBtn: { position: "relative", padding: 4 },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff"
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  profileAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Stats Grid
  statsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", padding: 20 },
  statCard: {
    backgroundColor: "#fff",
    width: "48%",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8 },
      android: { elevation: 1 },
      web: { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)' }
    }),
  },
  iconContainer: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  statValue: { fontSize: 24, fontWeight: "800", color: "#111827" },
  statLabel: { fontSize: 13, color: "#6B7280", marginTop: 4, fontWeight: "500" },

  // Sections
  section: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: "800", color: "#111827" },
  countBadge: { backgroundColor: "#111827", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginLeft: 10 },
  countBadgeText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  
  emptyCard: {
    backgroundColor: "#fff", padding: 40, borderRadius: 16, alignItems: "center",
    justifyContent: "center", borderWidth: 1, borderColor: "#E5E7EB", borderStyle: "dashed",
  },
  emptyIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#374151" },
  emptySubText: { fontSize: 14, color: "#9CA3AF", marginTop: 4 },

  // Orders
  orderCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: "#F3F4F6",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }
    }),
  },
  orderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tableIndicator: { backgroundColor: "#F3F4F6", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  orderTable: { fontSize: 15, fontWeight: "800", color: "#111827" },
  statusPill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: "700" },
  divider: { height: 1, backgroundColor: "#F3F4F6", marginVertical: 14 },
  orderItemRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  qtyBadge: { backgroundColor: "#F3F4F6", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 12 },
  qtyText: { fontSize: 13, fontWeight: "700", color: "#4B5563" },
  orderItemName: { fontSize: 15, color: "#1F2937", fontWeight: "600", flex: 1 },
  noteBox: { flexDirection: "row", backgroundColor: "#FFFBEB", padding: 12, borderRadius: 8, marginTop: 8, alignItems: "center" },
  orderNote: { fontSize: 13, color: "#B45309", marginLeft: 8, flex: 1, fontWeight: "500" },
  orderFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderTotalLabel: { fontSize: 14, color: "#6B7280", fontWeight: "600" },
  orderTotalValue: { fontSize: 18, fontWeight: "800", color: "#111827" },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: "rgba(17, 24, 39, 0.6)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "85%", paddingBottom: 40 },
  modalHeaderTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitleText: { fontSize: 20, fontWeight: "800", color: "#111827" },
  notifList: { paddingBottom: 20 },
  notifItem: { padding: 16, borderRadius: 12, backgroundColor: "#F9FAFB", marginBottom: 12, borderWidth: 1, borderColor: "#F3F4F6" },
  notifItemUnread: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  notifTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 4 },
  notifMessage: { fontSize: 14, color: "#4B5563", lineHeight: 20 },
  notifTime: { fontSize: 12, color: "#9CA3AF", marginTop: 8, fontWeight: "600" },
  emptyNotif: { textAlign: "center", color: "#9CA3AF", marginTop: 40, fontSize: 15, fontWeight: "500" },
});