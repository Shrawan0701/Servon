import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text as NativeText,
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
import LocalizedText, { localizeText } from "../components/LocalizedText";
import { useLocale } from "../context/LocaleContext";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getOrders, updateOrderStatus, getProfile, getTables } from "../api";
import { localizedItemName } from "../utils/localizedItemName";
import * as Print from "expo-print";
import { useAuth } from "../context/AuthContext";

// ===== OFFLINE SERVICES =====
import localDB from "../services/LocalDB";
import networkMonitor from "../services/NetworkMonitor";
import syncManager from "../services/SyncManager";

// ─── CONSTANTS ──────────────────────────────────────────────────────────

const LOCAL_UPDATE_TRUST_WINDOW_MS = 20000;

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

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "CONFIRMED", label: "CONFIRMED" },
  { key: "PREPARING", label: "PREPARING" },
  { key: "SERVED", label: "SERVED" },
  { key: "TABLE_ACTIVE", label: "TABLE ACTIVE" },
  { key: "PAID", label: "PAID" },
  { key: "REJECTED", label: "REJECTED" },
  { key: "PREVIOUS", label: "PREVIOUS" },
];

const CHEF_STATUSES = {
  EDITABLE: {
    label: "EDITABLE",
    color: "#6B7280",
    bg: "#F3F4F6",
    icon: "time-outline",
    priority: 4,
  },
  CONFIRMED: {
    label: "CONFIRMED",
    color: "#3B82F6",
    bg: "#EFF6FF",
    icon: "checkmark-circle-outline",
    priority: 3,
  },
  PREPARING: {
    label: "PREPARING",
    color: "#F59E0B",
    bg: "#FFFBEB",
    icon: "flame-outline",
    priority: 2,
  },
  SERVED: {
    label: "SERVED",
    color: "#10B981",
    bg: "#ECFDF5",
    icon: "checkmark-done-outline",
    priority: 1,
  },
  TABLE_ACTIVE: {
    label: "TABLE ACTIVE",
    color: "#8B5CF6",
    bg: "#F5F3FF",
    icon: "people-outline",
    priority: 0,
  },
  PAID: {
    label: "PAID",
    color: "#9CA3AF",
    bg: "#F1F5F9",
    icon: "cash-outline",
    priority: -1,
  },
  REJECTED: {
    label: "REJECTED",
    color: "#EF4444",
    bg: "#FEF2F2",
    icon: "close-circle-outline",
    priority: -1,
  },
};

const getChefStatusConfig = (status) => CHEF_STATUSES[status] || CHEF_STATUSES.EDITABLE;
const CHEF_PRIORITY_ORDER = ["EDITABLE", "CONFIRMED", "PREPARING", "SERVED", "TABLE_ACTIVE"];
const isLiveOrderStatus = (status) => ["CONFIRMED", "PREPARING", "SERVED", "TABLE_ACTIVE"].includes(status);

const CHEF_FILTERS = [
  { key: "all", label: "All" },
  { key: "CONFIRMED", label: "CONFIRMED" },
  { key: "PREPARING", label: "PREPARING" },
  { key: "SERVED", label: "SERVED" },
  { key: "TABLE_ACTIVE", label: "TABLE ACTIVE" },
  { key: "PAID", label: "PAID" },
  { key: "REJECTED", label: "REJECTED" },
];

// ─── CHEF‑MODE SUB‑COMPONENTS ─────────────────────────────────────────

const ChefStatusBadge = React.memo(({ status, size = "medium" }) => {
  const config = getChefStatusConfig(status);
  const fontSize = size === "small" ? 10 : 12;
  const padding = size === "small" ? 4 : 8;
  const label = status.replace("_", " ");

  return (
    <View style={[styles.chefBadge, { backgroundColor: config.bg, paddingHorizontal: padding, paddingVertical: padding }]}>
      <Ionicons name={config.icon} size={fontSize + 2} color={config.color} />
      <LocalizedText style={[styles.chefBadgeLabel, { color: config.color, fontSize }]}>{label}</LocalizedText>
    </View>
  );
});

