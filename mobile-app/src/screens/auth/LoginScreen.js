import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";

const isWeb = Platform.OS === "web";
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://10.198.185.12:5000";

export default function LoginScreen({ navigation, onNavigate }) {
  const { login } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  
  // Show side hero panel ONLY when screen width is desktop-sized (960px+)
  const isDesktop = isWeb && screenWidth >= 960;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Email and password required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      await login(data.token, data.business);

    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.masterContainer}>
            
            {/* LEFT HERO PANEL - RENDERS ONLY ON DESKTOP SCREENS */}
            {isDesktop && (
              <View style={styles.webHeroPanel}>
                <View style={styles.heroGlowCircle} />

                {/* Top Brand & Badge */}
                <View style={styles.heroTopRow}>
                  <Text style={styles.heroBrandText}>
                    Servon<Text style={styles.heroBrandDot}>.</Text>
                  </Text>
                  <View style={styles.badgePill}>
                    <View style={styles.livePulseDot} />
                    <Text style={styles.badgePillText}>LOCAL-FIRST POS</Text>
                  </View>
                </View>

                {/* Hero Headline */}
                <View style={styles.heroContent}>
                  <Text style={styles.heroTag}>RESTAURANT OPERATIONS</Text>
                  <Text style={styles.heroHeading}>
                    A calm command center for every table, bill, and shift.
                  </Text>
                  <Text style={styles.heroSubheading}>
                    Run dine-in orders, menu updates, customer dues, and offline billing from one focused workspace.
                  </Text>

                  {/* HUMAN & LIVE ORDER STREAM */}
                  <View style={styles.streamWrapper}>
                    <View style={styles.streamHeader}>
                      <Text style={styles.streamTitle}>TODAY'S FLOOR</Text>
                      <Text style={styles.streamSub}>Live snapshot</Text>
                    </View>

                    {/* Stream Card 1: Chef KOT */}
                    <View style={styles.streamCard}>
                      <View style={styles.avatarCircleChef}>
                        <Text style={styles.avatarEmoji}>KOT</Text>
                      </View>
                      <View style={styles.streamContent}>
                        <View style={styles.streamRowBetween}>
                          <Text style={styles.streamActor}>Kitchen order #104</Text>
                          <Text style={styles.streamTime}>Just now</Text>
                        </View>
                        <Text style={styles.streamDetail}>
                          2x Paneer tikka - 3x Garlic naan
                        </Text>
                        <View style={styles.statusBadgeGreen}>
                          <Text style={styles.statusBadgeTextGreen}>PREPARING</Text>
                        </View>
                      </View>
                    </View>

                    {/* Stream Card 2: Captain / Floor Staff */}
                    <View style={styles.streamCard}>
                      <View style={styles.avatarCircleStaff}>
                        <Text style={styles.avatarEmoji}>BILL</Text>
                      </View>
                      <View style={styles.streamContent}>
                        <View style={styles.streamRowBetween}>
                          <Text style={styles.streamActor}>Table #06</Text>
                          <Text style={styles.streamTime}>2m ago</Text>
                        </View>
                        <Text style={styles.streamDetail}>
                          Bill generated - Rs 1,450
                        </Text>
                        <View style={styles.statusBadgeBlue}>
                          <Text style={styles.statusBadgeTextBlue}>SETTLED</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Hero Footer Metrics */}
                <View style={styles.heroFooter}>
                  <View style={styles.heroStatItem}>
                    <Text style={styles.heroStatNum}>Manual</Text>
                    <Text style={styles.heroStatLabel}>Order entry</Text>
                  </View>
                  <View style={styles.heroStatDivider} />
                  <View style={styles.heroStatItem}>
                    <Text style={styles.heroStatNum}>Fast</Text>
                    <Text style={styles.heroStatLabel}>Bill print</Text>
                  </View>
                  <View style={styles.heroStatDivider} />
                  <View style={styles.heroStatItem}>
                    <Text style={styles.heroStatNum}>Offline</Text>
                    <Text style={styles.heroStatLabel}>Ready flow</Text>
                  </View>
                </View>
              </View>
            )}

            {/* RIGHT / MAIN FORM PANEL */}
            <View style={styles.formPanel}>
              <View style={styles.responsiveWrapper}>
                
                {/* Header */}
                <View style={styles.headerContainer}>
                  <Text style={styles.brandText}>
                    Servon<Text style={styles.brandAccent}>.</Text>
                  </Text>

                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerLabel}>BUSINESS SUITE</Text>
                    <View style={styles.dividerLine} />
                  </View>
                </View>

                {/* Error Box */}
                {error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorIcon}>!</Text>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Form Card */}
                <View style={styles.formCard}>
                  <Text style={styles.formHeading}>Welcome Back</Text>
                  <Text style={styles.formSubheading}>Sign in to your account</Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>EMAIL ADDRESS</Text>
                    <View style={styles.inputWrap}>
                      <Text style={styles.inputIcon}>@</Text>
                      <TextInput
                        style={[styles.input, isWeb && { outlineStyle: "none" }]}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="you@gmail.com"
                        placeholderTextColor="#B0A99F"
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>PASSWORD</Text>
                    <View style={styles.inputWrap}>
                      <Text style={styles.inputIcon}>*</Text>
                      <TextInput
                        style={[styles.input, isWeb && { outlineStyle: "none" }]}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Enter password"
                        placeholderTextColor="#B0A99F"
                        secureTextEntry
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.forgotBtn}
                    onPress={() => navigation.navigate("ForgotPassword")}
                  >
                    <Text style={styles.forgotText}>Forgot Password?</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btn, loading && styles.btnDisabled]}
                    onPress={handleLogin}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.btnText}>SIGN IN</Text>
                    )}
                  </TouchableOpacity>

                  {isWeb && (
                    <View style={styles.signupRow}>
                      <View style={styles.signupDivider} />
                      <TouchableOpacity onPress={() => onNavigate?.("landing", { openDemo: true })}>
                        <Text style={styles.signupText}>
                          Interested in Servon?{" "}
                          <Text style={styles.signupLink}>Book a Demo</Text>
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.signupDivider} />
                    </View>
                  )}
                </View>

                <Text style={styles.footer}>2026 Servon</Text>
              </View>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const GREEN = "#008060";
