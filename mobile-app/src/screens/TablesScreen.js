import { useState, useCallback, useEffect } from "react";
import { View, Text as NativeText, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, Modal, ActivityIndicator, Image, RefreshControl, Platform, Dimensions } from "react-native";
import LocalizedText, { localizeText } from "../components/LocalizedText";
import { useLocale } from "../context/LocaleContext";
import { useFocusEffect } from "@react-navigation/native";

import localDB from "../services/LocalDB";
import { refreshPOSData } from "../services/refreshPOSData";

import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from '../config/api';

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
  const { language } = useLocale();
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
    try { setTables(await localDB.getTables()); }
    finally { setLoading(false); setRefreshing(false); }
    refreshPOSData(['tables']).catch(() => {});
  };
  useEffect(() => localDB.subscribe(() => { localDB.getTables().then(setTables).catch(() => {}); }), []);

  const handleAddTable = async () => {
    if (!tableNumber.trim()) { Alert.alert(localizeText("Required", language), localizeText("Enter a table number", language)); return; }
    setAdding(true);
    try {
      const table = await localDB.addLocalTable(tableNumber.trim());
      setTables((prev) => [...prev, table]);
      setTableNumber("");
      setShowAddModal(false);
    } catch (err) {
      Alert.alert(localizeText("Error", language), err.response?.data?.error || localizeText("Failed to add table", language));
    } finally { setAdding(false); }
  };

  const handleDelete = (id) => {
    if (Platform.OS === 'web') {
      // Show custom modal instead of browser confirm
      setTableToDelete(id);
      setShowDeleteModal(true);
    } else {
      Alert.alert(localizeText("Delete Table", language), localizeText("Are you sure?", language), [
        { text: localizeText("Cancel", language) },
        { text: localizeText("Delete", language), style: "destructive", onPress: () => confirmDelete(id) },
      ]);
    }
  };

  const confirmDelete = async (id) => {
    setDeleting(true);
    try {
      await localDB.deleteLocalTable(id);
      setTables((prev) => prev.filter((t) => t.id !== id));
      setShowDeleteModal(false);
      setTableToDelete(null);
    } catch (err) {
      Alert.alert(localizeText("Error", language), localizeText("Delete failed", language));
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadQR = async (table) => {
    try {
      const token = await AsyncStorage.getItem("token");
      const baseUrl = API_BASE_URL;
      const downloadUrl = `${baseUrl}/api/tables/${table.id}/qr-pdf?token=${token}&lang=${language}`;

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
      Alert.alert(localizeText("Download Error", language), localizeText("Could not download QR. Check server connection.", language));
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
            <LocalizedText translate style={styles.headerTitle}>Tables</LocalizedText>
            <LocalizedText style={styles.headerSub}>{tables.length} {localizeText("Active Tables", language)}</LocalizedText>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
            <Ionicons name="add" size={20} color="#fff" />
            <LocalizedText translate style={styles.addBtnText}>Add Table</LocalizedText>
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
            <LocalizedText translate style={styles.emptyTitle}>No tables added</LocalizedText>
            <LocalizedText translate style={styles.emptySub}>Add tables to generate QR codes for your customers to scan and order.</LocalizedText>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAddModal(true)}>
              <LocalizedText translate style={styles.emptyBtnText}>Create Your First Table</LocalizedText>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.tableCard, { width: cardWidth }]}>
            <View style={styles.cardHeader}>
               <View style={styles.tableBadge}>
                  <LocalizedText translate style={styles.tableBadgeText}>LIVE</LocalizedText>
               </View>
               <TouchableOpacity style={styles.deleteIconBtn} onPress={() => handleDelete(item.id)}>
                  <Ionicons name="trash-outline" size={17} color="#BB4B40" />
               </TouchableOpacity>
            </View>

            <LocalizedText translate style={styles.tableNumberLabel}>TABLE</LocalizedText>
            <LocalizedText style={styles.tableNumberValue}>{item.table_number}</LocalizedText>
            
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
              <Ionicons name="cloud-download-outline" size={17} color="#2E503C" />
              <LocalizedText translate style={styles.downloadBtnText}>Download QR</LocalizedText>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* ─── ADD MODAL ─── */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeaderRow}>
               <LocalizedText translate style={styles.modalTitle}>New Table</LocalizedText>
               <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowAddModal(false)}>
                  <Ionicons name="close" size={20} color="#627166" />
               </TouchableOpacity>
            </View>
            
            <LocalizedText translate style={styles.inputLabel}>Table Name or Number</LocalizedText>
            <TextInput
              style={[styles.input, isWeb && { outlineStyle: 'none' }]}
              value={tableNumber}
              onChangeText={setTableNumber}
              placeholder={localizeText("e.g. 05 or T-10", language)}
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
            <TouchableOpacity style={styles.confirmBtn} onPress={handleAddTable} disabled={adding}>
              {adding ? <ActivityIndicator color="#fff" /> : <LocalizedText translate style={styles.confirmBtnText}>Confirm & Create</LocalizedText>}
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

            <LocalizedText translate style={styles.deleteTitle}>Delete Table?</LocalizedText>
            <LocalizedText translate style={styles.deleteSub}>
              This will permanently remove the table and its QR code. This action cannot be undone.
            </LocalizedText>

            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowDeleteModal(false); setTableToDelete(null); }}
              >
                <LocalizedText translate style={styles.cancelBtnText}>Cancel</LocalizedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={() => confirmDelete(tableToDelete)}
                disabled={deleting}
              >
                {deleting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <LocalizedText translate style={styles.deleteConfirmBtnText}>Yes, Delete</LocalizedText>
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

  deleteIconBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FDF3F2' },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 9, backgroundColor: '#F3F5F2', alignItems: 'center', justifyContent: 'center' },

  container: { flex: 1, backgroundColor: '#F3F5F2' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F5F2' },
  
  header: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#DFE5DF', paddingVertical: 18 },
  headerInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, paddingHorizontal: 16, maxWidth: 1200, alignSelf: 'center', width: '100%' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#20332A', letterSpacing: -0.4 },
  headerSub: { fontSize: 13, color: '#627166', marginTop: 5 },
  
  addBtn: { backgroundColor: '#2E503C', borderRadius: 9, minHeight: 44, paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 7 },
  addBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },

  listContent: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 32, flexGrow: 1 },
  columnWrapper: { justifyContent: 'flex-start', gap: 16, marginBottom: 16 },

  tableCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#DFE5DF', alignItems: 'center' },
  cardHeader: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tableBadge: { backgroundColor: '#EAF2EC', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 5 },
  tableBadgeText: { color: '#39805A', fontSize: 10, fontWeight: '600' },

  tableNumberLabel: { fontSize: 10, fontWeight: '500', color: '#627166', marginTop: 2 },
  tableNumberValue: { fontSize: 30, fontWeight: '700', color: '#20332A', marginTop: 4, marginBottom: 4, letterSpacing: -0.5 },
  
  qrContainer: { width: '100%', maxWidth: 216, aspectRatio: 1, backgroundColor: '#FFFFFF', borderRadius: 9, marginVertical: 16, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#E8EDE8' },
  qrImage: { width: '85%', height: '85%' },
  qrPlaceholder: { alignItems: 'center' },

  downloadBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#F3F5F2', borderWidth: 1, borderColor: '#DFE5DF', borderRadius: 8, minHeight: 44, paddingHorizontal: 8, paddingVertical: 10, width: '100%', justifyContent: 'center' },
  downloadBtnText: { fontSize: 12, fontWeight: '600', color: '#2E503C', flexShrink: 1, textAlign: 'center' },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40, alignSelf: 'center', maxWidth: 600 },
  emptyIconCircle: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#EAF2EC', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 21, fontWeight: '700', color: '#20332A' },
  emptySub: { fontSize: 14, color: '#627166', textAlign: 'center', marginTop: 10, lineHeight: 22 },
  emptyBtn: { marginTop: 24, backgroundColor: '#2E503C', paddingHorizontal: 22, paddingVertical: 14, borderRadius: 9 },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(23,38,30,0.48)', justifyContent: 'center', padding: 20 },
  modalBox: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 24, width: '100%', maxWidth: 420, alignSelf: 'center' },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 18, marginBottom: 22, borderBottomWidth: 1, borderBottomColor: '#DFE5DF' },
  modalTitle: { fontSize: 21, fontWeight: '700', color: '#20332A', letterSpacing: -0.3 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#405448', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#DFE5DF', borderRadius: 9, minHeight: 48, padding: 13, fontSize: 15, color: '#20332A', backgroundColor: '#FFFFFF' },
  confirmBtn: { backgroundColor: '#2E503C', borderRadius: 9, minHeight: 48, padding: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  confirmBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },

  // ─── Delete modal styles ───────────────────────────────────────────────────
  deleteModalBox: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380, alignSelf: 'center', alignItems: 'center' },
  deleteIconCircle: { width: 56, height: 56, borderRadius: 14, backgroundColor: '#FDF3F2', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  deleteTitle: { fontSize: 19, fontWeight: '700', color: '#20332A', marginBottom: 10 },
  deleteSub: { fontSize: 14, color: '#627166', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  deleteActions: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#DFE5DF', borderRadius: 9, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#405448' },
  deleteConfirmBtn: { flex: 1, backgroundColor: '#BB4B40', borderRadius: 9, paddingVertical: 14, alignItems: 'center' },
  deleteConfirmBtnText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
});
