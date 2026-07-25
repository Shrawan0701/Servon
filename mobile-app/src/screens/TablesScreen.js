import { useState, useCallback, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, Modal, ActivityIndicator, Image, RefreshControl, Platform, Dimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getTables, addTable, deleteTable } from "../api";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

const isWeb = Platform.OS === 'web';

// ─── Responsive hook: returns true when screen is wide (tablet/desktop web) ───
function useIsWideScreen() {
  const [isWide, setIsWide] = useState(() => Dimensions.get('window').width >= 768);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setIsWide(window.width >= 768);
    });
    return () => sub?.remove?.();
  }, []);
  return isWide;
}

export default function TablesScreen() {
  const insets = useSafeAreaInsets();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [tableNumber, setTableNumber] = useState("");
  const [adding, setAdding] = useState(false);

  // ─── Delete confirmation state ───────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tableToDelete, setTableToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const isWideScreen = useIsWideScreen();
  const numColumns = isWideScreen ? 4 : 2;

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
    if (Platform.OS === 'web') {
      // Show custom modal instead of browser confirm
      setTableToDelete(id);
      setShowDeleteModal(true);
    } else {
      Alert.alert("Delete Table", "Are you sure?", [
        { text: "Cancel" },
        { text: "Delete", style: "destructive", onPress: () => confirmDelete(id) },
      ]);
    }
  };

  const confirmDelete = async (id) => {
    setDeleting(true);
    try {
      await deleteTable(id);
      setTables((prev) => prev.filter((t) => t.id !== id));
      setShowDeleteModal(false);
      setTableToDelete(null);
    } catch (err) {
      Alert.alert("Error", "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadQR = async (table) => {
    try {
      const token = await AsyncStorage.getItem("token");
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
      Alert.alert("Download Error", "Could not download QR. Check server connection.");
    }
  };
  
  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#111" /></View>;

  const screenWidth = Dimensions.get('window').width;
  const SIDE_PADDING = 32;
  const GAP = 16;
  const cols = numColumns;
 const containerWidth = isWideScreen ? Math.min(screenWidth, 1200) : screenWidth;
const cardWidth = (containerWidth - SIDE_PADDING - GAP * (cols - 1)) / cols;

  return (
    <SafeAreaView style={styles.container}>
      {/* ─── HEADER ─── */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <View>
            <Text style={styles.headerTitle}>Tables</Text>
            <Text style={styles.headerSub}>{tables.length} Active Tables</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addBtnText}>Add Table</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── TABLE GRID ─── */}
      <FlatList
        data={tables}
        keyExtractor={(t) => String(t.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTables(); }} />}
        numColumns={numColumns}
        key={`grid-${numColumns}`}
        contentContainerStyle={[styles.listContent, isWideScreen && { alignSelf: 'center', maxWidth: 1200, width: '100%' }]}
        columnWrapperStyle={styles.columnWrapper}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="grid-outline" size={48} color="#D1D5DB" />
            </View>
            <Text style={styles.emptyTitle}>No tables added</Text>
            <Text style={styles.emptySub}>Add tables to generate QR codes for your customers to scan and order.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAddModal(true)}>
              <Text style={styles.emptyBtnText}>Create Your First Table</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.tableCard, { width: cardWidth }]}>
            <View style={styles.cardHeader}>
               <View style={styles.tableBadge}>
                  <Text style={styles.tableBadgeText}>LIVE</Text>
               </View>
               <TouchableOpacity onPress={() => handleDelete(item.id)}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
               </TouchableOpacity>
            </View>

            <Text style={styles.tableNumberLabel}>TABLE</Text>
            <Text style={styles.tableNumberValue}>{item.table_number}</Text>
            
            <View style={styles.qrContainer}>
              {item.qr_code_url ? (
                <Image source={{ uri: item.qr_code_url }} style={styles.qrImage} />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Ionicons name="qr-code-outline" size={40} color="#E5E7EB" />
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.downloadBtn} onPress={() => handleDownloadQR(item)}>
              <Ionicons name="cloud-download-outline" size={16} color="#111" />
              <Text style={styles.downloadBtnText}>Download QR</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* ─── ADD MODAL ─── */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeaderRow}>
               <Text style={styles.modalTitle}>New Table</Text>
               <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <Ionicons name="close" size={24} color="#6B7280" />
               </TouchableOpacity>
            </View>
            
            <Text style={styles.inputLabel}>Table Name or Number</Text>
            <TextInput
              style={[styles.input, isWeb && { outlineStyle: 'none' }]}
              value={tableNumber}
              onChangeText={setTableNumber}
              placeholder="e.g. 05 or T-10"
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
            <TouchableOpacity style={styles.confirmBtn} onPress={handleAddTable} disabled={adding}>
              {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Confirm & Create</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── DELETE CONFIRM MODAL (web only) ─── */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalBox}>
            {/* Icon */}
            <View style={styles.deleteIconCircle}>
              <Ionicons name="trash-outline" size={28} color="#EF4444" />
            </View>

            <Text style={styles.deleteTitle}>Delete Table?</Text>
            <Text style={styles.deleteSub}>
              This will permanently remove the table and its QR code. This action cannot be undone.
            </Text>

            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowDeleteModal(false); setTableToDelete(null); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={() => confirmDelete(tableToDelete)}
                disabled={deleting}
              >
                {deleting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.deleteConfirmBtnText}>Yes, Delete</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF8F5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  
  header: { 
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E2D9",
    paddingVertical: 12
  },
  headerInner: {
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    paddingHorizontal: 20,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%'
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#111827" },
  headerSub: { fontSize: 13, color: "#78716C", marginTop: 2 },
  
  addBtn: { backgroundColor: "#111827", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  listContent: { padding: 16, flexGrow: 1 },
  columnWrapper: { justifyContent: 'flex-start', gap: 16, marginBottom: 16 },

  tableCard: { 
    backgroundColor: "#fff", 
    borderRadius: 16, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: "#E8E2D9", 
    alignItems: "center",
    ...Platform.select({
      ios: { shadowColor: "#A89880", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
      android: { elevation: 2 },
    })
  },
  cardHeader: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tableBadge: { backgroundColor: "#ECFDF5", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tableBadgeText: { color: "#10B981", fontSize: 9, fontWeight: "800" },

  tableNumberLabel: { fontSize: 10, fontWeight: "700", color: "#A8A29E", letterSpacing: 1 },
  tableNumberValue: { fontSize: 28, fontWeight: "900", color: "#111827", marginVertical: 2 },
  
  qrContainer: { width: '100%', aspectRatio: 1, backgroundColor: '#FAF8F5', borderRadius: 12, marginVertical: 12, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#E8E2D9', borderStyle: 'dashed' },
  qrImage: { width: '85%', height: '85%' },
  qrPlaceholder: { alignItems: 'center' },

  downloadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: "#F3F4F6", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, width: '100%', justifyContent: 'center' },
  downloadBtnText: { fontSize: 12, fontWeight: "700", color: "#111827" },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40, alignSelf: 'center', maxWidth: 600 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#fff", justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#E8E2D9' },
  emptyTitle: { fontSize: 20, fontWeight: "900", color: "#111827" },
  emptySub: { fontSize: 14, color: "#78716C", textAlign: "center", marginTop: 10, lineHeight: 22 },
  emptyBtn: { marginTop: 24, backgroundColor: "#111827", paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  emptyBtnText: { color: "#fff", fontWeight: "700" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(28, 25, 23, 0.7)", justifyContent: "center", padding: 20 },
  modalBox: { backgroundColor: "#fff", borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, alignSelf: 'center' },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#111827" },
  inputLabel: { fontSize: 13, fontWeight: "700", color: "#10B981", marginBottom: 8, letterSpacing: 0.5 },
  input: { borderWidth: 1.5, borderColor: "#E8E2D9", borderRadius: 12, padding: 14, fontSize: 16, color: "#111827", backgroundColor: "#FAF8F5" },
  confirmBtn: { backgroundColor: "#111827", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 12 },
  confirmBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  // ─── Delete modal styles ───────────────────────────────────────────────────
  deleteModalBox: { backgroundColor: "#fff", borderRadius: 20, padding: 28, width: '100%', maxWidth: 380, alignSelf: 'center', alignItems: 'center' },
  deleteIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#FEF2F2", justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  deleteTitle: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 8 },
  deleteSub: { fontSize: 13, color: "#78716C", textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  deleteActions: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: "#E8E2D9", borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: "700", color: "#374151" },
  deleteConfirmBtn: { flex: 1, backgroundColor: "#EF4444", borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  deleteConfirmBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});