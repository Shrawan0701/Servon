import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const API = axios.create({
  baseURL: 'http://10.75.23.38:5000/api',
  timeout: 15000,
});

API.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      // Wipe the dead token
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("business");
      
      // If on web, aggressively reload to push back to Auth
      if (Platform.OS === "web") {
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const signup = (data) => API.post("/auth/signup", data);
export const login = (data) => API.post("/auth/login", data);
export const getMe = () => API.get("/auth/me");


export const sendOTP = (email) =>
  API.post("/auth/forgot-password/send-otp", { email });

export const verifyOTP = (email, otp) =>
  API.post("/auth/forgot-password/verify-otp", { email, otp });

export const resetPassword = (resetToken, newPassword) =>
  API.post("/auth/forgot-password/reset", { resetToken, newPassword });

// Subscription
export const createPaymentOrder = () =>
  API.post("/subscription/create-order");

export const verifyPayment = (data) =>
  API.post("/subscription/verify-payment", data);

export const getSubscriptionDetails = () =>
  API.get("/subscription/details");

export const getReferrals = () => API.get("/referrals");
export const redeemReferrals = () => API.post("/referrals/redeem");

// Menu
export const getMenu = () => API.get("/menu");

export const addMenuItem = (formData) =>
  API.post("/menu", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const updateMenuItem = (id, formData) =>
  API.put(`/menu/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const toggleMenuItemAvailability = (id) =>
  API.patch(`/menu/${id}/availability`);

export const deleteMenuItem = (id) =>
  API.delete(`/menu/${id}`);

// Tables
export const getTables = () => API.get("/tables");

export const addTable = (tableNumber) =>
  API.post("/tables", { tableNumber });

export const deleteTable = (id) =>
  API.delete(`/tables/${id}`);

export const getQRPdfUrl = (id) =>
  `${API.defaults.baseURL}/tables/${id}/qr-pdf`;

// Orders
export const getOrders = () => API.get("/orders");

export const updateOrderStatus = (id, status) =>
  API.patch(`/orders/${id}/status`, { status });

export const getNotifications = () =>
  API.get("/orders/notifications");

export const markNotificationRead = (id) =>
  API.patch(`/orders/notifications/${id}/read`);

export const markAllNotificationsRead = () =>
  API.patch("/orders/notifications/read-all");

// Analytics
export const getAnalytics = () =>
  API.get("/analytics");

// Sales
export const getSalesCSVUrl = (startDate, endDate) =>
  `${API.defaults.baseURL}/sales/csv?startDate=${startDate}&endDate=${endDate}`;

export const getSalesPDFUrl = (startDate, endDate) =>
  `${API.defaults.baseURL}/sales/pdf?startDate=${startDate}&endDate=${endDate}`;

// Profile
export const getProfile = () =>
  API.get("/profile");

export const updateProfile = (formData) =>
  API.put("/profile", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const getReviews = () => API.get("/reviews");

// Add these to the bottom of your api.js file
export const setAdminPin = (pin) => API.patch("/profile/pin", { pin });
export const verifyAdminPin = (pin) => API.post("/profile/verify-pin", { pin });

export default API;