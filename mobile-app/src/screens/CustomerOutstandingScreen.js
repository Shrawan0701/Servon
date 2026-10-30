import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";


import * as Print from "expo-print";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import localDB from "../services/LocalDB";
import { refreshPOSData } from "../services/refreshPOSData";


const rs = (value) =>
  `Rs. ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";



const parseAmount = (value) => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const cleanAmountInput = (value) => String(value || "").replace(/[^0-9.]/g, "");

const buildOutstandingHtml = ({ records, totalRemaining, businessName }) => {
  const rows = records.map((record) => `
    <tr>
      <td>${fmtDate(record.created_at)}</td>
      <td>${record.customer_name || ""}</td>
      <td>${record.phone_number || ""}</td>
      <td>${rs(record.total_amount)}</td>
      <td><strong>${rs(record.remaining_amount)}</strong></td>
    </tr>
  `).join("");

  return `
    <html><head><style>
      body{font-family:Arial,sans-serif;padding:28px;color:#111827}
      h1{margin:0 0 6px;font-size:26px} h2{margin:0 0 8px;font-size:18px}
      table{width:100%;border-collapse:collapse;margin-top:24px;font-size:12px}
      th,td{padding:10px;border-bottom:1px solid #E5E7EB;text-align:left}
      th{background:#F3F4F6;text-transform:uppercase}
      td:nth-child(4),td:nth-child(5),th:nth-child(4),th:nth-child(5){text-align:right}
      .total{font-weight:800;background:#F9FAFB}
    </style></head><body>
      <h1>${businessName}</h1>
      <h2>Customer Outstanding Report</h2>
      <div>Generated: ${new Date().toLocaleString("en-IN")}</div>
      <table><thead><tr><th>Date</th><th>Customer Name</th><th>Phone Number</th><th>Total Amount</th><th>Remaining Amount</th></tr></thead>
      <tbody>${rows}<tr class="total"><td colspan="4">GRAND TOTAL</td><td>${rs(totalRemaining)}</td></tr></tbody></table>
    </body></html>
  `;
};

export default function CustomerOutstandingScreen() {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const isCompact = width < 720;
  const [records, setRecords] = useState([]);
  const [totalRemaining, setTotalRemaining] = useState("0.00");
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const saveLock = useRef(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [manualForm, setManualForm] = useState({
    customerName: "",
    phoneNumber: "",
    totalAmount: "",
    paidAmount: "",
  });

  const manualTotal = parseAmount(manualForm.totalAmount);
  const manualPaid = parseAmount(manualForm.paidAmount) ?? 0;
  const manualRemaining = Number.isFinite(manualTotal) && Number.isFinite(manualPaid)
    ? Math.max(0, manualTotal - manualPaid)
    : 0;
  const trimmedSearch = searchQuery.trim().toLowerCase();
  const filteredRecords = useMemo(() => {
    if (!trimmedSearch) return records;
    return records.filter((record) =>
      String(record.customer_name || "").toLowerCase().includes(trimmedSearch)
    );
  }, [records, trimmedSearch]);

  const updateManualForm = (key, value) => {
    setManualForm((prev) => ({
      ...prev,
      [key]:
        key === "phoneNumber"
          ? value.replace(/\D/g, "").slice(0, 10)
          : key === "customerName"
            ? value
            : cleanAmountInput(value),
    }));
  };

  const resetManualForm = () => {
    setManualForm({ customerName: "", phoneNumber: "", totalAmount: "", paidAmount: "" });
  };

  const loadData = useCallback(async () => {
    try {
      const cached = await localDB.getCustomerOutstandings();
      setRecords(cached);
      setTotalRemaining(cached.reduce((sum, row) => sum + Number(row.remaining_amount || 0), 0).toFixed(2));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    loadData();
    const unsubscribe = localDB.subscribe(() => { loadData().catch(() => {}); });
    refreshPOSData(['dues', 'profile']).catch(() => {});
    return unsubscribe;
  }, [loadData]);

  const addManualOutstanding = async () => {
    if (saveLock.current) return;
    setSaveError("");
    const name = manualForm.customerName.trim();
    const phone = manualForm.phoneNumber.trim();
    const totalAmount = parseAmount(manualForm.totalAmount);
    const paidAmount = parseAmount(manualForm.paidAmount) ?? 0;

    if (!name) {
      Alert.alert("Invalid", "Customer name is required.");
      return;
    }
    if (phone && !/^\d{10}$/.test(phone)) {
      Alert.alert("Invalid", "Phone number must be exactly 10 digits.");
      return;
    }
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      Alert.alert("Invalid", "Enter a valid total amount.");
      return;
    }
    if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > totalAmount) {
      Alert.alert("Invalid", "Paid amount must be between 0 and total amount.");
      return;
    }

    const payload = {
      customerName: name,
      phoneNumber: phone,
      totalAmount: totalAmount.toFixed(2),
      paidAmount: paidAmount.toFixed(2),
      remainingAmount: Math.max(0, totalAmount - paidAmount).toFixed(2),
    };

    saveLock.current = true;
    setSaving(true);
    try {
      await localDB.saveCustomerOutstanding(payload);
      resetManualForm(); setShowAddModal(false);
      await loadData();
    } catch (err) {
      setSaveError(err.message || "Could not save on this device.");
      Alert.alert("Save Failed", "Could not save customer outstanding.");
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const printOutstanding = async () => {
    const token = await AsyncStorage.getItem("token");
    if (!token) {
      Alert.alert("Session Expired", "Please log in again and retry the download.");
      return;
    }

    setPrinting(true);
    try {
      const profile = await localDB.getProfile();
      const businessName = profile?.business_name || profile?.businessName || "Servon Hotel";
      const html = buildOutstandingHtml({ records, totalRemaining, businessName });

      if (Platform.OS === "web" && !isCompact) {
        const printWindow = window.open("", "_blank", "width=900,height=700");
        if (!printWindow) throw new Error("print_window_blocked");
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 250);
        return;
      }

      await Print.printAsync({ html });
    } catch (err) {
      Alert.alert("Print Failed", "Could not generate the outstanding report.");
    } finally {
      setPrinting(false);
    }
  };

  const recalcTotal = (list) =>
    list.reduce((sum, record) => sum + Number(record.remaining_amount || 0), 0).toFixed(2);

  const clearOutstanding = async (item) => {
    if (!item?.id) return;
    const previousRecords = records;
    const nextRecords = records.filter((record) => String(record.id) !== String(item.id));
    setRecords(nextRecords);
    setTotalRemaining(recalcTotal(nextRecords));

    try {
      await localDB.clearCustomerOutstanding?.(item.id);

    } catch (err) {
      setRecords(previousRecords);
      setTotalRemaining(recalcTotal(previousRecords));
      Alert.alert("Clear Failed", "Could not clear this outstanding.");
    }
  };

  const renderTableRow = ({ item }) => (
    <View style={styles.row}>
      <View style={styles.checkCol}>
        <TouchableOpacity accessibilityLabel="Clear outstanding" style={styles.clearCheckBtn} onPress={() => clearOutstanding(item)}>
          <Ionicons name="checkmark" size={14} color="#059669" />
        </TouchableOpacity>
      </View>
      <Text style={[styles.td, styles.dateCol]}>{fmtDate(item.created_at)}</Text>
      <Text style={[styles.td, styles.nameCol]} numberOfLines={1}>{item.customer_name}</Text>
      <Text style={[styles.td, styles.phoneCol]}>{item.phone_number}</Text>
      <Text style={[styles.td, styles.amountCol]}>{rs(item.total_amount)}</Text>
      <Text style={[styles.td, styles.amountCol, styles.remaining]}>{rs(item.remaining_amount)}</Text>
    </View>
  );

  const renderCard = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.customerIcon}><Ionicons name="person-outline" size={20} color="#42604E" /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.cardName} numberOfLines={1}>{item.customer_name}</Text>
          <Text style={styles.cardPhone}>{item.phone_number}</Text>
        </View>
        <View style={styles.cardMeta}>
          <TouchableOpacity accessibilityLabel="Clear outstanding" style={styles.clearCheckBtn} onPress={() => clearOutstanding(item)}>
            <Ionicons name="checkmark" size={14} color="#059669" />
          </TouchableOpacity>
          <Text style={styles.cardDate}>{fmtDate(item.created_at)}</Text>
        </View>
      </View>
      <View style={styles.cardAmounts}>
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Total Amount</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.amountValue}>{rs(item.total_amount)}</Text>
        </View>
        <View style={[styles.amountBox, styles.remainingBox]}>
          <Text style={styles.amountLabel}>Remaining Amount</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.amountValue, styles.remaining]}>{rs(item.remaining_amount)}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.workspace, isCompact && styles.workspaceCompact]}>
      <View style={[styles.header, isCompact && styles.headerCompact]}>
        <View style={[styles.titleRow, isCompact && styles.titleRowCompact]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#111827" />
          </TouchableOpacity>
          <View style={styles.titleBlock}>
            <Text style={[styles.title, isCompact && styles.titleCompact]} numberOfLines={2}>Customer Outstanding</Text>
            <View style={styles.balanceBadge}>
              <Ionicons name="wallet-outline" size={15} color="#627166" />
              <Text style={styles.subtitle}>Total outstanding: <Text style={styles.balanceValue}>{rs(totalRemaining)}</Text></Text>
            </View>
          </View>
        </View>
        <View style={[styles.headerActions, isCompact && styles.headerActionsCompact]}>
          <TouchableOpacity style={[styles.addBtn, isCompact && styles.actionBtnCompact]} onPress={() => setShowAddModal(true)}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.printText}>Add Outstanding</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.printBtn, isCompact && styles.actionBtnCompact]} onPress={printOutstanding} disabled={printing}>
            {printing ? <ActivityIndicator color="#42604E" size="small" /> : <Ionicons name={isCompact ? "download-outline" : "print-outline"} size={18} color="#42604E" />}
            <Text style={[styles.printText, styles.printTextSecondary]}>{isCompact ? "Download PDF" : "Print Outstanding"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.searchWrap, isCompact && styles.searchWrapCompact]}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search customer name"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
          />
          {!!searchQuery && (
            <TouchableOpacity style={styles.searchClearBtn} onPress={() => setSearchQuery("")}>
              <Ionicons name="close" size={16} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={[styles.table, isCompact && styles.mobileList]}>
        {!isCompact && (
          <View style={[styles.row, styles.headRow]}>
            <Text style={[styles.th, styles.checkCol]}></Text>
            <Text style={[styles.th, styles.dateCol]}>Date</Text>
            <Text style={[styles.th, styles.nameCol]}>Customer Name</Text>
            <Text style={[styles.th, styles.phoneCol]}>Phone Number</Text>
            <Text style={[styles.th, styles.amountCol]}>Total Amount</Text>
            <Text style={[styles.th, styles.amountCol]}>Remaining Amount</Text>
          </View>
        )}
        {loading ? (
          <View style={styles.empty}><ActivityIndicator color="#111827" /></View>
        ) : (
          <FlatList
            data={filteredRecords}
            keyExtractor={(item, index) => `${item.phone_number}-${item.created_at || index}-${index}`}
            renderItem={isCompact ? renderCard : renderTableRow}
            contentContainerStyle={isCompact ? styles.cardList : null}
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIcon}><Ionicons name="wallet-outline" size={30} color="#55755D" /></View>
                <Text style={styles.emptyText}>
                  {trimmedSearch ? "No customers found." : "No outstanding customers."}
                </Text>
              </View>
            }
          />
        )}
      </View>
      </View>

      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalCard, isCompact && styles.modalCardCompact]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Add Outstanding</Text>
                <Text style={styles.modalSubtitle}>Remaining amount is calculated automatically.</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.formGrid} keyboardShouldPersistTaps="handled">
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Customer Name</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={manualForm.customerName}
                  onChangeText={(value) => updateManualForm("customerName", value)}
                  placeholder="Enter customer name"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Phone Number (optional)</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={manualForm.phoneNumber}
                  onChangeText={(value) => updateManualForm("phoneNumber", value)}
                  placeholder="10 digit number (optional)"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </View>
              <View style={[styles.fieldGroup, styles.amountField]}>
                <Text style={styles.fieldLabel}>Total Amount</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={manualForm.totalAmount}
                  onChangeText={(value) => updateManualForm("totalAmount", value)}
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.fieldGroup, styles.amountField]}>
                <Text style={styles.fieldLabel}>Paid Amount Optional</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={manualForm.paidAmount}
                  onChangeText={(value) => updateManualForm("paidAmount", value)}
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.fieldGroup, styles.remainingPreview]}>
                <Text style={styles.fieldLabel}>Remaining Amount</Text>
                <Text style={styles.remainingPreviewValue}>{rs(manualRemaining)}</Text>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  resetManualForm();
                  setShowAddModal(false);
                }}
                disabled={saving}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              {!!saveError && <Text accessibilityRole="alert" style={{ color: "#B91C1C", marginBottom: 8 }}>{saveError}</Text>}
              <TouchableOpacity style={[styles.modalBtn, styles.saveBtn, saving && styles.disabledBtn]} onPress={addManualOutstanding} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save Outstanding</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F5F2" },
  workspace: { flex: 1, width: "100%", maxWidth: 1400, alignSelf: "center", padding: 24 },
  workspaceCompact: { padding: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 24, marginBottom: 24 },
  headerCompact: { alignItems: "stretch", flexDirection: "column", gap: 18, marginBottom: 18 },
  titleRow: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 14 },
  titleRowCompact: { flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
  titleBlock: { flex: 1, minWidth: 0 },
  backBtn: { width: 44, height: 44, borderRadius: 9, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#DFE5DF" },
  title: { fontSize: 27, fontWeight: "700", color: "#20332A", letterSpacing: -.6 },
  titleCompact: { fontSize: 22, lineHeight: 28 },
  balanceBadge: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 8, flexWrap: "wrap" },
  subtitle: { color: "#627166", fontSize: 13, fontWeight: "400", lineHeight: 20 },
  balanceValue: { color: "#943F32", fontWeight: "700", fontSize: 16 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerActionsCompact: { width: "100%", flexDirection: "row", alignItems: "stretch", gap: 8 },
  addBtn: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "#244F3B", borderRadius: 8, paddingHorizontal: 15, paddingVertical: 11 },
  printBtn: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "#fff", borderWidth: 1, borderColor: "#D5E0D1", borderRadius: 8, paddingHorizontal: 15, paddingVertical: 11 },
  actionBtnCompact: { flex: 1, minWidth: 0, paddingHorizontal: 10 },
  printText: { color: "#fff", fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "center" },
  printTextSecondary: { color: "#42604E" },
  searchWrap: { width: "100%", alignItems: "flex-start", marginBottom: 18 },
  searchWrapCompact: { alignItems: "stretch", marginBottom: 14 },
  searchBox: { width: "100%", maxWidth: 440, minHeight: 46, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#D5E0D1", borderRadius: 8, paddingHorizontal: 14 },
  searchInput: { flex: 1, minWidth: 0, color: "#283B30", fontSize: 14, fontWeight: "400", paddingVertical: 12, ...Platform.select({ web: { outlineStyle: "none" } }) },
  searchClearBtn: { width: 32, height: 32, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: "#F0F4ED" },
  table: { flex: 1, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#DFE5DF", overflow: "hidden" },
  mobileList: { backgroundColor: "transparent", borderWidth: 0, borderRadius: 0, overflow: "visible" },
  row: { flexDirection: "row", alignItems: "center", minHeight: 64, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#E9EDE7", gap: 8 },
  headRow: { minHeight: 48, backgroundColor: "#F0F4ED" },
  th: { fontSize: 12, fontWeight: "600", color: "#546B58" },
  td: { fontSize: 14, fontWeight: "400", color: "#283B30" },
  checkCol: { width: 42, alignItems: "center", justifyContent: "center" },
  clearCheckBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: "#B9CFB0", backgroundColor: "#F0F6E9", alignItems: "center", justifyContent: "center" },
  dateCol: { flex: 1, minWidth: 86 },
  nameCol: { flex: 1.5, minWidth: 112, fontWeight: "600" },
  phoneCol: { flex: 1.1, minWidth: 102 },
  amountCol: { flex: 1, minWidth: 108, textAlign: "right" },
  remaining: { color: "#943F32", fontWeight: "700" },
  cardList: { gap: 12, paddingBottom: 24 },
  card: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#DFE5DF", padding: 16 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 16 },
  customerIcon: { width: 36, height: 36, borderRadius: 9, backgroundColor: "#EDF3E8", alignItems: "center", justifyContent: "center" },
  cardMeta: { alignItems: "flex-end", gap: 8 },
  cardName: { color: "#20332A", fontSize: 17, fontWeight: "600" },
  cardPhone: { color: "#627166", fontSize: 13, fontWeight: "400", marginTop: 5 },
  cardDate: { color: "#627166", fontSize: 11, fontWeight: "400" },
  cardAmounts: { flexDirection: "row", gap: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#E9EDE7" },
  amountBox: { flex: 1, minWidth: 0, backgroundColor: "#F6F9F2", borderRadius: 8, padding: 12 },
  remainingBox: { backgroundColor: "#FCF2EE" },
  amountLabel: { color: "#627166", fontSize: 12, fontWeight: "400", marginBottom: 7 },
  amountValue: { color: "#20332A", fontSize: 18, fontWeight: "700" },
  empty: { padding: 40, alignItems: "center", gap: 14 },
  emptyIcon: { width: 64, height: 64, borderRadius: 16, backgroundColor: "#EFF4EB", alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#627166", fontSize: 14, fontWeight: "500" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(25,42,32,0.42)", alignItems: "center", justifyContent: "center", padding: 18 },
  modalCard: { width: "100%", maxWidth: 540, maxHeight: "90%", backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#DFE5DF", overflow: "hidden", flexShrink: 1 },
  modalCardCompact: { maxWidth: "100%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 20, borderBottomWidth: 1, borderBottomColor: "#DFE5DF", flexShrink: 0 },
  modalTitle: { color: "#20332A", fontSize: 21, fontWeight: "700", letterSpacing: -.4 },
  modalSubtitle: { color: "#627166", fontSize: 12, fontWeight: "400", marginTop: 5, lineHeight: 18 },
  modalCloseBtn: { width: 40, height: 40, borderRadius: 8, backgroundColor: "#F0F4ED", alignItems: "center", justifyContent: "center" },
  formGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14, padding: 20 },
  fieldGroup: { width: "100%", gap: 7, flexShrink: 0 },
  amountField: { width: "auto", flexGrow: 1, flexBasis: "45%", minWidth: 110 },
  fieldLabel: { color: "#46604E", fontSize: 13, fontWeight: "600" },
  fieldInput: { minHeight: 46, borderWidth: 1, borderColor: "#D5E0D1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, color: "#283B30", fontSize: 15, fontWeight: "400", backgroundColor: "#FAFCF8" },
  remainingPreview: { backgroundColor: "#F5F8F0", borderWidth: 1, borderColor: "#DFE5DF", borderRadius: 8, padding: 14 },
  remainingPreviewValue: { color: "#943F32", fontSize: 24, fontWeight: "700" },
  modalActions: { flexDirection: "row", gap: 10, padding: 18, borderTopWidth: 1, borderTopColor: "#DFE5DF", backgroundColor: "#FAFCF8", flexShrink: 0 },
  modalBtn: { flex: 1, minHeight: 46, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  cancelBtn: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#DFE5DF" },
  cancelBtnText: { color: "#42604E", fontWeight: "600", fontSize: 14 },
  saveBtn: { backgroundColor: "#244F3B" },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  disabledBtn: { opacity: 0.65 },
});
