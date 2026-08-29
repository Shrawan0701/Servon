// src/components/ServonAssistantModal.js
// ONE unified Servon microphone/action system.
// The same mic understands whether staff are talking about an ORDER or a ROOM
// operation, resolves against the authoritative backend, shows a confirmation,
// then carries out the action through the existing order / room pipelines.

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { useAuth } from "../context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import {
  getMenu,
  getTables,
  getProfile,
  placeOrder,
  servonVoice,
  checkInRoom,
  updateRoom,
  checkOutRoom,
} from "../api";

const isWeb = Platform.OS === "web";

const COLORS = {
  bg: "#F5F3EF",
  card: "#fff",
  border: "#E8E2D9",
  text: "#111827",
  subtext: "#6B7280",
  muted: "#9CA3AF",
  navy: "#0F172A",
  green: "#10B981",
  greenBg: "#ECFDF5",
  red: "#EF4444",
  redBg: "#FEF2F2",
  amber: "#F59E0B",
  amberBg: "#FFFBEB",
};

const money = (n) => `₹${(parseFloat(n) || 0).toFixed(2)}`;

export default function ServonAssistantModal({ visible, onClose, initialMode = "manual" }) {
  const navigation = useNavigation();
  const { business } = useAuth();

  // Data loaded for MANUAL order mode (also the authoritative price source).
  const [menu, setMenu] = useState([]);
  const [tables, setTables] = useState([]);
  const [profile, setProfile] = useState(null);

  // Manual order state
  const [mode, setMode] = useState(initialMode);
  const [search, setSearch] = useState("");
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [placing, setPlacing] = useState(false);

  // Voice state
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [vState, setVState] = useState("idle"); // idle | listening | thinking
  const [vError, setVError] = useState("");
  const [result, setResult] = useState(null);
  const [resolvedAmbiguities, setResolvedAmbiguities] = useState({});
  const recordingRef = useRef(false);
  const autoStopTimer = useRef(null);
  const voiceInProgress = useRef(false);

  const loadData = useCallback(async () => {
    try {
      const [menuRes, tableRes, profileRes] = await Promise.all([getMenu(), getTables(), getProfile()]);
      setMenu(menuRes.data || []);
      setTables(tableRes.data || []);
      setProfile(profileRes.data || null);
    } catch (err) {
      console.error("Assistant load data error:", err);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setMode(initialMode);
      setSearch("");
      setSelectedTable(null);
      setSelectedItems([]);
      setResult(null);
      setVError("");
      setResolvedAmbiguities({});
      loadData();
    }
  }, [visible, initialMode, loadData]);

  useEffect(() => () => clearTimeout(autoStopTimer.current), []);
  useEffect(() => {
    if (!visible && recordingRef.current) {
      try { recorder.stop(); } catch (e) {}
      recordingRef.current = false;
      setVState("idle");
    }
  }, [visible, recorder]);

  const close = () => {
    if (voiceInProgress.current || vState === "listening" || vState === "thinking") return;
    onClose?.();
  };

  // ── Voice recording (same expo-audio flow as the existing Advisor) ──
  const startRecording = async () => {
    if (vState !== "idle") return;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setVError("Microphone permission is required to use Servon Assistant.");
        return;
      }
      setVError("");
      setResult(null);
      setResolvedAmbiguities({});
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      await recorder.record();
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (!recorder.getStatus().isRecording) throw new Error("Recorder failed to start.");
      recordingRef.current = true;
      setVState("listening");
      autoStopTimer.current = setTimeout(stopRecording, 30000);
    } catch (e) {
      recordingRef.current = false;
      setVState("idle");
      setVError("Could not start the microphone. Please try again.");
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    clearTimeout(autoStopTimer.current);
    try {
      if (!recorder.getStatus().isRecording) {
        recordingRef.current = false;
        setVState("idle");
        return;
      }
      await recorder.stop();
      recordingRef.current = false;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.getStatus().url;
      await submitVoice(uri);
    } catch (e) {
      recordingRef.current = false;
      setVState("idle");
      setVError("Could not finish the recording. Please try again.");
    }
  };

  const submitVoice = async (uri) => {
    if (!uri) {
      setVState("idle");
      setVError("No audio was captured. Please try again.");
      return;
    }
    setVState("thinking");
    voiceInProgress.current = true;
    try {
      const formData = new FormData();
      if (isWeb) {
        const blob = await (await fetch(uri)).blob();
        formData.append("audio", blob, "servon-voice.webm");
      } else {
        formData.append("audio", { uri, name: "servon-voice.m4a", type: "audio/m4a" });
      }
      const response = await servonVoice(formData);
      setResult(response.data);
      if (!response.data?.success) {
        setVError(response.data?.error || "I couldn't understand the request clearly.");
      }
    } catch (e) {
      setVError(e.response?.data?.error || "Voice request failed. Please try again.");
    } finally {
      setVState("idle");
      voiceInProgress.current = false;
    }
  };

  // ── Manual order helpers ───────────────────────────────────────────────
  const addMenuItem = (item) => {
    setSelectedItems((prev) => {
      const existing = prev.find((p) => p.id === item.id);
      if (existing) {
        return prev.map((p) => (p.id === item.id ? { ...p, quantity: p.quantity + 1 } : p));
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };
  const changeQty = (id, delta) => {
    setSelectedItems((prev) =>
      prev
        .map((p) => (p.id === id ? { ...p, quantity: (p.quantity || 1) + delta } : p))
        .filter((p) => p.quantity > 0)
    );
  };

  const filteredMenu = menu.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  const manualSubtotal = selectedItems.reduce((s, i) => s + parseFloat(i.price || 0) * i.quantity, 0);
  const mCgstP = parseFloat(profile?.cgst_percentage || 0);
  const mSgstP = parseFloat(profile?.sgst_percentage || 0);
  const mCgst = (manualSubtotal * mCgstP) / 100;
  const mSgst = (manualSubtotal * mSgstP) / 100;
  const mGrand = manualSubtotal + mCgst + mSgst;

  const confirmManualOrder = async () => {
    if (!selectedTable) { Alert.alert("Create Order", "Please select a table."); return; }
    if (selectedItems.length === 0) { Alert.alert("Create Order", "Please add at least one item."); return; }
    setPlacing(true);
    try {
      const items = selectedItems.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        imageUrl: i.image_url,
        is_thali: i.is_thali || false,
        thali_includes: i.thali_includes || [],
        thali_custom: i.thali_custom || "",
      }));
      const res = await placeOrder({
        businessId: business?.id,
        tableId: selectedTable.id,
        items,
        totalAmount: manualSubtotal,
      });
      Alert.alert("Order Created", `Order placed for ${selectedTable.table_number}.`);
      onClose?.();
      navigation.navigate("Orders");
      return res;
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Could not place order.");
    } finally {
      setPlacing(false);
    }
  };

  // ── Voice confirmation / submit ──────────────────────────────────────
  const voiceIntent = result?.intent;
  const isOrderKind = voiceIntent?.type === "CREATE_ORDER";
  const isRoomKind = ["ROOM_CHECK_IN", "ROOM_EDIT", "ROOM_CHECK_OUT"].includes(voiceIntent?.type);

  // Merge ambiguity choices chosen by the staff into the resolved items.
  const buildVoiceOrderItems = () => {
    const items = [...(voiceIntent?.items || [])].map((it) => it.menuItem);
    Object.values(resolvedAmbiguities).forEach((menuItem) => {
      items.push(menuItem);
    });
    return items;
  };

  // Remove an item row from the voice confirmation (staff editing).
  const voiceItems = buildVoiceOrderItems();
  const voiceOrderQty = (menuItemId) =>
    (voiceIntent?.items || []).filter((it) => it.menuItem?.id === menuItemId).reduce((s, it) => s + it.quantity, 0);
  const voiceAmbiguities = (voiceIntent?.ambiguities || []);
  // An ambiguity must be resolved before confirming, so we never silently
  // drop a spoken dish or create the wrong order.
  const hasUnresolvedAmbiguity = voiceAmbiguities.some(
    (a) => a.options.length > 0 && !resolvedAmbiguities[a.requestedName]
  );
  const hasNotFoundAmbiguity = voiceAmbiguities.some((a) => a.options.length === 0);

  const confirmVoiceOrder = async () => {
    if (!voiceIntent?.table) { Alert.alert("Cannot Confirm", "Please choose a valid table first."); return; }
    if (hasUnresolvedAmbiguity) { Alert.alert("Choose Items", "Please pick the correct item for the dishes I couldn't recognise."); return; }
    if (hasNotFoundAmbiguity) { Alert.alert("Item Not On Menu", "One of the dishes wasn't found on your menu. Please edit and add it manually."); return; }
    if (voiceItems.length === 0) { Alert.alert("Cannot Confirm", "No items were recognised. Please edit and try again."); return; }
    setPlacing(true);
    try {
      const items = voiceItems.map((m) => ({
        id: m.id,
        name: m.name,
        price: m.price,
        quantity: voiceOrderQty(m.id) || 1,
        imageUrl: m.image_url,
        is_thali: m.is_thali || false,
        thali_includes: m.thali_includes || [],
        thali_custom: m.thali_custom || "",
      }));
      await placeOrder({
        businessId: business?.id,
        tableId: voiceIntent.table.id,
        items,
      });
      Alert.alert("Order Created", `Order placed for Table ${voiceIntent.table.table_number}.`);
      onClose?.();
      navigation.navigate("Orders");
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Could not place order.");
    } finally {
      setPlacing(false);
    }
  };

  const confirmVoiceRoom = async () => {
    if (!voiceIntent?.room) { Alert.alert("Cannot Confirm", "Please choose a valid room first."); return; }
    setPlacing(true);
    try {
      const g = voiceIntent.guests || { total: 0, male: 0, female: 0, children: 0 };
      if (voiceIntent.action === "check_out") {
        await checkOutRoom(voiceIntent.room.id);
        Alert.alert("Success", `Room ${voiceIntent.room.room_number} checked out.`);
      } else if (voiceIntent.action === "edit") {
        await updateRoom(voiceIntent.room.id, { total: g.total, male: g.male, female: g.female, children: g.children });
        Alert.alert("Success", `Room ${voiceIntent.room.room_number} updated.`);
      } else {
        await checkInRoom(voiceIntent.room.id, { total: g.total, male: g.male, female: g.female, children: g.children });
        Alert.alert("Success", `Guests checked in to Room ${voiceIntent.room.room_number}.`);
      }
      onClose?.();
      navigation.navigate("Rooms");
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Could not update room.");
    } finally {
      setPlacing(false);
    }
  };

  // ── Manual Order body ─────────────────────────────────────────────────
  const manualOrderBody = (
    <View>
      <Text style={styles.sectionLabel}>TABLE</Text>
      <View style={styles.tableWrap}>
        <Ionicons name="restaurant-outline" size={16} color={COLORS.subtext} style={{ marginRight: 6 }} />
        <View style={styles.picker}>
          {tables.length === 0 ? (
            <Text style={styles.pickerEmpty}>No tables yet. Manage tables in the Tables tab.</Text>
          ) : (
            tables.map((t) => {
              const active = selectedTable?.id === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.tableChip, active && styles.tableChipActive]}
                  onPress={() => setSelectedTable(t)}
                >
                  <Text style={[styles.tableChipText, active && styles.tableChipTextActive]}>
                    {t.table_number}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </View>

      <Text style={styles.sectionLabel}>ADD ITEMS</Text>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={COLORS.muted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search menu items..."
          placeholderTextColor={COLORS.muted}
        />
      </View>

      {search.length === 0 && menu.length > 0 && (
        <Text style={styles.hint}>Type a dish name to search your menu.</Text>
      )}

      {filteredMenu.slice(0, 12).map((item) => (
        <View key={item.id} style={styles.menuRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuName}>{item.name}</Text>
            <Text style={styles.menuPrice}>{money(item.price)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.addItemBtn, !item.is_available && { opacity: 0.4 }]}
            onPress={() => item.is_available && addMenuItem(item)}
            disabled={!item.is_available}
          >
            <Ionicons name="add" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      ))}
      {filteredMenu.length === 0 && (
        <Text style={styles.emptyText}>No menu items match "{search}".</Text>
      )}

      {selectedItems.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>SELECTED ITEMS</Text>
          {selectedItems.map((i) => (
            <View key={i.id} style={styles.selRow}>
              <Text style={styles.selName}>{i.name} × {i.quantity}</Text>
              <Text style={styles.selPrice}>{money(i.price * i.quantity)}</Text>
              <View style={styles.qtyBtns}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQty(i.id, -1)}>
                  <Ionicons name="remove" size={14} color={COLORS.text} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQty(i.id, 1)}>
                  <Ionicons name="add" size={14} color={COLORS.text} />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <View style={styles.bill}>
            <BillRow label="Subtotal" value={money(manualSubtotal)} />
            {mCgstP > 0 && <BillRow label={`CGST (${mCgstP}%)`} value={money(mCgst)} />}
            {mSgstP > 0 && <BillRow label={`SGST (${mSgstP}%)`} value={money(mSgst)} />}
            <View style={styles.billDivider} />
            <BillRow label="Grand Total" value={money(mGrand)} strong />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, placing && { opacity: 0.6 }]}
            onPress={confirmManualOrder}
            disabled={placing}
          >
            {placing ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Create Order</Text>
              </>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  // ── Voice prompt body ────────────────────────────────────────────────
  const listening = vState === "listening";
  const thinking = vState === "thinking";
  const voicePromptBody = (
    <View style={styles.voicePrompt}>
      <View
        style={[
          styles.micButton,
          listening && styles.micButtonListening,
          thinking && styles.micButtonThinking,
        ]}
      >
        <Ionicons
          name={listening ? "mic" : thinking ? "hourglass-outline" : "mic-outline"}
          size={34}
          color="#fff"
        />
      </View>
      <Text style={styles.voiceTitle}>
        {listening ? "Listening…" : thinking ? "Understanding…" : "Speak your order or room details"}
      </Text>
      <Text style={styles.voiceSubtitle}>
        {listening
          ? "Tap stop when you're done"
          : thinking
          ? "Detecting order or room request"
          : "Example: “Table 4, two biryanis and one paneer bhaji”\nor “Room 204, three guests”"}
      </Text>

      <TouchableOpacity
        style={[styles.primaryBtn, styles.voiceBtn, listening && { backgroundColor: COLORS.red }, thinking && { opacity: 0.5 }]}
        onPress={listening ? stopRecording : startRecording}
        disabled={thinking}
      >
        <Ionicons name={listening ? "stop" : "mic"} size={18} color="#fff" />
        <Text style={styles.primaryBtnText}>{listening ? "Stop" : "Start Recording"}</Text>
      </TouchableOpacity>

      {!!vError && <Text style={styles.errorText}>{vError}</Text>}
    </View>
  );

  // ── Voice: Order confirmation body ────────────────────────────────────
  const orderConfirmBody = (
    <View>
      <View style={styles.heardBox}>
        <Text style={styles.heardLabel}>I HEARD</Text>
        <Text style={styles.heardText}>"{result?.transcript}"</Text>
      </View>

      <View style={styles.confirmCard}>
        <Text style={styles.confirmTitle}>Create Order</Text>
        <Text style={styles.tableLine}>
          <Ionicons name="restaurant-outline" size={14} color={COLORS.subtext} /> Table{" "}
          {voiceIntent?.table?.table_number || voiceIntent?.tableRaw || "—"}
        </Text>

        {voiceItems.map((m, idx) => (
          <View key={`${m.id}-${idx}`} style={styles.ciRow}>
            <Text style={styles.ciName}>{m.name} × {voiceOrderQty(m.id) || 1}</Text>
            <Text style={styles.ciPrice}>{money((parseFloat(m.price) || 0) * (voiceOrderQty(m.id) || 1))}</Text>
          </View>
        ))}

        {voiceAmbiguities.length > 0 && (
          <View style={styles.ambigBox}>
            <Text style={styles.ambigTitle}>Choose the correct item</Text>
            {voiceAmbiguities.map((a, ai) => (
              <View key={ai} style={{ marginBottom: 8 }}>
                <Text style={styles.ambigReq}>“{a.requestedName}”</Text>
                {a.options.length === 0 ? (
                  <Text style={styles.ambigNone}>No match on your menu.</Text>
                ) : (
                  a.options.map((op) => {
                    const chosen = resolvedAmbiguities[a.requestedName]?.id === op.id;
                    return (
                      <TouchableOpacity
                        key={op.id}
                        style={[styles.optionChip, chosen && styles.optionChipActive]}
                        onPress={() =>
                          setResolvedAmbiguities((prev) => ({ ...prev, [a.requestedName]: op }))
                        }
                      >
                        <Text style={[styles.optionText, chosen && styles.optionTextActive]}>
                          {op.name} — {money(op.price)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            ))}
          </View>
        )}

        {!!voiceIntent?.summary && (
          <View style={styles.bill}>
            <BillRow label="Subtotal" value={money(voiceIntent.summary.subtotal)} />
            {voiceIntent.summary.cgstPercent > 0 && (
              <BillRow label={`CGST (${voiceIntent.summary.cgstPercent}%)`} value={money(voiceIntent.summary.cgst)} />
            )}
            {voiceIntent.summary.sgstPercent > 0 && (
              <BillRow label={`SGST (${voiceIntent.summary.sgstPercent}%)`} value={money(voiceIntent.summary.sgst)} />
            )}
            <View style={styles.billDivider} />
            <BillRow label="Grand Total" value={money(voiceIntent.summary.grandTotal)} strong />
          </View>
        )}
      </View>

      {voiceIntent?.errors?.length > 0 && (
        <View style={styles.errorBox}>
          {voiceIntent.errors.map((e, i) => <Text key={i} style={styles.errorText}>{e}</Text>)}
        </View>
      )}

      <View style={styles.confirmActions}>
        <TouchableOpacity style={[styles.secondaryBtn]} onPress={() => { setResult(null); setVError(""); }}>
          <Text style={styles.secondaryText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, placing && { opacity: 0.6 }]}
          onPress={confirmVoiceOrder}
          disabled={placing || voiceIntent?.errors?.length > 0}
        >
          {placing ? <ActivityIndicator color="#fff" /> : (
            <><Ionicons name="checkmark" size={18} color="#fff" /><Text style={styles.primaryBtnText}>Create Order</Text></>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Voice: Room confirmation body ────────────────────────────────────
  const g = voiceIntent?.guests || { total: 0, male: 0, female: 0, children: 0 };
  const roomConfirmBody = (
    <View>
      <View style={styles.heardBox}>
        <Text style={styles.heardLabel}>I HEARD</Text>
        <Text style={styles.heardText}>"{result?.transcript}"</Text>
      </View>

      <View style={styles.confirmCard}>
        <Text style={styles.confirmTitle}>
          {voiceIntent?.action === "check_out" ? "Room Check-Out" : "Room Check-In"}
        </Text>
        <Text style={styles.tableLine}>
          <Ionicons name="bed-outline" size={14} color={COLORS.subtext} /> Room{" "}
          {voiceIntent?.room?.room_number || voiceIntent?.roomRaw || "—"}
        </Text>

        {voiceIntent?.action !== "check_out" && (
          <View style={styles.guestStats}>
            <GuestStatBox label="Guests" value={g.total} />
            <GuestStatBox label="Male" value={g.male} />
            <GuestStatBox label="Female" value={g.female} />
            <GuestStatBox label="Children" value={g.children} />
          </View>
        )}
      </View>

      {voiceIntent?.warnings?.length > 0 && (
        <View style={styles.warnBox}>
          {voiceIntent.warnings.map((w, i) => <Text key={i} style={styles.warnText}>{w}</Text>)}
        </View>
      )}

      <View style={styles.confirmActions}>
        <TouchableOpacity style={[styles.secondaryBtn]} onPress={() => { setResult(null); setVError(""); }}>
          <Text style={styles.secondaryText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, placing && { opacity: 0.6 }]}
          onPress={confirmVoiceRoom}
          disabled={placing || voiceIntent?.errors?.length > 0}
        >
          {placing ? <ActivityIndicator color="#fff" /> : (
            <><Ionicons name="checkmark" size={18} color="#fff" /><Text style={styles.primaryBtnText}>Save</Text></>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const switchMode = (next) => {
    setResult(null);
    setVError("");
    setResolvedAmbiguities({});
    setMode(next);
  };

  let body;
  if (result && isOrderKind) body = orderConfirmBody;
  else if (result && isRoomKind) body = roomConfirmBody;
  else if (mode === "voice") body = voicePromptBody;
  else body = manualOrderBody;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>{mode === "voice" ? "Servon Assistant" : "Create Order"}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={close}>
              <Ionicons name="close" size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, mode === "manual" && styles.tabActive]}
              onPress={() => switchMode("manual")}
            >
              <Ionicons name="create-outline" size={16} color={mode === "manual" ? COLORS.text : COLORS.subtext} />
              <Text style={[styles.tabText, mode === "manual" && styles.tabTextActive]}>Manual</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === "voice" && styles.tabActive]}
              onPress={() => switchMode("voice")}
            >
              <Ionicons name="mic-outline" size={16} color={mode === "voice" ? COLORS.text : COLORS.subtext} />
              <Text style={[styles.tabText, mode === "voice" && styles.tabTextActive]}>Voice</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            {body}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function BillRow({ label, value, strong }) {
  return (
    <View style={styles.billRow}>
      <Text style={[styles.billLabel, strong && styles.billLabelStrong]}>{label}</Text>
      <Text style={[styles.billValue, strong && styles.billValueStrong]}>{value}</Text>
    </View>
  );
}

function GuestStatBox({ label, value }) {
  return (
    <View style={styles.guestStatBox}>
      <Text style={styles.guestStatBoxValue}>{value}</Text>
      <Text style={styles.guestStatBoxLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { width: "100%", maxWidth: 520, maxHeight: "92%", backgroundColor: "#fff", borderRadius: 18 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12 },
  title: { fontSize: 19, fontWeight: "800", color: COLORS.text },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingBottom: 14 },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: COLORS.bg },
  tabActive: { backgroundColor: COLORS.greenBg, borderWidth: 1, borderColor: COLORS.green },
  tabText: { color: COLORS.subtext, fontSize: 13, fontWeight: "700" },
  tabTextActive: { color: COLORS.green },
  body: { flexShrink: 1 },
  bodyContent: { padding: 18, paddingTop: 4 },
  sectionLabel: { fontSize: 11, fontWeight: "800", color: COLORS.muted, letterSpacing: 0.6, marginBottom: 8, marginTop: 8, textTransform: "uppercase" },
  tableWrap: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  picker: { flexDirection: "row", flexWrap: "wrap", gap: 8, flex: 1 },
  pickerEmpty: { fontSize: 12, color: COLORS.muted },
  tableChip: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  tableChipActive: { borderColor: COLORS.green, backgroundColor: COLORS.greenBg },
  tableChipText: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  tableChipTextActive: { color: COLORS.green },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: COLORS.bg, paddingHorizontal: 12, marginBottom: 10 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: COLORS.text },
  hint: { fontSize: 12, color: COLORS.muted, marginBottom: 10 },
  menuRow: { flexDirection: "row", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  menuName: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  menuPrice: { fontSize: 12, color: COLORS.subtext, marginTop: 2 },
  addItemBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.text, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 13, color: COLORS.muted, textAlign: "center", marginVertical: 12 },
  selRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 8 },
  selName: { flex: 1, fontSize: 13, fontWeight: "600", color: COLORS.text },
  selPrice: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  qtyBtns: { flexDirection: "row", gap: 6 },
  qtyBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border },
  bill: { backgroundColor: COLORS.bg, borderRadius: 12, padding: 12, marginTop: 12, gap: 4 },
  billRow: { flexDirection: "row", justifyContent: "space-between" },
  billLabel: { fontSize: 13, color: COLORS.subtext },
  billLabelStrong: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  billValue: { fontSize: 13, color: COLORS.text },
  billValueStrong: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  billDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: COLORS.text, borderRadius: 12, paddingVertical: 13, marginTop: 14 },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  secondaryBtn: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg, borderRadius: 12, paddingVertical: 13, marginTop: 14, borderWidth: 1, borderColor: COLORS.border },
  secondaryText: { color: COLORS.text, fontSize: 15, fontWeight: "700" },
  confirmActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  voicePrompt: { alignItems: "center", paddingVertical: 18 },
  micButton: { width: 74, height: 74, borderRadius: 37, backgroundColor: COLORS.text, alignItems: "center", justifyContent: "center", marginTop: 6 },
  micButtonListening: { backgroundColor: COLORS.red },
  micButtonThinking: { backgroundColor: COLORS.amber },
  voiceTitle: { fontSize: 17, fontWeight: "800", color: COLORS.text, marginTop: 16, textAlign: "center" },
  voiceSubtitle: { fontSize: 13, color: COLORS.subtext, marginTop: 6, textAlign: "center", lineHeight: 19 },
  voiceBtn: { alignSelf: "stretch" },
  errorText: { color: COLORS.red, fontSize: 13, textAlign: "center", marginTop: 12 },
  heardBox: { backgroundColor: COLORS.greenBg, borderRadius: 12, padding: 12, marginBottom: 12 },
  heardLabel: { fontSize: 10, fontWeight: "800", color: COLORS.green, letterSpacing: 0.6 },
  heardText: { fontSize: 14, color: COLORS.text, marginTop: 4, lineHeight: 20 },
  confirmCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14 },
  confirmTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text, marginBottom: 8 },
  tableLine: { fontSize: 14, fontWeight: "700", color: COLORS.text, marginBottom: 10 },
  ciRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  ciName: { flex: 1, fontSize: 13, color: COLORS.text },
  ciPrice: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  ambigBox: { marginTop: 12 },
  ambigTitle: { fontSize: 12, fontWeight: "700", color: COLORS.amber, marginBottom: 8 },
  ambigReq: { fontSize: 13, fontWeight: "600", color: COLORS.text, marginBottom: 4 },
  ambigNone: { fontSize: 12, color: COLORS.muted },
  optionChip: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6 },
  optionChipActive: { borderColor: COLORS.green, backgroundColor: COLORS.greenBg },
  optionText: { fontSize: 13, color: COLORS.text },
  optionTextActive: { color: COLORS.green, fontWeight: "700" },
  errorBox: { marginTop: 12, backgroundColor: COLORS.redBg, borderRadius: 10, padding: 10, gap: 4 },
  warnBox: { marginTop: 12, backgroundColor: COLORS.amberBg, borderRadius: 10, padding: 10, gap: 4 },
  warnText: { color: "#92400E", fontSize: 12 },
  guestStats: { flexDirection: "row", gap: 8, marginTop: 6 },
  guestStatBox: { flex: 1, backgroundColor: COLORS.bg, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  guestStatBoxValue: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  guestStatBoxLabel: { fontSize: 11, color: COLORS.subtext, marginTop: 1 },
});