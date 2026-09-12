// src/context/AuthContext.js

import { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import API, { setCurrentBranchIdSync } from "../api";
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

  // ✅ NEW: Branch state
  const [branches, setBranches] = useState([]);
  const [currentBranch, setCurrentBranch] = useState(null);
  
  // ✅ NEW: Switching branch flag (prevents stale data flash)
  const [switchingBranch, setSwitchingBranch] = useState(false);

  useEffect(() => {
    loadAuth();
  }, []);

  const registerPush = async () => {
    if (Platform.OS === 'web') return;

    try {
      if (!Device.isDevice) {
        return;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return;
      }

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
      // Silently fail or log minimally for debugging if needed
    }
  };

  const loadAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem("token");
      const storedBusiness = await AsyncStorage.getItem("business");
      const storedChefMode = await AsyncStorage.getItem("isChefMode");
      // ✅ Load stored branches
      const storedBranches = await AsyncStorage.getItem("branches");
      const storedBranchId = await AsyncStorage.getItem("currentBranchId");

      if (storedToken) {
        setToken(storedToken);
        API.defaults.headers.common["Authorization"] = `Bearer ${storedToken}`;
        
        if (storedBusiness) {
          const businessData = JSON.parse(storedBusiness);
          setBusiness(businessData);
        }

        // ✅ Load branches from storage
        if (storedBranches) {
          const branchesData = JSON.parse(storedBranches);
          setBranches(branchesData);
          
          // ✅ Set current branch from storage
          if (storedBranchId) {
            const branch = branchesData.find(b => b.id === storedBranchId);
            if (branch) {
              setCurrentBranch(branch);
              // ✅ Prime the SYNC cache so interceptors never read stale data
              setCurrentBranchIdSync(branch.id);
            }
          }
        }
        
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

  const login = async (tokenValue, businessData, branchesData = []) => {
    try {
      await AsyncStorage.setItem("token", tokenValue);
      await AsyncStorage.setItem("business", JSON.stringify(businessData));
      // ✅ Store branches
      await AsyncStorage.setItem("branches", JSON.stringify(branchesData));

      API.defaults.headers.common["Authorization"] = `Bearer ${tokenValue}`;

      setToken(tokenValue);
      setBusiness(businessData);
      setBranches(branchesData);

      // ✅ Set main branch as default
      const mainBranch = branchesData.find(b => b.is_main_branch) || branchesData[0];
      if (mainBranch) {
        // ✅ SYNC cache FIRST — before any async awaits
        setCurrentBranchIdSync(mainBranch.id);
        setCurrentBranch(mainBranch);
        await AsyncStorage.setItem("currentBranchId", mainBranch.id);
      }

      try {
        const res = await API.get("/auth/me");
        const latestBusiness = res.data;
        setBusiness(latestBusiness);
        await AsyncStorage.setItem("business", JSON.stringify(latestBusiness));
      } catch (e) {
        console.error("Fetch latest business failed:", e);
      }

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
      // ✅ Remove branch data
      await AsyncStorage.removeItem("branches");
      await AsyncStorage.removeItem("currentBranchId");
      delete API.defaults.headers.common["Authorization"];
      setCurrentBranchIdSync(null); // ✅ Clear sync cache
      setToken(null);
      setBusiness(null);
      setIsChefModeState(false);
      setBranches([]);
      setCurrentBranch(null);
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

  // ✅ NEW: Switch to a different branch (WITH switching flag + sync cache)
  const switchBranch = async (branch) => {
    try {
      if (!branch) return false;

      // ✅ STEP 1 — Update the SYNCHRONOUS cache FIRST, before any awaits.
      // From this line forward, EVERY API request will carry the new
      // x-branch-id header — no stale AsyncStorage reads possible.
      setCurrentBranchIdSync(branch.id);

      setSwitchingBranch(true);  // ✅ Flag ON
      setCurrentBranch(branch);

      // Persist to AsyncStorage (async — but the interceptor no longer
      // depends on this being finished first).
      await AsyncStorage.setItem("currentBranchId", branch.id);

      // ✅ Reload business data for this branch — now correctly scoped
      const res = await API.get("/auth/me");
      setBusiness(res.data);
      await AsyncStorage.setItem("business", JSON.stringify(res.data));

      setSwitchingBranch(false); // ✅ Flag OFF
      return true;
    } catch (error) {
      console.error("Switch branch error:", error);
      setSwitchingBranch(false);
      return false;
    }
  };

  // ✅ NEW: Refresh branches list from server
  const refreshBranches = async () => {
    try {
      const res = await API.get("/branches");
      if (res.data?.data) {
        setBranches(res.data.data);
        await AsyncStorage.setItem("branches", JSON.stringify(res.data.data));

        // ✅ If current branch no longer exists, reset to main
        const stillExists = res.data.data.find(b => b.id === currentBranch?.id);
        if (!stillExists && res.data.data.length > 0) {
          const mainBranch = res.data.data.find(b => b.is_main_branch) || res.data.data[0];
          setCurrentBranchIdSync(mainBranch.id); // ✅ Sync cache FIRST
          setCurrentBranch(mainBranch);
          await AsyncStorage.setItem("currentBranchId", mainBranch.id);
        }
      }
    } catch (error) {
      console.error("Refresh branches error:", error);
    }
  };

  // ===== ✅ FIXED: Premium Status (includes TRIAL) =====
  const isPremium = loading ? null : ['ACTIVE', 'TRIAL'].includes(business?.subscription_status);

  return (
    <AuthContext.Provider value={{
      token, 
      business, 
      loading, 
      login, 
      logout, 
      updateBusiness,
      isChefMode: isChefModeState,
      setIsChefMode,
      isPremium,
      // ✅ NEW: Branch context
      branches,
      currentBranch,
      switchBranch,
      refreshBranches,
      switchingBranch,  // ✅ NEW: Exposed
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);