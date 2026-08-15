import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
  useWindowDimensions,
  TextInput,
  Modal,
  Image,
  Animated,
  Easing,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { getAnalytics, getExpenses, addExpense, deleteExpense, updateExpense, askAdvisor } from "../api";
import {
  VictoryArea,
  VictoryLine,
  VictoryScatter,
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

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";
const isLikelyUnreachableHost = !IS_WEB && /localhost|127\.0\.0\.1/i.test(API_BASE_URL);

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const PRIMARY      = "#0F172A";
const ACCENT       = "#10B981";
const DANGER       = "#EF4444";
const BG           = "#F8FAFC";
const CARD_BG      = "#FFFFFF";
const BORDER       = "#E2E8F0";
const TEXT_MAIN    = "#1E293B";
const TEXT_MUTED   = "#64748B";
const TEXT_FAINT   = "#94A3B8";
const CONTENT_MAX  = 1200;

const FL_BG    = "#F8FAFC";
const FL_DARK  = "#0F172A";
const FL_GREEN = "#10B981";
const FL_RED   = "#EF4444";
const FL_BORD  = "#E2E8F0";

// ── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: "Utilities",     icon: "flash",                      color: "#F59E0B", bg: "#FEF3C7", desc: "Power, water & utility charges" },
  { key: "Payroll",       icon: "people",                     color: "#3B82F6", bg: "#EFF6FF", desc: "Wages, salaries & advances" },
  { key: "Procurement",   icon: "cube",                       color: "#8B5CF6", bg: "#F5F3FF", desc: "Raw materials & supplies" },
  { key: "Maintenance",   icon: "construct",                  color: "#F97316", bg: "#FFF7ED", desc: "Equipment & repair costs" },
  { key: "Waste",         icon: "trash",                      color: "#EF4444", bg: "#FEF2F2", desc: "Expired or wasted items" },
  { key: "Other",         icon: "ellipsis-horizontal-circle", color: "#6B7280", bg: "#F3F4F6", desc: "Miscellaneous expenses" },
];

