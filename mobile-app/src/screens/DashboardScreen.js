import React, { useState, useCallback, useEffect, useRef } from "react";

import {
  View,
  Text as NativeText,
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
import LocalizedText, { localizeText } from "../components/LocalizedText";
import { useLocale } from "../context/LocaleContext";
import { useFocusEffect, useNavigation, useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useAudioPlayer } from "expo-audio";
import * as Print from "expo-print";
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
  removeOrderItem,
  getMenu,
  getTables,
  getProfile,
} from "../api";
import API from "../api";
import SubscriptionBanner from "../components/SubscriptionBanner";
import { dashboardWebCss } from "./DashboardTheme";
import ServonAssistantModal from "../components/ServonAssistantModal";
import { localizedItemName } from "../utils/localizedItemName";
import localDB from "../services/LocalDB";
import networkMonitor from "../services/NetworkMonitor";
import io from "socket.io-client";
import { API_BASE_URL } from '../config/api';
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import ReactDOM from "react-dom";

const isWeb = Platform.OS === "web";
const BILL_PRINT_TITLE = "Powered by Servon Labs";

const localizeBusinessSummaryValue = (value, language) => {
  if (typeof value !== "string" || language === "en") return value;

  const exact = localizeText(value, language);
  if (exact !== value) return exact;

  const rupee = "₹";
  const dictionaries = {
    mr: [
      [/^Today generated ₹([\d,.]+) in revenue\.$/i, (_, amount) => `आज ${rupee}${amount} कमाई झाली.`],
      [/^Profit stands at ₹([\d,.]+) today\.$/i, (_, amount) => `आज नफा ${rupee}${amount} आहे.`],
      [/^Only (\d+) order processed today\.$/i, (_, count) => `आज फक्त ${count} ऑर्डर झाली.`],
      [/^(\d+) orders processed today\.$/i, (_, count) => `आज ${count} ऑर्डर झाल्या.`],
      [/^Average order value is ₹([\d,.]+)\.$/i, (_, amount) => `सरासरी ऑर्डर मूल्य ${rupee}${amount} आहे.`],
      [/^(.+) is the top-selling item\.$/i, (_, item) => `${item} हा सर्वाधिक विकला जाणारा पदार्थ आहे.`],
      [/^(.+) is slow-moving; consider promotions\.$/i, (_, item) => `${item} कमी विकला जात आहे; प्रमोशनचा विचार करा.`],
      [/^(.+) is slow-moving, needs review\.$/i, (_, item) => `${item} कमी विकला जात आहे; लक्ष देणे आवश्यक आहे.`],
      [/^Peak hour was ([\d:]+) with (\d+) order\.$/i, (_, hour, count) => `गर्दीची वेळ ${hour} होती, ${count} ऑर्डर झाली.`],
      [/^Peak hour is at ([\d:]+) with (\d+) order\.$/i, (_, hour, count) => `गर्दीची वेळ ${hour} आहे, ${count} ऑर्डर झाली.`],
      [/^No customer reviews received today\.$/i, () => "आज ग्राहक पुनरावलोकने मिळाली नाहीत."],
      [/^No customer feedback received yet\.$/i, () => "अजून ग्राहक अभिप्राय मिळालेला नाही."],
      [/^Promote (.+) to boost sales\.$/i, (_, item) => `विक्री वाढवण्यासाठी ${item} प्रमोट करा.`],
      [/^Encourage customer reviews for feedback\.$/i, () => "ग्राहक अभिप्रायासाठी पुनरावलोकने मागा."],
      [/^Encourage customer reviews for better insights\.$/i, () => "चांगल्या माहितीसाठी ग्राहक पुनरावलोकने वाढवा."],
      [/^Monitor inventory for popular items\.$/i, () => "लोकप्रिय पदार्थांसाठी स्टॉक तपासा."],
      [/^Monitor order trends for adjustments\.$/i, () => "बदलांसाठी ऑर्डर ट्रेंड तपासा."],
      [/^Increase order volume and customer engagement\.$/i, () => "ऑर्डर आणि ग्राहक सहभाग वाढवा."],
      [/^Increase orders by promoting best-selling items\.$/i, () => "सर्वाधिक विकल्या जाणाऱ्या पदार्थांचे प्रमोशन करून ऑर्डर वाढवा."],
    ],
    hi: [
      [/^Today generated ₹([\d,.]+) in revenue\.$/i, (_, amount) => `आज ${rupee}${amount} कमाई हुई।`],
      [/^Profit stands at ₹([\d,.]+) today\.$/i, (_, amount) => `आज मुनाफ़ा ${rupee}${amount} है।`],
      [/^Only (\d+) order processed today\.$/i, (_, count) => `आज सिर्फ ${count} ऑर्डर हुई।`],
      [/^(\d+) orders processed today\.$/i, (_, count) => `आज ${count} ऑर्डर हुईं।`],
      [/^Average order value is ₹([\d,.]+)\.$/i, (_, amount) => `औसत ऑर्डर मूल्य ${rupee}${amount} है।`],
      [/^(.+) is the top-selling item\.$/i, (_, item) => `${item} सबसे अधिक बिकने वाला आइटम है।`],
      [/^(.+) is slow-moving; consider promotions\.$/i, (_, item) => `${item} धीमे बिक रहा है; प्रमोशन पर विचार करें।`],
      [/^(.+) is slow-moving, needs review\.$/i, (_, item) => `${item} धीमे बिक रहा है; ध्यान देने की जरूरत है।`],
      [/^Peak hour was ([\d:]+) with (\d+) order\.$/i, (_, hour, count) => `व्यस्त समय ${hour} था, ${count} ऑर्डर हुई।`],
      [/^Peak hour is at ([\d:]+) with (\d+) order\.$/i, (_, hour, count) => `व्यस्त समय ${hour} है, ${count} ऑर्डर हुई।`],
      [/^No customer reviews received today\.$/i, () => "आज कोई ग्राहक रिव्यू नहीं मिला।"],
      [/^No customer feedback received yet\.$/i, () => "अभी तक कोई ग्राहक प्रतिक्रिया नहीं मिली।"],
      [/^Promote (.+) to boost sales\.$/i, (_, item) => `बिक्री बढ़ाने के लिए ${item} प्रमोट करें।`],
      [/^Encourage customer reviews for feedback\.$/i, () => "ग्राहक प्रतिक्रिया के लिए रिव्यू बढ़ाएं।"],
      [/^Encourage customer reviews for better insights\.$/i, () => "बेहतर जानकारी के लिए ग्राहक रिव्यू बढ़ाएं।"],
      [/^Monitor inventory for popular items\.$/i, () => "लोकप्रिय आइटम का स्टॉक देखते रहें।"],
      [/^Monitor order trends for adjustments\.$/i, () => "बदलाव के लिए ऑर्डर ट्रेंड देखें।"],
      [/^Increase order volume and customer engagement\.$/i, () => "ऑर्डर और ग्राहक सहभागिता बढ़ाएं।"],
      [/^Increase orders by promoting best-selling items\.$/i, () => "सबसे ज्यादा बिकने वाले आइटम प्रमोट करके ऑर्डर बढ़ाएं।"],
    ],
  };

  for (const [pattern, translate] of dictionaries[language] || []) {
    const match = value.match(pattern);
    if (match) return translate(...match);
  }

  return value;
};

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
      .servon-web-header { position: sticky; top: 0; z-index: 100; }
      ${dashboardWebCss}

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

      .servon-profile-menu-wrap { position: relative; }
      .servon-profile-menu {
        position: absolute; top: calc(100% + 10px); right: 0;
        background: #fff; border: 1px solid #EAE6E0; border-radius: 14px;
        box-shadow: 0 16px 40px rgba(17,24,39,0.14);
        width: 220px; padding: 6px; z-index: 250;
        animation: servonMenuIn 0.16s ease;
      }
      @keyframes servonMenuIn {
        from { opacity: 0; transform: translateY(-6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .servon-profile-menu-item {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 10px; border-radius: 10px;
        cursor: pointer; background: transparent; border: none;
        width: 100%; text-align: left; font-size: 13.5px; font-weight: 600;
        color: #374151; position: relative;
      }
      .servon-profile-menu-item:hover { background: #F5F3EF; }
      .servon-profile-menu-icon {
        width: 30px; height: 30px; border-radius: 9px;
        background: #F3F4F6; display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .servon-profile-menu-badge {
        margin-left: auto; background: #EF4444; color: #fff;
        font-size: 10px; font-weight: 700; border-radius: 10px;
        min-width: 18px; height: 18px; padding: 0 5px;
        display: flex; align-items: center; justify-content: center;
      }
      @media (max-width: 500px) {
        .servon-profile-menu { width: 200px; right: -4px; }
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

// ─── NOTIFICATION HELPERS ──────────────────────────────────────────────────
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

// ─── AI ALERT ICON HELPERS ───────────────────────────────────────────────────
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

// ─── NOTIFICATION SOUND ──────────────────────────────────────────────────────
const _b64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const _bytesToBase64 = (bytes) => {
  let result = "";
  let i;
  for (i = 0; i + 2 < bytes.length; i += 3) {
    result += _b64Chars[bytes[i] >> 2];
    result += _b64Chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
    result += _b64Chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
    result += _b64Chars[bytes[i + 2] & 63];
  }
  if (i < bytes.length) {
    const remaining = bytes.length - i;
    result += _b64Chars[bytes[i] >> 2];
    if (remaining === 1) {
      result += _b64Chars[(bytes[i] & 3) << 4];
      result += "==";
    } else {
      result += _b64Chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
      result += _b64Chars[(bytes[i + 1] & 15) << 2];
      result += "=";
    }
  }
  return result;
};

const _buildBeepWavBase64 = ({ frequency = 880, durationSec = 0.22, sampleRate = 8000, volume = 0.4 } = {}) => {
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const decay = Math.exp(-4 * t);
    const sample = Math.sin(2 * Math.PI * frequency * t) * decay * volume;
    const value = Math.max(-1, Math.min(1, sample)) * 0x7fff;
    view.setInt16(44 + i * 2, value, true);
  }
  return _bytesToBase64(new Uint8Array(buffer));
};

const NOTIFICATION_SOUND_DATA_URI = `data:audio/wav;base64,${_buildBeepWavBase64()}`;

let _webNotifAudioEl = null;
const _playWebNotificationSound = () => {
  try {
    if (typeof window === "undefined") return;
    if (!_webNotifAudioEl) {
      _webNotifAudioEl = new window.Audio(NOTIFICATION_SOUND_DATA_URI);
    }
    _webNotifAudioEl.currentTime = 0;
    _webNotifAudioEl.play().catch(() => {});
  } catch (err) {}
};

const _playNativeNotificationSound = async () => {
  try {
    const { sound } = await Audio.Sound.createAsync({ uri: NOTIFICATION_SOUND_DATA_URI });
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) sound.unloadAsync().catch(() => {});
    });
    await sound.playAsync();
  } catch (err) {
    console.log("Notification sound error:", err);
  }
};

// ─── NEW ORDER VOICE ANNOUNCEMENT ────────────────────────────────────────────
// Speaks the incoming order (table, items, quantities, total) in the currently
// selected platform language. Audio is synthesized by the SAME OpenAI voice
// stack (gpt-4o-mini-tts) used by the Voice AI Business Advisor, via the
// existing authenticated /advisor/speak endpoint. Speech text only — business
// data (item names, prices, IDs) is never modified.
const _announcedOrderIds = new Set();
const _QUANTITY_WORDS_EN = { 1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six", 7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten" };

const _announcementItemName = (it) => it?.name || it?.item_name || it?.title || "";
const _announcementItemQty = (it) => Number(it?.quantity || it?.qty || 1) || 1;
const _HI_NUM_WORDS = [
  "शून्य", "एक", "दो", "तीन", "चार", "पांच", "छह", "सात", "आठ", "नौ", "दस",
  "ग्यारह", "बारह", "तेरह", "चौदह", "पंद्रह", "सोलह", "सत्रह", "अठारह", "उन्नीस",
  "बीस", "इक्कीस", "बाईस", "तेईस", "चौबीस", "पच्चीस", "छब्बीस", "सत्ताईस", "अट्ठाईस", "उनतीस",
  "तीस", "इकतीस", "बत्तीस", "तैंतीस", "चौंतीस", "पैंतीस", "छत्तीस", "सैंतीस", "अड़तीस", "उनतालीस",
  "चालीस", "इकतालीस", "बयालीस", "तैंतालीस", "चवालीस", "पैंतालीस", "छियालीस", "सैंतालीस", "अड़तालीस", "उनचास",
  "पचास", "इक्यावन", "बावन", "तिरेपन", "चौवन", "पचपन", "छप्पन", "सत्तावन", "अट्ठावन", "उनसठ",
  "साठ", "इकसठ", "बासठ", "तिरेसठ", "चौंसठ", "पैंसठ", "छियासठ", "सड़सठ", "अड़सठ", "उनहत्तर",
  "सत्तर", "इकहत्तर", "बहत्तर", "तिहत्तर", "चौहत्तर", "पचहत्तर", "छिहत्तर", "सतहत्तर", "अठहत्तर", "उन्यासी",
  "अस्सी", "इक्यासी", "बयासी", "तिरासी", "चौरासी", "पचासी", "छियासी", "सत्तासी", "अट्ठासी", "नवासी",
  "नब्बे", "इक्यानवे", "बानवे", "तिरानवे", "चौरानवे", "पंचानवे", "छियानवे", "सत्तानवे", "अट्ठानवे", "निन्यानवे"
];
const _MR_NUM_WORDS = [
  "शून्य", "एक", "दोन", "तीन", "चार", "पाच", "सहा", "सात", "आठ", "नऊ", "दहा",
  "अकरा", "बारा", "तेरा", "चौदा", "पंधरा", "सोळा", "सतरा", "अठरा", "एकोणीस",
  "वीस", "एकवीस", "बावीस", "तेवीस", "चोवीस", "पंचवीस", "सव्वीस", "सत्तावीस", "अठ्ठावीस", "एकोणतीस",
  "तीस", "एकतीस", "बत्तीस", "तेहतीस", "चौतीस", "पस्तीस", "छत्तीस", "सदतीस", "अडतीस", "एकोणचाळीस",
  "चाळीस", "एकेचाळीस", "बेचाळीस", "त्रेचाळीस", "चव्वेचाळीस", "पंचेचाळीस", "सेहेचाळीस", "सत्तेचाळीस", "अठ्ठेचाळीस", "एकोणपन्नास",
  "पन्नास", "एकावन्न", "बावन्न", "त्रेपन्न", "चोपन्न", "पंचावन्न", "छप्पन्न", "सत्तावन्न", "अठ्ठावन्न", "एकोणसाठ",
  "साठ", "एकसष्ट", "बासष्ट", "त्रेसष्ट", "चौसष्ट", "पासष्ट", "सहासष्ट", "सदुसष्ट", "अडुसष्ट", "एकोणसत्तर",
  "सत्तर", "एकाहत्तर", "बहात्तर", "त्र्याहत्तर", "चौऱ्याहत्तर", "पंच्याहत्तर", "शहात्तर", "सत्त्याहत्तर", "अठ्ठ्याहत्तर", "एकोणऐंशी",
  "ऐंशी", "एक्याऐंशी", "ब्याऐंशी", "त्र्याऐंशी", "चौऱ्याऐंशी", "पंच्याऐंशी", "शहाऐंशी", "सत्त्याऐंशी", "अठ्ठ्याऐंशी", "एकोणनव्वद",
  "नव्वद", "एक्याण्णव", "ब्याण्णव", "त्र्याण्णव", "चौऱ्याण्णव", "पंच्याण्णव", "शहाण्णव", "सत्त्याण्णव", "अठ्ठ्याण्णव", "नव्याण्णव"
];

const _localizedAmountWords = (value, language) => {
  const amount = Math.round(parseFloat(value) || 0);
  const words = language === "mr" ? _MR_NUM_WORDS : _HI_NUM_WORDS;
  if (amount < 100) return words[amount] || String(amount);
  if (amount < 1000) {
    const hundreds = Math.floor(amount / 100);
    const rest = amount % 100;
    const hundredPart = language === "mr" ? `${words[hundreds]}शे` : `${words[hundreds]} सौ`;
    return `${hundredPart}${rest ? ` ${words[rest]}` : ""}`;
  }
  if (amount < 100000) {
    const thousands = Math.floor(amount / 1000);
    const rest = amount % 1000;
    const thousandPart = `${_localizedAmountWords(thousands, language)} हजार`;
    return `${thousandPart}${rest ? ` ${_localizedAmountWords(rest, language)}` : ""}`;
  }
  return String(amount);
};

const buildOrderAnnouncement = (order, tableNumber, language) => {
  const lang = ["en", "hi", "mr"].includes(language) ? language : "en";
  let items = Array.isArray(order?.items) ? order.items : [];
  if (typeof order?.items === "string") {
    try { items = JSON.parse(order.items); } catch { items = []; }
  }
  const table = tableNumber ?? order?.table_number ?? "?";
  const total = order?.total_amount ?? 0;
  const parts = [];

  if (lang === "en") {
    parts.push("New order received.");
    parts.push(`Table ${table}.`);
    items.forEach((it) => {
      const qty = _announcementItemQty(it);
      parts.push(`${_QUANTITY_WORDS_EN[qty] || qty} ${_announcementItemName(it)}.`);
    });
    parts.push(`Total amount ${total} rupees.`);
  } else if (lang === "mr") {
    parts.push("नवीन ऑर्डर आली आहे.");
    parts.push(`टेबल ${table}.`);
    items.forEach((it) => {
      parts.push(`${_announcementItemName(it)}, ${_announcementItemQty(it)}.`);
    });
    parts.push(`एकूण रक्कम ${_localizedAmountWords(total, "mr")} रुपये.`);
  } else {
    parts.push("नया ऑर्डर आया है।");
    parts.push(`टेबल ${table}.`);
    items.forEach((it) => {
      parts.push(`${_announcementItemName(it)}, ${_announcementItemQty(it)}.`);
    });
    parts.push(`कुल राशि ${_localizedAmountWords(total, "hi")} रुपये.`);
  }

  return parts.filter(Boolean).join(" ");
};

// Fire-and-forget announcement tied to the same new_order socket event as the
// existing beep. A module-level set of announced order ids guarantees each
// order is spoken exactly once, regardless of re-renders / refreshes.
const announceNewOrder = async (order, tableNumber, language, playAudio) => {
  const orderId = order?.id;
  if (!orderId || _announcedOrderIds.has(orderId)) return;
  _announcedOrderIds.add(orderId);
  try {
    const res = await API.post("/advisor/speak", {
      text: buildOrderAnnouncement(order, tableNumber, language),
      language: ["en", "hi", "mr"].includes(language) ? language : "en",
    });
    if (res?.data?.audio && typeof playAudio === "function") playAudio(res.data.audio);
  } catch (err) {
    console.warn("Order announcement failed:", err?.message);
  }
};

const playNotificationSound = () => {
  if (isWeb) {
    _playWebNotificationSound();
  } else {
    _playNativeNotificationSound();
  }
};

// ─── TRIAL TOAST FREQUENCY CONTROL ──────────────────────────────────────────
const TRIAL_TOAST_STORAGE_KEY = "servon_trial_toast_meta";
const TRIAL_TOAST_MAX_PER_DAY = 3;
const TRIAL_TOAST_MIN_GAP_HOURS = 3;

const getTrialToastMeta = () => {
  try {
    if (isWeb && typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(TRIAL_TOAST_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    }
  } catch (err) {}
  return global.__servonTrialToastMeta || null;
};

const setTrialToastMeta = (meta) => {
  try {
    if (isWeb && typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(TRIAL_TOAST_STORAGE_KEY, JSON.stringify(meta));
      return;
    }
  } catch (err) {}
  global.__servonTrialToastMeta = meta;
};

const canShowTrialToast = () => {
  const meta = getTrialToastMeta();
  const todayKey = new Date().toDateString();
  if (!meta || meta.day !== todayKey) return true;
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
  const { language } = useLocale();
  const { business, updateBusiness, isChefMode } = useAuth();
  // Voice announcement playback — same expo-audio playback approach as the
  // existing Voice AI Business Advisor. Kept separate from the notification beep.
  const announcementPlayer = useAudioPlayer(null);
  const playAnnouncement = (source) => {
    try {
      announcementPlayer.replace(source);
      announcementPlayer.play();
    } catch (e) {
      console.warn("Announcement playback failed:", e);
    }
  };
  // Ref keeps the socket handler's language current without re-binding the socket
  // (language changes must NOT re-trigger announcements for old orders).
  const languageRef = useRef(language);
  useEffect(() => { languageRef.current = language; }, [language]);
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

  const [trialStatus, setTrialStatus] = useState(null);
  const [trialNotifications, setTrialNotifications] = useState([]);
  const [trialUnreadCount, setTrialUnreadCount] = useState(0);
  const [trialLoading, setTrialLoading] = useState(true);

  const [trialToast, setTrialToast] = useState(null);

  const [lowStockCount, setLowStockCount] = useState(0);

  const [businessSummary, setBusinessSummary] = useState(null);
  const [showBusinessSummaryModal, setShowBusinessSummaryModal] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [aiAlerts, setAiAlerts] = useState([]);
  const [alertUnreadCount, setAlertUnreadCount] = useState(0);
  const [alertToast, setAlertToast] = useState(null);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);
  const [assistantOpen, setAssistantOpen] = useState(null); // null | 'manual' | 'voice'
  const [appendOrder, setAppendOrder] = useState(null);
  const [dashboardPrinting, setDashboardPrinting] = useState(false);

  const businessName = business?.business_name || business?.businessName || "Servon";

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

      if (daysLeft <= 3 && status !== 'active' && status !== 'ACTIVE') {
        if (!canShowTrialToast()) return;

        const msg = daysLeft <= 0 
          ? "Your free trial has expired!" 
          : `Your trial expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}.`;

        setTrialToast({ message: msg });
        recordTrialToastShown();
      }
    } catch (err) { 
      console.log("Warning popup error:", err); 
    }
  };

  const loadData = async () => {
    try {
      const online = await networkMonitor.checkConnectivity();
      if (!online) {
        const localOrders = await localDB.getOrders();
        setLiveOrders(localOrders.filter(o =>
          isToday(o.created_at) && !["PAID", "REJECTED", "SERVED"].includes(o.status)
        ));
        setAnalytics((prev) => prev || {
          ordersToday: localOrders.filter(o => isToday(o.created_at)).length,
          revenueToday: localOrders.filter(o => isToday(o.created_at) && o.status === "PAID").reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
          activeTables: new Set(localOrders.filter(o => isToday(o.created_at) && !["PAID", "REJECTED"].includes(o.status)).map(o => o.table_number)).size,
          topItem: "-",
        });
        setNotifications([]);
        setTrialLoading(false);
        return;
      }

      const [analyticsRes, ordersRes, notifRes, subRes] = await Promise.all([
        getAnalytics(), getOrders(), getNotifications(), getSubscriptionDetails()
      ]);

      setAnalytics(analyticsRes.data);
      await localDB.saveOrders(ordersRes.data || []);
      setLiveOrders(ordersRes.data.filter(o => 
        isToday(o.created_at) && !["PAID", "REJECTED", "SERVED"].includes(o.status)
      ));
      setNotifications(notifRes.data);

      try {
        const [menuRes, tablesRes, profileRes] = await Promise.all([
          getMenu(),
          getTables(),
          getProfile().catch(() => null),
        ]);
        await localDB.saveMenu(menuRes.data || []);
        await localDB.saveTables(tablesRes.data || []);
        if (profileRes?.data) await localDB.saveProfile(profileRes.data);
      } catch (cacheErr) {
        console.log("POS cache preload skipped:", cacheErr?.message || cacheErr);
      }

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

      try {
        const trialStatusRes = await getTrialStatus();
        const trialData = trialStatusRes?.data || trialStatusRes;
        if (trialData) {
          setTrialStatus(trialData);
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

      try {
        const alertRes = await getInventoryAlertsCount();
        setLowStockCount(alertRes?.data?.count || 0);
      } catch (invErr) {
        console.error("Inventory alert fetch error:", invErr);
      }

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
      try {
        const localOrders = await localDB.getOrders();
        setLiveOrders(localOrders.filter(o =>
          isToday(o.created_at) && !["PAID", "REJECTED", "SERVED"].includes(o.status)
        ));
      } catch (localErr) {
        console.error("Dashboard local fallback error:", localErr);
      }
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

  const openAddItems = (order) => {
    setAppendOrder(order);
    setAssistantOpen("manual");
  };

  const handleAssistantClose = () => {
    setAssistantOpen(null);
    setAppendOrder(null);
  };

  const handleOrderSaved = (updatedOrder) => {
    if (!updatedOrder?.id) {
      loadData();
      return;
    }
    if (!["CONFIRMED", "PREPARING", "SERVED", "TABLE_ACTIVE"].includes(updatedOrder.status)) {
      setLiveOrders((prev) => prev.filter((o) => o.id !== updatedOrder.id));
      return;
    }
    setLiveOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o)));
  };

  const handleRemoveOrderItem = async (order, item) => {
    try {
      const itemId = item.id || item.menu_item_id || item.menuItemId;
      const online = await networkMonitor.checkConnectivity();
      if (online && !String(order.id).startsWith("local_order_")) {
        const res = await removeOrderItem(order.id, itemId);
        await localDB.saveOrders([res.data]);
        handleOrderSaved(res.data);
      } else {
        const updated = await localDB.removeOrderItem(order.id, itemId);
        handleOrderSaved(updated);
      }
    } catch (err) {
      Alert.alert("Remove Item", err.response?.data?.error || "Could not remove item.");
    }
  };

  const buildDashboardBillHtml = useCallback(async (tableOrders) => {
    let profile = null;
    try {
      profile = await localDB.getProfile();
    } catch (err) {
      profile = null;
    }

    const combinedItems = {};
    let combinedSubtotal = 0;
    const isLiquorItem = (item) => item?.menu_type === "liquor" || !!item?.size_ml || !!item?.liquor_code || !!item?.liquor_brand_code;

    tableOrders.forEach((o) => {
      const items = Array.isArray(o.items) ? o.items : JSON.parse(o.items || "[]");
      items.forEach((item) => {
        const itemPrice = Number(item.price || 0);
        const itemQty = Number(item.quantity || 1);
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
    const cgstPercent = Number(profile?.cgst_percentage || 0);
    const sgstPercent = Number(profile?.sgst_percentage || 0);
    const cgstAmount = (combinedSubtotal * cgstPercent) / 100;
    const sgstAmount = (combinedSubtotal * sgstPercent) / 100;
    const grandTotal = Math.round(combinedSubtotal + cgstAmount + sgstAmount);

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

    const upiId = profile?.upi_id || "";
    const merchantName = encodeURIComponent(profile?.business_name || businessName || "Restaurant");
    const amount = grandTotal.toFixed(2);
    const upiString = upiId ? `upi://pay?pa=${upiId}&pn=${merchantName}&am=${amount}&cu=INR&tn=Payment` : "";
    const qrCodeUrl = upiId ? `https://quickchart.io/qr?text=${encodeURIComponent(upiString)}&size=200&margin=2` : null;
    const qrCodeUrlFallback = upiId ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiString)}` : null;

    return `
      <html>
        <head>
          <title>${BILL_PRINT_TITLE}</title>
          <style>
            @page { margin: 0; }
            body { font-family: monospace; width: 80mm; padding: 10px; color: #000; margin: 0 auto; }
            h2 { text-align: center; margin: 0 0 5px 0; font-size: 24px; }
            .center { text-align: center; font-size: 14px; margin-bottom: 5px; }
            .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
            .divider.tight { margin: 6px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 14px; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .center-col { text-align: center; }
            .section-total td { border-top: 1px solid #000; padding-top: 6px; font-size: 15px; }
            .upi-section { text-align: center; margin-top: 15px; padding: 15px; border-top: 2px dashed #000; }
            .upi-title { font-size: 16px; font-weight: 800; color: #000; margin-bottom: 4px; }
            .upi-amount { font-size: 20px; font-weight: 900; color: #000; margin-bottom: 10px; }
            .upi-qr-wrapper { display: flex; justify-content: center; margin: 8px 0; }
            .upi-qr-wrapper img { width: 150px; height: 150px; border: 2px solid #000; border-radius: 12px; }
            .upi-id { font-size: 13px; color: #333; margin-top: 8px; font-weight: 600; }
            .upi-instruction { font-size: 10px; color: #666; margin-top: 4px; }
            .upi-error { font-size: 12px; color: #000; padding: 10px; background: #F8F8F8; border-radius: 8px; border: 1px solid #ccc; }
            .thank-you { text-align: center; font-weight: bold; font-size: 16px; margin-top: 15px; color: #000; }
          </style>
        </head>
        <body>
          <h2>${profile?.business_name || businessName || "Restaurant"}</h2>
          ${profile?.gst_number ? `<div class="center">GSTIN: ${profile.gst_number}</div>` : ""}
          <div class="center">Table: ${tableOrders[0]?.table_number}</div>
          <div class="center">Date: ${new Date().toLocaleString("en-IN")}</div>
          <div class="divider"></div>
          ${billSectionsHtml}
          <div class="divider"></div>
          <table>
            <tr><td>Subtotal:</td><td class="right">&#8377;${combinedSubtotal.toFixed(2)}</td></tr>
            ${cgstPercent > 0 ? `<tr><td>CGST (${cgstPercent}%):</td><td class="right">&#8377;${cgstAmount.toFixed(2)}</td></tr>` : ""}
            ${sgstPercent > 0 ? `<tr><td>SGST (${sgstPercent}%):</td><td class="right">&#8377;${sgstAmount.toFixed(2)}</td></tr>` : ""}
            <tr class="bold"><td style="font-size: 18px; padding-top: 10px;">GRAND TOTAL:</td><td class="right" style="font-size: 18px; padding-top: 10px;">&#8377;${grandTotal.toFixed(2)}</td></tr>
          </table>
          <div class="divider"></div>
          <div class="upi-section">
            <div class="upi-title">PAY BILL</div>
            <div class="upi-amount">&#8377;${grandTotal.toFixed(2)}</div>
            ${
              upiId
                ? `<div class="upi-qr-wrapper"><img src="${qrCodeUrl}" alt="UPI Payment QR" onerror="this.src='${qrCodeUrlFallback}';" /></div><div class="upi-id">UPI ID: ${upiId}</div><div class="upi-instruction">Scan using Google Pay, PhonePe, Paytm, or any UPI app</div>`
                : `<div class="upi-error">UPI ID not configured. Please contact restaurant.</div>`
            }
          </div>
          <div class="thank-you">Thank You for Visiting!</div>
        </body>
      </html>
    `;
  }, [businessName, language]);

  const printDashboardHtml = useCallback(async (htmlContent) => {
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

      const existingRoot = document.getElementById("servon-dashboard-print-root");
      if (existingRoot) document.body.removeChild(existingRoot);
      const existingStyle = document.getElementById("servon-dashboard-print-style");
      if (existingStyle) document.head.removeChild(existingStyle);

      printRoot.id = "servon-dashboard-print-root";
      printRoot.innerHTML = bodyMatch?.[1] || printHtml;
      printRoot.style.display = "none";
      printStyle.id = "servon-dashboard-print-style";
      printStyle.textContent = `
        ${styleMatch?.[1] || ""}
        @media screen { #servon-dashboard-print-root { display: none !important; } }
        @media print {
          html, body {
            display: block !important; position: static !important;
            height: auto !important; min-height: 0 !important; max-height: none !important;
            overflow: visible !important; width: auto !important;
            margin: 0 !important; padding: 0 !important; background: #fff !important;
          }
          body > *:not(#servon-dashboard-print-root) { display: none !important; }
          #servon-dashboard-print-root {
            height: auto !important; min-height: 0 !important; max-height: none !important;
            position: static !important; overflow: visible !important;
            box-sizing: border-box; break-after: auto; page-break-after: auto;
          }
          #servon-dashboard-print-root {
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

      const printWhenReady = () => {
        document.title = BILL_PRINT_TITLE;
        window.focus();
        window.print();
        setTimeout(restoreTitle, 30000);
      };

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

      printWhenReady();
    } else {
      await Print.printAsync({
        html: htmlContent
          .replace("<title></title>", `<title>${BILL_PRINT_TITLE}</title>`)
          .replace("<title>&#8203;</title>", `<title>${BILL_PRINT_TITLE}</title>`),
      });
    }
  }, []);

  const handleDashboardBill = useCallback(async (currentOrder) => {
    if (dashboardPrinting || !currentOrder) return;
    setDashboardPrinting(true);
    try {
      const tableOrders = liveOrders.filter((o) =>
        o.table_number === currentOrder.table_number &&
        o.status !== "PAID" &&
        o.status !== "REJECTED" &&
        isToday(o.created_at)
      );
      if (!tableOrders.length) return;

      const htmlContent = await buildDashboardBillHtml(tableOrders);
      await Promise.all(tableOrders.map((o) => localDB.updateOrderStatus(o.id, "PAID").catch(() => null)));
      setLiveOrders((prev) => prev.filter((o) => !tableOrders.some((to) => to.id === o.id)));

      const online = await networkMonitor.checkConnectivity();
      if (online) {
        await Promise.all(tableOrders.map(async (o) => {
          try {
            if (!String(o.id).startsWith("local_order_")) {
              await updateOrderStatus(o.id, "PAID");
              await localDB.markAsSynced(o.id);
            }
          } catch (err) {
            console.log("Dashboard bill sync failed, pending local sync:", err?.message || err);
          }
        }));
      }

      await printDashboardHtml(htmlContent);
    } catch (err) {
      console.error("Dashboard bill error:", err);
      Alert.alert(localizeText("Print Failed", language), localizeText("Could not print the bill.", language));
    } finally {
      setDashboardPrinting(false);
    }
  }, [buildDashboardBillHtml, dashboardPrinting, language, liveOrders, printDashboardHtml]);

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
      const socket = io(API_BASE_URL, {
        transports: ["websocket"],
      });
      socket.on("connect", () => business?.id && socket.emit("join_business", business.id));
      socket.on("new_order", ({ order, notification, tableNumber }) => {
        if (isToday(order.created_at)) setLiveOrders(prev => [{ ...order, table_number: tableNumber }, ...prev]);
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
        playNotificationSound();
        // Voice announcement — same new_order event as the beep, spoken exactly
        // once per order id, using the current platform language.
        announceNewOrder(order, tableNumber ?? order?.table_number, languageRef.current, playAnnouncement);
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
        playNotificationSound();
      });
      socket.on("new_notification", (notificationRow) => {
        setNotifications(prev => [notificationRow, ...prev]);
        playNotificationSound();
      });
      return () => socket.disconnect();
    }, [business?.id])
  );

  useEffect(() => {
    if (loading) return;
    const interval = setInterval(() => {
      if (!showInsightModal) fetchNextInsight(false);
    }, 3600000);
    return () => clearInterval(interval);
  }, [loading, showInsightModal]);

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

  useEffect(() => {
    if (!trialToast) return;
    const t = setTimeout(() => setTrialToast(null), 6000);
    return () => clearTimeout(t);
  }, [trialToast]);

  useEffect(() => {
    if (!alertToast) return;
    const t = setTimeout(() => setAlertToast(null), 6000);
    return () => clearTimeout(t);
  }, [alertToast]);

  useEffect(() => {
    if (!isWeb || typeof document === "undefined") return;
    if (!showProfileMenu) return;

    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") setShowProfileMenu(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showProfileMenu]);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const totalUnread = unreadCount + trialUnreadCount + alertUnreadCount;
  const ownerInitial = business?.owner_name ? business.owner_name.charAt(0).toUpperCase() : "S";
  const activeTableCount = new Set(liveOrders.map(o => o.table_number)).size;
  const todayStr = new Date().toLocaleDateString(language === "mr" ? "mr-IN" : language === "hi" ? "hi-IN" : "en-IN", { weekday: "long", day: "numeric", month: "long" });

  // ─── PROFILE DROPDOWN NAVIGATION ITEMS ──────────────────────────────
  // STAFF OPTION ADDED HERE
  const profileMenuItems = [
    { key: "Profile", label: "Profile", icon: "person-outline", iconColor: "#3B82F6" },
    { key: "Inventory", label: "Inventory", icon: "cube-outline", iconColor: "#F59E0B", badge: lowStockCount },
    { key: "CustomerOutstanding", label: "Customer Outstanding", icon: "wallet-outline", iconColor: "#EF4444" },
    ...(!isChefMode ? [{ key: "Advisor", label: "AI Business Advisor", icon: "sparkles-outline", iconColor: "#287458" }] : []),
    { key: "Staff", label: "Staff", icon: "people-outline", iconColor: "#10B981" },
    { key: "Rooms", label: "Rooms", icon: "bed-outline", iconColor: "#6366F1" },

    { key: "Referrals", label: "Referrals", icon: "share-outline", iconColor: "#EAB308" },
    { key: "Support", label: "Support", icon: "help-buoy-outline", iconColor: "#10B981" },
  ];

  const handleProfileMenuNavigate = (screenName) => {
    setShowProfileMenu(false);
    navigation.navigate(screenName);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111" />
      </View>
    );
  }

  // ─── WEB RENDER ─────────────────────────────────────────────────────────────
  if (isWeb) {

    return (
      <div className="servon-dashboard">
        <div className="servon-web-header">
          <div className="servon-dashboard-header-inner">
            <div className="servon-restaurant-brand">
              <span className="servon-restaurant-icon"><Ionicons name="storefront-outline" size={21} color="#285943" /></span>
              <span>{businessName}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button aria-label={localizeText("Notifications", language)} onClick={handleOpenNotifications} style={{
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

              <div className="servon-profile-menu-wrap" ref={profileMenuRef}>
                <button
                  onClick={() => setShowProfileMenu(prev => !prev)}
                  aria-label={localizeText("Menu", language)}
                  aria-expanded={showProfileMenu}
                  aria-haspopup="menu"
                  style={{
                    minHeight: 44, padding: "0 12px", gap: 9, borderRadius: 9,
                    background: "#EDF2EE", color: "#243C30",
                    fontSize: 14, fontWeight: 600,
                    border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative"
                  }}
                >
                  {ownerInitial}
                  <span>{localizeText("Menu", language)}</span>
                  <Ionicons name="chevron-down" size={14} color="#42604E" />
                  {lowStockCount > 0 && (
                    <span style={{
                      position: "absolute", top: -3, right: -3,
                      background: "#EF4444", color: "#fff",
                      fontSize: 9, fontWeight: 700,
                      width: 15, height: 15, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      border: "2px solid #F5F3EF"
                    }}>
                      {lowStockCount > 9 ? "9+" : lowStockCount}
                    </span>
                  )}
                </button>

                {showProfileMenu && (
                  <div className="servon-profile-menu" role="menu">
                    {profileMenuItems.map((item) => (
                      <button
                        key={item.key}
                        className="servon-profile-menu-item"
                        role="menuitem"
                        onClick={() => handleProfileMenuNavigate(item.key)}
                      >
                        <span className="servon-profile-menu-icon">
                          <Ionicons name={item.icon} size={16} color={item.iconColor} />
                        </span>
                        {localizeText(item.label, language)}
                        {!!item.badge && item.badge > 0 && (
                          <span className="servon-profile-menu-badge">
                            {item.badge > 9 ? "9+" : item.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <main className="servon-dashboard-main">
          <div className="servon-dashboard-heading">
            <div>
              <p className="servon-dashboard-date">{todayStr}</p>
              <h1>{localizeText("Dashboard", language)}</h1>
              <p className="servon-dashboard-greeting">{localizeText(`Good ${getGreeting()}`, language)}</p>
            </div>
            <div className="servon-dashboard-actions">
              <button className="servon-dashboard-button" disabled={refreshing} onClick={() => { setRefreshing(true); loadData(); }}>
                <Ionicons name="refresh-outline" size={17} color="#466052" />
                {localizeText("Refresh", language)}
              </button>
              <button className="servon-dashboard-button servon-desktop-create" aria-label={localizeText("Voice order", language)} onClick={() => { setAppendOrder(null); setAssistantOpen("voice"); }}>
                <Ionicons name="mic-outline" size={18} color="#466052" />
                {localizeText("Voice order", language)}
              </button>
              <button className="servon-dashboard-button primary servon-desktop-create" onClick={() => { setAppendOrder(null); setAssistantOpen("manual"); }}>
                <Ionicons name="add" size={20} color="#fff" />
                {localizeText("Create Order", language)}
              </button>
            </div>
          </div>

          <SubscriptionBanner compact />

          <div className="servon-stats-grid">
            <WebStatCard language={language} label="Orders Today" value={analytics?.today?.totalOrders ?? 0} icon="cube" color="#3B82F6" bg="#EFF6FF" accent="blue" />
            {!isChefMode && <WebStatCard language={language} label="Revenue Today" value={`₹${(analytics?.today?.totalRevenue ?? 0).toFixed(0)}`} icon="wallet" color="#10B981" bg="#ECFDF5" accent="green" />}
            <WebStatCard language={language} label="Active Tables" value={activeTableCount} icon="grid" color="#F59E0B" bg="#FFFBEB" accent="amber" />
            <WebStatCard language={language} label="Top Item" value={analytics?.today?.mostOrderedItem?.name || "-"} icon="flame" color="#EF4444" bg="#FEF2F2" accent="red" isText />
          </div>

          <section className="servon-dashboard-orders">
            <div className="servon-dashboard-order-heading">
              <div className="servon-dashboard-order-title">
                <span className="servon-live-dot" />
                <h2>{localizeText("Live Orders", language)}</h2>
                <span className="servon-dashboard-order-count">{liveOrders.length}</span>
              </div>
              <div className="servon-dashboard-tools">
                {!isChefMode && <>
                  <button className="servon-dashboard-button quiet" disabled={generatingSummary} onClick={handleGenerateSummary}>
                    {generatingSummary ? <ActivityIndicator size="small" color="#466052" /> : <Ionicons name="analytics-outline" size={17} color="#466052" />}
                    {localizeText("Generate Summary", language)}
                  </button>
                  <button className="servon-dashboard-button quiet" onClick={() => navigation.navigate("CustomerOutstanding")}>
                    <Ionicons name="wallet-outline" size={17} color="#466052" />
                    {localizeText("Customer Outstanding", language)}
                  </button>
                </>}
                <button className="servon-dashboard-button quiet" onClick={() => navigation.navigate("Orders")}>
                  {localizeText("View all", language)}<Ionicons name="arrow-forward" size={16} color="#466052" />
                </button>
              </div>
            </div>

            {liveOrders.length === 0 ? (
              <div className="servon-empty">
                <span className="servon-dashboard-empty-icon"><Ionicons name="receipt-outline" size={29} color="#41624D" /></span>
                <strong>{localizeText("No active orders right now", language)}</strong>
                <span>{localizeText("Scan a table QR or create an order to get started.", language)}</span>
              </div>
            ) : (
              <div className="servon-dashboard-order-grid">
                {liveOrders.map(order => <WebOrderCard key={order.id} order={order} onStatusUpdate={handleStatusUpdate} onAddItems={openAddItems} onBill={handleDashboardBill} onRemoveItem={handleRemoveOrderItem} />)}
              </div>
            )}
          </section>
        </main>

        {/* NOTIFICATION PANEL */}
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

        {showBusinessSummaryModal && businessSummary && typeof document !== "undefined" && ReactDOM.createPortal(
          <div className="servon-summary-overlay" onClick={() => setShowBusinessSummaryModal(false)}>
            <div className="servon-summary-modal" onClick={(e) => e.stopPropagation()}>
              <div className="servon-summary-header">
                <div>
                  <div className="servon-summary-title">{localizeText("AI Business Summary", language)}</div>
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
                ].filter(r => r.value);
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
                    {rows.map((r) => (
                      <div key={r.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 12px", background: "#F9FAFB", borderRadius: 10, border: "1px solid #F3F4F6" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0 }}>{localizeText(r.label, language)}</span>
                        <span style={{ fontSize: 13, color: "#111827", fontWeight: 500, textAlign: "right" }}>{localizeBusinessSummaryValue(r.value, language)}</span>
                      </div>
                    ))}
                    {Array.isArray(j.recommendations) && j.recommendations.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>{localizeText("Recommendations", language)}</div>
                        {j.recommendations.map((rec, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                            <Ionicons name="bulb-outline" size={14} color="#F59E0B" style={{ marginTop: 2 }} />
                            <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{localizeBusinessSummaryValue(rec, language)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {j.todaysFocus && (
                      <div style={{ marginTop: 8, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: "12px 14px" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#16A34A", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{localizeText("Today's Focus", language)}</div>
                        <div style={{ fontSize: 14, color: "#166534", fontWeight: 600, lineHeight: 1.5 }}>{localizeBusinessSummaryValue(j.todaysFocus, language)}</div>
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
      {/* SERVON FLOATING ACTIONS (web) */}
      <div className="servon-dashboard-mobile-actions">
          <button
            onClick={() => { setAppendOrder(null); setAssistantOpen("voice"); }}
            title={localizeText("Voice order", language)}
            aria-label={localizeText("Voice order", language)}
            style={{
              width: 48, height: 48, borderRadius: 12, border: "none", cursor: "pointer",
              background: "#426C51", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 14px rgba(32,51,42,0.14)",
            }}
          >
            <Ionicons name="mic" size={22} color="#fff" />
          </button>
          <button
            onClick={() => { setAppendOrder(null); setAssistantOpen("manual"); }}
            title={localizeText("Create Order", language)}
            style={{
              height: 48, padding: "0 18px", borderRadius: 12, border: "none", cursor: "pointer",
              background: "#244F3B", color: "#fff", display: "flex", alignItems: "center", gap: 6,
              fontWeight: 700, fontSize: 14, boxShadow: "0 6px 18px rgba(0,0,0,0.2)",
            }}
          >
            <Ionicons name="add" size={22} color="#fff" />
            {localizeText("Create Order", language)}
          </button>
        </div>

        <ServonAssistantModal
          visible={assistantOpen !== null}
          initialMode={assistantOpen || "manual"}
          appendOrder={appendOrder}
          onOrderSaved={handleOrderSaved}
          onClose={handleAssistantClose}
        />
      </div>
    );
  }
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + 15 }]}>
        <View style={styles.headerInner}>
          <LocalizedText translate={false} style={styles.brandText} numberOfLines={1}>{businessName}</LocalizedText>
          <View style={styles.headerActions}>
            <TouchableOpacity accessibilityLabel={localizeText("Notifications", language)} style={styles.iconBtn} onPress={handleOpenNotifications}>
              <Ionicons name="notifications-outline" size={24} color="#374151" />
              {totalUnread > 0 && (
                <View style={styles.badge}>
                  <LocalizedText style={styles.badgeText}>{totalUnread > 9 ? "9+" : totalUnread}</LocalizedText>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={localizeText("Menu", language)} accessibilityState={{ expanded: showProfileMenu }} style={styles.profileAvatar} onPress={() => setShowProfileMenu(true)}>
              <LocalizedText style={styles.profileAvatarText}>Menu</LocalizedText>
              <Ionicons name="chevron-down" size={14} color="#42604E" />
              {lowStockCount > 0 && (
                <View style={styles.profileAvatarBadge}>
                  <LocalizedText style={styles.profileAvatarBadgeText}>{lowStockCount > 9 ? "9+" : lowStockCount}</LocalizedText>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {trialToast && isFocused && (
        <View style={[styles.trialToastWrap, { top: insets.top + 62 }]} pointerEvents="box-none">
          <View style={styles.trialToast}>
            <View style={styles.trialToastIcon}>
              <Ionicons name="time-outline" size={16} color="#fff" />
            </View>
            <LocalizedText style={styles.trialToastText}>{trialToast.message}</LocalizedText>
            <TouchableOpacity
              style={styles.trialToastBtn}
              onPress={() => { setTrialToast(null); navigation.navigate("Profile"); }}
            >
              <LocalizedText translate style={styles.trialToastBtnText}>Subscribe</LocalizedText>
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
          <View style={styles.dashboardHeading}>
            <View style={{ flex: 1 }}>
              <LocalizedText translate={false} style={styles.dashboardDate}>{todayStr}</LocalizedText>
              <LocalizedText style={styles.dashboardTitle}>Dashboard</LocalizedText>
              <LocalizedText style={styles.dashboardGreeting}>{`Good ${getGreeting()}`}</LocalizedText>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={localizeText("Refresh", language)} style={styles.refreshButton} disabled={refreshing} onPress={() => { setRefreshing(true); loadData(); }}>
              {refreshing ? <ActivityIndicator size="small" color="#42604E" /> : <Ionicons name="refresh-outline" size={20} color="#42604E" />}
            </TouchableOpacity>
          </View>
          <SubscriptionBanner compact />

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

          {!isChefMode && (
            <View style={styles.quickActionsRow}>
              <TouchableOpacity
                style={styles.dashboardShortcut}
                onPress={handleGenerateSummary}
                disabled={generatingSummary}
              >
                {generatingSummary ? (
                  <ActivityIndicator size="small" color="#42604E" />
                ) : (
                  <Ionicons name="analytics-outline" size={18} color="#42604E" />
                )}
                <LocalizedText translate style={styles.dashboardShortcutText}>
                  Generate Summary
                </LocalizedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dashboardShortcut}
                onPress={() => navigation.navigate("CustomerOutstanding")}
              >
                <Ionicons name="wallet-outline" size={18} color="#42604E" />
                <LocalizedText translate style={styles.dashboardShortcutText}>
                  Customer Outstanding
                </LocalizedText>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.liveDot} />
              <LocalizedText translate style={styles.sectionTitle}>Live Orders</LocalizedText>
              <View style={styles.countBadge}><LocalizedText style={styles.countBadgeText}>{liveOrders.length}</LocalizedText></View>
              <TouchableOpacity style={styles.viewAllButton} onPress={() => navigation.navigate("Orders")}>
                <LocalizedText style={styles.viewAllText}>View all</LocalizedText>
                <Ionicons name="arrow-forward" size={16} color="#42604E" />
              </TouchableOpacity>
            </View>

            {liveOrders.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconCircle}><Ionicons name="restaurant-outline" size={32} color="#9CA3AF" /></View>
                <LocalizedText translate style={styles.emptyText}>No active orders right now</LocalizedText>
                <LocalizedText translate style={styles.emptySubText}>Scan a table QR or create an order to get started.</LocalizedText>
              </View>
            ) : (
              liveOrders.map(order => <OrderCard key={order.id} order={order} onStatusUpdate={handleStatusUpdate} onAddItems={openAddItems} onBill={handleDashboardBill} onRemoveItem={handleRemoveOrderItem} />)
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
                <LocalizedText translate style={styles.modalTitleText}>Notifications</LocalizedText>
                {totalUnread > 0 && <LocalizedText style={styles.modalSubtitleText}>{totalUnread} unread</LocalizedText>}
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
                  <LocalizedText translate style={styles.emptyNotif}>No notifications yet</LocalizedText>
                  <LocalizedText translate style={styles.emptyNotifSub}>You'll see updates here as they come in</LocalizedText>
                </View>
              ) : (
                <>
                  {notifications.length > 0 && (() => {
                    const { recent, older } = splitNotificationGroups(groupNotificationsByDay(notifications));
                    const renderGroup = (group) => (
                      <View key={group.label}>
                        <LocalizedText style={styles.notifDayHeader}>{group.label}</LocalizedText>
                        {group.items.map((n, index) => (
                          <View key={n.id || index} style={[styles.notifItemModern, !n.is_read && styles.notifItemModernUnread]}>
                            <View style={[styles.notifIconCircle, !n.is_read && styles.notifIconCircleUnread]}>
                              {getNotifIcon(n.title, true)}
                            </View>
                            <View style={styles.notifItemBody}>
                              <View style={styles.notifTopRow}>
                                <View style={styles.notifTitleRow}>
                                  {!n.is_read && <View style={styles.notifUnreadDot} />}
                                  <LocalizedText style={styles.notifTitleModern} numberOfLines={1}>{n.title || "New Order"}</LocalizedText>
                                </View>
                                <LocalizedText style={styles.notifTimeModern}>
                                  {new Date(n.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </LocalizedText>
                              </View>
                              <LocalizedText style={styles.notifMessageModern}>{n.message}</LocalizedText>
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
                              <LocalizedText translate style={styles.loadMoreBtnText}>Load older notifications</LocalizedText>
                            </TouchableOpacity>
                          )
                        )}
                      </>
                    );
                  })()}

                  {trialNotifications.length > 0 && (
                    <View>
                      <LocalizedText translate style={styles.notifDayHeader}>Trial Reminders</LocalizedText>
                      {trialNotifications.map((n) => (
                        <View key={`trial-${n.id}`} style={[styles.notifItemModern, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                          <View style={[styles.notifIconCircle, { backgroundColor: '#DBEAFE' }]}>
                            <Ionicons name="time-outline" size={18} color="#3B82F6" />
                          </View>
                          <View style={styles.notifItemBody}>
                            <View style={styles.notifTopRow}>
                              <LocalizedText style={styles.notifTitleModern} numberOfLines={1}>{n.title}</LocalizedText>
                              <LocalizedText style={styles.notifTimeModern}>
                                {new Date(n.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </LocalizedText>
                            </View>
                            <LocalizedText style={styles.notifMessageModern}>{n.message}</LocalizedText>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {aiAlerts.length > 0 && (
                    <View>
                      <LocalizedText translate style={styles.notifDayHeader}>AI Alerts</LocalizedText>
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
                                <LocalizedText style={styles.notifTitleModern} numberOfLines={1}>{a.title}</LocalizedText>
                              </View>
                              <LocalizedText style={styles.notifTimeModern}>
                                {new Date(a.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </LocalizedText>
                            </View>
                            <LocalizedText style={styles.notifMessageModern}>{a.message}</LocalizedText>
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

      {/* PROFILE DROPDOWN MENU (native) */}
      <Modal visible={showProfileMenu} transparent animationType="fade" onRequestClose={() => setShowProfileMenu(false)}>
        <TouchableOpacity style={styles.profileMenuOverlay} activeOpacity={1} onPress={() => setShowProfileMenu(false)}>
          <View style={[styles.profileMenuBox, { top: insets.top + 60, maxHeight: '80%' }]}>
            <ScrollView bounces={false}>
            {profileMenuItems.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.profileMenuItem}
                onPress={() => handleProfileMenuNavigate(item.key)}
              >
                <View style={styles.profileMenuIcon}>
                  <Ionicons name={item.icon} size={16} color={item.iconColor} />
                </View>
                <LocalizedText style={styles.profileMenuLabel}>{item.label}</LocalizedText>
                {!!item.badge && item.badge > 0 && (
                  <View style={styles.profileMenuBadge}>
                    <LocalizedText style={styles.profileMenuBadgeText}>{item.badge > 9 ? "9+" : item.badge}</LocalizedText>
                  </View>
                )}
              </TouchableOpacity>
            ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* AI BUSINESS SUMMARY MODAL (native) */}
      <Modal visible={showBusinessSummaryModal} transparent animationType="fade">
        <View style={styles.summaryModalOverlay}>
          <View style={styles.summaryModal}>
            <View style={styles.summaryModalHeader}>
              <LocalizedText translate style={styles.summaryModalTitle}>AI Business Summary</LocalizedText>
              <TouchableOpacity onPress={() => setShowBusinessSummaryModal(false)}>
                <Ionicons name="close-circle" size={28} color="#D1D5DB" />
              </TouchableOpacity>
            </View>
            {businessSummary && (
              <>
                <LocalizedText style={styles.summaryModalDate}>
                  {businessSummary.summary_date} · Hour {businessSummary.summary_hour}:00
                </LocalizedText>
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
                  ].filter(r => r.value);
                  return (
                    <ScrollView style={{ maxHeight: 320 }}>
                      {rows.map((r) => (
                        <View key={r.label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, padding: 10, backgroundColor: "#F9FAFB", borderRadius: 10, borderWidth: 1, borderColor: "#F3F4F6", marginBottom: 8 }}>
                          <LocalizedText style={{ fontSize: 11, fontWeight: "600", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.4, flexShrink: 0 }}>{r.label}</LocalizedText>
                          <LocalizedText style={{ fontSize: 13, color: "#111827", fontWeight: "500", textAlign: "right", flexShrink: 1 }}>{localizeBusinessSummaryValue(r.value, language)}</LocalizedText>
                        </View>
                      ))}
                      {Array.isArray(j.recommendations) && j.recommendations.length > 0 && (
                        <View style={{ marginTop: 4 }}>
                          <LocalizedText translate style={{ fontSize: 11, fontWeight: "700", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Recommendations</LocalizedText>
                          {j.recommendations.map((rec, i) => (
                            <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                              <Ionicons name="bulb-outline" size={14} color="#F59E0B" style={{ marginTop: 2 }} />
                              <LocalizedText style={{ fontSize: 13, color: "#374151", lineHeight: 18, flex: 1 }}>{localizeBusinessSummaryValue(rec, language)}</LocalizedText>
                            </View>
                          ))}
                        </View>
                      )}
                      {j.todaysFocus && (
                        <View style={{ marginTop: 8, backgroundColor: "#F0FDF4", borderWidth: 1, borderColor: "#BBF7D0", borderRadius: 12, padding: 12 }}>
                          <LocalizedText translate style={{ fontSize: 11, fontWeight: "700", color: "#16A34A", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Today's Focus</LocalizedText>
                          <LocalizedText style={{ fontSize: 14, color: "#166534", fontWeight: "600", lineHeight: 20 }}>{localizeBusinessSummaryValue(j.todaysFocus, language)}</LocalizedText>
                        </View>
                      )}
                    </ScrollView>
                  );
                })()}
                <TouchableOpacity style={styles.summaryModalBtn} onPress={() => setShowBusinessSummaryModal(false)}>
                  <LocalizedText translate style={styles.summaryModalBtnText}>Close</LocalizedText>
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
              <LocalizedText style={[styles.trialToastText, { fontWeight: "700", marginBottom: 2 }]}>{alertToast.title}</LocalizedText>
              <LocalizedText style={styles.trialToastText}>{alertToast.message}</LocalizedText>
            </View>
            <TouchableOpacity style={styles.trialToastClose} onPress={() => setAlertToast(null)}>
              <Ionicons name="close" size={15} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* SERVON FLOATING ACTIONS (native) */}
      <View style={styles.servonFabWrap} pointerEvents="box-none">
        <TouchableOpacity accessibilityLabel={localizeText("Voice order", language)} style={styles.servonMicFab} onPress={() => { setAppendOrder(null); setAssistantOpen("voice"); }}>
          <Ionicons name="mic" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.servonCreateFab} onPress={() => { setAppendOrder(null); setAssistantOpen("manual"); }}>
          <Ionicons name="add" size={26} color="#fff" />
          <LocalizedText translate style={styles.servonCreateLabel}>Create Order</LocalizedText>
        </TouchableOpacity>
      </View>

      <ServonAssistantModal
        visible={assistantOpen !== null}
        initialMode={assistantOpen || "manual"}
        appendOrder={appendOrder}
        onOrderSaved={handleOrderSaved}
        onClose={handleAssistantClose}
      />
    </View>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

function WebStatCard({ label, value, icon, color, bg, isText, language }) {
  return (
    <div className="servon-stat-card">
      <div className="servon-stat-top">
        <div className="servon-stat-label">{localizeText(label, language)}</div>
        <div className="servon-stat-icon" style={{ background: bg }}><Ionicons name={icon} size={17} color={color} /></div>
      </div>
      <div className="servon-stat-value" style={isText ? { fontSize: 23, letterSpacing: '-.5px' } : undefined} title={String(value)}>{value}</div>
    </div>
  );
}

function orderTimeLabel(createdAt, language) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt)) / 60000));
  return !Number.isFinite(minutes) || minutes < 1
    ? localizeText("Just now", language)
    : localizeText("{count} min ago", language, { count: minutes });
}

function orderStatusLabel(status) {
  return ({ EDITABLE: "Draft", CONFIRMED: "Confirmed", PREPARING: "Preparing", SERVED: "Served", REJECTED: "Rejected" })[status] || status;
}

function WebOrderCard({ order, onAddItems, onBill, onRemoveItem }) {
  const { language } = useLocale();
  const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || "[]");
  const color = statusColor(order.status);
  return (
    <article className="servon-order-card">
      <header className="servon-order-heading">
        <div className="servon-order-table">
          <span className="servon-order-table-icon"><Ionicons name="grid-outline" size={20} color="#42604E" /></span>
          <div>
            <strong>{localizeText("Table {number}", language, { number: order.table_number || "?" })}</strong>
            <span className="servon-order-time"><Ionicons name="time-outline" size={13} color="#6B786F" />{orderTimeLabel(order.created_at, language)}</span>
          </div>
        </div>
        <span className="servon-order-status" style={{ background: `${color}12`, color }}><i />{localizeText(orderStatusLabel(order.status), language)}</span>
      </header>
      <div className="servon-order-items">
        {items.map((item, i) => (
          <div key={i} className="servon-order-item">
            <span className="servon-order-quantity">{item.quantity}×</span>
            <span className="servon-order-name">{localizedItemName(item, language)}</span>
            <button className="servon-order-remove" onClick={() => onRemoveItem?.(order, item)} title={localizeText("Remove item", language)} aria-label={`${localizeText("Remove item", language)}: ${localizedItemName(item, language)}`}>
              <Ionicons name="trash-outline" size={16} color="#AB5C52" />
            </button>
          </div>
        ))}
      </div>
      {order.special_instructions && <div className="servon-order-note"><Ionicons name="information-circle-outline" size={17} color="#996A22" /><span>{order.special_instructions}</span></div>}
      <footer className="servon-order-footer">
        <div className="servon-order-total"><span>{localizeText("Total Amount", language)}</span><strong>₹{order.total_amount}</strong></div>
        <div className="servon-order-buttons">
          <button className="servon-dashboard-button" onClick={() => onBill?.(order)}><Ionicons name="receipt-outline" size={17} color="#344E3E" />{localizeText("Bill", language)}</button>
          <button className="servon-dashboard-button primary" onClick={() => onAddItems?.(order)}><Ionicons name="add" size={18} color="#fff" />{localizeText("Add Items", language)}</button>
        </div>
      </footer>
    </article>
  );
}

function StatCard({ label, value, icon, color, bg, isText, extraStyle }) {
  return (
    <View style={[styles.statCard, extraStyle]}>
      <View style={styles.statTop}>
        <LocalizedText style={styles.statLabel}>{label}</LocalizedText>
        <View style={[styles.iconContainer, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={17} color={color} />
        </View>
      </View>
        <LocalizedText translate={false} style={[styles.statValue, isText && { fontSize: 20, fontWeight: "600" }]} numberOfLines={isText ? 2 : 1} adjustsFontSizeToFit>
          {value}
        </LocalizedText>
    </View>
  );
}

function OrderCard({ order, onStatusUpdate, onAddItems, onBill, onRemoveItem }) {
  const { language } = useLocale();
  const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || "[]");

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.orderTableGroup}>
          <View style={styles.tableIndicator}><Ionicons name="grid-outline" size={21} color="#42604E" /></View>
          <View>
            <LocalizedText style={styles.orderTable} values={{ number: order.table_number || "?" }}>{"Table {number}"}</LocalizedText>
            <LocalizedText translate={false} style={styles.orderTime}>{orderTimeLabel(order.created_at, language)}</LocalizedText>
          </View>
        </View>
        <View style={[styles.statusPill, { backgroundColor: `${statusColor(order.status)}15` }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor(order.status) }]} />
          <LocalizedText style={[styles.statusText, { color: statusColor(order.status) }]}>{orderStatusLabel(order.status)}</LocalizedText>
        </View>
      </View>
      <View style={styles.divider} />
      {items.map((item, i) => (
        <View key={i} style={styles.orderItemRow}>
          <View style={styles.qtyBadge}><LocalizedText style={styles.qtyText}>{item.quantity}x</LocalizedText></View>
          <LocalizedText translate={false} style={styles.orderItemName}>{localizedItemName(item, language)}</LocalizedText>
          <TouchableOpacity accessibilityLabel={`${localizeText("Remove item", language)}: ${localizedItemName(item, language)}`} style={styles.itemTrashBtn} onPress={() => onRemoveItem?.(order, item)} activeOpacity={0.75}>
            <Ionicons name="trash-outline" size={16} color="#AB5C52" />
          </TouchableOpacity>
        </View>
      ))}
      {order.special_instructions && (
        <View style={styles.noteBox}>
          <Ionicons name="information-circle" size={16} color="#F59E0B" />
          <LocalizedText style={styles.orderNote}>{order.special_instructions}</LocalizedText>
        </View>
      )}
      <View style={styles.divider} />
      <View style={styles.orderFooter}>
        <LocalizedText translate style={styles.orderTotalLabel}>Total Amount</LocalizedText>
        <LocalizedText style={styles.orderTotalValue}>₹{order.total_amount}</LocalizedText>
      </View>
      <View style={styles.orderActionRow}>
        <TouchableOpacity style={styles.billBtn} onPress={() => onBill?.(order)}>
          <Ionicons name="receipt-outline" size={16} color="#111827" />
          <LocalizedText translate style={styles.billBtnText}>Bill</LocalizedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addItemsBtn} onPress={() => onAddItems?.(order)}>
          <Ionicons name="add" size={16} color="#fff" />
          <LocalizedText translate style={styles.addItemsBtnText}>Add Items</LocalizedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const statusColor = (s) => ({
  EDITABLE: "#56645A",
  CONFIRMED: "#315F9E",
  PREPARING: "#8A5A15",
  SERVED: "#28704C",
  REJECTED: "#AB443A",
}[s] || "#6B7280");

// ─── STYLES ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F5F2' },
  servonFabWrap: { position: 'absolute', right: 16, bottom: 18, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 90 },
  servonMicFab: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: '#426C51',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#20332A', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  servonCreateFab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#244F3B', borderRadius: 12, paddingHorizontal: 18, height: 48,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  servonCreateLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#DFE5DF',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandText: { flex: 1, marginRight: 12, fontSize: 18, fontWeight: '700', color: '#20332A', letterSpacing: -0.5 },
  brandAccent: { color: '#22C55E' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { padding: 10, position: 'relative', minWidth: 44, minHeight: 44 },
  badge: {
    position: 'absolute', top: 2, right: 2,
    backgroundColor: '#EF4444', borderRadius: 10,
    minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700', paddingHorizontal: 4 },
  profileAvatar: { minHeight: 44, paddingHorizontal: 12, gap: 7, flexDirection: 'row', borderRadius: 9, backgroundColor: '#EDF2EE', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  profileAvatarText: { color: '#344E3E', fontSize: 14, fontWeight: '600' },
  profileAvatarBadge: {
    position: 'absolute', top: -3, right: -3,
    backgroundColor: '#EF4444', borderRadius: 9,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff', paddingHorizontal: 2,
  },
  profileAvatarBadgeText: { color: '#fff', fontSize: 8.5, fontWeight: '700' },

  profileMenuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  profileMenuBox: {
    position: 'absolute', right: 16,
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#EAE6E0',
    width: 270, paddingVertical: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 12,
  },
  profileMenuItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12 },
  profileMenuIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  profileMenuLabel: { flex: 1, fontSize: 13.5, fontWeight: '600', color: '#374151' },
  profileMenuBadge: { backgroundColor: '#EF4444', borderRadius: 10, minWidth: 18, height: 18, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  profileMenuBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  responsiveContent: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 110, alignSelf: 'center', width: '100%' },
  dashboardHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  dashboardDate: { fontSize: 12, color: '#627166', marginBottom: 5 },
  dashboardTitle: { fontSize: 27, fontWeight: '700', color: '#20332A', letterSpacing: -0.7 },
  dashboardGreeting: { fontSize: 14, color: '#627166', marginTop: 4 },
  refreshButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#DFE5DF', borderRadius: 9 },
  dashboardShortcut: { flex: 1, minWidth: '42%', minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 10, borderWidth: 1, borderColor: '#DFE5DF', borderRadius: 8, backgroundColor: '#FAFCF8' },
  dashboardShortcutText: { flexShrink: 1, fontSize: 12, fontWeight: '600', color: '#42604E' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#43855A' },
  viewAllButton: { marginLeft: 'auto', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 10 },
  viewAllText: { color: '#42604E', fontSize: 12, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18, marginBottom: 16 },
  statsGridSmall: { gap: 12 },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#DFE5DF',
    borderRadius: 12, padding: 15, gap: 12,
  },
  statTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5 },
  iconContainer: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 28, fontWeight: '700', color: '#20332A', letterSpacing: -0.6 },
  statLabel: { flex: 1, fontSize: 13, fontWeight: '500', color: '#54655A' },
  section: { marginTop: 18, borderTopWidth: 1, borderTopColor: '#DDE4DC', paddingTop: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 19, fontWeight: '700', color: '#20332A' },
  countBadge: { backgroundColor: '#E2EBDF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  countBadgeText: { color: '#365A42', fontSize: 12, fontWeight: '700' },
  emptyCard: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#DFE5DF',
    borderRadius: 12, padding: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  emptySubText: { fontSize: 13, color: '#627166', marginTop: 8, lineHeight: 20, textAlign: 'center' },
  orderCard: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#DFE5DF',
    borderRadius: 12, padding: 16, marginBottom: 14,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  orderTableGroup: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  tableIndicator: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F4ED', borderWidth: 1, borderColor: '#D8E2D5', borderRadius: 9 },
  orderTable: { fontSize: 18, fontWeight: '700', color: '#20332A' },
  orderTime: { fontSize: 12, color: '#6B786F', marginTop: 3 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 10 },
  orderItemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  itemTrashBtn: { width: 44, height: 44, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  qtyBadge: { backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  qtyText: { fontSize: 11, fontWeight: '700', color: '#374151' },
  orderItemName: { flex: 1, fontSize: 15, fontWeight: '500', color: '#283B30', lineHeight: 22 },
  noteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#FFFBEB', borderRadius: 8, padding: 8, marginTop: 4 },
  orderNote: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderTotalLabel: { fontSize: 12, color: '#9CA3AF' },
  orderTotalValue: { fontSize: 17, fontWeight: '800', color: '#111827' },
  orderActionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  billBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  billBtnText: { color: '#111827', fontSize: 13, fontWeight: '800' },
  addItemsBtn: { flex: 1, minHeight: 46, borderRadius: 8, backgroundColor: '#244F3B', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addItemsBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 20, paddingHorizontal: 20, maxHeight: '80%',
  },
  modalHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitleText: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalSubtitleText: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  notifList: { paddingBottom: 24 },
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
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  advisorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 7,
    marginTop: 8,
    alignSelf: 'center',
    minHeight: 42,
    flexShrink: 1,
  },
  advisorBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

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