const ChefOrderCard = React.memo((props) => {
  const { language } = useLocale();
  const {
    order,
    onAccept,
    onReject,
    onComplete,
    onSetTableActive,
    onPrint,
    onReprint,
    onDeleteConfirmed,
    isProcessing,
    timeLeft,
    isChefMode,
  } = props;

  const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || "[]");
  const isEditable = order.status === "EDITABLE";
  const isPreparing = order.status === "PREPARING";
  const isServed = order.status === "SERVED";
  const isTableActive = order.status === "TABLE_ACTIVE";
  const isStaffOrder = order.order_source === "staff";
  const canDeleteConfirmed = order.status === "CONFIRMED";
  const showDirectBillingActions =
    order.status === "CONFIRMED" || (isStaffOrder && !["EDITABLE", "REJECTED", "PAID"].includes(order.status));

  const isToday = (date) => {
    const today = new Date();
    const d = new Date(date);
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const canReprint = !isChefMode && isToday(order.created_at) && ["SERVED", "TABLE_ACTIVE", "PAID"].includes(order.status);

  return (
    <View style={styles.chefOrderCard}>
      <View style={styles.chefCardHeader}>
        <View style={styles.chefTableRow}>
          <View style={styles.chefTableIconWrap}>
            <Ionicons name="restaurant-outline" size={18} color="#111" />
          </View>
          <LocalizedText style={styles.chefTableNumber}>Table {order.table_number}</LocalizedText>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {canDeleteConfirmed && (
            <TouchableOpacity
              activeOpacity={0.75}
              style={[styles.chefReprintBtn, { backgroundColor: "#FEF2F2" }]}
              onPress={() => onDeleteConfirmed(order)}
              disabled={isProcessing}
            >
              <Ionicons name="trash-outline" size={15} color="#EF4444" />
            </TouchableOpacity>
          )}
          {canReprint && (
            <TouchableOpacity
              activeOpacity={0.75}
              style={styles.chefReprintBtn}
              onPress={() => onReprint(order)}
              disabled={isProcessing}
            >
              <Ionicons name="print-outline" size={15} color="#6B7280" />
            </TouchableOpacity>
          )}
          <ChefStatusBadge status={order.status} />
        </View>
      </View>

      <View style={styles.chefItemsContainer}>
        {items.map((item, idx) => (
          <View key={idx} style={[styles.chefItemRow, idx !== items.length - 1 && styles.chefItemRowDivider]}>
            <LocalizedText style={styles.chefItemName} numberOfLines={2}>
              • {localizedItemName(item, language)}
            </LocalizedText>
            <View style={styles.chefItemMeta}>
              <LocalizedText style={styles.chefItemQty}>×{item.quantity}</LocalizedText>
              <LocalizedText style={styles.chefItemPrice}>₹{(item.price * item.quantity).toFixed(0)}</LocalizedText>
            </View>
          </View>
        ))}
      </View>

      {order.special_instructions && (
        <View style={styles.chefInstructions}>
          <Ionicons name="chatbubble-outline" size={14} color="#92400E" />
          <LocalizedText style={styles.chefInstructionsText}>{order.special_instructions}</LocalizedText>
        </View>
      )}

      <View style={styles.chefCardFooter}>
        <View style={styles.chefTimestampRow}>
          <Ionicons name="time-outline" size={12} color="#9CA3AF" />
          <LocalizedText style={styles.chefTimestamp}>
            {new Date(order.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </LocalizedText>
        </View>
        <View style={styles.chefTotalRow}>
          <LocalizedText translate style={styles.chefTotalLabel}>Total:</LocalizedText>
          <LocalizedText style={styles.chefTotalValue}>₹{Math.round(parseFloat(order.total_amount))}</LocalizedText>
        </View>
      </View>

      {isToday(order.created_at) && (
        <View style={styles.chefActions}>
          {showDirectBillingActions ? (
            <>
              {!isTableActive && (
                <TouchableOpacity
                  activeOpacity={0.75}
                  style={[styles.chefActionBtn, styles.chefActiveBtn, { flex: 1 }]}
                  onPress={() => onSetTableActive(order.id)}
                >
                  <Ionicons name="people" size={18} color="#fff" />
                  <LocalizedText translate style={styles.chefActionText}>Active Table</LocalizedText>
                </TouchableOpacity>
              )}
              {!isChefMode && (
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
                      <LocalizedText translate style={styles.chefActionText}>{isTableActive ? "Bill" : "Print"}</LocalizedText>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              {isEditable &&
                (timeLeft > 0 ? (
                  <View style={styles.chefWaitingBadge}>
                    <ActivityIndicator size="small" color="#9CA3AF" />
                    <LocalizedText style={styles.chefWaitingText}>Editing ({timeLeft}s)</LocalizedText>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      style={[styles.chefActionBtn, styles.chefAcceptBtn]}
                      onPress={() => onAccept(order.id)}
                    >
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <LocalizedText translate style={styles.chefActionText}>Accept</LocalizedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      style={[styles.chefActionBtn, styles.chefRejectBtn]}
                      onPress={() => onReject(order.id)}
                    >
                      <Ionicons name="close" size={18} color="#fff" />
                      <LocalizedText translate style={styles.chefActionText}>Reject</LocalizedText>
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
                  <LocalizedText translate style={styles.chefActionText}>Serve</LocalizedText>
                </TouchableOpacity>
              )}
              {isServed && (
                <TouchableOpacity
                  activeOpacity={0.75}
                  style={[styles.chefActionBtn, styles.chefActiveBtn, { flex: 1 }]}
                  onPress={() => onComplete(order.id)}
                >
                  <Ionicons name="people" size={18} color="#fff" />
                  <LocalizedText translate style={styles.chefActionText}>Active Table</LocalizedText>
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
                      <LocalizedText translate style={styles.chefActionText}>Bill</LocalizedText>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </>
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
        <LocalizedText translate style={gateStyles.title}>Unlock Full Business Suite</LocalizedText>
        <LocalizedText translate style={gateStyles.subtitle}>Take control of your restaurant with Servon's powerful order management tools.</LocalizedText>
        <View style={gateStyles.benefitsList}>
          {benefits.map((item, index) => (
            <View key={index} style={gateStyles.benefitItem}>
              <Ionicons name={item.icon} size={18} color="#10B981" />
              <LocalizedText style={gateStyles.benefitText}>{item.text}</LocalizedText>
            </View>
          ))}
        </View>
        <TouchableOpacity style={gateStyles.btn} onPress={() => navigation.navigate("Profile")} activeOpacity={0.85}>
          <LocalizedText translate style={gateStyles.btnText}>Upgrade to Premium</LocalizedText>
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
            <LocalizedText translate style={styles.discountModalTitle}>Apply Discount</LocalizedText>
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
                <LocalizedText style={[styles.segmentText, discountType === item.key && styles.segmentTextActive]}>{item.label}</LocalizedText>
              </TouchableOpacity>
            ))}
          </View>
          {discountType !== "none" && (
            <>
              <View style={styles.discountInputWrap}>
                <LocalizedText style={styles.discountPrefix}>{discountType === "percentage" ? "%" : "₹"}</LocalizedText>
                <TextInput style={styles.discountInputField} placeholder="0" keyboardType="numeric" value={discountValue} onChangeText={setDiscountValue} autoFocus />
              </View>
              {discountType === "percentage" && (
                <View style={styles.presetRow}>
                  {[5, 10, 15, 20].map((p) => (
                    <TouchableOpacity key={p} activeOpacity={0.7} style={styles.presetChip} onPress={() => setDiscountValue(String(p))}>
                      <LocalizedText style={styles.presetChipText}>{p}%</LocalizedText>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
          <View style={styles.previewBox}>
            <View style={styles.previewRow}>
              <LocalizedText translate style={styles.previewLabel}>Subtotal</LocalizedText>
              <LocalizedText style={styles.previewValue}>₹{Math.round(modalSubtotal)}</LocalizedText>
            </View>
            {modalDiscountAmount > 0 && (
              <View style={styles.previewRow}>
                <LocalizedText translate style={[styles.previewLabel, { color: "#EF4444" }]}>Discount</LocalizedText>
                <LocalizedText style={[styles.previewValue, { color: "#EF4444" }]}>-₹{Math.round(modalDiscountAmount)}</LocalizedText>
              </View>
            )}
            <View style={[styles.previewRow, { borderTopWidth: 1, borderTopColor: "#E5E7EB", paddingTop: 8, marginTop: 4 }]}>
              <LocalizedText translate style={styles.previewTotalLabel}>Payable</LocalizedText>
              <LocalizedText style={styles.previewTotalValue}>₹{Math.round(modalSubtotal - modalDiscountAmount)}</LocalizedText>
            </View>
          </View>
          <View style={styles.discountModalButtons}>
            <TouchableOpacity activeOpacity={0.8} style={[styles.discountModalBtn, { backgroundColor: "#F3F4F6" }]} onPress={onClose}>
              <LocalizedText translate style={[styles.discountModalBtnText, { color: "#374151" }]}>Cancel</LocalizedText>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8} style={[styles.discountModalBtn, { backgroundColor: "#111827" }]} onPress={onApply}>
              <Ionicons name="print-outline" size={16} color="#fff" />
              <LocalizedText translate style={styles.discountModalBtnText}>Apply & Print</LocalizedText>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ─── MAIN SCREEN ──────────────────────────────────────────────────────
export default function OrdersScreen() {
  const { language } = useLocale();
  const { isChefMode, isPremium, loading: authLoading } = useAuth();

  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [profile, setProfile] = useState(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingTable, setProcessingTable] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [numColumns, setNumColumns] = useState(Platform.OS === "web" ? 3 : 1);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get("window").width);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedTableKey, setSelectedTableKey] = useState(null);
  const [showPicker, setShowPicker] = useState(false);

  // ─── PRINT LOCK STATE ──────────────────────────────────────────────
  const [isPrinting, setIsPrinting] = useState(false);

  const [isOffline, setIsOffline] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [selectedOrderForDiscount, setSelectedOrderForDiscount] = useState(null);
  const [discountType, setDiscountType] = useState("none");
  const [discountValue, setDiscountValue] = useState("");

  const localUpdateTimestamps = useRef({});

  const isWeb = Platform.OS === "web";
  let DateTimePicker;
  if (!isWeb) {
    DateTimePicker = require("@react-native-community/datetimepicker").default;
  }

  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe((online) => {
      setIsOffline(!online);
      if (online) {
        loadData();
        syncManager.startSync();
      }
    });
    return () => unsubscribe();
  }, []);

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
        setScreenWidth(width);
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

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

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

      const isOnline = await networkMonitor.checkConnectivity();

      if (isOnline) {
        const [ordersRes, profileRes, tablesRes] = await Promise.all([
          getOrders(),
          getProfile(),
          getTables()
        ]);

        const freshOrders = ordersRes.data || [];
        const now = Date.now();

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

        await localDB.saveOrders(freshOrders);
        setProfile(profileRes.data);
        setTables(Array.isArray(tablesRes.data) ? tablesRes.data : []);
        setIsOffline(false);
      } else {
        setIsOffline(true);
        if (!localOrders || localOrders.length === 0) {
          const fallbackOrders = await localDB.getOrders();
          if (fallbackOrders && fallbackOrders.length > 0) {
            setOrders(fallbackOrders);
          }
        }
      }
    } catch (err) {
      console.error("Data load error:", err);
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

  const isToday = (date) => {
    const today = new Date();
    const d = new Date(date);
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const getOrderTableKey = useCallback((order) => {
    if (order?.table_id) return `id:${order.table_id}`;
    return `number:${order?.table_number || "Unknown"}`;
  }, []);

  const getTableKey = useCallback((table) => {
    if (table?.id) return `id:${table.id}`;
    return `number:${table?.table_number || "Unknown"}`;
  }, []);

  const handleStatusUpdate = useCallback(async (orderId, status) => {
    try {
      await localDB.updateOrderStatus(orderId, status);

      localUpdateTimestamps.current[orderId] = Date.now();
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));

      const isOnline = await networkMonitor.checkConnectivity();
      if (isOnline) {
        try {
          await updateOrderStatus(orderId, status);
          await localDB.markAsSynced(orderId);
        } catch (apiError) {
          console.log('Server update failed, will sync later:', apiError);
        }
      }

      const count = await localDB.getPendingActionsCount();
      setPendingSyncCount(count);

    } catch (err) {
      console.error("Update error:", err);
      Alert.alert('Error', 'Failed to update order status. Will retry when online.');
    }
  }, []);

  const confirmDeleteOrder = useCallback(
    (order) => {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const shouldDelete = window.confirm(
          `${localizeText("Delete order?", language)}\n${localizeText("This confirmed order will be cancelled.", language)}`
        );
        if (shouldDelete) {
          handleStatusUpdate(order.id, "REJECTED");
        }
        return;
      }

      Alert.alert(
        localizeText("Delete order?", language),
        localizeText("This confirmed order will be cancelled.", language),
        [
          { text: localizeText("Cancel", language), style: "cancel" },
          {
            text: localizeText("Delete", language),
            style: "destructive",
            onPress: () => handleStatusUpdate(order.id, "REJECTED"),
          },
        ]
      );
    },
    [handleStatusUpdate, language]
  );

  // ─── BUILD BILL HTML WITH UPI QR ──────────────────────────────────
  // Redesigned as a clean, monochrome thermal-receipt style layout —
  // no emoji, no green accents, dashed rules and a bordered total box.
  const buildBillHtml = useCallback(
    (tableOrders, discount) => {
      let combinedSubtotal = 0;
      const combinedItems = {};

      tableOrders.forEach((o) => {
        const items = Array.isArray(o.items) ? o.items : JSON.parse(o.items || "[]");
        items.forEach((item) => {
          const itemPrice = parseFloat(item.price || 0);
          const itemQty = parseInt(item.quantity || 1, 10);
          combinedSubtotal += itemPrice * itemQty;

          if (combinedItems[item.name]) {
            combinedItems[item.name].quantity += itemQty;
          } else {
            combinedItems[item.name] = { ...item, price: itemPrice, quantity: itemQty };
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

// Round grand total cleanly to exact integer or 2 decimal places
const grandTotal = Math.round(
  amountAfterDiscount + cgstAmount + sgstAmount
);

let itemsHtml = "";
finalItemsList.forEach((i) => {
  itemsHtml += `
    <tr>
      <td style="padding: 4px 0;">${localizedItemName(i, language)}</td>
      <td class="center-col">${i.quantity}</td>
      <td class="right">₹${(i.price * i.quantity).toFixed(2)}</td>
    </tr>
  `;
});

const discountHtml =
  discountAmount > 0
    ? `<tr><td>Discount (${discount.type === "percentage" ? discount.value + "%" : "Flat"})</td><td class="right">-₹${discountAmount.toFixed(2)}</td></tr>`
    : "";

// ─── UPI PAYMENT QR ──────────────────────────────────────────
const upiId = profile?.upi_id || "";
const merchantName = encodeURIComponent(
  profile?.business_name || "Restaurant"
);
const amount = grandTotal.toFixed(2);

const upiString = upiId
  ? `upi://pay?pa=${upiId}&pn=${merchantName}&am=${amount}&cu=INR&tn=Payment`
  : "";

const qrCodeUrl = upiId
  ? `https://quickchart.io/qr?text=${encodeURIComponent(upiString)}&size=200&margin=2`
  : null;

const qrCodeUrlFallback = upiId
  ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiString)}`
  : null;

return `
  <html>
    <head>
      <style>
        body {
          font-family: monospace;
          width: 80mm;
          padding: 10px;
          color: #000;
          margin: 0 auto;
        }

        h2 {
          text-align: center;
          margin: 0 0 5px 0;
          font-size: 24px;
        }

        .center {
          text-align: center;
          font-size: 14px;
          margin-bottom: 5px;
        }

        .divider {
          border-bottom: 1px dashed #000;
          margin: 10px 0;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .right {
          text-align: right;
        }

        .bold {
          font-weight: bold;
        }

        .upi-section {
          text-align: center;
          margin-top: 15px;
          padding: 15px;
          border-top: 2px dashed #000;
        }

        .upi-title {
          font-size: 16px;
          font-weight: 800;
          color: #000;
          margin-bottom: 4px;
        }

        .upi-amount {
          font-size: 20px;
          font-weight: 900;
          color: #000;
          margin-bottom: 10px;
        }

        .upi-qr-wrapper {
          display: flex;
          justify-content: center;
          margin: 8px 0;
        }

        .upi-qr-wrapper img {
          width: 150px;
          height: 150px;
          border: 2px solid #000;
          border-radius: 12px;
        }

        .upi-id {
          font-size: 13px;
          color: #333;
          margin-top: 8px;
          font-weight: 600;
        }

        .upi-instruction {
          font-size: 10px;
          color: #666;
          margin-top: 4px;
        }

        .upi-error {
          font-size: 12px;
          color: #000;
          padding: 10px;
          background: #F8F8F8;
          border-radius: 8px;
          border: 1px solid #ccc;
        }

        .thank-you {
          text-align: center;
          font-weight: bold;
          font-size: 16px;
          margin-top: 15px;
          color: #000;
        }
      </style>
    </head>

    <body>
      <h2>${profile?.business_name || "Restaurant"}</h2>

      ${
        profile?.gst_number
          ? `<div class="center">GSTIN: ${profile.gst_number}</div>`
          : ""
      }

      <div class="center">
        Table: ${tableOrders[0]?.table_number}
      </div>

      <div class="center">
        Date: ${new Date().toLocaleString("en-IN")}
      </div>

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
        <tr>
          <td>Subtotal:</td>
          <td class="right">₹${combinedSubtotal.toFixed(2)}</td>
        </tr>

        ${discountHtml}

        ${
          discountAmount > 0
            ? `<tr>
                <td>After Discount:</td>
                <td class="right">₹${amountAfterDiscount.toFixed(2)}</td>
              </tr>`
            : ""
        }

        ${
          cgstPercent > 0
            ? `<tr>
                <td>CGST (${cgstPercent}%):</td>
                <td class="right">₹${cgstAmount.toFixed(2)}</td>
              </tr>`
            : ""
        }

        ${
          sgstPercent > 0
            ? `<tr>
                <td>SGST (${sgstPercent}%):</td>
                <td class="right">₹${sgstAmount.toFixed(2)}</td>
              </tr>`
            : ""
        }

        <tr class="bold">
          <td style="font-size: 18px; padding-top: 10px;">
            GRAND TOTAL:
          </td>

          <td
            class="right"
            style="font-size: 18px; padding-top: 10px;"
          >
            ₹${grandTotal.toFixed(2)}
          </td>
        </tr>
      </table>

      <div class="divider"></div>

      <!-- ─── UPI PAYMENT QR ─── -->
      <div class="upi-section">
        <div class="upi-title">PAY BILL</div>

        <div class="upi-amount">
          ₹${grandTotal.toFixed(2)}
        </div>

        ${
          upiId
            ? `
              <div class="upi-qr-wrapper">
                <img
                  src="${qrCodeUrl}"
                  alt="UPI Payment QR"
                  onerror="this.src='${qrCodeUrlFallback}';"
                />
              </div>

              <div class="upi-id">
                UPI ID: ${upiId}
              </div>

              <div class="upi-instruction">
                Scan using Google Pay, PhonePe, Paytm, or any UPI app
              </div>
            `
            : `
              <div class="upi-error">
                UPI ID not configured. Please contact restaurant.
              </div>
            `
        }
      </div>

      <div class="thank-you">
        Thank You for Visiting!
      </div>
    </body>
  </html>
`;
 },
    [language, profile]
  );
  // ─── PRINT HTML ──────────────────────────────────────────────────
  const printHtml = useCallback(async (htmlContent) => {
    // Prevent multiple print requests
    if (isPrinting) {
      console.log('⏳ Print already in progress, skipping...');
      return;
    }

    if (Platform.OS === "web") {
      // Remove any existing print iframe
      const existingIframe = document.getElementById('servon-print-iframe');
      if (existingIframe) {
        document.body.removeChild(existingIframe);
      }

      const iframe = document.createElement("iframe");
      iframe.id = 'servon-print-iframe';
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
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 3000);

    } else {
      await Print.printAsync({ html: htmlContent });
    }
  }, [isPrinting]);

  // ─── HANDLE PRINT AND CHECKOUT ──────────────────────────────────
  const handlePrintAndCheckout = useCallback(
    async (currentOrder, discount) => {
      // Prevent multiple print requests
      if (isPrinting) {
        console.log('⏳ Print already in progress, skipping...');
        return;
      }

      setProcessingTable(currentOrder.table_number);
      setIsPrinting(true);

      try {
        const tableOrders = orders.filter(
          (o) =>
            o.table_number === currentOrder.table_number &&
            o.status !== "PAID" &&
            o.status !== "REJECTED" &&
            isToday(o.created_at)
        );
        if (tableOrders.length === 0) {
          setIsPrinting(false);
          return;
        }

        const htmlContent = buildBillHtml(tableOrders, discount);

        const now = Date.now();
        await Promise.all(
          tableOrders.map(async (o) => {
            try {
              await localDB.updateOrderStatus(o.id, "PAID");
            } catch (dbErr) {
              console.log("Local DB PAID update error:", dbErr);
            }
          })
        );
        tableOrders.forEach((o) => {
          localUpdateTimestamps.current[o.id] = now;
        });
        setOrders((prev) =>
          prev.map((o) => (tableOrders.some((to) => to.id === o.id) ? { ...o, status: "PAID" } : o))
        );

        const isOnline = await networkMonitor.checkConnectivity();
        if (isOnline) {
          await Promise.all(
            tableOrders.map(async (o) => {
              try {
                await updateOrderStatus(o.id, "PAID");
                await localDB.markAsSynced(o.id);
              } catch (apiError) {
                console.log("Server PAID update failed, will sync later:", apiError);
              }
            })
          );
        }
        const count = await localDB.getPendingActionsCount();
        setPendingSyncCount(count);

        await printHtml(htmlContent);

      } catch (err) {
        console.error("Print Error", err);
        Alert.alert(localizeText("Print Failed", language), localizeText("Could not print the bill.", language));
      } finally {
        setProcessingTable(null);
        setIsPrinting(false);
      }
    },
    [orders, buildBillHtml, printHtml, isPrinting]
  );

  // ─── HANDLE REPRINT ──────────────────────────────────────────────
  const handleReprint = useCallback(
    async (currentOrder) => {
      // Prevent multiple print requests
      if (isPrinting) {
        console.log('⏳ Print already in progress, skipping reprint...');
        return;
      }

      setProcessingTable(currentOrder.table_number);
      setIsPrinting(true);

      try {
        if (!currentOrder) {
          setIsPrinting(false);
          return;
        }
        const htmlContent = buildBillHtml([currentOrder], { type: "none", value: 0 });
        await printHtml(htmlContent);
      } catch (err) {
        console.error("Reprint Error", err);
        Alert.alert(localizeText("Reprint Failed", language), localizeText("Could not reprint the bill.", language));
      } finally {
        setProcessingTable(null);
        setIsPrinting(false);
      }
    },
    [buildBillHtml, printHtml, isPrinting]
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
      Alert.alert(localizeText("Invalid", language), localizeText("Please enter a valid discount amount.", language));
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
      .filter((o) => o.table_number === selectedOrderForDiscount.table_number && o.status !== "PAID" && o.status !== "REJECTED" && isToday(o.created_at))
      .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
  }, [selectedOrderForDiscount, orders]);

  const modalDiscountAmount = useMemo(() => {
    if (!selectedOrderForDiscount) return 0;
    const value = parseFloat(discountValue) || 0;
    if (discountType === "percentage") return (modalSubtotal * value) / 100;
    if (discountType === "flat") return Math.min(value, modalSubtotal);
    return 0;
  }, [discountType, discountValue, modalSubtotal, selectedOrderForDiscount]);

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

  const renderOrderItemOld = ({ item }) => {
    const items = Array.isArray(item.items) ? item.items : JSON.parse(item.items || "[]");
    const isProcessing = processingTable === item.table_number;
    const orderTime = new Date(item.updated_at || item.created_at).getTime();
    const secondsPassed = Math.floor((currentTime - orderTime) / 1000);
    const timeLeft = Math.max(0, 60 - secondsPassed);
    const canReprint = !isChefMode && isToday(item.created_at) && ["SERVED", "TABLE_ACTIVE", "PAID"].includes(item.status);
    const isStaffOrder = item.order_source === "staff";
    const showDirectBillingActions =
      item.status === "CONFIRMED" || (isStaffOrder && !["EDITABLE", "REJECTED", "PAID"].includes(item.status));

    return (
      <View style={styles.orderCardOld}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <LocalizedText style={{ fontSize: 18, fontWeight: "800", color: "#111" }}>Table {item.table_number}</LocalizedText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {canReprint && (
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.reprintBtnOld}
                onPress={() => handleReprint(item)}
                disabled={isProcessing}
              >
                <Ionicons name="print-outline" size={13} color="#6B7280" />
                <LocalizedText translate style={styles.reprintBtnTextOld}>Reprint</LocalizedText>
              </TouchableOpacity>
            )}
            {item.status === "CONFIRMED" && (
              <TouchableOpacity
                activeOpacity={0.75}
                style={[styles.reprintBtnOld, { backgroundColor: "#FEF2F2" }]}
                onPress={() => confirmDeleteOrder(item)}
                disabled={isProcessing}
              >
                <Ionicons name="trash-outline" size={13} color="#EF4444" />
              </TouchableOpacity>
            )}
            <View style={[styles.badgeOld, { backgroundColor: statusColor(item.status) }]}>
              <LocalizedText style={{ color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.4 }}>{item.status.replace("_", " ")}</LocalizedText>
            </View>
          </View>
        </View>
        {items.map((i, idx) => (
          <LocalizedText key={idx} style={{ fontSize: 15, color: "#374151", marginBottom: 5, fontWeight: "500", lineHeight: 20 }}>
            • {localizedItemName(i, language)} × {i.quantity} - <LocalizedText style={{ fontWeight: "700" }}>₹{(i.price * i.quantity).toFixed(0)}</LocalizedText>
          </LocalizedText>
        ))}
        {item.special_instructions && (
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: "#FEF3C7", padding: 10, borderRadius: 10, marginTop: 8 }}>
            <Ionicons name="chatbubble-outline" size={13} color="#92400E" style={{ marginTop: 2 }} />
            <LocalizedText style={{ fontSize: 13, color: "#92400E", fontWeight: "600", flex: 1 }}>{item.special_instructions}</LocalizedText>
          </View>
        )}
        <View style={styles.totalRowOld}>
          <LocalizedText translate style={{ fontWeight: "600", fontSize: 14, color: "#6B7280" }}>Subtotal:</LocalizedText>
          <LocalizedText style={{ fontWeight: "800", fontSize: 18, color: "#111" }}>
            ₹{Math.round(parseFloat(item.total_amount))}
          </LocalizedText>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
          <Ionicons name="time-outline" size={12} color="#aaa" />
          <LocalizedText style={{ fontSize: 12, color: "#aaa" }}>
            Ordered at: {new Date(item.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </LocalizedText>
        </View>
        {isToday(item.created_at) && (
          <>
            {showDirectBillingActions ? (
              item.status === "TABLE_ACTIVE" ? (
                !isChefMode && (
                  <TouchableOpacity activeOpacity={0.8} style={[styles.actionBtnOld, { backgroundColor: isProcessing ? "#4B5563" : "#111827", marginTop: 16, flexDirection: "row", justifyContent: "center", gap: 8 }]} onPress={() => openDiscountModal(item)} disabled={isProcessing}>
                    {isProcessing ? (
                      <>
                        <ActivityIndicator color="#fff" size="small" />
                        <LocalizedText translate style={styles.actionBtnTextOld}>Generating Bill...</LocalizedText>
                      </>
                    ) : (
                      <>
                        <Ionicons name="print-outline" size={20} color="#fff" />
                        <LocalizedText translate style={styles.actionBtnTextOld}>Print Final Bill</LocalizedText>
                      </>
                    )}
                  </TouchableOpacity>
                )
              ) : (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                  <TouchableOpacity activeOpacity={0.8} style={[styles.actionBtnOld, { backgroundColor: "#8B5CF6" }]} onPress={() => handleStatusUpdate(item.id, "TABLE_ACTIVE")}>
                    <LocalizedText translate style={styles.actionBtnTextOld}>Active Table</LocalizedText>
                  </TouchableOpacity>
                  {!isChefMode && (
                    <TouchableOpacity activeOpacity={0.8} style={[styles.actionBtnOld, { backgroundColor: isProcessing ? "#4B5563" : "#111827" }]} onPress={() => openDiscountModal(item)} disabled={isProcessing}>
                      {isProcessing ? <ActivityIndicator color="#fff" size="small" /> : <LocalizedText translate style={styles.actionBtnTextOld}>Print</LocalizedText>}
                    </TouchableOpacity>
                  )}
                </View>
              )
            ) : (
              <>
                {(item.status === "EDITABLE" || item.status === "CONFIRMED") && (
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                {item.status === "EDITABLE" && timeLeft > 0 ? (
                  <View style={[styles.actionBtnOld, { backgroundColor: "#F3F4F6", flexDirection: "row", justifyContent: "center", gap: 8 }]}>
                    <ActivityIndicator size="small" color="#9CA3AF" />
                    <LocalizedText style={[styles.actionBtnTextOld, { color: "#6B7280" }]}>Reviewing ({timeLeft}s)...</LocalizedText>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.actionBtnOld, { backgroundColor: "#10B981" }]} onPress={() => handleStatusUpdate(item.id, "PREPARING")}>
                      <LocalizedText translate style={styles.actionBtnTextOld}>Accept</LocalizedText>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.actionBtnOld, { backgroundColor: "#EF4444", flex: 0.4 }]} onPress={() => handleStatusUpdate(item.id, "REJECTED")}>
                      <LocalizedText translate style={styles.actionBtnTextOld}>Reject</LocalizedText>
                    </TouchableOpacity>
                  </>
                )}
              </View>
                )}
                {item.status === "PREPARING" && (
              <TouchableOpacity activeOpacity={0.8} style={[styles.actionBtnOld, { backgroundColor: "#F59E0B", marginTop: 16 }]} onPress={() => handleStatusUpdate(item.id, "SERVED")}>
                <LocalizedText translate style={[styles.actionBtnTextOld, { color: "#fff" }]}>Mark Served</LocalizedText>
              </TouchableOpacity>
                )}
                {item.status === "SERVED" && (
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                <TouchableOpacity activeOpacity={0.8} style={[styles.actionBtnOld, { backgroundColor: "#8B5CF6" }]} onPress={() => handleStatusUpdate(item.id, "TABLE_ACTIVE")}>
                  <LocalizedText translate style={styles.actionBtnTextOld}>Active Table</LocalizedText>
                </TouchableOpacity>
                {!isChefMode && (
                  <TouchableOpacity activeOpacity={0.8} style={[styles.actionBtnOld, { backgroundColor: isProcessing ? "#4B5563" : "#111827" }]} onPress={() => openDiscountModal(item)} disabled={isProcessing}>
                    {isProcessing ? <ActivityIndicator color="#fff" size="small" /> : <LocalizedText translate style={styles.actionBtnTextOld}>Print</LocalizedText>}
                  </TouchableOpacity>
                )}
              </View>
                )}
                {item.status === "TABLE_ACTIVE" && !isChefMode && (
              <TouchableOpacity activeOpacity={0.8} style={[styles.actionBtnOld, { backgroundColor: isProcessing ? "#4B5563" : "#111827", marginTop: 16, flexDirection: "row", justifyContent: "center", gap: 8 }]} onPress={() => openDiscountModal(item)} disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" />
                    <LocalizedText translate style={styles.actionBtnTextOld}>Generating Bill...</LocalizedText>
                  </>
                ) : (
                  <>
                    <Ionicons name="print-outline" size={20} color="#fff" />
                    <LocalizedText translate style={styles.actionBtnTextOld}>Print Final Bill</LocalizedText>
                  </>
                )}
              </TouchableOpacity>
                )}
              </>
            )}
          </>
        )}
      </View>
    );
  };

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
          onSetTableActive={(id) => handleStatusUpdate(id, "TABLE_ACTIVE")}
          onPrint={openDiscountModal}
          onReprint={handleReprint}
          onDeleteConfirmed={confirmDeleteOrder}
          isProcessing={processingTable === item.table_number}
          timeLeft={timeLeft}
          isChefMode={isChefMode}
        />
      );
    },
    [currentTime, handleStatusUpdate, processingTable, isChefMode, openDiscountModal, handleReprint, confirmDeleteOrder]
  );

  const tableTabs = useMemo(() => {
    const tableMap = new Map();

    tables.forEach((table) => {
      const key = getTableKey(table);
      tableMap.set(key, {
        key,
        table_number: table.table_number,
        label: `Table ${table.table_number}`,
        totalToday: 0,
        filteredToday: 0,
      });
    });

    orders.filter((o) => isToday(o.created_at)).forEach((order) => {
      const key = getOrderTableKey(order);
      if (!tableMap.has(key)) {
        tableMap.set(key, {
          key,
          table_number: order.table_number || "Unknown",
          label: `Table ${order.table_number || "Unknown"}`,
          totalToday: 0,
          filteredToday: 0,
        });
      }

      const entry = tableMap.get(key);
      if (filter === "all") {
        if (!isLiveOrderStatus(order.status)) return;
        entry.totalToday += 1;
        entry.filteredToday += 1;
      } else {
        if (isLiveOrderStatus(order.status)) entry.totalToday += 1;
        if (order.status === filter) entry.filteredToday += 1;
      }
    });

    return Array.from(tableMap.values()).sort((a, b) => {
      const aNum = Number(a.table_number);
      const bNum = Number(b.table_number);
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
      return String(a.table_number).localeCompare(String(b.table_number));
    });
  }, [tables, orders, filter, getTableKey, getOrderTableKey]);

  useEffect(() => {
    if (filter === "PREVIOUS") return;
    if (!tableTabs.length) {
      if (selectedTableKey) setSelectedTableKey(null);
      return;
    }
    if (!selectedTableKey || !tableTabs.some((table) => table.key === selectedTableKey)) {
      setSelectedTableKey(tableTabs[0].key);
    }
  }, [tableTabs, selectedTableKey, filter]);

  const getStatusFilteredData = useCallback(() => {
    let result;
    if (filter === "all") {
      result = orders.filter((o) => isToday(o.created_at) && isLiveOrderStatus(o.status));
    } else if (filter === "PREVIOUS") {
      return [];
    } else {
      result = orders.filter((o) => o.status === filter && isToday(o.created_at));
    }
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

  const getFilteredData = useCallback(() => {
    const statusFiltered = getStatusFilteredData();
    if (!selectedTableKey) return statusFiltered;
    return statusFiltered.filter((order) => getOrderTableKey(order) === selectedTableKey);
  }, [getStatusFilteredData, selectedTableKey, getOrderTableKey]);

  const selectedTable = tableTabs.find((table) => table.key === selectedTableKey);
  const isCompactTableLayout = screenWidth < 720;
  const tableOrderColumns = isCompactTableLayout ? 1 : Math.min(numColumns, 2);

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FAF8F5" }}>
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
                <LocalizedText style={[styles.filterTabText, filter === item.key && { color: "#fff" }]}>{item.label}</LocalizedText>
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
                <LocalizedText style={[styles.filterTabText, filter === item.key && { color: "#fff" }]}>
                  {item.label.replace("_", " ")}
                </LocalizedText>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      <View style={[{ flex: 1 }, isWeb && { maxWidth: 1200, alignSelf: "center", width: "100%" }]}>
        {filter === "PREVIOUS" ? (
          <>
            <View style={styles.datePickerContainer}>
              <View style={styles.dateInfo}>
                <Ionicons name="calendar-outline" size={20} color="#10B981" />
                <LocalizedText translate style={styles.dateLabel}>Select History Date:</LocalizedText>
              </View>
              {Platform.OS === "web" ? (
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={styles.webDateInput} />
              ) : (
                <View>
                  <TouchableOpacity activeOpacity={0.8} style={styles.mobileDateBtn} onPress={() => setShowPicker(true)}>
                    <LocalizedText style={styles.mobileDateText}>
                      {new Date(selectedDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </LocalizedText>
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
              renderSectionHeader={({ section: { title } }) => <LocalizedText style={styles.sectionHeader}>{title}</LocalizedText>}
              renderItem={isChefMode ? renderOrderItemChef : renderOrderItemOld}
              ListEmptyComponent={
                <View style={{ alignItems: "center", marginTop: 60 }}>
                  <Ionicons name="archive-outline" size={48} color="#D1D5DB" />
                  <LocalizedText style={{ color: "#888", marginTop: 12, fontSize: 16, fontWeight: "500" }}>
                    {isOffline ? '📡 Offline - No cached data for this date' : 'No archived orders for this date'}
                  </LocalizedText>
                </View>
              }
            />
          </>
        ) : (
          <View style={[styles.tableOrderShell, isCompactTableLayout && styles.tableOrderShellMobile]}>
            <View style={[styles.tableSidebar, isCompactTableLayout && styles.tableSidebarMobile]}>
              <View style={styles.tableSidebarHeader}>
                <LocalizedText translate style={styles.tableSidebarTitle}>Tables</LocalizedText>
                <View style={styles.tableSidebarCount}>
                  <NativeText style={styles.tableSidebarCountText}>{tableTabs.length}</NativeText>
                </View>
              </View>
              <ScrollView horizontal={isCompactTableLayout} showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} contentContainerStyle={isCompactTableLayout ? styles.tableRailMobile : null}>
                {tableTabs.map((table) => {
                  const active = table.key === selectedTableKey;
                  return (
                    <TouchableOpacity key={table.key} activeOpacity={0.78} style={[styles.tableTab, active && styles.tableTabActive, isCompactTableLayout && styles.tableTabMobile]} onPress={() => setSelectedTableKey(table.key)}>
                      <View style={styles.tableTabTop}>
                        <LocalizedText style={[styles.tableTabLabel, active && styles.tableTabLabelActive]}>{table.label}</LocalizedText>
                        <View style={[styles.tableTabBadge, active && styles.tableTabBadgeActive]}>
                          <NativeText style={[styles.tableTabBadgeText, active && styles.tableTabBadgeTextActive]}>{table.filteredToday}</NativeText>
                        </View>
                      </View>
                      <LocalizedText translate style={[styles.tableTabMeta, active && styles.tableTabMetaActive]}>
                        {table.totalToday === 1 ? "1 order today" : `${table.totalToday} orders today`}
                      </LocalizedText>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={[styles.tableOrdersPane, isCompactTableLayout && styles.tableOrdersPaneMobile]}>
              <View style={[styles.tablePaneHeader, isCompactTableLayout && styles.tablePaneHeaderMobile]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <LocalizedText style={styles.tablePaneTitle}>{selectedTable?.label || "No tables"}</LocalizedText>
                  <LocalizedText translate style={styles.tablePaneSub}>
                    {selectedTable ? "Showing orders for selected table only" : "Create a table to view orders here"}
                  </LocalizedText>
                </View>
                <View style={styles.tablePaneMetric}>
                  <NativeText style={styles.tablePaneMetricValue}>{getFilteredData().length}</NativeText>
                  <LocalizedText translate style={styles.tablePaneMetricLabel}>Orders</LocalizedText>
                </View>
              </View>

              <FlatList
            key={`table-${tableOrderColumns}`}
            numColumns={tableOrderColumns}
            data={getFilteredData()}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
            contentContainerStyle={[styles.tableOrdersList, isCompactTableLayout && styles.tableOrdersListMobile]}
            ListEmptyComponent={
              <View style={{ alignItems: "center", marginTop: 60 }}>
                <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
                <LocalizedText style={{ color: "#888", marginTop: 12, fontSize: 16, fontWeight: "500" }}>
                  {isOffline ? '📡 Offline - No cached orders' : 'No orders found for today'}
                </LocalizedText>
                {isOffline && (
                  <LocalizedText translate style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>
                    Connect to internet to sync orders
                  </LocalizedText>
                )}
              </View>
            }
                renderItem={isChefMode ? renderOrderItemChef : renderOrderItemOld}
              />
            </View>
          </View>
        )}
      </View>

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
  reprintBtnOld: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#F3F4F6", borderRadius: 8,
    paddingHorizontal: 9, paddingVertical: 5,
  },
  reprintBtnTextOld: { fontSize: 11, fontWeight: "700", color: "#6B7280" },

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
  chefReprintBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center",
  },
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

  filterTab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: "#E8E2D9", backgroundColor: "#fff" },
  filterTabActive: { backgroundColor: "#111827", borderColor: "#111827" },
  filterTabText: { fontSize: 13, fontWeight: "700", color: "#4B5563" },

  tableOrderShell: { flex: 1, flexDirection: "row", gap: 14, paddingHorizontal: 12, paddingBottom: 12, minWidth: 0 },
  tableOrderShellMobile: { flexDirection: "column", gap: 10, paddingHorizontal: 10 },
  tableSidebar: {
    width: 230,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E8E2D9",
    padding: 12,
    ...Platform.select({ web: { boxShadow: "0 6px 18px rgba(17,24,39,0.05)" }, default: { elevation: 1 } }),
  },
  tableSidebarMobile: { width: "100%", maxHeight: 118, padding: 10, flexShrink: 0 },
  tableSidebarHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  tableSidebarTitle: { fontSize: 14, fontWeight: "900", color: "#111827", textTransform: "uppercase", letterSpacing: 0.6 },
  tableSidebarCount: { minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  tableSidebarCountText: { fontSize: 12, fontWeight: "900", color: "#111827" },
  tableRailMobile: { gap: 8, paddingRight: 4 },
  tableTab: { borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#FAFAFA", padding: 12, marginBottom: 8 },
  tableTabMobile: { width: 142, marginBottom: 0, padding: 10 },
  tableTabActive: { backgroundColor: "#111827", borderColor: "#111827" },
  tableTabTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  tableTabLabel: { color: "#111827", fontSize: 15, fontWeight: "900" },
  tableTabLabelActive: { color: "#fff" },
  tableTabBadge: { minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  tableTabBadgeActive: { backgroundColor: "#fff" },
  tableTabBadgeText: { color: "#4F46E5", fontSize: 12, fontWeight: "900" },
  tableTabBadgeTextActive: { color: "#111827" },
  tableTabMeta: { marginTop: 6, color: "#6B7280", fontSize: 12, fontWeight: "700" },
  tableTabMetaActive: { color: "#D1D5DB" },
  tableOrdersPane: { flex: 1, minWidth: 0 },
  tableOrdersPaneMobile: { width: "100%" },
  tablePaneHeader: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E8E2D9",
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tablePaneHeaderMobile: { padding: 12, marginBottom: 8 },
  tablePaneTitle: { color: "#111827", fontSize: 22, fontWeight: "900" },
  tablePaneSub: { color: "#6B7280", fontSize: 13, fontWeight: "600", marginTop: 3 },
  tablePaneMetric: { minWidth: 72, borderRadius: 14, backgroundColor: "#ECFDF5", paddingVertical: 8, paddingHorizontal: 12, alignItems: "center" },
  tablePaneMetricValue: { color: "#047857", fontSize: 20, fontWeight: "900" },
  tablePaneMetricLabel: { color: "#047857", fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  tableOrdersList: { paddingBottom: 24 },
  tableOrdersListMobile: { paddingBottom: 24, paddingHorizontal: 0 },
  tableEmptyState: { alignItems: "center", marginTop: 60, backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#E8E2D9", padding: 28 },
  tableEmptyTitle: { color: "#6B7280", marginTop: 12, fontSize: 16, fontWeight: "800", textAlign: "center" },
  tableEmptySub: { color: "#6B7280", fontSize: 12, marginTop: 4, textAlign: "center" },

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
