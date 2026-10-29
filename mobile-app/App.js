import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { LocaleProvider, useLocale } from "./src/context/LocaleContext";

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
import { publicScreen } from "./src/screens/web/publicRoutes";

function Root() {
  const { token, loading } = useAuth();
  const { language } = useLocale();
  const [webScreen, setWebScreen] = React.useState(() =>
    Platform.OS === "web" ? publicScreen(window.location.pathname) : "landing",
  );
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
      registerPushToken(language);
    } else {
      syncManager.stopPeriodicSync();
    }
  }, [token, isAdminRoute, language]);

  // ✅ Web route detection with admin
  // Public deep links and browser history share the same route map.
  React.useEffect(() => {
    if (Platform.OS !== "web") return;
    const syncRoute = () => {
      setWebScreen(publicScreen(window.location.pathname));
      setOpenDemoOnLanding(false);
    };
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
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
          `/${lower === "landing" ? "" : lower}`,
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

const registerPushToken = async (language = "en") => {
  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();

      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Push notification permission not granted");
      return;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();

    const pushToken = tokenData.data;

    if (pushToken) {
      await savePushToken(pushToken, Platform.OS, language);
      console.log("Push token registered:", pushToken);
    }
  } catch (err) {
    console.error("Push token registration error:", err);
  }
};

export default function App() {
  React.useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    // Set the brand icon on every route, including a direct dashboard/login.
    // The versioned URL avoids reusing another project's localhost favicon.
    const iconUrl = "/favicon.png?servon-qr=ebba90af";
    for (const rel of ["icon", "shortcut icon", "apple-touch-icon"]) {
      const existing = document.head.querySelectorAll(`link[rel="${rel}"]`);
      const links = existing.length
        ? Array.from(existing)
        : [document.createElement("link")];
      for (const link of links) {
        link.rel = rel;
        link.type = "image/png";
        link.href = iconUrl;
        if (!link.parentNode) document.head.appendChild(link);
      }
    }
  }, []);

  React.useEffect(() => {
    async function initOffline() {
      await localDB.init();
    }

    initOffline();
  }, []);

  React.useEffect(() => {
    if (Platform.OS === "web" && "serviceWorker" in navigator) {
      if (__DEV__) {
        // Metro owns development assets. A cached AppEntry.bundle can keep an
        // old scanner alive even after the source and backend have changed.
        const oldWorker = navigator.serviceWorker.controller?.scriptURL;
        const controlledByServon =
          oldWorker && new URL(oldWorker).pathname === "/servon-sw.js";
        Promise.all([
          navigator.serviceWorker.getRegistrations().then((registrations) =>
            Promise.all(
              registrations
                .filter((registration) => {
                  const worker =
                    registration.active ||
                    registration.waiting ||
                    registration.installing;
                  return (
                    worker?.scriptURL &&
                    new URL(worker.scriptURL).pathname === "/servon-sw.js"
                  );
                })
                .map((registration) => registration.unregister()),
            ),
          ),
          "caches" in window
            ? caches
                .keys()
                .then((keys) =>
                  Promise.all(
                    keys
                      .filter((key) => key.startsWith("servon-pos-shell-"))
                      .map((key) => caches.delete(key)),
                  ),
                )
            : Promise.resolve(),
        ])
          .then(() => {
            // Unregistering alone does not release an already controlled tab.
            if (controlledByServon) window.location.reload();
          })
          .catch(() => {});
      } else {
        navigator.serviceWorker
          .register("/servon-sw.js", { updateViaCache: "none" })
          .catch((err) => {
            console.log(
              "Service worker registration skipped:",
              err?.message || err,
            );
          });
      }
    }
  }, []);

  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <AuthProvider>
          <NavigationContainer>
            <StatusBar style="auto" />
            <Root />
          </NavigationContainer>
        </AuthProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
