import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text as NativeText,
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
import LocalizedText, { localizeText } from "../components/LocalizedText";
import { useLocale } from "../context/LocaleContext";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { getAnalytics, getExpenses, addExpense, deleteExpense, updateExpense, askAdvisor, getSupplierSuggestions } from "../api";
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
      <LocalizedText key={i} style={advStyles.highlight}>{part}</LocalizedText>
    ) : (
      <LocalizedText key={i} style={advStyles.body}>{part}</LocalizedText>
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
    <LocalizedText style={style} numberOfLines={numberOfLines} adjustsFontSizeToFit>
      {formatter(display)}
    </LocalizedText>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
export default function AnalyticsScreen() {
  const { language } = useLocale();
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
      Alert.alert(localizeText("Error", language), localizeText("Unable to load analytics. Please try again.", language));
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
      Alert.alert(localizeText("Session Expired", language), localizeText("Please log in again and retry the download.", language));
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
        <LocalizedText translate style={[styles.loadingText, { marginTop: 12 }]}>Refining your data...</LocalizedText>
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
    catch { Alert.alert(localizeText("AI Advisor", language), localizeText("Open the AI Business Advisor tab for the full breakdown.", language)); }
  };

  const goToAllItems = () => {
    try { navigation.navigate("Menu"); }
    catch { Alert.alert(localizeText("Top Items", language), localizeText("Full item list is available on the Menu screen.", language)); }
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
              <LocalizedText style={[styles.mainTabText, activeMainTab === tab && styles.mainTabTextActive]}>{tab}</LocalizedText>
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
              <LocalizedText translate style={styles.greeting}>Performance Overview</LocalizedText>
              <LocalizedText translate style={styles.headerTitle}>Analytics</LocalizedText>
              <LocalizedText style={styles.headerSub}>{startDate} — {endDate}</LocalizedText>
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
                <LocalizedText translate style={styles.premiumCardTitle}>Sales Overview</LocalizedText>
                <View style={styles.periodTabs}>
                  {[["daily", "Day"], ["weekly", "Week"], ["monthly", "Month"]].map(([key, label]) => (
                    <TouchableOpacity
                      key={key}
                      style={[styles.periodTab, chartPeriod === key && styles.periodTabActive]}
                      onPress={() => setChartPeriod(key)}
                    >
                      <LocalizedText style={[styles.periodTabText, chartPeriod === key && styles.periodTabTextActive]}>{label}</LocalizedText>
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
                      <LocalizedText style={styles.chartInfoDate}>
                        {chartPeriod === "daily"
                          ? new Date(activeDay.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
                          : activeDay.x}
                      </LocalizedText>
                      <LocalizedText style={styles.chartInfoSub}>{activeDay.orders} {activeDay.orders === 1 ? "order" : "orders"}</LocalizedText>
                    </View>
                    <LocalizedText style={styles.chartInfoValue}>₹{activeDay.y.toLocaleString("en-IN")}</LocalizedText>
                  </View>
                )}
                {revenueChartData.length === 0 || revenueChartData.every(d => d.y === 0) ? (
                  <View style={styles.chartEmpty}>
                    <Ionicons name="trending-up-outline" size={36} color={TEXT_FAINT} />
                    <LocalizedText translate style={styles.chartEmptyText}>No sales activity recorded</LocalizedText>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={isMobileView ? { width: "100%", marginTop: 28 } : { flex: 1 }}>
              <View style={styles.topItemsHeaderRow}>
                <LocalizedText translate style={styles.premiumCardTitle}>Top Items</LocalizedText>
                <TouchableOpacity onPress={goToAllItems} activeOpacity={0.7}>
                  <LocalizedText translate style={styles.viewAllText}>View all</LocalizedText>
                </TouchableOpacity>
              </View>
              <View style={styles.premiumCard}>
                {topItems.length ? (
                  topItems.map((item, i) => {
                    const pct = maxQty > 0 ? (parseInt(item.total_qty) || 0) / maxQty : 0;
                    return (
                      <View key={i} style={[styles.itemRow, i === topItems.length - 1 && { marginBottom: 0 }]}>
                        <LocalizedText style={styles.itemRank}>{i + 1}.</LocalizedText>
                        <LocalizedText style={styles.itemName} numberOfLines={1}>{item.name}</LocalizedText>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
                        </View>
                        <LocalizedText style={styles.itemQty}>{item.total_qty}</LocalizedText>
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.emptyItems}><LocalizedText translate style={styles.emptyText}>Data compiling...</LocalizedText></View>
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
                <LocalizedText translate style={styles.fieldLabel}>CHOOSE PERIOD TIME RANGE</LocalizedText>
                <View style={styles.rangeSelector}>
                  {[7, 30, 90].map((d) => {
                    const isActive = startDate === toDateStr(new Date(Date.now() - d * 86400000));
                    return (
                      <TouchableOpacity key={d} style={[styles.rangeTab, isActive && styles.rangeTabActive]} onPress={() => handleRangeSelect(d)}>
                        <LocalizedText style={[styles.rangeTabText, isActive && { color: "#fff" }]}>{d} Days</LocalizedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={[!isMobileView && styles.webReportBtnStack, isMobileView && { gap: 12, marginTop: 12 }]}>
                <TouchableOpacity style={[styles.exportBtn, downloading && { opacity: 0.7 }]} onPress={() => downloadReport("pdf")} disabled={downloading}>
                  {downloading ? <ActivityIndicator color="#fff" /> : <><Ionicons name="document-text" size={20} color="#fff" /><LocalizedText translate style={styles.exportBtnText}>Export PDF Document</LocalizedText></>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.csvBtn} onPress={() => downloadReport("csv")}>
                  <Ionicons name="grid-outline" size={18} color={PRIMARY} />
                  <LocalizedText translate style={styles.csvBtnText}>Extract CSV Spreadsheet</LocalizedText>
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
      <View style={{ flex: 1 }}><LocalizedText style={secStyles.title}>{title}</LocalizedText><LocalizedText style={secStyles.sub}>{subtitle}</LocalizedText></View>
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
        <LocalizedText style={styles.kpiLabel} numberOfLines={1}>{label}</LocalizedText>
        <View style={[styles.kpiIconBox, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
      </View>
      <AnimatedNumber value={rawValue} formatter={formatter} style={styles.kpiValue} />
      {hasTrend && (
        <View style={styles.trendRow}>
          <Ionicons name={isUp ? "arrow-up" : "arrow-down"} size={11} color={isUp ? ACCENT : DANGER} />
          <LocalizedText style={[styles.trendText, { color: isUp ? ACCENT : DANGER }]}>
            {Math.abs(trend).toFixed(1)}% vs yesterday
          </LocalizedText>
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
        <LocalizedText translate style={styles.kpiLabel} numberOfLines={1}>Tables Occupied</LocalizedText>
        <View style={[styles.kpiIconBox, { backgroundColor: "#F5F3FF" }]}>
          <Ionicons name="restaurant" size={16} color="#8B5CF6" />
        </View>
      </View>
      <LocalizedText style={styles.kpiValue} numberOfLines={1}>
        {hasData ? `${occupied}/${total}` : "—/—"}
      </LocalizedText>
      <View style={styles.liveBadge}>
        <View style={styles.liveDot} />
        <LocalizedText style={styles.liveBadgeText}>{hasData ? "Live" : "Awaiting data"}</LocalizedText>
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
        <LocalizedText translate style={advStyles.eyebrow}>AI Business Advisor</LocalizedText>
      </View>
      <LocalizedText style={advStyles.insight}>{renderHighlightedInsight(insight)}</LocalizedText>
      <TouchableOpacity style={advStyles.linkBtn} onPress={onViewMore} activeOpacity={0.8}>
        <LocalizedText translate style={advStyles.linkText}>View Full Insights</LocalizedText>
      </TouchableOpacity>
    </View>
  );
}

const advStyles = StyleSheet.create({
  card:     { backgroundColor: "#fff", borderRadius: 14, padding: 18, borderWidth: 1, borderColor: BORDER },
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
// ASK ADVISOR BOX
// ═══════════════════════════════════════════════════════════════════════════════
function AskAdvisorBox() {
  const { language } = useLocale();
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
      Alert.alert(localizeText("Error", language), localizeText("Could not get response. Please try again.", language));
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
          placeholder={localizeText("Ask anything about your business...", language)}
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
            <LocalizedText translate style={askStyles.responseLabel}>AI Response</LocalizedText>
          </View>
          <LocalizedText style={askStyles.responseText} numberOfLines={4} ellipsizeMode="tail">
            {response.answer || response.message}
          </LocalizedText>
          <TouchableOpacity 
            style={askStyles.viewFullBtn}
            onPress={() => navigation.navigate("Advisor")}
          >
            <LocalizedText translate style={askStyles.viewFullText}>View Full Conversation</LocalizedText>
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

  const { language } = useLocale();
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
      Alert.alert(localizeText("Delete Expense", language), msg, [
        { text: localizeText("Cancel", language), style: "cancel" },
        { text: localizeText("Delete", language), style: "destructive", onPress: () => confirmDelete(exp.id) },
      ]);
    }
  };

  const confirmDelete = async (id) => {
    setDeleting(id);
    try { await deleteExpense(id); load(); }
    catch { Alert.alert(localizeText("Error", language), localizeText("Could not delete expense. Try again.", language)); }
    finally { setDeleting(null); }
  };

  const handleEdit   = (exp) => { setEditingExp(exp); setShowModal(true); };
  const handleAddNew = ()    => { setEditingExp(null); setShowModal(true); };

  const exportCSV = async () => {
    if (!expenses.length) {
      Alert.alert(localizeText("No Data", language), localizeText("No expenses to export.", language));
      return;
    }
    setExporting(true);

    try {
      const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);

      const hotelDisplayName = (
        typeof businessName !== "undefined" ? businessName :
        typeof user !== "undefined" ? user?.business_name :
        "HOTEL ANALYTICS"
      ).toUpperCase();

      const todayIST = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      }) + " IST";

      const parsedSales = parseFloat(totalSales || 0);
      const parsedExpenses = parseFloat(grandTotal || 0);
      const netProfit = parsedSales - parsedExpenses;

      const catTotals = {};
      expenses.forEach((e) => {
        catTotals[e.category] = (catTotals[e.category] || 0) + parseFloat(e.amount || 0);
      });

      const catRows = Object.entries(catTotals)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amt]) => {
          const pct = parsedExpenses ? ((amt / parsedExpenses) * 100).toFixed(1) : "0.0";
          return [cat, amt.toFixed(2), `${pct}%`];
        });

      const rows = [
        [hotelDisplayName],
        ["EXPENSE & FINANCIAL REPORT"],
        ["Period", periodLabel],
        ["Generated At", todayIST],
        [],
        ["FINANCIAL SUMMARY"],
        ["Metric", "Amount (INR)"],
        ["Total Sales", parsedSales.toFixed(2)],
        ["Total Expenses", parsedExpenses.toFixed(2)],
        ["Net Operating Profit", netProfit.toFixed(2)],
        [],
        ["CATEGORY BREAKDOWN"],
        ["Category", "Amount (INR)", "% of Total"],
        ...catRows,
        ["TOTAL EXPENSES", parsedExpenses.toFixed(2), "100.0%"],
        [],
        ["DETAILED LEDGER"],
        ["Date", "Category", "Description", "Amount (INR)"],
        ...expenses.map((e) => [
          e.expense_date?.split("T")[0] || "",
          e.category || "General",
          e.description || "—",
          parseFloat(e.amount || 0).toFixed(2),
        ]),
        ["TOTAL EXPENSES", "", `${expenses.length} Records`, parsedExpenses.toFixed(2)],
      ];

      const csvContent = rows
        .map((r) =>
          r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")
        )
        .join("\n");

      const fileName = `expenses_${period}_${new Date().toISOString().split("T")[0]}.csv`;

      if (Platform.OS === "web") {
        const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const path = FileSystem.cacheDirectory + fileName;
        await FileSystem.writeAsStringAsync(path, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        await Sharing.shareAsync(path, {
          mimeType: "text/csv",
          dialogTitle: "Export Expenses CSV",
        });
      }
    } catch (err) {
      console.error("CSV Export Error:", err);
      Alert.alert(localizeText("Export Error", language), localizeText("Could not export CSV. Please try again.", language));
    } finally {
      setExporting(false);
    }
  };

  const exportPDF = async () => {
    if (!expenses.length) {
      Alert.alert(localizeText("No Data", language), localizeText("No expenses to export.", language));
      return;
    }
    setExporting(true);

    try {
      const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);

      const hotelDisplayName = (
        typeof businessName !== "undefined" ? businessName :
        typeof user !== "undefined" ? user?.business_name :
        "HOTEL ANALYTICS"
      ).toUpperCase();

      const todayIST = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      }) + " IST";

      const fmtCurr = (val) =>
        `₹${Number(val || 0).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

      const parsedSales = parseFloat(totalSales || 0);
      const parsedExpenses = parseFloat(grandTotal || 0);
      const netProfit = parsedSales - parsedExpenses;

      const catTotals = {};
      expenses.forEach((e) => {
        catTotals[e.category] = (catTotals[e.category] || 0) + parseFloat(e.amount || 0);
      });

      const catRows = Object.entries(catTotals)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amt]) => {
          const pct = parsedExpenses ? ((amt / parsedExpenses) * 100).toFixed(1) : "0.0";
          return `
            <tr>
              <td style="font-weight:600;color:#111827">${cat}</td>
              <td style="text-align:right;font-weight:700;color:#111827">${fmtCurr(amt)}</td>
              <td style="text-align:right;color:#6B7280">${pct}%</td>
            </tr>`;
        })
        .join("");

      const expRows = expenses
        .map((e, i) => {
          const dateStr = e.expense_date ? e.expense_date.split("T")[0] : "—";
          const rowBg = i % 2 === 0 ? "#FFFFFF" : "#FAFAFA";
          const supplierInfo = e.supplier ? `<span style="color:#6B7280;font-weight:500;font-size:11px;display:block">${e.supplier}</span>` : '';
          const statusInfo = e.payment_status ? `<span style="font-size:10px;color:${e.payment_status === 'paid' ? '#10B981' : e.payment_status === 'partially_paid' ? '#F59E0B' : '#EF4444'};font-weight:600;display:block">${e.payment_status.replace('_', ' ').toUpperCase()}</span>` : '';
          return `
            <tr style="background:${rowBg}">
              <td style="color:#374151;white-space:nowrap">${dateStr}</td>
              <td style="font-weight:600;color:#111827">${e.category || "General"}${e.sub_category ? `<br/><span style="font-size:10px;color:#6B7280">${e.sub_category}</span>` : ''}</td>
              <td style="color:#4B5563">${e.description || "—"}${supplierInfo}</td>
              <td style="text-align:right;font-weight:700;color:#EF4444">
                ${fmtCurr(e.amount)}
                ${statusInfo}
                ${e.amount_paid ? `<span style="font-size:9px;color:#6B7280;display:block">Paid: ${fmtCurr(e.amount_paid)}</span>` : ''}
                ${e.amount_paid && (e.amount - e.amount_paid) > 0 ? `<span style="font-size:9px;color:#EF4444;display:block">Remaining: ${fmtCurr(e.amount - e.amount_paid)}</span>` : ''}
              </td>
            </tr>`;
        })
        .join("");

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 36px; color: #111827; background: #FFF; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none !important; }
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 18px; border-bottom: 2px solid #1E3A5F; margin-bottom: 24px; }
    .hotel-name { font-size: 22px; font-weight: 900; color: #1E3A5F; letter-spacing: 0.5px; text-transform: uppercase; }
    .report-title { font-size: 13px; font-weight: 700; color: #6B7280; margin-top: 4px; letter-spacing: 1px; }
    .badge { display: inline-block; background: #1E3A5F; color: #FFFFFF; font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px; }
    .gen-date { font-size: 11px; color: #9CA3AF; margin-top: 6px; text-align: right; }
    .summary { display: flex; gap: 16px; margin-bottom: 28px; }
    .card { flex: 1; border-radius: 8px; padding: 14px 16px; border: 1px solid #E5E7EB; background: #F9FAFB; }
    .card-label { font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
    .card-value { font-size: 20px; font-weight: 900; }
    .card-green { background: #F0FDF4; border-color: #BBF7D0; } .card-green .card-label, .card-green .card-value { color: #059669; }
    .card-red { background: #FEF2F2; border-color: #FECACA; } .card-red .card-label, .card-red .card-value { color: #EF4444; }
    .card-blue { background: #EFF6FF; border-color: #BFDBFE; }
    .section-title { font-size: 12px; font-weight: 800; color: #1E3A5F; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 10px; margin-top: 24px; border-left: 3px solid #059669; padding-left: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 12px; }
    th { background: #F7F7F6; color: #1E3A5F; padding: 10px 12px; text-align: left; font-size: 10px; font-weight: 800; letter-spacing: 0.5px; border-top: 1px solid #D1D5DB; border-bottom: 1px solid #D1D5DB; text-transform: uppercase; }
    td { padding: 9px 12px; border-bottom: 1px solid #E5E7EB; }
    .total-row td { font-weight: 900; background: #F7F7F6; color: #1E3A5F; border-top: 1.5px solid #1E3A5F; border-bottom: 1.5px solid #1E3A5F; font-size: 12px; }
    .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #E5E7EB; font-size: 10px; color: #9CA3AF; display: flex; justify-content: space-between; }
    .print-hint { text-align: center; padding: 12px; background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 6px; font-size: 12px; color: #059669; font-weight: 700; margin-bottom: 20px; }
  </style>
</head>
<body>

  <div class="print-hint no-print">📄 Press Ctrl+P (or Cmd+P on Mac) → Save as PDF</div>

  <div class="header">
    <div>
      <div class="hotel-name">${hotelDisplayName}</div>
      <div class="report-title">EXPENSE & FINANCIAL REPORT</div>
    </div>
    <div style="text-align:right">
      <div class="badge">${periodLabel}</div>
      <div class="gen-date">Generated: ${todayIST}</div>
    </div>
  </div>

  <div class="summary">
    <div class="card card-green">
      <div class="card-label">Total Sales</div>
      <div class="card-value">${fmtCurr(parsedSales)}</div>
    </div>
    <div class="card card-red">
      <div class="card-label">Total Expenses</div>
      <div class="card-value">${fmtCurr(parsedExpenses)}</div>
    </div>
    <div class="card card-blue">
      <div class="card-label">Net Operating Profit</div>
      <div class="card-value" style="color: ${netProfit >= 0 ? "#059669" : "#EF4444"}">
        ${netProfit >= 0 ? "" : "-"}${fmtCurr(Math.abs(netProfit))}
      </div>
    </div>
  </div>

  <div class="section-title">Category Breakdown</div>
  <table>
    <thead>
      <tr>
        <th>Category</th>
        <th style="text-align:right">Amount</th>
        <th style="text-align:right">% of Total</th>
      </tr>
    </thead>
    <tbody>
      ${catRows}
      <tr class="total-row">
        <td>TOTAL EXPENSES</td>
        <td style="text-align:right;color:#EF4444">${fmtCurr(parsedExpenses)}</td>
        <td style="text-align:right">100.0%</td>
      </tr>
    </tbody>
  </table>

  <div class="section-title">Detailed Ledger</div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Category</th>
        <th>Description / Supplier</th>
        <th style="text-align:right">Amount / Status</th>
      </tr>
    </thead>
    <tbody>
      ${expRows}
      <tr class="total-row">
        <td colspan="3">TOTAL EXPENSES (${expenses.length} records)</td>
        <td style="text-align:right;color:#EF4444">${fmtCurr(parsedExpenses)}</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <div>© ${new Date().getFullYear()} ${hotelDisplayName} • Confidential Financial Report</div>
    <div>Generated: ${todayIST}</div>
  </div>

</body>
</html>`;

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
          const a = document.createElement("a");
          a.href = href;
          a.download = `expenses_${period}_${new Date().toISOString().split("T")[0]}.html`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(href);
          Alert.alert(
            "Popup Blocked",
            "Your browser blocked the PDF window. The file was downloaded as HTML — open it in your browser and press Ctrl+P to save as PDF."
          );
        }
      } else {
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Export Expenses PDF" });
      }
    } catch (err) {
      console.error("PDF error:", err);
      Alert.alert(localizeText("Export Error", language), localizeText("Could not generate PDF. Please try again.", language));
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
            <LocalizedText translate style={FL.panelHeaderTitle}>Financial Summary</LocalizedText>
            
            <View style={FL.totalsRow}>
              <View style={[FL.totalsIcon, { backgroundColor: "#ECFDF5" }]}><Ionicons name="trending-up" size={14} color={FL_GREEN} /></View>
              <LocalizedText translate style={FL.totalsLabel}>TOTAL REVENUE</LocalizedText>
              <LocalizedText style={[FL.totalsValue, { color: FL_GREEN }]}>{fmt(totalSales)}</LocalizedText>
            </View>
            
            <View style={FL.totalsRow}>
              <View style={[FL.totalsIcon, { backgroundColor: "#FEF2F2" }]}><Ionicons name="trending-down" size={14} color={FL_RED} /></View>
              <LocalizedText translate style={FL.totalsLabel}>ACCUMULATED EXPENSES</LocalizedText>
              <LocalizedText style={[FL.totalsValue, { color: FL_RED }]}>{fmt(grandTotal)}</LocalizedText>
            </View>
            
            <View style={FL.netProfitContainer}>
              <View style={[FL.totalsIcon, { backgroundColor: netProfit >= 0 ? "#ECFDF5" : "#FEF2F2" }]}>
                <Ionicons name={netProfit >= 0 ? "checkmark-circle" : "alert-circle"} size={14} color={netProfit >= 0 ? FL_GREEN : FL_RED} />
              </View>
              <LocalizedText translate style={FL.totalsLabel}>NET OPERATION PROFIT</LocalizedText>
              <LocalizedText style={[FL.totalsValue, { color: netProfit >= 0 ? FL_GREEN : FL_RED }]}>{netProfit >= 0 ? "" : "-"}{fmt(Math.abs(netProfit))}</LocalizedText>
            </View>
          </View>

          <View style={FL.controlContainerCard}>
            <LocalizedText translate style={FL.panelHeaderTitle}>Filter Horizon</LocalizedText>
            <View style={FL.tabRow}>
              {["Sales", "Expenses"].map((t) => (
                <TouchableOpacity key={t} style={[FL.tabBtn, ledgerTab === t && FL.tabBtnActive]} onPress={() => setLedgerTab(t)}>
                  <LocalizedText style={[FL.tabBtnText, ledgerTab === t && FL.tabBtnTextActive]}>{t}</LocalizedText>
                </TouchableOpacity>
              ))}
            </View>
            <View style={FL.periodRow}>
              {PERIODS.map((p) => (
                <TouchableOpacity key={p} style={[FL.periodChip, period === p && FL.periodChipActive]} onPress={() => setPeriod(p)}>
                  <LocalizedText style={[FL.periodChipText, period === p && FL.periodChipTextActive]}>{p.charAt(0).toUpperCase() + p.slice(1)}</LocalizedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={FL.listStreamContainer}>
          <View style={FL.ledgerHeaderRow}>
            <LocalizedText style={FL.sectionTitleLabel}>{ledgerTab} Records</LocalizedText>
            {ledgerTab === "Expenses" && (
              <View style={FL.exportRow}>
                <TouchableOpacity style={[FL.exportBtn, { backgroundColor: FL_DARK }, exporting && { opacity: 0.5 }]} onPress={exportPDF} disabled={exporting}>
                  {exporting ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name="document-text-outline" size={14} color="#fff" /><LocalizedText translate style={FL.exportBtnText}>PDF</LocalizedText></>}
                </TouchableOpacity>
                <TouchableOpacity style={[FL.exportBtn, { backgroundColor: "#059669" }, exporting && { opacity: 0.5 }]} onPress={exportCSV} disabled={exporting}>
                  {exporting ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name="document-outline" size={14} color="#fff" /><LocalizedText translate style={FL.exportBtnText}>CSV</LocalizedText></>}
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
                  <LocalizedText translate style={FL.emptyTitle}>No transactions recorded</LocalizedText>
                  <LocalizedText translate style={FL.emptySub}>Sales tracks automatically materialize here as client orders are processed.</LocalizedText>
                </View>
              ) : (
                salesList.map((sale, i) => (
                  <View key={i} style={FL.expRow}>
                    <View style={FL.dateBlock}><LocalizedText style={FL.dateDay}>{dayOf(sale.date)}</LocalizedText><LocalizedText style={FL.dateMon}>{monOf(sale.date)}</LocalizedText></View>
                    <View style={[FL.catIconBox, { backgroundColor: "#ECFDF5" }]}><Ionicons name="receipt" size={18} color={FL_GREEN} /></View>
                    <View style={{ flex: 1 }}>
                      <LocalizedText style={FL.expCat}>{sale.orders} {sale.orders === 1 ? "order" : "orders"}</LocalizedText>
                      <LocalizedText translate style={FL.expDesc}>Daily incoming operational revenue</LocalizedText>
                    </View>
                    <LocalizedText style={[FL.expAmt, { color: FL_GREEN }]}>+{fmt(sale.revenue)}</LocalizedText>
                  </View>
                ))
              )
            ) : !expenses.length ? (
              <View style={FL.emptyWrap}>
                <View style={FL.emptyIconBox}><Ionicons name="receipt-outline" size={32} color="#94A3B8" /></View>
                <LocalizedText translate style={FL.emptyTitle}>Log clear</LocalizedText>
                <LocalizedText translate style={FL.emptySub}>No metrics listed for this horizon window view.</LocalizedText>
              </View>
            ) : (
              expenses.map((exp) => {
                const cat = getCat(exp.category);
                const isDeleting = deleting === exp.id;
                const status = exp.payment_status || 'unpaid';
                
                const getStatusColor = (s) => {
                  const colors = { paid: "#10B981", partially_paid: "#F59E0B", unpaid: "#EF4444" };
                  return colors[s] || "#6B7280";
                };
                
                const getStatusBg = (s) => {
                  const bgColors = { paid: "#D1FAE5", partially_paid: "#FEF3C7", unpaid: "#FEE2E2" };
                  return bgColors[s] || "#F3F4F6";
                };
                
                const getStatusLabel = (s) => {
                  const labels = { 
                    paid: localizeText("Paid", language), 
                    partially_paid: localizeText("Partially Paid", language), 
                    unpaid: localizeText("Unpaid", language) 
                  };
                  return labels[s] || s;
                };

                const remaining = (parseFloat(exp.amount) || 0) - (parseFloat(exp.amount_paid) || 0);

                return (
                  <View key={exp.id} style={FL.expRow}>
                    <View style={FL.dateBlock}>
                      <LocalizedText style={FL.dateDay}>{dayOf(exp.expense_date)}</LocalizedText>
                      <LocalizedText style={FL.dateMon}>{monOf(exp.expense_date)}</LocalizedText>
                    </View>
                    <View style={[FL.catIconBox, { backgroundColor: cat.bg }]}>
                      <Ionicons name={cat.icon} size={18} color={cat.color} />
                    </View>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <LocalizedText style={FL.expCat} numberOfLines={1}>{exp.category}</LocalizedText>
                        {exp.supplier && (
                          <LocalizedText style={[FL.expCat, { fontSize: 12, color: TEXT_MUTED, fontWeight: "500" }]} numberOfLines={1}>• {exp.supplier}</LocalizedText>
                        )}
                      </View>
                      <LocalizedText style={FL.expDesc} numberOfLines={1}>
                        {exp.description || cat.desc}
                        {exp.sub_category && ` (${exp.sub_category})`}
                      </LocalizedText>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
                        <View style={[FL.statusBadge, { backgroundColor: getStatusBg(status), paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 4 }]}>
                          <View style={[FL.statusDot, { backgroundColor: getStatusColor(status), width: 6, height: 6, borderRadius: 3 }]} />
                          <LocalizedText style={[FL.statusText, { color: getStatusColor(status), fontSize: 10, fontWeight: "600" }]}>
                            {getStatusLabel(status)}
                          </LocalizedText>
                        </View>
                        {parseFloat(exp.amount_paid) > 0 && remaining > 0 && (
                          <LocalizedText style={{ fontSize: 10, color: TEXT_MUTED }}>
                            {localizeText("Remaining", language)}: ₹{remaining.toFixed(0)}
                          </LocalizedText>
                        )}
                        {exp.receipt_url && (
                          <View style={FL.receiptBadge}>
                            <Ionicons name="camera" size={10} color="#3B82F6" />
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end", justifyContent: "center" }}>
                      <LocalizedText style={FL.expAmt}>-{fmt(exp.amount)}</LocalizedText>
                      <View style={FL.rowActions}>
                        <TouchableOpacity style={FL.editBtn} onPress={() => handleEdit(exp)} disabled={isDeleting}>
                          <Ionicons name="pencil" size={13} color="#3B82F6" />
                        </TouchableOpacity>
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
        <LocalizedText translate style={FL.fabText}>LOG EXPENSE</LocalizedText>
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
// EXPENSE MODAL - ENHANCED VERSION
// ═══════════════════════════════════════════════════════════════════════════════
function ExpenseModal({ visible, expense, onClose, onSaved }) {
  const { language } = useLocale();
  const isEdit = !!expense;

  const CATEGORIES_WITH_SUB = [
    { key: "Utilities",     icon: "flash", color: "#F59E0B", bg: "#FEF3C7", desc: "Power, water & utility charges" },
    { key: "Payroll",       icon: "people", color: "#3B82F6", bg: "#EFF6FF", desc: "Wages, salaries & advances" },
    { key: "Procurement",   icon: "cube", color: "#8B5CF6", bg: "#F5F3FF", desc: "Raw materials & supplies" },
    { key: "Maintenance",   icon: "construct", color: "#F97316", bg: "#FFF7ED", desc: "Equipment & repair costs" },
    { key: "Waste",         icon: "trash", color: "#EF4444", bg: "#FEF2F2", desc: "Expired or wasted items" },
    { key: "Other",         icon: "ellipsis-horizontal-circle", color: "#6B7280", bg: "#F3F4F6", desc: "Miscellaneous expenses" },
  ];

  const SUB_CATEGORIES = [
    "Groceries", "Vegetables & Fruits", "Dairy", "Meat/Chicken/Fish",
    "Beverages", "Cooking Oil", "Spices & Ingredients", "Packaging",
    "Cleaning Supplies", "Other Supplies"
  ];

  const [category, setCategory] = useState(CATEGORIES_WITH_SUB[0].key);
  const [subCategory, setSubCategory] = useState("");
  const [dropOpen, setDropOpen] = useState(false);
  const [subDropOpen, setSubDropOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [supplier, setSupplier] = useState("");
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [purchaseDate, setPurchaseDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [savedReceiptUrl, setSavedReceiptUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState(null);

  useEffect(() => {
    if (visible && supplier.length > 1) {
      const loadSuggestions = async () => {
        try {
          const response = await getSupplierSuggestions();
          const allSuppliers = response.data?.suppliers || [];
          const filtered = allSuppliers.filter(s => 
            s.toLowerCase().includes(supplier.toLowerCase())
          );
          setSupplierSuggestions(filtered.slice(0, 5));
          setShowSupplierSuggestions(filtered.length > 0);
        } catch (error) {
          console.error("Error loading supplier suggestions:", error);
        }
      };
      loadSuggestions();
    } else {
      setShowSupplierSuggestions(false);
    }
  }, [supplier, visible]);

  useEffect(() => {
    if (!visible) return;
    if (isEdit && expense) {
      setCategory(expense.category || CATEGORIES_WITH_SUB[0].key);
      setSubCategory(expense.sub_category || "");
      setAmount(String(expense.amount || ""));
      setAmountPaid(String(expense.amount_paid || ""));
      setSupplier(expense.supplier || "");
      setNote(expense.description || "");
      setDate(expense.expense_date?.split("T")[0] || toDateStr(new Date()));
      setPurchaseDate(expense.purchase_date || "");
      setInvoiceNumber(expense.invoice_number || "");
      setReceipt(null);
      setSavedReceiptUrl(expense.receipt_url || null);
    } else {
      setCategory(CATEGORIES_WITH_SUB[0].key);
      setSubCategory("");
      setAmount("");
      setAmountPaid("");
      setSupplier("");
      setNote("");
      setDate(new Date().toISOString().split("T")[0]);
      setPurchaseDate("");
      setInvoiceNumber("");
      setReceipt(null);
      setSavedReceiptUrl(null);
    }
    setDropOpen(false);
    setSubDropOpen(false);
  }, [visible, expense]);

  const reset = () => {
    setCategory(CATEGORIES_WITH_SUB[0].key);
    setSubCategory("");
    setDropOpen(false);
    setSubDropOpen(false);
    setAmount("");
    setAmountPaid("");
    setSupplier("");
    setNote("");
    setDate(new Date().toISOString().split("T")[0]);
    setPurchaseDate("");
    setInvoiceNumber("");
    setReceipt(null);
    setSavedReceiptUrl(null);
  };

  const handleClose = () => { reset(); onClose(); };
  const openPreview = (uri) => { setPreviewUri(uri); setPreviewVisible(true); };

  const totalAmount = parseFloat(amount) || 0;
  const paidAmount = parseFloat(amountPaid) || 0;
  const remainingAmount = Math.max(0, totalAmount - paidAmount);
  
  let paymentStatus = "unpaid";
  if (paidAmount >= totalAmount && totalAmount > 0) paymentStatus = "paid";
  else if (paidAmount > 0 && paidAmount < totalAmount) paymentStatus = "partially_paid";

  const getPaymentStatusLabel = (status) => {
    const labels = {
      paid: localizeText("Paid", language),
      partially_paid: localizeText("Partially Paid", language),
      unpaid: localizeText("Unpaid", language),
    };
    return labels[status] || status;
  };

  const getPaymentStatusColor = (status) => {
    const colors = {
      paid: "#10B981",
      partially_paid: "#F59E0B",
      unpaid: "#EF4444",
    };
    return colors[status] || "#6B7280";
  };

  const getPaymentStatusBg = (status) => {
    const bgColors = {
      paid: "#D1FAE5",
      partially_paid: "#FEF3C7",
      unpaid: "#FEE2E2",
    };
    return bgColors[status] || "#F3F4F6";
  };

  const pickReceipt = async () => {
    try {
      if (Platform.OS !== "web") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(localizeText("Permission Required", language), localizeText("Please allow photo library access in Settings.", language));
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
      Alert.alert(localizeText("Error", language), localizeText("Could not open photo library.", language));
    }
  };

  const handleSave = async () => {
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)
      return Alert.alert(localizeText("Invalid Amount", language), localizeText("Please enter a valid amount greater than 0.", language));

    if (parseFloat(amountPaid) > parseFloat(amount)) {
      return Alert.alert(localizeText("Invalid Payment", language), localizeText("Amount paid cannot exceed total amount.", language));
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("category", category);
      fd.append("amount", amount);
      fd.append("description", note);
      fd.append("expenseDate", date);
      fd.append("supplier", supplier);
      fd.append("amountPaid", amountPaid || "0");
      fd.append("paymentStatus", paymentStatus);
      fd.append("invoiceNumber", invoiceNumber);
      fd.append("purchaseDate", purchaseDate || date);
      fd.append("subCategory", subCategory);

      if (receipt) {
        if (Platform.OS === "web") {
          const response = await fetch(receipt.uri);
          const blob = await response.blob();
          const mimeType = blob.type || "image/jpeg";
          const ext = mimeType.split("/")[1] || "jpg";
          const filename = `receipt_${Date.now()}.${ext}`;
          fd.append("receipt", blob, filename);
        } else {
          fd.append("receipt", {
            uri: receipt.uri,
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
      else await addExpense(fd);

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

  const selectedCat = CATEGORIES_WITH_SUB.find(c => c.key === category) || CATEGORIES_WITH_SUB[0];
  const dateLabel = (() => {
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
              <LocalizedText style={MD.titleText}>{isEdit ? "EDIT EXPENSE LOG" : "LOG SYSTEM EXPENSE"}</LocalizedText>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ paddingHorizontal: 20 }}>

              <View style={{ marginTop: 20 }}>
                <LocalizedText translate style={MD.fieldLabel}>EXPENSE CATEGORY</LocalizedText>
                <TouchableOpacity style={MD.dropdown} onPress={() => setDropOpen(!dropOpen)} activeOpacity={0.8}>
                  <View style={[MD.dropIconBox, { backgroundColor: selectedCat.bg }]}>
                    <Ionicons name={selectedCat.icon} size={16} color={selectedCat.color} />
                  </View>
                  <LocalizedText style={MD.dropText}>{category}</LocalizedText>
                  <Ionicons name={dropOpen ? "chevron-up" : "chevron-down"} size={18} color={FL_DARK} />
                </TouchableOpacity>
                {dropOpen && (
                  <View style={MD.dropList}>
                    {CATEGORIES_WITH_SUB.map((cat) => (
                      <TouchableOpacity
                        key={cat.key}
                        style={[MD.dropItem, category === cat.key && { backgroundColor: cat.bg }]}
                        onPress={() => { setCategory(cat.key); setDropOpen(false); }}
                      >
                        <View style={[MD.dropItemIcon, { backgroundColor: cat.bg }]}>
                          <Ionicons name={cat.icon} size={16} color={cat.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <LocalizedText style={[MD.dropItemText, category === cat.key && { fontWeight: "700", color: FL_DARK }]}>{cat.key}</LocalizedText>
                          <LocalizedText style={MD.dropItemDesc}>{cat.desc}</LocalizedText>
                        </View>
                        {category === cat.key && <Ionicons name="checkmark-circle" size={18} color={FL_GREEN} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {category === "Procurement" && (
                <View style={{ marginTop: 16 }}>
                  <LocalizedText translate style={MD.fieldLabel}>SUB-CATEGORY</LocalizedText>
                  <TouchableOpacity style={MD.dropdown} onPress={() => setSubDropOpen(!subDropOpen)} activeOpacity={0.8}>
                    <LocalizedText style={MD.dropText}>{subCategory || "Select sub-category"}</LocalizedText>
                    <Ionicons name={subDropOpen ? "chevron-up" : "chevron-down"} size={18} color={FL_DARK} />
                  </TouchableOpacity>
                  {subDropOpen && (
                    <View style={MD.dropList}>
                      {SUB_CATEGORIES.map((sub) => (
                        <TouchableOpacity
                          key={sub}
                          style={[MD.dropItem, subCategory === sub && { backgroundColor: "#F5F3FF" }]}
                          onPress={() => { setSubCategory(sub); setSubDropOpen(false); }}
                        >
                          <LocalizedText style={[MD.dropItemText, subCategory === sub && { fontWeight: "700", color: FL_DARK }]}>{sub}</LocalizedText>
                          {subCategory === sub && <Ionicons name="checkmark-circle" size={18} color={FL_GREEN} />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              <View style={{ marginTop: 20 }}>
                <LocalizedText translate style={MD.fieldLabel}>TOTAL AMOUNT (INR)</LocalizedText>
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

              <View style={{ marginTop: 16 }}>
                <LocalizedText translate style={MD.fieldLabel}>AMOUNT PAID (INR)</LocalizedText>
                <TextInput
                  style={MD.amountInput}
                  value={amountPaid}
                  onChangeText={setAmountPaid}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                />
                <View style={MD.underline} />
              </View>

              {amount && parseFloat(amount) > 0 && (
                <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <LocalizedText translate style={MD.fieldLabel}>PAYMENT STATUS</LocalizedText>
                  <View style={{ 
                    backgroundColor: getPaymentStatusBg(paymentStatus),
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 12,
                  }}>
                    <LocalizedText style={{ 
                      fontSize: 12, 
                      fontWeight: "700", 
                      color: getPaymentStatusColor(paymentStatus)
                    }}>
                      {getPaymentStatusLabel(paymentStatus)}
                    </LocalizedText>
                  </View>
                </View>
              )}

              {amount && parseFloat(amount) > 0 && parseFloat(amountPaid) > 0 && (
                <View style={{ marginTop: 4, flexDirection: "row", justifyContent: "flex-end" }}>
                  <LocalizedText style={{ fontSize: 12, color: TEXT_MUTED }}>
                    {localizeText("Remaining", language)}: ₹{remainingAmount.toFixed(2)}
                  </LocalizedText>
                </View>
              )}

              <View style={{ marginTop: 16 }}>
                <LocalizedText translate style={MD.fieldLabel}>SUPPLIER / VENDOR</LocalizedText>
                <TextInput
                  style={MD.input}
                  value={supplier}
                  onChangeText={setSupplier}
                  placeholder={localizeText("e.g. Sharma Kirana, ABC Vegetables", language)}
                  placeholderTextColor="#94A3B8"
                />
                {showSupplierSuggestions && supplier.length > 0 && (
                  <View style={MD.suggestionsList}>
                    {supplierSuggestions.map((s, i) => (
                      <TouchableOpacity
                        key={i}
                        style={MD.suggestionItem}
                        onPress={() => { setSupplier(s); setShowSupplierSuggestions(false); }}
                      >
                        <Ionicons name="storefront-outline" size={14} color={FL_GREEN} />
                        <LocalizedText style={MD.suggestionText}>{s}</LocalizedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={{ marginTop: 12 }}>
                <LocalizedText translate style={MD.fieldLabel}>INVOICE NUMBER (OPTIONAL)</LocalizedText>
                <TextInput
                  style={MD.input}
                  value={invoiceNumber}
                  onChangeText={setInvoiceNumber}
                  placeholder={localizeText("e.g. INV-2024-001", language)}
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={{ marginTop: 16 }}>
                <LocalizedText translate style={MD.fieldLabel}>TRANSACTION MEMO / NOTE</LocalizedText>
                <TextInput
                  style={MD.noteInput}
                  value={note}
                  onChangeText={setNote}
                  placeholder={localizeText("Provide transaction contexts...", language)}
                  placeholderTextColor="#94A3B8"
                  multiline
                />
                <View style={MD.underline} />
              </View>

              <View style={MD.dateRow}>
                <View style={MD.dateIconBox}><Ionicons name="calendar" size={16} color={FL_DARK} /></View>
                <View style={{ flex: 1 }}>
                  <LocalizedText translate style={MD.datePre}>EXPENSE DATE</LocalizedText>
                  <TextInput
                    style={MD.dateInput}
                    value={date}
                    onChangeText={setDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                  />
                </View>
                <LocalizedText style={MD.dateLabelSmall}>{dateLabel}</LocalizedText>
              </View>

              <View style={[MD.dateRow, { borderTopWidth: 0 }]}>
                <View style={MD.dateIconBox}><Ionicons name="calendar-outline" size={16} color={FL_DARK} /></View>
                <View style={{ flex: 1 }}>
                  <LocalizedText translate style={MD.datePre}>PURCHASE DATE (OPTIONAL)</LocalizedText>
                  <TextInput
                    style={MD.dateInput}
                    value={purchaseDate}
                    onChangeText={setPurchaseDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={{ marginBottom: 24 }}>
                <LocalizedText translate style={MD.fieldLabel}>SUPPORTING INVOICE SLIP (OPTIONAL)</LocalizedText>
                {thumbUri ? (
                  <View style={{ borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: BORDER }}>
                    <Image source={{ uri: thumbUri }} style={{ width: "100%", height: 140 }} resizeMode="cover" />
                    <TouchableOpacity onPress={() => openPreview(thumbUri)} style={MD.imgOverlayLeft}>
                      <Ionicons name="eye-outline" size={12} color="#fff" />
                      <LocalizedText translate style={MD.imgOverlayText}>Inspect</LocalizedText>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={pickReceipt} style={MD.imgOverlayRight}>
                      <Ionicons name="camera" size={12} color="#fff" />
                      <LocalizedText translate style={MD.imgOverlayText}>Replace</LocalizedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={MD.imgRemoveBtn} onPress={() => { setReceipt(null); setSavedReceiptUrl(null); }}>
                      <Ionicons name="close-circle" size={24} color={FL_RED} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={MD.receiptBtn} onPress={pickReceipt} activeOpacity={0.8}>
                    <View style={MD.receiptIconBox}><Ionicons name="camera" size={18} color="#fff" /></View>
                    <View style={{ flex: 1 }}>
                      <LocalizedText translate style={MD.receiptTitle}>ATTACH INVOICE RECEIPT</LocalizedText>
                      <LocalizedText translate style={MD.receiptSub}>Click to deploy visual validation file</LocalizedText>
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              <View style={MD.actionRow}>
                <TouchableOpacity style={MD.cancelBtn} onPress={handleClose}>
                  <LocalizedText translate style={MD.cancelText}>Dismiss</LocalizedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[MD.confirmBtn, (!amount || saving) && { opacity: 0.5 }]}
                  onPress={handleSave}
                  disabled={!amount || saving}
                >
                  {saving ? <ActivityIndicator color="#fff" /> : <LocalizedText style={MD.confirmText}>{isEdit ? "Update" : "Confirm Entry"}</LocalizedText>}
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
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 4 },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusText:  { fontSize: 10, fontWeight: "600" },
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
  input:        { fontSize: 14, fontWeight: "500", color: FL_DARK, paddingVertical: 8, paddingHorizontal: 0 },

  dateRow:       { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14, marginBottom: 18, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#F1F5F9", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  dateIconBox:   { width: 26, height: 26, borderRadius: 6, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  datePre:       { fontSize: 10, fontWeight: "600", color: TEXT_MUTED },
  dateInput:     { fontSize: 14, fontWeight: "700", color: FL_DARK, padding: 0 },
  dateLabelSmall:{ fontSize: 12, color: TEXT_MUTED, fontWeight: "500" },

  suggestionsList: { marginTop: 4, borderWidth: 1, borderColor: FL_BORD, borderRadius: 8, backgroundColor: "#fff", overflow: "hidden" },
  suggestionItem:  { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  suggestionText:  { fontSize: 13, fontWeight: "500", color: FL_DARK },

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