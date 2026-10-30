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
import { getOrders, updateOrderStatus, getProfile, getTables, saveCustomerOutstanding, removeOrderItem } from "../api";
import { localizedItemName } from "../utils/localizedItemName";
import * as Print from "expo-print";
import { useAuth } from "../context/AuthContext";

// ===== OFFLINE SERVICES =====
import localDB from "../services/LocalDB";
import networkMonitor from "../services/NetworkMonitor";
import syncManager from "../services/SyncManager";

// ─── CONSTANTS ──────────────────────────────────────────────────────────

const LOCAL_UPDATE_TRUST_WINDOW_MS = 20000;
const BILL_PRINT_TITLE = "Powered by Servon Labs";

const statusColor = (s) =>
  ({
    EDITABLE: "#6B7280",
    CONFIRMED: "#315F9E",
    PREPARING: "#8A5A15",
    SERVED: "#28704C",
    TABLE_ACTIVE: "#63738E",
    PAID: "#627166",
    REJECTED: "#AD4A40",
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
    color: "#315F9E",
    bg: "#EFF6FF",
    icon: "checkmark-circle-outline",
    priority: 3,
  },
  PREPARING: {
    label: "PREPARING",
    color: "#8A5A15",
    bg: "#FFFBEB",
    icon: "flame-outline",
    priority: 2,
  },
  SERVED: {
    label: "SERVED",
    color: "#28704C",
    bg: "#ECFDF5",
    icon: "checkmark-done-outline",
    priority: 1,
  },
  TABLE_ACTIVE: {
    label: "TABLE ACTIVE",
    color: "#63738E",
    bg: "#F5F3FF",
    icon: "people-outline",
    priority: 0,
  },
  PAID: {
    label: "PAID",
    color: "#627166",
    bg: "#F1F5F9",
    icon: "cash-outline",
    priority: -1,
  },
  REJECTED: {
    label: "REJECTED",
    color: "#AD4A40",
    bg: "#FEF2F2",
    icon: "close-circle-outline",
    priority: -1,
  },
};

const getChefStatusConfig = (status) => CHEF_STATUSES[status] || CHEF_STATUSES.EDITABLE;
const CHEF_PRIORITY_ORDER = ["EDITABLE", "CONFIRMED", "PREPARING", "SERVED", "TABLE_ACTIVE"];
const isLiveOrderStatus = (status) => ["CONFIRMED", "PREPARING", "SERVED", "TABLE_ACTIVE"].includes(status);
const withOfflineFallbackTimeout = (promise, ms = 2500) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("offline_fallback_timeout")), ms)),
  ]);

const parseMoneyToCents = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const normalized = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  const [rupees, paise = ""] = normalized.split(".");
  return Number(rupees) * 100 + Number((paise + "00").slice(0, 2));
};

