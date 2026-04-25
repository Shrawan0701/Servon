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
import { signup as signupAPI } from "../../api";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const isWeb = Platform.OS === "web";

export default function SignupScreen({ navigation }) {
  const { login } = useAuth();
  const [form, setForm] = useState({
    businessName: "",
    ownerName: "",
    email: "",
    phone: "",
    password: "",
    referralCode: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const setField = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: null }));
  };

  const validateForm = () => {
    const { businessName, ownerName, email, phone, password, referralCode } = form;
    const errors = {};

    if (!businessName.trim()) errors.businessName = "Business name is required";
    else if (businessName.trim().length < 2) errors.businessName = "Must be at least 2 characters";

    if (!ownerName.trim()) errors.ownerName = "Owner name is required";
    else if (ownerName.trim().length < 2) errors.ownerName = "Must be at least 2 characters";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) errors.email = "Email address is required";
    else if (!emailRegex.test(email.trim())) errors.email = "Enter a valid email address";

    const phoneDigits = phone.trim().replace(/\D/g, "");
    if (!phone.trim()) {
      errors.phone = "Phone number is required";
    } else if (phoneDigits.length !== 10) {
      errors.phone = "Please enter 10 digit phone number";
    }

    if (!password) errors.password = "Password is required";
    else if (password.length < 8) errors.password = "Password must be at least 8 characters";
    else if (!/[A-Z]/.test(password)) errors.password = "Must contain at least one uppercase letter";
    else if (!/[0-9]/.test(password)) errors.password = "Must contain at least one number";

    if (referralCode && referralCode.trim().length < 4) errors.referralCode = "Invalid referral code";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;
    const { businessName, ownerName, email, phone, password, referralCode } = form;
    setLoading(true);
    setError(null);
    try {
      const res = await signupAPI({
        businessName,
        ownerName,
        email: email.trim().toLowerCase(),
        phone,
        password,
        referralCode: referralCode ? referralCode.trim().toUpperCase() : undefined,
      });

      await login(res.data.token, res.data.business);
      
    } catch (err) {
     console.log("SIGNUP ERROR FULL:", err);
console.log("SIGNUP RESPONSE:", err?.response?.data);

setError(
  err.response?.data?.message ||
  err.response?.data?.error ||
  "Signup failed"
);
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: "businessName", label: "Business Name", placeholder: "e.g. Spice Garden", icon: "business-outline" },
    { key: "ownerName", label: "Owner Name", placeholder: "Your full name", icon: "person-outline" },
    { key: "email", label: "Email Address", placeholder: "you@example.com", type: "email-address", icon: "mail-outline" },
    { key: "phone", label: "Phone Number", placeholder: "10-digit mobile number", type: "phone-pad", icon: "call-outline" },
    { 
  key: "password", 
  label: "Password", 
  placeholder: "Min 8 chars, e.g. Pass1234", // Explicit example
  secure: true, 
  icon: "lock-closed-outline" 
},
    { key: "referralCode", label: "Referral Code", placeholder: "Got a code?", icon: "gift-outline", optional: true },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView 
          contentContainerStyle={styles.scrollContainer} 
          showsVerticalScrollIndicator={false} 
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.responsiveWrapper}>
            <TouchableOpacity onPress={() => navigation.navigate("Login")} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={18} color={GREEN} />
              <Text style={styles.backText}>Back to Login</Text>
            </TouchableOpacity>

            <View style={styles.headingWrap}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join Servon and digitize your restaurant.</Text>
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorIcon}>⚠</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.formCard}>
              {fields.map((f, index) => (
                <View key={f.key} style={[styles.inputGroup, index === fields.length - 1 && { marginBottom: 0 }]}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>{f.label}</Text>
                    {f.optional && <Text style={styles.optionalBadge}>Optional</Text>}
                  </View>
                  <View style={[styles.inputWrap, fieldErrors[f.key] && styles.inputWrapError]}>
                    <Ionicons name={f.icon} size={16} color={fieldErrors[f.key] ? "#DC2626" : TEXT_MUTED} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, isWeb && { outlineStyle: 'none' }]}
                      value={form[f.key]}
                      onChangeText={(v) => setField(f.key, v)}
                      placeholder={f.placeholder}
                      placeholderTextColor="#B0A99F"
                      keyboardType={f.type || "default"}
                      secureTextEntry={f.secure || false}
                      autoCapitalize={f.key === "email" || f.key === "referralCode" ? "none" : "words"}
                      selectionColor={GREEN}
                    />
                  </View>
                  {fieldErrors[f.key] && (
                    <View style={styles.fieldErrorRow}>
                      <Ionicons name="alert-circle-outline" size={12} color="#DC2626" />
                      <Text style={styles.fieldErrorText}>{fieldErrors[f.key]}</Text>
                    </View>
                  )}
                </View>
              ))}

              <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleSignup} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>CREATE ACCOUNT</Text>}
              </TouchableOpacity>
            </View>
