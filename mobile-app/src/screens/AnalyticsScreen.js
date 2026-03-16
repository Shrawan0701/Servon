import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Alert,
  Platform,
  Linking
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getAnalytics } from "../api";
import {
  VictoryBar,
  VictoryChart,
  VictoryAxis,
  VictoryTheme,
  VictoryTooltip,
} from "victory-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");
const toDateStr = (d) => d.toISOString().split("T")[0];

export default function AnalyticsScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [startDate, setStartDate] = useState(
    toDateStr(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
  );
  const [endDate, setEndDate] = useState(toDateStr(new Date()));

  useFocusEffect(
    useCallback(() => {
      loadAnalytics();
    }, [])
  );

  const loadAnalytics = async () => {
    try {
      const res = await getAnalytics();
      setData(res.data);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Unable to load analytics. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRangeSelect = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setStartDate(toDateStr(start));
    setEndDate(toDateStr(end));
  };

  // --- THE UNIVERSAL DOWNLOAD FIX ---
  const downloadReport = async (format) => {
    const token = await AsyncStorage.getItem("token");
    const baseUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";
    const downloadUrl = `${baseUrl}/api/sales/${format}?startDate=${startDate}&endDate=${endDate}&token=${token}`;

    if (Platform.OS === 'web') {
      // Direct browser download for localhost/web
      window.open(downloadUrl, '_blank');
    } else {
      // Mobile flow using FileSystem
      setDownloading(true);
      try {
        const filename = `servon-report-${Date.now()}.${format}`;
        const fileUri = FileSystem.cacheDirectory + filename;

        const res = await FileSystem.downloadAsync(downloadUrl, fileUri, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status !== 200) throw new Error("Download failed");

        await Sharing.shareAsync(res.uri, {
          mimeType: format === "pdf" ? "application/pdf" : "text/csv",
          dialogTitle: `Business Report (${format.toUpperCase()})`,
        });
      } catch (err) {
        Alert.alert("Export Error", "Mobile download failed. Try on web or check connection.");
      } finally {
        setDownloading(false);
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111827" />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  // --- DATA PREP ---
  const last30 = data?.last30Days || [];
  const totalRev = last30.reduce((s, d) => s + (parseFloat(d.revenue) || 0), 0) || 0;
  const totalOrd = last30.reduce((s, d) => s + (parseInt(d.orders) || 0), 0) || 0;
  const avgOrderValue = totalOrd ? totalRev / totalOrd : 0;
  const last7 = last30.slice(-7);
  const revenueChartData = last7.map((d) => ({
    x: new Date(d.date).getDate().toString(),
    y: parseFloat(d.revenue) || 0,
    label: `₹${(parseFloat(d.revenue) || 0).toLocaleString("en-IN")}`,
  }));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAnalytics(); }} />}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Business Overview</Text>
            <Text style={styles.headerSub}>Key metrics for the last 30 days</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="stats-chart" size={24} color="#111827" />
          </View>
        </View>

        {/* KPI SECTION */}
        <View style={styles.kpiGrid}>
          <KPICard label="Total Revenue" value={`₹${totalRev.toLocaleString("en-IN")}`} icon="wallet" color="#059669" bg="#ECFDF5" />
          <KPICard label="Total Orders" value={totalOrd.toLocaleString("en-IN")} icon="receipt" color="#2563EB" bg="#EFF6FF" />
        </View>

        <View style={styles.kpiGrid}>
          <KPICard label="Avg Order Value" value={`₹${avgOrderValue.toFixed(0)}`} icon="trending-up" color="#0F766E" bg="#ECFEFF" />
          <View style={styles.kpiCard}>
             <View style={[styles.kpiIcon, {backgroundColor: '#F3F4F6'}]}>
                <Ionicons name="time" size={20} color="#374151" />
             </View>
             <Text style={styles.kpiLabel}>Peak Hour</Text>
             <Text style={styles.kpiValue}>{data?.peakHour?.hour ? `${data.peakHour.hour}:00` : '--'}</Text>
          </View>
        </View>

        {/* REVENUE CHART */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Revenue Trend</Text>
        </View>
        <View style={styles.card}>
          <View style={{ alignItems: "center" }}>
            <VictoryChart theme={VictoryTheme.material} height={200} width={width - 40} padding={{ top: 20, bottom: 40, left: 60, right: 30 }}>
              <VictoryAxis style={axisStyle} />
              <VictoryAxis dependentAxis style={axisStyle} tickFormat={(x) => `₹${x / 1000}k`} />
              <VictoryBar 
                data={revenueChartData} 
                style={{ data: { fill: "#111827", width: 22 } }} 
                cornerRadius={{ top: 8 }}
                animate={{ duration: 500 }}
              />
            </VictoryChart>
          </View>
        </View>

        {/* TOP ITEMS - REMOVED PRICE SYMBOLS */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Top Selling Items</Text>
        </View>
        <View style={styles.card}>
          {data?.topItems?.length ? (
            data.topItems.slice(0, 5).map((item, i) => (
              <View key={i} style={styles.itemRow}>
                <View style={styles.itemRank}><Text style={styles.rankText}>{i + 1}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemSub}>{item.total_qty} units sold</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No sales data yet.</Text>
          )}
        </View>

        {/* EXPORT SECTION */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Download Reports</Text>
        </View>
        <View style={[styles.card, styles.exportCard]}>
          <View style={styles.rangeRow}>
            {[{ l: "7 Days", d: 7 }, { l: "30 Days", d: 30 }, { l: "90 Days", d: 90 }].map((range) => (
              <TouchableOpacity
                key={range.d}
                style={[styles.rangeBtn, startDate === toDateStr(new Date(Date.now() - range.d * 24 * 60 * 60 * 1000)) && styles.rangeBtnActive]}
                onPress={() => handleRangeSelect(range.d)}
              >
                <Text style={[styles.rangeBtnText, startDate === toDateStr(new Date(Date.now() - range.d * 24 * 60 * 60 * 1000)) && styles.rangeBtnTextActive]}>
                  {range.l}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.currentRange}>
            <Ionicons name="calendar" size={16} color="#6B7280" />
            <Text style={styles.rangeText}>{startDate} to {endDate}</Text>
          </View>

          <View style={styles.downloadRow}>
            <TouchableOpacity style={styles.pdfBtn} onPress={() => downloadReport("pdf")} disabled={downloading}>
              <Ionicons name="document-text" size={20} color="#fff" />
              <Text style={styles.btnText}>{downloading ? "Wait..." : "PDF"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.csvBtn} onPress={() => downloadReport("csv")} disabled={downloading}>
              <Text style={styles.csvBtnText}>CSV</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// --- COMPONENTS ---
function KPICard({ label, value, icon, color, bg }) {
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

// --- STYLES ---
const axisStyle = {
  axis: { stroke: "#E5E7EB" },
  grid: { stroke: "#F3F4F6", strokeDasharray: "4,4" },
  tickLabels: { fontSize: 10, fill: "#9CA3AF" },
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 8, fontSize: 13, color: "#6B7280" },
  header: { padding: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontSize: 24, fontWeight: "900", color: "#111827" },
  headerSub: { fontSize: 13, color: "#6B7280", marginTop: 3 },
  headerIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  sectionHeaderRow: { paddingHorizontal: 24, marginTop: 10, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  kpiGrid: { flexDirection: "row", gap: 12, paddingHorizontal: 24, marginBottom: 12 },
  kpiCard: { flex: 1, backgroundColor: "#fff", padding: 16, borderRadius: 20, borderWidth: 1, borderColor: "#E5E7EB" },
  kpiIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  kpiLabel: { fontSize: 11, color: "#9CA3AF", fontWeight: "700", textTransform: "uppercase" },
  kpiValue: { fontSize: 18, fontWeight: "800", color: "#111827", marginTop: 4 },
  card: { backgroundColor: "#fff", marginHorizontal: 24, marginBottom: 16, padding: 18, borderRadius: 20, borderWidth: 1, borderColor: "#E5E7EB" },
  itemRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  itemRank: { width: 28, height: 28, borderRadius: 8, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", marginRight: 12 },
  rankText: { fontSize: 12, fontWeight: "800", color: "#6B7280" },
  itemName: { fontSize: 14, fontWeight: "700", color: "#111827" },
  itemSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  rangeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  rangeBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center", backgroundColor: "#F9FAFB" },
  rangeBtnActive: { backgroundColor: "#111827", borderColor: "#111827" },
  rangeBtnText: { fontSize: 12, fontWeight: "700", color: "#6B7280" },
  rangeBtnTextActive: { color: "#fff" },
  currentRange: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F9FAFB", padding: 12, borderRadius: 12, marginBottom: 16 },
  rangeText: { fontSize: 13, color: "#374151", fontWeight: "600" },
  downloadRow: { flexDirection: "row", gap: 10 },
  pdfBtn: { flex: 3, backgroundColor: "#111827", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 14, gap: 8 },
  csvBtn: { flex: 1, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", borderRadius: 14 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  csvBtnText: { color: "#111827", fontWeight: "800", fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', paddingVertical: 20 }
});