const numberToCents = (value) => Math.round(Number(value || 0) * 100);
const formatCents = (cents) => (Number(cents || 0) / 100).toFixed(2);

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
    onRemoveItem,
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
            <Ionicons name="grid-outline" size={19} color="#42604E" />
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
            {!isChefMode && (
              <TouchableOpacity style={styles.itemTrashBtn} onPress={() => onRemoveItem?.(order, item)} activeOpacity={0.75}>
                <Ionicons name="trash-outline" size={13} color="#EF4444" />
              </TouchableOpacity>
            )}
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
const DiscountModal = ({
  visible,
  onClose,
  discountType,
  setDiscountType,
  discountValue,
  setDiscountValue,
  onApply,
  modalSubtotal,
  modalDiscountAmount,
  outstandingForm,
  setOutstandingForm,
  outstandingTotalCents,
  outstandingRemainingCents,
}) => {
  const updateOutstanding = (field, value) => setOutstandingForm((prev) => ({ ...prev, [field]: value }));
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
              { key: "outstanding", label: "Outstanding", icon: "person-outline" },
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
          {discountType === "outstanding" ? (
            <View style={styles.outstandingFields}>
              <TextInput style={styles.outstandingInput} placeholder="Customer Name" placeholderTextColor="#9CA3AF" value={outstandingForm.customerName} onChangeText={(v) => updateOutstanding("customerName", v)} />
              <TextInput style={styles.outstandingInput} placeholder="Phone Number" placeholderTextColor="#9CA3AF" keyboardType="number-pad" maxLength={10} value={outstandingForm.phoneNumber} onChangeText={(v) => updateOutstanding("phoneNumber", v.replace(/\D/g, ""))} />
              <View style={styles.outstandingReadonly}>
                <LocalizedText style={styles.previewLabel}>Total Amount</LocalizedText>
                <LocalizedText style={styles.previewValue}>Rs. {formatCents(outstandingTotalCents)}</LocalizedText>
              </View>
              <TextInput
                style={styles.outstandingInput}
                placeholder="Paid Amount (optional, default 0.00)"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={outstandingForm.paidAmount}
                onChangeText={(v) => updateOutstanding("paidAmount", v.replace(/[^0-9.]/g, ""))}
                selectTextOnFocus
              />
              <TextInput
                style={styles.outstandingInput}
                placeholder={`Remaining Amount (default ${formatCents(outstandingRemainingCents)})`}
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={outstandingForm.remainingAmount}
                onChangeText={(v) => updateOutstanding("remainingAmount", v.replace(/[^0-9.]/g, ""))}
                selectTextOnFocus
              />
            </View>
          ) : discountType !== "none" && (
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
  const [outstandingForm, setOutstandingForm] = useState({
    customerName: "",
    phoneNumber: "",
    paidAmount: "",
    remainingAmount: "",
  });

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
        await localDB.saveProfile(profileRes.data);
        setTables(Array.isArray(tablesRes.data) ? tablesRes.data : []);
        await localDB.saveTables(Array.isArray(tablesRes.data) ? tablesRes.data : []);
        setIsOffline(false);
      } else {
        setIsOffline(true);
        setProfile(await localDB.getProfile());
        setTables(await localDB.getTables());
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
      if (isOnline && !String(orderId).startsWith("local_order_")) {
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
  const handleRemoveOrderItem = useCallback(
    async (order, orderItem) => {
      try {
        const itemId = orderItem.id || orderItem.menu_item_id || orderItem.menuItemId;
        const isOnline = await networkMonitor.checkConnectivity();
        if (isOnline && !String(order.id).startsWith("local_order_")) {
          const res = await removeOrderItem(order.id, itemId);
          if (res?.data?.id) {
            await localDB.saveOrders([res.data]);
            setOrders((prev) => prev.map((o) => (o.id === res.data.id ? { ...o, ...res.data } : o)));
          } else {
            loadData();
          }
        } else {
          const updated = await localDB.removeOrderItem(order.id, itemId);
          if (updated?.id) setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
        }
      } catch (err) {
        Alert.alert(localizeText("Remove Item", language), err.response?.data?.error || localizeText("Could not remove item.", language));
      }
    },
    [language, loadData]
  );

  const buildBillHtml = useCallback(
    (tableOrders, discount) => {
      let combinedSubtotal = 0;
      const combinedItems = {};
      const isLiquorItem = (item) => item?.menu_type === "liquor" || !!item?.size_ml || !!item?.liquor_code || !!item?.liquor_brand_code;

      tableOrders.forEach((o) => {
        const items = Array.isArray(o.items) ? o.items : JSON.parse(o.items || "[]");
        items.forEach((item) => {
          const itemPrice = parseFloat(item.price || 0);
          const itemQty = parseInt(item.quantity || 1, 10);
          const displayName = localizedItemName(item, language);
          const itemKey = `${isLiquorItem(item) ? "liquor" : "food"}-${displayName}-${itemPrice}`;
          combinedSubtotal += itemPrice * itemQty;

          if (combinedItems[itemKey]) {
            combinedItems[itemKey].quantity += itemQty;
          } else {
            combinedItems[itemKey] = { ...item, displayName, isLiquor: isLiquorItem(item), price: itemPrice, quantity: itemQty };
          }
        });
      });

      const finalItemsList = Object.values(combinedItems);
      const foodItemsList = finalItemsList.filter((item) => !item.isLiquor);
      const liquorItemsList = finalItemsList.filter((item) => item.isLiquor);
      const foodSubtotal = foodItemsList.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const liquorSubtotal = liquorItemsList.reduce((sum, item) => sum + item.price * item.quantity, 0);

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

const buildItemsRows = (list) => list.map((i) => `
    <tr>
      <td style="padding: 4px 0;">${i.displayName || localizedItemName(i, language)}</td>
      <td class="center-col">${i.quantity}</td>
      <td class="right">&#8377;${(i.price * i.quantity).toFixed(2)}</td>
    </tr>
  `).join("");

const buildBillSection = (title, list, subtotal) => list.length ? `
      <table>
        <tr class="bold" style="border-bottom: 1px solid #000;">
          <td style="padding-bottom: 5px;">Product Name</td>
          <td class="center-col" style="padding-bottom: 5px;">Qty</td>
          <td class="right" style="padding-bottom: 5px;">Amt</td>
        </tr>

        ${buildItemsRows(list)}

        <tr class="bold section-total">
          <td colspan="2">${title} :</td>
          <td class="right">&#8377;${subtotal.toFixed(2)}</td>
        </tr>
      </table>
  ` : "";

const billSectionsHtml = [
  buildBillSection("Food Bill", foodItemsList, foodSubtotal),
  buildBillSection("Liquor Bill", liquorItemsList, liquorSubtotal),
].filter(Boolean).join(`<div class="divider tight"></div>`);

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
      <title>${BILL_PRINT_TITLE}</title>
      <style>
        @page { margin: 0; }
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

        .divider.tight {
          margin: 6px 0;
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

        .center-col {
          text-align: center;
        }

        .section-total td {
          border-top: 1px solid #000;
          padding-top: 6px;
          font-size: 15px;
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

      ${billSectionsHtml}

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
      const previousTitle = document.title;
      const printHtml = htmlContent
        .replace(/<title>.*?<\/title>/i, `<title>${BILL_PRINT_TITLE}</title>`);
      const styleMatch = printHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      const bodyMatch = printHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const printStyle = document.createElement("style");
      const printRoot = document.createElement("div");
      const restoreTitle = () => {
        document.title = previousTitle;
        if (document.head.contains(printStyle)) document.head.removeChild(printStyle);
        if (document.body.contains(printRoot)) document.body.removeChild(printRoot);
        window.removeEventListener("afterprint", restoreTitle);
      };

      document.title = BILL_PRINT_TITLE;
      window.addEventListener("afterprint", restoreTitle);

      const existingRoot = document.getElementById("servon-print-root");
      if (existingRoot) document.body.removeChild(existingRoot);
      const existingStyle = document.getElementById("servon-print-style");
      if (existingStyle) document.head.removeChild(existingStyle);

      printRoot.id = "servon-print-root";
      printRoot.innerHTML = bodyMatch?.[1] || printHtml;
      printRoot.style.display = "none";
      printStyle.id = "servon-print-style";
      printStyle.textContent = `
        ${styleMatch?.[1] || ""}
        @media screen { #servon-print-root { display: none !important; } }
        @media print {
          html, body {
            display: block !important; position: static !important;
            height: auto !important; min-height: 0 !important; max-height: none !important;
            overflow: visible !important; width: auto !important;
            margin: 0 !important; padding: 0 !important; background: #fff !important;
          }
          body > *:not(#servon-print-root) { display: none !important; }
          #servon-print-root {
            height: auto !important; min-height: 0 !important; max-height: none !important;
            position: static !important; overflow: visible !important;
            box-sizing: border-box; break-after: auto; page-break-after: auto;
          }
          #servon-print-root {
            display: block !important;
            font-family: monospace;
            width: 80mm;
            padding: 10px;
            margin: 0 auto;
            color: #000;
          }
        }
      `;
      document.head.appendChild(printStyle);
      document.body.appendChild(printRoot);

      const images = Array.from(printRoot.querySelectorAll("img") || []);
      if (images.length) {
        await Promise.race([
          Promise.all(images.map((img) => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
            });
          })),
          new Promise((resolve) => setTimeout(resolve, 1800)),
        ]);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      setTimeout(() => {
        document.title = BILL_PRINT_TITLE;
        window.focus();
        window.print();
        setTimeout(restoreTitle, 30000);
      }, 0);

    } else {
      await Print.printAsync({
        html: htmlContent
          .replace("<title></title>", `<title>${BILL_PRINT_TITLE}</title>`)
          .replace("<title>&#8203;</title>", `<title>${BILL_PRINT_TITLE}</title>`),
      });
    }
  }, [isPrinting]);

  // ─── HANDLE PRINT AND CHECKOUT ──────────────────────────────────
  const handlePrintAndCheckout = useCallback(
    async (currentOrder, discount, outstandingPayload = null) => {
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

        if (outstandingPayload) {
          const outstandingRecord = {
            ...outstandingPayload,
            orderId: currentOrder.id,
          };
          const isOnlineForOutstanding = await networkMonitor.checkConnectivity();
          if (isOnlineForOutstanding && !String(currentOrder.id).startsWith("local_order_")) {
            try {
              await withOfflineFallbackTimeout(saveCustomerOutstanding(outstandingRecord));
            } catch (apiErr) {
              await localDB.saveCustomerOutstanding(outstandingRecord);
            }
          } else {
            await localDB.saveCustomerOutstanding(outstandingRecord);
          }
        }

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
                if (!String(o.id).startsWith("local_order_")) {
                  await updateOrderStatus(o.id, "PAID");
                  await localDB.markAsSynced(o.id);
                }
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
    setOutstandingForm({ customerName: "", phoneNumber: "", paidAmount: "", remainingAmount: "" });
    setShowDiscountModal(true);
  }, []);

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

  const outstandingTotalCents = useMemo(() => numberToCents(modalSubtotal), [modalSubtotal]);
  const outstandingRemainingCents = useMemo(() => {
    const paid = parseMoneyToCents(outstandingForm.paidAmount);
    const remaining = parseMoneyToCents(outstandingForm.remainingAmount);
    if (remaining !== null && !Number.isNaN(remaining)) return remaining;
    if (paid !== null && !Number.isNaN(paid)) return Math.max(0, outstandingTotalCents - paid);
    return outstandingTotalCents;
  }, [outstandingForm.paidAmount, outstandingForm.remainingAmount, outstandingTotalCents]);

  const applyDiscount = useCallback(() => {
    if (discountType === "outstanding") {
      const name = outstandingForm.customerName.trim();
      const phone = outstandingForm.phoneNumber.trim();
      const totalCents = numberToCents(modalSubtotal);
      let paidCents = parseMoneyToCents(outstandingForm.paidAmount);
      let remainingCents = parseMoneyToCents(outstandingForm.remainingAmount);

      if (!name) {
        Alert.alert(localizeText("Invalid", language), "Customer name is required.");
        return;
      }
      if (!/^\d{10}$/.test(phone)) {
        Alert.alert(localizeText("Invalid", language), "Phone number must be exactly 10 digits.");
        return;
      }
      if (Number.isNaN(paidCents) || Number.isNaN(remainingCents)) {
        Alert.alert(localizeText("Invalid", language), "Enter valid rupee amounts with up to 2 decimals.");
        return;
      }
      if (paidCents === null && remainingCents === null) {
        paidCents = 0;
        remainingCents = totalCents;
      } else if (paidCents !== null && remainingCents === null) {
        remainingCents = totalCents - paidCents;
      } else if (paidCents === null && remainingCents !== null) {
        paidCents = totalCents - remainingCents;
      }
      if (paidCents < 0 || remainingCents < 0 || remainingCents > totalCents || paidCents + remainingCents !== totalCents) {
        Alert.alert(localizeText("Invalid", language), "Paid and remaining amounts must add up to the total.");
        return;
      }

      handlePrintAndCheckout(selectedOrderForDiscount, { type: "none", value: 0 }, {
        customerName: name,
        phoneNumber: phone,
        totalAmount: formatCents(totalCents),
        paidAmount: formatCents(paidCents),
        remainingAmount: formatCents(remainingCents),
      });
      setShowDiscountModal(false);
      setSelectedOrderForDiscount(null);
      return;
    }

    const value = parseFloat(discountValue);
    if (discountType !== "none" && (!value || value <= 0)) {
      Alert.alert(localizeText("Invalid", language), localizeText("Please enter a valid discount amount.", language));
      return;
    }
    const discount = { type: discountType, value: value || 0 };
    handlePrintAndCheckout(selectedOrderForDiscount, discount);
    setShowDiscountModal(false);
    setSelectedOrderForDiscount(null);
  }, [discountType, discountValue, outstandingForm, modalSubtotal, selectedOrderForDiscount, handlePrintAndCheckout, language]);

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
          <View style={styles.chefTableRow}>
            <View style={styles.chefTableIconWrap}><Ionicons name="grid-outline" size={19} color="#42604E" /></View>
            <LocalizedText style={styles.chefTableNumber}>Table {item.table_number}</LocalizedText>
          </View>
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
                <Ionicons name="trash-outline" size={13} color="#AD4A40" />
              </TouchableOpacity>
            )}
            <View style={[styles.badgeOld, { backgroundColor: statusColor(item.status) }]}>
              <LocalizedText style={{ color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.4 }}>{item.status.replace("_", " ")}</LocalizedText>
            </View>
          </View>
        </View>
        {items.map((i, idx) => (
          <View key={idx} style={styles.oldItemRow}>
            <NativeText style={styles.itemQuantity}>{i.quantity}×</NativeText>
            <LocalizedText translate={false} style={styles.itemName}>{localizedItemName(i, language)}</LocalizedText>
            <NativeText style={styles.itemAmount}>₹{(i.price * i.quantity).toFixed(0)}</NativeText>
            {!isChefMode && (
              <TouchableOpacity style={styles.itemTrashBtn} onPress={() => handleRemoveOrderItem(item, i)} activeOpacity={0.75}>
                <Ionicons name="trash-outline" size={16} color="#AB5C52" />
              </TouchableOpacity>
            )}
          </View>
        ))}
        {item.special_instructions && (
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: "#FEF3C7", padding: 10, borderRadius: 10, marginTop: 8 }}>
            <Ionicons name="chatbubble-outline" size={13} color="#92400E" style={{ marginTop: 2 }} />
            <LocalizedText style={{ fontSize: 13, color: "#92400E", fontWeight: "600", flex: 1 }}>{item.special_instructions}</LocalizedText>
          </View>
        )}
        <View style={styles.totalRowOld}>
          <LocalizedText translate style={{ fontWeight: "500", fontSize: 13, color: "#627166" }}>Subtotal:</LocalizedText>
          <LocalizedText style={{ fontWeight: "700", fontSize: 22, color: "#20332A" }}>
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
                  <TouchableOpacity activeOpacity={0.8} style={[styles.actionBtnOld, { backgroundColor: isProcessing ? "#4B5563" : "#244F3B", marginTop: 16, flexDirection: "row", justifyContent: "center", gap: 8 }]} onPress={() => openDiscountModal(item)} disabled={isProcessing}>
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
                  <TouchableOpacity activeOpacity={0.8} style={[styles.actionBtnOld, { backgroundColor: "#63738E" }]} onPress={() => handleStatusUpdate(item.id, "TABLE_ACTIVE")}>
                    <LocalizedText translate style={styles.actionBtnTextOld}>Active Table</LocalizedText>
                  </TouchableOpacity>
                  {!isChefMode && (
                    <TouchableOpacity activeOpacity={0.8} style={[styles.actionBtnOld, { backgroundColor: isProcessing ? "#4B5563" : "#244F3B" }]} onPress={() => openDiscountModal(item)} disabled={isProcessing}>
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
                    <TouchableOpacity activeOpacity={0.8} style={[styles.actionBtnOld, { backgroundColor: "#33714C" }]} onPress={() => handleStatusUpdate(item.id, "PREPARING")}>
                      <LocalizedText translate style={styles.actionBtnTextOld}>Accept</LocalizedText>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.8} style={[styles.actionBtnOld, { backgroundColor: "#AD4A40", flex: 0.4 }]} onPress={() => handleStatusUpdate(item.id, "REJECTED")}>
                      <LocalizedText translate style={styles.actionBtnTextOld}>Reject</LocalizedText>
                    </TouchableOpacity>
                  </>
                )}
              </View>
                )}
                {item.status === "PREPARING" && (
              <TouchableOpacity activeOpacity={0.8} style={[styles.actionBtnOld, { backgroundColor: "#9A6A25", marginTop: 16 }]} onPress={() => handleStatusUpdate(item.id, "SERVED")}>
                <LocalizedText translate style={[styles.actionBtnTextOld, { color: "#fff" }]}>Mark Served</LocalizedText>
              </TouchableOpacity>
                )}
                {item.status === "SERVED" && (
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                <TouchableOpacity activeOpacity={0.8} style={[styles.actionBtnOld, { backgroundColor: "#63738E" }]} onPress={() => handleStatusUpdate(item.id, "TABLE_ACTIVE")}>
                  <LocalizedText translate style={styles.actionBtnTextOld}>Active Table</LocalizedText>
                </TouchableOpacity>
                {!isChefMode && (
                  <TouchableOpacity activeOpacity={0.8} style={[styles.actionBtnOld, { backgroundColor: isProcessing ? "#4B5563" : "#244F3B" }]} onPress={() => openDiscountModal(item)} disabled={isProcessing}>
                    {isProcessing ? <ActivityIndicator color="#fff" size="small" /> : <LocalizedText translate style={styles.actionBtnTextOld}>Print</LocalizedText>}
                  </TouchableOpacity>
                )}
              </View>
                )}
                {item.status === "TABLE_ACTIVE" && !isChefMode && (
              <TouchableOpacity activeOpacity={0.8} style={[styles.actionBtnOld, { backgroundColor: isProcessing ? "#4B5563" : "#244F3B", marginTop: 16, flexDirection: "row", justifyContent: "center", gap: 8 }]} onPress={() => openDiscountModal(item)} disabled={isProcessing}>
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
          onRemoveItem={handleRemoveOrderItem}
          isProcessing={processingTable === item.table_number}
          timeLeft={timeLeft}
          isChefMode={isChefMode}
        />
      );
    },
    [currentTime, handleStatusUpdate, processingTable, isChefMode, openDiscountModal, handleReprint, confirmDeleteOrder, handleRemoveOrderItem]
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F3F5F2" }}>
      <View style={[styles.filterBar, isWeb && { maxWidth: 1400, alignSelf: "center", width: "100%" }]}>
        {isChefMode ? (
          <FlatList
            horizontal
            data={CHEF_FILTERS}
            keyExtractor={(i) => i.key}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRail}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.75}
                style={[styles.filterTab, filter === item.key && styles.filterTabActive]}
                onPress={() => setFilter(item.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: filter === item.key }}
              >
                {item.key !== "all" && <View style={[styles.filterDot, { backgroundColor: filter === item.key ? "#D3E7D3" : statusColor(item.key) }]} />}
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
            contentContainerStyle={styles.filterRail}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.75}
                style={[styles.filterTab, filter === item.key && styles.filterTabActive]}
                onPress={() => setFilter(item.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: filter === item.key }}
              >
                {item.key !== "all" && <Ionicons name={item.key === "PREVIOUS" ? "time-outline" : "ellipse"} size={item.key === "PREVIOUS" ? 15 : 7} color={filter === item.key ? "#D3E7D3" : statusColor(item.key)} />}
                <LocalizedText style={[styles.filterTabText, filter === item.key && { color: "#fff" }]}>
                  {item.label.replace("_", " ")}
                </LocalizedText>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      <View style={[{ flex: 1 }, isWeb && { maxWidth: 1400, alignSelf: "center", width: "100%" }]}>
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
                <Ionicons name="grid-outline" size={18} color="#42604E" />
                <LocalizedText translate style={styles.tableSidebarTitle}>Tables</LocalizedText>
                <View style={styles.tableSidebarCount}>
                  <NativeText style={styles.tableSidebarCountText}>{tableTabs.length}</NativeText>
                </View>
              </View>
              <ScrollView horizontal={isCompactTableLayout} showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} contentContainerStyle={isCompactTableLayout ? styles.tableRailMobile : null}>
                {tableTabs.map((table) => {
                  const active = table.key === selectedTableKey;
                  return (
                    <TouchableOpacity key={table.key} activeOpacity={0.78} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.tableTab, active && styles.tableTabActive, isCompactTableLayout && styles.tableTabMobile]} onPress={() => setSelectedTableKey(table.key)}>
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
              <View style={styles.tableEmptyState}>
                <View style={styles.tableEmptyIcon}><Ionicons name="receipt-outline" size={32} color="#55755D" /></View>
                <LocalizedText style={styles.tableEmptyTitle}>
                  {isOffline ? '📡 Offline - No cached orders' : 'No orders found for today'}
                </LocalizedText>
                {isOffline && (
                  <LocalizedText translate style={styles.tableEmptySub}>
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
          setOutstandingForm({ customerName: "", phoneNumber: "", paidAmount: "", remainingAmount: "" });
        }}
        discountType={discountType}
        setDiscountType={setDiscountType}
        discountValue={discountValue}
        setDiscountValue={setDiscountValue}
        onApply={applyDiscount}
        modalSubtotal={modalSubtotal}
        modalDiscountAmount={modalDiscountAmount}
        outstandingForm={outstandingForm}
        setOutstandingForm={setOutstandingForm}
        outstandingTotalCents={outstandingTotalCents}
        outstandingRemainingCents={outstandingRemainingCents}
      />
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  filterBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#DFE5DF' },
  filterRail: { paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  filterTab: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E1E7DE', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  filterTabActive: { backgroundColor: '#244F3B', borderColor: '#244F3B' },
  filterTabText: { fontSize: 12, fontWeight: '600', color: '#4A5E50', letterSpacing: .2 },
  filterDot: { width: 7, height: 7, borderRadius: 4 },
  orderCardOld: {
    backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 14,
    borderWidth: 1, borderColor: '#DDE4DC',
    ...Platform.select({ web: { flex: 1, margin: 7, minWidth: 280, boxShadow: '0 2px 4px rgba(32,51,42,0.03)' }, default: { elevation: 1 } }),
  },
  badgeOld: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  totalRowOld: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#E9EDE7' },
  actionBtnOld: { flex: 1, minHeight: 46, borderRadius: 8, padding: 13, alignItems: 'center', justifyContent: 'center' },
  actionBtnTextOld: { color: '#fff', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  reprintBtnOld: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, minWidth: 40, minHeight: 40, backgroundColor: '#F0F4ED', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  reprintBtnTextOld: { fontSize: 12, fontWeight: '600', color: '#4A5E50' },
  oldItemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, minHeight: 50, borderBottomWidth: 1, borderBottomColor: '#F0F3ED' },
  itemQuantity: { minWidth: 30, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 5, backgroundColor: '#EDF3E9', textAlign: 'center', fontSize: 13, fontWeight: '700', color: '#36543F' },
  itemName: { flex: 1, fontSize: 15, color: '#283B30', fontWeight: '500', lineHeight: 22 },
  itemAmount: { fontSize: 14, fontWeight: '700', color: '#20332A' },
  itemTrashBtn: { width: 40, height: 40, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  chefBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 6, gap: 5 },
  chefBadgeLabel: { fontWeight: '600', textTransform: 'uppercase', letterSpacing: .2 },
  chefOrderCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#DDE4DC',
    ...Platform.select({ web: { flex: 1, margin: 7, minWidth: 280, boxShadow: '0 2px 4px rgba(32,51,42,0.03)' }, default: { elevation: 1 } }),
  },
  chefCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8 },
  chefTableRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chefTableIconWrap: { width: 38, height: 38, borderRadius: 9, backgroundColor: '#EDF3E9', alignItems: 'center', justifyContent: 'center' },
  chefTableNumber: { fontSize: 19, fontWeight: '700', color: '#20332A' },
  chefReprintBtn: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F0F4ED', alignItems: 'center', justifyContent: 'center' },
  chefItemsContainer: { marginBottom: 8, borderTopWidth: 1, borderTopColor: '#E9EDE7', paddingTop: 6 },
  chefItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, minHeight: 46 },
  chefItemRowDivider: { borderBottomWidth: 1, borderBottomColor: '#F0F3ED' },
  chefItemName: { fontSize: 15, fontWeight: '500', color: '#283B30', flex: 1, paddingRight: 8, lineHeight: 22 },
  chefItemMeta: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  chefItemQty: { fontSize: 14, color: '#42604E', fontWeight: '600' },
  chefItemPrice: { fontSize: 14, fontWeight: '700', color: '#20332A' },
  chefInstructions: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFF7E5', padding: 10, borderRadius: 8, marginTop: 8, gap: 6 },
  chefInstructionsText: { fontSize: 13, color: '#825A1E', fontWeight: '500', flex: 1, lineHeight: 20 },
  chefCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#E9EDE7' },
  chefTimestampRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chefTimestamp: { fontSize: 12, color: '#627166', fontWeight: '500' },
  chefTotalRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chefTotalLabel: { fontSize: 13, fontWeight: '500', color: '#627166' },
  chefTotalValue: { fontSize: 20, fontWeight: '700', color: '#20332A' },
  chefActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  chefActionBtn: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 8, gap: 6 },
  chefActionText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  chefAcceptBtn: { backgroundColor: '#33714C' },
  chefRejectBtn: { backgroundColor: '#AD4A40' },
  chefCompleteBtn: { backgroundColor: '#9A6A25' },
  chefActiveBtn: { backgroundColor: '#63738E' },
  chefPrintBtn: { backgroundColor: '#244F3B' },
  chefWaitingBadge: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F4ED', paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8, gap: 8 },
  chefWaitingText: { color: '#627166', fontWeight: '600', fontSize: 13 },
  tableOrderShell: { flex: 1, flexDirection: 'row', gap: 20, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18, minWidth: 0 },
  tableOrderShellMobile: { flexDirection: 'column', gap: 12, paddingHorizontal: 12, paddingTop: 12 },
  tableSidebar: { width: 220, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#DFE5DF', padding: 12 },
  tableSidebarMobile: { width: '100%', maxHeight: 130, padding: 10, flexShrink: 0 },
  tableSidebarHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 14, paddingHorizontal: 4, paddingTop: 4 },
  tableSidebarTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#344E3E' },
  tableSidebarCount: { minWidth: 26, height: 26, paddingHorizontal: 7, borderRadius: 6, backgroundColor: '#F0F4ED', alignItems: 'center', justifyContent: 'center' },
  tableSidebarCountText: { fontSize: 12, fontWeight: '700', color: '#42604E' },
  tableRailMobile: { gap: 8, paddingRight: 4 },
  tableTab: { borderRadius: 8, borderWidth: 1, borderColor: '#E7ECE3', backgroundColor: '#fff', padding: 13, marginBottom: 8 },
  tableTabMobile: { width: 140, marginBottom: 0, padding: 10 },
  tableTabActive: { backgroundColor: '#E9F1E5', borderColor: '#7EA583', borderLeftWidth: 3 },
  tableTabTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tableTabLabel: { color: '#344E3E', fontSize: 15, fontWeight: '600' },
  tableTabLabelActive: { color: '#244F3B', fontWeight: '700' },
  tableTabBadge: { minWidth: 25, height: 25, paddingHorizontal: 7, borderRadius: 6, backgroundColor: '#F0F4ED', alignItems: 'center', justifyContent: 'center' },
  tableTabBadgeActive: { backgroundColor: '#365E40' },
  tableTabBadgeText: { color: '#627166', fontSize: 12, fontWeight: '700' },
  tableTabBadgeTextActive: { color: '#fff' },
  tableTabMeta: { marginTop: 6, color: '#778176', fontSize: 12, fontWeight: '500' },
  tableTabMetaActive: { color: '#4A6B50' },
  tableOrdersPane: { flex: 1, minWidth: 0 },
  tableOrdersPaneMobile: { width: '100%' },
  tablePaneHeader: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#DFE5DF', padding: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  tablePaneHeaderMobile: { padding: 14, marginBottom: 10 },
  tablePaneTitle: { color: '#20332A', fontSize: 23, fontWeight: '700', letterSpacing: -.4 },
  tablePaneSub: { color: '#627166', fontSize: 13, fontWeight: '400', marginTop: 5 },
  tablePaneMetric: { minWidth: 68, borderRadius: 8, backgroundColor: '#EFF4EB', paddingVertical: 9, paddingHorizontal: 14, alignItems: 'center' },
  tablePaneMetricValue: { color: '#365E40', fontSize: 24, fontWeight: '700' },
  tablePaneMetricLabel: { color: '#627166', fontSize: 11, fontWeight: '500', marginTop: 2 },
  tableOrdersList: { paddingBottom: 24 },
  tableOrdersListMobile: { paddingBottom: 24, paddingHorizontal: 0 },
  tableEmptyState: { alignItems: 'center', justifyContent: 'center', minHeight: 300, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#DFE5DF', padding: 28 },
  tableEmptyIcon: { width: 66, height: 66, borderRadius: 18, backgroundColor: '#EFF4EB', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  tableEmptyTitle: { color: '#546B58', marginTop: 12, fontSize: 15, fontWeight: '500', textAlign: 'center' },
  tableEmptySub: { color: '#627166', fontSize: 12, marginTop: 6, textAlign: 'center' },
  sectionHeader: { fontSize: 14, fontWeight: '600', color: '#546B58', paddingVertical: 10, marginBottom: 8 },
  datePickerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', marginHorizontal: 20, marginTop: 20, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#DFE5DF' },
  dateInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateLabel: { fontSize: 14, fontWeight: '600', color: '#344E3E' },
  webDateInput: { padding: 10, borderRadius: 7, border: '1px solid #D9E1D5', fontFamily: 'inherit', fontSize: '14px', outlineColor: '#7EA583', cursor: 'pointer', backgroundColor: '#F8FAF6', color: '#344E3E' },
  mobileDateBtn: { backgroundColor: '#F0F4ED', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#DFE5DF', flexDirection: 'row', alignItems: 'center', gap: 6 },
  mobileDateText: { fontSize: 14, fontWeight: '600', color: '#344E3E' },

  discountModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  discountModal: { backgroundColor: "#fff", borderRadius: 22, padding: 22, width: "100%", maxWidth: 480 },
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
  outstandingFields: { gap: 10, marginBottom: 12 },
  outstandingInput: { borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontWeight: "700", color: "#111827" },
  outstandingReadonly: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1.5, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
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
