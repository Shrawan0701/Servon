import React, { useState, useCallback, useEffect } from "react";

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
  useWindowDimensions,
} from "react-native";
import { useFocusEffect, useNavigation, useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import {
  getAnalytics,
  getOrders,
  getNotifications,
  updateOrderStatus,
  getSubscriptionDetails,
  markAllNotificationsRead,
  getDailySummary,
  deleteConversation,
  clearAllConversations,
  getTrialStatus,
  getTrialNotifications,
  markTrialNotificationRead,
  getInventoryAlertsCount,
  getBusinessSummary,
  generateBusinessSummary,
  getBusinessAlerts,
  markAlertRead,
  markAllAlertsRead,
} from "../api";
import API from "../api";
import SubscriptionBanner from "../components/SubscriptionBanner";
import io from "socket.io-client";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import ReactDOM from "react-dom";

const isWeb = Platform.OS === "web";

// ─── Web-only CSS ──────────────────────────────────────────────────────────────
if (isWeb && typeof document !== "undefined") {
  if (!document.getElementById("servon-font")) {
    const link = document.createElement("link");
    link.id = "servon-font";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap";
    document.head.appendChild(link);
  }
  {
    let style = document.getElementById("servon-web-css");
    if (!style) {
      style = document.createElement("style");
      style.id = "servon-web-css";
      document.head.appendChild(style);
    }
    style.textContent = `
      * { box-sizing: border-box; }
      body { font-family: 'DM Sans', sans-serif !important; background: #F5F3EF !important; }
      
      .servon-stat-card {
        background: #fff; border: 1px solid #EAE6E0; border-radius: 16px;
        padding: 20px 22px; display: flex; flex-direction: column; gap: 14px;
        transition: box-shadow 0.18s ease, transform 0.18s ease;
        position: relative; overflow: hidden;
      }
      .servon-stat-card::before {
        content: ''; position: absolute; top: 0; left: 0; right: 0;
        height: 3px; border-radius: 16px 16px 0 0;
        opacity: 0; transition: opacity 0.18s ease;
      }
      .servon-stat-card:hover { box-shadow: 0 8px 28px rgba(0,0,0,0.08); transform: translateY(-2px); }
      .servon-stat-card:hover::before { opacity: 1; }
      .servon-stat-card.accent-blue::before { background: #3B82F6; }
      .servon-stat-card.accent-green::before { background: #10B981; }
      .servon-stat-card.accent-amber::before { background: #F59E0B; }
      .servon-stat-card.accent-red::before { background: #EF4444; }
      
      .servon-stat-icon {
        width: 42px; height: 42px; border-radius: 12px;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .servon-stat-value {
        font-family: 'DM Sans', sans-serif;
        font-size: 28px; font-weight: 700; color: #111827;
        line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .servon-stat-label {
        font-size: 12px; font-weight: 500; color: #9CA3AF;
        letter-spacing: 0.04em; text-transform: uppercase; margin-top: 4px;
      }
      
      /* Fluid grid: cards keep a sensible minimum width and wrap naturally
         at any viewport size, instead of relying only on fixed breakpoints. */
      .servon-stats-grid {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 14px; padding: 0 24px; margin-bottom: 28px;
      }
     @media (max-width: 500px) { .servon-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 0 16px; } }
      
      .servon-order-card {
        background: #fff; border: 1px solid #EAE6E0; border-radius: 16px;
        padding: 18px 20px; margin-bottom: 14px;
        transition: box-shadow 0.18s ease; position: relative; overflow: hidden;
      }
      .servon-order-card:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.07); }
      
      .servon-web-header {
        background: rgba(255,255,255,0.85); backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-bottom: 1px solid #EAE6E0; position: sticky; top: 0; z-index: 100;
      }
      
      .servon-notif-panel {
        position: fixed; top: 0; right: 0; bottom: 0; height: 100vh;
        width: 380px; background: #fff; border-left: 1px solid #EAE6E0;
        z-index: 200; display: flex; flex-direction: column; overflow: hidden;
        animation: slideIn 0.22s ease;
      }
      @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      
      .servon-notif-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.25);
        z-index: 199; backdrop-filter: blur(2px); animation: fadeIn 0.2s ease;
      }
      @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }

      /* ── Notification panel: modern, day-grouped cards ── */
      .servon-notif-day-header {
        position: sticky; top: 0; z-index: 2;
        background: #fff; padding: 12px 0 8px;
        font-size: 11px; font-weight: 700; color: #9CA3AF;
        text-transform: uppercase; letter-spacing: 0.07em;
      }
      .servon-notif-item {
        display: flex; gap: 12px; padding: 13px 14px;
        border-radius: 14px; margin-bottom: 8px;
        border: 1px solid #EAE6E0; background: #fff;
        transition: box-shadow 0.15s ease, transform 0.15s ease, border-color 0.15s ease;
      }
      .servon-notif-item.unread {
        background: linear-gradient(135deg, #F0FDF4 0%, #FBFFFC 100%);
        border-color: #BBF7D0;
      }
      .servon-notif-item:hover {
        box-shadow: 0 6px 18px rgba(0,0,0,0.07);
        transform: translateY(-1px);
      }
      .servon-notif-icon {
        width: 38px; height: 38px; border-radius: 11px; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        background: #EFF6FF;
      }
      .servon-notif-item.unread .servon-notif-icon { background: #DCFCE7; }
      .servon-notif-body { flex: 1; min-width: 0; }
      .servon-notif-top-row {
        display: flex; align-items: center; justify-content: space-between;
        gap: 8px; margin-bottom: 3px;
      }
      .servon-notif-title-text {
        font-size: 14px; font-weight: 700; color: #111827;
        display: flex; align-items: center; gap: 6px; min-width: 0;
      }
      .servon-notif-time-text { font-size: 11px; color: #9CA3AF; font-weight: 500; white-space: nowrap; flex-shrink: 0; }
      .servon-notif-msg-text { font-size: 13px; color: #6B7280; line-height: 1.5; }
      .servon-notif-unread-dot { width: 7px; height: 7px; border-radius: 50%; background: #22C55E; flex-shrink: 0; }
      .servon-notif-empty {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: 60px 20px; color: #9CA3AF; gap: 8px; text-align: center;
      }
      .servon-notif-load-more {
        width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px;
        background: #F9F8F6; border: 1px dashed #D1C9BC; border-radius: 12px;
        padding: 12px; font-size: 13px; font-weight: 600; color: #374151;
        cursor: pointer; margin: 4px 0 10px; transition: background 0.15s ease;
      }
      .servon-notif-load-more:hover { background: #F3F1EC; }
      
      .servon-empty {
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        padding: 60px 20px; border: 1.5px dashed #D1C9BC;
        border-radius: 16px; background: #FAFAF8; color: #9CA3AF; gap: 10px;
      }
      
      .servon-section-head {
        display: flex; align-items: center; gap: 10px; margin-bottom: 14px;
      }
      .servon-section-title { font-size: 17px; font-weight: 700; color: #111827; }
      .servon-count-pill {
        background: #111827; color: #fff;
        font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px;
      }
      
      .servon-live-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: #10B981; display: inline-block; margin-right: 6px;
        animation: pulse 1.8s infinite;
      }
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
        70% { box-shadow: 0 0 0 7px rgba(16,185,129,0); }
        100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
      }
      
      ::-webkit-scrollbar { width: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #D1C9BC; border-radius: 3px; }
      
      .servon-summary-overlay, .servon-insight-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center;
        z-index: 300; backdrop-filter: blur(4px); animation: fadeIn 0.25s ease;
      }
      .servon-summary-modal {
        background: #fff; border-radius: 24px; padding: 32px;
        max-width: 480px; width: 90%; max-height: 80vh; overflow-y: auto;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
        animation: slideUp 0.3s ease;
      }
      .servon-insight-modal {
        background: #fff; border-radius: 24px; padding: 20px 18px;
        max-width: 340px; width: 85%;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
        animation: slideUp 0.3s ease; text-align: center;
      }
      @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      
      .servon-insight-header, .servon-summary-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 8px;
      }
      .servon-summary-title { font-size: 22px; font-weight: 800; color: #111827; letter-spacing: -0.3px; }
      .servon-insight-title { font-size: 16px; font-weight: 700; color: #111827; }
      
      .servon-summary-text {
        font-size: 15px; color: #374151; line-height: 1.7;
        margin-bottom: 24px; background: #F9FAFB; padding: 16px;
        border-radius: 12px; border: 1px solid #F3F4F6;
      }
      .servon-insight-text {
        font-size: 17px; color: #1F2937; margin-bottom: 24px;
        line-height: 1.6; font-weight: 500;
      }
      
      .servon-summary-stats {
        display: flex; justify-content: space-around;
        border-top: 1px solid #E5E7EB; padding-top: 20px; margin-bottom: 24px;
      }
      .servon-summary-stat { text-align: center; }
      .servon-summary-stat-value { font-size: 22px; font-weight: 800; color: #111827; }
      .servon-summary-stat-label {
        font-size: 12px; color: #6B7280; margin-top: 4px;
        font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em;
      }
      
      .servon-summary-btn, .servon-insight-btn {
        background: #111827; color: #fff; border: none; border-radius: 12px;
        padding: 14px; width: 100%; font-size: 16px; font-weight: 700;
        cursor: pointer; transition: background 0.15s;
      }
      .servon-insight-btn { padding: 12px 32px; font-size: 15px; }
      .servon-summary-btn:hover, .servon-insight-btn:hover { background: #1F2937; }
      
      .servon-insight-icon-wrapper {
        width: 48px; height: 48px; border-radius: 50%;
        background: #F3F4F6; display: flex; align-items: center; justify-content: center;
        margin: 0 auto 16px;
      }
      .servon-insight-footer {
        display: flex; align-items: center; justify-content: center;
        gap: 6px; font-size: 13px; color: #9CA3AF; margin-top: 14px;
      }

      /* ── In-app trial/subscription toast (replaces browser alert) ── */
      .servon-trial-toast {
        position: fixed; top: 78px; left: 50%; transform: translateX(-50%);
        z-index: 500; max-width: 420px; width: calc(100% - 32px);
        background: #111827; color: #fff; border-radius: 14px;
        padding: 12px 14px; display: flex; align-items: center; gap: 10px;
        box-shadow: 0 12px 32px rgba(0,0,0,0.22);
        animation: servonToastIn 0.25s ease;
      }
      @keyframes servonToastIn {
        from { transform: translate(-50%, -14px); opacity: 0; }
        to { transform: translate(-50%, 0); opacity: 1; }
      }
      .servon-trial-toast-icon {
        width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
        background: rgba(255,255,255,0.14);
        display: flex; align-items: center; justify-content: center;
      }
      .servon-trial-toast-text { flex: 1; font-size: 13px; line-height: 1.4; min-width: 0; }
      .servon-trial-toast-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
      .servon-trial-toast-btn {
        background: #fff; color: #111827; border: none; border-radius: 8px;
        padding: 6px 12px; font-size: 12px; font-weight: 700;
        cursor: pointer; white-space: nowrap;
      }
      .servon-trial-toast-close {
        background: transparent; border: none; color: rgba(255,255,255,0.65);
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        padding: 4px; flex-shrink: 0;
      }
      @media (max-width: 500px) {
        .servon-trial-toast { top: 70px; width: calc(100% - 20px); padding: 10px 12px; }
        .servon-trial-toast-text { font-size: 12.5px; }
      }
    `;
  }
}

// ─── INSIGHT ICON HELPERS ──────────────────────────────────────────────────────
const getInsightIcon = (type, native = false) => {
  const size = native ? 28 : 32;
  const icons = {
    orders: <Ionicons name="cube-outline" size={size} color="#3B82F6" />,
    revenue: <Ionicons name="wallet-outline" size={size} color="#10B981" />,
    top_item: <Ionicons name="restaurant-outline" size={size} color="#F59E0B" />,
    peak_hour: <Ionicons name="time-outline" size={size} color="#8B5CF6" />,
    avg_order: <Ionicons name="trending-up-outline" size={size} color="#EC4899" />,
    recommendation: <Ionicons name="bulb-outline" size={size} color="#F59E0B" />,
  };
  return icons[type] || icons.orders;
};

// ─── NOTIFICATION HELPERS (grouping by day + icon per type) ────────────────────
const isSameCalendarDay = (a, b) =>
  a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

const getNotifDayLabel = (dateStr) => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameCalendarDay(date, today)) return "Today";
  if (isSameCalendarDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
};

