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
    { key: "email", label: "Email Address", placeholder: "you@gmail.com", type: "email-address", icon: "mail-outline" },
    { key: "phone", label: "Phone Number", placeholder: "10-digit mobile number", type: "phone-pad", icon: "call-outline" },
    { 
      key: "password", 
      label: "Password", 
      placeholder: "Min 8 chars, e.g. Pass1234", 
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
              <Ionicons name="arrow-back" size={16} color={GREEN} />
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
                      placeholderTextColor="#A8A29E"
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
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>CREATE ACCOUNT</Text>}
              </TouchableOpacity>
            </View>

            <View style={styles.loginRow}>
              <View style={styles.loginDivider} />
              <TouchableOpacity 
                activeOpacity={0.7} 
                onPress={() => navigation.navigate("Login")}
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

const GREEN = "#10B981", BG = "#FAF8F5", CARD_BG = "#FFFFFF", BORDER = "#E2E8F0", TEXT_PRIMARY = "#0F172A", TEXT_MUTED = "#475569";

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
    paddingHorizontal: 20,
    paddingBottom: 40,
    ...Platform.select({
      web: {
        maxWidth: 480,
        paddingTop: 40,
      },
      default: {
        paddingTop: 10,
      }
    })
  },
  backBtn: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginBottom: 20, gap: 4, cursor: 'pointer' },
  backText: { fontSize: 14, color: GREEN, fontWeight: "600" },
  headingWrap: { marginBottom: 28 },
  title: { fontSize: 32, fontWeight: "800", color: TEXT_PRIMARY, letterSpacing: -0.75 },
  subtitle: { fontSize: 14, color: TEXT_MUTED, marginTop: 6, fontWeight: "400" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: "#FCA5A5" },
  errorIcon: { fontSize: 15, color: "#DC2626" },
  errorText: { color: "#DC2626", fontSize: 13, fontWeight: "500", flex: 1 },
  formCard: { 
    backgroundColor: CARD_BG, 
    borderRadius: 16, 
    padding: 28, 
    borderWidth: 1, 
    borderColor: BORDER, 
    gap: 20,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  inputGroup: { gap: 6 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 13, fontWeight: "600", color: TEXT_PRIMARY },
  optionalBadge: { fontSize: 10, color: TEXT_MUTED, backgroundColor: "#F1F5F9", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, fontWeight: "500" },
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 10, backgroundColor: "#FFFFFF", paddingHorizontal: 14, paddingVertical: 12 },
  inputIcon: { marginRight: 8 },
  inputWrapError: { borderColor: "#FCA5A5", backgroundColor: "#FFF5F5" },
  fieldErrorRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  fieldErrorText: { fontSize: 12, color: "#DC2626", fontWeight: "500" },
  input: { flex: 1, fontSize: 14, color: TEXT_PRIMARY, padding: 0 },
  btn: { backgroundColor: GREEN, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 8, cursor: 'pointer' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 14, letterSpacing: 0.5 },
  loginRow: { flexDirection: "row", alignItems: "center", marginTop: 32, gap: 12 },
  loginDivider: { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  loginText: { fontSize: 13, color: TEXT_MUTED },
  loginLink: { color: GREEN, fontWeight: "600" },
  footer: { textAlign: "center", fontSize: 12, color: "#94A3B8", marginTop: 32 },
});