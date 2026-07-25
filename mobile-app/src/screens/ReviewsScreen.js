import { useState, useCallback, useMemo } from "react";
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  ScrollView, 
  Platform, 
  Dimensions 
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getReviews } from "../api";

const STAR_FILTERS = ["All", "5", "4", "3", "2", "1"];
const IS_WEB = Platform.OS === "web";
const CONTENT_MAX = 1100;

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

export default function ReviewsScreen() {
  const navigation = useNavigation();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starFilter, setStarFilter] = useState("All");
  const [sortBy, setSortBy] = useState("latest"); // 'latest' or 'oldest'

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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" }}>
        <ActivityIndicator size="large" color="#0F172A" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FAF8F5" }}>
      {/* Header */}
      <View style={styles.navHeader}>
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <Ionicons name="star" size={16} color="#F59E0B" />
            <Text style={styles.headerTitle}>Reviews</Text>
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
                <View style={styles.summaryHeaderRow}>
                  <View style={styles.summaryIconWrap}>
                    <Ionicons name="sparkles" size={15} color="#10B981" />
                  </View>
                  <Text style={styles.summaryLabel}>AI Summary</Text>
                </View>

                <Text style={styles.summaryText}>{summary.text}</Text>

                <View style={styles.summaryStatsRow}>
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryStatValue}>{summary.avg.toFixed(1)}</Text>
                    <Text style={styles.summaryStatLabel}>Avg Rating</Text>
                  </View>
                  <View style={styles.summaryStatDivider} />
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryStatValue}>{summary.total}</Text>
                    <Text style={styles.summaryStatLabel}>Total Reviews</Text>
                  </View>
                  <View style={styles.summaryStatDivider} />
                  <View style={styles.summaryStat}>
                    <Text style={[styles.summaryStatValue, { color: "#10B981" }]}>{summary.positive}</Text>
                    <Text style={styles.summaryStatLabel}>Positive</Text>
                  </View>
                  <View style={styles.summaryStatDivider} />
                  <View style={styles.summaryStat}>
                    <Text style={[styles.summaryStatValue, { color: summary.negative > 0 ? "#EF4444" : "#0F172A" }]}>
                      {summary.negative}
                    </Text>
                    <Text style={styles.summaryStatLabel}>Needs Attention</Text>
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
              <Text style={styles.filterTitle}>Filter by Stars</Text>
              <TouchableOpacity onPress={() => setSortBy(sortBy === "latest" ? "oldest" : "latest")} style={styles.sortBtn}>
                <Ionicons name="swap-vertical" size={14} color="#64748B" />
                <Text style={styles.sortBtnText}>{sortBy === "latest" ? "Latest First" : "Oldest First"}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {STAR_FILTERS.map((star) => (
                <TouchableOpacity
                  key={star}
                  style={[styles.filterTab, starFilter === star && styles.filterTabActive]}
                  onPress={() => setStarFilter(star)}
                >
                  {star !== "All" && (
                    <Ionicons
                      name="star"
                      size={12}
                      color={starFilter === star ? "#fff" : "#F59E0B"}
                      style={{ marginRight: 4 }}
                    />
                  )}
                  <Text style={[styles.filterTabText, starFilter === star && { color: "#fff" }]}>
                    {star === "All" ? "All Reviews" : `${star} Stars`}
                  </Text>
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
                <Ionicons name="star-half-outline" size={26} color="#94A3B8" />
              </View>
              <Text style={styles.emptyText}>No reviews found for this filter.</Text>
            </View>
          ) : (
            displayedReviews.map((item) => {
              const orderedItems = Array.isArray(item.ordered_items) ? item.ordered_items : [];
              return (
                <View key={String(item.id)} style={styles.reviewCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.tableBadge}>
                      <Text style={styles.tableBadgeText}>T{item.table_number}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tableText}>Table {item.table_number}</Text>
                      <Text style={styles.dateText}>
                        {new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} at{" "}
                        {new Date(item.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </View>
                    {renderStars(item.rating)}
                  </View>

                  {item.comment ? (
                    <Text style={styles.commentText}>"{item.comment}"</Text>
                  ) : (
                    <Text style={[styles.commentText, styles.commentTextEmpty]}>No written feedback provided.</Text>
                  )}

                  {orderedItems.length > 0 && (
                    <View style={styles.itemsBox}>
                      <Text style={styles.itemsTitle}>Items Ordered</Text>
                      <View style={styles.itemsGrid}>
                        {orderedItems.map((food, idx) => (
                          <View key={idx} style={styles.itemPill}>
                            <Text style={styles.itemText}>{food.name} × {food.quantity}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  backBtn: { flexDirection: "row", alignItems: "center", minWidth: 60 },
  backText: { fontSize: 15, fontWeight: "600", marginLeft: 2, color: "#0F172A" },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },

  // ─── AI SUMMARY ─────────────────────────────────────────────────
  summarySection: { backgroundColor: "#FAF8F5", paddingTop: 16, paddingBottom: 4 },
  summaryInner: { paddingHorizontal: 16, maxWidth: CONTENT_MAX, alignSelf: "center", width: "100%" },
  summaryCard: {
    backgroundColor: "#0F172A",
    borderRadius: 18,
    padding: 18,
  },
  summaryHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  summaryIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(16,185,129,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  summaryText: { fontSize: 14.5, lineHeight: 22, color: "#F1F5F9", marginBottom: 16 },
  summaryStatsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    paddingTop: 14,
  },
  summaryStat: { flex: 1, alignItems: "center" },
  summaryStatDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.1)" },
  summaryStatValue: { fontSize: 17, fontWeight: "800", color: "#fff" },
  summaryStatLabel: { fontSize: 10.5, color: "#94A3B8", marginTop: 3, textAlign: "center" },

  // ─── FILTERS ────────────────────────────────────────────────────
  filterSection: { 
    backgroundColor: "#fff", 
    borderBottomWidth: 1, 
    borderBottomColor: "#E2E8F0",
    paddingVertical: 16
  },
  filterInner: {
    paddingHorizontal: 16,
    maxWidth: CONTENT_MAX,
    alignSelf: 'center',
    width: '100%'
  },
  filterTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  filterTitle: { fontWeight: "700", color: "#1E293B", fontSize: 14 },
  sortBtn: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 4, 
    backgroundColor: "#F1F5F9", 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 8 
  },
  sortBtnText: { fontSize: 12, fontWeight: "600", color: "#64748B" },
  filterTab: { 
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14, 
    paddingVertical: 8, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: "#E2E8F0", 
    backgroundColor: "#fff" 
  },
  filterTabActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  filterTabText: { fontSize: 13, fontWeight: "700", color: "#64748B" },

  // ─── LIST ───────────────────────────────────────────────────────
  listWrap: { padding: 16 },
  emptyState: { alignItems: "center", marginTop: 44, gap: 10 },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { color: "#64748B", fontSize: 14, fontWeight: "500" },

  reviewCard: { 
    backgroundColor: "#fff", 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 14, 
    borderWidth: 1, 
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  tableBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  tableBadgeText: { fontSize: 12, fontWeight: "800", color: "#334155" },
  tableText: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  dateText: { fontSize: 12, color: "#64748B", marginTop: 2 },
  commentText: { fontSize: 15, color: "#1E293B", lineHeight: 22, marginBottom: 12 },
  commentTextEmpty: { color: "#94A3B8", fontStyle: "italic" },
  
  itemsBox: { backgroundColor: "#F8FAFC", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#F1F5F9" },
  itemsTitle: { fontSize: 11, fontWeight: "700", color: "#64748B", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 },
  itemsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  itemPill: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  itemText: { fontSize: 12.5, color: "#475569", fontWeight: "600" }
});