const BG = "#F6F4EF";
const CARD_BG = "#FFFFFF";
const BORDER = "#E8E2D9";
const TEXT_PRIMARY = "#1C1917";
const TEXT_MUTED = "#78716C";

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  
  masterContainer: {
    flex: 1,
    flexDirection: "row",
    minHeight: isWeb ? "100vh" : "100%",
  },

  // HERO PANEL (DESKTOP WEB)
  webHeroPanel: {
    flex: 1.1,
    backgroundColor: "#EEF5EF",
    padding: 48,
    justifyContent: "space-between",
    position: "relative",
    overflow: "hidden",
    borderRightWidth: 1,
    borderRightColor: "#DDE7DE",
  },
  heroGlowCircle: {
    position: "absolute",
    top: "-15%",
    left: "-10%",
    width: 450,
    height: 450,
    borderRadius: 225,
    backgroundColor: "transparent",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 2,
  },
  heroBrandText: {
    fontSize: 32,
    fontWeight: "900",
    color: TEXT_PRIMARY,
    letterSpacing: 0,
  },
  heroBrandDot: {
    color: GREEN,
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D7E6D8",
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  badgePillText: {
    color: "#245B46",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  heroContent: {
    marginVertical: 24,
    zIndex: 2,
  },
  heroTag: {
    color: "#2F7D5F",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.5,
    marginBottom: 8,
  },
  heroHeading: {
    fontSize: 34,
    fontWeight: "900",
    color: TEXT_PRIMARY,
    lineHeight: 42,
    letterSpacing: 0,
    marginBottom: 12,
  },
  heroSubheading: {
    fontSize: 14,
    color: "#5F6F65",
    lineHeight: 22,
    marginBottom: 24,
  },

  // LIVE STREAM CONTAINER
  streamWrapper: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#DDE7DE",
    gap: 14,
    shadowColor: "#1C1917",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.06,
    shadowRadius: 30,
  },
  streamHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  streamTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#2F7D5F",
    letterSpacing: 1.5,
  },
  streamSub: {
    fontSize: 11,
    color: TEXT_MUTED,
    fontWeight: "600",
  },
  streamCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#FAF8F5",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  avatarCircleChef: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCircleStaff: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: {
    fontSize: 10,
    fontWeight: "900",
    color: TEXT_PRIMARY,
  },
  streamContent: {
    flex: 1,
  },
  streamRowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  streamActor: {
    fontSize: 13,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  streamTime: {
    fontSize: 10,
    color: TEXT_MUTED,
  },
  streamDetail: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 2,
    marginBottom: 6,
  },
  statusBadgeGreen: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeTextGreen: {
    fontSize: 9,
    fontWeight: "800",
    color: "#10B981",
  },
  statusBadgeBlue: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeTextBlue: {
    fontSize: 9,
    fontWeight: "800",
    color: "#38BDF8",
  },

  heroFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DDE7DE",
    zIndex: 2,
    shadowColor: "#1C1917",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
  },
  heroStatItem: {
    flex: 1,
    alignItems: "center",
  },
  heroStatNum: {
    fontSize: 16,
    fontWeight: "900",
    color: TEXT_PRIMARY,
  },
  heroStatLabel: {
    fontSize: 10,
    color: TEXT_MUTED,
    fontWeight: "700",
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: BORDER,
  },

  // FORM PANEL (WORKS PERFECTLY ON BOTH DESKTOP & MOBILE)
  formPanel: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BG,
    paddingVertical: 24,
  },
  responsiveWrapper: {
    width: "100%",
    maxWidth: 440,
    paddingHorizontal: 24,
  },
  headerContainer: { alignItems: "center", paddingBottom: 28 },
  brandText: { fontSize: 36, fontWeight: "900", color: TEXT_PRIMARY, letterSpacing: 0 },
  brandAccent: { color: GREEN },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  dividerLine: { width: 32, height: 1, backgroundColor: BORDER },
  dividerLabel: { fontSize: 10, color: GREEN, letterSpacing: 3, fontWeight: "700" },

  errorBox: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 10, 
    backgroundColor: "#FEF2F2", 
    borderRadius: 12, 
    padding: 14, 
    marginBottom: 20, 
    borderWidth: 1, 
    borderColor: "#FCA5A5" 
  },
  errorIcon: { fontSize: 15, color: "#DC2626" },
  errorText: { color: "#DC2626", fontSize: 13, fontWeight: "500", flex: 1 },

  formCard: { 
    backgroundColor: CARD_BG, 
    borderRadius: 24, 
    padding: 28, 
    borderWidth: 1, 
    borderColor: BORDER, 
    elevation: 8, 
    shadowColor: "#0F172A", 
    shadowOffset: { width: 0, height: 10 }, 
    shadowOpacity: 0.08, 
    shadowRadius: 24 
  },
  formHeading: { fontSize: 22, fontWeight: "800", color: TEXT_PRIMARY, letterSpacing: 0, marginBottom: 4 },
  formSubheading: { fontSize: 13, color: TEXT_MUTED, marginBottom: 24 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 10, fontWeight: "800", color: GREEN, letterSpacing: 2, marginBottom: 8 },
  inputWrap: { 
    flexDirection: "row", 
    alignItems: "center", 
    borderBottomWidth: 1.5, 
    borderBottomColor: BORDER, 
    paddingVertical: Platform.OS === "ios" ? 8 : 4 
  },
  inputIcon: { fontSize: 15, marginRight: 10, color: TEXT_MUTED },
  input: { 
    flex: 1, 
    fontSize: 15, 
    color: TEXT_PRIMARY, 
    letterSpacing: 0.2,
    ...Platform.select({
      web: { outlineStyle: "none" }
    })
  },
  forgotBtn: { alignSelf: "flex-end", marginBottom: 24, paddingVertical: 4 },
  forgotText: { fontSize: 13, color: GREEN, fontWeight: "700" },

  btn: { 
    backgroundColor: "#0F172A", 
    borderRadius: 14, 
    paddingVertical: 16, 
    alignItems: "center", 
    elevation: 4, 
    shadowColor: "#0F172A", 
    shadowOffset: { width: 0, height: 6 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 12,
    cursor: isWeb ? "pointer" : "default",
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#FFF", fontWeight: "800", fontSize: 14, letterSpacing: 2.5 },

  signupRow: { flexDirection: "row", alignItems: "center", marginTop: 20, gap: 10 },
  signupDivider: { flex: 1, height: 1, backgroundColor: BORDER },
  signupText: { fontSize: 12, color: TEXT_MUTED, fontWeight: "500" },
  signupLink: { color: GREEN, fontWeight: "800" },
  footer: { textAlign: "center", fontSize: 11, color: "#A8A29E", marginTop: 28, letterSpacing: 0.5 },
});
