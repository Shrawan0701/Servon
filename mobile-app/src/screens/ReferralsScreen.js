import { useState, useCallback } from "react";
import {
  View,
  Text as NativeText,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions
} from "react-native";
import LocalizedText, { localizeText } from "../components/LocalizedText";
import { useLocale } from "../context/LocaleContext";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getReferralStats, redeemReferralReward } from "../api";

const IS_WEB = Platform.OS === "web";
const CONTENT_MAX = 1100;
const WEB_STACK_MAX = 1040;

const GREEN = "#10B981";
const GREEN_DARK = "#059669";
const NAVY = "#0F172A";

export default function ReferralsScreen() {
  const navigation = useNavigation();
  const { language } = useLocale();
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
    setLoading(true);
    const res = await getReferralStats();
    setData(res); // ✅ Fixed: 'res' already contains { referral_code, stats, rewards, history }
  } catch (err) {
    console.error(err);
    Alert.alert(localizeText("Error", language), localizeText("Could not load referral data", language));
  } finally {
    setLoading(false);
  }
};

  const handleCopy = () => {
    if (!data?.referral_code) return;
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(data.referral_code);
      window.alert(localizeText("Code copied to clipboard!", language));
    } else {
      Alert.alert(localizeText("Code Copied", language), `${localizeText("Your code", language)} ${data.referral_code} ${localizeText("has been copied!", language)}`);
    }
  };

  const handleRedeem = async () => {
    setRedeeming(true);
    try {
      const res = await redeemReferralReward();
      Alert.alert("Success", res.data.message);
      loadData();
    } catch (err) {
      Alert.alert(localizeText("Cannot Redeem", language), err.response?.data?.error || localizeText("An error occurred.", language));
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F5F6F8" }}>
        <ActivityIndicator size="large" color={NAVY} />
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

 const referralsForNextReward = availableRewards > 0
  ? 0
  : 2 - (successful % 2);

const progressPct = availableRewards > 0
  ? 100
  : Math.min(100, (successful % 2) * 50);

  // ─── SECTION BLOCKS ─────────────────────────────────────────────
  // Built once, then arranged differently for web (two-column grid)
  // vs. app (single stacked column) further down — no duplicated logic.

  const codeCard = (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <LocalizedText translate style={styles.label}>Your referral code</LocalizedText>
        <View style={styles.liveDot} />
      </View>
      <View style={styles.codeRow}>
        <LocalizedText style={styles.codeText}>{data?.referral_code || "—"}</LocalizedText>
        <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} activeOpacity={0.85}>
          <Ionicons name="copy-outline" size={15} color="#fff" />
          <LocalizedText translate style={styles.copyBtnText}>Copy</LocalizedText>
        </TouchableOpacity>
      </View>
    </View>
  );

  const statsSection = (
    <View style={styles.statsRow}>
      <View style={styles.statCard}>
        <View style={[styles.statIconWrap, { backgroundColor: "#ECFDF5" }]}>
          <Ionicons name="checkmark-done" size={15} color={GREEN_DARK} />
        </View>
        <LocalizedText style={styles.statNumber}>{successful}</LocalizedText>
        <LocalizedText translate style={styles.statLabel}>Successful</LocalizedText>
      </View>
      <View style={styles.statCard}>
        <View style={[styles.statIconWrap, { backgroundColor: "#FFFBEB" }]}>
          <Ionicons name="time" size={15} color="#D97706" />
        </View>
        <LocalizedText style={styles.statNumber}>{pending}</LocalizedText>
        <LocalizedText translate style={styles.statLabel}>Pending</LocalizedText>
      </View>
      <View style={styles.statCard}>
        <View style={[styles.statIconWrap, { backgroundColor: "#EFF6FF" }]}>
          <Ionicons name="trophy" size={15} color="#2563EB" />
        </View>
        <LocalizedText style={styles.statNumber}>{earnedRewards}</LocalizedText>
        <LocalizedText translate style={styles.statLabel}>Rewards earned</LocalizedText>
      </View>
    </View>
  );

  const cooldownNotice = isCooldownActive && cooldownEnds ? (
    <View style={styles.noticeCard}>
      <Ionicons name="time-outline" size={16} color="#92400E" />
      <LocalizedText style={styles.noticeText}>
        {localizeText("Cooldown active", language)} — {localizeText("you can redeem again on", language)} {cooldownEnds.toLocaleDateString()}.
      </LocalizedText>
    </View>
  ) : null;

  const progressCard = (
    <View style={styles.card}>
      <View style={styles.progressHeader}>
        <LocalizedText translate style={styles.progressTitle}>Progress to next reward</LocalizedText>
        <View style={styles.progressPill}>
         <LocalizedText style={styles.progressPillText}>
  {availableRewards > 0 ? "2 / 2" : `${successful % 2} / 2`}
</LocalizedText>
        </View>
      </View>

      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
      </View>

      <LocalizedText style={styles.progressSubtext}>
        {availableRewards > 0
          ? `${availableRewards} ${localizeText("rewards available to redeem", language)}`
          : `${referralsForNextReward} ${localizeText("more referrals needed", language)}`}
      </LocalizedText>
    </View>
  );

  const redeemButton = (
    <TouchableOpacity
      style={[styles.redeemBtn, (!availableRewards || isCooldownActive) && styles.redeemBtnDisabled]}
      disabled={!availableRewards || isCooldownActive || redeeming}
      onPress={handleRedeem}
      activeOpacity={0.88}
    >
      {redeeming ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <Ionicons
            name={availableRewards > 0 ? "gift-outline" : "lock-closed-outline"}
            size={16}
            color={(!availableRewards || isCooldownActive) ? "#9CA3AF" : "#fff"}
            style={{ marginRight: 8 }}
          />
          <LocalizedText style={[styles.redeemBtnText, (!availableRewards || isCooldownActive) && styles.redeemBtnTextDisabled]}>
            {availableRewards > 0
              ? `${localizeText("Redeem 1 month free", language)} (${availableRewards} ${localizeText("available", language)})`
              : isCooldownActive
                ? localizeText("Cooldown active", language)
                : `${referralsForNextReward} ${localizeText("more needed", language)}`}
          </LocalizedText>
        </>
      )}
    </TouchableOpacity>
  );

  const historySection = (
    <View style={IS_WEB && styles.historyPanel}>
      <LocalizedText translate style={styles.historyTitle}>Referral history</LocalizedText>

      {!data?.history || data.history.length === 0 ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="people-outline" size={22} color="#94A3B8" />
          </View>
          <LocalizedText translate style={styles.emptyText}>You haven't referred anyone yet.</LocalizedText>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {data.history.map((item, index) => (
            <View key={index} style={styles.historyCard}>
              <View style={{ flex: 1 }}>
                <LocalizedText style={styles.historyName}>{item.business_name}</LocalizedText>
                <LocalizedText style={styles.historyDate}>
                  {localizeText("Joined", language)} {new Date(item.created_at).toLocaleDateString()}
                </LocalizedText>
              </View>
              <View style={[styles.badge, { backgroundColor: getStatusColor(item.status).bg }]}>
                <LocalizedText style={[styles.badgeText, { color: getStatusColor(item.status).text }]}>
                  {item.status}
                </LocalizedText>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F6F8" }}>
      {/* Header */}
      <View style={styles.navHeader}>
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color={NAVY} />
            <LocalizedText translate style={styles.backText}>Back</LocalizedText>
          </TouchableOpacity>
          <LocalizedText translate style={styles.headerTitle}>Referral Program</LocalizedText>
          <View style={{ width: 60 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={[
        styles.scrollContent,
        IS_WEB && { alignSelf: 'center', width: '100%', maxWidth: WEB_STACK_MAX }
      ]}>

        {/* Hero Banner (full width either way) */}
        <View style={styles.heroBanner}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="gift" size={20} color={GREEN} />
          </View>
          <LocalizedText translate style={styles.heroTitle}>Invite & earn</LocalizedText>
          <LocalizedText translate style={styles.heroSub}>
            Share Servon with fellow restaurateurs and grow together.
          </LocalizedText>
          <View style={styles.heroPill}>
            <LocalizedText translate style={styles.heroPillText}>2 successful referrals</LocalizedText>
            <Ionicons name="arrow-forward" size={13} color={GREEN} style={{ marginHorizontal: 6 }} />
            <LocalizedText translate style={styles.heroPillText}>1 month Premium free</LocalizedText>
          </View>
        </View>

        {IS_WEB ? (
          // ─── WEB: two-column dashboard layout ──────────────────
          <View style={styles.webGrid}>
            <View style={styles.webColLeft}>
              {codeCard}
              {statsSection}
              {cooldownNotice}
              {progressCard}
              {redeemButton}
            </View>
            <View style={styles.webColRight}>
              {historySection}
            </View>
          </View>
        ) : (
          // ─── APP: original single stacked column, unchanged ────
          <>
            {codeCard}
            {statsSection}
            {cooldownNotice}
            {progressCard}
            {redeemButton}
            {historySection}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStatusColor = (status) => {
  switch (status) {
    case "SUCCESS": // 👈 Changed from "SUCCESSFUL"
    case "SUCCESSFUL": 
      return { bg: "#ECFDF5", text: GREEN_DARK };
    case "PENDING": 
      return { bg: "#FFFBEB", text: "#92400E" };
    case "EXPIRED": 
      return { bg: "#FEF2F2", text: "#991B1B" };
    default: 
      return { bg: "#F1F5F9", text: "#64748B" };
  }
};

const styles = StyleSheet.create({
  navHeader: { borderBottomWidth: 1, borderBottomColor: "#E5E7EB", backgroundColor: "#fff", paddingVertical: 14 },
  headerInner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, maxWidth: CONTENT_MAX, alignSelf: 'center', width: '100%' },
  backBtn: { flexDirection: "row", alignItems: "center", width: 70 },
  backText: { fontSize: 14, fontWeight: "500", marginLeft: 2, color: NAVY },
  headerTitle: { fontSize: 15, fontWeight: "700", color: NAVY },

  scrollContent: { padding: 20 },

  // ─── WEB GRID ───────────────────────────────────────────────────
  webGrid: { flexDirection: "row", gap: 20, alignItems: "flex-start" },
  webColLeft: { flex: 1.3 },
  webColRight: { flex: 1 },
  historyPanel: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EAECF0",
    padding: 18,
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },

  // ─── HERO BANNER ────────────────────────────────────────────────
  heroBanner: {
    backgroundColor: NAVY,
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: NAVY,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  heroIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(16,185,129,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 6, letterSpacing: -0.3 },
  heroSub: { fontSize: 13.5, color: "#CBD5E1", lineHeight: 20, marginBottom: 16, maxWidth: 440 },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(16,185,129,0.14)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroPillText: { fontSize: 12, fontWeight: "700", color: GREEN },

  // ─── SHARED CARD ────────────────────────────────────────────────
  card: {
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EAECF0",
    marginBottom: 16,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  label: { fontSize: 11, fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN },

  // ─── REFERRAL CODE ──────────────────────────────────────────────
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 12,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
  },
  codeText: { fontSize: 19, fontWeight: "800", color: NAVY, letterSpacing: 2.5 },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: GREEN, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 9 },
  copyBtnText: { color: "#fff", fontWeight: "700", fontSize: 12.5 },

  // ─── STATS ──────────────────────────────────────────────────────
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EAECF0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  statIconWrap: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  statNumber: { fontSize: 19, fontWeight: "800", color: NAVY },
  statLabel: { fontSize: 11, color: "#6B7280", marginTop: 2, fontWeight: "600" },

  // ─── COOLDOWN NOTICE ────────────────────────────────────────────
  noticeCard: { backgroundColor: "#FFFBEB", padding: 13, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 16, borderWidth: 1, borderColor: "#FDE68A" },
  noticeText: { fontSize: 12.5, color: "#92400E", fontWeight: "500", flex: 1, lineHeight: 17 },

  // ─── PROGRESS ───────────────────────────────────────────────────
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  progressTitle: { fontSize: 13.5, fontWeight: "700", color: "#1E293B" },
  progressPill: { backgroundColor: "#ECFDF5", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  progressPillText: { fontSize: 12, fontWeight: "800", color: GREEN_DARK },
  progressBarBg: { height: 7, backgroundColor: "#F1F5F9", borderRadius: 4, overflow: "hidden", marginBottom: 10 },
  progressBarFill: { height: "100%", backgroundColor: GREEN, borderRadius: 4 },
  progressSubtext: { fontSize: 12.5, color: "#6B7280" },

  // ─── REDEEM BUTTON ──────────────────────────────────────────────
  redeemBtn: {
    flexDirection: "row",
    backgroundColor: GREEN,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    shadowColor: GREEN,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  redeemBtnDisabled: { backgroundColor: "#F1F5F9", shadowOpacity: 0, elevation: 0 },
  redeemBtnText: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
  redeemBtnTextDisabled: { color: "#9CA3AF" },

  // ─── HISTORY ────────────────────────────────────────────────────
  historyTitle: { fontSize: 14.5, fontWeight: "700", color: NAVY, marginBottom: 12 },
  historyCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#EAECF0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  historyName: { fontSize: 13.5, fontWeight: "700", color: "#1E293B", marginBottom: 2 },
  historyDate: { fontSize: 11.5, color: "#9CA3AF" },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 },
  badgeText: { fontSize: 10, fontWeight: "800" },

  emptyBox: { alignItems: "center", padding: 32, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#EAECF0", gap: 8 },
  emptyIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#9CA3AF", fontSize: 12.5, fontWeight: "500" }
});