import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { getCustomerOutstandingPDFUrl, getCustomerOutstandings } from "../api";
import localDB from "../services/LocalDB";
import networkMonitor from "../services/NetworkMonitor";

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

export default function CustomerOutstandingScreen() {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const isCompact = width < 720;
  const [records, setRecords] = useState([]);
  const [totalRemaining, setTotalRemaining] = useState("0.00");
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const online = await networkMonitor.checkConnectivity();
      if (online) {
        const res = await getCustomerOutstandings();
        setRecords(res.data?.records || []);
        setTotalRemaining(res.data?.totalRemaining || "0.00");
      } else {
        const localRecords = await localDB.getCustomerOutstandings();
        setRecords(localRecords);
        setTotalRemaining(localRecords.reduce((sum, record) => sum + Number(record.remaining_amount || 0), 0).toFixed(2));
      }
    } catch (err) {
      const localRecords = await localDB.getCustomerOutstandings();
      setRecords(localRecords);
      setTotalRemaining(localRecords.reduce((sum, record) => sum + Number(record.remaining_amount || 0), 0).toFixed(2));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const printOutstanding = async () => {
    const token = await AsyncStorage.getItem("token");
    if (!token) {
      Alert.alert("Session Expired", "Please log in again and retry the download.");
      return;
    }

    setPrinting(true);
    try {
      const online = await networkMonitor.checkConnectivity();
      if (!online) {
        const profile = await localDB.getProfile();
        const businessName = profile?.business_name || profile?.businessName || "Servon Hotel";
        const rows = records.map((record) => `
          <tr>
            <td>${fmtDate(record.created_at)}</td>
            <td>${record.customer_name || ""}</td>
            <td>${record.phone_number || ""}</td>
            <td>${rs(record.total_amount)}</td>
            <td><strong>${rs(record.remaining_amount)}</strong></td>
          </tr>
        `).join("");
        const html = `
          <html><head><style>
            body{font-family:Arial,sans-serif;padding:28px;color:#111827}
            h1{margin:0 0 6px;font-size:26px} h2{margin:0 0 8px;font-size:18px}
            table{width:100%;border-collapse:collapse;margin-top:24px;font-size:12px}
            th,td{padding:10px;border-bottom:1px solid #E5E7EB;text-align:left}
            th{background:#F3F4F6} .total{font-weight:800;background:#F9FAFB}
          </style></head><body>
            <h1>${businessName}</h1>
            <h2>Customer Outstanding Report</h2>
            <div>Generated: ${new Date().toLocaleString("en-IN")}</div>
            <table><thead><tr><th>Date</th><th>Customer Name</th><th>Phone Number</th><th>Total Amount</th><th>Remaining Amount</th></tr></thead>
            <tbody>${rows}<tr class="total"><td colspan="4">GRAND TOTAL</td><td>${rs(totalRemaining)}</td></tr></tbody></table>
          </body></html>
        `;
        await Print.printAsync({ html });
        return;
      }
      const url = getCustomerOutstandingPDFUrl(token);
      if (Platform.OS === "web") {
        window.open(url, "_blank");
      } else {
        const fileUri = FileSystem.cacheDirectory + `customer-outstanding-${Date.now()}.pdf`;
        const res = await FileSystem.downloadAsync(url, fileUri, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status !== 200) throw new Error(`Server responded with status ${res.status}`);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(res.uri, {
            mimeType: "application/pdf",
            dialogTitle: "Customer Outstanding Report",
            UTI: "com.adobe.pdf",
          });
        }
      }
    } catch (err) {
      Alert.alert("Print Failed", "Could not generate the outstanding report.");
    } finally {
      setPrinting(false);
    }
  };

  const renderTableRow = ({ item }) => (
    <View style={styles.row}>
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
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.cardName} numberOfLines={1}>{item.customer_name}</Text>
          <Text style={styles.cardPhone}>{item.phone_number}</Text>
        </View>
        <Text style={styles.cardDate}>{fmtDate(item.created_at)}</Text>
      </View>
      <View style={styles.cardAmounts}>
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Total Amount</Text>
          <Text style={styles.amountValue}>{rs(item.total_amount)}</Text>
        </View>
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Remaining Amount</Text>
          <Text style={[styles.amountValue, styles.remaining]}>{rs(item.remaining_amount)}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, isCompact && styles.headerCompact]}>
        <View style={styles.titleRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#111827" />
          </TouchableOpacity>
          <View style={styles.titleBlock}>
            <Text style={[styles.title, isCompact && styles.titleCompact]} numberOfLines={2}>Customer Outstanding</Text>
            <Text style={styles.subtitle}>Total outstanding: {rs(totalRemaining)}</Text>
          </View>
        </View>
        <TouchableOpacity style={[styles.printBtn, isCompact && styles.printBtnCompact]} onPress={printOutstanding} disabled={printing}>
          {printing ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="print-outline" size={18} color="#fff" />}
          <Text style={styles.printText}>Print Outstanding</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.table, isCompact && styles.mobileList]}>
        {!isCompact && (
          <View style={[styles.row, styles.headRow]}>
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
            data={records}
            keyExtractor={(item, index) => `${item.phone_number}-${item.created_at || index}-${index}`}
            renderItem={isCompact ? renderCard : renderTableRow}
            contentContainerStyle={isCompact ? styles.cardList : null}
            ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No outstanding customers.</Text></View>}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF8F5", padding: 18 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 },
  headerCompact: { alignItems: "stretch", flexDirection: "column", gap: 12 },
  titleRow: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 },
  titleBlock: { flex: 1, minWidth: 0 },
  backBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E8E2D9" },
  title: { fontSize: 24, fontWeight: "900", color: "#111827" },
  titleCompact: { fontSize: 22, lineHeight: 26 },
  subtitle: { marginTop: 2, color: "#6B7280", fontWeight: "700" },
  printBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#111827", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  printBtnCompact: { width: "100%" },
  printText: { color: "#fff", fontWeight: "800" },
  table: { flex: 1, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E8E2D9", overflow: "hidden" },
  mobileList: { backgroundColor: "transparent", borderWidth: 0, borderRadius: 0, overflow: "visible" },
  row: { flexDirection: "row", alignItems: "center", minHeight: 48, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  headRow: { backgroundColor: "#F3F4F6" },
  th: { fontSize: 12, fontWeight: "900", color: "#374151", textTransform: "uppercase" },
  td: { fontSize: 14, fontWeight: "700", color: "#111827" },
  dateCol: { flex: 0.9, minWidth: 92 },
  nameCol: { flex: 1.4, minWidth: 130 },
  phoneCol: { flex: 1, minWidth: 104 },
  amountCol: { flex: 1, minWidth: 126, textAlign: "right" },
  remaining: { color: "#B91C1C" },
  cardList: { gap: 10, paddingBottom: 24 },
  card: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E8E2D9", padding: 14 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  cardName: { color: "#111827", fontSize: 16, fontWeight: "900" },
  cardPhone: { color: "#6B7280", fontSize: 13, fontWeight: "700", marginTop: 3 },
  cardDate: { color: "#374151", fontSize: 12, fontWeight: "800", backgroundColor: "#F3F4F6", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  cardAmounts: { flexDirection: "row", gap: 10 },
  amountBox: { flex: 1, minWidth: 0, backgroundColor: "#FAFAFA", borderRadius: 10, padding: 10 },
  amountLabel: { color: "#6B7280", fontSize: 11, fontWeight: "800", marginBottom: 4 },
  amountValue: { color: "#111827", fontSize: 14, fontWeight: "900" },
  empty: { padding: 36, alignItems: "center" },
  emptyText: { color: "#6B7280", fontWeight: "700" },
});
