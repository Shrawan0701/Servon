import { useState, useCallback, useMemo } from "react";
import { 
  View, 
  Text as NativeText, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  ScrollView, 
  Platform, 
  Dimensions 
} from "react-native";
import LocalizedText from "../components/LocalizedText";
import { useLocale } from "../context/LocaleContext";
import { localizedItemName } from "../utils/localizedItemName";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getReviews } from "../api";

const STAR_FILTERS = ["All", "5", "4", "3", "2", "1"];
const IS_WEB = Platform.OS === "web";
const CONTENT_MAX = 1100;
const INITIAL_REVIEWS_COUNT = 5;

// ─── AI-STYLE OVERALL SUMMARY ───────────────────────────────────────
// Builds a short combined summary from ALL reviews (not the filtered
// list), so it always reflects the full picture regardless of which
// star filter the user currently has selected.
const buildSummary = (list) => {
  if (!list || list.length === 0) return null;

  const total = list.length;
  const avg = list.reduce((sum, r) => sum + (r.rating || 0), 0) / total;
  const positive = list.filter(r => r.rating >= 4).length;
  const negative = list.filter(r => r.rating <= 2).length;

  const itemCounts = {};
  list.forEach(r => {
    (Array.isArray(r.ordered_items) ? r.ordered_items : []).forEach(food => {
      itemCounts[food.name] = (itemCounts[food.name] || 0) + (food.quantity || 1);
    });
  });
  const topItems = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  let sentiment = "mixed";
  if (positive / total >= 0.7) sentiment = "mostly positive";
  else if (negative / total >= 0.5) sentiment = "mostly negative";

  let text = `From ${total} review${total > 1 ? "s" : ""}, guest feedback is ${sentiment}, averaging ${avg.toFixed(1)}★.`;
  if (topItems.length > 0) text += ` Most ordered: ${topItems.join(", ")}.`;
  if (negative > 0) text += ` ${negative} review${negative > 1 ? "s" : ""} flagged room for improvement.`;

  return { total, avg, sentiment, positive, negative, topItems, text };
};

// ─── PRESENTATIONAL HELPERS (styling only — no data/logic changes) ───
// Maps a rating to an accent colour used for the card's left rail and
// the rating pill, so guests skimming the list get an instant visual
// read before reading any text.
const ratingAccentColor = (rating) => {
  if (rating >= 4) return "#10B981";
  if (rating === 3) return "#F59E0B";
  return "#EF4444";
};

