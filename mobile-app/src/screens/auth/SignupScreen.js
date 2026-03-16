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
  Modal,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { signup as signupAPI, createPaymentOrder, verifyPayment } from "../../api";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export default function SignupScreen({ navigation }) {
  const { login } = useAuth();
  const [form, setForm] = useState({ businessName: "", ownerName: "", email: "", phone: "", password: "", referralCode: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [pendingToken, setPendingToken] = useState(null);
  const [pendingBusiness, setPendingBusiness] = useState(null);

  const setField = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSignup = async () => {
    const { businessName, ownerName, email, phone, password, referralCode } = form;
    if (!businessName || !ownerName || !email || !phone || !password) {
      setError("All fields are required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await signupAPI({ 
        businessName, 
        ownerName, 
        email: email.trim().toLowerCase(), 
        phone, 
        password,
        referralCode: referralCode ? referralCode.trim().toUpperCase() : undefined
      });
      setPendingToken(res.data.token);
      setPendingBusiness(res.data.business);
      setShowPaymentModal(true);
    } catch (err) {
      setError(err.response?.data?.error || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleActivateLater = async () => {
    setShowPaymentModal(false);
    await login(pendingToken, pendingBusiness);
  };

  const handleActivateNow = async () => {
    // In a real app, integrate Razorpay SDK here
    setShowPaymentModal(false);
    await login(pendingToken, pendingBusiness);
    // Navigate to Subscription screen to complete payment
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#4B5563" />
            <Text style={styles.backText}>Back to Login</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join Servon and digitize your restaurant.</Text>
          
          {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

          <View style={styles.form}>
            {[
              { key: "businessName", label: "Business Name", placeholder: "e.g. Spice Garden" },
              { key: "ownerName", label: "Owner Name", placeholder: "Your full name" },
              { key: "email", label: "Email Address", placeholder: "you@example.com", type: "email-address" },
              { key: "phone", label: "Phone Number", placeholder: "10-digit mobile number", type: "phone-pad" },
              { key: "password", label: "Password", placeholder: "Min 8 characters", secure: true },
              { key: "referralCode", label: "Referral Code (Optional)", placeholder: "Got a code? Paste here!" },
            ].map((f) => (
              <View key={f.key} style={styles.inputGroup}>
                <Text style={styles.label}>{f.label}</Text>
                <TextInput
                  style={styles.input}
                  value={form[f.key]}
                  onChangeText={(v) => setField(f.key, v)}
                  placeholder={f.placeholder}
                  placeholderTextColor="#9CA3AF"
                  keyboardType={f.type || "default"}
                  secureTextEntry={f.secure || false}
                  autoCapitalize={f.key === "email" || f.key === "referralCode" ? "none" : "words"}
                />
              </View>
            ))}

            <TouchableOpacity style={styles.btn} onPress={handleSignup} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Account</Text>}
            </TouchableOpacity>
          </View>

          {/* Payment Modal */}
          <Modal visible={showPaymentModal} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.modalBox}>
                <View style={styles.modalHeader}>
                  <Ionicons name="rocket" size={32} color="#10B981" />
                  <Text style={styles.modalTitle}>Activate Servon</Text>
                  <Text style={styles.modalSubtitle}>Start receiving orders instantly</Text>
                </View>
                
                <View style={styles.planBox}>
                  <Text style={styles.planName}>Premium Monthly</Text>
                  <Text style={styles.planPrice}>₹999<Text style={styles.planDuration}> / month</Text></Text>
                  <View style={styles.featuresList}>
                    <Text style={styles.planFeatures}>✓ Unlimited QR Ordering</Text>
                    <Text style={styles.planFeatures}>✓ Live Kitchen Dashboard</Text>
                    <Text style={styles.planFeatures}>✓ Sales Analytics & Export</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.modalBtnPrimary} onPress={handleActivateNow}>
                  <Text style={styles.modalBtnTextPrimary}>Activate Now — ₹999</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalBtnSecondary} onPress={handleActivateLater}>
                  <Text style={styles.modalBtnTextSecondary}>I'll activate later</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24 },
  
  backBtn: { flexDirection: "row", alignItems: "center", marginBottom: 24, alignSelf: "flex-start", padding: 4, marginLeft: -4 },
  backText: { fontSize: 15, color: "#4B5563", marginLeft: 6, fontWeight: "600" },
  
  title: { fontSize: 32, fontWeight: "900", color: "#111827", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: "#6B7280", marginTop: 6, marginBottom: 24, fontWeight: "500" },
  
  form: { gap: 4 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 },
  input: { borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, padding: 16, fontSize: 16, color: "#111827", backgroundColor: "#F9FAFB" },
  
  btn: { backgroundColor: "#111827", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  
  errorBox: { backgroundColor: "#FEF2F2", borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#FCA5A5" },
  errorText: { color: "#DC2626", fontSize: 14, fontWeight: "500", textAlign: "center" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(17, 24, 39, 0.6)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 32, paddingBottom: Platform.OS === 'ios' ? 40 : 32 },
  modalHeader: { alignItems: "center", marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: "900", color: "#111827", marginTop: 12 },
  modalSubtitle: { fontSize: 15, color: "#6B7280", marginTop: 4 },
  
  planBox: { backgroundColor: "#F9FAFB", borderRadius: 16, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: "#E5E7EB" },
  planName: { fontSize: 14, fontWeight: "700", color: "#4B5563", textTransform: "uppercase", letterSpacing: 0.5 },
  planPrice: { fontSize: 36, fontWeight: "900", color: "#111827", marginTop: 8 },
  planDuration: { fontSize: 16, fontWeight: "600", color: "#6B7280" },
  featuresList: { marginTop: 16, gap: 8 },
  planFeatures: { fontSize: 14, color: "#374151", fontWeight: "500" },
  
  modalBtnPrimary: { backgroundColor: "#111827", borderRadius: 12, padding: 16, alignItems: "center" },
  modalBtnTextPrimary: { color: "#fff", fontWeight: "700", fontSize: 16 },
  modalBtnSecondary: { alignItems: "center", marginTop: 20, paddingVertical: 8 },
  modalBtnTextSecondary: { fontSize: 15, color: "#6B7280", fontWeight: "600" },
});