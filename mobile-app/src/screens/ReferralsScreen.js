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
import { getReferralStats, redeemReferralReward } from "../api";

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
      const res = await getReferralStats();
      setData(res.data);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not load referral data");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!data?.referral_code) return;
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(data.referral_code);
      window.alert("Code copied to clipboard!");
    } else {
      Alert.alert("Code Copied", `Your code ${data.referral_code} has been copied!`);
    }
  };

  const handleRedeem = async () => {
    setRedeeming(true);
    try {
      const res = await redeemReferralReward();
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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FAF8F5" }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  const stats = data?.stats || {};
  const successful = stats.successful || 0;
  const pending = stats.pending || 0;
  const total = stats.total || 0;

  const rewards = data?.rewards || {};
  const availableRewards = rewards.available || 0;
  const earnedRewards = rewards.earned || 0;
  const usedRewards = rewards.used || 0;

  const isCooldownActive = data?.isCooldownActive || false;
  const cooldownEnds = data?.cooldownEnds ? new Date(data.cooldownEnds) : null;

  const referralsForNextReward = 2 - (successful % 2 === 0 ? 0 : 1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FAF8F5" }}>
      {/* Header */}
      <View style={styles.navHeader}>
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Referral Program</Text>
          <View style={{ width: 60 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={[
        styles.scrollContent,
        IS_WEB && { alignSelf: 'center', width: '100%', maxWidth: 800 }
      ]}>

        {/* Hero Section */}
        <View style={styles.heroBox}>
          <View style={styles.iconCircle}>
            <Ionicons name="gift" size={30} color="#10B981" />
          </View>
          <Text style={styles.heroTitle}>Invite & Earn</Text>
          <Text style={styles.heroSub}>
            Share Servon with fellow restaurateurs. For every{" "}
            <Text style={styles.heroHighlight}>2 successful referrals</Text>, get{" "}
            <Text style={styles.heroHighlight}>1 Month Premium FREE!</Text>
          </Text>
        </View>

        {/* Code Box */}
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Your Unique Referral Code</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>{data?.referral_code || "LOADING..."}</Text>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} activeOpacity={0.8}>
              <Ionicons name="copy-outline" size={17} color="#fff" />
              <Text style={styles.copyBtnText}>Copy</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: "#DCFCE7" }]}>
              <Ionicons name="checkmark-done" size={16} color="#059669" />
            </View>
            <Text style={styles.statNumber}>{successful}</Text>
            <Text style={styles.statLabel}>Successful</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="time" size={16} color="#D97706" />
            </View>
            <Text style={styles.statNumber}>{pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: "#DBEAFE" }]}>
              <Ionicons name="trophy" size={16} color="#2563EB" />
            </View>
            <Text style={styles.statNumber}>{earnedRewards}</Text>
            <Text style={styles.statLabel}>Rewards Earned</Text>
          </View>
        </View>

        {/* Cooldown Info */}
        {isCooldownActive && cooldownEnds && (
          <View style={styles.cooldownCard}>
            <Ionicons name="time-outline" size={20} color="#92400E" />
            <Text style={styles.cooldownText}>
              Cooldown active — you can redeem again on {cooldownEnds.toLocaleDateString()}
            </Text>
          </View>
        )}

        {/* Progress to Next Reward */}
        <View style={styles.progressBox}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Progress to Next Reward</Text>
            <View style={styles.progressPill}>
              <Text style={styles.progressPillText}>
                {successful % 2 === 0 ? (successful > 0 ? "Ready!" : "0 / 2") : `${successful % 2} / 2`}
              </Text>
            </View>
          </View>

          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${Math.min(100, (successful % 2) * 50)}%` }]} />
          </View>

          <Text style={styles.progressSubtext}>
            {availableRewards > 0
              ? ` You have ${availableRewards} reward${availableRewards > 1 ? 's' : ''} available to redeem!`
              : `${referralsForNextReward} more referral${referralsForNextReward > 1 ? 's' : ''} needed for next reward`}
          </Text>
        </View>

        {/* Redeem Button */}
        <TouchableOpacity
          style={[styles.redeemBtn, (!availableRewards || isCooldownActive) && styles.redeemBtnDisabled]}
          disabled={!availableRewards || isCooldownActive || redeeming}
          onPress={handleRedeem}
          activeOpacity={0.85}
        >
          {redeeming ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.redeemBtnText, (!availableRewards || isCooldownActive) && styles.redeemBtnTextDisabled]}>
              {availableRewards > 0
                ? ` Redeem 1 Month Free (${availableRewards} available)`
                : isCooldownActive
                  ? ` Cooldown active`
                  : `${referralsForNextReward} more needed`}
            </Text>
          )}
        </TouchableOpacity>

        {/* History List */}
        <Text style={styles.historyTitle}>Referral History</Text>

        {data?.history?.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={38} color="#94A3B8" />
            <Text style={styles.emptyText}>You haven't referred anyone yet.</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {data?.history?.map((item, index) => (
              <View key={index} style={styles.historyCard}>
                <View style={{ flex: 1 }}>
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
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStatusColor = (status) => {
  switch (status) {
    case "SUCCESSFUL": return { bg: "#DCFCE7", text: "#059669" };
    case "PENDING": return { bg: "#FEF3C7", text: "#D97706" };
    case "EXPIRED": return { bg: "#FEE2E2", text: "#DC2626" };
    default: return { bg: "#F1F5F9", text: "#64748B" };
  }
};

const styles = StyleSheet.create({
  navHeader: { borderBottomWidth: 1, borderBottomColor: "#E2E8F0", backgroundColor: "#fff", paddingVertical: 14 },
  headerInner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, maxWidth: CONTENT_MAX, alignSelf: 'center', width: '100%' },
  backBtn: { flexDirection: "row", alignItems: "center", width: 70 },
  backText: { fontSize: 15, fontWeight: "600", marginLeft: 2, color: "#0F172A" },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },

  scrollContent: { padding: 20 },
  heroBox: { alignItems: "center", marginBottom: 28, paddingVertical: 16 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#DCFCE7", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  heroTitle: { fontSize: 26, fontWeight: "900", color: "#0F172A", marginBottom: 8, letterSpacing: -0.3 },
  heroSub: { fontSize: 14, color: "#64748B", textAlign: "center", lineHeight: 21, paddingHorizontal: 12 },
  heroHighlight: { fontWeight: "800", color: "#10B981" },

  codeBox: { backgroundColor: "#fff", padding: 22, borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 20, shadowColor: "#0F172A", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  codeLabel: { fontSize: 11, fontWeight: "800", color: "#94A3B8", textTransform: "uppercase", marginBottom: 14, letterSpacing: 1 },
  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 14, paddingLeft: 16, paddingRight: 6, paddingVertical: 6 },
  codeText: { fontSize: 19, fontWeight: "900", color: "#0F172A", letterSpacing: 2 },
  copyBtn: { backgroundColor: "#0F172A", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 15, paddingVertical: 11, borderRadius: 10 },
  copyBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  statCard: { flex: 1, backgroundColor: "#fff", borderRadius: 16, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0", shadowColor: "#0F172A", shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  statIconWrap: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  statNumber: { fontSize: 21, fontWeight: "900", color: "#0F172A" },
  statLabel: { fontSize: 11, color: "#64748B", marginTop: 2, fontWeight: "600" },

  cooldownCard: { backgroundColor: "#FEF3C7", padding: 14, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16, borderWidth: 1, borderColor: "#FDE68A" },
  cooldownText: { fontSize: 13, color: "#92400E", fontWeight: "600", flex: 1, lineHeight: 18 },

  progressBox: { backgroundColor: "#fff", padding: 22, borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 20, shadowColor: "#0F172A", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  progressTitle: { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  progressPill: { backgroundColor: "#ECFDF5", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  progressPillText: { fontSize: 13, fontWeight: "800", color: "#10B981" },
  progressBarBg: { height: 10, backgroundColor: "#F1F5F9", borderRadius: 6, overflow: "hidden", marginBottom: 10 },
  progressBarFill: { height: "100%", backgroundColor: "#10B981", borderRadius: 6 },
  progressSubtext: { fontSize: 13, color: "#64748B", textAlign: "center" },

  redeemBtn: { backgroundColor: "#10B981", padding: 17, borderRadius: 14, alignItems: "center", marginBottom: 24, shadowColor: "#10B981", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  redeemBtnDisabled: { backgroundColor: "#E2E8F0", shadowOpacity: 0 },
  redeemBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  redeemBtnTextDisabled: { color: "#94A3B8" },

  historyTitle: { fontSize: 17, fontWeight: "800", color: "#0F172A", marginBottom: 14 },
  historyCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fff", padding: 16, borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  historyName: { fontSize: 15, fontWeight: "700", color: "#1E293B", marginBottom: 3 },
  historyDate: { fontSize: 12, color: "#94A3B8" },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  badgeText: { fontSize: 10.5, fontWeight: "800" },

  emptyBox: { alignItems: "center", padding: 36, backgroundColor: "#fff", borderRadius: 20, borderWidth: 2, borderColor: "#E2E8F0", borderStyle: "dashed" },
  emptyText: { marginTop: 10, color: "#94A3B8", fontSize: 13.5, fontWeight: "500" }
});