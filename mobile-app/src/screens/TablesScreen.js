import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, Modal, ActivityIndicator, Image, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getTables, addTable, deleteTable } from "../api";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { SafeAreaView } from "react-native-safe-area-context";
import { Platform} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function TablesScreen() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [tableNumber, setTableNumber] = useState("");
  const [adding, setAdding] = useState(false);

  useFocusEffect(useCallback(() => { loadTables(); }, []));

  const loadTables = async () => {
    try {
      const res = await getTables();
      setTables(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const handleAddTable = async () => {
    if (!tableNumber.trim()) { Alert.alert("Required", "Enter a table number"); return; }
    setAdding(true);
    try {
      const res = await addTable(tableNumber.trim());
      setTables((prev) => [...prev, res.data]);
      setTableNumber("");
      setShowAddModal(false);
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Failed to add table");
    } finally { setAdding(false); }
  };

  const handleDelete = (id) => {
    Alert.alert("Delete Table", "Are you sure?", [
      { text: "Cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try { await deleteTable(id); setTables((prev) => prev.filter((t) => t.id !== id)); }
          catch (err) { Alert.alert("Error", "Delete failed"); }
        }
      },
    ]);
  };

 const handleDownloadQR = async (table) => {
    try {
      const token = await AsyncStorage.getItem("token");
      
      // ⚠️ IMPORTANT: Replace '192.168.x.x' with your computer's actual IP address
      const baseUrl = process.env.EXPO_PUBLIC_API_URL || "http://192.168.x.x:5000"; 
      const downloadUrl = `${baseUrl}/api/tables/${table.id}/qr-pdf?token=${token}`;

      if (Platform.OS === 'web') {
        window.open(downloadUrl, '_blank');
      } else {
        const filename = `table-${table.table_number}-qr.pdf`;
        const fileUri = FileSystem.cacheDirectory + filename;

        const res = await FileSystem.downloadAsync(downloadUrl, fileUri, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status !== 200) throw new Error("Download failed");

        await Sharing.shareAsync(res.uri, {
          mimeType: "application/pdf",
          dialogTitle: `Table ${table.table_number} QR Code`,
        });
      }
    } catch (err) {
      console.error("QR Download Error:", err);
      Alert.alert("Download Error", "Make sure your phone and laptop are on the same Wi-Fi and you're using your Laptop's IP address.");
    }
  };
  
  if (loading) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><ActivityIndicator size="large" color="#111" /></View>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      <View style={{ padding: 12, alignItems: "flex-end" }}>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>+ Add Table</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={tables}
        keyExtractor={(t) => t.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTables(); }} />}
        numColumns={2}
        contentContainerStyle={{ padding: 8 }}
        columnWrapperStyle={{ gap: 8 }}
        ListEmptyComponent={<Text style={{ textAlign: "center", marginTop: 40, color: "#888" }}>No tables yet. Add your first table!</Text>}
        renderItem={({ item }) => (
          <View style={styles.tableCard}>
            <Text style={styles.tableNumber}>Table {item.table_number}</Text>
            {item.qr_code_url && (
              <Image source={{ uri: item.qr_code_url }} style={styles.qrImage} />
            )}
            <TouchableOpacity style={styles.downloadBtn} onPress={() => handleDownloadQR(item)}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#111" }}>⬇ Download QR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteTableBtn} onPress={() => handleDelete(item.id)}>
              <Text style={{ fontSize: 12, color: "#dc3545", fontWeight: "600" }}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      />
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Table</Text>
            <TextInput
              style={styles.input}
              value={tableNumber}
              onChangeText={setTableNumber}
              placeholder="e.g. 1, A1, VIP-1"
              autoFocus
            />
            <TouchableOpacity style={styles.confirmBtn} onPress={handleAddTable} disabled={adding}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>{adding ? "Adding..." : "Add Table"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 12, alignItems: "center" }} onPress={() => setShowAddModal(false)}>
              <Text style={{ color: "#555" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  addBtn: { backgroundColor: "#111", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  tableCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#ebebeb", alignItems: "center" },
  tableNumber: { fontSize: 16, fontWeight: "700", color: "#111", marginBottom: 10 },
  qrImage: { width: 120, height: 120, marginBottom: 10 },
  downloadBtn: { borderWidth: 1.5, borderColor: "#111", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 6 },
  deleteTableBtn: { paddingVertical: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  input: { borderWidth: 1.5, borderColor: "#ddd", borderRadius: 10, padding: 14, fontSize: 15, color: "#111", marginBottom: 16 },
  confirmBtn: { backgroundColor: "#111", borderRadius: 10, padding: 16, alignItems: "center" },
});

async function getToken() {
  const AsyncStorage = require("@react-native-async-storage/async-storage").default;
  return AsyncStorage.getItem("token");
}