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
  useWindowDimensions
} from "react-native";
import LocalizedText, { localizeText } from "../components/LocalizedText";
import { useLocale } from "../context/LocaleContext";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getReferralStats, redeemReferralReward } from "../api";

const IS_WEB = Platform.OS === "web";
const CONTENT_MAX = 1280;
const WEB_STACK_MAX = 1200;

const GREEN = "#39805A";
const GREEN_DARK = "#2E503C";
const NAVY = "#20332A";

export default function ReferralsScreen() {
  const navigation = useNavigation();
  const { language } = useLocale();
  const { width } = useWindowDimensions();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const useDesktopLayout = IS_WEB && width >= 820;

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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F3F5F2" }}>
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
    <View style={styles.historyPanel}>
      <LocalizedText translate style={styles.historyTitle}>Referral history</LocalizedText>

      {!data?.history || data.history.length === 0 ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="people-outline" size={22} color="#94A3B8" />
          </View>
          <LocalizedText translate style={styles.emptyText}>You haven't referred anyone yet.</LocalizedText>
        </View>
      ) : (
        <View>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F3F5F2" }}>
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
        IS_WEB && { alignSelf: 'center', width: '100%', maxWidth: useDesktopLayout ? WEB_STACK_MAX : 560 },
        !useDesktopLayout && styles.mobileScrollContent
      ]}>

        {/* Hero Banner (full width either way) */}
        <View style={styles.heroBanner}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="gift" size={20} color={GREEN} />
          </View>
          <View style={styles.heroHeading}>
          <LocalizedText translate style={styles.heroTitle}>Invite & earn</LocalizedText>
          <LocalizedText translate style={styles.heroSub}>
            Share Servon with fellow restaurateurs and grow together.
          </LocalizedText>
          </View>
          <View style={styles.heroPill}>
            <LocalizedText translate style={styles.heroPillText}>2 successful referrals</LocalizedText>
            <Ionicons name="arrow-forward" size={13} color={GREEN} style={{ marginHorizontal: 6 }} />
            <LocalizedText translate style={styles.heroPillText}>1 month Premium free</LocalizedText>
          </View>
        </View>

        {useDesktopLayout ? (
          // ─── WEB: two-column dashboard layout ──────────────────
          <View style={styles.webGrid}>
            <View style={styles.webColLeft}>
              <View style={styles.referralPanel}>
              {codeCard}
              {statsSection}
              {cooldownNotice}
              {progressCard}
              {redeemButton}
              </View>
            </View>
            <View style={styles.webColRight}>
              {historySection}
            </View>
          </View>
        ) : (
          // ─── APP: original single stacked column, unchanged ────
          <View style={styles.mobilePanels}>
            <View style={styles.referralPanel}>
            {codeCard}
            {statsSection}
            {cooldownNotice}
            {progressCard}
            {redeemButton}
            </View>
            {historySection}
          </View>
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

  referralPanel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DFE5DF', borderRadius: 12, padding: 20 },
  mobilePanels: { gap: 20 },
  heroHeading: { flex: 1, minWidth: 200 },

  navHeader: { borderBottomWidth: 1, borderBottomColor: '#DFE5DF', backgroundColor: '#FFFFFF', paddingVertical: 16 },

  headerInner: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: 20, maxWidth: CONTENT_MAX, alignSelf: 'center', width: '100%' },

  backBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 40, paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#F3F5F2', borderWidth: 1, borderColor: '#DFE5DF' },
  backText: { fontSize: 14, fontWeight: "500", marginLeft: 2, color: NAVY },

  headerTitle: { flex: 1, fontSize: 19, fontWeight: '700', color: NAVY, letterSpacing: -0.3 },

  scrollContent: { padding: 24 },

  mobileScrollContent: { paddingHorizontal: 16, paddingTop: 20 },

  // ─── WEB GRID ───────────────────────────────────────────────────

  webGrid: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },

  webColLeft: { flex: 1.1, minWidth: 0 },

  webColRight: { flex: 1, minWidth: 0 },

  historyPanel: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#DFE5DF', padding: 20 },

  // ─── HERO BANNER ────────────────────────────────────────────────

  heroBanner: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, paddingVertical: 12, marginBottom: 28 },

  heroIconWrap: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#EAF2EC', alignItems: 'center', justifyContent: 'center' },

  heroTitle: { fontSize: 25, fontWeight: '700', color: NAVY, marginBottom: 6, letterSpacing: -0.5 },

  heroSub: { fontSize: 13, color: '#627166', lineHeight: 21 },

  heroPill: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 2, backgroundColor: '#EAF2EC', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 },

  heroPillText: { fontSize: 12, fontWeight: '600', color: GREEN_DARK },

  // ─── SHARED CARD ────────────────────────────────────────────────

  card: { paddingBottom: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#E8EDE8' },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },

  label: { fontSize: 13, fontWeight: '600', color: '#627166' },

  liveDot: { display: 'none' },

  // ─── REFERRAL CODE ──────────────────────────────────────────────

  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F3F5F2', borderWidth: 1, borderColor: '#DFE5DF', borderRadius: 9, paddingLeft: 14, paddingRight: 5, paddingVertical: 5, gap: 8 },

  codeText: { flex: 1, minWidth: 0, fontSize: 22, fontWeight: '600', color: NAVY, letterSpacing: 1.5 },

  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: GREEN_DARK, minHeight: 42, paddingHorizontal: 14, borderRadius: 7, flexShrink: 0 },

  copyBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },

  // ─── STATS ──────────────────────────────────────────────────────

  statsRow: { flexDirection: 'row', paddingBottom: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#E8EDE8', gap: 12 },

  statCard: { flex: 1, minWidth: 0 },

  statIconWrap: { display: 'none' },

  statNumber: { fontSize: 28, fontWeight: '600', color: NAVY },

  statLabel: { fontSize: 12, lineHeight: 18, color: '#627166', marginTop: 6 },

  // ─── COOLDOWN NOTICE ────────────────────────────────────────────
  noticeCard: { backgroundColor: "#FFFBEB", padding: 13, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 16, borderWidth: 1, borderColor: "#FDE68A" },
  noticeText: { fontSize: 12.5, color: "#92400E", fontWeight: "500", flex: 1, lineHeight: 17 },

  // ─── PROGRESS ───────────────────────────────────────────────────

  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 },

  progressTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: NAVY },

  progressPill: { backgroundColor: '#EAF2EC', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6 },

  progressPillText: { fontSize: 12, fontWeight: '600', color: GREEN_DARK },

  progressBarBg: { height: 6, backgroundColor: '#E8EDE8', borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
  progressBarFill: { height: "100%", backgroundColor: GREEN, borderRadius: 4 },

  progressSubtext: { fontSize: 13, color: '#627166', lineHeight: 20 },

  // ─── REDEEM BUTTON ──────────────────────────────────────────────

  redeemBtn: { flexDirection: 'row', backgroundColor: GREEN_DARK, minHeight: 48, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

  redeemBtnDisabled: { backgroundColor: '#F3F5F2', borderWidth: 1, borderColor: '#DFE5DF' },

  redeemBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14, flexShrink: 1 },

  redeemBtnTextDisabled: { color: '#7B897F' },

  // ─── HISTORY ────────────────────────────────────────────────────

  historyTitle: { fontSize: 16, fontWeight: '600', color: NAVY, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: '#DFE5DF' },

  historyCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#E8EDE8', gap: 12 },

  historyName: { fontSize: 14, fontWeight: '600', color: NAVY, marginBottom: 6 },

  historyDate: { fontSize: 12, color: '#627166' },

  badge: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, flexShrink: 0 },

  badgeText: { fontSize: 10, fontWeight: '600' },

  emptyBox: { alignItems: 'center', paddingVertical: 36, gap: 12 },

  emptyIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F3F5F2', alignItems: 'center', justifyContent: 'center' },

  emptyText: { color: '#627166', fontSize: 13, textAlign: 'center', lineHeight: 20 }
});
