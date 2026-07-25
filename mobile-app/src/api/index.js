import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  "https://servon.onrender.com";

// Main Production API (Render)
const API = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 15000,
});

// Local backend ONLY for AI Advisor
const AdvisorAPI = axios.create({
  baseURL: "http://10.124.125.38:5000/api",
  timeout: 15000,
});

// Helper function to get business ID from storage
const getBusinessId = async () => {
  try {
    const business = await AsyncStorage.getItem("business");
    if (business) {
      const parsed = JSON.parse(business);
      return parsed.id;
    }
    return null;
  } catch (error) {
    console.error("Error getting business ID:", error);
    return null;
  }
};

// -------------------- REQUEST INTERCEPTORS --------------------

const attachToken = async (config) => {
  const token = await AsyncStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
};

API.interceptors.request.use(
  attachToken,
  (error) => Promise.reject(error)
);

AdvisorAPI.interceptors.request.use(
  attachToken,
  (error) => Promise.reject(error)
);

// -------------------- RESPONSE INTERCEPTORS --------------------

const handle401 = async (error) => {
  if (error.response?.status === 401) {
    await AsyncStorage.multiRemove(["token", "business"]);

    // Don't reload the browser.
    return Promise.reject(error);
  }

  return Promise.reject(error);
};

API.interceptors.response.use(
  (response) => response,
  handle401
);

AdvisorAPI.interceptors.response.use(
  (response) => response,
  handle401
);

// -------------------- AUTH --------------------

export const signup = (data) => API.post("/auth/signup", data);

export const login = (data) => API.post("/auth/login", data);

export const getMe = () => API.get("/auth/me");

export const sendOTP = (email) =>
  API.post("/auth/forgot-password/send-otp", { email });

export const verifyOTP = (email, otp) =>
  API.post("/auth/forgot-password/verify-otp", { email, otp });

export const resetPassword = (resetToken, newPassword) =>
  API.post("/auth/forgot-password/reset", {
    resetToken,
    newPassword,
  });

// -------------------- SUBSCRIPTION --------------------

export const createPaymentOrder = () =>
  API.post("/subscription/create-order");

export const verifyPayment = (data) =>
  API.post("/subscription/verify-payment", data);

export const getSubscriptionDetails = () =>
  API.get("/subscription/details");

// -------------------- REFERRALS --------------------

export const getReferrals = () => API.get("/referrals");

export const redeemReferrals = () =>
  API.post("/referrals/redeem");

export const getReferralStats = () =>
  API.get("/referrals/stats");

export const redeemReferralReward = () =>
  API.post("/referrals/redeem");

// -------------------- MENU --------------------

export const getMenu = () => API.get("/menu");

