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
    { key: "ownerName", label: " Name", placeholder: "Your name", icon: "person-outline" },
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
          {/* Main Layout Container matching Login Screen */}
          <View style={styles.centeredWrapper}>
            
            {/* Top Brand Logo Branding */}
            <View style={styles.brandHeaderWrap}>
              <Text style={styles.brandLogoText}>Servon<Text style={{ color: GREEN }}>.</Text></Text>
              <View style={styles.brandSubLineRow}>
                <View style={styles.subLineDivider} />
                <Text style={styles.brandSubText}>BUSINESS SUITE</Text>
                <View style={styles.subLineDivider} />
              </View>
            </View>

            {/* Clean Centered Floating Card Frame */}
            <View style={styles.formCard}>
              <View style={styles.headingWrap}>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>Sign up to digitize your account</Text>
              </View>

              {error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#DC2626" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Stacked Form Fields Layout */}
              <View style={styles.fieldsStack}>
                {fields.map((f) => (
                  <View key={f.key} style={styles.inputGroup}>
                    <View style={styles.labelRow}>
                      <Text style={styles.label}>{f.label.toUpperCase()}</Text>
                      {f.optional && <Text style={styles.optionalBadge}>Optional</Text>}
                    </View>
                    <View style={[styles.inputWrap, fieldErrors[f.key] && styles.inputWrapError]}>
                      <Ionicons name={f.icon} size={16} color={fieldErrors[f.key] ? "#DC2626" : "#A8A29E"} style={styles.inputIcon} />
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
                        <Text style={styles.fieldErrorText}>{fieldErrors[f.key]}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>

              {/* High Contrast Black Action Button matches Login style */}
              <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleSignup} disabled={loading} activeOpacity={0.9}>
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>SIGN UP</Text>}
              </TouchableOpacity>

              {/* Bottom Navigation Alternate Link */}
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
            </View>

            <Text style={styles.footer}>© 2026 Servon</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const GREEN = "#10B981", BG = "#FAF8F5", CARD_BG = "#FFFFFF", BORDER = "#E2E8F0", TEXT_PRIMARY = "#1E1E1E", TEXT_MUTED = "#6B7280";

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  scrollContainer: { 
    flexGrow: 1, 
    backgroundColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centeredWrapper: {
    width: '100%',
    maxWidth: 460,
    paddingHorizontal: 20,
    paddingVertical: 40,
    alignItems: 'center',
  },
  brandHeaderWrap: {
    alignItems: 'center',
    marginBottom: 32,
    width: '100%',
  },
  brandLogoText: {
    fontSize: 36,
    fontWeight: "900",
    color: "#1E1E1E",
    letterSpacing: -1,
  },
  brandSubLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    width: '70%',
  },
  subLineDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  brandSubText: {
    fontSize: 10,
    fontWeight: "700",
    color: GREEN,
    letterSpacing: 2,
  },
  formCard: { 
    backgroundColor: CARD_BG, 
    borderRadius: 24, 
    padding: 36, 
    width: '100%',
    borderWidth: 1, 
    borderColor: '#F1F5F9', 
    shadowColor: "#1E1E1E",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 4,
  },
  headingWrap: { 
    marginBottom: 24,
  },
  title: { 
    fontSize: 26, 
    fontWeight: "800", 
    color: TEXT_PRIMARY, 
    letterSpacing: -0.5 
  },
  subtitle: { 
    fontSize: 14, 
    color: TEXT_MUTED, 
    marginTop: 4, 
    fontWeight: "400" 
  },
  errorBox: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 8, 
    backgroundColor: "#FEF2F2", 
    borderRadius: 10, 
    padding: 12, 
    marginBottom: 20, 
    borderWidth: 1, 
    borderColor: "#FCA5A5" 
  },
  errorText: { color: "#DC2626", fontSize: 13, fontWeight: "500", flex: 1 },
  fieldsStack: {
    gap: 16,
    marginBottom: 24,
  },
  inputGroup: { gap: 6 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 11, fontWeight: "700", color: GREEN, letterSpacing: 0.5 },
  optionalBadge: { fontSize: 10, color: TEXT_MUTED, fontStyle: 'italic' },
  inputWrap: { 
    flexDirection: "row", 
    alignItems: "center", 
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "transparent", 
    paddingHorizontal: 4, 
    paddingVertical: 10 
  },
  inputIcon: { marginRight: 10, opacity: 0.7 },
  inputWrapError: { borderBottomColor: "#DC2626" },
  fieldErrorRow: { marginTop: 4 },
  fieldErrorText: { fontSize: 11, color: "#DC2626", fontWeight: "500" },
  input: { flex: 1, fontSize: 14, color: TEXT_PRIMARY, padding: 0 },
  
  // Sleek solid dark background style matching your Login Screen button
  btn: { 
    backgroundColor: "#1E1E1E", 
    borderRadius: 12, 
    paddingVertical: 15, 
    alignItems: "center", 
    marginTop: 8,
    cursor: 'pointer',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 14, letterSpacing: 1 },
  
  loginRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginTop: 24, 
    justifyContent: 'center' 
  },
  loginText: { fontSize: 13, color: TEXT_MUTED },
  loginLink: { color: GREEN, fontWeight: "700" },
  footer: { textAlign: "center", fontSize: 12, color: "#94A3B8", marginTop: 32 },
});