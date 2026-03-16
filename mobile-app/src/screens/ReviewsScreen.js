import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getReviews } from "../api";

const STAR_FILTERS = ["All", "5", "4", "3", "2", "1"];

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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#111" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      {/* Header */}
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: "row", alignItems: "center" }}>
           <Ionicons name="chevron-back" size={24} color="#111" />
           <Text style={{ fontSize: 16, fontWeight: "600", marginLeft: 4 }}>Profile</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: "800", color: "#111", marginRight: 16 }}>Reviews</Text>
      </View>

      {/* Filters */}
      <View style={styles.filterSection}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Text style={{ fontWeight: "700", color: "#374151" }}>Filter by Stars</Text>
          <TouchableOpacity onPress={() => setSortBy(sortBy === "latest" ? "oldest" : "latest")} style={styles.sortBtn}>
            <Ionicons name="swap-vertical" size={16} color="#4B5563" />
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

      {/* Reviews List */}
      <FlatList
        data={displayedReviews}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Ionicons name="star-half-outline" size={48} color="#D1D5DB" />
            <Text style={{ color: "#6B7280", marginTop: 12, fontSize: 15, fontWeight: "500" }}>No reviews found for this filter.</Text>
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
                <Text style={[styles.commentText, { color: "#9CA3AF", fontStyle: "italic" }]}>No written feedback provided.</Text>
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
  navHeader: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB", backgroundColor: "#fff", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  filterSection: { padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  sortBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F3F4F6", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  sortBtnText: { fontSize: 12, fontWeight: "600", color: "#4B5563" },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#fff" },
  filterTabActive: { backgroundColor: "#111827", borderColor: "#111827" },
  filterTabText: { fontSize: 13, fontWeight: "700", color: "#4B5563" },
  
  reviewCard: { backgroundColor: "#fff", padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  tableText: { fontSize: 16, fontWeight: "800", color: "#111827" },
  dateText: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  commentText: { fontSize: 15, color: "#374151", lineHeight: 22, marginBottom: 12 },
  
  itemsBox: { backgroundColor: "#F9FAFB", padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#F3F4F6" },
  itemsTitle: { fontSize: 12, fontWeight: "700", color: "#6B7280", marginBottom: 6, textTransform: "uppercase" },
  itemText: { fontSize: 13, color: "#4B5563", marginBottom: 2, fontWeight: "500" }
});