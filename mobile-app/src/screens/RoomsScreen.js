// src/screens/RoomsScreen.js
// Staff-side Room Management — clean, professional staff screen that matches
// the existing Servon design system. Rooms are scoped to the authenticated
// business in the backend.

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  ScrollView,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getRooms, addRoom, checkInRoom, updateRoom, checkOutRoom, deleteRoom } from "../api";

const COLORS = {
  bg: "#F5F3EF",
  card: "#FFFFFF",
  border: "#EAE6E0",
  text: "#111827",
  subtext: "#6B7280",
  muted: "#9CA3AF",
  green: "#10B981",
  greenBg: "#ECFDF5",
  red: "#EF4444",
  redBg: "#FEF2F2",
  navy: "#0F172A",
};

export default function RoomsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const [roomNumber, setRoomNumber] = useState("");
  const [total, setTotal] = useState("");
  const [male, setMale] = useState("");
  const [female, setFemale] = useState("");
  const [children, setChildren] = useState("");
  const [saving, setSaving] = useState(false);

  const loadRooms = useCallback(async () => {
    try {
      const res = await getRooms();
      setRooms(res.data || []);
    } catch (err) {
      console.error("Load rooms error:", err);
      Alert.alert("Error", "Failed to load rooms.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRooms();
    }, [loadRooms])
  );

  const openAddModal = () => {
    setEditing(null);
    setRoomNumber("");
    setShowAdd(true);
  };

  const openCheckIn = (room) => {
    setEditing(room);
    setRoomNumber(room.room_number);
    setTotal(String(room.total_guests || ""));
    setMale(String(room.male || ""));
    setFemale(String(room.female || ""));
    setChildren(String(room.children || ""));
    setShowModal(true);
  };

  const handleAddRoom = async () => {
    if (!roomNumber.trim()) {
      Alert.alert("Add Room", "Please enter a room number.");
      return;
    }
    setSaving(true);
    try {
      await addRoom(roomNumber.trim());
      Alert.alert("Success", `Room ${roomNumber.trim()} added.`);
      setShowAdd(false);
      loadRooms();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Could not add room.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOccupancy = async () => {
    const t = parseInt(total, 10) || 0;
    const m = parseInt(male, 10) || 0;
    const f = parseInt(female, 10) || 0;
    const c = parseInt(children, 10) || 0;

    if (t < 0 || m < 0 || f < 0 || c < 0) {
      Alert.alert("Invalid Counts", "Counts cannot be negative.");
      return;
    }
    if (m + f + c !== t) {
      Alert.alert("Count Mismatch", "Male + Female + Children must equal Total Guests.");
      return;
    }

    setSaving(true);
    try {
      if (editing && editing.status === "OCCUPIED") {
        await updateRoom(editing.id, { total: t, male: m, female: f, children: c });
      } else {
        await checkInRoom(editing.id, { total: t, male: m, female: f, children: c });
      }
      Alert.alert("Success", `Room ${editing.room_number} updated.`);
      setShowModal(false);
      loadRooms();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Could not save room details.");
    } finally {
      setSaving(false);
    }
  };

 const handleCheckOut = (room) => {
  const doCheckOut = async () => {
    try {
      await checkOutRoom(room.id);
      loadRooms();
    } catch (err) {
      Alert.alert("Error", "Could not check out room.");
    }
  };

  if (Platform.OS === "web") {
    if (window.confirm(`Check out Room ${room.room_number}?`)) doCheckOut();
  } else {
    Alert.alert("Check Out", `Check out Room ${room.room_number}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Check Out", style: "destructive", onPress: doCheckOut },
    ]);
  }
};

 const handleDelete = (room) => {
  if (room.status === "OCCUPIED") {
    Alert.alert("Occupied", "Check out the room before deleting it.");
    return;
  }

  const doDelete = async () => {
    try {
      await deleteRoom(room.id);
      loadRooms();
    } catch (err) {
      Alert.alert("Error", "Could not delete room.");
    }
  };

  if (Platform.OS === "web") {
    if (window.confirm(`Delete Room ${room.room_number}?`)) doDelete();
  } else {
    Alert.alert("Delete Room", `Delete Room ${room.room_number}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: doDelete },
    ]);
  }
};

  const renderRoom = ({ item }) => {
    const occupied = item.status === "OCCUPIED";
    return (
      <View style={styles.roomCard}>
        <View style={styles.roomTopRow}>
          <View style={styles.roomIconWrap}>
            <Ionicons
              name={occupied ? "bed" : "bed-outline"}
              size={20}
              color={occupied ? COLORS.green : COLORS.subtext}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.roomTitle}>Room {item.room_number}</Text>
            <View style={styles.statusPill}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: occupied ? COLORS.green : COLORS.muted },
                ]}
              />
              <Text style={[styles.statusText, { color: occupied ? COLORS.green : COLORS.subtext }]}>
                {occupied ? "Occupied" : "Available"}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
            <Ionicons name="trash-outline" size={17} color={COLORS.muted} />
          </TouchableOpacity>
        </View>

        {occupied ? (
          <View style={styles.guestGrid}>
            <GuestStat label="Guests" value={item.total_guests} />
            <GuestStat label="Male" value={item.male} />
            <GuestStat label="Female" value={item.female} />
            <GuestStat label="Children" value={item.children} />
          </View>
        ) : (
          <Text style={styles.availHint}>No guests currently checked in.</Text>
        )}

        <View style={styles.actionRow}>
          {occupied ? (
            <>
              <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => handleEdit(item)}>
                <Ionicons name="create-outline" size={16} color={COLORS.navy} />
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.checkoutBtn]} onPress={() => handleCheckOut(item)}>
                <Ionicons name="log-out-outline" size={16} color="#fff" />
                <Text style={styles.checkoutBtnText}>Check Out</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={[styles.actionBtn, styles.checkinBtn]} onPress={() => openCheckIn(item)}>
              <Ionicons name="person-add-outline" size={16} color="#fff" />
              <Text style={styles.checkoutBtnText}>Check In</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const handleEdit = (room) => {
    setEditing(room);
    setRoomNumber(room.room_number);
    setTotal(String(room.total_guests || ""));
    setMale(String(room.male || ""));
    setFemale(String(room.female || ""));
    setChildren(String(room.children || ""));
    setShowModal(true);
  };

  return (
<SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Room Management</Text>
          <Text style={styles.subtitle}>Track guest occupancy across rooms</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.green} />
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item.id}
          renderItem={renderRoom}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRooms(); }} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="bed-outline" size={40} color={COLORS.muted} />
              <Text style={styles.emptyTitle}>No rooms yet</Text>
              <Text style={styles.emptySub}>Tap "+" to add your first room.</Text>
              <TouchableOpacity style={[styles.actionBtn, styles.checkinBtn, styles.emptyBtn]} onPress={openAddModal}>
                <Text style={styles.checkoutBtnText}>+ Add Room</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Add Room Modal */}
      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Room</Text>
            <Text style={styles.modalLabel}>Room Number</Text>
            <TextInput
              style={styles.input}
              value={roomNumber}
              onChangeText={setRoomNumber}
              placeholder="e.g. 204"
              placeholderTextColor={COLORS.muted}
              keyboardType="number-pad"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.actionBtn, styles.grayBtn]} onPress={() => setShowAdd(false)}>
                <Text style={styles.grayText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.checkinBtn]} onPress={handleAddRoom} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkoutBtnText}>Add Room</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Check In / Edit Modal */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <ScrollView contentContainerStyle={styles.modalOverlay}>
          <View style={[styles.modalBox, styles.occupancyBox]}>
            <Text style={styles.modalTitle}>
              {editing && editing.status === "OCCUPIED" ? "Edit Occupancy" : "Check In"} — Room {editing?.room_number}
            </Text>

            <Text style={styles.modalLabel}>Total Guests</Text>
            <TextInput style={styles.input} value={total} onChangeText={setTotal} placeholder="0" placeholderTextColor={COLORS.muted} keyboardType="number-pad" />

            <View style={styles.countRow}>
              <View style={styles.countCol}>
                <Text style={styles.modalLabel}>Male</Text>
                <TextInput style={styles.input} value={male} onChangeText={setMale} placeholder="0" placeholderTextColor={COLORS.muted} keyboardType="number-pad" />
              </View>
              <View style={styles.countCol}>
                <Text style={styles.modalLabel}>Female</Text>
                <TextInput style={styles.input} value={female} onChangeText={setFemale} placeholder="0" placeholderTextColor={COLORS.muted} keyboardType="number-pad" />
              </View>
              <View style={styles.countCol}>
                <Text style={styles.modalLabel}>Children</Text>
                <TextInput style={styles.input} value={children} onChangeText={setChildren} placeholder="0" placeholderTextColor={COLORS.muted} keyboardType="number-pad" />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.actionBtn, styles.grayBtn]} onPress={() => setShowModal(false)}>
                <Text style={styles.grayText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.checkinBtn]} onPress={handleSaveOccupancy} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkoutBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </Modal>
    </SafeAreaView>
  );
}

