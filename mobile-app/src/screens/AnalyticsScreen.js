import React, { useState, useCallback, useEffect } from "react";
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
  useWindowDimensions,
  TextInput,
  Modal,
  Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getAnalytics, getExpenses, addExpense, deleteExpense, updateExpense } from "../api";
import {
  VictoryBar,
  VictoryChart,
  VictoryAxis,
  VictoryTheme,
  VictoryContainer,
} from "victory-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const IS_WEB = Platform.OS === "web";
const toDateStr = (d) => d.toISOString().split("T")[0];

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const PRIMARY      = "#0F172A";
const ACCENT       = "#10B981";
const BG           = "#F8FAFC";
const CARD_BG      = "#FFFFFF";
const BORDER       = "#E2E8F0";
const TEXT_MAIN    = "#1E293B";
const TEXT_MUTED   = "#64748B";
const TEXT_FAINT   = "#94A3B8";
const CONTENT_MAX  = 1100;

const FL_BG    = "#F7F7F7";
const FL_DARK  = "#0F1729";
const FL_GREEN = "#22C55E";
const FL_RED   = "#EF4444";
const FL_BORD  = "#E4E4E4";

// ── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: "Utilities",    icon: "flash",                      color: "#F59E0B", bg: "#FEF3C7", desc: "Power, water & utility charges" },
  { key: "Payroll",      icon: "people",                     color: "#3B82F6", bg: "#EFF6FF", desc: "Wages, salaries & advances" },
  { key: "Procurement",  icon: "cube",                       color: "#8B5CF6", bg: "#F5F3FF", desc: "Raw materials & supplies" },
  { key: "Maintenance",  icon: "construct",                  color: "#F97316", bg: "#FFF7ED", desc: "Equipment & repair costs" },
  { key: "Waste",        icon: "trash",                      color: "#EF4444", bg: "#FEF2F2", desc: "Expired or wasted items" },
  { key: "Other",        icon: "ellipsis-horizontal-circle", color: "#6B7280", bg: "#F3F4F6", desc: "Miscellaneous expenses" },
];

