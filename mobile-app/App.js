import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/context/AuthContext";

import localDB from "./src/services/LocalDB";
import syncManager from "./src/services/SyncManager";

import AuthNavigator from "./src/navigation/AuthNavigator";
import MainNavigator from "./src/navigation/MainNavigator";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, Platform, LogBox } from "react-native";

// Ignore non-critical web dev logs in console
if (Platform.OS === "web") {
  LogBox.ignoreLogs([
    "[expo-notifications]",
    "Using AsyncStorage for web",
    "Animated: `useNativeDriver`",
  ]);
}

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
  const [openDemoOnLanding, setOpenDemoOnLanding] = React.useState(false);

  // 🔴 FIX: ONLY START SYNC MANAGER IF USER IS AUTHENTICATED
  React.useEffect(() => {
    if (token) {
      syncManager.init();
    } else {
      syncManager.stopPeriodicSync();
    }
  }, [token]);

  React.useEffect(() => {
    if (Platform.OS === "web") {
      const path = window.location.pathname;
      if (path === "/privacy") setWebScreen("PrivacyPolicy");
      else if (path === "/terms") setWebScreen("TermsOfService");
    }
  }, []);

 const handleWebNavigate = (screenName, params = {}) => {
  setWebScreen(screenName); // 👈 Removed .toLowerCase()
  setOpenDemoOnLanding(!!params?.openDemo);

  if (Platform.OS === "web") {
    const lower = screenName.toLowerCase();
    if (lower === "privacypolicy" || lower === "privacy") {
      window.history.pushState({}, "", "/privacy");
    } else if (lower === "termsofservice" || lower === "terms") {
      window.history.pushState({}, "", "/terms");
    } else {
      window.history.pushState({}, "", `/${lower === "landing" ? "" : lower}`);
    }
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
  if (token) {
    return <MainNavigator />;
  }

  // ─── Unauthenticated web ──────────────────────────────────────────────────
  if (Platform.OS === "web") {
    switch (webScreen.toLowerCase()) {
  case "landing":
    return (
      <LandingPage
        onNavigate={handleWebNavigate}
        openDemo={openDemoOnLanding}
        setOpenDemoOnLanding={setOpenDemoOnLanding}
      />
    );
  case "login":
    return <AuthNavigator initialRoute="Login" onNavigateWeb={handleWebNavigate} />;
  case "signup":
    return <AuthNavigator initialRoute="Signup" onNavigateWeb={handleWebNavigate} />;
  case "privacypolicy":
  case "privacy":
    return <PrivacyPolicy onNavigate={handleWebNavigate} />;
  case "termsofservice":
  case "terms":
    return <TermsOfService onNavigate={handleWebNavigate} />;
  case "features":
    return <FeaturesPage onNavigate={handleWebNavigate} />;
  case "pricing":
    return <PricingPage onNavigate={handleWebNavigate} />;
  case "faq":
    return <FAQPage onNavigate={handleWebNavigate} />;
  case "about":
    return <AboutPage onNavigate={handleWebNavigate} />;
  case "contact":
    return <ContactPage onNavigate={handleWebNavigate} />;
  case "refundpolicy":
    return <RefundPolicy onNavigate={handleWebNavigate} />;
  case "security":
    return <Security onNavigate={handleWebNavigate} />;
  case "partners":
    return <Partners onNavigate={handleWebNavigate} />;
  case "careers":
    return <Careers onNavigate={handleWebNavigate} />;
  default:
    return (
      <LandingPage
        onNavigate={handleWebNavigate}
        openDemo={openDemoOnLanding}
        setOpenDemoOnLanding={setOpenDemoOnLanding}
      />
    );
}
  }

  // ─── Unauthenticated native ───────────────────────────────────────────────
  return <AuthNavigator />;
}

export default function App() {
  React.useEffect(() => {
    async function initOffline() {
      await localDB.init();
      // Removed syncManager.init() from here
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