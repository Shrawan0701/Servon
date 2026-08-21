// src/api/index.js

import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// ─── CONFIGURATION ───────────────────────────────────────────────────────────

// Use environment variable with fallback for production
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  "http://10.198.185.12:5000";

// Local backend ONLY for AI Advisor (can be configured separately)
export const ADVISOR_API_BASE_URL = 
  process.env.EXPO_PUBLIC_ADVISOR_API_URL ||
  "https://servon.onrender.com/api";

// ─── API INSTANCES ───────────────────────────────────────────────────────────

// Main API (Regular Users)
const API = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 120000,
});

// ✅ Admin API (Admin Panel)
const AdminAPI = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 120000,
});

// AI Advisor API
const AdvisorAPI = axios.create({
  baseURL: ADVISOR_API_BASE_URL,
  timeout: 120000,
});

// ─── HELPER FUNCTIONS ───────────────────────────────────────────────────────

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

// ─── REQUEST INTERCEPTORS ──────────────────────────────────────────────────

// Main API Interceptor
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

// ✅ Admin API Interceptor
AdminAPI.interceptors.request.use(
  async (config) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const adminToken = localStorage.getItem('adminToken');
      if (adminToken) {
        config.headers.Authorization = `Bearer ${adminToken}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Advisor API Interceptor
AdvisorAPI.interceptors.request.use(
  attachToken,
  (error) => Promise.reject(error)
);

// ─── RESPONSE INTERCEPTORS ──────────────────────────────────────────────────

const handle401 = async (error) => {
  if (error.response?.status === 401) {
    await AsyncStorage.multiRemove(["token", "business"]);
    return Promise.reject(error);
  }
  return Promise.reject(error);
};

API.interceptors.response.use(
  (response) => response,
  handle401
);

// ✅ Admin API Response Interceptor
AdminAPI.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminData');
      }
    }
    return Promise.reject(error);
  }
);

AdvisorAPI.interceptors.response.use(
  (response) => response,
  handle401
);

// ==========================================================
// AUTH
// ==========================================================

export const signup = (data) => API.post("/auth/signup", data);
export const login = (data) => API.post("/auth/login", data);
export const getMe = () => API.get("/auth/me");
export const sendOTP = (email) => API.post("/auth/forgot-password/send-otp", { email });
export const verifyOTP = (email, otp) => API.post("/auth/forgot-password/verify-otp", { email, otp });
export const resetPassword = (resetToken, newPassword) =>
  API.post("/auth/forgot-password/reset", { resetToken, newPassword });

// ==========================================================
// INVENTORY
// ==========================================================

export const getInventory = () => API.get("/inventory");
export const getInventoryAlertsCount = () => API.get("/inventory/alerts/count");
export const addInventoryItem = (data) => API.post("/inventory", data);
export const updateInventoryItem = (id, data) => API.put(`/inventory/${id}`, data);
export const restockInventoryItem = (id, amount) => API.patch(`/inventory/${id}/restock`, { amount });
export const adjustInventoryItem = (id, new_stock) => API.patch(`/inventory/${id}/adjust`, { new_stock });
export const deleteInventoryItem = (id) => API.delete(`/inventory/${id}`);

// Recipe Management
export const getMenuRecipes = () => API.get("/inventory/recipes");
export const getRecipeForItem = (menuItemId) => API.get(`/inventory/recipes/${menuItemId}`);
export const setRecipeForItem = (menuItemId, ingredients) => 
  API.put(`/inventory/recipes/${menuItemId}`, { ingredients });

// ==========================================================
// SUBSCRIPTION
// ==========================================================

export const createPaymentOrder = (planType = 'monthly') =>
  API.post("/subscription/create-order", { planType });
export const verifyPayment = (data) => API.post("/subscription/verify-payment", data);
export const getPlans = () => API.get("/subscription/plans");
export const getSubscriptionDetails = () => API.get("/subscription/details");
export const createMobilePaymentOrder = async (planType) => {
  try {
    const response = await API.post("/subscription/create-order");
    return response.data;
  } catch (error) {
    console.error("Error creating order:", error);
    return { error: error.message };
  }
};

// ==========================================================
// REFERRALS
// ==========================================================

export const getReferralStats = async () => {
  try {
    const response = await API.get("/referrals/stats");
    return response.data;
  } catch (error) {
    console.error("Error fetching referral stats:", error);
    throw error;
  }
};

export const redeemReferralReward = async () => {
  try {
    const response = await API.post("/referrals/redeem");
    return response.data;
  } catch (error) {
    console.error("Error redeeming reward:", error);
    throw error;
  }
};

export const getReferralHistory = async () => {
  try {
    const response = await API.get("/referrals/history");
    return response.data;
  } catch (error) {
    console.error("Error fetching referral history:", error);
    throw error;
  }
};

export const getReferralCode = async () => {
  try {
    const response = await API.get("/referrals/code");
    return response.data;
  } catch (error) {
    console.error("Error fetching referral code:", error);
    throw error;
  }
};

// ==========================================================
// MENU
// ==========================================================

export const getMenu = () => API.get("/menu");
export const addMenuItem = (formData) =>
  API.post("/menu", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const updateMenuItem = (id, formData) =>
  API.put(`/menu/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const toggleMenuItemAvailability = (id) => API.patch(`/menu/${id}/availability`);
export const deleteMenuItem = (id) => API.delete(`/menu/${id}`);

// ==========================================================
// TABLES
// ==========================================================

export const getTables = () => API.get("/tables");
export const addTable = (tableNumber) => API.post("/tables", { tableNumber });
export const deleteTable = (id) => API.delete(`/tables/${id}`);
export const getQRPdfUrl = (id) => `${API.defaults.baseURL}/tables/${id}/qr-pdf`;

// ==========================================================
// ORDERS
// ==========================================================

export const getOrders = () => API.get("/orders");
export const updateOrderStatus = (id, status) => API.patch(`/orders/${id}/status`, { status });

// Notifications with fallback support
export const getNotifications = async () => {
  try {
    const response = await API.get("/orders/notifications");
    if (!response.data || response.data.length === 0) {
      return await generateNotificationsFromOrders();
    }
    return response;
  } catch (error) {
    return await generateNotificationsFromOrders();
  }
};

// Alias for backward compatibility
export const getOrdersNotifications = () => API.get("/orders/notifications");

// Helper function to generate notifications from orders
const generateNotificationsFromOrders = async () => {
  try {
    const ordersResponse = await API.get("/orders");
    const orders = ordersResponse.data || [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const notifications = orders
      .filter(o => {
        const orderDate = new Date(o.created_at);
        return orderDate >= sevenDaysAgo;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 20)
      .map(o => {
        let title = 'Order Update';
        let message = `Order #${o.id} from Table ${o.table_number}`;
        
        switch(o.status) {
          case 'EDITABLE':
            title = 'New Order';
            message = `New order from Table ${o.table_number} - ₹${o.total_amount}`;
            break;
          case 'CONFIRMED':
            title = 'Order Confirmed';
            message = `Order from Table ${o.table_number} has been confirmed`;
            break;
          case 'PREPARING':
            title = 'Order Being Prepared';
            message = `Order for Table ${o.table_number} is being prepared`;
            break;
          case 'SERVED':
            title = 'Order Served';
            message = `Order for Table ${o.table_number} has been served`;
            break;
          case 'TABLE_ACTIVE':
            title = 'Table Active';
            message = `Table ${o.table_number} is now active`;
            break;
          case 'PAID':
            title = 'Payment Received';
            message = `Payment of ₹${o.total_amount} received from Table ${o.table_number}`;
            break;
          default:
            title = 'Order Update';
            message = `Order from Table ${o.table_number} - ₹${o.total_amount}`;
        }
        
        return {
          id: `order-${o.id}`,
          title: title,
          message: message,
          is_read: false,
          created_at: o.created_at,
          type: 'order',
          order_id: o.id,
          status: o.status
        };
      });
    
    return {
      data: notifications,
      status: 200,
      statusText: 'OK'
    };
  } catch (fallbackError) {
    return { data: [] };
  }
};

export const markAllNotificationsRead = async () => {
  try {
    const response = await API.patch("/orders/notifications/read-all");
    return response.data;
  } catch (error) {
    return { success: true };
  }
};

export const markOrderNotificationRead = async (id) => {
  try {
    const response = await API.patch(`/orders/notifications/${id}/read`);
    return response.data;
  } catch (error) {
    return { success: true };
  }
};

// Alias for markOrderNotificationRead
export const markNotificationRead = markOrderNotificationRead;

// ==========================================================
// ANALYTICS
// ==========================================================

export const getAnalytics = () => API.get("/analytics");
export const getDailySummary = () => API.get("/analytics/daily-summary");
export const getNextInsight = () => API.get("/analytics/next-insight");

// Business Summary & Alerts
export const getBusinessSummary = () => API.get("/analytics/business-summary/current");
export const generateBusinessSummary = () => API.post("/analytics/business-summary/generate");
export const getBusinessAlerts = (limit = 30) => API.get(`/analytics/alerts?limit=${limit}`);
export const markAlertRead = (id) => API.post(`/analytics/alerts/${id}/read`);
export const markAllAlertsRead = () => API.post("/analytics/alerts/read-all");

// ==========================================================
// SALES
// ==========================================================

export const getSalesCSVUrl = (startDate, endDate) =>
  `${API.defaults.baseURL}/sales/csv?startDate=${startDate}&endDate=${endDate}`;
export const getSalesPDFUrl = (startDate, endDate) =>
  `${API.defaults.baseURL}/sales/pdf?startDate=${startDate}&endDate=${endDate}`;

// ==========================================================
// PROFILE
// ==========================================================

export const getProfile = () => API.get("/profile");
export const updateProfile = (formData) =>
  API.put("/profile", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const uploadLogo = (formData) =>
  API.post("/profile/upload-logo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

// ==========================================================
// REVIEWS
// ==========================================================

export const getReviews = () => API.get("/reviews");

// ==========================================================
// SECURITY
// ==========================================================

export const setAdminPin = (pin) => API.patch("/profile/pin", { pin });
export const verifyAdminPin = (pin) => API.post("/profile/verify-pin", { pin });

// ==========================================================
// EXPENSES
// ==========================================================

export const getExpenses = (period = "monthly") => API.get(`/expenses?period=${period}`);
export const addExpense = (formData) =>
  API.post("/expenses", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const deleteExpense = (id) => API.delete(`/expenses/${id}`);
export const updateExpense = (id, formData) =>
  API.put(`/expenses/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

// ==========================================================
// AI BUSINESS ADVISOR
// ==========================================================

export const askAdvisor = (question) => AdvisorAPI.post("/advisor/ask", { question });

// Voice support
export const askAdvisorByVoice = (formData) =>
  API.post("/advisor/voice", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

export const getAdvisorInsights = () => AdvisorAPI.get("/advisor/insights");
export const getAdvisorConversations = () => AdvisorAPI.get("/advisor/conversations");
export const deleteConversation = (id) => AdvisorAPI.delete(`/advisor/conversations/${id}`);
export const clearAllConversations = () => AdvisorAPI.delete("/advisor/conversations");

// ==========================================================
// PUSH NOTIFICATIONS
// ==========================================================

export const savePushToken = (token, platform = "unknown") =>
  API.post("/notifications/push-token", { token, platform });

export const removePushToken = (token) =>
  API.post("/notifications/push-token/remove", { token });

// ==========================================================
// TRIAL
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
    return { success: false, error: error.message };
  }
};

export const startFreeTrial = async () => {
  try {
    const response = await API.post("/subscription/start-trial");
    return response.data;
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ==========================================================
// ✅ ADMIN API FUNCTIONS
// ==========================================================

// Admin login
export const adminLogin = (email, password) =>
  AdminAPI.post('/admin/login', { email, password });

// Get all businesses (admin only)
export const adminGetBusinesses = () =>
  AdminAPI.get('/admin/businesses');

// Create business (admin only)
export const adminCreateBusiness = (data) =>
  AdminAPI.post('/admin/businesses', data);

// Update business (admin only)
export const adminUpdateBusiness = (id, data) =>
  AdminAPI.put(`/admin/businesses/${id}`, data);

// Delete business (admin only)
export const adminDeleteBusiness = (id) =>
  AdminAPI.delete(`/admin/businesses/${id}`);

// ==========================================================
// ✅ STAFF MANAGEMENT
// ==========================================================

export const getStaff = () => API.get('/staff');
export const getStaffById = (id) => API.get(`/staff/${id}`);
export const createStaff = (data) => API.post('/staff', data);
export const updateStaff = (id, data) => API.put(`/staff/${id}`, data);
export const deleteStaff = (id) => API.delete(`/staff/${id}`);
export const markSalaryPaid = (id, amount, notes) => 
    API.post(`/staff/${id}/salary/pay`, { amount, notes });

// ==========================================================
// EXPORT DEFAULT
// ==========================================================

export default API;