import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
  SectionList,
  ScrollView,
  Dimensions,
  TextInput,
  Modal,
  Pressable,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getOrders, updateOrderStatus, getProfile } from "../api";
import * as Print from "expo-print";
import { useAuth } from "../context/AuthContext";

// ===== OFFLINE SERVICES =====
import localDB from "../services/LocalDB";
import networkMonitor from "../services/NetworkMonitor";
import syncManager from "../services/SyncManager";

// ─── CONSTANTS ──────────────────────────────────────────────────────────

// How long (ms) we trust a locally-updated order over whatever the server
// returns on the next focus-triggered fetch. This avoids the "status
// reverts after navigating away and back" bug caused by read-after-write
// lag on the backend.
const LOCAL_UPDATE_TRUST_WINDOW_MS = 4000;

// Original status colors (for normal mode)
const statusColor = (s) =>
  ({
    EDITABLE: "#6B7280",
    CONFIRMED: "#3B82F6",
    PREPARING: "#F59E0B",
    SERVED: "#10B981",
    TABLE_ACTIVE: "#8B5CF6",
    PAID: "#9CA3AF",
    REJECTED: "#EF4444",
  }[s] || "#888");

// Original status filters (for normal mode)
const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "EDITABLE", label: "EDITABLE" },
  { key: "CONFIRMED", label: "CONFIRMED" },
  { key: "PREPARING", label: "PREPARING" },
  { key: "SERVED", label: "SERVED" },
  { key: "TABLE_ACTIVE", label: "TABLE ACTIVE" },
  { key: "PAID", label: "PAID" },
  { key: "PREVIOUS", label: "PREVIOUS" },
];

// ─── CHEF‑MODE STATUS CONFIG ──────────────────────────────────────────

const CHEF_STATUSES = {
  EDITABLE: {
    label: "New",
    color: "#6B7280",
    bg: "#F3F4F6",
    icon: "time-outline",
    priority: 4,
  },
  CONFIRMED: {
    label: "Confirmed",
    color: "#3B82F6",
    bg: "#EFF6FF",
    icon: "checkmark-circle-outline",
    priority: 3,
  },
  PREPARING: {
    label: "Cooking",
    color: "#F59E0B",
    bg: "#FFFBEB",
    icon: "flame-outline",
    priority: 2,
  },
  SERVED: {
    label: "Ready",
    color: "#10B981",
    bg: "#ECFDF5",
    icon: "checkmark-done-outline",
    priority: 1,
  },
  TABLE_ACTIVE: {
    label: "Active",
    color: "#8B5CF6",
    bg: "#F5F3FF",
    icon: "people-outline",
    priority: 0,
  },
  PAID: {
    label: "Paid",
    color: "#9CA3AF",
    bg: "#F1F5F9",
    icon: "cash-outline",
    priority: -1,
  },
  REJECTED: {
    label: "Rejected",
    color: "#EF4444",
    bg: "#FEF2F2",
    icon: "close-circle-outline",
    priority: -1,
  },
};

const getChefStatusConfig = (status) => CHEF_STATUSES[status] || CHEF_STATUSES.EDITABLE;
const CHEF_PRIORITY_ORDER = ["EDITABLE", "CONFIRMED", "PREPARING", "SERVED", "TABLE_ACTIVE"];

const CHEF_FILTERS = [
  { key: "all", label: "All" },
  { key: "EDITABLE", label: "New" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "PREPARING", label: "Cooking" },
  { key: "SERVED", label: "Ready" },
  { key: "TABLE_ACTIVE", label: "Active" },
];

// ─── CHEF‑MODE SUB‑COMPONENTS ─────────────────────────────────────────

const ChefStatusBadge = React.memo(({ status, size = "medium" }) => {
  const config = getChefStatusConfig(status);
  const fontSize = size === "small" ? 10 : 12;
  const padding = size === "small" ? 4 : 8;

  return (
    <View style={[styles.chefBadge, { backgroundColor: config.bg, paddingHorizontal: padding, paddingVertical: padding }]}>
      <Ionicons name={config.icon} size={fontSize + 2} color={config.color} />
      <Text style={[styles.chefBadgeLabel, { color: config.color, fontSize }]}>{config.label}</Text>
    </View>
  );
});