export default function ReviewsScreen() {
  const { language } = useLocale();
  const navigation = useNavigation();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starFilter, setStarFilter] = useState("All");
  const [sortBy, setSortBy] = useState("latest"); // 'latest' or 'oldest'
  const [visibleCount, setVisibleCount] = useState(INITIAL_REVIEWS_COUNT);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const res = await getReviews();
      setReviews(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStarFilterChange = (star) => {
    setStarFilter(star);
    setVisibleCount(INITIAL_REVIEWS_COUNT);
  };

  const handleSortChange = () => {
    setSortBy(prev => (prev === "latest" ? "oldest" : "latest"));
    setVisibleCount(INITIAL_REVIEWS_COUNT);
  };

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 5);
  };

  // Filter and Sort logic
  let displayedReviews = [...reviews];
  
  if (starFilter !== "All") {
    displayedReviews = displayedReviews.filter(r => r.rating === parseInt(starFilter));
  }

  displayedReviews.sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return sortBy === "latest" ? dateB - dateA : dateA - dateB;
  });

  const paginatedReviews = displayedReviews.slice(0, visibleCount);
  const hasMore = visibleCount < displayedReviews.length;

  const summary = useMemo(() => buildSummary(reviews), [reviews]);

  const renderStars = (rating, size = 16) => {
    return (
      <View style={{ flexDirection: "row", gap: 2 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons 
            key={star} 
            name={star <= rating ? "star" : "star-outline"} 
            size={size} 
            color={star <= rating ? "#F59E0B" : "#D1D5DB"} 
          />
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F7F6F3" }}>
        <ActivityIndicator size="large" color="#0F172A" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F7F6F3" }}>
      {/* Header */}
      <View style={styles.navHeader}>
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <View style={styles.backBtnCircle}>
              <Ionicons name="chevron-back" size={19} color="#0F172A" />
            </View>
            <LocalizedText translate style={styles.backText}>Back</LocalizedText>
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerTitleIconWrap}>
              <Ionicons name="star" size={14} color="#F59E0B" />
            </View>
            <LocalizedText translate style={styles.headerTitle}>Reviews</LocalizedText>
          </View>
          <View style={styles.backBtn} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        stickyHeaderIndices={[1]}
        showsVerticalScrollIndicator={false}
      >
        {/* AI Summary */}
        {summary && (
          <View style={styles.summarySection}>
            <View style={styles.summaryInner}>
              <View style={styles.summaryCard}>
                <View style={styles.summaryAccentBar} />

                <View style={styles.summaryHeaderRow}>
                  <View style={styles.summaryIconWrap}>
                    <Ionicons name="sparkles" size={14} color="#34D399" />
                  </View>
                  <LocalizedText translate style={styles.summaryLabel}>AI Summary</LocalizedText>
                  <View style={styles.summarySentimentPill}>
                    <View style={[
                      styles.summarySentimentDot,
                      { backgroundColor: summary.sentiment === "mostly positive" ? "#34D399" : summary.sentiment === "mostly negative" ? "#F87171" : "#FBBF24" }
                    ]} />
                    <LocalizedText style={styles.summarySentimentText}>{summary.sentiment}</LocalizedText>
                  </View>
                </View>

                <LocalizedText style={styles.summaryText}>{summary.text}</LocalizedText>

                <View style={styles.summaryStatsRow}>
                  <View style={styles.summaryStatTile}>
                    <View style={[styles.summaryStatIconWrap, { backgroundColor: "rgba(96,165,250,0.16)" }]}>
                      <Ionicons name="trophy-outline" size={14} color="#60A5FA" />
                    </View>
                    <LocalizedText style={styles.summaryStatValue}>{summary.avg.toFixed(1)}</LocalizedText>
                    <LocalizedText translate style={styles.summaryStatLabel}>Avg Rating</LocalizedText>
                  </View>
                  <View style={styles.summaryStatTile}>
                    <View style={[styles.summaryStatIconWrap, { backgroundColor: "rgba(148,163,184,0.16)" }]}>
                      <Ionicons name="chatbubble-ellipses-outline" size={14} color="#CBD5E1" />
                    </View>
                    <LocalizedText style={styles.summaryStatValue}>{summary.total}</LocalizedText>
                    <LocalizedText translate style={styles.summaryStatLabel}>Total Reviews</LocalizedText>
                  </View>
                  <View style={styles.summaryStatTile}>
                    <View style={[styles.summaryStatIconWrap, { backgroundColor: "rgba(52,211,153,0.16)" }]}>
                      <Ionicons name="thumbs-up-outline" size={14} color="#34D399" />
                    </View>
                    <LocalizedText style={[styles.summaryStatValue, { color: "#34D399" }]}>{summary.positive}</LocalizedText>
                    <LocalizedText translate style={styles.summaryStatLabel}>Positive</LocalizedText>
                  </View>
                  <View style={styles.summaryStatTile}>
                    <View style={[styles.summaryStatIconWrap, { backgroundColor: summary.negative > 0 ? "rgba(248,113,113,0.16)" : "rgba(148,163,184,0.16)" }]}>
                      <Ionicons name="alert-circle-outline" size={14} color={summary.negative > 0 ? "#F87171" : "#94A3B8"} />
                    </View>
                    <LocalizedText style={[styles.summaryStatValue, { color: summary.negative > 0 ? "#F87171" : "#fff" }]}>
                      {summary.negative}
                    </LocalizedText>
                    <LocalizedText translate style={styles.summaryStatLabel}>Needs Attention</LocalizedText>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Filters */}
        <View style={styles.filterSection}>
          <View style={styles.filterInner}>
            <View style={styles.filterTopRow}>
              <View style={styles.filterTitleRow}>
                <Ionicons name="options-outline" size={15} color="#0F172A" />
                <LocalizedText translate style={styles.filterTitle}>Filter by Stars</LocalizedText>
              </View>
              <TouchableOpacity onPress={handleSortChange} style={styles.sortBtn} activeOpacity={0.75}>
                <Ionicons name="swap-vertical" size={13} color="#475569" />
                <LocalizedText style={styles.sortBtnText}>{sortBy === "latest" ? "Latest First" : "Oldest First"}</LocalizedText>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {STAR_FILTERS.map((star) => (
                <TouchableOpacity
                  key={star}
                  style={[styles.filterTab, starFilter === star && styles.filterTabActive]}
                  onPress={() => handleStarFilterChange(star)}
                  activeOpacity={0.8}
                >
                  {star !== "All" && (
                    <Ionicons
                      name="star"
                      size={12}
                      color={starFilter === star ? "#fff" : "#F59E0B"}
                      style={{ marginRight: 4 }}
                    />
                  )}
                  <LocalizedText style={[styles.filterTabText, starFilter === star && { color: "#fff" }]}>
                    {star === "All" ? "All Reviews" : `${star} Stars`}
                  </LocalizedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Reviews List */}
        <View style={[styles.listWrap, IS_WEB && { alignSelf: "center", width: "100%", maxWidth: CONTENT_MAX }]}>
          {displayedReviews.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="star-half-outline" size={28} color="#94A3B8" />
              </View>
              <LocalizedText translate style={styles.emptyText}>No reviews found for this filter.</LocalizedText>
              <LocalizedText translate style={styles.emptySubText}>Try a different star rating or check back later.</LocalizedText>
            </View>
          ) : (
            <>
              {paginatedReviews.map((item) => {
                const orderedItems = Array.isArray(item.ordered_items) ? item.ordered_items : [];
                const accentColor = ratingAccentColor(item.rating);
                return (
                  <View key={String(item.id)} style={styles.reviewCard}>
                    <View style={[styles.reviewCardAccent, { backgroundColor: accentColor }]} />

                    <View style={styles.cardHeader}>
                      {/* User Avatar */}
                      <View style={styles.avatarWrap}>
                        <Ionicons name="person" size={17} color="#475569" />
                      </View>

                      {/* Guest Title & Table Pill */}
                      <View style={{ flex: 1 }}>
                        <View style={styles.nameRow}>
                          <LocalizedText translate style={styles.tableText}>Dine-in Guest</LocalizedText>
                          {item.table_number && (
                            <View style={styles.tableBadge}>
                              <Ionicons name="grid-outline" size={10} color="#475569" style={{ marginRight: 3 }} />
                              <LocalizedText style={styles.tableBadgeText}>Table {item.table_number}</LocalizedText>
                            </View>
                          )}
                        </View>

                        <View style={styles.dateRow}>
                          <Ionicons name="time-outline" size={11} color="#94A3B8" style={{ marginRight: 4 }} />
                          <LocalizedText style={styles.dateText}>
                            {new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} at{" "}
                            {new Date(item.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </LocalizedText>
                        </View>
                      </View>

                      <View style={styles.ratingCol}>
                        {renderStars(item.rating)}
                        <View style={[styles.ratingPill, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}40` }]}>
                          <LocalizedText style={[styles.ratingPillText, { color: accentColor }]}>{item.rating.toFixed(1)}</LocalizedText>
                        </View>
                      </View>
                    </View>

                    {item.comment ? (
                      <View style={styles.commentBox}>
                        <Ionicons name="chatbox-ellipses-outline" size={14} color="#CBD5E1" style={{ marginRight: 8, marginTop: 2 }} />
                        <LocalizedText style={styles.commentText}>{item.comment}</LocalizedText>
                      </View>
                    ) : (
                      <View style={styles.commentBox}>
                        <Ionicons name="chatbox-outline" size={14} color="#CBD5E1" style={{ marginRight: 8, marginTop: 2 }} />
                        <LocalizedText translate style={[styles.commentText, styles.commentTextEmpty]}>No written feedback provided.</LocalizedText>
                      </View>
                    )}

                    {orderedItems.length > 0 && (
                      <View style={styles.itemsBox}>
                        <View style={styles.itemsTitleRow}>
                          <Ionicons name="restaurant-outline" size={12} color="#64748B" style={{ marginRight: 5 }} />
                          <LocalizedText translate style={styles.itemsTitle}>Items Ordered</LocalizedText>
                        </View>
                        <View style={styles.itemsGrid}>
                          {orderedItems.map((food, idx) => (
                            <View key={idx} style={styles.itemPill}>
                              <LocalizedText style={styles.itemText}>{localizedItemName(food, language)} × {food.quantity}</LocalizedText>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Load More Button */}
              {hasMore && (
                <TouchableOpacity onPress={handleLoadMore} style={styles.loadMoreBtn} activeOpacity={0.8}>
                  <LocalizedText translate style={styles.loadMoreText}>
                    Load More Reviews
                  </LocalizedText>
                  <View style={styles.loadMoreCountBadge}>
                    <LocalizedText style={styles.loadMoreCountText}>{displayedReviews.length - visibleCount}</LocalizedText>
                  </View>
                  <Ionicons name="chevron-down" size={15} color="#0F172A" />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  navHeader: { 
    borderBottomWidth: 1, 
    borderBottomColor: "#E7E4DE", 
    backgroundColor: "#fff", 
    paddingVertical: 14,
    ...Platform.select({
      web: { position: "sticky", top: 0, zIndex: 10 },
      default: {},
    }),
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
  backBtn: { flexDirection: "row", alignItems: "center", minWidth: 70, gap: 8 },
  backBtnCircle: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#F1F0EC",
    alignItems: "center", justifyContent: "center",
  },
  backText: { fontSize: 14.5, fontWeight: "600", color: "#0F172A" },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  headerTitleIconWrap: {
    width: 24, height: 24, borderRadius: 8,
    backgroundColor: "#FEF3C7",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A", letterSpacing: -0.2 },

  // ─── AI SUMMARY ─────────────────────────────────────────────────
  summarySection: { backgroundColor: "#F7F6F3", paddingTop: 18, paddingBottom: 4 },
  summaryInner: { paddingHorizontal: 16, maxWidth: CONTENT_MAX, alignSelf: "center", width: "100%" },
  summaryCard: {
    backgroundColor: "#0B1220",
    borderRadius: 20,
    padding: 20,
    position: "relative",
    overflow: "hidden",
    shadowColor: "#0B1220",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 4,
  },
  summaryAccentBar: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: 3,
    backgroundColor: "#34D399",
  },
  summaryHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  summaryIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(52,211,153,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    flex: 1,
  },
  summarySentimentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  summarySentimentDot: { width: 6, height: 6, borderRadius: 3 },
  summarySentimentText: { fontSize: 10.5, fontWeight: "700", color: "#E2E8F0", textTransform: "capitalize" },
  summaryText: { fontSize: 14.5, lineHeight: 22.5, color: "#E2E8F0", marginBottom: 18 },
  summaryStatsRow: {
    flexDirection: "row",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 16,
  },
  summaryStatTile: {
    flex: 1,
    alignItems: "flex-start",
    backgroundColor: "rgba(255,255,255,0.035)",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  summaryStatIconWrap: {
    width: 22, height: 22, borderRadius: 7,
    alignItems: "center", justifyContent: "center",
    marginBottom: 8,
  },
  summaryStatValue: { fontSize: 17, fontWeight: "800", color: "#fff" },
  summaryStatLabel: { fontSize: 10, color: "#94A3B8", marginTop: 3, fontWeight: "500" },

  // ─── FILTERS ────────────────────────────────────────────────────
  filterSection: { 
    backgroundColor: "#fff", 
    borderBottomWidth: 1, 
    borderBottomColor: "#E7E4DE",
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  filterInner: {
    paddingHorizontal: 16,
    maxWidth: CONTENT_MAX,
    alignSelf: 'center',
    width: '100%'
  },
  filterTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  filterTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  filterTitle: { fontWeight: "700", color: "#0F172A", fontSize: 14 },
  sortBtn: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 5, 
    backgroundColor: "#F1F0EC", 
    paddingHorizontal: 11, 
    paddingVertical: 7, 
    borderRadius: 9,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  sortBtnText: { fontSize: 12, fontWeight: "700", color: "#475569" },
  filterTab: { 
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14, 
    paddingVertical: 9, 
    borderRadius: 22, 
    borderWidth: 1.5, 
    borderColor: "#E7E4DE", 
    backgroundColor: "#fff",
    ...Platform.select({ web: { cursor: "pointer", transition: "all 0.15s ease" } }),
  },
  filterTabActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  filterTabText: { fontSize: 13, fontWeight: "700", color: "#475569" },

  // ─── LIST ───────────────────────────────────────────────────────
  listWrap: { padding: 16, paddingTop: 18 },
  emptyState: { alignItems: "center", marginTop: 52, gap: 6 },
  emptyIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#EFEDE7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyText: { color: "#334155", fontSize: 15, fontWeight: "700" },
  emptySubText: { color: "#94A3B8", fontSize: 13, fontWeight: "500" },

  reviewCard: { 
    backgroundColor: "#fff", 
    padding: 18, 
    paddingLeft: 20,
    borderRadius: 18, 
    marginBottom: 14, 
    borderWidth: 1, 
    borderColor: "#EDEBE5",
    position: "relative",
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
    elevation: 2,
    ...Platform.select({ web: { transition: "box-shadow 0.18s ease, transform 0.18s ease" } }),
  },
  reviewCardAccent: {
    position: "absolute",
    left: 0, top: 0, bottom: 0,
    width: 4,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F0EC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E7E4DE",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  tableText: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  tableBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F0EC",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E7E4DE",
  },
  tableBadgeText: { fontSize: 11, fontWeight: "700", color: "#475569" },
  dateRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  dateText: { fontSize: 12, color: "#94A3B8", fontWeight: "500" },

  ratingCol: { alignItems: "flex-end", gap: 6 },
  ratingPill: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ratingPillText: { fontSize: 12, fontWeight: "800" },

  commentBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FAFAF8",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F0EC",
  },
  commentText: { flex: 1, fontSize: 14.5, color: "#1E293B", lineHeight: 22 },
  commentTextEmpty: { color: "#94A3B8", fontStyle: "italic" },
  
  itemsBox: { backgroundColor: "#F8FAFC", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#F1F5F9" },
  itemsTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  itemsTitle: { fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.4 },
  itemsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  itemPill: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  itemText: { fontSize: 12.5, color: "#475569", fontWeight: "600" },

  // ─── LOAD MORE ──────────────────────────────────────────────────
  loadMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E7E4DE",
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 6,
    marginBottom: 20,
    ...Platform.select({ web: { cursor: "pointer", transition: "border-color 0.15s ease" } }),
  },
  loadMoreText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0F172A",
  },
  loadMoreCountBadge: {
    backgroundColor: "#F1F0EC",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  loadMoreCountText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#475569",
  },
});