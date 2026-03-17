import { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import API from "../api";
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const AuthContext = createContext();

// HARDCODE YOUR PROJECT ID HERE AS A FALLBACK
const EXPO_PROJECT_ID = "cc595fcc-0f57-4242-a498-bb317bd6a582";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isChefModeState, setIsChefModeState] = useState(false);

  useEffect(() => {
    loadAuth();
  }, []);

  const registerPush = async () => {
    if (Platform.OS === 'web') return;

    try {
      // Push notifications only work on physical devices
      if (!Device.isDevice) {
        console.log("Not a physical device, skipping push registration.");
        return;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log("Push permissions not granted.");
        return;
      }

      // --- IMPROVED PROJECT ID SELECTION ---
      // We try reading from config first, then fall back to our hardcoded ID
      const projectId = 
        Constants?.expoConfig?.extra?.eas?.projectId ?? 
        Constants?.easConfig?.projectId ?? 
        EXPO_PROJECT_ID;
      
      if (!projectId) {
        console.error("CRITICAL: Project ID not found. Ensure it is in app.json.");
        return;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const pushToken = tokenData.data;

      // Sync with your backend
      await API.post("/auth/update-push-token", { pushToken });
      console.log("Push token synced successfully:", pushToken);

      if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
    } catch (err) {
      console.log("Push registration error:", err);
    }
  };

  const loadAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem("token");
      const storedBusiness = await AsyncStorage.getItem("business");
      const storedChefMode = await AsyncStorage.getItem("isChefMode");

      if (storedToken) {
        setToken(storedToken);
        API.defaults.headers.common["Authorization"] = `Bearer ${storedToken}`;
        if (storedBusiness) setBusiness(JSON.parse(storedBusiness));
        
        // Auto-register when app loads if user is logged in
        registerPush(); 
      }

      if (storedChefMode === "true") {
        setIsChefModeState(true);
      }
    } catch (e) {
      console.error("Load auth error:", e);
    } finally {
      setLoading(false);
    }
  };

  const login = async (tokenValue, businessData) => {
    try {
      await AsyncStorage.setItem("token", tokenValue);
      await AsyncStorage.setItem("business", JSON.stringify(businessData));
      API.defaults.headers.common["Authorization"] = `Bearer ${tokenValue}`;
      setToken(tokenValue);
      setBusiness(businessData);

      // Register push immediately after successful login
      registerPush(); 
    } catch (e) {
      console.error("Login save error:", e);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("business");
      await AsyncStorage.removeItem("isChefMode");
      delete API.defaults.headers.common["Authorization"];
      setToken(null);
      setBusiness(null);
      setIsChefModeState(false);
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  const updateBusiness = async (data) => {
    const updated = { ...business, ...data };
    await AsyncStorage.setItem("business", JSON.stringify(updated));
    setBusiness(updated);
  };

  const setIsChefMode = async (value) => {
    setIsChefModeState(value);
    await AsyncStorage.setItem("isChefMode", value ? "true" : "false");
  };

  return (
    <AuthContext.Provider value={{
      token, business, loading, login, logout, updateBusiness,
      isChefMode: isChefModeState,
      setIsChefMode
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);