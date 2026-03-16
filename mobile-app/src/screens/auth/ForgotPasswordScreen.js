import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { sendOTP, verifyOTP, resetPassword } from "../../api";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export default function ForgotPasswordScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  
  // CHANGED state from phone to email
  const [email, setEmail] = useState(""); 
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSendOTP = async () => {
    if (!email || !email.includes("@")) { 
      setError("Please enter a valid email address"); 
      return; 
    }
    setLoading(true); setError(null);
    try {
      await sendOTP(email.trim().toLowerCase());
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
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={styles.successContainer}>
          <View style={styles.successIconBox}>
            <Ionicons name="checkmark-circle" size={80} color="#10B981" />
          </View>
          <Text style={styles.successTitle}>Password Reset!</Text>
          <Text style={styles.successSubtitle}>You can now securely log in with your new password.</Text>
          <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate("Login")}>
            <Text style={styles.btnText}>Return to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>
          
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#4B5563" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Reset Password</Text>
          
          {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

          {step === 1 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepLabel}>Step 1: Enter your registered email address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@restaurant.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.btn} onPress={handleSendOTP} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send OTP</Text>}
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepLabel}>Step 2: Enter the 6-digit code sent to {email}</Text>
              <TextInput
                style={styles.input}
                value={otp}
                onChangeText={setOtp}
                placeholder="000000"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
                fontSize={24}
                letterSpacing={8}
              />
              <TouchableOpacity style={styles.btn} onPress={handleVerifyOTP} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify Code</Text>}
              </TouchableOpacity>
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepLabel}>Step 3: Secure your account</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
              />
              <TouchableOpacity style={styles.btn} onPress={handleResetPassword} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Update Password</Text>}
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  backBtn: { flexDirection: "row", alignItems: "center", marginBottom: 24, alignSelf: "flex-start", padding: 4, marginLeft: -4 },
  backText: { fontSize: 15, color: "#4B5563", marginLeft: 6, fontWeight: "600" },
  title: { fontSize: 32, fontWeight: "900", color: "#111827", letterSpacing: -0.5, marginBottom: 24 },
  stepContainer: { gap: 4 },
  stepLabel: { fontSize: 15, color: "#4B5563", marginBottom: 12, fontWeight: "500" },
  input: { borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, padding: 16, fontSize: 16, color: "#111827", backgroundColor: "#F9FAFB", marginBottom: 20 },
  btn: { backgroundColor: "#111827", borderRadius: 12, padding: 16, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  errorBox: { backgroundColor: "#FEF2F2", borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#FCA5A5" },
  errorText: { color: "#DC2626", fontSize: 14, fontWeight: "500", textAlign: "center" },
  successContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  successIconBox: { marginBottom: 24 },
  successTitle: { fontSize: 28, fontWeight: "900", color: "#111827", marginBottom: 12 },
  successSubtitle: { fontSize: 16, color: "#6B7280", textAlign: "center", marginBottom: 32, lineHeight: 24 },
});