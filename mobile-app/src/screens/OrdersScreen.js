import { useState, useCallback, useEffect } from "react";
import { 
  View, Text, FlatList, TouchableOpacity, StyleSheet, 
  RefreshControl, ActivityIndicator, Alert, Platform, SectionList
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getOrders, updateOrderStatus, getProfile } from "../api";
import * as Print from 'expo-print'; 
import { useAuth } from "../context/AuthContext"; // <-- ADDED USEAUTH IMPORT

// Added "PREVIOUS" to the filter list
const STATUS_FILTERS = ["All", "EDITABLE", "CONFIRMED", "PREPARING", "SERVED", "TABLE_ACTIVE", "PAID", "PREVIOUS"];

export default function OrdersScreen() {
  // Grabbing isChefMode to lock down the buttons!
  const { isChefMode } = useAuth();
  
  const [orders, setOrders] = useState([]);
  const [profile, setProfile] = useState(null); 
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingTable, setProcessingTable] = useState(null);

  // NEW: A live clock to handle the 60-second customer edit countdown!
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    // Tick the clock every 1 second
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useFocusEffect(
    useCallback(() => { 
      loadData(); 
    }, [])
  );

  const loadData = async () => {
    try {
      const [ordersRes, profileRes] = await Promise.all([
        getOrders(),
        getProfile() 
      ]);
      setOrders(ordersRes.data);
      setProfile(profileRes.data);
    } catch (err) {
      console.error("Data load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleStatusUpdate = async (orderId, status) => {
    try {
      await updateOrderStatus(orderId, status);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  const handlePrintAndCheckout = async (currentOrder) => {
    setProcessingTable(currentOrder.table_number);

    try {
      const tableOrders = orders.filter(
        (o) => o.table_number === currentOrder.table_number && o.status !== "PAID" && o.status !== "REJECTED"
      );

      if (tableOrders.length === 0) return;

      let combinedSubtotal = 0;
      let combinedItems = {};

      tableOrders.forEach((o) => {
        combinedSubtotal += parseFloat(o.total_amount);
        const items = Array.isArray(o.items) ? o.items : JSON.parse(o.items || "[]");
        
        items.forEach(item => {
          if (combinedItems[item.name]) {
            combinedItems[item.name].quantity += item.quantity;
          } else {
            combinedItems[item.name] = { ...item };
          }
        });
      });

      const finalItemsList = Object.values(combinedItems);
      
      const cgstPercent = parseFloat(profile?.cgst_percentage || 0);
      const sgstPercent = parseFloat(profile?.sgst_percentage || 0);
      
      const cgstAmount = (combinedSubtotal * cgstPercent) / 100;
      const sgstAmount = (combinedSubtotal * sgstPercent) / 100;
      const grandTotal = combinedSubtotal + cgstAmount + sgstAmount;

      let itemsHtml = "";
      finalItemsList.forEach(i => {
        itemsHtml += `
          <tr>
            <td style="padding: 4px 0;">${i.name}</td>
            <td style="text-align: center;">${i.quantity}</td>
            <td style="text-align: right;">${(i.price * i.quantity).toFixed(2)}</td>
          </tr>
        `;
      });

      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: monospace; width: 80mm; padding: 10px; color: #000; margin: 0 auto; }
              h2 { text-align: center; margin: 0 0 5px 0; font-size: 24px; }
              .center { text-align: center; font-size: 14px; margin-bottom: 5px; }
              .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
              table { width: 100%; border-collapse: collapse; font-size: 14px; }
              .right { text-align: right; }
              .bold { font-weight: bold; }
            </style>
          </head>
          <body>
            <h2>${profile?.business_name || "Restaurant"}</h2>
            ${profile?.gst_number ? `<div class="center">GSTIN: ${profile.gst_number}</div>` : ''}
            <div class="center">Table: ${currentOrder.table_number}</div>
            <div class="center">Date: ${new Date().toLocaleString("en-IN")}</div>
            
            <div class="divider"></div>
            
            <table>
              <tr class="bold" style="border-bottom: 1px solid #000;">
                <td style="padding-bottom: 5px;">Item</td>
                <td class="center" style="padding-bottom: 5px;">Qty</td>
                <td class="right" style="padding-bottom: 5px;">Price</td>
              </tr>
              ${itemsHtml}
            </table>
            
            <div class="divider"></div>
            
            <table>
              <tr><td>Subtotal:</td><td class="right">${combinedSubtotal.toFixed(2)}</td></tr>
              ${cgstPercent > 0 ? `<tr><td>CGST (${cgstPercent}%):</td><td class="right">${cgstAmount.toFixed(2)}</td></tr>` : ''}
              ${sgstPercent > 0 ? `<tr><td>SGST (${sgstPercent}%):</td><td class="right">${sgstAmount.toFixed(2)}</td></tr>` : ''}
              <tr class="bold">
                <td style="font-size: 18px; padding-top: 10px;">GRAND TOTAL:</td>
                <td class="right" style="font-size: 18px; padding-top: 10px;">₹${grandTotal.toFixed(0)}</td>
              </tr>
            </table>
            
            <div class="divider"></div>
            <div class="center" style="font-weight: bold; font-size: 16px;">Thank You for Visiting!</div>
            
            <div class="center" style="margin-top: 15px;">
                <p style="font-size: 12px; margin-bottom: 5px;">How was your food? Scan to rate us!</p>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`${process.env.EXPO_PUBLIC_FRONTEND_URL || 'http://localhost:3000'}/feedback/${profile?.id}?table=${currentOrder.table_number}`)}" width="100" height="100" />
            </div>

          </body>
        </html>
      `;

     if (Platform.OS === 'web') {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);
        
        iframe.contentWindow.document.open();
        iframe.contentWindow.document.write(htmlContent);
        iframe.contentWindow.document.close();
        
        // THE FIX: Give the browser 500ms to load the QR code image before opening the print window!
        setTimeout(() => {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        }, 500);
        
        // Give the browser a little extra time before deleting the hidden iframe
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 3000);
      } else {
        await Print.printAsync({ html: htmlContent });
      }

      await Promise.all(tableOrders.map(o => updateOrderStatus(o.id, "PAID")));
      
      setOrders(prev => prev.map(o => 
        tableOrders.some(to => to.id === o.id) ? { ...o, status: "PAID" } : o
      ));

    } catch (err) {
      console.error("Print Error", err);
      Alert.alert("Print Failed", "Could not print the bill. Please try again.");
    } finally {
      setProcessingTable(null);
    }
  };

  // --- NEW PREVIOUS ORDERS HELPERS ---
  const isToday = (someDate) => {
    const today = new Date();
    const d = new Date(someDate);
    return d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
  };

  const getFilteredData = () => {
    if (filter === "All") return orders.filter(o => isToday(o.created_at));
    if (filter === "PREVIOUS") return []; // Handled by SectionList below
    return orders.filter((o) => o.status === filter && isToday(o.created_at));
  };

  const getGroupedPreviousOrders = () => {
    const previous = orders.filter(o => !isToday(o.created_at));
    const groups = previous.reduce((acc, order) => {
      const date = new Date(order.created_at).toLocaleDateString('en-IN', { 
        day: 'numeric', month: 'long', year: 'numeric' 
      });
      if (!acc[date]) acc[date] = [];
      acc[date].push(order);
      return acc;
    }, {});

    return Object.keys(groups).map(date => ({
      title: date,
      data: groups[date]
    })).sort((a, b) => new Date(b.title) - new Date(a.title));
  };

  const renderOrderItem = ({ item }) => {
    const items = Array.isArray(item.items) ? item.items : JSON.parse(item.items || "[]");
    const isProcessing = processingTable === item.table_number;
    const orderTime = new Date(item.updated_at || item.created_at).getTime();
    const secondsPassed = Math.floor((currentTime - orderTime) / 1000);
    const timeLeft = Math.max(0, 60 - secondsPassed);

    return (
      <View style={styles.orderCard}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: "#111" }}>
            Table {item.table_number}
          </Text>
          <View style={[styles.badge, { backgroundColor: statusColor(item.status) }]}>
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{item.status.replace("_", " ")}</Text>
          </View>
        </View>
        
        {items.map((i, idx) => (
          <Text key={idx} style={{ fontSize: 15, color: "#374151", marginBottom: 4, fontWeight: "500" }}>
            • {i.name} × {i.quantity} — <Text style={{fontWeight: '700'}}>₹{(i.price * i.quantity).toFixed(0)}</Text>
          </Text>
        ))}
        
        {item.special_instructions && (
          <View style={{ backgroundColor: "#FEF3C7", padding: 8, borderRadius: 8, marginTop: 6 }}>
            <Text style={{ fontSize: 13, color: "#92400E", fontWeight: "600" }}>
              📝 Note: {item.special_instructions}
            </Text>
          </View>
        )}
        
        <View style={styles.totalRow}>
          <Text style={{ fontWeight: "600", fontSize: 14, color: "#6B7280" }}>Subtotal:</Text>
          <Text style={{ fontWeight: "800", fontSize: 18, color: "#111" }}>₹{item.total_amount}</Text>
        </View>
        
        <Text style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>
          Ordered at: {new Date(item.created_at).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })}
        </Text>

        {/* ONLY SHOW ACTION BUTTONS IF IT IS A TODAY'S ORDER */}
        {isToday(item.created_at) && (
          <>
            {(item.status === "EDITABLE" || item.status === "CONFIRMED") && (
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                {item.status === "EDITABLE" && timeLeft > 0 ? (
                  <View style={[styles.actionBtn, { backgroundColor: "#F3F4F6", flexDirection: "row", justifyContent: "center", gap: 8 }]}>
                    <ActivityIndicator size="small" color="#9CA3AF" />
                    <Text style={[styles.actionBtnText, { color: "#6B7280" }]}>
                      Customer Reviewing ({timeLeft}s)...
                    </Text>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity 
                      style={[styles.actionBtn, { backgroundColor: "#10B981" }]} 
                      onPress={() => handleStatusUpdate(item.id, "PREPARING")}
                    >
                      <Text style={styles.actionBtnText}>Accept to Kitchen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionBtn, { backgroundColor: "#EF4444", flex: 0.4 }]} 
                      onPress={() => handleStatusUpdate(item.id, "REJECTED")}
                    >
                      <Text style={styles.actionBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
            
            {item.status === "PREPARING" && (
              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: "#F59E0B", marginTop: 16 }]}
                onPress={() => handleStatusUpdate(item.id, "SERVED")}
              >
                <Text style={[styles.actionBtnText, {color: '#fff'}]}>Food is Ready (Mark Served)</Text>
              </TouchableOpacity>
            )}

            {item.status === "SERVED" && (
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                <TouchableOpacity 
                  style={[styles.actionBtn, { backgroundColor: "#8B5CF6" }]} 
                  onPress={() => handleStatusUpdate(item.id, "TABLE_ACTIVE")}
                >
                  <Text style={styles.actionBtnText}>Keep Table Active</Text>
                </TouchableOpacity>

                {!isChefMode && (
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: isProcessing ? "#4B5563" : "#111827" }]}
                    onPress={() => handlePrintAndCheckout(item)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.actionBtnText}>Print & Clear</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}

            {item.status === "TABLE_ACTIVE" && (
              <>
                {!isChefMode && (
                  <TouchableOpacity 
                    style={[
                      styles.actionBtn, 
                      { backgroundColor: isProcessing ? "#4B5563" : "#111827", marginTop: 16, flexDirection: "row", justifyContent: "center", gap: 8 }
                    ]}
                    onPress={() => handlePrintAndCheckout(item)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={styles.actionBtnText}>Generating Master Bill...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="print-outline" size={20} color="#fff" />
                        <Text style={styles.actionBtnText}>Print Final Combined Bill</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}
          </>
        )}
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      <View>
        <FlatList
          horizontal
          data={STATUS_FILTERS}
          keyExtractor={(i) => i}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filterTab, filter === item && styles.filterTabActive]}
              onPress={() => setFilter(item)}
            >
              <Text style={[styles.filterTabText, filter === item && { color: "#fff" }]}>
                {item.replace("_", " ")}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {filter === "PREVIOUS" ? (
        <SectionList
          sections={getGroupedPreviousOrders()}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
          }
          contentContainerStyle={{ padding: 12 }}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.sectionHeader}>{title}</Text>
          )}
          renderItem={renderOrderItem}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Ionicons name="archive-outline" size={48} color="#D1D5DB" />
              <Text style={{ color: "#888", marginTop: 12, fontSize: 16, fontWeight: "500" }}>No archived orders</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={getFilteredData()} 
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
          }
          contentContainerStyle={{ padding: 12 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
              <Text style={{ color: "#888", marginTop: 12, fontSize: 16, fontWeight: "500" }}>No orders found for today</Text>
            </View>
          }
          renderItem={renderOrderItem}
        />
      )}
    </SafeAreaView>
  );
}

const statusColor = (s) =>
  ({
    EDITABLE: "#6B7280",
    CONFIRMED: "#3B82F6",
    PREPARING: "#F59E0B",
    SERVED: "#10B981",
    TABLE_ACTIVE: "#8B5CF6", 
    PAID: "#9CA3AF",
    REJECTED: "#EF4444",
  }[s] || "#888");

const styles = StyleSheet.create({
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#fff" },
  filterTabActive: { backgroundColor: "#111827", borderColor: "#111827" },
  filterTabText: { fontSize: 13, fontWeight: "700", color: "#4B5563" },
  orderCard: { backgroundColor: "#fff", borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  actionBtn: { flex: 1, borderRadius: 10, padding: 14, alignItems: "center" },
  actionBtnText: { color: "#fff", fontWeight: "800", fontSize: 15, textAlign: "center" },
  sectionHeader: { fontSize: 14, fontWeight: "800", color: "#6B7280", backgroundColor: "#f8f9fa", paddingVertical: 8, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
});