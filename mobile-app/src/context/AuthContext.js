import { createContext, useContext, useState, useEffect } from "react"; 
import AsyncStorage from "@react-native-async-storage/async-storage"; 
import API from "../api"; 
 
const AuthContext = createContext(); 
 
export function AuthProvider({ children }) { 
  const [token, setToken] = useState(null); 
  const [business, setBusiness] = useState(null); 
  const [loading, setLoading] = useState(true); 
  
  // Renamed internal state slightly so we can intercept it below
  const [isChefModeState, setIsChefModeState] = useState(false);

  useEffect(() => { 
    loadAuth(); 
  }, []); 
 
  const loadAuth = async () => { 
    try { 
      const storedToken = await AsyncStorage.getItem("token"); 
      const storedBusiness = await AsyncStorage.getItem("business"); 
      const storedChefMode = await AsyncStorage.getItem("isChefMode"); // Check lock state
      
      if (storedToken) { 
        setToken(storedToken); 
        API.defaults.headers.common["Authorization"] = `Bearer ${storedToken}`; 
        if (storedBusiness) setBusiness(JSON.parse(storedBusiness)); 
      } 
      
      // If they were locked before refreshing, lock them again!
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
    await AsyncStorage.setItem("token", tokenValue); 
    await AsyncStorage.setItem("business", JSON.stringify(businessData)); 
    API.defaults.headers.common["Authorization"] = `Bearer ${tokenValue}`; 
    setToken(tokenValue); 
    setBusiness(businessData); 
  }; 

  const logout = async () => { 
    await AsyncStorage.removeItem("token"); 
    await AsyncStorage.removeItem("business"); 
    await AsyncStorage.removeItem("isChefMode"); // Wipe lock state on logout
    delete API.defaults.headers.common["Authorization"]; 
    setToken(null); 
    setBusiness(null); 
    setIsChefModeState(false);
  }; 

  const updateBusiness = async (data) => { 
    const updated = { ...business, ...data }; 
    await AsyncStorage.setItem("business", JSON.stringify(updated)); 
    setBusiness(updated); 
  }; 

  // NEW: Save to hard drive every time they flip the switch!
  const setIsChefMode = async (value) => {
    setIsChefModeState(value);
    await AsyncStorage.setItem("isChefMode", value ? "true" : "false");
  };

  return ( 
    <AuthContext.Provider value={{ 
      token, business, loading, login, logout, updateBusiness, 
      isChefMode: isChefModeState, // Expose state
      setIsChefMode // Expose our custom interceptor function
    }}> 
      {children} 
    </AuthContext.Provider> 
  ); 
} 

export const useAuth = () => useContext(AuthContext);