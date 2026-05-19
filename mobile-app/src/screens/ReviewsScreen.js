import { useState, useCallback } from "react";
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

  const renderStars = (rating) => {
    return (
      <View style={{ flexDirection: "row", gap: 2 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons 
            key={star} 
            name={star <= rating ? "star" : "star-outline"} 
            size={16} 
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
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="chevron-back" size={24} color="#0F172A" />
            <Text style={{ fontSize: 16, fontWeight: "600", marginLeft: 4, color: "#0F172A" }}>Back</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#0F172A" }}>Reviews</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterSection}>
        <View style={styles.filterInner}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ fontWeight: "700", color: "#1E293B" }}>Filter by Stars</Text>
            <TouchableOpacity onPress={() => setSortBy(sortBy === "latest" ? "oldest" : "latest")} style={styles.sortBtn}>
              <Ionicons name="swap-vertical" size={16} color="#64748B" />
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
                <Text style={[styles.filterTabText, starFilter === star && { color: "#fff" }]}>
                  {star === "All" ? "All Reviews" : `${star} Stars`}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Reviews List */}
      <FlatList
        data={displayedReviews}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[
          styles.listContent,
          IS_WEB && { alignSelf: 'center', width: '100%', maxWidth: CONTENT_MAX }
        ]}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Ionicons name="star-half-outline" size={48} color="#94A3B8" />
            <Text style={{ color: "#64748B", marginTop: 12, fontSize: 15, fontWeight: "500" }}>No reviews found for this filter.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const orderedItems = Array.isArray(item.ordered_items) ? item.ordered_items : [];

          return (
            <View style={styles.reviewCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.tableText}>Table {item.table_number}</Text>
                  <Text style={styles.dateText}>
                    {new Date(item.created_at).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(item.created_at).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                {renderStars(item.rating)}
              </View>

              {item.comment ? (
                <Text style={styles.commentText}>"{item.comment}"</Text>
              ) : (
                <Text style={[styles.commentText, { color: "#94A3B8", fontStyle: "italic" }]}>No written feedback provided.</Text>
              )}

              {/* Show What They Ate! */}
              {orderedItems.length > 0 && (
                <View style={styles.itemsBox}>
                  <Text style={styles.itemsTitle}>Items Ordered:</Text>
                  {orderedItems.map((food, idx) => (
                    <Text key={idx} style={styles.itemText}>• {food.name} (x{food.quantity})</Text>
                  ))}
                </View>
              )}
            </View>
          );
        }}
      />
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
  sortBtn: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 4, 
    backgroundColor: "#F1F5F9", 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 6 
  },
  sortBtnText: { fontSize: 12, fontWeight: "600", color: "#64748B" },
  filterTab: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: "#E2E8F0", 
    backgroundColor: "#fff" 
  },
  filterTabActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  filterTabText: { fontSize: 13, fontWeight: "700", color: "#64748B" },
  
  listContent: { padding: 16 },
  reviewCard: { 
    backgroundColor: "#fff", 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  tableText: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  dateText: { fontSize: 12, color: "#64748B", marginTop: 2 },
  commentText: { fontSize: 15, color: "#1E293B", lineHeight: 22, marginBottom: 12 },
  
  itemsBox: { backgroundColor: "#F8FAFC", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#F1F5F9" },
  itemsTitle: { fontSize: 12, fontWeight: "700", color: "#64748B", marginBottom: 6, textTransform: "uppercase" },
  itemText: { fontSize: 13, color: "#475569", marginBottom: 2, fontWeight: "500" }
});