const groupNotificationsByDay = (list) => {
  const groups = [];
  const index = {};
  (list || []).forEach((n) => {
    const label = getNotifDayLabel(n.created_at);
    if (!index[label]) {
      index[label] = { label, items: [] };
      groups.push(index[label]);
    }
    index[label].items.push(n);
  });
  return groups;
};

// Splits day-groups into "recent" (Today/Yesterday, always shown) and "older"
// (everything else, hidden behind a Load More button until expanded).
const splitNotificationGroups = (groups) => {
  const recent = groups.filter((g) => g.label === "Today" || g.label === "Yesterday");
  const older = groups.filter((g) => g.label !== "Today" && g.label !== "Yesterday");
  return { recent, older };
};

const getNotifIcon = (title = "", native = false) => {
  const size = native ? 18 : 16;
  const t = (title || "").toLowerCase();
  if (t.includes("order")) return <Ionicons name="receipt-outline" size={size} color="#3B82F6" />;
  if (t.includes("payment") || t.includes("paid")) return <Ionicons name="card-outline" size={size} color="#10B981" />;
  if (t.includes("table")) return <Ionicons name="grid-outline" size={size} color="#F59E0B" />;
  return <Ionicons name="notifications-outline" size={size} color="#3B82F6" />;
};

// ─── AI ALERT ICON HELPERS (severity-based) ───────────────────────────────────
const getAlertIcon = (severity = "info", native = false) => {
  const size = native ? 18 : 16;
  if (severity === "critical") return <Ionicons name="alert-circle" size={size} color="#EF4444" />;
  if (severity === "warning") return <Ionicons name="warning-outline" size={size} color="#F59E0B" />;
  return <Ionicons name="information-circle-outline" size={size} color="#3B82F6" />;
};

const getAlertSeverityColor = (severity = "info") => {
  if (severity === "critical") return "#EF4444";
  if (severity === "warning") return "#F59E0B";
  return "#3B82F6";
};

const getAlertSeverityBg = (severity = "info") => {
  if (severity === "critical") return "#FEF2F2";
  if (severity === "warning") return "#FFFBEB";
  return "#EFF6FF";
};

// ─── TRIAL TOAST FREQUENCY CONTROL ──────────────────────────────────────────
// Limits the trial/subscription popup to a MAX of 3 times per day, with at
// least a 3 hour gap between each showing. Persisted so the limit survives
// re-focusing the Dashboard tab (web: localStorage, native: in-memory for
// the current app session).
const TRIAL_TOAST_STORAGE_KEY = "servon_trial_toast_meta";
const TRIAL_TOAST_MAX_PER_DAY = 3;
const TRIAL_TOAST_MIN_GAP_HOURS = 3;

