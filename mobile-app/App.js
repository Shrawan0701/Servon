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
import * as Notifications from "expo-notifications";
import { savePushToken, removePushToken } from "./src/api";

// ✅ Import Admin Panel
import Admin from "./src/screens/web/Admin";

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

  // ✅ Check if admin route
  const isAdminRoute =
    Platform.OS === "web" && window.location.pathname === "/admin";

  // 🔴 ONLY skip sync/push logic for the /admin web route
  React.useEffect(() => {
    if (token) {
      // 🚫 Admin web panel does not need mobile sync or push notifications
      if (isAdminRoute) {
        return;
      }

      // ✅ Everything else remains exactly the same
      syncManager.init();
      registerPushToken();
    } else {
      syncManager.stopPeriodicSync();
    }
  }, [token, isAdminRoute]);

  // ✅ Web route detection with admin
  React.useEffect(() => {
    if (Platform.OS === "web") {
      const path = window.location.pathname;
      console.log("📍 Web path detected:", path);

      if (path === "/admin") {
        setWebScreen("Admin");
      } else if (path === "/privacy") {
        setWebScreen("PrivacyPolicy");
      } else if (path === "/terms") {
        setWebScreen("TermsOfService");
      }
    }
  }, []);

  const handleWebNavigate = (screenName, params = {}) => {
    setWebScreen(screenName);
    setOpenDemoOnLanding(!!params?.openDemo);

    if (Platform.OS === "web") {
      const lower = screenName.toLowerCase();

      if (lower === "admin") {
        window.history.pushState({}, "", "/admin");
      } else if (lower === "privacypolicy" || lower === "privacy") {
        window.history.pushState({}, "", "/privacy");
      } else if (lower === "termsofservice" || lower === "terms") {
        window.history.pushState({}, "", "/terms");
      } else {
        window.history.pushState(
          {},
          "",
          `/${lower === "landing" ? "" : lower}`
        );
      }

      window.scrollTo(0, 0);
    }
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#FAF9F6",
        }}
      >
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  // ─── ✅ Skip auth for admin route ────────────────────────────────
  if (token && !isAdminRoute) {
    return <MainNavigator />;
  }

  // ─── ✅ Show admin even if logged in ─────────────────────────────
  if (isAdminRoute) {
    return <Admin onNavigate={handleWebNavigate} />;
  }

  // ─── Unauthenticated web ─────────────────────────────────────────
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
        return (
          <AuthNavigator
            initialRoute="Login"
            onNavigateWeb={handleWebNavigate}
          />
        );

      case "signup":
        return (
          <AuthNavigator
            initialRoute="Signup"
            onNavigateWeb={handleWebNavigate}
          />
        );

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

      // ✅ Admin case
      case "admin":
        return <Admin onNavigate={handleWebNavigate} />;

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

  // ─── Unauthenticated native ─────────────────────────────────────
  return <AuthNavigator />;
}

const registerPushToken = async () => {
  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } =
        await Notifications.requestPermissionsAsync();

      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Push notification permission not granted");
      return;
    }

    const tokenData =
      await Notifications.getExpoPushTokenAsync();

    const pushToken = tokenData.data;

    if (pushToken) {
      await savePushToken(pushToken, Platform.OS);
      console.log("Push token registered:", pushToken);
    }
  } catch (err) {
    console.error("Push token registration error:", err);
  }
};

export default function App() {
  React.useEffect(() => {
    async function initOffline() {
      await localDB.init();
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