export const addMenuItem = (formData) =>
  API.post("/menu", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

export const updateMenuItem = (id, formData) =>
  API.put(`/menu/${id}`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

export const toggleMenuItemAvailability = (id) =>
  API.patch(`/menu/${id}/availability`);

export const deleteMenuItem = (id) =>
  API.delete(`/menu/${id}`);

// -------------------- TABLES --------------------

export const getTables = () =>
  API.get("/tables");

export const addTable = (tableNumber) =>
  API.post("/tables", { tableNumber });

export const deleteTable = (id) =>
  API.delete(`/tables/${id}`);

export const getQRPdfUrl = (id) =>
  `${API.defaults.baseURL}/tables/${id}/qr-pdf`;

// -------------------- ORDERS --------------------

export const getOrders = () =>
  API.get("/orders");

export const updateOrderStatus = (id, status) =>
  API.patch(`/orders/${id}/status`, { status });

// Kept both named exports to support older & newer components
export const getNotifications = () =>
  API.get("/orders/notifications");

export const getOrdersNotifications = () =>
  API.get("/orders/notifications");

export const markNotificationRead = (id) =>
  API.patch(`/orders/notifications/${id}/read`);

export const markOrderNotificationRead = (id) =>
  API.patch(`/orders/notifications/${id}/read`);

export const markAllNotificationsRead = () =>
  API.patch("/orders/notifications/read-all");

// -------------------- ANALYTICS --------------------

export const getAnalytics = () =>
  API.get("/analytics");

export const getDailySummary = () =>
  API.get("/analytics/daily-summary");

export const getNextInsight = () =>
  API.get("/analytics/next-insight");

// -------------------- SALES --------------------

export const getSalesCSVUrl = (startDate, endDate) =>
  `${API.defaults.baseURL}/sales/csv?startDate=${startDate}&endDate=${endDate}`;

export const getSalesPDFUrl = (startDate, endDate) =>
  `${API.defaults.baseURL}/sales/pdf?startDate=${startDate}&endDate=${endDate}`;

// -------------------- PROFILE --------------------

export const getProfile = () =>
  API.get("/profile");

export const updateProfile = (formData) =>
  API.put("/profile", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

export const uploadLogo = (formData) =>
  API.post("/profile/upload-logo", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

// -------------------- REVIEWS --------------------

export const getReviews = () =>
  API.get("/reviews");

// -------------------- SECURITY --------------------

export const setAdminPin = (pin) =>
  API.patch("/profile/pin", { pin });

export const verifyAdminPin = (pin) =>
  API.post("/profile/verify-pin", { pin });

// -------------------- EXPENSES --------------------

export const getExpenses = (period = "monthly") =>
  API.get(`/expenses?period=${period}`);

export const addExpense = (formData) =>
  API.post("/expenses", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

export const deleteExpense = (id) =>
  API.delete(`/expenses/${id}`);

export const updateExpense = (id, formData) =>
  API.put(`/expenses/${id}`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

// ==========================================================
// AI BUSINESS ADVISOR
// ==========================================================

export const askAdvisor = (question) =>
  AdvisorAPI.post("/advisor/ask", { question });

export const getAdvisorInsights = () =>
  AdvisorAPI.get("/advisor/insights");

export const getAdvisorConversations = () =>
  AdvisorAPI.get("/advisor/conversations");

export const deleteConversation = (id) =>
  AdvisorAPI.delete(`/advisor/conversations/${id}`);

export const clearAllConversations = () =>
  AdvisorAPI.delete("/advisor/conversations");

// ==========================================================
// ✅ TRIAL & NOTIFICATION API FUNCTIONS (ADDED FROM INTERN FILE)
// ==========================================================

export const getTrialStatus = async () => {
  try {
    const businessId = await getBusinessId();
    if (!businessId) {
      return { success: false, error: "Business ID not found" };
    }
    const response = await API.get(`/trial/status?businessId=${businessId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching trial status:", error);
    return { success: false, error: error.message };
  }
};

export const checkAccess = async (businessId) => {
  try {
    if (!businessId) {
      return { success: false, error: "Business ID not found" };
    }
    const response = await API.get(`/trial/access?businessId=${businessId}`);
    return response.data;
  } catch (error) {
    console.error("Error checking access:", error);
    return { success: false, error: error.message };
  }
};

export const getTrialNotifications = async (businessId) => {
  try {
    if (!businessId) {
      return {
        success: false,
        error: "Business ID not found",
        data: { notifications: [], unreadCount: 0 },
      };
    }
    const response = await API.get(`/trial/notifications?businessId=${businessId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return {
      success: false,
      error: error.message,
      data: { notifications: [], unreadCount: 0 },
    };
  }
};

export const markTrialNotificationRead = async (notificationId) => {
  try {
    const response = await API.put(`/trial/notifications/${notificationId}/read`);
    return response.data;
  } catch (error) {
    console.error("Error marking as read:", error);
    return { success: false, error: error.message };
  }
};

export const createMobilePaymentOrder = async (planType) => {
  try {
    const response = await API.post("/subscription/create-order");
    return response.data;
  } catch (error) {
    console.error("Error creating order:", error);
    return { error: error.message };
  }
};

export const startFreeTrial = async () => {
  try {
    const response = await API.post("/subscription/start-trial");
    return response.data;
  } catch (error) {
    console.error("Error starting trial:", error);
    return { success: false, error: error.message };
  }
};

export default API;