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

export default function DashboardScreen() {
  const { business, updateBusiness, isChefMode } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  // Only used for web responsive tweaks
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
             Alert.alert(
               "Subscription Expired", 
               "Your Servon plan has expired! Please go to your Profile to renew.", 
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
  const activeTableCount = new Set(liveOrders.map(o => o.table_number)).size;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111" />
      </View>
    );
  }

  // Compute stat card width dynamically for web small screens
  // On small web: 2 columns with gap; on large web: 4 columns; on native: 48%
  const statCardStyle = isWeb ? (
    isSmallWeb
      ? { width: "calc(50% - 8px)", minWidth: 0 }   // 2×2 grid on small web
      : { width: "23.5%", minWidth: 200 }            // 4-column on large web
  ) : null; // native uses StyleSheet 48%

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

            <TouchableOpacity 
              style={styles.profileAvatar} 
              onPress={() => navigation.navigate("Profile")}
            >
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

          {/* Stats grid — inline style for web responsive, StyleSheet for native */}
          <View style={[
            styles.statsGrid,
            isSmallWeb && styles.statsGridSmall,
          ]}>
            <StatCard
              label="Orders Today"
              value={analytics?.today?.totalOrders ?? 0}
              icon="cube"
              color="#3B82F6"
              bg="#EFF6FF"
              extraStyle={statCardStyle}
            />
            
            {!isChefMode && (
              <StatCard
                label="Revenue Today"
                value={`₹${(analytics?.today?.totalRevenue ?? 0).toFixed(0)}`}
                icon="wallet"
                color="#10B981"
                bg="#ECFDF5"
                extraStyle={statCardStyle}
              />
            )}

            <StatCard
              label="Active Tables"
              value={activeTableCount}
              icon="grid"
              color="#F59E0B"
              bg="#FFFBEB"
              extraStyle={statCardStyle}
            />
            
            <StatCard
              label="Top Item"
              value={analytics?.today?.mostOrderedItem?.name || "-"}
              icon="flame"
              color="#EF4444"
              bg="#FEF2F2"
              isText
              extraStyle={statCardStyle}
            />
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

/* ---------------- COMPONENTS ---------------- */

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
    top: -2,
    right: -2,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "600" },
  profileAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  // Stats grid — base (native: 2-col wrapping)
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    ...Platform.select({
      web: { gap: 16 }
    })
  },
  // Small web override: use gap instead of space-between so 2 cards sit flush
  statsGridSmall: {
    ...Platform.select({
      web: { gap: 12, justifyContent: "flex-start" }
    })
  },

  statCard: {
    backgroundColor: "#fff",
    // Native: always 2 columns
    width: "48%",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E8E2D9",
    ...Platform.select({
      // Web default (large): 4 columns — overridden inline for small web
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
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    padding: 24, 
    maxHeight: "80%",
    alignSelf: 'center',
    width: '100%',
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