function GuestStat({ label, value }) {
  return (
    <View style={styles.guestStat}>
      <Text style={styles.guestStatValue}>{value}</Text>
      <Text style={styles.guestStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 19, fontWeight: "700", color: COLORS.text },
  subtitle: { fontSize: 12, color: COLORS.subtext, marginTop: 1 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.text,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: { padding: 16, paddingBottom: 40, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  roomCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  roomTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  roomIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.greenBg,
    alignItems: "center",
    justifyContent: "center",
  },
  roomTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "600" },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.redBg,
    alignItems: "center",
    justifyContent: "center",
  },
  guestGrid: { flexDirection: "row", marginTop: 16, gap: 8 },
  guestStat: { flex: 1, backgroundColor: COLORS.bg, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  guestStatValue: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  guestStatLabel: { fontSize: 11, color: COLORS.subtext, marginTop: 1 },
  availHint: { marginTop: 16, fontSize: 13, color: COLORS.subtext },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flex: 1,
  },
  editBtn: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  editBtnText: { color: COLORS.navy, fontSize: 14, fontWeight: "600" },
  checkinBtn: { backgroundColor: COLORS.green },
  checkoutBtn: { backgroundColor: COLORS.red },
  checkoutBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  grayBtn: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  grayText: { color: COLORS.subtext, fontSize: 14, fontWeight: "600" },
  emptyWrap: { alignItems: "center", paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginTop: 12 },
  emptySub: { fontSize: 13, color: COLORS.subtext, marginTop: 4 },
  emptyBtn: { marginTop: 18, maxWidth: 180, alignSelf: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 20 },
  modalBox: { width: "100%", maxWidth: 420, backgroundColor: "#fff", borderRadius: 16, padding: 20 },
  occupancyBox: { maxWidth: 480 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text, marginBottom: 4 },
  modalLabel: { fontSize: 12, fontWeight: "600", color: COLORS.subtext, marginTop: 12, marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text,
  },
  countRow: { flexDirection: "row", gap: 10 },
  countCol: { flex: 1 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 20 },
});