<View style={styles.loginRow}>
  <View style={styles.loginDivider} />
  <TouchableOpacity 
    activeOpacity={0.7} 
    onPress={() => navigation.navigate("Login")} // 🔥 FIX: Change goBack() to navigate("Login")
  >
    <Text style={styles.loginText}>
      Already have an account? <Text style={styles.loginLink}>Sign In</Text>
    </Text>
  </TouchableOpacity>
  <View style={styles.loginDivider} />
</View>
            <Text style={styles.footer}>© 2026 Servon</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const GREEN = "#10B981", BG = "#FAF8F5", CARD_BG = "#FFFFFF", BORDER = "#E8E2D9", TEXT_PRIMARY = "#1C1917", TEXT_MUTED = "#78716C";

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  scrollContainer: { 
    flexGrow: 1, 
    backgroundColor: BG,
    justifyContent: isWeb ? 'center' : 'flex-start',
  },
  responsiveWrapper: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
    ...Platform.select({
      web: {
        maxWidth: 500, // Slightly wider than login because there are more fields
        paddingTop: 20,
      },
      default: {
        paddingTop: 0,
      }
    })
  },
  backBtn: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingVertical: 16, paddingTop: 20, gap: 6 },
  backText: { fontSize: 14, color: GREEN, fontWeight: "600" },
  headingWrap: { marginBottom: 24 },
  title: { fontSize: 30, fontWeight: "900", color: TEXT_PRIMARY, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: TEXT_MUTED, marginTop: 6 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: "#FCA5A5" },
  errorIcon: { fontSize: 15, color: "#DC2626" },
  errorText: { color: "#DC2626", fontSize: 13, fontWeight: "500", flex: 1 },
  formCard: { 
    backgroundColor: CARD_BG, 
    borderRadius: 20, 
    padding: 24, 
    borderWidth: 1, 
    borderColor: BORDER, 
    elevation: 6, 
    gap: 20,
    // Add shadow for web premium feel
    shadowColor: "#A89880",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  inputGroup: { gap: 8 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 12, fontWeight: "700", color: TEXT_PRIMARY },
  optionalBadge: { fontSize: 10, color: TEXT_MUTED, backgroundColor: "#F3EFE8", paddingHorizontal: 8, borderRadius: 20 },
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: BORDER, borderRadius: 10, backgroundColor: BG, paddingHorizontal: 12, paddingVertical: 14 },
  inputIcon: { marginRight: 10 },
  inputWrapError: { borderColor: "#FCA5A5", backgroundColor: "#FFF5F5" },
  fieldErrorRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  fieldErrorText: { fontSize: 12, color: "#DC2626", fontWeight: "500" },
  input: { flex: 1, fontSize: 15, color: TEXT_PRIMARY },
  btn: { backgroundColor: GREEN, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 14, letterSpacing: 2.5 },
  loginRow: { flexDirection: "row", alignItems: "center", marginTop: 28, gap: 12 },
  loginDivider: { flex: 1, height: 1, backgroundColor: BORDER },
  loginText: { fontSize: 13, color: TEXT_MUTED },
  loginLink: { color: GREEN, fontWeight: "700" },
  footer: { textAlign: "center", fontSize: 11, color: "#A8A29E", marginTop: 28 },
});