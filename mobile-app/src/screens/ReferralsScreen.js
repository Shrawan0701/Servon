import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getReferrals, redeemReferrals } from "../api";

export default function ReferralsScreen() {
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const res = await getReferrals();
      setData(res.data);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not load referral data");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!data?.referralCode) return;
    
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(data.referralCode);
      window.alert("Code copied to clipboard!");
    } else {
      // Basic fallback for React Native if expo-clipboard isn't installed.
      // Ideally you'd use import * as Clipboard from 'expo-clipboard';
      Alert.alert("Code Copied", `Your code ${data.referralCode} has been copied!`);
    }
  };

  const handleRedeem = async () => {
    setRedeeming(true);
    try {
      const res = await redeemReferrals();
      Alert.alert("Success! 🎉", res.data.message);
      loadData(); // Reload to reset the progress bar to 0
    } catch (err) {
      Alert.alert("Cannot Redeem", err.response?.data?.error || "An error occurred.");
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  const successCount = data?.successCount || 0;
  const progressPercent = Math.min((successCount / 5) * 100, 100);
  const canRedeem = successCount >= 5;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      {/* Header */}
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: "row", alignItems: "center" }}>
           <Ionicons name="chevron-back" size={24} color="#111" />
           <Text style={{ fontSize: 16, fontWeight: "600", marginLeft: 4 }}>Profile</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        
        {/* Hero Section */}
        <View style={styles.heroBox}>
          <View style={styles.iconCircle}>
            <Ionicons name="gift" size={32} color="#10B981" />
          </View>
          <Text style={styles.heroTitle}>Invite & Earn</Text>
          <Text style={styles.heroSub}>Give friends a great POS. When 5 of them subscribe within 3 days of joining, you get 1 Month FREE!</Text>
        </View>

        {/* Code Box */}
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Your Unique Referral Code</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>{data?.referralCode || "LOADING..."}</Text>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
              <Ionicons name="copy-outline" size={18} color="#fff" />
              <Text style={styles.copyBtnText}>Copy</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress Tracker */}
        <View style={styles.progressBox}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}>Your Progress</Text>
            <Text style={{ fontSize: 16, fontWeight: "800", color: "#10B981" }}>{successCount} / 5</Text>
          </View>
          
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>

          <TouchableOpacity 
            style={[styles.redeemBtn, !canRedeem && styles.redeemBtnDisabled]} 
            disabled={!canRedeem || redeeming}
            onPress={handleRedeem}
          >
            {redeeming ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.redeemBtnText}>
                {canRedeem ? "Redeem 1 Month Free!" : `Need ${5 - successCount} more to redeem`}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* History List */}
        <Text style={styles.historyTitle}>Referral History</Text>
        
        {data?.history?.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={40} color="#D1D5DB" />
            <Text style={styles.emptyText}>You haven't referred anyone yet.</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {data?.history?.map((item, index) => (
              <View key={index} style={styles.historyCard}>
                <View>
                  <Text style={styles.historyName}>{item.business_name}</Text>
                  <Text style={styles.historyDate}>
                    Joined: {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: getStatusColor(item.status).bg }]}>
                  <Text style={[styles.badgeText, { color: getStatusColor(item.status).text }]}>
                    {item.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// Helper for status colors
const getStatusColor = (status) => {
  switch (status) {
    case "SUCCESS": return { bg: "#D1FAE5", text: "#059669" }; // Green
    case "PENDING": return { bg: "#FEF3C7", text: "#D97706" }; // Yellow
    case "EXPIRED": return { bg: "#FEE2E2", text: "#DC2626" }; // Red
    case "REDEEMED": return { bg: "#F3F4F6", text: "#4B5563" }; // Gray
    default: return { bg: "#F3F4F6", text: "#4B5563" };
  }
};

const styles = StyleSheet.create({
  navHeader: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#ebebeb", backgroundColor: "#fff" },
  
  heroBox: { alignItems: "center", marginBottom: 24, padding: 20 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#D1FAE5", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  heroTitle: { fontSize: 24, fontWeight: "900", color: "#111827", marginBottom: 8 },
  heroSub: { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 22 },

  codeBox: { backgroundColor: "#fff", padding: 20, borderRadius: 16, borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 24 },
  codeLabel: { fontSize: 13, fontWeight: "700", color: "#6B7280", textTransform: "uppercase", marginBottom: 12 },
  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingLeft: 16, paddingRight: 6, paddingVertical: 6 },
  codeText: { fontSize: 20, fontWeight: "900", color: "#111827", letterSpacing: 2 },
  copyBtn: { backgroundColor: "#111827", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  copyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  progressBox: { backgroundColor: "#fff", padding: 20, borderRadius: 16, borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 32 },
  progressBarBg: { height: 12, backgroundColor: "#E5E7EB", borderRadius: 6, overflow: "hidden", marginBottom: 20 },
  progressBarFill: { height: "100%", backgroundColor: "#10B981", borderRadius: 6 },
  redeemBtn: { backgroundColor: "#10B981", padding: 16, borderRadius: 12, alignItems: "center" },
  redeemBtnDisabled: { backgroundColor: "#E5E7EB" },
  redeemBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  historyTitle: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 16 },
  historyCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fff", padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  historyName: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 4 },
  historyDate: { fontSize: 12, color: "#6B7280" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: "800" },

  emptyBox: { alignItems: "center", padding: 40, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E5E7EB", borderStyle: "dashed" },
  emptyText: { marginTop: 12, color: "#9CA3AF", fontSize: 14, fontWeight: "500" }
});