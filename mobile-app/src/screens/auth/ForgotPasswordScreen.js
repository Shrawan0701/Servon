import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
  const [showPassword, setShowPassword] = useState(false);
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
    setLoading(true);
    setError(null);
    try {
      await sendOTP(email.trim().toLowerCase());
      setTimer(60);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError("Enter the complete 6-digit code");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await verifyOTP(email.trim().toLowerCase(), otp);
      setResetToken(res.data.resetToken);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await resetPassword(resetToken, newPassword);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  // Render Step Icon Header
  const renderStepBadge = () => {
    let iconName = "mail-unread-outline";
    let badgeBg = "rgba(0, 128, 96, 0.08)";
    let iconColor = GREEN;

    if (step === 2) {
      iconName = "keypad-outline";
      badgeBg = "#EFF6FF";
      iconColor = "#3B82F6";
    } else if (step === 3) {
      iconName = "lock-closed-outline";
      badgeBg = "#F3E8FF";
      iconColor = "#8B5CF6";
    }

    return (
      <View style={[styles.badgeBox, { backgroundColor: badgeBg }]}>
        <Ionicons name={iconName} size={28} color={iconColor} />
      </View>
    );
  };

  if (success) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.responsiveWrapper}>
            <View style={styles.cardContainer}>
              <View style={[styles.badgeBox, { backgroundColor: "rgba(0, 128, 96, 0.08)" }]}>
                <Ionicons name="shield-checkmark" size={36} color={GREEN} />
              </View>
              
              <Text style={styles.title}>Password Reset!</Text>
              <Text style={styles.subtitle}>
                Your password has been updated successfully. You can now log in with your new password.
              </Text>

              <TouchableOpacity
                style={styles.mainBtn}
                onPress={() => navigation.navigate("Login")}
              >
                <Text style={styles.mainBtnText}>Login</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContainer,
            { paddingTop: insets.top + 20 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.responsiveWrapper}>
            {/* Top Navigation */}
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={18} color={TEXT_PRIMARY} />
              <Text style={styles.backText}>Back to Login</Text>
            </TouchableOpacity>

            {/* Main Styled Card */}
            <View style={styles.cardContainer}>
              
              {/* Progress Indicator */}
              <View style={styles.progressRow}>
                <View style={[styles.stepBar, step >= 1 && styles.stepBarActive]} />
                <View style={[styles.stepBar, step >= 2 && styles.stepBarActive]} />
                <View style={[styles.stepBar, step >= 3 && styles.stepBarActive]} />
              </View>

              {/* Step Icon Badge */}
              {renderStepBadge()}

              {/* Header Box */}
              <View style={styles.headerBox}>
                <Text style={styles.title}>
                  {step === 1 && "Forgot Password?"}
                  {step === 2 && "Enter Verification Code"}
                  {step === 3 && "Set New Password"}
                </Text>
                <Text style={styles.subtitle}>
                  {step === 1 && "No worries! Enter your registered email address below to receive a 6-digit recovery code."}
                  {step === 2 && `We sent a 6-digit verification code to `}
                  {step === 2 && <Text style={styles.emailHighlight}>{email}</Text>}
                  {step === 3 && "Create a new strong password to secure your account."}
                </Text>
              </View>

              {/* Error Alert Box */}
              {error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginRight: 8 }} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Step 1: Request OTP */}
              {step === 1 && (
                <View style={styles.stepContainer}>
                  <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={18} color={TEXT_MUTED} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, isWeb && { outlineStyle: "none" }]}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="you@restaurant.com"
                      placeholderTextColor="#B0A99F"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.mainBtn}
                    onPress={handleSendOTP}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.mainBtnText}>Send Code</Text>
                        <Ionicons name="arrow-forward" size={16} color="#FFF" style={{ marginLeft: 6 }} />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Step 2: Verify OTP */}
              {step === 2 && (
                <View style={styles.stepContainer}>
                  <Text style={styles.inputLabel}>6-DIGIT VERIFICATION CODE</Text>
                  <TextInput
                    style={[
                      styles.input,
                      styles.otpInput,
                      isWeb && { outlineStyle: "none" },
                    ]}
                    value={otp}
                    onChangeText={setOtp}
                    placeholder="000000"
                    placeholderTextColor="#B0A99F"
                    keyboardType="number-pad"
                    maxLength={6}
                  />

                  <TouchableOpacity
                    style={styles.mainBtn}
                    onPress={handleVerifyOTP}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.mainBtnText}>Verify & Continue</Text>
                    )}
                  </TouchableOpacity>

                  <View style={styles.resendContainer}>
                    <Text style={styles.resendText}>Didn't receive the code? </Text>
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

              {/* Step 3: Set New Password */}
              {step === 3 && (
                <View style={styles.stepContainer}>
                  <Text style={styles.inputLabel}>NEW PASSWORD</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={18} color={TEXT_MUTED} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, isWeb && { outlineStyle: "none" }]}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Minimum 6 characters"
                      placeholderTextColor="#B0A99F"
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity 
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeIcon}
                    >
                      <Ionicons 
                        name={showPassword ? "eye-off-outline" : "eye-outline"} 
                        size={18} 
                        color={TEXT_MUTED} 
                      />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.mainBtn}
                    onPress={handleResetPassword}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.mainBtnText}>Update Password</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const GREEN = "#008060";
const BG = "#FAF8F5";
const CARD_BG = "#FFFFFF";
const BORDER = "#E8E2D9";
const TEXT_PRIMARY = "#1C1917";
const TEXT_MUTED = "#78716C";

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: BG },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 32,
    backgroundColor: BG,
  },
  responsiveWrapper: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 20,
    ...Platform.select({
      web: {
        maxWidth: 480,
      },
    }),
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  backText: { fontSize: 13, color: TEXT_PRIMARY, fontWeight: "600", marginLeft: 6 },
  cardContainer: {
    width: "100%",
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
    alignItems: "center",
  },
  progressRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  stepBar: {
    height: 4,
    flex: 1,
    backgroundColor: "#EFECE6",
    borderRadius: 2,
    marginHorizontal: 3,
  },
  stepBarActive: {
    backgroundColor: GREEN,
  },
  badgeBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  headerBox: { marginBottom: 20, alignItems: "center" },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginTop: 6,
    lineHeight: 20,
    textAlign: "center",
  },
  emailHighlight: {
    color: TEXT_PRIMARY,
    fontWeight: "700",
  },
  stepContainer: { width: "100%" },
  inputLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: GREEN,
    letterSpacing: 2,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    backgroundColor: BG,
    marginBottom: 18,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  eyeIcon: {
    padding: 6,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: TEXT_PRIMARY,
    fontWeight: "500",
  },
  otpInput: {
    textAlign: "center",
    fontSize: 24,
    letterSpacing: isWeb ? 10 : 14,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 18,
  },
  mainBtn: {
    backgroundColor: "#0F172A",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
  },
  mainBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13, letterSpacing: 1.5 },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  errorText: { color: "#DC2626", fontSize: 12, fontWeight: "600", flex: 1 },
  resendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 18,
    alignItems: "center",
  },
  resendText: { color: TEXT_MUTED, fontSize: 13, fontWeight: "500" },
  resendLink: { color: GREEN, fontSize: 13, fontWeight: "700" },
  timerText: { color: "#A8A29E", fontSize: 13, fontWeight: "600" },
});