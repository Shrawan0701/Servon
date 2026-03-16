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
import { login as loginAPI } from "../../api";
import { SafeAreaView } from "react-native-safe-area-context";

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
      // 1. Comment out the old API call that relies on the broken .env
      // const res = await loginAPI({ email: email.trim().toLowerCase(), password });

      // 2. Force the request directly to your working IP address
      const response = await fetch("http://10.75.23.38:5000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(), 
          password: password 
        }),
      });

      const data = await response.json();

      // Catch backend errors (like wrong password)
      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      // 3. Pass the successful data to your AuthContext
      await login(data.token, data.business);

    } catch (err) {
      // We changed this from err.response.data to err.message because we are using fetch
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          
          <View style={styles.headerContainer}>
            <Text style={styles.brandText}>
              Servon<Text style={styles.brandAccent}>.</Text>
            </Text>
            <Text style={styles.subtitle}>Business Dashboard</Text>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => navigation.navigate("ForgotPassword")}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Log In</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate("Signup")}>
              <Text style={styles.secondaryBtnText}>
                New here? <Text style={styles.secondaryBtnLink}>Create Account</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", padding: 24 },
  headerContainer: { alignItems: "center", marginBottom: 40 },
  brandText: { fontSize: 40, fontWeight: "900", color: "#111827", letterSpacing: -1 },
  brandAccent: { color: "#10B981" },
  subtitle: { fontSize: 16, color: "#6B7280", marginTop: 4, fontWeight: "500" },
  
  form: { gap: 4 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 },
  input: { 
    borderWidth: 1.5, 
    borderColor: "#E5E7EB", 
    borderRadius: 12, 
    padding: 16, 
    fontSize: 16, 
    color: "#111827", 
    backgroundColor: "#F9FAFB" 
  },
  
  forgotBtn: { alignSelf: "flex-end", marginBottom: 24, paddingVertical: 4 },
  forgotText: { fontSize: 14, color: "#10B981", fontWeight: "600" },
  
  btn: { backgroundColor: "#111827", borderRadius: 12, padding: 16, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  
  secondaryBtn: { alignItems: "center", marginTop: 24, paddingVertical: 8 },
  secondaryBtnText: { fontSize: 15, color: "#6B7280", fontWeight: "500" },
  secondaryBtnLink: { color: "#111827", fontWeight: "700" },
  
  errorBox: { backgroundColor: "#FEF2F2", borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#FCA5A5" },
  errorText: { color: "#DC2626", fontSize: 14, fontWeight: "500", textAlign: "center" },
});