import { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { sendOTP, verifyOTP, resetPassword } from "../../api";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const isWeb = Platform.OS === "web";

export default function ForgotPasswordScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState(""); 
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Resend Timer Logic
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleSendOTP = async () => {
    if (!email || !email.includes("@")) { 
      setError("Please enter a valid email address"); 
      return; 
    }
    setLoading(true); setError(null);
    try {
      await sendOTP(email.trim().toLowerCase());
      setTimer(60);
      setStep(2);
    } catch (err) { 
      setError(err.response?.data?.error || "Failed to send code"); 
    } 
    finally { setLoading(false); }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) { setError("Enter the 6-digit code"); return; }
    setLoading(true); setError(null);
    try {
      const res = await verifyOTP(email.trim().toLowerCase(), otp);
      setResetToken(res.data.resetToken);
      setStep(3);
    } catch (err) { setError(err.response?.data?.error || "Invalid Code"); } 
    finally { setLoading(false); }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true); setError(null);
    try {
      await resetPassword(resetToken, newPassword);
      setSuccess(true);
    } catch (err) { setError(err.response?.data?.error || "Reset failed"); } 
    finally { setLoading(false); }
  };

  if (success) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.responsiveWrapper}>
          <View style={styles.successContainer}>
            <View style={styles.successIconBox}>
              <Ionicons name="checkmark-circle" size={80} color="#10B981" />
            </View>
            <Text style={styles.successTitle}>Password Reset!</Text>
            <Text style={styles.successSubtitle}>You can now securely log in with your new password.</Text>
            <TouchableOpacity style={styles.mainBtn} onPress={() => navigation.navigate("Login")}>
              <Text style={styles.mainBtnText}>Return to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView 
          contentContainerStyle={[styles.scrollContainer, { paddingTop: insets.top + 20 }]} 
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.responsiveWrapper}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color="#111827" />
              <Text style={styles.backText}>Back to Login</Text>
            </TouchableOpacity>

            <View style={styles.headerBox}>
               <Text style={styles.title}>Reset Password</Text>
               <Text style={styles.subtitle}>
                  {step === 1 && "Enter your email to receive a verification code."}
                  {step === 2 && `We've sent a 6-digit code to ${email}`}
                  {step === 3 && "Create a new strong password for your account."}
               </Text>
            </View>
            
            {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

            {step === 1 && (
              <View style={styles.stepContainer}>
                <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                <TextInput
                  style={[styles.input, isWeb && { outlineStyle: 'none' }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@restaurant.com"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.mainBtn} onPress={handleSendOTP} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainBtnText}>Send Code</Text>}
                </TouchableOpacity>
              </View>
            )}

            {step === 2 && (
              <View style={styles.stepContainer}>
                <Text style={styles.inputLabel}>VERIFICATION CODE</Text>
                <TextInput
                  style={[styles.input, styles.otpInput, isWeb && { outlineStyle: 'none' }]}
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="000000"
                  placeholderTextColor="#D1D5DB"
                  keyboardType="number-pad"
                  maxLength={6}
                />
                
                <TouchableOpacity style={styles.mainBtn} onPress={handleVerifyOTP} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainBtnText}>Verify & Continue</Text>}
                </TouchableOpacity>

                <View style={styles.resendContainer}>
                  <Text style={styles.resendText}>Didn't receive code? </Text>
                  {timer > 0 ? (
                      <Text style={styles.timerText}>Resend in {timer}s</Text>
                  ) : (
                      <TouchableOpacity onPress={handleSendOTP}>
                          <Text style={styles.resendLink}>Resend Code</Text>
                      </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {step === 3 && (
              <View style={styles.stepContainer}>
                <Text style={styles.inputLabel}>NEW PASSWORD</Text>
                <TextInput
                  style={[styles.input, isWeb && { outlineStyle: 'none' }]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Min. 6 characters"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                />
                <TouchableOpacity style={styles.mainBtn} onPress={handleResetPassword} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainBtnText}>Update Password</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  scrollContainer: { 
    flexGrow: 1,
    justifyContent: isWeb ? 'center' : 'flex-start',
  },
  responsiveWrapper: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingBottom: 40,
    ...Platform.select({
      web: {
        maxWidth: 480,
      }
    })
  },
  backBtn: { flexDirection: "row", alignItems: "center", marginBottom: 32, alignSelf: "flex-start", marginLeft: -8 },
  backText: { fontSize: 16, color: "#111827", fontWeight: "700" },
  headerBox: { marginBottom: 32 },
  title: { fontSize: 32, fontWeight: "900", color: "#111827", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: "#6B7280", marginTop: 8, lineHeight: 22 },
  stepContainer: { width: '100%' },
  inputLabel: { fontSize: 12, fontWeight: "800", color: "#10B981", letterSpacing: 1, marginBottom: 10 },
  input: { 
    borderWidth: 1.5, 
    borderColor: "#E5E7EB", 
    borderRadius: 14, 
    padding: 18, 
    fontSize: 16, 
    color: "#111827", 
    backgroundColor: "#F9FAFB", 
    marginBottom: 24 
  },
  otpInput: { 
    textAlign: "center", 
    fontSize: 28, 
    letterSpacing: isWeb ? 8 : 12, 
    fontWeight: "800", 
    color: "#111827" 
  },
  mainBtn: { backgroundColor: "#111827", borderRadius: 14, padding: 18, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  mainBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  errorBox: { backgroundColor: "#FEF2F2", borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: "#FCA5A5", flexDirection: 'row', alignItems: 'center' },
  errorText: { color: "#DC2626", fontSize: 14, fontWeight: "600", textAlign: "center", flex: 1 },
  resendContainer: { flexDirection: "row", justifyContent: "center", marginTop: 24, alignItems: 'center' },
  resendText: { color: "#6B7280", fontSize: 14, fontWeight: "500" },
  resendLink: { color: "#10B981", fontSize: 14, fontWeight: "800" },
  timerText: { color: "#9CA3AF", fontSize: 14, fontWeight: "700" },
  successContainer: { justifyContent: "center", alignItems: "center", paddingVertical: 40 },
  successIconBox: { marginBottom: 24 },
  successTitle: { fontSize: 28, fontWeight: "900", color: "#111827", marginBottom: 12 },
  successSubtitle: { fontSize: 16, color: "#6B7280", textAlign: "center", marginBottom: 32, lineHeight: 24 },
});