const ChefOrderCard = React.memo((props) => {
  const {
    order,
    onAccept,
    onReject,
    onComplete,
    onPrint,
    isProcessing,
    timeLeft,
    isChefMode,
  } = props;

  const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || "[]");
  const isEditable = order.status === "EDITABLE";
  const isPreparing = order.status === "PREPARING";
  const isServed = order.status === "SERVED";
  const isTableActive = order.status === "TABLE_ACTIVE";

  const isToday = (date) => {
    const today = new Date();
    const d = new Date(date);
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  return (
    <View style={styles.chefOrderCard}>
      {/* Header */}
      <View style={styles.chefCardHeader}>
        <View style={styles.chefTableRow}>
          <View style={styles.chefTableIconWrap}>
            <Ionicons name="restaurant-outline" size={18} color="#111" />
          </View>
          <Text style={styles.chefTableNumber}>Table {order.table_number}</Text>
        </View>
        <ChefStatusBadge status={order.status} />
      </View>

      {/* Items */}
      <View style={styles.chefItemsContainer}>
        {items.map((item, idx) => (
          <View key={idx} style={[styles.chefItemRow, idx !== items.length - 1 && styles.chefItemRowDivider]}>
            <Text style={styles.chefItemName} numberOfLines={2}>
              • {item.name}
            </Text>
            <View style={styles.chefItemMeta}>
              <Text style={styles.chefItemQty}>×{item.quantity}</Text>
              <Text style={styles.chefItemPrice}>₹{(item.price * item.quantity).toFixed(0)}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Instructions */}
      {order.special_instructions && (
        <View style={styles.chefInstructions}>
          <Ionicons name="chatbubble-outline" size={14} color="#92400E" />
          <Text style={styles.chefInstructionsText}>{order.special_instructions}</Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.chefCardFooter}>
        <View style={styles.chefTimestampRow}>
          <Ionicons name="time-outline" size={12} color="#9CA3AF" />
          <Text style={styles.chefTimestamp}>
            {new Date(order.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
        <View style={styles.chefTotalRow}>
          <Text style={styles.chefTotalLabel}>Total:</Text>
          <Text style={styles.chefTotalValue}>₹{Math.round(parseFloat(order.total_amount))}</Text>
        </View>
      </View>

      {isToday(order.created_at) && (
        <View style={styles.chefActions}>
          {isEditable &&
            (timeLeft > 0 ? (
              <View style={styles.chefWaitingBadge}>
                <ActivityIndicator size="small" color="#9CA3AF" />
                <Text style={styles.chefWaitingText}>Editing ({timeLeft}s)</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  activeOpacity={0.75}
                  style={[styles.chefActionBtn, styles.chefAcceptBtn]}
                  onPress={() => onAccept(order.id)}
                >
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.chefActionText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.75}
                  style={[styles.chefActionBtn, styles.chefRejectBtn]}
                  onPress={() => onReject(order.id)}
                >
                  <Ionicons name="close" size={18} color="#fff" />
                  <Text style={styles.chefActionText}>Reject</Text>
                </TouchableOpacity>
              </>
            ))}
          {isPreparing && (
            <TouchableOpacity
              activeOpacity={0.75}
              style={[styles.chefActionBtn, styles.chefCompleteBtn, { flex: 1 }]}
              onPress={() => onComplete(order.id)}
            >
              <Ionicons name="checkmark-done" size={18} color="#fff" />
              <Text style={styles.chefActionText}>Serve</Text>
            </TouchableOpacity>
          )}
          {isServed && (
            <TouchableOpacity
              activeOpacity={0.75}
              style={[styles.chefActionBtn, styles.chefActiveBtn, { flex: 1 }]}
              onPress={() => onComplete(order.id)}
            >
              <Ionicons name="people" size={18} color="#fff" />
              <Text style={styles.chefActionText}>Active Table</Text>
            </TouchableOpacity>
          )}
          {isTableActive && !isChefMode && (
            <TouchableOpacity
              activeOpacity={0.75}
              style={[styles.chefActionBtn, styles.chefPrintBtn, { flex: 1 }]}
              onPress={() => onPrint(order)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="print-outline" size={18} color="#fff" />
                  <Text style={styles.chefActionText}>Bill</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
});

// ─── UPGRADE GATE ──────────────────────────────────────────────────────
function UpgradeGate() {
  const navigation = useNavigation();
  const benefits = [
    { icon: "flash", text: "Real-time Instant Order Receiving" },
    { icon: "print", text: "Professional Billing & GST Invoicing" },
    { icon: "notifications", text: "Kitchen Notification System" },
    { icon: "stats-chart", text: "Advanced Revenue Analytics" },
    { icon: "people", text: "Table Management & Live Tracking" },
  ];

  return (
    <ScrollView contentContainerStyle={gateStyles.container} showsVerticalScrollIndicator={false}>
      <View style={gateStyles.card}>
        <View style={gateStyles.iconHeader}>
          <Ionicons name="ribbon" size={40} color="#10B981" />
        </View>
        <Text style={gateStyles.title}>Unlock Full Business Suite</Text>
        <Text style={gateStyles.subtitle}>Take control of your restaurant with Servon's powerful order management tools.</Text>
        <View style={gateStyles.benefitsList}>
          {benefits.map((item, index) => (
            <View key={index} style={gateStyles.benefitItem}>
              <Ionicons name={item.icon} size={18} color="#10B981" />
              <Text style={gateStyles.benefitText}>{item.text}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={gateStyles.btn} onPress={() => navigation.navigate("Profile")} activeOpacity={0.85}>
          <Text style={gateStyles.btnText}>Upgrade to Premium</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const gateStyles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#FAF8F5",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 30,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 },
      android: { elevation: 10 },
      web: { boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" },
    }),
  },
  iconHeader: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#ECFDF5", justifyContent: "center", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 22, fontWeight: "900", color: "#111827", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  benefitsList: { width: "100%", marginBottom: 30, gap: 12 },
  benefitItem: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F9FAFB", padding: 12, borderRadius: 12 },
  benefitText: { fontSize: 14, fontWeight: "600", color: "#374151" },
  btn: { backgroundColor: "#111827", width: "100%", borderRadius: 14, paddingVertical: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  footerNote: { fontSize: 11, color: "#9CA3AF", marginTop: 16, fontWeight: "500" },
});

// ─── DISCOUNT MODAL ────────────────────────────────────────────────────
const DiscountModal = ({ visible, onClose, discountType, setDiscountType, discountValue, setDiscountValue, onApply, modalSubtotal, modalDiscountAmount }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.discountModalOverlay} onPress={onClose}>
        <Pressable style={styles.discountModal} onPress={(e) => e.stopPropagation()}>
          <View style={styles.discountModalHeader}>
            <Text style={styles.discountModalTitle}>Apply Discount</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.6}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <View style={styles.discountSegment}>
            {[
              { key: "none", label: "None", icon: "close-circle-outline" },
              { key: "percentage", label: "% Off", icon: "pricetag-outline" },
              { key: "flat", label: "₹ Off", icon: "cash-outline" },
            ].map((item) => (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.75}
                style={[styles.segmentBtn, discountType === item.key && styles.segmentBtnActive]}
                onPress={() => { setDiscountType(item.key); setDiscountValue(""); }}
              >
                <Ionicons name={item.icon} size={16} color={discountType === item.key ? "#fff" : "#6B7280"} />
                <Text style={[styles.segmentText, discountType === item.key && styles.segmentTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {discountType !== "none" && (
            <>
              <View style={styles.discountInputWrap}>
                <Text style={styles.discountPrefix}>{discountType === "percentage" ? "%" : "₹"}</Text>
                <TextInput style={styles.discountInputField} placeholder="0" keyboardType="numeric" value={discountValue} onChangeText={setDiscountValue} autoFocus />
              </View>
              {discountType === "percentage" && (
                <View style={styles.presetRow}>
                  {[5, 10, 15, 20].map((p) => (
                    <TouchableOpacity key={p} activeOpacity={0.7} style={styles.presetChip} onPress={() => setDiscountValue(String(p))}>
                      <Text style={styles.presetChipText}>{p}%</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
          <View style={styles.previewBox}>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Subtotal</Text>
              <Text style={styles.previewValue}>₹{Math.round(modalSubtotal)}</Text>
            </View>
            {modalDiscountAmount > 0 && (
              <View style={styles.previewRow}>
                <Text style={[styles.previewLabel, { color: "#EF4444" }]}>Discount</Text>
                <Text style={[styles.previewValue, { color: "#EF4444" }]}>-₹{Math.round(modalDiscountAmount)}</Text>
              </View>
            )}
            <View style={[styles.previewRow, { borderTopWidth: 1, borderTopColor: "#E5E7EB", paddingTop: 8, marginTop: 4 }]}>
              <Text style={styles.previewTotalLabel}>Payable</Text>
              <Text style={styles.previewTotalValue}>₹{Math.round(modalSubtotal - modalDiscountAmount)}</Text>
            </View>
          </View>
          <View style={styles.discountModalButtons}>
            <TouchableOpacity activeOpacity={0.8} style={[styles.discountModalBtn, { backgroundColor: "#F3F4F6" }]} onPress={onClose}>
              <Text style={[styles.discountModalBtnText, { color: "#374151" }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8} style={[styles.discountModalBtn, { backgroundColor: "#111827" }]} onPress={onApply}>
              <Ionicons name="print-outline" size={16} color="#fff" />
              <Text style={styles.discountModalBtnText}>Apply & Print</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ─── MAIN SCREEN ──────────────────────────────────────────────────────
export default function OrdersScreen() {
  const { isChefMode, isPremium, loading: authLoading } = useAuth();

  // ─── STATE ──────────────────────────────────────────────────────────
  const [orders, setOrders] = useState([]);
  const [profile, setProfile] = useState(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingTable, setProcessingTable] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [numColumns, setNumColumns] = useState(Platform.OS === "web" ? 3 : 1);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [showPicker, setShowPicker] = useState(false);

  // ===== OFFLINE STATE =====
  const [isOffline, setIsOffline] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [selectedOrderForDiscount, setSelectedOrderForDiscount] = useState(null);
  const [discountType, setDiscountType] = useState("none");
  const [discountValue, setDiscountValue] = useState("");

  // Tracks per-order timestamps of local (optimistic) status changes
  const localUpdateTimestamps = useRef({});

  const isWeb = Platform.OS === "web";
  let DateTimePicker;
  if (!isWeb) {
    DateTimePicker = require("@react-native-community/datetimepicker").default;
  }

  // ─── HOOKS ──────────────────────────────────────────────────────────

  // ===== NETWORK STATUS LISTENER =====
  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe((online) => {
      setIsOffline(!online);
      if (online) {
        // Back online - refresh data
        loadData();
        syncManager.startSync();
      }
    });
    return () => unsubscribe();
  }, []);

  // ===== SYNC STATUS LISTENER =====
  useEffect(() => {
    const updatePendingCount = async () => {
      try {
        const count = await localDB.getPendingActionsCount();
        setPendingSyncCount(count);
      } catch (error) {
        console.log('Pending count error:', error);
      }
    };
    updatePendingCount();

    syncManager.setStatusCallback((status) => {
      setIsSyncing(status.isSyncing);
      updatePendingCount();
    });

    const interval = setInterval(updatePendingCount, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isWeb) {
      const updateLayout = () => {
        const width = Dimensions.get("window").width;
        if (width > 1200) setNumColumns(3);
        else if (width > 768) setNumColumns(2);
        else setNumColumns(1);
      };
      const subscription = Dimensions.addEventListener("change", updateLayout);
      updateLayout();
      return () => subscription.remove();
    }
  }, [isWeb]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  // In OrdersScreen.js - Add this for testing
useEffect(() => {
    const checkLocalDB = async () => {
        try {
            const stats = await localDB.getStats();
            console.log(' Local DB Stats:', stats);
            
            const orders = await localDB.getOrders();
            console.log(' Local Orders Count:', orders.length);
        } catch (error) {
            console.error('Local DB check error:', error);
        }
    };
    
    // Check after 2 seconds
    setTimeout(checkLocalDB, 2000);
}, []);
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // ─── DATA LOADING ──────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Try to load from local DB first (fast)
      let localOrders = [];
      try {
        if (filter === 'PREVIOUS') {
          localOrders = await localDB.getOrdersByDate(selectedDate);
        } else {
          localOrders = await localDB.getOrders(filter === 'all' ? null : filter);
        }
        if (localOrders && localOrders.length > 0) {
          setOrders(localOrders);
        }
      } catch (dbError) {
        console.log('Local DB read error:', dbError);
      }

      // 2. Try to fetch from API if online
      const isOnline = await networkMonitor.checkConnectivity();
      
      if (isOnline) {
        const [ordersRes, profileRes] = await Promise.all([
          getOrders(),
          getProfile()
        ]);
        
        const freshOrders = ordersRes.data || [];
        const now = Date.now();

        // Merge with local updates
        setOrders((prev) => {
          const prevById = new Map(prev.map((o) => [o.id, o]));
          return freshOrders.map((fresh) => {
            const updatedAt = localUpdateTimestamps.current[fresh.id];
            if (updatedAt && now - updatedAt < LOCAL_UPDATE_TRUST_WINDOW_MS) {
              const local = prevById.get(fresh.id);
              if (local) return local;
            }
            return fresh;
          });
        });

        // Save to local DB for offline use
        await localDB.saveOrders(freshOrders);
        setProfile(profileRes.data);
        setIsOffline(false);
      } else {
        setIsOffline(true);
        // If we have no local orders, try to load from local DB again
        if (!localOrders || localOrders.length === 0) {
          const fallbackOrders = await localDB.getOrders();
          if (fallbackOrders && fallbackOrders.length > 0) {
            setOrders(fallbackOrders);
          }
        }
      }
    } catch (err) {
      console.error("Data load error:", err);
      // Try to load from local DB as fallback
      try {
        const fallbackOrders = await localDB.getOrders();
        if (fallbackOrders && fallbackOrders.length > 0) {
          setOrders(fallbackOrders);
        }
      } catch (fallbackError) {
        console.error('Fallback load failed:', fallbackError);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, selectedDate]);

  // ─── HANDLERS ──────────────────────────────────────────────────────

  const handleStatusUpdate = useCallback(async (orderId, status) => {
    try {
      // 1. Update local DB immediately (optimistic)
      await localDB.updateOrderStatus(orderId, status);
      
      // 2. Update local state
      localUpdateTimestamps.current[orderId] = Date.now();
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));

      // 3. Try to update on server if online
      const isOnline = await networkMonitor.checkConnectivity();
      if (isOnline) {
        try {
          await updateOrderStatus(orderId, status);
          await localDB.markAsSynced(orderId);
        } catch (apiError) {
          console.log('Server update failed, will sync later:', apiError);
        }
      }

      // 4. Update pending count
      const count = await localDB.getPendingActionsCount();
      setPendingSyncCount(count);

    } catch (err) {
      console.error("Update error:", err);
      Alert.alert('Error', 'Failed to update order status. Will retry when online.');
    }
  }, []);

  const handlePrintAndCheckout = useCallback(
    async (currentOrder, discount) => {
      setProcessingTable(currentOrder.table_number);
      try {
        const tableOrders = orders.filter(
          (o) => o.table_number === currentOrder.table_number && o.status !== "PAID" && o.status !== "REJECTED"
        );
        if (tableOrders.length === 0) return;

        let combinedSubtotal = 0;
        const combinedItems = {};
        tableOrders.forEach((o) => {
          combinedSubtotal += parseFloat(o.total_amount);
          const items = Array.isArray(o.items) ? o.items : JSON.parse(o.items || "[]");
          items.forEach((item) => {
            if (combinedItems[item.name]) {
              combinedItems[item.name].quantity += item.quantity;
            } else {
              combinedItems[item.name] = { ...item };
            }
          });
        });
        const finalItemsList = Object.values(combinedItems);

        let discountAmount = 0;
        if (discount && discount.type !== "none" && discount.value > 0) {
          if (discount.type === "percentage") discountAmount = (combinedSubtotal * discount.value) / 100;
          else if (discount.type === "flat") discountAmount = Math.min(discount.value, combinedSubtotal);
        }
        const amountAfterDiscount = combinedSubtotal - discountAmount;
        const cgstPercent = parseFloat(profile?.cgst_percentage || 0);
        const sgstPercent = parseFloat(profile?.sgst_percentage || 0);
        const cgstAmount = (amountAfterDiscount * cgstPercent) / 100;
        const sgstAmount = (amountAfterDiscount * sgstPercent) / 100;
        const grandTotal = amountAfterDiscount + cgstAmount + sgstAmount;

        let itemsHtml = "";
        finalItemsList.forEach((i) => {
          itemsHtml += `
            <tr>
              <td style="padding: 4px 0;">${i.name}</td>
              <td style="text-align: center;">${i.quantity}</td>
              <td style="text-align: right;">${(i.price * i.quantity).toFixed(2)}</td>
            </tr>
          `;
        });
        const discountHtml =
          discountAmount > 0
            ? `<tr><td>Discount (${discount.type === "percentage" ? discount.value + "%" : "Flat"})</td><td class="right">-₹${discountAmount.toFixed(2)}</td></tr>`
            : "";

        const feedbackLink = `https://menu.servon.cloud/feedback/${profile?.id}?table=${currentOrder.table_number}`;
        const htmlContent = `
          <html>
            <head><style>
              body { font-family: monospace; width: 80mm; padding: 10px; color: #000; margin: 0 auto; }
              h2 { text-align: center; margin: 0 0 5px 0; font-size: 24px; }
              .center { text-align: center; font-size: 14px; margin-bottom: 5px; }
              .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
              table { width: 100%; border-collapse: collapse; font-size: 14px; }
              .right { text-align: right; }
              .bold { font-weight: bold; }
            </style></head>
            <body>
              <h2>${profile?.business_name || "Restaurant"}</h2>
              ${profile?.gst_number ? `<div class="center">GSTIN: ${profile.gst_number}</div>` : ""}
              <div class="center">Table: ${currentOrder.table_number}</div>
              <div class="center">Date: ${new Date().toLocaleString("en-IN")}</div>
              <div class="divider"></div>
              <table>
                <tr class="bold" style="border-bottom: 1px solid #000;">
                  <td style="padding-bottom: 5px;">Item</td>
                  <td class="center" style="padding-bottom: 5px;">Qty</td>
                  <td class="right" style="padding-bottom: 5px;">Price</td>
                </tr>
                ${itemsHtml}
              </table>
              <div class="divider"></div>
              <table>
                <tr><td>Subtotal:</td><td class="right">${combinedSubtotal.toFixed(2)}</td></tr>
                ${discountHtml}
                <tr><td>Amount After Discount:</td><td class="right">${amountAfterDiscount.toFixed(2)}</td></tr>
                ${cgstPercent > 0 ? `<tr><td>CGST (${cgstPercent}%):</td><td class="right">${cgstAmount.toFixed(2)}</td></tr>` : ""}
                ${sgstPercent > 0 ? `<tr><td>SGST (${sgstPercent}%):</td><td class="right">${sgstAmount.toFixed(2)}</td></tr>` : ""}
                <tr class="bold">
                  <td style="font-size: 18px; padding-top: 10px;">GRAND TOTAL:</td>
                  <td class="right" style="font-size: 18px; padding-top: 10px;">₹${grandTotal.toFixed(2)}</td>
                </tr>
              </table>
              <div class="divider"></div>
              <div class="center" style="font-weight: bold; font-size: 16px;">Thank You for Visiting!</div>
              <div class="center" style="margin-top: 15px;">
                <p style="font-size: 12px; margin-bottom: 5px;">How was your food? Scan to rate us!</p>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(feedbackLink)}" width="100" height="100" />
              </div>
            </body>
          </html>
        `;

        if (Platform.OS === "web") {
          const iframe = document.createElement("iframe");
          iframe.style.cssText = "position:absolute;width:0px;height:0px;border:none;";
          document.body.appendChild(iframe);
          iframe.contentWindow.document.open();
          iframe.contentWindow.document.write(htmlContent);
          iframe.contentWindow.document.close();
          setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          }, 500);
          setTimeout(() => {
            if (document.body.contains(iframe)) document.body.removeChild(iframe);
          }, 3000);
        } else {
          await Print.printAsync({ html: htmlContent });
        }

        // Update orders to PAID status locally and on server
        await Promise.all(tableOrders.map((o) => updateOrderStatus(o.id, "PAID")));
        const now = Date.now();
        tableOrders.forEach((o) => {
          localUpdateTimestamps.current[o.id] = now;
          // Also update local DB
          localDB.updateOrderStatus(o.id, "PAID");
        });
        setOrders((prev) =>
          prev.map((o) => (tableOrders.some((to) => to.id === o.id) ? { ...o, status: "PAID" } : o))
        );
      } catch (err) {
        console.error("Print Error", err);
        Alert.alert("Print Failed", "Could not print the bill.");
      } finally {
        setProcessingTable(null);
      }
    },
    [orders, profile]
  );

  const openDiscountModal = useCallback((order) => {
    setSelectedOrderForDiscount(order);
    setDiscountType("none");
    setDiscountValue("");
    setShowDiscountModal(true);
  }, []);

  const applyDiscount = useCallback(() => {
    const value = parseFloat(discountValue);
    if (discountType !== "none" && (!value || value <= 0)) {
      Alert.alert("Invalid", "Please enter a valid discount amount.");
      return;
    }
    const discount = { type: discountType, value: value || 0 };
    handlePrintAndCheckout(selectedOrderForDiscount, discount);
    setShowDiscountModal(false);
    setSelectedOrderForDiscount(null);
  }, [discountType, discountValue, selectedOrderForDiscount, handlePrintAndCheckout]);

  const modalSubtotal = useMemo(() => {
    if (!selectedOrderForDiscount) return 0;
    return orders
      .filter((o) => o.table_number === selectedOrderForDiscount.table_number && o.status !== "PAID" && o.status !== "REJECTED")
      .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
  }, [selectedOrderForDiscount, orders]);

  const modalDiscountAmount = useMemo(() => {
    if (!selectedOrderForDiscount) return 0;
    const value = parseFloat(discountValue) || 0;
    if (discountType === "percentage") return (modalSubtotal * value) / 100;
    if (discountType === "flat") return Math.min(value, modalSubtotal);
    return 0;
  }, [discountType, discountValue, modalSubtotal, selectedOrderForDiscount]);

  // ─── HELPERS ──────────────────────────────────────────────────────
  const isToday = (date) => {
    const today = new Date();
    const d = new Date(date);
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const onDateChange = (event, selected) => {
    if (event.type === "dismissed") {
      setShowPicker(false);
      return;
    }
    if (Platform.OS === "android") setShowPicker(false);
    if (selected) {
      const dateString = selected.toISOString().split("T")[0];
      setSelectedDate(dateString);
    }
  };

  // ─── RENDER ORDER ITEMS ──────────────────────────────────────────────

  // Original render (normal mode)
  const renderOrderItemOld = ({ item }) => {
    const items = Array.isArray(item.items) ? item.items : JSON.parse(item.items || "[]");
    const isProcessing = processingTable === item.table_number;
    const orderTime = new Date(item.updated_at || item.created_at).getTime();
    const secondsPassed = Math.floor((currentTime - orderTime) / 1000);
    const timeLeft = Math.max(0, 60 - secondsPassed);

    return (
      <View style={styles.orderCardOld}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: "#111" }}>Table {item.table_number}</Text>
          <View style={[styles.badgeOld, { backgroundColor: statusColor(item.status) }]}>
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.4 }}>{item.status.replace("_", " ")}</Text>
          </View>
        </View>
        {items.map((i, idx) => (
          <Text key={idx} style={{ fontSize: 15, color: "#374151", marginBottom: 5, fontWeight: "500", lineHeight: 20 }}>
            • {i.name} × {i.quantity} - <Text style={{ fontWeight: "700" }}>₹{(i.price * i.quantity).toFixed(0)}</Text>
          </Text>
        ))}
        {item.special_instructions && (
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: "#FEF3C7", padding: 10, borderRadius: 10, marginTop: 8 }}>
            <Ionicons name="chatbubble-outline" size={13} color="#92400E" style={{ marginTop: 2 }} />
            <Text style={{ fontSize: 13, color: "#92400E", fontWeight: "600", flex: 1 }}>{item.special_instructions}</Text>
          </View>
        )}
        <View style={styles.totalRowOld}>
          <Text style={{ fontWeight: "600", fontSize: 14, color: "#6B7280" }}>Subtotal:</Text>
          <Text style={{ fontWeight: "800", fontSize: 18, color: "#111" }}>
            ₹{Math.round(parseFloat(item.total_amount))}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
          <Ionicons name="time-outline" size={12} color="#aaa" />
          <Text style={{ fontSize: 12, color: "#aaa" }}>
            Ordered at: {new Date(item.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
        {isToday(item.created_at) && (
          <>
            {(item.status === "EDITABLE" || item.status === "CONFIRMED") && (
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                {item.status === "EDITABLE" && timeLeft > 0 ? (
                  <View style={[styles.actionBtnOld, { backgroundColor: "#F3F4F6", flexDirection: "row", justifyContent: "center", gap: 8 }]}>
                    <ActivityIndicator size="small" color="#9CA3AF" />
                    <Text style={[styles.actionBtnTextOld, { color: "#6B7280" }]}>Reviewing ({timeLeft}s)...</Text>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.actionBtnOld, { backgroundColor: "#10B981" }]} onPress={() => handleStatusUpdate(item.id, "PREPARING")}>
                      <Text style={styles.actionBtnTextOld}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.actionBtnOld, { backgroundColor: "#EF4444", flex: 0.4 }]} onPress={() => handleStatusUpdate(item.id, "REJECTED")}>
                      <Text style={styles.actionBtnTextOld}>Reject</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
            {item.status === "PREPARING" && (
              <TouchableOpacity activeOpacity={0.8} style={[styles.actionBtnOld, { backgroundColor: "#F59E0B", marginTop: 16 }]} onPress={() => handleStatusUpdate(item.id, "SERVED")}>
                <Text style={[styles.actionBtnTextOld, { color: "#fff" }]}>Mark Served</Text>
              </TouchableOpacity>
            )}
            {item.status === "SERVED" && (
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                <TouchableOpacity activeOpacity={0.8} style={[styles.actionBtnOld, { backgroundColor: "#8B5CF6" }]} onPress={() => handleStatusUpdate(item.id, "TABLE_ACTIVE")}>
                  <Text style={styles.actionBtnTextOld}>Active Table</Text>
                </TouchableOpacity>
                {!isChefMode && (
                  <TouchableOpacity activeOpacity={0.8} style={[styles.actionBtnOld, { backgroundColor: isProcessing ? "#4B5563" : "#111827" }]} onPress={() => openDiscountModal(item)} disabled={isProcessing}>
                    {isProcessing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.actionBtnTextOld}>Print</Text>}
                  </TouchableOpacity>
                )}
              </View>
            )}
            {item.status === "TABLE_ACTIVE" && !isChefMode && (
              <TouchableOpacity activeOpacity={0.8} style={[styles.actionBtnOld, { backgroundColor: isProcessing ? "#4B5563" : "#111827", marginTop: 16, flexDirection: "row", justifyContent: "center", gap: 8 }]} onPress={() => openDiscountModal(item)} disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.actionBtnTextOld}>Generating Bill...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="print-outline" size={20} color="#fff" />
                    <Text style={styles.actionBtnTextOld}>Print Final Bill</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    );
  };

  // Chef render
  const renderOrderItemChef = useCallback(
    ({ item }) => {
      const orderTime = new Date(item.updated_at || item.created_at).getTime();
      const secondsPassed = Math.floor((currentTime - orderTime) / 1000);
      const timeLeft = Math.max(0, 60 - secondsPassed);

      return (
        <ChefOrderCard
          order={item}
          onAccept={(id) => handleStatusUpdate(id, "PREPARING")}
          onReject={(id) => handleStatusUpdate(id, "REJECTED")}
          onComplete={(id) => {
            if (item.status === "PREPARING") handleStatusUpdate(id, "SERVED");
            else if (item.status === "SERVED") handleStatusUpdate(id, "TABLE_ACTIVE");
          }}
          onPrint={openDiscountModal}
          isProcessing={processingTable === item.table_number}
          timeLeft={timeLeft}
          isChefMode={isChefMode}
        />
      );
    },
    [currentTime, handleStatusUpdate, processingTable, isChefMode, openDiscountModal]
  );

  // ─── FILTER HELPERS ──────────────────────────────────────────────

  const getFilteredData = useCallback(() => {
    let result;
    if (filter === "all") {
      result = orders.filter((o) => isToday(o.created_at));
    } else if (filter === "PREVIOUS") {
      return [];
    } else {
      result = orders.filter((o) => o.status === filter && isToday(o.created_at));
    }
    // Sort by priority (only for chef mode)
    if (isChefMode) {
      result.sort((a, b) => {
        const priorityA = CHEF_PRIORITY_ORDER.indexOf(a.status);
        const priorityB = CHEF_PRIORITY_ORDER.indexOf(b.status);
        if (priorityA === -1 && priorityB === -1) return 0;
        if (priorityA === -1) return 1;
        if (priorityB === -1) return -1;
        return priorityA - priorityB;
      });
    }
    return result;
  }, [orders, filter, isChefMode]);

  const getGroupedPreviousOrders = () => {
    const filtered = orders.filter((o) => {
      const orderDate = new Date(o.created_at).toISOString().split("T")[0];
      return orderDate === selectedDate && !isToday(o.created_at);
    });
    const groups = filtered.reduce((acc, order) => {
      const dateLabel = new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
      if (!acc[dateLabel]) acc[dateLabel] = [];
      acc[dateLabel].push(order);
      return acc;
    }, {});
    return Object.keys(groups).map((date) => ({ title: date, data: groups[date] }));
  };

  // ─── LOADING / PREMIUM ─────────────────────────────────────────────

  if (authLoading || isPremium === null) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#111" />
      </View>
    );
  }

  if (!isPremium) {
    return <UpgradeGate />;
  }

  // ─── RENDER ─────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FAF8F5" }}>
      {/* Filter Tabs */}
      <View style={isWeb ? { maxWidth: 1200, alignSelf: "center", width: "100%" } : null}>
        {isChefMode ? (
          <FlatList
            horizontal
            data={CHEF_FILTERS}
            keyExtractor={(i) => i.key}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12, gap: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.75}
                style={[styles.filterTab, filter === item.key && styles.filterTabActive]}
                onPress={() => setFilter(item.key)}
              >
                <Text style={[styles.filterTabText, filter === item.key && { color: "#fff" }]}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
        ) : (
          <FlatList
            horizontal
            data={STATUS_FILTERS}
            keyExtractor={(i) => i.key}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12, gap: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.75}
                style={[styles.filterTab, filter === item.key && styles.filterTabActive]}
                onPress={() => setFilter(item.key)}
              >
                <Text style={[styles.filterTabText, filter === item.key && { color: "#fff" }]}>
                  {item.label.replace("_", " ")}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* Main Content */}
      <View style={[{ flex: 1 }, isWeb && { maxWidth: 1200, alignSelf: "center", width: "100%" }]}>
        {filter === "PREVIOUS" ? (
          <>
            <View style={styles.datePickerContainer}>
              <View style={styles.dateInfo}>
                <Ionicons name="calendar-outline" size={20} color="#10B981" />
                <Text style={styles.dateLabel}>Select History Date:</Text>
              </View>
              {Platform.OS === "web" ? (
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={styles.webDateInput} />
              ) : (
                <View>
                  <TouchableOpacity activeOpacity={0.8} style={styles.mobileDateBtn} onPress={() => setShowPicker(true)}>
                    <Text style={styles.mobileDateText}>
                      {new Date(selectedDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#10B981" />
                  </TouchableOpacity>
                  {showPicker && DateTimePicker && (
                    <DateTimePicker
                      value={new Date(selectedDate)}
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      onChange={onDateChange}
                      maximumDate={new Date()}
                    />
                  )}
                </View>
              )}
            </View>
            <SectionList
              sections={getGroupedPreviousOrders()}
              keyExtractor={(item) => item.id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
              contentContainerStyle={{ padding: 12 }}
              stickySectionHeadersEnabled={false}
              renderSectionHeader={({ section: { title } }) => <Text style={styles.sectionHeader}>{title}</Text>}
              renderItem={isChefMode ? renderOrderItemChef : renderOrderItemOld}
              ListEmptyComponent={
                <View style={{ alignItems: "center", marginTop: 60 }}>
                  <Ionicons name="archive-outline" size={48} color="#D1D5DB" />
                  <Text style={{ color: "#888", marginTop: 12, fontSize: 16, fontWeight: "500" }}>
                    {isOffline ? '📡 Offline - No cached data for this date' : 'No archived orders for this date'}
                  </Text>
                </View>
              }
            />
          </>
        ) : (
          <FlatList
            key={numColumns}
            numColumns={numColumns}
            data={getFilteredData()}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
            contentContainerStyle={{ padding: 12, alignSelf: isWeb ? "center" : "stretch", width: isWeb ? "100%" : "auto" }}
            ListEmptyComponent={
              <View style={{ alignItems: "center", marginTop: 60 }}>
                <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
                <Text style={{ color: "#888", marginTop: 12, fontSize: 16, fontWeight: "500" }}>
                  {isOffline ? '📡 Offline - No cached orders' : 'No orders found for today'}
                </Text>
                {isOffline && (
                  <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>
                    Connect to internet to sync orders
                  </Text>
                )}
              </View>
            }
            renderItem={isChefMode ? renderOrderItemChef : renderOrderItemOld}
          />
        )}
      </View>

      {/* Discount Modal */}
      <DiscountModal
        visible={showDiscountModal}
        onClose={() => {
          setShowDiscountModal(false);
          setSelectedOrderForDiscount(null);
        }}
        discountType={discountType}
        setDiscountType={setDiscountType}
        discountValue={discountValue}
        setDiscountValue={setDiscountValue}
        onApply={applyDiscount}
        modalSubtotal={modalSubtotal}
        modalDiscountAmount={modalDiscountAmount}
      />
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ─── NORMAL MODE STYLES (old) ────────────────────────────────────
  orderCardOld: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E8E2D9",
    ...Platform.select({
      web: { flex: 1, margin: 8, minWidth: 300, shadowColor: "#A89880", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12 },
      default: { elevation: 2 },
    }),
  },
  badgeOld: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  totalRowOld: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  actionBtnOld: { flex: 1, borderRadius: 12, padding: 14, alignItems: "center" },
  actionBtnTextOld: { color: "#fff", fontWeight: "800", fontSize: 15, textAlign: "center" },

  // ─── CHEF MODE STYLES ─────────────────────────────────────────────
  chefBadge: { flexDirection: "row", alignItems: "center", borderRadius: 12, gap: 4 },
  chefBadgeLabel: { fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },

  chefOrderCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E8E2D9",
    ...Platform.select({
      web: { flex: 1, margin: 8, minWidth: 280, boxShadow: "0 4px 14px rgba(168,152,128,0.07)" },
      default: { elevation: 2 },
    }),
  },
  chefCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  chefTableRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  chefTableIconWrap: { width: 28, height: 28, borderRadius: 8, backgroundColor: "#F9FAFB", alignItems: "center", justifyContent: "center" },
  chefTableNumber: { fontSize: 19, fontWeight: "900", color: "#111" },
  chefItemsContainer: { marginBottom: 8 },
  chefItemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 5 },
  chefItemRowDivider: { borderBottomWidth: 1, borderBottomColor: "#F9FAFB" },
  chefItemName: { fontSize: 15, fontWeight: "500", color: "#374151", flex: 1, paddingRight: 8 },
  chefItemMeta: { flexDirection: "row", gap: 12 },
  chefItemQty: { fontSize: 14, color: "#6B7280", fontWeight: "600" },
  chefItemPrice: { fontSize: 14, fontWeight: "700", color: "#111" },
  chefInstructions: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#FEF3C7", padding: 10, borderRadius: 10, marginTop: 8, gap: 6 },
  chefInstructionsText: { fontSize: 13, color: "#92400E", fontWeight: "600", flex: 1 },
  chefCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  chefTimestampRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  chefTimestamp: { fontSize: 12, color: "#9CA3AF", fontWeight: "500" },
  chefTotalRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  chefTotalLabel: { fontSize: 14, fontWeight: "600", color: "#6B7280" },
  chefTotalValue: { fontSize: 16, fontWeight: "800", color: "#111" },
  chefActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  chefActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, gap: 5 },
  chefActionText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  chefAcceptBtn: { backgroundColor: "#10B981" },
  chefRejectBtn: { backgroundColor: "#EF4444" },
  chefCompleteBtn: { backgroundColor: "#F59E0B" },
  chefActiveBtn: { backgroundColor: "#8B5CF6" },
  chefPrintBtn: { backgroundColor: "#111827" },
  chefWaitingBadge: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#F3F4F6", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, gap: 8 },
  chefWaitingText: { color: "#6B7280", fontWeight: "600", fontSize: 13 },

  // ─── SHARED / GENERAL ─────────────────────────────────────────────
  filterTab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: "#E8E2D9", backgroundColor: "#fff" },
  filterTabActive: { backgroundColor: "#111827", borderColor: "#111827" },
  filterTabText: { fontSize: 13, fontWeight: "700", color: "#4B5563" },

  sectionHeader: { fontSize: 14, fontWeight: "800", color: "#6B7280", paddingVertical: 8, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 },

  datePickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8E2D9",
  },
  dateInfo: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateLabel: { fontSize: 14, fontWeight: "700", color: "#111827" },
  webDateInput: { padding: 8, borderRadius: 8, border: "1px solid #E8E2D9", fontFamily: "inherit", fontSize: "14px", outlineStyle: "none", cursor: "pointer", backgroundColor: "#FAF8F5" },
  mobileDateBtn: { backgroundColor: "#FAF8F5", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: "#E8E2D9", flexDirection: "row", alignItems: "center", gap: 6 },
  mobileDateText: { fontSize: 14, fontWeight: "700", color: "#111827" },

  // ─── DISCOUNT MODAL ──────────────────────────────────────────────
  discountModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  discountModal: { backgroundColor: "#fff", borderRadius: 22, padding: 22, width: "100%", maxWidth: 380 },
  discountModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  discountModalTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  discountSegment: { flexDirection: "row", backgroundColor: "#F3F4F6", borderRadius: 12, padding: 4, gap: 4, marginBottom: 16 },
  segmentBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 9, borderRadius: 9 },
  segmentBtnActive: { backgroundColor: "#111827" },
  segmentText: { fontSize: 12, fontWeight: "700", color: "#6B7280" },
  segmentTextActive: { color: "#fff" },
  discountInputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 14, marginBottom: 10 },
  discountPrefix: { fontSize: 18, fontWeight: "800", color: "#9CA3AF", marginRight: 8 },
  discountInputField: { flex: 1, fontSize: 20, fontWeight: "700", paddingVertical: 12, color: "#111827" },
  presetRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  presetChip: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: "#ECFDF5", alignItems: "center" },
  presetChipText: { fontSize: 13, fontWeight: "700", color: "#10B981" },
  previewBox: { backgroundColor: "#FAF8F5", borderRadius: 14, padding: 14, marginBottom: 18, marginTop: 4 },
  previewRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  previewLabel: { fontSize: 13, color: "#6B7280", fontWeight: "600" },
  previewValue: { fontSize: 13, color: "#111827", fontWeight: "700" },
  previewTotalLabel: { fontSize: 15, color: "#111827", fontWeight: "800" },
  previewTotalValue: { fontSize: 18, color: "#111827", fontWeight: "900" },
  discountModalButtons: { flexDirection: "row", gap: 10 },
  discountModalBtn: { flex: 1, flexDirection: "row", paddingVertical: 13, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 6 },
  discountModalBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});