const getTrialToastMeta = () => {
  try {
    if (isWeb && typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(TRIAL_TOAST_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    }
  } catch (err) { /* ignore storage errors */ }
  return global.__servonTrialToastMeta || null;
};

const setTrialToastMeta = (meta) => {
  try {
    if (isWeb && typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(TRIAL_TOAST_STORAGE_KEY, JSON.stringify(meta));
      return;
    }
  } catch (err) { /* ignore storage errors */ }
  global.__servonTrialToastMeta = meta;
};

const canShowTrialToast = () => {
  const meta = getTrialToastMeta();
  const todayKey = new Date().toDateString();
  if (!meta || meta.day !== todayKey) return true; // fresh day, allowed
  if (meta.count >= TRIAL_TOAST_MAX_PER_DAY) return false;
  const hoursSinceLast = (Date.now() - meta.lastShown) / (1000 * 60 * 60);
  return hoursSinceLast >= TRIAL_TOAST_MIN_GAP_HOURS;
};

const recordTrialToastShown = () => {
  const todayKey = new Date().toDateString();
  const meta = getTrialToastMeta();
  if (!meta || meta.day !== todayKey) {
    setTrialToastMeta({ day: todayKey, count: 1, lastShown: Date.now() });
  } else {
    setTrialToastMeta({ day: todayKey, count: meta.count + 1, lastShown: Date.now() });
  }
};

export default function DashboardScreen() {
  const { business, updateBusiness, isChefMode } = useAuth();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [analytics, setAnalytics] = useState(null);
  const [liveOrders, setLiveOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showOlderNotifications, setShowOlderNotifications] = useState(false);
  const [dailySummary, setDailySummary] = useState(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [nextInsight, setNextInsight] = useState(null);
  const [showInsightModal, setShowInsightModal] = useState(false);
  const [seenInsights, setSeenInsights] = useState(new Set());

  // ===== TRIAL STATE =====
  const [trialStatus, setTrialStatus] = useState(null);
  const [trialNotifications, setTrialNotifications] = useState([]);
  const [trialUnreadCount, setTrialUnreadCount] = useState(0);
  const [trialLoading, setTrialLoading] = useState(true);

  // ===== IN-APP TRIAL/SUBSCRIPTION TOAST (replaces console-style browser alert) =====
  const [trialToast, setTrialToast] = useState(null); // { message } | null

  // ===== INVENTORY LOW-STOCK BADGE =====
  const [lowStockCount, setLowStockCount] = useState(0);

  // ===== AI BUSINESS SUMMARY + ALERTS =====
  const [businessSummary, setBusinessSummary] = useState(null);
  const [showBusinessSummaryModal, setShowBusinessSummaryModal] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [aiAlerts, setAiAlerts] = useState([]);
  const [alertUnreadCount, setAlertUnreadCount] = useState(0);
  const [alertToast, setAlertToast] = useState(null); // { title, message, severity } | null

  // ─── WHITE-LABEL BRAND NAME ─────────────────────────────────────────
  // Uses the restaurant's own business_name (captured at signup) instead
  // of the hardcoded "Servon" platform name. Falls back to "Servon" only
  // if the business hasn't set a name yet (e.g. still loading / legacy
  // account with no business_name saved).
  const businessName = business?.business_name || business?.businessName || "Servon";

  // ─── RESPONSIVE HELPERS (app + web) ────────────────────────────────
  // Wider screens (tablet / desktop-sized RN window) get more breathing
  // room and let the stat cards sit 4-across instead of always 2-across.
  const isTabletWidth = screenWidth >= 700;
  const isWideWidth = screenWidth >= 1000;
  const responsiveMaxWidth = isWideWidth ? 960 : isTabletWidth ? 760 : 600;
  const statCardMinWidth = isTabletWidth ? '23%' : '46%';

  const isToday = (date) => {
    const today = new Date();
    const d = new Date(date);
    return d.getDate() === today.getDate() && 
           d.getMonth() === today.getMonth() && 
           d.getFullYear() === today.getFullYear();
  };

  const fetchNextInsight = async (silent = false) => {
    try {
      const res = await API.get("/analytics/next-insight");
      const insightId = res.data.id || res.data.insight;
      
      if (!res.data.hasNext || seenInsights.has(insightId)) return;
      
      setNextInsight(res.data);
      if (!silent) setShowInsightModal(true);
    } catch (err) {
      console.error("Failed to fetch insight:", err);
    }
  };

  const handleInsightDismiss = () => {
    if (nextInsight) {
      const insightId = nextInsight.id || nextInsight.insight;
      setSeenInsights(prev => new Set([...prev, insightId]));
    }
    setShowInsightModal(false);
  };

  const checkAndShowWarning = (endDateStr, status) => {
  try {
    if (!endDateStr) return;
    const endDate = new Date(endDateStr);
    if (isNaN(endDate.getTime())) return;

    const daysLeft = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));

    // Show warning if trial or subscription expires in 3 days or less
    if (daysLeft <= 3 && status !== 'active' && status !== 'ACTIVE') {
      // Only show up to TRIAL_TOAST_MAX_PER_DAY times/day, at least
      // TRIAL_TOAST_MIN_GAP_HOURS apart.
      if (!canShowTrialToast()) return;

      const msg = daysLeft <= 0 
        ? "Your free trial has expired!" 
        : `Your trial expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}.`;

      // In-app popup (works identically on web + native) instead of
      // window.alert / Alert.alert, which looked like a browser/console dialog.
      setTrialToast({ message: msg });
      recordTrialToastShown();
    }
  } catch (err) { 
    console.log("Warning popup error:", err); 
  }
};

const loadData = async () => {
  try {
    const [analyticsRes, ordersRes, notifRes, subRes] = await Promise.all([
      getAnalytics(), getOrders(), getNotifications(), getSubscriptionDetails()
    ]);

    setAnalytics(analyticsRes.data);
    // In DashboardScreen.js inside loadData():
setLiveOrders(ordersRes.data.filter(o => 
  isToday(o.created_at) && !["PAID", "REJECTED", "SERVED"].includes(o.status)
));
    setNotifications(notifRes.data);

    // Update business state from subscription endpoint
    if (subRes?.data) {
      const subData = subRes.data;
      const endDate = subData.subscription_end_date || subData.trialEnd || subData.trial_end_date;
      const status = subData.subscription_status || subData.status;

      updateBusiness({
        subscription_status: status,
        subscription_end_date: endDate
      });
      
      checkAndShowWarning(endDate, status);
    }

    // Fetch daily summary
    try {
      const summaryRes = await getDailySummary();
      if (summaryRes?.data?.hasSummary && summaryRes.data.is_new) {
        setDailySummary(summaryRes.data);
        setShowSummaryModal(true);
      }
    } catch (err) { 
      console.error('Summary fetch error:', err); 
    }

    await fetchNextInsight(true);

    // ===== FETCH TRIAL DATA =====
    try {
      const trialStatusRes = await getTrialStatus();
      
      // Unwrap response if wrapped in success object or direct
      const trialData = trialStatusRes?.data || trialStatusRes;
      if (trialData) {
        setTrialStatus(trialData);
        
        // Secondary check using direct trial endpoint date key (trialEnd)
        const trialEndDate = trialData.trialEnd || trialData.trial_end_date;
        if (trialEndDate) {
          checkAndShowWarning(trialEndDate, trialData.status);
        }
      }

      const trialNotifRes = await getTrialNotifications();
      const notifData = trialNotifRes?.data || trialNotifRes;
      if (notifData) {
        setTrialNotifications(notifData.notifications || []);
        setTrialUnreadCount(notifData.unreadCount || 0);
      }
    } catch (trialErr) {
      console.error('Error fetching trial data:', trialErr);
    }
    setTrialLoading(false);

    // ===== FETCH INVENTORY LOW-STOCK COUNT =====
    try {
      const alertRes = await getInventoryAlertsCount();
      setLowStockCount(alertRes?.data?.count || 0);
    } catch (invErr) {
      console.error("Inventory alert fetch error:", invErr);
    }

    // ===== FETCH AI BUSINESS SUMMARY =====
    try {
      const summaryRes = await getBusinessSummary();
      if (summaryRes?.data?.hasSummary) {
        setBusinessSummary(summaryRes.data);
        if (summaryRes.data.is_new) {
          setShowBusinessSummaryModal(true);
        }
      }
    } catch (summaryErr) {
      console.error("Business summary fetch error:", summaryErr);
    }

    // ===== FETCH AI ALERTS =====
    try {
      const alertsRes = await getBusinessAlerts();
      const alertsData = alertsRes?.data || {};
      setAiAlerts(alertsData.alerts || []);
      setAlertUnreadCount(alertsData.unreadCount || 0);
    } catch (alertsErr) {
      console.error("Business alerts fetch error:", alertsErr);
    }

  } catch (err) {
    console.error("Dashboard load error:", err);
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

  const handleGenerateSummary = async () => {
    setGeneratingSummary(true);
    try {
      const res = await generateBusinessSummary();
      if (res?.data) {
        setBusinessSummary(res.data);
        setShowBusinessSummaryModal(true);
      }
    } catch (err) {
      console.error("Generate business summary error:", err);
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleOpenAlert = async (alert) => {
    if (!alert.is_read) {
      try {
        await markAlertRead(alert.id);
        setAiAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, is_read: true } : a));
        setAlertUnreadCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.error("Mark alert read error:", err);
      }
    }
  };

  const handleStatusUpdate = async (orderId, status) => {
    try {
      await updateOrderStatus(orderId, status);
      if (["SERVED", "REJECTED"].includes(status)) {
        setLiveOrders(prev => prev.filter(o => o.id !== orderId));
      } else {
        setLiveOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      }
    } catch (err) {
      console.error("Status update error:", err);
    }
  };

  const handleOpenNotifications = async () => {
    setShowNotifications(true);
    setShowOlderNotifications(false);
    if (unreadCount > 0) {
      try {
        await markAllNotificationsRead();
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      } catch (err) {
        console.error("Failed to mark notifications as read", err);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
      const socket = io(process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000", {
        transports: ["websocket"],
      });
      socket.on("connect", () => business?.id && socket.emit("join_business", business.id));
      socket.on("new_order", ({ order, notification, tableNumber }) => {
        if (isToday(order.created_at)) setLiveOrders(prev => [{ ...order, table_number: tableNumber }, ...prev]);
        // Some backend events omit the `notification` payload (or send it
        // in a slightly different shape). Build a safe local fallback so
        // the bell/badge reflects new orders immediately instead of
        // silently getting dropped until the next manual refresh.
        const finalNotification = notification && notification.id
          ? notification
          : {
              id: `local-order-${order?.id || Date.now()}`,
              title: "New Order",
              message: `Table ${tableNumber || order?.table_number || "?"} placed a new order`,
              is_read: false,
              created_at: new Date().toISOString(),
            };
        setNotifications(prev => [finalNotification, ...prev]);
      });
      socket.on("order_updated", (updatedOrder) => {
        setLiveOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
      });
      socket.on("new_summary", (summaryRow) => {
        setBusinessSummary(summaryRow);
        setShowBusinessSummaryModal(true);
      });
      socket.on("new_alert", (alertRow) => {
        setAiAlerts(prev => [alertRow, ...prev]);
        setAlertUnreadCount(prev => prev + 1);
        setAlertToast({ title: alertRow.title, message: alertRow.message, severity: alertRow.severity });
      });
      socket.on("new_notification", (notificationRow) => {
        setNotifications(prev => [notificationRow, ...prev]);
      });
      return () => socket.disconnect();
    }, [business?.id])
  );

  // ─── HOURLY INSIGHT TIMER ──────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    const interval = setInterval(() => {
      if (!showInsightModal) fetchNextInsight(false);
    }, 3600000); // 10 sec for testing, change to 3600000 for production
    return () => clearInterval(interval);
  }, [loading, showInsightModal]);

  // ─── LOCK BACKGROUND SCROLL WHILE NOTIFICATIONS PANEL IS OPEN (web) ────
  useEffect(() => {
    if (isWeb && typeof document !== "undefined") {
      document.body.style.overflow = showNotifications ? "hidden" : "";
    }
    return () => {
      if (isWeb && typeof document !== "undefined") {
        document.body.style.overflow = "";
      }
    };
  }, [showNotifications]);

  // ─── AUTO-DISMISS TRIAL/SUBSCRIPTION TOAST ─────────────────────────
  useEffect(() => {
    if (!trialToast) return;
    const t = setTimeout(() => setTrialToast(null), 6000);
    return () => clearTimeout(t);
  }, [trialToast]);

  // ─── AUTO-DISMISS AI ALERT TOAST ──────────────────────────────────
  useEffect(() => {
    if (!alertToast) return;
    const t = setTimeout(() => setAlertToast(null), 6000);
    return () => clearTimeout(t);
  }, [alertToast]);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const totalUnread = unreadCount + trialUnreadCount + alertUnreadCount;
  const ownerInitial = business?.owner_name ? business.owner_name.charAt(0).toUpperCase() : "S";
  const activeTableCount = new Set(liveOrders.map(o => o.table_number)).size;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111" />
      </View>
    );
  }

  // ─── WEB RENDER ─────────────────────────────────────────────────────────────
  if (isWeb) {
    const todayStr = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

    return (
      <div style={{ minHeight: "100vh", background: "#F5F3EF", fontFamily: "'DM Sans', sans-serif", overflowY: "auto" }}>
        {/* HEADER */}
        <div className="servon-web-header">
          <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 28px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#111827", letterSpacing: "-0.5px" }}>
              {businessName}<span style={{ color: "#22C55E" }}>.</span>
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={handleOpenNotifications} style={{
                position: "relative", background: totalUnread > 0 ? "#F0FDF4" : "#F9F8F6",
                border: `1px solid ${totalUnread > 0 ? "#BBF7D0" : "#EAE6E0"}`,
                borderRadius: 10, width: 38, height: 38,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer"
              }}>
                <Ionicons name="notifications-outline" size={18} color={totalUnread > 0 ? "#16A34A" : "#374151"} />
                {totalUnread > 0 && (
                  <span style={{
                    position: "absolute", top: -4, right: -4,
                    background: "#EF4444", color: "#fff",
                    fontSize: 9, fontWeight: 700,
                    width: 16, height: 16, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: "2px solid #F5F3EF"
                  }}>
                    {totalUnread > 9 ? "9+" : totalUnread}
                  </span>
                )}
              </button>
              <button onClick={() => navigation.navigate("Profile")} style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "#111827", color: "#fff",
                fontSize: 14, fontWeight: 600,
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {ownerInitial}
              </button>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "32px 28px 60px" }}>
          <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#111827", letterSpacing: "-0.4px" }}>
                Good {getGreeting()} 👋
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9CA3AF" }}>{todayStr}</p>
            </div>
            <button onClick={() => { setRefreshing(true); loadData(); }} style={{
              background: "#fff", border: "1px solid #EAE6E0", borderRadius: 10,
              padding: "8px 16px", fontSize: 13, fontWeight: 500, color: "#374151",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6
            }}>
              <Ionicons name="refresh-outline" size={14} color="#374151" />
              Refresh
            </button>
          </div>

          <SubscriptionBanner />

          <div className="servon-stats-grid" style={{ marginTop: 10 }}>
            <WebStatCard label="Orders Today" value={analytics?.today?.totalOrders ?? 0} icon="cube" color="#3B82F6" bg="#EFF6FF" accent="blue" />
            {!isChefMode && <WebStatCard label="Revenue Today" value={`₹${(analytics?.today?.totalRevenue ?? 0).toFixed(0)}`} icon="wallet" color="#10B981" bg="#ECFDF5" accent="green" />}
            <WebStatCard label="Active Tables" value={activeTableCount} icon="grid" color="#F59E0B" bg="#FFFBEB" accent="amber" />
            <WebStatCard label="Top Item" value={analytics?.today?.mostOrderedItem?.name || "-"} icon="flame" color="#EF4444" bg="#FEF2F2" accent="red" isText />
          </div>

          {!isChefMode && (
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <TouchableOpacity style={styles.advisorBtn} onPress={() => navigation.navigate("Advisor")}>
                <Ionicons name="sparkles-outline" size={20} color="#fff" />
                <Text style={styles.advisorBtnText}>AI Business Advisor</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.advisorBtn, { backgroundColor: "#111827" }]}
                onPress={handleGenerateSummary}
                disabled={generatingSummary}
              >
                {generatingSummary ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="analytics-outline" size={20} color="#fff" />
                )}
                <Text style={styles.advisorBtnText}>Generate Summary</Text>
              </TouchableOpacity>
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            <div className="servon-section-head">
              <span className="servon-live-dot" />
              <span className="servon-section-title">Live Orders</span>
              <span className="servon-count-pill">{liveOrders.length}</span>
            </div>

            {liveOrders.length === 0 ? (
              <div className="servon-empty">
                <Ionicons name="restaurant-outline" size={36} color="#C4BAB0" />
                <span style={{ fontSize: 15, fontWeight: 600, color: "#6B7280" }}>No active orders right now</span>
                <span style={{ fontSize: 13, color: "#B3ACA4" }}>Waiting for customers to scan QR</span>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: screenWidth > 900 ? "repeat(2, 1fr)" : "1fr", gap: 14 }}>
                {liveOrders.map(order => <WebOrderCard key={order.id} order={order} onStatusUpdate={handleStatusUpdate} />)}
              </div>
            )}
          </div>
        </div>

        {/* NOTIFICATION PANEL — rendered via portal straight into <body> so it's never
            clipped by a transformed/animated ancestor (e.g. navigation screen wrapper) */}
        {showNotifications && typeof document !== "undefined" && ReactDOM.createPortal(
          <>
            <div className="servon-notif-overlay" onClick={() => setShowNotifications(false)} />
            <div className="servon-notif-panel">
              <div style={{ flexShrink: 0, padding: "20px 24px 16px", borderBottom: "1px solid #EAE6E0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#111827" }}>Notifications</p>
                  {totalUnread > 0 && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9CA3AF" }}>{totalUnread} unread</p>}
                </div>
                <button onClick={() => setShowNotifications(false)} style={{
                  background: "#F3F4F6", border: "none", borderRadius: 8,
                  width: 32, height: 32, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <Ionicons name="close" size={16} color="#374151" />
                </button>
              </div>
              <div style={{ flex: 1, height: 0, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", padding: "4px 24px 24px" }}>
                {notifications.length === 0 && trialNotifications.length === 0 ? (
                  <div className="servon-notif-empty">
                    <Ionicons name="notifications-off-outline" size={32} color="#C4BAB0" />
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#6B7280" }}>No notifications yet</span>
                    <span style={{ fontSize: 12, color: "#B3ACA4" }}>You'll see updates here as they come in</span>
                  </div>
                ) : (
                  <>
                    {notifications.length > 0 && (() => {
                      const { recent, older } = splitNotificationGroups(groupNotificationsByDay(notifications));
                      const renderGroup = (group) => (
                        <div key={group.label}>
                          <div className="servon-notif-day-header">{group.label}</div>
                          {group.items.map((n, index) => (
                            <div key={n.id || index} className={`servon-notif-item${!n.is_read ? " unread" : ""}`}>
                              <div className="servon-notif-icon">
                                {getNotifIcon(n.title)}
                              </div>
                              <div className="servon-notif-body">
                                <div className="servon-notif-top-row">
                                  <span className="servon-notif-title-text">
                                    {!n.is_read && <span className="servon-notif-unread-dot" />}
                                    {n.title || "New Order"}
                                  </span>
                                  <span className="servon-notif-time-text">
                                    {new Date(n.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                                <p className="servon-notif-msg-text" style={{ margin: 0 }}>{n.message}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                      return (
                        <>
                          {recent.map(renderGroup)}
                          {older.length > 0 && (
                            showOlderNotifications ? (
                              older.map(renderGroup)
                            ) : (
                              <button className="servon-notif-load-more" onClick={() => setShowOlderNotifications(true)}>
                                <Ionicons name="chevron-down-outline" size={14} color="#374151" />
                                Load older notifications
                              </button>
                            )
                          )}
                        </>
                      );
                    })()}

                    {/* Trial Reminders */}
                    {trialNotifications.length > 0 && (
                      <div>
                        <div className="servon-notif-day-header">Trial Reminders</div>
                        {trialNotifications.map((n) => (
                          <div key={`trial-${n.id}`} className="servon-notif-item" style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}>
                            <div className="servon-notif-icon" style={{ background: "#DBEAFE" }}>
                              <Ionicons name="time-outline" size={16} color="#3B82F6" />
                            </div>
                            <div className="servon-notif-body">
                              <div className="servon-notif-top-row">
                                <span className="servon-notif-title-text">{n.title}</span>
                                <span className="servon-notif-time-text">
                                  {new Date(n.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                              <p className="servon-notif-msg-text" style={{ margin: 0 }}>{n.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* AI Alerts */}
                    {aiAlerts.length > 0 && (
                      <div>
                        <div className="servon-notif-day-header">AI Alerts</div>
                        {aiAlerts.map((a) => (
                          <div
                            key={`alert-${a.id}`}
                            className={`servon-notif-item${!a.is_read ? " unread" : ""}`}
                            style={{ cursor: "pointer", background: !a.is_read ? getAlertSeverityBg(a.severity) : undefined, borderColor: !a.is_read ? getAlertSeverityColor(a.severity) : undefined }}
                            onClick={() => handleOpenAlert(a)}
                          >
                            <div className="servon-notif-icon" style={{ background: getAlertSeverityBg(a.severity) }}>
                              {getAlertIcon(a.severity)}
                            </div>
                            <div className="servon-notif-body">
                              <div className="servon-notif-top-row">
                                <span className="servon-notif-title-text">
                                  {!a.is_read && <span className="servon-notif-unread-dot" />}
                                  {a.title}
                                </span>
                                <span className="servon-notif-time-text">
                                  {new Date(a.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                              <p className="servon-notif-msg-text" style={{ margin: 0 }}>{a.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>,
          document.body
        )}

        {/* IN-APP TRIAL/SUBSCRIPTION TOAST — replaces window.alert, portal-rendered so
            it floats above everything regardless of scroll position. Gated by
            isFocused so it only shows while the Dashboard tab is the active screen. */}
        {trialToast && isFocused && typeof document !== "undefined" && ReactDOM.createPortal(
          <div className="servon-trial-toast">
            <div className="servon-trial-toast-icon">
              <Ionicons name="time-outline" size={16} color="#fff" />
            </div>
            <div className="servon-trial-toast-text">{trialToast.message}</div>
            <div className="servon-trial-toast-actions">
              <button
                className="servon-trial-toast-btn"
                onClick={() => { setTrialToast(null); navigation.navigate("Profile"); }}
              >
                Subscribe
              </button>
              <button className="servon-trial-toast-close" onClick={() => setTrialToast(null)}>
                <Ionicons name="close" size={15} color="rgba(255,255,255,0.7)" />
              </button>
            </div>
          </div>,
          document.body
        )}

        {/* INVENTORY FLOATING BUTTON */}
       <button
  onClick={() => navigation.navigate("Inventory")}
  style={{
    position: "fixed", bottom: 100, right: 28, zIndex: 999,
            width: 58, height: 58, borderRadius: 18,
            background: "#111827", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 10px 28px rgba(17,24,39,0.28)",
          }}
        >
          <Ionicons name="cube-outline" size={24} color="#fff" />
          {lowStockCount > 0 && (
            <span style={{
              position: "absolute", top: -4, right: -4,
              background: "#EF4444", color: "#fff",
              fontSize: 10, fontWeight: 700,
              width: 18, height: 18, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid #F5F3EF",
            }}>
              {lowStockCount > 9 ? "9+" : lowStockCount}
            </span>
          )}
        </button>

        {/* AI BUSINESS SUMMARY MODAL */}
        {showBusinessSummaryModal && businessSummary && typeof document !== "undefined" && ReactDOM.createPortal(
          <div className="servon-summary-overlay" onClick={() => setShowBusinessSummaryModal(false)}>
            <div className="servon-summary-modal" onClick={(e) => e.stopPropagation()}>
              <div className="servon-summary-header">
                <div>
                  <div className="servon-summary-title">AI Business Summary</div>
                  <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
                    {businessSummary.summary_date} · Hour {businessSummary.summary_hour}:00
                  </div>
                </div>
                <button onClick={() => setShowBusinessSummaryModal(false)} style={{
                  background: "#F3F4F6", border: "none", borderRadius: 8,
                  width: 32, height: 32, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <Ionicons name="close" size={16} color="#374151" />
                </button>
              </div>

              {(() => {
                const j = businessSummary.summary_json || {};
                const rows = [
                  { label: "Revenue", value: j.revenue },
                  { label: "Profit", value: j.profit },
                  { label: "Orders", value: j.orders },
                  { label: "Avg Order Value", value: j.avgOrderValue },
                  { label: "Best Seller", value: j.bestSeller },
                  { label: "Needs Attention", value: j.needsAttention },
                  { label: "Peak Hours", value: j.peakHours },
                  { label: "Customer Feedback", value: j.customerFeedback },
                ].filter(r => r.value);
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
                    {rows.map((r) => (
                      <div key={r.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 12px", background: "#F9FAFB", borderRadius: 10, border: "1px solid #F3F4F6" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0 }}>{r.label}</span>
                        <span style={{ fontSize: 13, color: "#111827", fontWeight: 500, textAlign: "right" }}>{r.value}</span>
                      </div>
                    ))}
                    {Array.isArray(j.recommendations) && j.recommendations.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Recommendations</div>
                        {j.recommendations.map((rec, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                            <Ionicons name="bulb-outline" size={14} color="#F59E0B" style={{ marginTop: 2 }} />
                            <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{rec}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {j.todaysFocus && (
                      <div style={{ marginTop: 8, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: "12px 14px" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#16A34A", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Today's Focus</div>
                        <div style={{ fontSize: 14, color: "#166534", fontWeight: 600, lineHeight: 1.5 }}>{j.todaysFocus}</div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <button className="servon-summary-btn" style={{ marginTop: 20 }} onClick={() => setShowBusinessSummaryModal(false)}>
                Close
              </button>
            </div>
          </div>,
          document.body
        )}

        {/* AI ALERT TOAST */}
        {alertToast && isFocused && typeof document !== "undefined" && ReactDOM.createPortal(
          <div className="servon-trial-toast" style={{ background: getAlertSeverityColor(alertToast.severity) }}>
            <div className="servon-trial-toast-icon">
              {getAlertIcon(alertToast.severity)}
            </div>
            <div className="servon-trial-toast-text">
              <strong style={{ display: "block", marginBottom: 2 }}>{alertToast.title}</strong>
              {alertToast.message}
            </div>
            <div className="servon-trial-toast-actions">
              <button className="servon-trial-toast-close" onClick={() => setAlertToast(null)}>
                <Ionicons name="close" size={15} color="rgba(255,255,255,0.7)" />
              </button>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  // ─── NATIVE RENDER ──────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + 15 }]}>
        <View style={styles.headerInner}>
          <Text style={styles.brandText}>{businessName}<Text style={styles.brandAccent}>.</Text></Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={handleOpenNotifications}>
              <Ionicons name="notifications-outline" size={24} color="#374151" />
              {totalUnread > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{totalUnread > 9 ? "9+" : totalUnread}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileAvatar} onPress={() => navigation.navigate("Profile")}>
              <Text style={styles.profileAvatarText}>{ownerInitial}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* IN-APP TRIAL/SUBSCRIPTION TOAST — replaces Alert.alert popup. Gated by
          isFocused so it only shows while the Dashboard tab is the active screen. */}
      {trialToast && isFocused && (
        <View style={[styles.trialToastWrap, { top: insets.top + 62 }]} pointerEvents="box-none">
          <View style={styles.trialToast}>
            <View style={styles.trialToastIcon}>
              <Ionicons name="time-outline" size={16} color="#fff" />
            </View>
            <Text style={styles.trialToastText}>{trialToast.message}</Text>
            <TouchableOpacity
              style={styles.trialToastBtn}
              onPress={() => { setTrialToast(null); navigation.navigate("Profile"); }}
            >
              <Text style={styles.trialToastBtnText}>Subscribe</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.trialToastClose} onPress={() => setTrialToast(null)}>
              <Ionicons name="close" size={15} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        <View style={[styles.responsiveContent, { maxWidth: responsiveMaxWidth }]}>
          <SubscriptionBanner />

          <View style={[styles.statsGrid, isTabletWidth && styles.statsGridSmall]}>
  <StatCard
    label="Orders Today"
    value={analytics?.today?.totalOrders ?? 0}
    icon="cube"
    color="#3B82F6"
    bg="#EFF6FF"
    extraStyle={{ minWidth: statCardMinWidth }}
  />

  {!isChefMode && (
    <StatCard
      label="Revenue Today"
      value={`₹${(analytics?.today?.totalRevenue ?? 0).toFixed(0)}`}
      icon="wallet"
      color="#10B981"
      bg="#ECFDF5"
      extraStyle={{ minWidth: statCardMinWidth }}
    />
  )}

  <StatCard
    label="Active Tables"
    value={activeTableCount}
    icon="grid"
    color="#F59E0B"
    bg="#FFFBEB"
    extraStyle={{ minWidth: statCardMinWidth }}
  />

  <StatCard
    label="Top Item"
    value={analytics?.today?.mostOrderedItem?.name || "-"}
    icon="flame"
    color="#EF4444"
    bg="#FEF2F2"
    isText
    extraStyle={{ minWidth: statCardMinWidth }}
  />
</View>

{/* AI BUSINESS ADVISOR + GENERATE SUMMARY BUTTONS — hidden in chef mode */}
{!isChefMode && (
  <View style={{ flexDirection: "row", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
    <TouchableOpacity
      style={styles.advisorBtn}
      onPress={() => navigation.navigate("Advisor")}
    >
      <Ionicons
        name="sparkles-outline"
        size={20}
        color="#fff"
      />
      <Text style={styles.advisorBtnText}>
        AI Business Advisor
      </Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.advisorBtn, { backgroundColor: "#111827" }]}
      onPress={handleGenerateSummary}
      disabled={generatingSummary}
    >
      {generatingSummary ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Ionicons name="analytics-outline" size={20} color="#fff" />
      )}
      <Text style={styles.advisorBtnText}>
        Generate Summary
      </Text>
    </TouchableOpacity>
  </View>
)}

<View style={styles.section}></View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Live Orders</Text>
              <View style={styles.countBadge}><Text style={styles.countBadgeText}>{liveOrders.length}</Text></View>
            </View>

            {liveOrders.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconCircle}><Ionicons name="restaurant-outline" size={32} color="#9CA3AF" /></View>
                <Text style={styles.emptyText}>No active orders right now</Text>
                <Text style={styles.emptySubText}>Waiting for customers to scan QR</Text>
              </View>
            ) : (
              liveOrders.map(order => <OrderCard key={order.id} order={order} onStatusUpdate={handleStatusUpdate} />)
            )}
          </View>
        </View>
      </ScrollView>

      {/* NOTIFICATIONS MODAL */}
      <Modal visible={showNotifications} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderTop}>
              <View>
                <Text style={styles.modalTitleText}>Notifications</Text>
                {totalUnread > 0 && <Text style={styles.modalSubtitleText}>{totalUnread} unread</Text>}
              </View>
              <TouchableOpacity onPress={() => setShowNotifications(false)}>
                <Ionicons name="close-circle" size={28} color="#D1D5DB" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.notifList}>
              {notifications.length === 0 && trialNotifications.length === 0 ? (
                <View style={styles.emptyNotifWrap}>
                  <View style={styles.emptyNotifIconCircle}>
                    <Ionicons name="notifications-off-outline" size={28} color="#9CA3AF" />
                  </View>
                  <Text style={styles.emptyNotif}>No notifications yet</Text>
                  <Text style={styles.emptyNotifSub}>You'll see updates here as they come in</Text>
                </View>
              ) : (
                <>
                  {notifications.length > 0 && (() => {
                    const { recent, older } = splitNotificationGroups(groupNotificationsByDay(notifications));
                    const renderGroup = (group) => (
                      <View key={group.label}>
                        <Text style={styles.notifDayHeader}>{group.label}</Text>
                        {group.items.map((n, index) => (
                          <View key={n.id || index} style={[styles.notifItemModern, !n.is_read && styles.notifItemModernUnread]}>
                            <View style={[styles.notifIconCircle, !n.is_read && styles.notifIconCircleUnread]}>
                              {getNotifIcon(n.title, true)}
                            </View>
                            <View style={styles.notifItemBody}>
                              <View style={styles.notifTopRow}>
                                <View style={styles.notifTitleRow}>
                                  {!n.is_read && <View style={styles.notifUnreadDot} />}
                                  <Text style={styles.notifTitleModern} numberOfLines={1}>{n.title || "New Order"}</Text>
                                </View>
                                <Text style={styles.notifTimeModern}>
                                  {new Date(n.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                              </View>
                              <Text style={styles.notifMessageModern}>{n.message}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    );
                    return (
                      <>
                        {recent.map(renderGroup)}
                        {older.length > 0 && (
                          showOlderNotifications ? (
                            older.map(renderGroup)
                          ) : (
                            <TouchableOpacity style={styles.loadMoreBtn} onPress={() => setShowOlderNotifications(true)}>
                              <Ionicons name="chevron-down-outline" size={14} color="#374151" />
                              <Text style={styles.loadMoreBtnText}>Load older notifications</Text>
                            </TouchableOpacity>
                          )
                        )}
                      </>
                    );
                  })()}

                  {/* Trial Reminders */}
                  {trialNotifications.length > 0 && (
                    <View>
                      <Text style={styles.notifDayHeader}>Trial Reminders</Text>
                      {trialNotifications.map((n) => (
                        <View key={`trial-${n.id}`} style={[styles.notifItemModern, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                          <View style={[styles.notifIconCircle, { backgroundColor: '#DBEAFE' }]}>
                            <Ionicons name="time-outline" size={18} color="#3B82F6" />
                          </View>
                          <View style={styles.notifItemBody}>
                            <View style={styles.notifTopRow}>
                              <Text style={styles.notifTitleModern} numberOfLines={1}>{n.title}</Text>
                              <Text style={styles.notifTimeModern}>
                                {new Date(n.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                            <Text style={styles.notifMessageModern}>{n.message}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* AI Alerts */}
                  {aiAlerts.length > 0 && (
                    <View>
                      <Text style={styles.notifDayHeader}>AI Alerts</Text>
                      {aiAlerts.map((a) => (
                        <TouchableOpacity
                          key={`alert-${a.id}`}
                          style={[styles.notifItemModern, !a.is_read && { backgroundColor: getAlertSeverityBg(a.severity), borderColor: getAlertSeverityColor(a.severity) }]}
                          onPress={() => handleOpenAlert(a)}
                        >
                          <View style={[styles.notifIconCircle, { backgroundColor: getAlertSeverityBg(a.severity) }]}>
                            {getAlertIcon(a.severity, true)}
                          </View>
                          <View style={styles.notifItemBody}>
                            <View style={styles.notifTopRow}>
                              <View style={styles.notifTitleRow}>
                                {!a.is_read && <View style={styles.notifUnreadDot} />}
                                <Text style={styles.notifTitleModern} numberOfLines={1}>{a.title}</Text>
                              </View>
                              <Text style={styles.notifTimeModern}>
                                {new Date(a.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                            <Text style={styles.notifMessageModern}>{a.message}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* INVENTORY FLOATING BUTTON */}
      <TouchableOpacity
        style={[styles.inventoryFab, { bottom: insets.bottom + 24 }]}
        onPress={() => navigation.navigate("Inventory")}
        activeOpacity={0.85}
      >
        <Ionicons name="cube-outline" size={24} color="#fff" />
        {lowStockCount > 0 && (
          <View style={styles.inventoryFabBadge}>
            <Text style={styles.inventoryFabBadgeText}>{lowStockCount > 9 ? "9+" : lowStockCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* AI BUSINESS SUMMARY MODAL (native) */}
      <Modal visible={showBusinessSummaryModal} transparent animationType="fade">
        <View style={styles.summaryModalOverlay}>
          <View style={styles.summaryModal}>
            <View style={styles.summaryModalHeader}>
              <Text style={styles.summaryModalTitle}>AI Business Summary</Text>
              <TouchableOpacity onPress={() => setShowBusinessSummaryModal(false)}>
                <Ionicons name="close-circle" size={28} color="#D1D5DB" />
              </TouchableOpacity>
            </View>
            {businessSummary && (
              <>
                <Text style={styles.summaryModalDate}>
                  {businessSummary.summary_date} · Hour {businessSummary.summary_hour}:00
                </Text>
                {(() => {
                  const j = businessSummary.summary_json || {};
                  const rows = [
                    { label: "Revenue", value: j.revenue },
                    { label: "Profit", value: j.profit },
                    { label: "Orders", value: j.orders },
                    { label: "Avg Order Value", value: j.avgOrderValue },
                    { label: "Best Seller", value: j.bestSeller },
                    { label: "Needs Attention", value: j.needsAttention },
                    { label: "Peak Hours", value: j.peakHours },
                    { label: "Customer Feedback", value: j.customerFeedback },
                  ].filter(r => r.value);
                  return (
                    <ScrollView style={{ maxHeight: 320 }}>
                      {rows.map((r) => (
                        <View key={r.label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, padding: 10, backgroundColor: "#F9FAFB", borderRadius: 10, borderWidth: 1, borderColor: "#F3F4F6", marginBottom: 8 }}>
                          <Text style={{ fontSize: 11, fontWeight: "600", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.4, flexShrink: 0 }}>{r.label}</Text>
                          <Text style={{ fontSize: 13, color: "#111827", fontWeight: "500", textAlign: "right", flexShrink: 1 }}>{r.value}</Text>
                        </View>
                      ))}
                      {Array.isArray(j.recommendations) && j.recommendations.length > 0 && (
                        <View style={{ marginTop: 4 }}>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Recommendations</Text>
                          {j.recommendations.map((rec, i) => (
                            <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                              <Ionicons name="bulb-outline" size={14} color="#F59E0B" style={{ marginTop: 2 }} />
                              <Text style={{ fontSize: 13, color: "#374151", lineHeight: 18, flex: 1 }}>{rec}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                      {j.todaysFocus && (
                        <View style={{ marginTop: 8, backgroundColor: "#F0FDF4", borderWidth: 1, borderColor: "#BBF7D0", borderRadius: 12, padding: 12 }}>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: "#16A34A", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Today's Focus</Text>
                          <Text style={{ fontSize: 14, color: "#166534", fontWeight: "600", lineHeight: 20 }}>{j.todaysFocus}</Text>
                        </View>
                      )}
                    </ScrollView>
                  );
                })()}
                <TouchableOpacity style={styles.summaryModalBtn} onPress={() => setShowBusinessSummaryModal(false)}>
                  <Text style={styles.summaryModalBtnText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* AI ALERT TOAST (native) */}
      {alertToast && isFocused && (
        <View style={[styles.trialToastWrap, { top: insets.top + 62 }]} pointerEvents="box-none">
          <View style={[styles.trialToast, { backgroundColor: getAlertSeverityColor(alertToast.severity) }]}>
            <View style={styles.trialToastIcon}>
              {getAlertIcon(alertToast.severity, true)}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.trialToastText, { fontWeight: "700", marginBottom: 2 }]}>{alertToast.title}</Text>
              <Text style={styles.trialToastText}>{alertToast.message}</Text>
            </View>
            <TouchableOpacity style={styles.trialToastClose} onPress={() => setAlertToast(null)}>
              <Ionicons name="close" size={15} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* INSIGHT MODAL */}
      
    </View>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

function WebStatCard({ label, value, icon, color, bg, accent, isText }) {
  return (
    <div className={`servon-stat-card accent-${accent}`}>
      <div className="servon-stat-icon" style={{ background: bg }}>
        <Ionicons name={icon} size={18} color={color} />
      </div>
      <div>
        <div className="servon-stat-value" style={isText ? { fontSize: 18, fontWeight: 600 } : {}} title={String(value)}>
          {value}
        </div>
        <div className="servon-stat-label">{label}</div>
      </div>
    </div>
  );
}

function WebOrderCard({ order, onStatusUpdate }) {
  const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || "[]");
  const color = statusColor(order.status);
  const elapsed = Math.floor((Date.now() - new Date(order.created_at)) / 60000);

  return (
    <div className="servon-order-card">
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: color, borderRadius: "16px 0 0 16px" }} />
      <div style={{ paddingLeft: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ background: "#F3F4F6", borderRadius: 8, padding: "4px 10px", fontSize: 13, fontWeight: 600, color: "#374151" }}>
              Table {order.table_number || "?"}
            </span>
            <span style={{ background: `${color}18`, color, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
              {order.status}
            </span>
          </div>
          <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>
            {elapsed < 1 ? "Just now" : `${elapsed}m ago`}
          </span>
        </div>
        <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 10, marginBottom: 10 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ background: "#F3F4F6", borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 700, color: "#374151" }}>
                {item.quantity}×
              </span>
              <span style={{ fontSize: 13, color: "#1F2937", fontWeight: 500 }}>{item.name}</span>
            </div>
          ))}
        </div>
        {order.special_instructions && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 6, background: "#FFFBEB", borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
            <Ionicons name="information-circle" size={14} color="#F59E0B" style={{ marginTop: 1 }} />
            <span style={{ fontSize: 12, color: "#92400E", lineHeight: 1.5 }}>{order.special_instructions}</span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #F3F4F6", paddingTop: 10 }}>
          <div>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>Total </span>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#111827" }}>₹{order.total_amount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

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

// ─── STYLES ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3EF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottomWidth: 1,
    borderBottomColor: '#EAE6E0',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandText: { fontSize: 20, fontWeight: '700', color: '#111827', letterSpacing: -0.5 },
  brandAccent: { color: '#22C55E' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { padding: 8, position: 'relative' },
  badge: {
    position: 'absolute', top: 2, right: 2,
    backgroundColor: '#EF4444', borderRadius: 10,
    minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700', paddingHorizontal: 4 },
  profileAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  responsiveContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, alignSelf: 'center', width: '100%' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16, marginBottom: 24 },
  statsGridSmall: { gap: 12 },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#EAE6E0',
    borderRadius: 14, padding: 14, flexDirection: 'row',
    alignItems: 'center', gap: 12,
  },
  iconContainer: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 11, fontWeight: '500', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },
  section: { marginTop: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  countBadge: { backgroundColor: '#111827', borderRadius: 16, paddingHorizontal: 8, paddingVertical: 2 },
  countBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  emptyCard: {
    backgroundColor: '#FAFAF8', borderWidth: 1.5, borderColor: '#D1C9BC',
    borderStyle: 'dashed', borderRadius: 16, padding: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  emptySubText: { fontSize: 13, color: '#B3ACA4', marginTop: 4 },
  orderCard: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#EAE6E0',
    borderRadius: 16, padding: 16, marginBottom: 14,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  tableIndicator: { backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  orderTable: { fontSize: 13, fontWeight: '600', color: '#374151' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 10 },
  orderItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  qtyBadge: { backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  qtyText: { fontSize: 11, fontWeight: '700', color: '#374151' },
  orderItemName: { fontSize: 13, fontWeight: '500', color: '#1F2937' },
  noteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#FFFBEB', borderRadius: 8, padding: 8, marginTop: 4 },
  orderNote: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderTotalLabel: { fontSize: 12, color: '#9CA3AF' },
  orderTotalValue: { fontSize: 17, fontWeight: '800', color: '#111827' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 20, paddingHorizontal: 20, maxHeight: '80%',
  },
  modalHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitleText: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalSubtitleText: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  notifList: { paddingBottom: 24 },

  /* legacy notif item styles (kept, unused by new render but not removed) */
  emptyNotif: { textAlign: 'center', color: '#9CA3AF', marginTop: 40, fontSize: 14 },
  notifItem: {
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: '#FAFAF8', borderRadius: 12,
    borderWidth: 1, borderColor: '#EAE6E0',
    marginBottom: 10,
  },
  notifItemUnread: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  notifTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  notifMessage: { fontSize: 13, color: '#4B5563', marginBottom: 4 },
  notifTime: { fontSize: 11, color: '#9CA3AF' },

  /* ── Modern, day-grouped notification styles ── */
  notifDayHeader: {
    fontSize: 11, fontWeight: '700', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginTop: 10, marginBottom: 8,
  },
  notifItemModern: {
    flexDirection: 'row', gap: 12, padding: 13,
    borderRadius: 14, marginBottom: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#EAE6E0',
  },
  notifItemModernUnread: { backgroundColor: '#F3FDF6', borderColor: '#BBF7D0' },
  notifIconCircle: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EFF6FF', flexShrink: 0,
  },
  notifIconCircleUnread: { backgroundColor: '#DCFCE7' },
  notifItemBody: { flex: 1, minWidth: 0 },
  notifTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3, gap: 8 },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  notifUnreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' },
  notifTitleModern: { fontSize: 14, fontWeight: '700', color: '#111827', flexShrink: 1 },
  notifTimeModern: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  notifMessageModern: { fontSize: 13, color: '#6B7280', lineHeight: 19 },
  loadMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#F9F8F6', borderWidth: 1, borderStyle: 'dashed', borderColor: '#D1C9BC',
    borderRadius: 12, paddingVertical: 12, marginTop: 4, marginBottom: 10,
  },
  loadMoreBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  emptyNotifWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyNotifIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyNotifSub: { fontSize: 13, color: '#B3ACA4', marginTop: 4, textAlign: 'center' },

  summaryModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  summaryModal: { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '100%', maxWidth: 400 },
  summaryModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  summaryModalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  summaryModalDate: { fontSize: 14, color: '#6B7280', marginBottom: 16 },
  summaryModalTextContainer: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#F3F4F6', marginBottom: 20 },
  summaryModalText: { fontSize: 15, color: '#374151', lineHeight: 24 },
  summaryModalStats: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 16, marginBottom: 20 },
  summaryStat: { alignItems: 'center' },
  summaryStatValue: { fontSize: 20, fontWeight: '800', color: '#111827' },
  summaryStatLabel: { fontSize: 11, color: '#6B7280', marginTop: 4, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.4 },
  summaryModalBtn: { backgroundColor: '#111827', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  summaryModalBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  insightModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  insightModal: { backgroundColor: '#fff', borderRadius: 20, padding: 18, width: '85%', maxWidth: 340, alignItems: 'center' },
  insightModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: 16 },
  insightModalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  insightModalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  insightModalIconWrapper: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  insightModalText: { fontSize: 15, color: '#1F2937', textAlign: 'center', lineHeight: 26, marginBottom: 24, fontWeight: '500' },
  insightModalBtn: { backgroundColor: '#111827', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 12, width: '100%', alignItems: 'center' },
  insightModalBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  insightModalFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  insightModalFooterText: { fontSize: 13, color: '#9CA3AF' },
  advisorBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, gap: 8, marginTop: 12, alignSelf: 'center' },
  advisorBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  /* ── In-app trial/subscription toast (native) — replaces Alert.alert ── */
  trialToastWrap: {
    position: 'absolute', left: 0, right: 0, alignItems: 'center',
    zIndex: 999, paddingHorizontal: 16,
  },
  trialToast: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#111827', borderRadius: 14,
    paddingVertical: 11, paddingHorizontal: 13,
    maxWidth: 480, width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22, shadowRadius: 16, elevation: 10,
  },
  trialToastIcon: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  trialToastText: { flex: 1, color: '#fff', fontSize: 12.5, lineHeight: 17 },
  trialToastBtn: { backgroundColor: '#fff', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 11, flexShrink: 0 },
  trialToastBtnText: { color: '#111827', fontSize: 11.5, fontWeight: '700' },
  trialToastClose: { padding: 4, flexShrink: 0 },

  /* ── Inventory floating action button (native) ── */
  inventoryFab: {
    position: 'absolute', right: 20,
    width: 58, height: 58, borderRadius: 18,
    backgroundColor: '#111827',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 8,
    zIndex: 50,
  },
  inventoryFabBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#EF4444', borderRadius: 10,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#F5F3EF', paddingHorizontal: 3,
  },
  inventoryFabBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
});