const utcHourToISTLabel = (utcHour) => {
  if (utcHour === undefined || utcHour === null || isNaN(parseInt(utcHour))) return "--:--";
  const totalMin = (parseInt(utcHour) * 60 + 330) % (24 * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const PERIODS = ["daily", "weekly", "monthly"];
const getCat  = (key) => CATEGORIES.find((c) => c.key === key) || CATEGORIES[5];
const fmt     = (n)    => "₹" + parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const dayOf   = (d)    => new Date(d).getDate();
const monOf   = (d)    => new Date(d).toLocaleDateString("en-IN", { month: "short" }).toUpperCase();

const pctChange = (curr, prev) => {
  if (!prev && !curr) return null;
  if (!prev) return 100;
  return ((curr - prev) / prev) * 100;
};

const buildChartData = (last30, period) => {
  if (!last30.length) return [];

  if (period === "weekly") {
    const weeks = [];
    for (let i = 0; i < last30.length; i += 7) {
      const chunk = last30.slice(i, i + 7);
      if (!chunk.length) continue;
      weeks.push({
        x: `Wk ${weeks.length + 1}`,
        y: chunk.reduce((s, d) => s + (parseFloat(d.revenue) || 0), 0),
        orders: chunk.reduce((s, d) => s + (parseInt(d.orders) || 0), 0),
        date: chunk[chunk.length - 1].date,
      });
    }
    return weeks;
  }

  if (period === "monthly") {
    const last = last30[last30.length - 1];
    return [{
      x: monOf(last.date),
      y: last30.reduce((s, d) => s + (parseFloat(d.revenue) || 0), 0),
      orders: last30.reduce((s, d) => s + (parseInt(d.orders) || 0), 0),
      date: last.date,
    }];
  }

  return last30.slice(-7).map((d) => ({
    x: dayOf(d.date).toString(),
    y: parseFloat(d.revenue) || 0,
    date: d.date,
    orders: d.orders || 0,
  }));
};

const HIGHLIGHT_RE = /(\d+%|\d{1,2}(:\d{2})?\s?[AP]M)/gi;
const renderHighlightedInsight = (text) => {
  const parts = text.split(HIGHLIGHT_RE).filter((p) => p !== undefined);
  return parts.map((part, i) =>
    HIGHLIGHT_RE.test(part) ? (
      <Text key={i} style={advStyles.highlight}>{part}</Text>
    ) : (
      <Text key={i} style={advStyles.body}>{part}</Text>
    )
  );
};

const DEFAULT_INSIGHT =
  "Your sales are 18% higher on weekends. Consider increasing staffing between 7 PM and 10 PM to keep pace with peak demand.";

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED NUMBER
// ═══════════════════════════════════════════════════════════════════════════════
function AnimatedNumber({ value, formatter, style, numberOfLines = 1 }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const target = Number.isFinite(value) ? value : 0;
    anim.setValue(prevValue.current);
    
    const id = anim.addListener(({ value: v }) => setDisplay(v));
    
    Animated.timing(anim, {
      toValue: target,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    
    prevValue.current = target;
    
    return () => {
      anim.removeListener(id);
    };
  }, [value]);

  return (
    <Text style={style} numberOfLines={numberOfLines} adjustsFontSizeToFit>
      {formatter(display)}
    </Text>
  );
}

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
  const [selectedDay,   setSelectedDay]   = useState(null);
  const [chartPeriod,   setChartPeriod]   = useState("daily");

  const navigation = useNavigation();
  const tabFade = useRef(new Animated.Value(1)).current;

  const { width: screenWidth } = useWindowDimensions();
  const isMobileView = screenWidth < 768;
  const H_PAD        = isMobileView ? 16 : 32;
  const contentWidth = IS_WEB ? Math.min(screenWidth, CONTENT_MAX) : screenWidth;

  const chartWidth = !isMobileView
    ? (contentWidth * 0.6) - 48
    : screenWidth - 64;

  useFocusEffect(useCallback(() => { loadAnalytics(); }, []));

  useEffect(() => {
    tabFade.setValue(0);
    Animated.timing(tabFade, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeMainTab]);

  useEffect(() => { setSelectedDay(null); }, [chartPeriod]);

  const revenueChartData = useMemo(
    () => buildChartData(data?.last30Days || [], chartPeriod),
    [data, chartPeriod]
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
    const end = new Date(), start = new Date();
    start.setDate(end.getDate() - days);
    setStartDate(toDateStr(start));
    setEndDate(toDateStr(end));
  };

  const downloadReport = async (format) => {
    if (isLikelyUnreachableHost) {
      Alert.alert(
        "Server Not Configured",
        "This app build is still pointing at localhost for its API, which isn't reachable from a real device. " +
        "Set EXPO_PUBLIC_API_URL to your deployed API's https:// address in the build profile (e.g. eas.json) " +
        "and rebuild — this is why report downloads fail only in the installed app.",
      );
      return;
    }

    const token = await AsyncStorage.getItem("token");
    if (!token) {
      Alert.alert("Session Expired", "Please log in again and retry the download.");
      return;
    }

    const url = `${API_BASE_URL}/api/sales/${format}?startDate=${startDate}&endDate=${endDate}&token=${token}&includeDailyTable=true`;

    setDownloading(true);
    try {
      if (Platform.OS === "web") {
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `report-${startDate}-to-${endDate}.${format}`);
        link.setAttribute("target", "_blank");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const filename = `servon-report-${Date.now()}.${format}`;
        const fileUri = FileSystem.cacheDirectory + filename;
        const res = await FileSystem.downloadAsync(url, fileUri, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status !== 200) {
          throw new Error(`Server responded with status ${res.status}`);
        }

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(res.uri, {
            mimeType: format === "pdf" ? "application/pdf" : "text/csv",
            dialogTitle: `Business Report (${format.toUpperCase()})`,
            UTI: format === "pdf" ? "com.adobe.pdf" : "public.comma-separated-values-text",
          });
        }
      }
    } catch (error) {
      console.error("downloadReport error:", error);
      Alert.alert(
        "Export Error",
        `Could not download the report.\n\n${error?.message || "Unknown error"}`,
      );
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
  const totalOrd      = last30.reduce((s, d) => s + (parseInt(d.orders)    || 0), 0) || 0;
  const avgOrderValue = totalOrd ? totalRev / totalOrd : 0;

  const today     = last30[last30.length - 1] || null;
  const yesterday = last30[last30.length - 2] || null;
  const todayRev  = parseFloat(today?.revenue) || 0;
  const yestRev   = parseFloat(yesterday?.revenue) || 0;
  const todayOrd  = parseInt(today?.orders) || 0;
  const yestOrd   = parseInt(yesterday?.orders) || 0;
  const todayAOV  = todayOrd ? todayRev / todayOrd : 0;
  const yestAOV   = yestOrd ? yestRev / yestOrd : 0;

  const revTrend = pctChange(todayRev, yestRev);
  const ordTrend = pctChange(todayOrd, yestOrd);
  const aovTrend = pctChange(todayAOV, yestAOV);

  const tablesOccupied = data?.tablesOccupied ?? null;
  const totalTables    = data?.totalTables ?? null;
  const hasTableData    = tablesOccupied !== null && totalTables !== null;

  const kpis = [
    {
      key: "sales", label: "Total Sales", icon: "wallet", color: ACCENT, bg: "#ECFDF5",
      rawValue: totalRev, formatter: fmt, trend: revTrend,
    },
    {
      key: "orders", label: "Orders", icon: "cart", color: "#3B82F6", bg: "#EFF6FF",
      rawValue: totalOrd, formatter: (v) => Math.round(v).toLocaleString("en-IN"), trend: ordTrend,
    },
    {
      key: "aov", label: "Avg. Order Value", icon: "receipt", color: "#F59E0B", bg: "#FFFBEB",
      rawValue: avgOrderValue, formatter: fmt, trend: aovTrend,
    },
  ];

  const maxChartRevenue = revenueChartData.length
    ? Math.max(...revenueChartData.map((d) => d.y))
    : 0;
  const activeDay = selectedDay || revenueChartData.find((d) => d.y === maxChartRevenue) || null;

  const topItems = data?.topItems?.slice(0, 5) || [];
  const maxQty = topItems.length ? Math.max(...topItems.map(i => parseInt(i.total_qty) || 0)) : 1;

  const goToAdvisor = () => {
    try { navigation.navigate("Advisor"); }
    catch { Alert.alert("AI Advisor", "Open the AI Business Advisor tab for the full breakdown."); }
  };

  const goToAllItems = () => {
    try { navigation.navigate("Menu"); }
    catch { Alert.alert("Top Items", "Full item list is available on the Menu screen."); }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ── TOP NAV BAR ── */}
      <View style={styles.mainTabBar}>
        <View style={styles.tabBarInner}>
          {["Analytics", "Expenses"].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.mainTab, activeMainTab === tab && styles.mainTabActive]}
              onPress={() => setActiveMainTab(tab)}
            >
              <Ionicons name={tab === "Analytics" ? "bar-chart" : "receipt"} size={18} color={activeMainTab === tab ? "#fff" : TEXT_MUTED} />
              <Text style={[styles.mainTabText, activeMainTab === tab && styles.mainTabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── ANALYTICS TAB ── */}
      {activeMainTab === "Analytics" && (
        <Animated.View style={{ flex: 1, opacity: tabFade }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { alignSelf: "center", width: "100%", maxWidth: CONTENT_MAX }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAnalytics(); }} tintColor={ACCENT} colors={[ACCENT]} />}
        >
          {/* HEADER */}
          <View style={[styles.header, { paddingHorizontal: H_PAD }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>Performance Overview</Text>
              <Text style={styles.headerTitle}>Analytics</Text>
              <Text style={styles.headerSub}>{startDate} — {endDate}</Text>
            </View>
            <TouchableOpacity style={styles.refreshBtn} onPress={() => { setRefreshing(true); loadAnalytics(); }} activeOpacity={0.7}>
              <Ionicons name="sync" size={20} color={PRIMARY} />
            </TouchableOpacity>
          </View>

          {/* KPI GRID */}
          <View style={[styles.kpiGrid, { paddingHorizontal: H_PAD }]}>
            {kpis.map((k) => (
              <KPICard key={k.key} {...k} isMobile={isMobileView} />
            ))}
            <TablesCard
              occupied={tablesOccupied}
              total={totalTables}
              hasData={hasTableData}
              isMobile={isMobileView}
            />
          </View>

          {/* SPLIT WORKSPACE FOR CHARTS & TOP ITEMS */}
          <View style={[styles.splitWorkspace, { paddingHorizontal: H_PAD }, isMobileView && { flexDirection: "column" }]}>
            <View style={isMobileView ? { width: "100%" } : { flex: 1.5 }}>
              <View style={styles.chartHeaderRow}>
                <Text style={styles.premiumCardTitle}>Sales Overview</Text>
                <View style={styles.periodTabs}>
                  {[["daily", "Day"], ["weekly", "Week"], ["monthly", "Month"]].map(([key, label]) => (
                    <TouchableOpacity
                      key={key}
                      style={[styles.periodTab, chartPeriod === key && styles.periodTabActive]}
                      onPress={() => setChartPeriod(key)}
                    >
                      <Text style={[styles.periodTabText, chartPeriod === key && styles.periodTabTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.chartSection}>
                <View style={styles.chartWrapper}>
                  <VictoryChart
                    theme={VictoryTheme.material}
                    height={250}
                    width={chartWidth}
                    padding={{ top: 20, bottom: 45, left: 55, right: 20 }}
                    containerComponent={<VictoryContainer responsive={false} />}
                  >
                    <VictoryAxis style={axisStyle} />
                    <VictoryAxis dependentAxis style={axisStyle} tickFormat={(x) => `₹${x >= 1000 ? `${(x / 1000).toFixed(0)}k` : x}`} />
                    <VictoryArea
                      data={revenueChartData}
                      interpolation="monotoneX"
                      style={{ data: { fill: ACCENT, fillOpacity: 0.12, stroke: "transparent" } }}
                      animate={{ duration: 500, onLoad: { duration: 400 } }}
                    />
                    <VictoryLine
                      data={revenueChartData}
                      interpolation="monotoneX"
                      style={{ data: { stroke: ACCENT, strokeWidth: 2.5 } }}
                      animate={{ duration: 500, onLoad: { duration: 400 } }}
                    />
                    <VictoryScatter
                      data={revenueChartData}
                      size={({ datum }) => (datum === selectedDay ? 6 : datum.y === maxChartRevenue && maxChartRevenue > 0 ? 5 : 3.5)}
                      style={{
                        data: {
                          fill: ({ datum }) => (datum === selectedDay || (datum.y === maxChartRevenue && maxChartRevenue > 0) ? ACCENT : "#fff"),
                          stroke: ACCENT,
                          strokeWidth: 2,
                        },
                      }}
                      events={[{
                        target: "data",
                        eventHandlers: {
                          onPressIn: () => [{
                            target: "data",
                            mutation: (props) => { setSelectedDay(props.datum); return null; },
                          }],
                        },
                      }]}
                    />
                  </VictoryChart>
                </View>
                {activeDay && (
                  <View style={styles.chartInfoCard}>
                    <View>
                      <Text style={styles.chartInfoDate}>
                        {chartPeriod === "daily"
                          ? new Date(activeDay.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
                          : activeDay.x}
                      </Text>
                      <Text style={styles.chartInfoSub}>{activeDay.orders} {activeDay.orders === 1 ? "order" : "orders"}</Text>
                    </View>
                    <Text style={styles.chartInfoValue}>₹{activeDay.y.toLocaleString("en-IN")}</Text>
                  </View>
                )}
                {revenueChartData.length === 0 || revenueChartData.every(d => d.y === 0) ? (
                  <View style={styles.chartEmpty}>
                    <Ionicons name="trending-up-outline" size={36} color={TEXT_FAINT} />
                    <Text style={styles.chartEmptyText}>No sales activity recorded</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={isMobileView ? { width: "100%", marginTop: 28 } : { flex: 1 }}>
              <View style={styles.topItemsHeaderRow}>
                <Text style={styles.premiumCardTitle}>Top Items</Text>
                <TouchableOpacity onPress={goToAllItems} activeOpacity={0.7}>
                  <Text style={styles.viewAllText}>View all</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.premiumCard}>
                {topItems.length ? (
                  topItems.map((item, i) => {
                    const pct = maxQty > 0 ? (parseInt(item.total_qty) || 0) / maxQty : 0;
                    return (
                      <View key={i} style={[styles.itemRow, i === topItems.length - 1 && { marginBottom: 0 }]}>
                        <Text style={styles.itemRank}>{i + 1}.</Text>
                        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
                        </View>
                        <Text style={styles.itemQty}>{item.total_qty}</Text>
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.emptyItems}><Text style={styles.emptyText}>Data compiling...</Text></View>
                )}
              </View>
            </View>
          </View>

          {/* AI BUSINESS ADVISOR + ASK BAR */}
          <View style={[styles.advisorRow, { paddingHorizontal: H_PAD }, isMobileView && { flexDirection: "column" }]}>
            <View style={isMobileView ? { width: "100%" } : { flex: 1.2 }}>
              <AdvisorCard insight={data?.aiInsight || DEFAULT_INSIGHT} onViewMore={goToAdvisor} />
            </View>
            <View style={isMobileView ? { width: "100%", marginTop: 16 } : { flex: 1 }}>
              <AskAdvisorBox />
            </View>
          </View>

          {/* EXTRACT CONTROLS REPORTS */}
          <View style={[{ paddingHorizontal: H_PAD, marginTop: 36 }]}>
            <SectionHeader title="Report Extraction Hub" subtitle="Export authenticated data ledgers" icon="cloud-download-outline" />
            <View style={[styles.premiumCard, !isMobileView && styles.webReportCardRow]}>
              <View style={[!isMobileView && { flex: 1, marginRight: 24 }]}>
                <Text style={styles.fieldLabel}>CHOOSE PERIOD TIME RANGE</Text>
                <View style={styles.rangeSelector}>
                  {[7, 30, 90].map((d) => {
                    const isActive = startDate === toDateStr(new Date(Date.now() - d * 86400000));
                    return (
                      <TouchableOpacity key={d} style={[styles.rangeTab, isActive && styles.rangeTabActive]} onPress={() => handleRangeSelect(d)}>
                        <Text style={[styles.rangeTabText, isActive && { color: "#fff" }]}>{d} Days</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={[!isMobileView && styles.webReportBtnStack, isMobileView && { gap: 12, marginTop: 12 }]}>
                <TouchableOpacity style={[styles.exportBtn, downloading && { opacity: 0.7 }]} onPress={() => downloadReport("pdf")} disabled={downloading}>
                  {downloading ? <ActivityIndicator color="#fff" /> : <><Ionicons name="document-text" size={20} color="#fff" /><Text style={styles.exportBtnText}>Export PDF Document</Text></>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.csvBtn} onPress={() => downloadReport("csv")}>
                  <Ionicons name="grid-outline" size={18} color={PRIMARY} />
                  <Text style={styles.csvBtnText}>Extract CSV Spreadsheet</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
        </Animated.View>
      )}

      {activeMainTab === "Expenses" && (
        <Animated.View style={{ flex: 1, opacity: tabFade }}>
          <ExpensesTab />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION HEADER
// ═══════════════════════════════════════════════════════════════════════════════
function SectionHeader({ title, subtitle, icon }) {
  return (
    <View style={secStyles.container}>
      <View style={secStyles.iconBox}><Ionicons name={icon} size={18} color={PRIMARY} /></View>
      <View style={{ flex: 1 }}><Text style={secStyles.title}>{title}</Text><Text style={secStyles.sub}>{subtitle}</Text></View>
    </View>
  );
}

const secStyles = StyleSheet.create({
  container:{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18, marginTop: 12 },
  iconBox:  { width: 34, height: 34, borderRadius: 8, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: BORDER },
  title:    { fontSize: 16, fontWeight: "700", color: PRIMARY, letterSpacing: -0.2 },
  sub:      { fontSize: 12, color: TEXT_MUTED },
});

// ═══════════════════════════════════════════════════════════════════════════════
// KPI CARD
// ═══════════════════════════════════════════════════════════════════════════════
function KPICard({ label, rawValue, formatter, trend, icon, color, bg, isMobile }) {
  const hasTrend = trend !== null && trend !== undefined && !isNaN(trend);
  const isUp = hasTrend && trend >= 0;
  return (
    <View style={[styles.kpiCard, isMobile ? styles.kpiCardMobile : styles.kpiCardWeb]}>
      <View style={styles.kpiTopRow}>
        <Text style={styles.kpiLabel} numberOfLines={1}>{label}</Text>
        <View style={[styles.kpiIconBox, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
      </View>
      <AnimatedNumber value={rawValue} formatter={formatter} style={styles.kpiValue} />
      {hasTrend && (
        <View style={styles.trendRow}>
          <Ionicons name={isUp ? "arrow-up" : "arrow-down"} size={11} color={isUp ? ACCENT : DANGER} />
          <Text style={[styles.trendText, { color: isUp ? ACCENT : DANGER }]}>
            {Math.abs(trend).toFixed(1)}% vs yesterday
          </Text>
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABLES CARD
// ═══════════════════════════════════════════════════════════════════════════════
function TablesCard({ occupied, total, hasData, isMobile }) {
  return (
    <View style={[styles.kpiCard, isMobile ? styles.kpiCardMobile : styles.kpiCardWeb]}>
      <View style={styles.kpiTopRow}>
        <Text style={styles.kpiLabel} numberOfLines={1}>Tables Occupied</Text>
        <View style={[styles.kpiIconBox, { backgroundColor: "#F5F3FF" }]}>
          <Ionicons name="restaurant" size={16} color="#8B5CF6" />
        </View>
      </View>
      <Text style={styles.kpiValue} numberOfLines={1}>
        {hasData ? `${occupied}/${total}` : "—/—"}
      </Text>
      <View style={styles.liveBadge}>
        <View style={styles.liveDot} />
        <Text style={styles.liveBadgeText}>{hasData ? "Live" : "Awaiting data"}</Text>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADVISOR CARD
// ═══════════════════════════════════════════════════════════════════════════════
function AdvisorCard({ insight, onViewMore }) {
  return (
    <View style={advStyles.card}>
      <View style={advStyles.topRow}>
        <View style={advStyles.iconBox}>
          <Ionicons name="sparkles" size={16} color={ACCENT} />
        </View>
        <Text style={advStyles.eyebrow}>AI Business Advisor</Text>
      </View>
      <Text style={advStyles.insight}>{renderHighlightedInsight(insight)}</Text>
      <TouchableOpacity style={advStyles.linkBtn} onPress={onViewMore} activeOpacity={0.8}>
        <Text style={advStyles.linkText}>View Full Insights</Text>
      </TouchableOpacity>
    </View>
  );
}

const advStyles = StyleSheet.create({
  card:     { backgroundColor: "#fff", borderRadius: 14, padding: 18, borderWidth: 1, borderColor: BORDER, height: "100%" },
  topRow:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  iconBox:  { width: 26, height: 26, borderRadius: 13, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  eyebrow:  { fontSize: 13.5, fontWeight: "700", color: PRIMARY },
  insight:  { fontSize: 13.5, lineHeight: 20, marginBottom: 16 },
  body:     { color: TEXT_MUTED, fontWeight: "500" },
  highlight:{ color: TEXT_MAIN, fontWeight: "700" },
  linkBtn:  { backgroundColor: ACCENT, borderRadius: 8, paddingVertical: 10, alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 16 },
  linkText: { fontSize: 12.5, fontWeight: "700", color: "#fff" },
});

// ═══════════════════════════════════════════════════════════════════════════════
// ASK ADVISOR BOX (FIXED - Actually Sends Questions)
// ═══════════════════════════════════════════════════════════════════════════════
function AskAdvisorBox() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [showResponse, setShowResponse] = useState(false);
  const navigation = useNavigation();

  const submit = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setShowResponse(false);
    
    try {
      const response = await askAdvisor(query.trim());
      setResponse(response.data);
      setShowResponse(true);
      setQuery("");
    } catch (error) {
      console.error("❌ Advisor error:", error);
      Alert.alert("Error", "Could not get response. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={askStyles.card}>
      <View style={askStyles.inputRow}>
        <TextInput
          style={askStyles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Ask anything about your business..."
          placeholderTextColor={TEXT_FAINT}
          onSubmitEditing={submit}
          returnKeyType="send"
          editable={!loading}
        />
        <TouchableOpacity 
          style={[askStyles.sendBtn, loading && askStyles.sendBtnLoading]} 
          onPress={submit} 
          activeOpacity={0.8}
          disabled={loading || !query.trim()}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={15} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {showResponse && response && (
        <View style={askStyles.responseContainer}>
          <View style={askStyles.responseHeader}>
            <Ionicons name="sparkles" size={14} color={ACCENT} />
            <Text style={askStyles.responseLabel}>AI Response</Text>
          </View>
          <Text style={askStyles.responseText} numberOfLines={4} ellipsizeMode="tail">
            {response.answer || response.message}
          </Text>
          <TouchableOpacity 
            style={askStyles.viewFullBtn}
            onPress={() => navigation.navigate("Advisor")}
          >
            <Text style={askStyles.viewFullText}>View Full Conversation</Text>
            <Ionicons name="arrow-forward" size={12} color={ACCENT} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const askStyles = StyleSheet.create({
  card: { 
    flexDirection: "column",
    alignItems: "stretch",
    gap: 10,
    backgroundColor: "#fff", 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: BORDER, 
    padding: 12,
    minHeight: 60,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: { 
    flex: 1, 
    fontSize: 13.5, 
    color: TEXT_MAIN, 
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  sendBtn: { 
    width: 34, 
    height: 34, 
    borderRadius: 8, 
    backgroundColor: ACCENT, 
    alignItems: "center", 
    justifyContent: "center",
    flexShrink: 0,
  },
  sendBtnLoading: {
    backgroundColor: "#9CA3AF",
  },
  responseContainer: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 10,
    marginTop: 4,
    maxHeight: 140,
  },
  responseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  responseLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: TEXT_MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  responseText: {
    fontSize: 13,
    color: TEXT_MAIN,
    lineHeight: 19,
    marginBottom: 8,
  },
  viewFullBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  viewFullText: {
    fontSize: 12,
    fontWeight: "600",
    color: ACCENT,
  },
});

const axisStyle = {
  axis:       { stroke: "transparent" },
  grid:       { stroke: "#F1F5F9", strokeDasharray: "0" },
  tickLabels: { fontSize: 11, fill: TEXT_MUTED, fontWeight: "500" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: BG },
  scrollContent:{ paddingVertical: 20 },
  center:       { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: BG },
  loadingText:  { fontSize: 14, fontWeight: "600", color: TEXT_MUTED },

  mainTabBar:       { borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: CARD_BG, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 2 },
  tabBarInner:      { flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
  mainTab:          { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  mainTabActive:    { backgroundColor: PRIMARY },
  mainTabText:      { fontSize: 14, fontWeight: "600", color: TEXT_MUTED },
  mainTabTextActive:{ color: "#fff" },

  header:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 24 },
  greeting:  { fontSize: 11, fontWeight: "700", color: ACCENT, letterSpacing: 1 },
  headerTitle:{ fontSize: 28, fontWeight: "800", color: PRIMARY, marginTop: 2 },
  headerSub: { fontSize: 13, color: TEXT_MUTED, marginTop: 4 },
  refreshBtn:{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center", shadowColor: "#0F172A", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },

  kpiGrid:      { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  kpiCard:      { backgroundColor: CARD_BG, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: BORDER, shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  kpiCardWeb:   { width: "23.5%" },
  kpiCardMobile:{ width: "48%", marginBottom: 4 },

  kpiTopRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  kpiIconBox:   { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  kpiLabel:     { fontSize: 12.5, color: TEXT_MUTED, fontWeight: "600", flex: 1, marginRight: 4 },
  kpiValue:     { fontSize: 24, fontWeight: "800", color: PRIMARY, letterSpacing: -0.5 },

  trendRow:  { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  trendText: { fontSize: 11.5, fontWeight: "700" },

  liveBadge:     { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8, alignSelf: "flex-start", backgroundColor: "#F5F3FF", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  liveDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: "#8B5CF6" },
  liveBadgeText: { fontSize: 10.5, fontWeight: "700", color: "#8B5CF6" },

  chartHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  periodTabs:      { flexDirection: "row", backgroundColor: "#F1F5F9", padding: 3, borderRadius: 8, marginBottom: 12 },
  periodTab:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  periodTabActive: { backgroundColor: PRIMARY },
  periodTabText:   { fontSize: 12, fontWeight: "600", color: TEXT_MUTED },
  periodTabTextActive: { color: "#fff" },

  splitWorkspace: { flexDirection: "row", gap: 24, marginTop: 12 },
  chartSection:   { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER, alignItems: "center", shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 1 },
  chartWrapper:   { paddingRight: 8 },
  chartEmpty:    { position: "absolute", top: 90, alignItems: "center", gap: 6 },
  chartEmptyText:{ fontSize: 13, color: TEXT_FAINT },

  advisorRow: { flexDirection: "row", gap: 16, marginTop: 28 },

  topItemsHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18, marginTop: 12 },
  premiumCardTitle:  { fontSize: 16, fontWeight: "700", color: PRIMARY, letterSpacing: -0.2 },

  chartInfoCard:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 10, borderWidth: 1, borderColor: BORDER, paddingVertical: 10, paddingHorizontal: 14, marginTop: 10, width: "100%" },
  chartInfoDate:  { fontSize: 13, fontWeight: "700", color: PRIMARY },
  chartInfoSub:   { fontSize: 11, color: TEXT_MUTED, marginTop: 1 },
  chartInfoValue: { fontSize: 16, fontWeight: "800", color: ACCENT },

  premiumCard:{ backgroundColor: "#fff", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: BORDER, shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 1 },

  itemRow:      { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 },
  itemRank:     { fontSize: 13, fontWeight: "600", color: TEXT_MUTED, width: 16 },
  itemName:     { fontSize: 13.5, fontWeight: "600", color: TEXT_MAIN, width: 108 },
  itemQty:      { fontSize: 12.5, color: TEXT_MUTED, fontWeight: "600", width: 26, textAlign: "right" },
  progressTrack:{ flex: 1, height: 6, backgroundColor: "#F1F5F9", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3, backgroundColor: ACCENT },

  viewAllText: { fontSize: 13, fontWeight: "600", color: ACCENT },

  fieldLabel:    { fontSize: 11, fontWeight: "700", color: TEXT_MUTED, marginBottom: 8, letterSpacing: 0.3 },
  rangeSelector: { flexDirection: "row", backgroundColor: "#F1F5F9", padding: 4, borderRadius: 10, marginBottom: 16 },
  rangeTab:      { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 6 },
  rangeTabActive:{ backgroundColor: PRIMARY },
  rangeTabText:  { fontSize: 13, fontWeight: "600", color: TEXT_MUTED },

  exportBtn:    { backgroundColor: PRIMARY, height: 46, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  exportBtnText:{ color: "#fff", fontSize: 14, fontWeight: "600" },
  csvBtn:       { height: 46, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: BORDER, backgroundColor: "#fff" },
  csvBtnText:   { color: PRIMARY, fontSize: 13, fontWeight: "600" },

  webReportCardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  webReportBtnStack:{ width: 220 },

  emptyItems:{ alignItems: "center", paddingVertical: 16 },
  emptyText: { fontSize: 13, color: TEXT_FAINT },
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPENSES TAB (Keeping your existing code unchanged)
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

  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= 900;
  const H_PAD = screenWidth < 768 ? 16 : 32;

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
        const newTab = window.open("", "_blank");
        if (newTab) {
          newTab.document.write(html);
          newTab.document.close();
          newTab.focus();
          setTimeout(() => {
            newTab.print();
          }, 600);
        } else {
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
    <View style={[FL.container, { paddingHorizontal: H_PAD }]}>
      <View style={[isDesktop ? FL.desktopSplitLayout : { flexDirection: "column", flex: 1 }]}>
        
        <View style={[isDesktop ? { width: 360, marginRight: 24 } : { width: "100%" }]}>
          <View style={FL.totalsBanner}>
            <Text style={FL.panelHeaderTitle}>Financial Summary</Text>
            
            <View style={FL.totalsRow}>
              <View style={[FL.totalsIcon, { backgroundColor: "#ECFDF5" }]}><Ionicons name="trending-up" size={14} color={FL_GREEN} /></View>
              <Text style={FL.totalsLabel}>TOTAL REVENUE</Text>
              <Text style={[FL.totalsValue, { color: FL_GREEN }]}>{fmt(totalSales)}</Text>
            </View>
            
            <View style={FL.totalsRow}>
              <View style={[FL.totalsIcon, { backgroundColor: "#FEF2F2" }]}><Ionicons name="trending-down" size={14} color={FL_RED} /></View>
              <Text style={FL.totalsLabel}>ACCUMULATED EXPENSES</Text>
              <Text style={[FL.totalsValue, { color: FL_RED }]}>{fmt(grandTotal)}</Text>
            </View>
            
            <View style={FL.netProfitContainer}>
              <View style={[FL.totalsIcon, { backgroundColor: netProfit >= 0 ? "#ECFDF5" : "#FEF2F2" }]}>
                <Ionicons name={netProfit >= 0 ? "checkmark-circle" : "alert-circle"} size={14} color={netProfit >= 0 ? FL_GREEN : FL_RED} />
              </View>
              <Text style={FL.totalsLabel}>NET OPERATION PROFIT</Text>
              <Text style={[FL.totalsValue, { color: netProfit >= 0 ? FL_GREEN : FL_RED }]}>{netProfit >= 0 ? "" : "-"}{fmt(Math.abs(netProfit))}</Text>
            </View>
          </View>

          <View style={FL.controlContainerCard}>
            <Text style={FL.panelHeaderTitle}>Filter Horizon</Text>
            <View style={FL.tabRow}>
              {["Sales", "Expenses"].map((t) => (
                <TouchableOpacity key={t} style={[FL.tabBtn, ledgerTab === t && FL.tabBtnActive]} onPress={() => setLedgerTab(t)}>
                  <Text style={[FL.tabBtnText, ledgerTab === t && FL.tabBtnTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={FL.periodRow}>
              {PERIODS.map((p) => (
                <TouchableOpacity key={p} style={[FL.periodChip, period === p && FL.periodChipActive]} onPress={() => setPeriod(p)}>
                  <Text style={[FL.periodChipText, period === p && FL.periodChipTextActive]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={FL.listStreamContainer}>
          <View style={FL.ledgerHeaderRow}>
            <Text style={FL.sectionTitleLabel}>{ledgerTab} Records</Text>
            {ledgerTab === "Expenses" && (
              <View style={FL.exportRow}>
                <TouchableOpacity style={[FL.exportBtn, { backgroundColor: FL_DARK }, exporting && { opacity: 0.5 }]} onPress={exportPDF} disabled={exporting}>
                  {exporting ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name="document-text-outline" size={14} color="#fff" /><Text style={FL.exportBtnText}>PDF</Text></>}
                </TouchableOpacity>
                <TouchableOpacity style={[FL.exportBtn, { backgroundColor: "#059669" }, exporting && { opacity: 0.5 }]} onPress={exportCSV} disabled={exporting}>
                  {exporting ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name="document-outline" size={14} color="#fff" /><Text style={FL.exportBtnText}>CSV</Text></>}
                </TouchableOpacity>
              </View>
            )}
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false} 
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 120 }} 
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={FL_DARK} />}
          >
            {ledgerTab === "Sales" ? (
              !salesList.length ? (
                <View style={FL.emptyWrap}>
                  <View style={FL.emptyIconBox}><Ionicons name="cash-outline" size={32} color="#94A3B8" /></View>
                  <Text style={FL.emptyTitle}>No transactions recorded</Text>
                  <Text style={FL.emptySub}>Sales tracks automatically materialize here as client orders are processed.</Text>
                </View>
              ) : (
                salesList.map((sale, i) => (
                  <View key={i} style={FL.expRow}>
                    <View style={FL.dateBlock}><Text style={FL.dateDay}>{dayOf(sale.date)}</Text><Text style={FL.dateMon}>{monOf(sale.date)}</Text></View>
                    <View style={[FL.catIconBox, { backgroundColor: "#ECFDF5" }]}><Ionicons name="receipt" size={18} color={FL_GREEN} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={FL.expCat}>{sale.orders} {sale.orders === 1 ? "order" : "orders"}</Text>
                      <Text style={FL.expDesc}>Daily incoming operational revenue</Text>
                    </View>
                    <Text style={[FL.expAmt, { color: FL_GREEN }]}>+{fmt(sale.revenue)}</Text>
                  </View>
                ))
              )
            ) : !expenses.length ? (
              <View style={FL.emptyWrap}>
                <View style={FL.emptyIconBox}><Ionicons name="receipt-outline" size={32} color="#94A3B8" /></View>
                <Text style={FL.emptyTitle}>Log clear</Text>
                <Text style={FL.emptySub}>No metrics listed for this horizon window view.</Text>
              </View>
            ) : (
              expenses.map((exp) => {
                const cat        = getCat(exp.category);
                const isDeleting = deleting === exp.id;
                return (
                  <View key={exp.id} style={FL.expRow}>
                    <View style={FL.dateBlock}><Text style={FL.dateDay}>{dayOf(exp.expense_date)}</Text><Text style={FL.dateMon}>{monOf(exp.expense_date)}</Text></View>
                    <View style={[FL.catIconBox, { backgroundColor: cat.bg }]}><Ionicons name={cat.icon} size={18} color={cat.color} /></View>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={FL.expCat} numberOfLines={1}>{exp.category}</Text>
                      <Text style={FL.expDesc} numberOfLines={1}>{exp.description || cat.desc}</Text>
                      {exp.receipt_url && (
                        <View style={FL.receiptBadge}>
                          <Ionicons name="camera" size={10} color="#3B82F6" />
                          <Text style={FL.receiptBadgeText}>invoice link</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ alignItems: "flex-end", justifyContent: "center" }}>
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
        </View>

      </View>

      <TouchableOpacity style={FL.fab} onPress={handleAddNew} activeOpacity={0.85}>
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={FL.fabText}>LOG EXPENSE</Text>
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
// EXPENSE MODAL (Keeping your existing code)
// ═══════════════════════════════════════════════════════════════════════════════
function ExpenseModal({ visible, expense, onClose, onSaved }) {
  const isEdit = !!expense;

  const [category,        setCategory]        = useState(CATEGORIES[0].key);
  const [dropOpen,        setDropOpen]        = useState(false);
  const [amount,          setAmount]          = useState("");
  const [note,            setNote]            = useState("");
  const [date,            setDate]            = useState(new Date().toISOString().split("T")[0]);
  const [receipt,         setReceipt]         = useState(null);
  const [savedReceiptUrl, setSavedReceiptUrl] = useState(null);
  const [saving,          setSaving]          = useState(false);
  const [previewVisible,  setPreviewVisible]  = useState(false);
  const [previewUri,      setPreviewUri]      = useState(null);

  useEffect(() => {
    if (!visible) return;
    if (isEdit && expense) {
      setCategory(expense.category || CATEGORIES[0].key);
      setAmount(String(expense.amount || ""));
      setNote(expense.description || "");
      setDate(expense.expense_date?.split("T")[0] || toDateStr(new Date()));
      setReceipt(null);
      setSavedReceiptUrl(expense.receipt_url || null);
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
        setSavedReceiptUrl(null);
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
          const response  = await fetch(receipt.uri);
          const blob      = await response.blob();
          const mimeType  = blob.type || "image/jpeg";
          const ext       = mimeType.split("/")[1] || "jpg";
          const filename  = `receipt_${Date.now()}.${ext}`;
          fd.append("receipt", blob, filename);
        } else {
          fd.append("receipt", {
            uri:  receipt.uri,
            name: `receipt_${Date.now()}.jpg`,
            type: "image/jpeg",
          });
        }
      } else if (savedReceiptUrl) {
        fd.append("existingReceiptUrl", savedReceiptUrl);
      } else {
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

  const thumbUri = receipt?.uri || savedReceiptUrl || null;

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
        <View style={MD.overlay}>
          <View style={[MD.sheet, IS_WEB && { maxWidth: 460, alignSelf: "center", width: "100%", marginBottom: "4vh", borderRadius: 16 }]}>

            <View style={[MD.titleBar, IS_WEB && { borderTopLeftRadius: 16, borderTopRightRadius: 16 }]}>
              <Ionicons name={isEdit ? "pencil" : "add-circle"} size={18} color="#fff" />
              <Text style={MD.titleText}>{isEdit ? "EDIT EXPENSE LOG" : "LOG SYSTEM EXPENSE"}</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ paddingHorizontal: 20 }}>

              <View style={{ marginTop: 20 }}>
                <Text style={MD.fieldLabel}>EXPENSE CATEGORY</Text>
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
                          <Ionicons name={cat.icon} size={16} color={cat.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[MD.dropItemText, category === cat.key && { fontWeight: "700", color: FL_DARK }]}>{cat.key}</Text>
                          <Text style={MD.dropItemDesc}>{cat.desc}</Text>
                        </View>
                        {category === cat.key && <Ionicons name="checkmark-circle" size={18} color={FL_GREEN} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={{ marginTop: 24 }}>
                <Text style={MD.fieldLabel}>VALUATION AMOUNT (INR)</Text>
                <TextInput
                  style={MD.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                />
                <View style={MD.underline} />
              </View>

              <View style={{ marginTop: 20 }}>
                <Text style={MD.fieldLabel}>TRANSACTION MEMO / NOTE</Text>
                <TextInput
                  style={MD.noteInput}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Provide transaction contexts..."
                  placeholderTextColor="#94A3B8"
                  multiline
                />
                <View style={MD.underline} />
              </View>

              <View style={MD.dateRow}>
                <View style={MD.dateIconBox}><Ionicons name="calendar" size={16} color={FL_DARK} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={MD.datePre}>RECORD POST DATE</Text>
                  <TextInput
                    style={MD.dateInput}
                    value={date}
                    onChangeText={setDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                  />
                </View>
                <Text style={MD.dateLabelSmall}>{dateLabel}</Text>
              </View>

              <View style={{ marginBottom: 24 }}>
                <Text style={MD.fieldLabel}>SUPPORTING INVOICE SLIP (OPTIONAL)</Text>
                {thumbUri ? (
                  <View style={{ borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: BORDER }}>
                    <Image source={{ uri: thumbUri }} style={{ width: "100%", height: 140 }} resizeMode="cover" />
                    <TouchableOpacity onPress={() => openPreview(thumbUri)} style={MD.imgOverlayLeft}>
                      <Ionicons name="eye-outline" size={12} color="#fff" />
                      <Text style={MD.imgOverlayText}>Inspect</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={pickReceipt} style={MD.imgOverlayRight}>
                      <Ionicons name="camera" size={12} color="#fff" />
                      <Text style={MD.imgOverlayText}>Replace</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={MD.imgRemoveBtn} onPress={() => { setReceipt(null); setSavedReceiptUrl(null); }}>
                      <Ionicons name="close-circle" size={24} color={FL_RED} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={MD.receiptBtn} onPress={pickReceipt} activeOpacity={0.8}>
                    <View style={MD.receiptIconBox}><Ionicons name="camera" size={18} color="#fff" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={MD.receiptTitle}>ATTACH INVOICE RECEIPT</Text>
                      <Text style={MD.receiptSub}>Click to deploy visual validation file</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              <View style={MD.actionRow}>
                <TouchableOpacity style={MD.cancelBtn} onPress={handleClose}>
                  <Text style={MD.cancelText}>Dismiss</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[MD.confirmBtn, (!amount || saving) && { opacity: 0.5 }]}
                  onPress={handleSave}
                  disabled={!amount || saving}
                >
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={MD.confirmText}>{isEdit ? "Update" : "Confirm Entry"}</Text>}
                </TouchableOpacity>
              </View>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
        <View style={MD.previewOverlay}>
          <TouchableOpacity onPress={() => setPreviewVisible(false)} style={MD.previewClose}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          {previewUri && <Image source={{ uri: previewUri }} style={MD.previewImage} resizeMode="contain" />}
        </View>
      </Modal>
    </>
  );
}

// ─── FL / MD STYLES ──────────────────────────────────────────────────────────
const FL = StyleSheet.create({
  container:    { flex: 1, paddingTop: 16 },
  desktopSplitLayout: { flexDirection: "row", alignItems: "flex-start", flex: 1 },
  listStreamContainer: { flex: 1, width: "100%" },
  panelHeaderTitle: { fontSize: 14, fontWeight: "700", color: PRIMARY, marginBottom: 14 },
  totalsBanner: { backgroundColor: "#fff", padding: 18, borderRadius: 16, borderWidth: 1, borderColor: FL_BORD, marginBottom: 20, shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  totalsRow:    { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  totalsIcon:   { width: 22, height: 22, borderRadius: 6, alignItems: "center", justifyContent: "center", marginRight: 10 },
  totalsLabel:  { flex: 1, fontSize: 12, fontWeight: "600", color: TEXT_MUTED },
  totalsValue:  { fontSize: 15, fontWeight: "700" },
  netProfitContainer: { flexDirection: "row", alignItems: "center", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: FL_BORD },

  controlContainerCard: { backgroundColor: "#fff", padding: 18, borderRadius: 16, borderWidth: 1, borderColor: FL_BORD, shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  tabRow:       { flexDirection: "row", backgroundColor: "#F1F5F9", padding: 4, borderRadius: 10, marginBottom: 12 },
  tabBtn:       { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 6 },
  tabBtnActive: { backgroundColor: "#fff" },
  tabBtnText:   { fontSize: 13, fontWeight: "600", color: TEXT_MUTED },
  tabBtnTextActive:{ color: FL_DARK, fontWeight: "700" },

  periodRow:           { flexDirection: "row", gap: 6 },
  periodChip:          { flex: 1, paddingVertical: 6, alignItems: "center", borderRadius: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: FL_BORD },
  periodChipActive:    { backgroundColor: FL_DARK, borderColor: FL_DARK },
  periodChipText:      { fontSize: 12, fontWeight: "600", color: TEXT_MUTED },
  periodChipTextActive:{ color: "#fff" },

  ledgerHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: BORDER, paddingBottom: 10, marginBottom: 12, marginTop: 4 },
  sectionTitleLabel: { fontSize: 15, fontWeight: "700", color: PRIMARY },
  exportRow:    { flexDirection: "row", alignItems: "center", gap: 8 },
  exportBtn:    { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  exportBtnText:{ fontSize: 12, fontWeight: "600", color: "#fff" },

  expRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", marginBottom: 8,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: FL_BORD,
    shadowColor: "#0F172A", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 4,
  },
  dateBlock:  { width: 34, alignItems: "center", marginRight: 10 },
  dateDay:    { fontSize: 18, fontWeight: "800", color: FL_DARK },
  dateMon:    { fontSize: 10, fontWeight: "600", color: TEXT_MUTED },
  catIconBox: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", marginRight: 12, borderWidth: 1, borderColor: FL_BORD },
  expCat:     { fontSize: 14, fontWeight: "700", color: FL_DARK },
  expDesc:    { fontSize: 12, color: TEXT_MUTED, marginTop: 1 },
  expAmt:     { fontSize: 14, fontWeight: "700", color: FL_RED },
  receiptBadge:    { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4, backgroundColor: "#EFF6FF", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: "flex-start" },
  receiptBadgeText:{ fontSize: 9, color: "#3B82F6", fontWeight: "600" },
  rowActions: { flexDirection: "row", gap: 6, marginTop: 4 },
  editBtn:    { width: 26, height: 26, borderRadius: 6, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  deleteBtn:  { width: 26, height: 26, borderRadius: 6, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" },
  fab: {
    position: "absolute", bottom: 20, right: 20,
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: FL_GREEN, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12,
    shadowColor: "#059669", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
    zIndex: 99,
  },
  fabText:     { color: "#fff", fontWeight: "700", fontSize: 13 },
  emptyWrap:   { alignItems: "center", paddingTop: 50 },
  emptyIconBox:{ width: 56, height: 56, borderRadius: 14, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyTitle:  { fontSize: 14, fontWeight: "700", color: FL_DARK },
  emptySub:    { fontSize: 12, color: TEXT_MUTED, textAlign: "center", paddingHorizontal: 16 },
});

const MD = StyleSheet.create({
  overlay:{ flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" },
  sheet:  { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20, maxHeight: "85%" },
  titleBar:{ backgroundColor: FL_DARK, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 },
  titleText:{ fontSize: 12, fontWeight: "700", color: "#fff", letterSpacing: 0.5 },

  fieldLabel:  { fontSize: 11, fontWeight: "700", color: TEXT_MUTED, marginBottom: 6, letterSpacing: 0.3 },
  dropdown:    { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: FL_BORD, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  dropIconBox: { width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center", marginRight: 10 },
  dropText:    { flex: 1, fontSize: 14, fontWeight: "600", color: FL_DARK },
  dropList:    { marginTop: 4, borderWidth: 1, borderColor: FL_BORD, borderRadius: 10, backgroundColor: "#fff", overflow: "hidden" },
  dropItem:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  dropItemIcon:{ width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center", marginRight: 10 },
  dropItemText:{ fontSize: 14, fontWeight: "600", color: TEXT_MAIN },
  dropItemDesc:{ fontSize: 11, color: TEXT_MUTED, marginTop: 1 },

  amountInput:  { fontSize: 28, fontWeight: "700", color: FL_DARK, padding: 0 },
  underline:    { height: 1, backgroundColor: BORDER, marginTop: 4, marginBottom: 4 },
  noteInput:    { fontSize: 14, fontWeight: "500", color: FL_DARK, padding: 0, minHeight: 32 },

  dateRow:       { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14, marginBottom: 18, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#F1F5F9", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  dateIconBox:   { width: 26, height: 26, borderRadius: 6, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  datePre:       { fontSize: 10, fontWeight: "600", color: TEXT_MUTED },
  dateInput:     { fontSize: 14, fontWeight: "700", color: FL_DARK, padding: 0 },
  dateLabelSmall:{ fontSize: 12, color: TEXT_MUTED, fontWeight: "500" },

  imgOverlayLeft:  { position: "absolute", bottom: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(15,23,42,0.8)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  imgOverlayRight: { position: "absolute", bottom: 8, right: 8, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(15,23,42,0.8)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  imgOverlayText:  { fontSize: 11, color: "#fff", fontWeight: "600" },
  imgRemoveBtn:    { position: "absolute", top: 6, right: 6, backgroundColor: "#fff", borderRadius: 12 },

  receiptBtn:    { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: FL_DARK, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  receiptIconBox:{ width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  receiptTitle:  { fontSize: 12, fontWeight: "700", color: "#fff" },
  receiptSub:    { fontSize: 11, color: TEXT_MUTED, marginTop: 1 },

  actionRow:  { flexDirection: "row", gap: 10, marginTop: 10 },
  cancelBtn:  { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: FL_BORD, alignItems: "center" },
  cancelText: { fontSize: 13, fontWeight: "600", color: TEXT_MUTED },
  confirmBtn: { flex: 1.5, paddingVertical: 13, borderRadius: 10, backgroundColor: FL_DARK, alignItems: "center" },
  confirmText:{ fontSize: 13, fontWeight: "600", color: "#fff" },

  previewOverlay:{ flex: 1, backgroundColor: "rgba(15,23,42,0.95)", alignItems: "center", justifyContent: "center" },
  previewClose:  { position: "absolute", top: 36, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center", zIndex: 10 },
  previewImage:  { width: "90%", height: "70%" },
});