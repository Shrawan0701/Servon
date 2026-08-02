import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/context/AuthContext";

import localDB from "./src/services/LocalDB";
import syncManager from "./src/services/SyncManager";

import AuthNavigator from "./src/navigation/AuthNavigator";
import MainNavigator from "./src/navigation/MainNavigator";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, Platform } from "react-native";



// Web Screens
import LandingPage from "./src/screens/web/LandingPage";
import PrivacyPolicy from "./src/screens/web/PrivacyPolicy";
import TermsOfService from "./src/screens/web/TermsOfService";
import FeaturesPage from "./src/screens/web/FeaturesPage";
import PricingPage from "./src/screens/web/PricingPage";
import FAQPage from "./src/screens/web/FAQPage";
import AboutPage from "./src/screens/web/AboutPage";
import ContactPage from "./src/screens/web/ContactPage";
import RefundPolicy from "./src/screens/web/RefundPolicy";
import Security from "./src/screens/web/Security";
import Partners from "./src/screens/web/Partners";
import Careers from "./src/screens/web/Careers";

function Root() {
  const { token, loading } = useAuth();
  const [webScreen, setWebScreen] = React.useState("landing");

  React.useEffect(() => {
  if (Platform.OS === "web") {
    const path = window.location.pathname;

    if (path === "/privacy") setWebScreen("PrivacyPolicy");
    else if (path === "/terms") setWebScreen("TermsOfService");
  }
}, []);

 const handleWebNavigate = (screen) => {
  setWebScreen(screen);

  if (Platform.OS === "web") {
    if (screen === "PrivacyPolicy") window.history.pushState({}, "", "/privacy");
    else if (screen === "TermsOfService") window.history.pushState({}, "", "/terms");
    else window.history.pushState({}, "", "/");

    window.scrollTo(0, 0);
  }
};

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FAF9F6" }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  // ─── Authenticated: always go to MainNavigator ────────────────────────────
  // Payment success is handled INSIDE ProfileScreen via postMessage (web)
  // or via RazorpayCheckout callback (Android). No redirect needed here.
  if (token) {
    return <MainNavigator />;
  }

  // ─── Unauthenticated web ──────────────────────────────────────────────────
  if (Platform.OS === "web") {
    switch (webScreen) {
      case "login":         return <AuthNavigator initialRoute="Login" />;
      case "signup":        return <AuthNavigator initialRoute="Signup" />;
      case "PrivacyPolicy": return <PrivacyPolicy onNavigate={handleWebNavigate} />;
      case "TermsOfService":return <TermsOfService onNavigate={handleWebNavigate} />;
      case "Features":      return <FeaturesPage onNavigate={handleWebNavigate} />;
      case "Pricing":       return <PricingPage onNavigate={handleWebNavigate} />;
      case "FAQ":           return <FAQPage onNavigate={handleWebNavigate} />;
      case "About":         return <AboutPage onNavigate={handleWebNavigate} />;
      case "Contact":       return <ContactPage onNavigate={handleWebNavigate} />;
      case "RefundPolicy":       return <RefundPolicy onNavigate={handleWebNavigate} />;
      case "Security":       return <Security onNavigate={handleWebNavigate} />;
      case "Partners":       return <Partners onNavigate={handleWebNavigate} />;
      case "Careers":       return <Careers onNavigate={handleWebNavigate} />;
      default:              return <LandingPage onNavigate={handleWebNavigate} />;
    }
  }

  // ─── Unauthenticated native ───────────────────────────────────────────────
  return <AuthNavigator />;
}

export default function App() {

   React.useEffect(() => {
    async function initOffline() {
      await localDB.init();
      console.log(localDB.db);
      syncManager.init();
      console.log("Offline initialized");
    }

    initOffline();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="auto" />
          <Root />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}