import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getReferrals, redeemReferrals } from "../api";

const IS_WEB = Platform.OS === "web";
const CONTENT_MAX = 1100;

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
      Alert.alert("Code Copied", `Your code ${data.referralCode} has been copied!`);
    }
  };

  const handleRedeem = async () => {
    setRedeeming(true);
    try {
      const res = await redeemReferrals();
      Alert.alert("Success! 🎉", res.data.message);
      loadData(); 
    } catch (err) {
      Alert.alert("Cannot Redeem", err.response?.data?.error || "An error occurred.");
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  const successCount = data?.successCount || 0;
  const progressPercent = Math.min((successCount / 5) * 100, 100);
  const canRedeem = successCount >= 5;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FAF8F5" }}>
      {/* Header */}
      <View style={styles.navHeader}>
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="chevron-back" size={24} color="#0F172A" />
            <Text style={{ fontSize: 16, fontWeight: "600", marginLeft: 4, color: "#0F172A" }}>Profile</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#0F172A" }}>Referral Program</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[
        styles.scrollContent,
        IS_WEB && { alignSelf: 'center', width: '100%', maxWidth: 800 }
      ]}>
        
        {/* Hero Section */}
        <View style={styles.heroBox}>
          <View style={styles.iconCircle}>
            <Ionicons name="gift" size={32} color="#10B981" />
          </View>
          <Text style={styles.heroTitle}>Invite & Earn</Text>
          <Text style={styles.heroSub}>
            Share Servon with your fellow restaurateurs. When 5 of them subscribe, you get <Text style={{fontWeight: '800', color: '#10B981'}}>1 Month Premium FREE!</Text>
          </Text>
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
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#1E293B" }}>Your Progress</Text>
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
            <Ionicons name="people-outline" size={40} color="#94A3B8" />
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
        <View style={{height: 40}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStatusColor = (status) => {
  switch (status) {
    case "SUCCESS": return { bg: "#DCFCE7", text: "#059669" }; 
    case "PENDING": return { bg: "#FEF3C7", text: "#D97706" }; 
    case "EXPIRED": return { bg: "#FEE2E2", text: "#DC2626" }; 
    case "REDEEMED": return { bg: "#F1F5F9", text: "#64748B" }; 
    default: return { bg: "#F1F5F9", text: "#64748B" };
  }
};

const styles = StyleSheet.create({
  navHeader: { 
    borderBottomWidth: 1, 
    borderBottomColor: "#E2E8F0", 
    backgroundColor: "#fff", 
    paddingVertical: 12 
  },
  headerInner: {
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center",
    paddingHorizontal: 16,
    maxWidth: CONTENT_MAX,
    alignSelf: 'center',
    width: '100%'
  },
  scrollContent: { padding: 20 },
  heroBox: { alignItems: "center", marginBottom: 32, paddingVertical: 20 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#DCFCE7", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  heroTitle: { fontSize: 28, fontWeight: "900", color: "#0F172A", marginBottom: 8 },
  heroSub: { fontSize: 14, color: "#64748B", textAlign: "center", lineHeight: 22, paddingHorizontal: 10 },

  codeBox: { backgroundColor: "#fff", padding: 24, borderRadius: 24, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 24, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 15, elevation: 2 },
  codeLabel: { fontSize: 11, fontWeight: "800", color: "#64748B", textTransform: "uppercase", marginBottom: 16, letterSpacing: 1 },
  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 16, paddingLeft: 16, paddingRight: 6, paddingVertical: 6 },
  codeText: { fontSize: 20, fontWeight: "900", color: "#0F172A", letterSpacing: 2 },
  copyBtn: { backgroundColor: "#0F172A", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  copyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  progressBox: { backgroundColor: "#fff", padding: 24, borderRadius: 24, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 40, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 15, elevation: 2 },
  progressBarBg: { height: 12, backgroundColor: "#F1F5F9", borderRadius: 6, overflow: "hidden", marginBottom: 20 },
  progressBarFill: { height: "100%", backgroundColor: "#10B981", borderRadius: 6 },
  redeemBtn: { backgroundColor: "#10B981", padding: 18, borderRadius: 16, alignItems: "center" },
  redeemBtnDisabled: { backgroundColor: "#E2E8F0" },
  redeemBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  historyTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A", marginBottom: 16 },
  historyCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fff", padding: 18, borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0" },
  historyName: { fontSize: 16, fontWeight: "700", color: "#1E293B", marginBottom: 4 },
  historyDate: { fontSize: 12, color: "#64748B" },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: "800" },

  emptyBox: { alignItems: "center", padding: 40, backgroundColor: "#fff", borderRadius: 24, borderWidth: 2, borderColor: "#E2E8F0", borderStyle: "dashed" },
  emptyText: { marginTop: 12, color: "#94A3B8", fontSize: 14, fontWeight: "500" }
});