const PERIODS = ["daily", "weekly", "monthly"];
const getCat  = (key) => CATEGORIES.find((c) => c.key === key) || CATEGORIES[5];
const fmt     = (n)   => "₹" + parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const dayOf   = (d)   => new Date(d).getDate();
const monOf   = (d)   => new Date(d).toLocaleDateString("en-IN", { month: "short" }).toUpperCase();

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
export default function AnalyticsScreen() {
  const [activeMainTab, setActiveMainTab] = useState("Analytics");
  const [data,          setData]          = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [downloading,   setDownloading]   = useState(false);
  const [startDate,     setStartDate]     = useState(toDateStr(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const [endDate,       setEndDate]       = useState(toDateStr(new Date()));

  const { width: screenWidth } = useWindowDimensions();
  const isSmallWeb  = IS_WEB && screenWidth < 600;
  const isMediumWeb = IS_WEB && screenWidth >= 600 && screenWidth < 900;
  const H_PAD       = IS_WEB ? (isSmallWeb ? 16 : 48) : 20;
  const contentWidth = IS_WEB ? Math.min(screenWidth, CONTENT_MAX) : screenWidth;

  const kpiCardWidth = IS_WEB
    ? isSmallWeb  ? (contentWidth - H_PAD * 2 - 12) / 2
    : isMediumWeb ? (contentWidth - H_PAD * 2 - 48) / 2
    :               (contentWidth - H_PAD * 2 - 48) / 4
    : (screenWidth - 40 - 16) / 2;

  const chartWidth = IS_WEB
    ? Math.min(contentWidth - H_PAD * 2 - (isSmallWeb ? 32 : 64), contentWidth - H_PAD * 2 - 40)
    : screenWidth - 40 - 40;

  useFocusEffect(useCallback(() => { loadAnalytics(); }, []));

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
    const end = new Date(), start = new Date();
    start.setDate(end.getDate() - days);
    setStartDate(toDateStr(start));
    setEndDate(toDateStr(end));
  };

  // ─── DOWNLOAD REPORT (Analytics tab) ──────────────────────────────────────
  const downloadReport = async (format) => {
    const token = await AsyncStorage.getItem("token");
    const baseUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";
    // We add the token to the URL so the backend can authenticate the GET request
    const url = `${baseUrl}/api/sales/${format}?startDate=${startDate}&endDate=${endDate}&token=${token}&includeDailyTable=true`;

    setDownloading(true);
    try {
      if (Platform.OS === "web") {
        // FIXED WEB DOWNLOAD: Direct link approach is more reliable on mobile web than fetch-blob
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `report-${startDate}-to-${endDate}.${format}`);
        link.setAttribute("target", "_blank"); // Necessary for mobile browsers
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // NATIVE DOWNLOAD
        const filename = `servon-report-${Date.now()}.${format}`;
        const fileUri = FileSystem.cacheDirectory + filename;
        const res = await FileSystem.downloadAsync(url, fileUri, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status !== 200) throw new Error("Download failed");

        // Request permission and share
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(res.uri, {
            mimeType: format === "pdf" ? "application/pdf" : "text/csv",
            dialogTitle: `Business Report (${format.toUpperCase()})`,
            UTI: format === "pdf" ? "com.adobe.pdf" : "public.comma-separated-values-text",
          });
        }
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Export Error", "Could not download report. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={[styles.loadingText, { marginTop: 12 }]}>Refining your data...</Text>
      </View>
    );
  }

  const last30        = data?.last30Days || [];
  const totalRev      = last30.reduce((s, d) => s + (parseFloat(d.revenue) || 0), 0) || 0;
  const totalOrd      = last30.reduce((s, d) => s + (parseInt(d.orders)   || 0), 0) || 0;
  const avgOrderValue = totalOrd ? totalRev / totalOrd : 0;
  const last7         = last30.slice(-7);
  const revenueChartData = last7.map((d) => ({
    x:     new Date(d.date).getDate().toString(),
    y:     parseFloat(d.revenue) || 0,
    label: `₹${(parseFloat(d.revenue) || 0).toLocaleString("en-IN")}`,
  }));

  const calcTrend = (curr, prev) => {
    if (!prev || prev === 0) return null;
    const pct = ((curr - prev) / prev) * 100;
    return { label: `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`, up: pct >= 0 };
  };
  const prev7    = last30.slice(-14, -7);
  const curr7Rev = last7.reduce((s, d) => s + (parseFloat(d.revenue) || 0), 0);
  const prev7Rev = prev7.reduce((s, d) => s + (parseFloat(d.revenue) || 0), 0);
  const curr7Ord = last7.reduce((s, d) => s + (parseInt(d.orders)   || 0), 0);
  const prev7Ord = prev7.reduce((s, d) => s + (parseInt(d.orders)   || 0), 0);
  const revTrend = calcTrend(curr7Rev, prev7Rev);
  const ordTrend = calcTrend(curr7Ord, prev7Ord);
  const avgTrend = calcTrend(curr7Rev / (curr7Ord || 1), prev7Rev / (prev7Ord || 1));
  const maxQty   = data?.topItems?.length ? Math.max(...data.topItems.slice(0, 5).map(i => parseInt(i.total_qty) || 0)) : 1;

  return (
    <SafeAreaView style={styles.container}>

      {/* ── TOP TAB BAR ── */}
      <View style={styles.mainTabBar}>
        {["Analytics", "Expenses"].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.mainTab, activeMainTab === tab && styles.mainTabActive]}
            onPress={() => setActiveMainTab(tab)}
          >
            <Ionicons name={tab === "Analytics" ? "bar-chart" : "receipt"} size={15} color={activeMainTab === tab ? "#fff" : TEXT_MUTED} />
            <Text style={[styles.mainTabText, activeMainTab === tab && styles.mainTabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── ANALYTICS TAB ── */}
      {activeMainTab === "Analytics" && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, IS_WEB && { alignSelf: "center", width: "100%", maxWidth: CONTENT_MAX }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAnalytics(); }} tintColor={ACCENT} colors={[ACCENT]} />}
        >
          {/* HEADER */}
          <View style={[styles.header, { paddingHorizontal: H_PAD }]}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.greeting}>Performance Overview</Text>
              <Text style={[styles.headerTitle, isSmallWeb && { fontSize: 24 }]}>Analytics</Text>
              <Text style={styles.headerSub}>{startDate} — {endDate}</Text>
            </View>
            <TouchableOpacity style={styles.refreshBtn} onPress={() => { setRefreshing(true); loadAnalytics(); }} activeOpacity={0.7}>
              <Ionicons name="sync" size={20} color={PRIMARY} />
            </TouchableOpacity>
          </View>

          {/* KPI GRID */}
          <View style={[styles.kpiGrid, { paddingHorizontal: H_PAD }, isSmallWeb && styles.kpiGridSmall]}>
            <KPICard label="REVENUE"   value={`₹${totalRev.toLocaleString("en-IN")}`} icon="wallet"  color={ACCENT}  bg="#ECFDF5" trend={revTrend?.label} trendUp={revTrend?.up} cardWidth={kpiCardWidth} isSmall={isSmallWeb} />
            <KPICard label="ORDERS"    value={totalOrd.toLocaleString("en-IN")}         icon="cart"    color="#3B82F6" bg="#EFF6FF" trend={ordTrend?.label} trendUp={ordTrend?.up} cardWidth={kpiCardWidth} isSmall={isSmallWeb} />
            <KPICard label="AVG ORDER" value={`₹${avgOrderValue.toFixed(0)}`}           icon="receipt" color="#F59E0B" bg="#FFFBEB" trend={avgTrend?.label} trendUp={avgTrend?.up} cardWidth={kpiCardWidth} isSmall={isSmallWeb} />
            <KPICard label="PEAK HOUR" value={data?.peakHour?.hour ? `${data.peakHour.hour}:00` : "--:--"} icon="time" color="#8B5CF6" bg="#F5F3FF" cardWidth={kpiCardWidth} isSmall={isSmallWeb} />
          </View>

          {/* CHART */}
          <View style={{ paddingHorizontal: H_PAD, marginTop: 32 }}>
            <SectionHeader title="Revenue Insights" subtitle="Visualizing your daily growth" icon="analytics-outline" />
          </View>
          <View style={[styles.chartSection, { marginHorizontal: H_PAD }]}>
            <View style={styles.chartWrapper}>
              <VictoryChart theme={VictoryTheme.material} height={isSmallWeb ? 220 : 280} width={chartWidth} padding={{ top: 20, bottom: 50, left: isSmallWeb ? 48 : 60, right: 20 }} containerComponent={<VictoryContainer responsive={false} />}>
                <VictoryAxis style={axisStyle} />
                <VictoryAxis dependentAxis style={axisStyle} tickFormat={(x) => `₹${x >= 1000 ? `${(x / 1000).toFixed(0)}k` : x}`} />
                <VictoryBar data={revenueChartData} style={{ data: { fill: PRIMARY, width: isSmallWeb ? 18 : 26 } }} cornerRadius={{ top: 8 }} animate={{ duration: 800, onLoad: { duration: 400 } }} />
              </VictoryChart>
            </View>
            {revenueChartData.every(d => d.y === 0) && (
              <View style={styles.chartEmpty}>
                <Ionicons name="bar-chart-outline" size={40} color={TEXT_FAINT} />
                <Text style={styles.chartEmptyText}>No sales activity recorded</Text>
              </View>
            )}
          </View>

          {/* LOWER SPLIT */}
          <View style={[styles.splitRow, { paddingHorizontal: H_PAD }, (isSmallWeb || isMediumWeb || !IS_WEB) && { flexDirection: "column" }]}>
            <View style={[styles.section, { flex: 1.5 }]}>
              <SectionHeader title="Top Items" subtitle="Highest volume products" icon="trophy-outline" />
              <View style={styles.premiumCard}>
                {data?.topItems?.length ? (
                  data.topItems.slice(0, 5).map((item, i) => {
                    const pct = maxQty > 0 ? (parseInt(item.total_qty) || 0) / maxQty : 0;
                    return (
                      <View key={i} style={styles.itemRow}>
                        <View style={styles.itemHeader}>
                          <Text style={styles.itemName}>{item.name}</Text>
                          <Text style={styles.itemQty}>{item.total_qty} Sold</Text>
                        </View>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: i === 0 ? ACCENT : PRIMARY }]} />
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.emptyItems}><Text style={styles.emptyText}>Data pending...</Text></View>
                )}
              </View>
            </View>

            <View style={[styles.section, { flex: 1 }]}>
              <SectionHeader title="Reports" subtitle="Export data" icon="cloud-download-outline" />
              <View style={styles.premiumCard}>
                <Text style={styles.fieldLabel}>DATE RANGE</Text>
                <View style={styles.rangeSelector}>
                  {[7, 30, 90].map((d) => {
                    const isActive = startDate === toDateStr(new Date(Date.now() - d * 86400000));
                    return (
                      <TouchableOpacity key={d} style={[styles.rangeTab, isActive && styles.rangeTabActive]} onPress={() => handleRangeSelect(d)}>
                        <Text style={[styles.rangeTabText, isActive && { color: "#fff" }]}>{d}d</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TouchableOpacity style={[styles.exportBtn, downloading && { opacity: 0.7 }]} onPress={() => downloadReport("pdf")} disabled={downloading}>
                  {downloading ? <ActivityIndicator color="#fff" /> : <><Ionicons name="document-text" size={18} color="#fff" /><Text style={styles.exportBtnText}>PDF Report</Text></>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.csvBtn} onPress={() => downloadReport("csv")}>
                  <Ionicons name="grid-outline" size={16} color={PRIMARY} />
                  <Text style={styles.csvBtnText}>Export CSV</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {activeMainTab === "Expenses" && <ExpensesTab />}
    </SafeAreaView>
  );
}

function SectionHeader({ title, subtitle, icon }) {
  return (
    <View style={secStyles.container}>
      <View style={secStyles.iconBox}><Ionicons name={icon} size={18} color={PRIMARY} /></View>
      <View><Text style={secStyles.title}>{title}</Text><Text style={secStyles.sub}>{subtitle}</Text></View>
    </View>
  );
}

function KPICard({ label, value, icon, color, bg, trend, trendUp, cardWidth, isSmall }) {
  return (
    <View style={[styles.kpiCard, { width: cardWidth }, isSmall && styles.kpiCardSmall]}>
      <View style={[styles.kpiTopRow, isSmall && { marginBottom: 10 }]}>
        <View style={[styles.kpiIconBox, { backgroundColor: bg }, isSmall && { width: 36, height: 36 }]}>
          <Ionicons name={icon} size={isSmall ? 16 : 20} color={color} />
        </View>
        {trend && (
          <View style={[styles.trendPill, { backgroundColor: trendUp ? "#DCFCE7" : "#FEE2E2" }]}>
            <Text style={[styles.trendPillText, { color: trendUp ? "#059669" : "#DC2626" }]}>{trend}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.kpiLabel, isSmall && { fontSize: 10 }]}>{label}</Text>
      <Text style={[styles.kpiValue, isSmall && { fontSize: 18 }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

const axisStyle = {
  axis:       { stroke: "transparent" },
  grid:       { stroke: "#E2E8F0", strokeDasharray: "4,4" },
  tickLabels: { fontSize: 11, fill: TEXT_MUTED, fontWeight: "600" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPENSES TAB
// ═══════════════════════════════════════════════════════════════════════════════
function ExpensesTab() {
  const [period,        setPeriod]        = useState("monthly");
  const [data,          setData]          = useState(null);
  const [totalSales,    setTotalSales]    = useState(0);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [showModal,     setShowModal]     = useState(false);
  const [editingExp,    setEditingExp]    = useState(null);
  const [deleting,      setDeleting]      = useState(null);
  const [ledgerTab,     setLedgerTab]     = useState("Expenses");
  const [exporting,     setExporting]     = useState(false);

  useFocusEffect(useCallback(() => { load(); }, [period]));

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [expRes, analyticsRes] = await Promise.all([getExpenses(period), getAnalytics()]);
      setData(expRes.data);
      const aData = analyticsRes?.data;
      setAnalyticsData(aData);
      const sales =
        aData?.totalRevenue ||
        aData?.total_revenue ||
        aData?.month_revenue ||
        (aData?.last30Days?.reduce((s, d) => s + (parseFloat(d.revenue) || 0), 0)) ||
        0;
      setTotalSales(sales);
    } catch (err) {
      console.error("load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDelete = (exp) => {
    const msg = `Delete "${exp.category}" — ${fmt(exp.amount)}?`;
    if (Platform.OS === "web") {
      if (window.confirm(msg)) confirmDelete(exp.id);
    } else {
      Alert.alert("Delete Expense", msg, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => confirmDelete(exp.id) },
      ]);
    }
  };

  const confirmDelete = async (id) => {
    setDeleting(id);
    try { await deleteExpense(id); load(); }
    catch { Alert.alert("Error", "Could not delete expense. Try again."); }
    finally { setDeleting(null); }
  };

  const handleEdit   = (exp) => { setEditingExp(exp); setShowModal(true); };
  const handleAddNew = ()    => { setEditingExp(null); setShowModal(true); };

  // ── EXPORT CSV ────────────────────────────────────────────────────────────
  const exportCSV = async () => {
    if (!expenses.length) { Alert.alert("No Data", "No expenses to export."); return; }
    setExporting(true);
    try {
      const rows = [
        ["Date", "Category", "Description", "Amount (₹)"],
        ...expenses.map((e) => [e.expense_date?.split("T")[0] || "", e.category, e.description || "", parseFloat(e.amount || 0).toFixed(2)]),
        [],
        ["", "", "TOTAL", parseFloat(grandTotal).toFixed(2)],
      ];
      const csvContent = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");

      if (Platform.OS === "web") {
        // FIXED WEB CSV: Explicitly define UTF-8 BOM for Excel compatibility on mobile
        const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `expenses_${period}_${toDateStr(new Date())}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const path = FileSystem.cacheDirectory + `expenses_${period}_${Date.now()}.csv`;
        await FileSystem.writeAsStringAsync(path, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(path, { mimeType: "text/csv", dialogTitle: "Export Expenses CSV" });
      }
    } catch (err) {
      Alert.alert("Export Error", "Could not export CSV.");
    } finally {
      setExporting(false);
    }
  };

  // ── EXPORT PDF ────────────────────────────────────────────────────────────
  // WEB FIX: Open HTML in a new tab and trigger the browser's print-to-PDF dialog
  // instead of downloading as an .html file.
  // Native: uses expo-print to generate a real PDF and share it.
  const exportPDF = async () => {
    if (!expenses.length) { Alert.alert("No Data", "No expenses to export."); return; }
    setExporting(true);
    try {
      const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);
      const today       = toDateStr(new Date());

      const catTotals = {};
      expenses.forEach((e) => { catTotals[e.category] = (catTotals[e.category] || 0) + parseFloat(e.amount || 0); });
      const catRows = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
        const pct = grandTotal ? ((amt / grandTotal) * 100).toFixed(1) : "0.0";
        return `<tr><td>${cat}</td><td style="text-align:right">₹${amt.toLocaleString("en-IN")}</td><td style="text-align:right">${pct}%</td></tr>`;
      }).join("");

      const expRows = expenses.map((e, i) => `
        <tr style="background:${i % 2 === 0 ? "#fff" : "#F9FAFB"}">
          <td>${e.expense_date?.split("T")[0] || ""}</td><td>${e.category}</td>
          <td>${e.description || "—"}</td>
          <td style="text-align:right;font-weight:700;color:#EF4444">₹${parseFloat(e.amount || 0).toLocaleString("en-IN")}</td>
        </tr>`).join("");

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
        <style>
          *{box-sizing:border-box;margin:0;padding:0}
          body{font-family:-apple-system,Helvetica,Arial,sans-serif;padding:32px;color:#111}
          @media print{body{padding:20px}.no-print{display:none}}
          .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;border-bottom:2px solid #0F1729;padding-bottom:16px}
          .header-left h1{font-size:22px;font-weight:900;color:#0F1729}
          .header-left p{font-size:13px;color:#6B7280;margin-top:4px}
          .header-right .badge{display:inline-block;background:#0F1729;color:#fff;font-size:11px;font-weight:800;padding:4px 12px;border-radius:20px}
          .header-right .date{font-size:12px;color:#9CA3AF;margin-top:6px}
          .summary{display:flex;gap:12px;margin-bottom:28px}
          .card{flex:1;border-radius:10px;padding:14px 16px}
          .card-label{font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px}
          .card-value{font-size:20px;font-weight:900}
          .card-green{background:#F0FDF4}.card-green .card-label,.card-green .card-value{color:#059669}
          .card-red{background:#FEF2F2}.card-red .card-label,.card-red .card-value{color:#EF4444}
          .card-blue{background:#EFF6FF}.card-blue .card-label,.card-blue .card-value{color:#3B82F6}
          .section-title{font-size:13px;font-weight:800;color:#374151;letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px;margin-top:24px}
          table{width:100%;border-collapse:collapse;font-size:13px}
          th{background:#0F1729;color:#fff;padding:10px 14px;text-align:left;font-size:11px;font-weight:700}
          td{padding:9px 14px;border-bottom:1px solid #F3F4F6}
          .total-row td{font-weight:900;background:#FEF2F2;color:#EF4444;border-top:2px solid #EF4444}
          .footer{margin-top:32px;padding-top:12px;border-top:1px solid #E5E7EB;font-size:11px;color:#9CA3AF;text-align:center}
          .print-hint{text-align:center;padding:16px;background:#F0FDF4;border-radius:8px;font-size:13px;color:#059669;font-weight:700;margin-bottom:20px}
        </style></head><body>
        <div class="print-hint no-print">📄 Press Ctrl+P (or Cmd+P on Mac) → Save as PDF</div>
        <div class="header">
          <div class="header-left"><h1>Expense Report</h1><p>Period: ${periodLabel} &nbsp;·&nbsp; ${expenses.length} expense${expenses.length !== 1 ? "s" : ""}</p></div>
          <div class="header-right"><div class="badge">${periodLabel.toUpperCase()}</div><div class="date">Generated: ${today}</div></div>
        </div>
        <div class="summary">
          <div class="card card-green"><div class="card-label">Total Sales</div><div class="card-value">₹${parseFloat(totalSales).toLocaleString("en-IN")}</div></div>
          <div class="card card-red"><div class="card-label">Total Expenses</div><div class="card-value">₹${parseFloat(grandTotal).toLocaleString("en-IN")}</div></div>
          <div class="card card-blue"><div class="card-label">Net Profit</div><div class="card-value" style="color:${(totalSales - grandTotal) >= 0 ? "#059669" : "#EF4444"}">${(totalSales - grandTotal) >= 0 ? "" : "-"}₹${Math.abs(totalSales - grandTotal).toLocaleString("en-IN")}</div></div>
        </div>
        <div class="section-title">Category Breakdown</div>
        <table><thead><tr><th>Category</th><th style="text-align:right">Amount</th><th style="text-align:right">% of Total</th></tr></thead>
        <tbody>${catRows}<tr class="total-row"><td>TOTAL</td><td style="text-align:right">₹${parseFloat(grandTotal).toLocaleString("en-IN")}</td><td style="text-align:right">100%</td></tr></tbody></table>
        <div class="section-title">Detailed Ledger</div>
        <table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>${expRows}<tr class="total-row"><td colspan="3">TOTAL</td><td style="text-align:right">₹${parseFloat(grandTotal).toLocaleString("en-IN")}</td></tr></tbody></table>
        <div class="footer">Generated automatically · ${today}</div>
        </body></html>`;

      if (Platform.OS === "web") {
        // ── WEB FIX: open in new tab + auto-trigger print dialog (Save as PDF) ──
        const newTab = window.open("", "_blank");
        if (newTab) {
          newTab.document.write(html);
          newTab.document.close();
          newTab.focus();
          // Small delay lets the browser render the HTML before print dialog
          setTimeout(() => {
            newTab.print();
          }, 600);
        } else {
          // Popup blocked fallback — download as HTML with a clear hint inside
          const blob = new Blob([html], { type: "text/html" });
          const href = URL.createObjectURL(blob);
          const a    = document.createElement("a");
          a.href = href;
          a.download = `expenses_${period}_${today}.html`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          URL.revokeObjectURL(href);
          Alert.alert(
            "Popup Blocked",
            "Your browser blocked the PDF window. The file was downloaded as HTML — open it in your browser and press Ctrl+P to save as PDF.",
          );
        }
      } else {
        // ── NATIVE: use expo-print to get a real PDF ──
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Export Expenses PDF" });
      }
    } catch (err) {
      console.error("PDF error:", err);
      Alert.alert("Export Error", "Could not generate PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <View style={FL.center}><ActivityIndicator size="large" color={FL_DARK} /></View>;

  const grandTotal = data?.grandTotal || 0;
  const expenses   = data?.expenses   || [];
  const netProfit  = totalSales - grandTotal;

  const salesList = (() => {
    const days = analyticsData?.last30Days || [];
    const now  = new Date();
    return days.filter((d) => {
      const dt = new Date(d.date);
      if (period === "daily")  return dt.toDateString() === now.toDateString();
      if (period === "weekly") return (now - dt) <= 7 * 86400000;
      return true;
    }).filter((d) => (parseFloat(d.revenue) || 0) > 0);
  })();

  return (
    <View style={{ flex: 1, backgroundColor: FL_BG }}>

      {/* Totals Banner */}
      <View style={FL.totalsBanner}>
        <View style={FL.totalsRow}>
          <View style={[FL.totalsIcon, { backgroundColor: "#DCFCE7" }]}><Ionicons name="trending-up" size={13} color={FL_GREEN} /></View>
          <Text style={FL.totalsLabel}>TOTAL SALES</Text>
          <Text style={[FL.totalsValue, { color: FL_GREEN }]}>{fmt(totalSales)}</Text>
        </View>
        <View style={FL.totalsRow}>
          <View style={[FL.totalsIcon, { backgroundColor: "#FEE2E2" }]}><Ionicons name="trending-down" size={13} color={FL_RED} /></View>
          <Text style={FL.totalsLabel}>TOTAL EXPENSES</Text>
          <Text style={[FL.totalsValue, { color: FL_RED }]}>{fmt(grandTotal)}</Text>
        </View>
        <View style={[FL.totalsRow, { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: FL_BORD }]}>
          <View style={[FL.totalsIcon, { backgroundColor: netProfit >= 0 ? "#DCFCE7" : "#FEE2E2" }]}>
            <Ionicons name={netProfit >= 0 ? "checkmark-circle" : "alert-circle"} size={13} color={netProfit >= 0 ? FL_GREEN : FL_RED} />
          </View>
          <Text style={FL.totalsLabel}>NET PROFIT</Text>
          <Text style={[FL.totalsValue, { color: netProfit >= 0 ? FL_GREEN : FL_RED }]}>{netProfit >= 0 ? "" : "-"}{fmt(Math.abs(netProfit))}</Text>
        </View>
      </View>

      {/* Ledger Tabs */}
      <View style={FL.tabRow}>
        {["Sales", "Expenses"].map((t) => (
          <TouchableOpacity key={t} style={[FL.tabBtn, ledgerTab === t && FL.tabBtnActive]} onPress={() => setLedgerTab(t)}>
            <Text style={[FL.tabBtnText, ledgerTab === t && FL.tabBtnTextActive]}>{t.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Period Chips */}
      <View style={FL.periodRow}>
        {PERIODS.map((p) => (
          <TouchableOpacity key={p} style={[FL.periodChip, period === p && FL.periodChipActive]} onPress={() => setPeriod(p)}>
            <Text style={[FL.periodChipText, period === p && FL.periodChipTextActive]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Export Row */}
      {ledgerTab === "Expenses" && (
        <View style={FL.exportRow}>
          <Text style={FL.exportLabel}>EXPORT {period.toUpperCase()}</Text>
          <TouchableOpacity style={[FL.exportBtn, { backgroundColor: FL_DARK }, exporting && { opacity: 0.5 }]} onPress={exportPDF} disabled={exporting}>
            {exporting ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name="document-text-outline" size={13} color="#fff" /><Text style={FL.exportBtnText}>PDF</Text></>}
          </TouchableOpacity>
          <TouchableOpacity style={[FL.exportBtn, { backgroundColor: "#059669" }, exporting && { opacity: 0.5 }]} onPress={exportCSV} disabled={exporting}>
            {exporting ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name="document-outline" size={13} color="#fff" /><Text style={FL.exportBtnText}>CSV</Text></>}
          </TouchableOpacity>
        </View>
      )}

      {/* List */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110, paddingTop: 6 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={FL_DARK} />}>
        {ledgerTab === "Sales" ? (
          !salesList.length ? (
            <View style={FL.emptyWrap}>
              <View style={FL.emptyIconBox}><Ionicons name="cash-outline" size={36} color="#9CA3AF" /></View>
              <Text style={FL.emptyTitle}>No sales {period === "daily" ? "today" : `this ${period.replace("ly", "")}`}</Text>
              <Text style={FL.emptySub}>Sales will appear here as orders come in</Text>
            </View>
          ) : (
            salesList.map((sale, i) => (
              <View key={i} style={FL.expRow}>
                <View style={FL.dateBlock}><Text style={FL.dateDay}>{dayOf(sale.date)}</Text><Text style={FL.dateMon}>{monOf(sale.date)}</Text></View>
                <View style={[FL.catIconBox, { backgroundColor: "#DCFCE7" }]}><Ionicons name="receipt" size={18} color={FL_GREEN} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={FL.expCat}>{sale.orders} {sale.orders === 1 ? "order" : "orders"}</Text>
                  <Text style={FL.expDesc}>Daily sales revenue</Text>
                </View>
                <Text style={[FL.expAmt, { color: FL_GREEN }]}>+{fmt(sale.revenue)}</Text>
              </View>
            ))
          )
        ) : !expenses.length ? (
          <View style={FL.emptyWrap}>
            <View style={FL.emptyIconBox}><Ionicons name="receipt-outline" size={36} color="#9CA3AF" /></View>
            <Text style={FL.emptyTitle}>{period === "daily" ? "No expenses today" : `No ${period} expenses`}</Text>
            <Text style={FL.emptySub}>Tap "+ ADD EXPENSE" to get started</Text>
          </View>
        ) : (
          expenses.map((exp) => {
            const cat        = getCat(exp.category);
            const isDeleting = deleting === exp.id;
            return (
              <View key={exp.id} style={FL.expRow}>
                <View style={FL.dateBlock}><Text style={FL.dateDay}>{dayOf(exp.expense_date)}</Text><Text style={FL.dateMon}>{monOf(exp.expense_date)}</Text></View>
                <View style={[FL.catIconBox, { backgroundColor: cat.bg }]}><Ionicons name={cat.icon} size={18} color={cat.color} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={FL.expCat}>{exp.category}</Text>
                  <Text style={FL.expDesc} numberOfLines={1}>{exp.description || cat.desc}</Text>
                  {exp.receipt_url && (
                    <View style={FL.receiptBadge}>
                      <Ionicons name="camera" size={9} color="#3B82F6" />
                      <Text style={FL.receiptBadgeText}>receipt</Text>
                    </View>
                  )}
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <Text style={FL.expAmt}>-{fmt(exp.amount)}</Text>
                  <View style={FL.rowActions}>
                    <TouchableOpacity style={FL.editBtn} onPress={() => handleEdit(exp)} disabled={isDeleting}><Ionicons name="pencil" size={13} color="#3B82F6" /></TouchableOpacity>
                    <TouchableOpacity style={FL.deleteBtn} onPress={() => handleDelete(exp)} disabled={isDeleting}>
                      {isDeleting ? <ActivityIndicator size="small" color={FL_RED} /> : <Ionicons name="trash" size={13} color={FL_RED} />}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={FL.fab} onPress={handleAddNew} activeOpacity={0.85}>
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={FL.fabText}>ADD EXPENSE</Text>
      </TouchableOpacity>

      <ExpenseModal
        visible={showModal}
        expense={editingExp}
        onClose={() => { setShowModal(false); setEditingExp(null); }}
        onSaved={() => { setShowModal(false); setEditingExp(null); load(); }}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPENSE MODAL
// FIXES:
//   1. useEffect fires on every open (not just screen focus)
//   2. savedReceiptUrl preserved on edit — shown in thumbnail
//   3. existingReceiptUrl sent to backend so PUT never NULLs receipt
//   4. View / Change / Remove overlays on thumbnail
//   5. Fullscreen preview modal with X
// ═══════════════════════════════════════════════════════════════════════════════
function ExpenseModal({ visible, expense, onClose, onSaved }) {
  const isEdit = !!expense;

  const [category,        setCategory]        = useState(CATEGORIES[0].key);
  const [dropOpen,        setDropOpen]        = useState(false);
  const [amount,          setAmount]          = useState("");
  const [note,            setNote]            = useState("");
  const [date,            setDate]            = useState(new Date().toISOString().split("T")[0]);
  const [receipt,         setReceipt]         = useState(null);       // newly picked image asset
  const [savedReceiptUrl, setSavedReceiptUrl] = useState(null);       // existing URL from DB
  const [saving,          setSaving]          = useState(false);
  const [previewVisible,  setPreviewVisible]  = useState(false);
  const [previewUri,      setPreviewUri]      = useState(null);

  // Fires every time the modal opens or the expense changes
  useEffect(() => {
    if (!visible) return;
    if (isEdit && expense) {
      setCategory(expense.category || CATEGORIES[0].key);
      setAmount(String(expense.amount || ""));
      setNote(expense.description || "");
      setDate(expense.expense_date?.split("T")[0] || toDateStr(new Date()));
      setReceipt(null);
      setSavedReceiptUrl(expense.receipt_url || null); // ← load existing receipt
    } else {
      setCategory(CATEGORIES[0].key);
      setAmount("");
      setNote("");
      setDate(new Date().toISOString().split("T")[0]);
      setReceipt(null);
      setSavedReceiptUrl(null);
    }
    setDropOpen(false);
  }, [visible, expense]);

  const reset = () => {
    setCategory(CATEGORIES[0].key); setDropOpen(false); setAmount(""); setNote("");
    setDate(new Date().toISOString().split("T")[0]); setReceipt(null); setSavedReceiptUrl(null);
  };

  const handleClose  = () => { reset(); onClose(); };
  const openPreview  = (uri) => { setPreviewUri(uri); setPreviewVisible(true); };

  const pickReceipt = async () => {
    try {
      if (Platform.OS !== "web") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Required", "Please allow photo library access in Settings.");
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.length > 0) {
        setReceipt(result.assets[0]);
        setSavedReceiptUrl(null); // new pick replaces saved
      }
    } catch {
      Alert.alert("Error", "Could not open photo library.");
    }
  };

  const handleSave = async () => {
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)
      return Alert.alert("Invalid Amount", "Please enter a valid amount greater than 0.");

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("category",    category);
      fd.append("amount",      amount);
      fd.append("description", note);
      fd.append("expenseDate", date);

      if (receipt) {
        if (Platform.OS === "web") {
          // ── WEB FIX ──────────────────────────────────────────────────────────
          // On web, ImagePicker gives a blob: URI. We must fetch it to get a real
          // Blob object and append that — plain objects like { uri, name, type }
          // are NOT files and will arrive at the backend as "[object Object]".
          const response  = await fetch(receipt.uri);
          const blob      = await response.blob();
          const mimeType  = blob.type || "image/jpeg";
          const ext       = mimeType.split("/")[1] || "jpg";
          const filename  = `receipt_${Date.now()}.${ext}`;
          fd.append("receipt", blob, filename);
        } else {
          // ── NATIVE ───────────────────────────────────────────────────────────
          // React Native FormData accepts the { uri, name, type } shape
          fd.append("receipt", {
            uri:  receipt.uri,
            name: `receipt_${Date.now()}.jpg`,
            type: "image/jpeg",
          });
        }
      } else if (savedReceiptUrl) {
        // No new image but existing receipt exists — tell backend to keep it
        fd.append("existingReceiptUrl", savedReceiptUrl);
      } else {
        // User removed the receipt — tell backend to clear it
        fd.append("existingReceiptUrl", "");
      }

      if (isEdit) await updateExpense(expense.id, fd);
      else        await addExpense(fd);

      reset();
      onSaved();
    } catch (err) {
      Alert.alert(
        isEdit ? "Update Failed" : "Save Failed",
        err?.response?.data?.error || "Something went wrong. Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedCat = getCat(category);
  const dateLabel   = (() => {
    try {
      const d = new Date(date), t = new Date();
      return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }).toUpperCase() +
             (d.toDateString() === t.toDateString() ? " (TODAY)" : "");
    } catch { return date; }
  })();

  // Thumbnail: newly picked image takes priority, else existing saved URL
  const thumbUri = receipt?.uri || savedReceiptUrl || null;

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
        <View style={MD.overlay}>
          <View style={MD.sheet}>

            <View style={MD.titleBar}>
              <Ionicons name={isEdit ? "pencil" : "add-circle"} size={18} color="#fff" />
              <Text style={MD.titleText}>{isEdit ? "EDIT EXPENSE" : "LOG NEW EXPENSE"}</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ paddingHorizontal: 20 }}>

              {/* Category */}
              <View style={{ marginTop: 20 }}>
                <Text style={MD.fieldLabel}>CATEGORY</Text>
                <TouchableOpacity style={MD.dropdown} onPress={() => setDropOpen(!dropOpen)} activeOpacity={0.8}>
                  <View style={[MD.dropIconBox, { backgroundColor: selectedCat.bg }]}>
                    <Ionicons name={selectedCat.icon} size={16} color={selectedCat.color} />
                  </View>
                  <Text style={MD.dropText}>{category}</Text>
                  <Ionicons name={dropOpen ? "chevron-up" : "chevron-down"} size={18} color={FL_DARK} />
                </TouchableOpacity>
                {dropOpen && (
                  <View style={MD.dropList}>
                    {CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat.key}
                        style={[MD.dropItem, category === cat.key && { backgroundColor: cat.bg }]}
                        onPress={() => { setCategory(cat.key); setDropOpen(false); }}
                      >
                        <View style={[MD.dropItemIcon, { backgroundColor: cat.bg }]}>
                          <Ionicons name={cat.icon} size={15} color={cat.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[MD.dropItemText, category === cat.key && { fontWeight: "800", color: FL_DARK }]}>{cat.key}</Text>
                          <Text style={MD.dropItemDesc}>{cat.desc}</Text>
                        </View>
                        {category === cat.key && <Ionicons name="checkmark-circle" size={18} color={FL_GREEN} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Amount */}
              <View style={{ marginTop: 24 }}>
                <Text style={MD.fieldLabel}>AMOUNT (₹)</Text>
                <TextInput
                  style={MD.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#D1D5DB"
                />
                <View style={MD.underline} />
              </View>

              {/* Note */}
              <View style={{ marginTop: 20 }}>
                <Text style={MD.fieldLabel}>NOTE</Text>
                <TextInput
                  style={MD.noteInput}
                  value={note}
                  onChangeText={setNote}
                  placeholder="e.g. Electricity bill for June"
                  placeholderTextColor="#D1D5DB"
                  multiline
                />
                <View style={MD.underline} />
              </View>

              {/* Date */}
              <View style={MD.dateRow}>
                <View style={MD.dateIconBox}><Ionicons name="calendar" size={17} color={FL_DARK} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={MD.datePre}>DATE</Text>
                  <TextInput
                    style={MD.dateInput}
                    value={date}
                    onChangeText={setDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#D1D5DB"
                    keyboardType="numeric"
                  />
                </View>
                <Text style={MD.dateLabelSmall}>{dateLabel}</Text>
              </View>

              {/* Receipt */}
              <View style={{ marginBottom: 20 }}>
                <Text style={MD.fieldLabel}>RECEIPT PHOTO (OPTIONAL)</Text>
                {thumbUri ? (
                  // ── Receipt thumbnail with View / Change / Remove overlays ──
                  <View style={{ borderRadius: 12, overflow: "hidden" }}>
                    <Image
                      source={{ uri: thumbUri }}
                      style={{ width: "100%", height: 160, borderRadius: 12 }}
                      resizeMode="cover"
                    />
                    {/* View — bottom left */}
                    <TouchableOpacity onPress={() => openPreview(thumbUri)} style={MD.imgOverlayLeft}>
                      <Ionicons name="eye-outline" size={13} color="#fff" />
                      <Text style={MD.imgOverlayText}>View</Text>
                    </TouchableOpacity>
                    {/* Change — bottom right */}
                    <TouchableOpacity onPress={pickReceipt} style={MD.imgOverlayRight}>
                      <Ionicons name="camera" size={13} color="#fff" />
                      <Text style={MD.imgOverlayText}>Change</Text>
                    </TouchableOpacity>
                    {/* Remove X — top right */}
                    <TouchableOpacity
                      style={MD.imgRemoveBtn}
                      onPress={() => { setReceipt(null); setSavedReceiptUrl(null); }}
                    >
                      <Ionicons name="close-circle" size={26} color={FL_RED} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={MD.receiptBtn} onPress={pickReceipt} activeOpacity={0.8}>
                    <View style={MD.receiptIconBox}><Ionicons name="camera" size={22} color="#fff" /></View>
                    <View>
                      <Text style={MD.receiptTitle}>ATTACH RECEIPT PHOTO</Text>
                      <Text style={MD.receiptSub}>Tap to open photo library</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              {/* Actions */}
              <View style={MD.actionRow}>
                <TouchableOpacity style={MD.cancelBtn} onPress={handleClose}>
                  <Text style={MD.cancelText}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[MD.confirmBtn, (!amount || saving) && { opacity: 0.5 }]}
                  onPress={handleSave}
                  disabled={!amount || saving}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={MD.confirmText}>{isEdit ? "SAVE CHANGES" : "CONFIRM EXPENSE"}</Text>
                  }
                </TouchableOpacity>
              </View>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* FULLSCREEN RECEIPT PREVIEW */}
      <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
        <View style={MD.previewOverlay}>
          <TouchableOpacity onPress={() => setPreviewVisible(false)} style={MD.previewClose}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          {previewUri && (
            <Image source={{ uri: previewUri }} style={MD.previewImage} resizeMode="contain" />
          )}
          <Text style={MD.previewHint}>Tap × to close</Text>
        </View>
      </Modal>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const secStyles = StyleSheet.create({
  container:{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  iconBox:  { width: 36, height: 36, borderRadius: 10, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: BORDER },
  title:    { fontSize: 16, fontWeight: "800", color: PRIMARY, letterSpacing: -0.3 },
  sub:      { fontSize: 12, color: TEXT_MUTED },
});

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: BG },
  scrollContent:{ paddingBottom: 20 },
  center:       { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText:  { fontSize: 14, fontWeight: "700", color: TEXT_MUTED },

  mainTabBar:       { flexDirection: "row", padding: 6, gap: 6, borderBottomWidth: 1, borderBottomColor: BORDER, paddingHorizontal: 16, backgroundColor: CARD_BG },
  mainTab:          { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 10, backgroundColor: "#F1F5F9" },
  mainTabActive:    { backgroundColor: PRIMARY },
  mainTabText:      { fontSize: 13, fontWeight: "700", color: TEXT_MUTED },
  mainTabTextActive:{ color: "#fff" },

  header:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 40 },
  greeting:  { fontSize: 13, fontWeight: "800", color: ACCENT, letterSpacing: 1, textTransform: "uppercase" },
  headerTitle:{ fontSize: 32, fontWeight: "900", color: PRIMARY, marginTop: 4, letterSpacing: -1 },
  headerSub: { fontSize: 13, color: TEXT_MUTED, marginTop: 4, fontWeight: "600" },
  refreshBtn:{ width: 48, height: 48, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },

  kpiGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  kpiGridSmall: { gap: 12 },
  kpiCard:      { backgroundColor: CARD_BG, borderRadius: 24, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 20, elevation: 3 },
  kpiCardSmall: { borderRadius: 16, padding: 16 },
  kpiTopRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  kpiIconBox:   { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  trendPill:    { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  trendPillText:{ fontSize: 11, fontWeight: "800" },
  kpiLabel:     { fontSize: 12, color: TEXT_MUTED, fontWeight: "700", letterSpacing: 0.5, marginBottom: 6 },
  kpiValue:     { fontSize: 24, fontWeight: "900", color: PRIMARY, letterSpacing: -0.5 },

  chartSection:  { backgroundColor: "#fff", borderRadius: 28, padding: 20, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 20, elevation: 2 },
  chartWrapper:  { marginTop: 10 },
  chartEmpty:    { position: "absolute", top: 100, alignItems: "center", gap: 10 },
  chartEmptyText:{ fontSize: 14, color: TEXT_FAINT, fontWeight: "600" },

  splitRow:   { flexDirection: IS_WEB ? "row" : "column", gap: 20, marginTop: 40 },
  section:    { flex: 1 },
  premiumCard:{ backgroundColor: "#fff", borderRadius: 28, padding: 24, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 20, elevation: 2 },

  itemRow:      { marginBottom: 20 },
  itemHeader:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  itemName:     { fontSize: 15, fontWeight: "700", color: TEXT_MAIN },
  itemQty:      { fontSize: 13, color: TEXT_MUTED, fontWeight: "600" },
  progressTrack:{ height: 8, backgroundColor: "#F1F5F9", borderRadius: 10, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 10 },

  fieldLabel:    { fontSize: 11, fontWeight: "800", color: TEXT_MUTED, letterSpacing: 1, marginBottom: 12 },
  rangeSelector: { flexDirection: "row", backgroundColor: "#F1F5F9", padding: 6, borderRadius: 14, marginBottom: 20 },
  rangeTab:      { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  rangeTabActive:{ backgroundColor: PRIMARY },
  rangeTabText:  { fontSize: 13, fontWeight: "700", color: TEXT_MUTED },

  exportBtn:    { backgroundColor: PRIMARY, height: 56, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12 },
  exportBtnText:{ color: "#fff", fontSize: 16, fontWeight: "800" },
  csvBtn:       { height: 56, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 2, borderColor: BORDER },
  csvBtnText:   { color: PRIMARY, fontSize: 15, fontWeight: "800" },

  emptyItems:{ alignItems: "center", paddingVertical: 20 },
  emptyText: { fontSize: 13, color: TEXT_FAINT, fontWeight: "600" },
});

const FL = StyleSheet.create({
  center:       { flex: 1, justifyContent: "center", alignItems: "center" },
  totalsBanner: { backgroundColor: "#fff", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: FL_BORD },
  totalsRow:    { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  totalsIcon:   { width: 22, height: 22, borderRadius: 6, alignItems: "center", justifyContent: "center", marginRight: 8 },
  totalsLabel:  { flex: 1, fontSize: 12, fontWeight: "700", color: "#555", letterSpacing: 0.5 },
  totalsValue:  { fontSize: 15, fontWeight: "900" },

  tabRow:          { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: FL_BORD },
  tabBtn:          { flex: 1, paddingVertical: 13, alignItems: "center", borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabBtnActive:    { borderBottomColor: FL_DARK },
  tabBtnText:      { fontSize: 13, fontWeight: "700", color: "#999", letterSpacing: 1 },
  tabBtnTextActive:{ color: FL_DARK },

  periodRow:           { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: FL_BG },
  periodChip:          { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: FL_BORD },
  periodChipActive:    { backgroundColor: FL_DARK, borderColor: FL_DARK },
  periodChipText:      { fontSize: 12, fontWeight: "700", color: "#888" },
  periodChipTextActive:{ color: "#fff" },

  exportRow:    { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 10, paddingTop: 2, backgroundColor: FL_BG },
  exportLabel:  { flex: 1, fontSize: 11, fontWeight: "800", color: "#9CA3AF", letterSpacing: 0.8 },
  exportBtn:    { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, minWidth: 64, justifyContent: "center" },
  exportBtnText:{ fontSize: 12, fontWeight: "800", color: "#fff" },

  expRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", marginHorizontal: 12, marginBottom: 6,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: FL_BORD,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  dateBlock:  { width: 38, alignItems: "center", marginRight: 12 },
  dateDay:    { fontSize: 20, fontWeight: "900", color: FL_DARK, lineHeight: 22 },
  dateMon:    { fontSize: 10, fontWeight: "700", color: "#888", letterSpacing: 0.5, marginTop: 1 },
  catIconBox: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", marginRight: 10, borderWidth: 1, borderColor: FL_BORD },
  expCat:     { fontSize: 14, fontWeight: "800", color: FL_DARK },
  expDesc:    { fontSize: 12, color: "#888", marginTop: 1 },
  expAmt:     { fontSize: 14, fontWeight: "900", color: FL_RED },
  receiptBadge:    { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4, backgroundColor: "#EFF6FF", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, alignSelf: "flex-start" },
  receiptBadgeText:{ fontSize: 9, color: "#3B82F6", fontWeight: "700" },
  rowActions: { flexDirection: "row", gap: 6, marginTop: 4 },
  editBtn:    { width: 28, height: 28, borderRadius: 8, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  deleteBtn:  { width: 28, height: 28, borderRadius: 8, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" },
  fab: {
    position: "absolute", bottom: 24, right: 20,
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: FL_GREEN, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 32,
    ...Platform.select({
      ios:     { shadowColor: FL_GREEN, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 14 },
      android: { elevation: 8 },
    }),
  },
  fabText:     { color: "#fff", fontWeight: "900", fontSize: 13, letterSpacing: 1 },
  emptyWrap:   { alignItems: "center", paddingTop: 80 },
  emptyIconBox:{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle:  { fontSize: 16, fontWeight: "800", color: FL_DARK, marginBottom: 4 },
  emptySub:    { fontSize: 13, color: "#888" },
});

const MD = StyleSheet.create({
  overlay:{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet:  { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === "ios" ? 44 : 24, maxHeight: "94%" },
  titleBar:{ backgroundColor: FL_DARK, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingVertical: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
  titleText:{ fontSize: 14, fontWeight: "900", color: "#fff", letterSpacing: 2 },

  fieldLabel:  { fontSize: 11, fontWeight: "800", color: "#9CA3AF", letterSpacing: 1.2, marginBottom: 8 },
  dropdown:    { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: FL_BORD, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  dropIconBox: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", marginRight: 10 },
  dropText:    { flex: 1, fontSize: 15, fontWeight: "700", color: FL_DARK },
  dropList:    { marginTop: 4, borderWidth: 1, borderColor: FL_BORD, borderRadius: 12, backgroundColor: "#fff", overflow: "hidden", ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14 }, android: { elevation: 6 } }) },
  dropItem:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  dropItemIcon:{ width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center", marginRight: 10 },
  dropItemText:{ fontSize: 14, fontWeight: "600", color: "#374151" },
  dropItemDesc:{ fontSize: 11, color: "#9CA3AF", marginTop: 1 },

  amountInput:  { fontSize: 38, fontWeight: "900", color: FL_DARK, padding: 0 },
  underline:    { height: 1.5, backgroundColor: "#E5E7EB", marginTop: 8, marginBottom: 4 },
  noteInput:    { fontSize: 15, fontWeight: "600", color: FL_DARK, padding: 0, minHeight: 36 },

  dateRow:       { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20, marginBottom: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#F3F4F6", borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  dateIconBox:   { width: 34, height: 34, borderRadius: 8, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  datePre:       { fontSize: 10, fontWeight: "700", color: "#9CA3AF", letterSpacing: 1 },
  dateInput:     { fontSize: 14, fontWeight: "800", color: FL_DARK, padding: 0, marginTop: 2 },
  dateLabelSmall:{ fontSize: 11, color: "#9CA3AF", fontWeight: "600" },

  imgOverlayLeft:  { position: "absolute", bottom: 10, left: 10, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.62)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  imgOverlayRight: { position: "absolute", bottom: 10, right: 10, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.62)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  imgOverlayText:  { fontSize: 11, color: "#fff", fontWeight: "700" },
  imgRemoveBtn:    { position: "absolute", top: 8, right: 8, backgroundColor: "#fff", borderRadius: 13 },

  receiptBtn:    { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: FL_DARK, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 },
  receiptIconBox:{ width: 42, height: 42, borderRadius: 10, backgroundColor: FL_GREEN, alignItems: "center", justifyContent: "center" },
  receiptTitle:  { fontSize: 12, fontWeight: "800", color: "#fff", letterSpacing: 0.6 },
  receiptSub:    { fontSize: 11, color: "#9CA3AF", marginTop: 2 },

  actionRow:  { flexDirection: "row", gap: 12, marginTop: 8 },
  cancelBtn:  { flex: 1, paddingVertical: 15, borderRadius: 12, borderWidth: 1.5, borderColor: FL_BORD, alignItems: "center" },
  cancelText: { fontSize: 12, fontWeight: "800", color: "#888", letterSpacing: 1 },
  confirmBtn: { flex: 2, paddingVertical: 15, borderRadius: 12, backgroundColor: FL_DARK, alignItems: "center" },
  confirmText:{ fontSize: 12, fontWeight: "800", color: "#fff", letterSpacing: 1 },

  previewOverlay:{ flex: 1, backgroundColor: "rgba(0,0,0,0.93)", alignItems: "center", justifyContent: "center" },
  previewClose:  { position: "absolute", top: 52, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", zIndex: 10 },
  previewImage:  { width: "92%", height: "72%", borderRadius: 16 },
  previewHint:   { marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: "600" },
});