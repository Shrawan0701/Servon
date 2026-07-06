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
  Dimensions,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";

// Get screen width for responsive checks
const { width } = Dimensions.get("window");
const isWeb = Platform.OS === "web";

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://10.12.34.12:5000";
                    
export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
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
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Main Wrapper to center content on Web */}
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

            {/* Error Message */}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorIcon}>⚠</Text>
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
                  <Text style={styles.inputIcon}>✉</Text>
                  <TextInput
                    style={[styles.input, isWeb && { outlineStyle: 'none' }]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor="#B0A99F"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>PASSWORD</Text>
                <View style={styles.inputWrap}>
                  <Text style={styles.inputIcon}>🔒</Text>
                  <TextInput
                    style={[styles.input, isWeb && { outlineStyle: 'none' }]}
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

              <View style={styles.signupRow}>
                <View style={styles.signupDivider} />
                <TouchableOpacity onPress={() => navigation.navigate("Signup")}>
                  <Text style={styles.signupText}>
                    New here?{" "}
                    <Text style={styles.signupLink}>Create Account</Text>
                  </Text>
                </TouchableOpacity>
                <View style={styles.signupDivider} />
              </View>
            </View>

            <Text style={styles.footer}>© 2026 Servon</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const GREEN = "#10B981";
const BG = "#FAF8F5";
const CARD_BG = "#FFFFFF";
const BORDER = "#E8E2D9";
const TEXT_PRIMARY = "#1C1917";
const TEXT_MUTED = "#78716C";

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  scrollContainer: { 
    flexGrow: 1, 
    backgroundColor: BG,
    // On web, this ensures the content can be centered vertically if there's space
    justifyContent: isWeb ? 'center' : 'flex-start',
  },
  responsiveWrapper: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
    // The Magic Fix: limit width on big screens
    ...Platform.select({
      web: {
        maxWidth: 450, // Typical width for a professional web login card
        paddingTop: 20,
      },
      default: {
        paddingTop: 52,
      }
    })
  },
  headerContainer: { alignItems: "center", paddingBottom: 36 },
  brandText: { fontSize: 38, fontWeight: "900", color: TEXT_PRIMARY, letterSpacing: -1, marginTop: 4 },
  brandAccent: { color: GREEN },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  dividerLine: { width: 36, height: 1, backgroundColor: BORDER },
  dividerLabel: { fontSize: 10, color: GREEN, letterSpacing: 4, fontWeight: "700" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: "#FCA5A5" },
  errorIcon: { fontSize: 15, color: "#DC2626" },
  errorText: { color: "#DC2626", fontSize: 13, fontWeight: "500", flex: 1 },
  formCard: { 
    backgroundColor: CARD_BG, 
    borderRadius: 24, 
    padding: 28, 
    borderWidth: 1, 
    borderColor: BORDER, 
    elevation: 8, 
    shadowColor: "#A89880", 
    shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.18, 
    shadowRadius: 24 
  },
  formHeading: { fontSize: 22, fontWeight: "800", color: TEXT_PRIMARY, letterSpacing: -0.5, marginBottom: 4 },
  formSubheading: { fontSize: 13, color: TEXT_MUTED, marginBottom: 28 },
  inputGroup: { marginBottom: 22 },
  label: { fontSize: 10, fontWeight: "700", color: GREEN, letterSpacing: 2.5, marginBottom: 8 },
  inputWrap: { 
    flexDirection: "row", 
    alignItems: "center", 
    borderBottomWidth: 1.5, 
    borderBottomColor: BORDER, 
    paddingVertical: Platform.OS === "ios" ? 10 : 2 
  },
  inputIcon: { fontSize: 15, marginRight: 10, color: TEXT_MUTED },
  input: { 
    flex: 1, 
    fontSize: 15, 
    color: TEXT_PRIMARY, 
    letterSpacing: 0.2,
    // Removes the blue focus ring on web browsers
    ...Platform.select({
      web: { outlineStyle: 'none' }
    })
  },
  forgotBtn: { alignSelf: "flex-end", marginBottom: 28, paddingVertical: 4 },
  forgotText: { fontSize: 13, color: GREEN, fontWeight: "600" },
  btn: { backgroundColor: "#1C1917", borderRadius: 12, paddingVertical: 16, alignItems: "center", elevation: 6, shadowColor: "#1C1917", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 12 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 14, letterSpacing: 3 },
  signupRow: { flexDirection: "row", alignItems: "center", marginTop: 24, gap: 12 },
  signupDivider: { flex: 1, height: 1, backgroundColor: BORDER },
  signupText: { fontSize: 13, color: TEXT_MUTED, fontWeight: "500" },
  signupLink: { color: GREEN, fontWeight: "700" },
  footer: { textAlign: "center", fontSize: 11, color: "#A8A29E", marginTop: 36, letterSpacing: 0.5 },
});