// src/components/ServonAssistantModal.js
// ONE unified Servon microphone/action system.
// The same mic understands whether staff are talking about an ORDER or a ROOM
// operation, resolves against the authoritative backend, shows a confirmation,
// then carries out the action through the existing order / room pipelines.

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text as NativeText,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import LocalizedText, { localizeText } from "./LocalizedText";
import { Ionicons } from "@expo/vector-icons";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";
import { useNavigation } from "@react-navigation/native";
import { localizedItemName } from "../utils/localizedItemName";
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
const CATEGORY_CODE_OPTIONS = [
  { code: 1, label: "Beverages / Water" },
  { code: 2, label: "Snacks" },
  { code: 3, label: "Breads / Roti" },
  { code: 4, label: "Cigarettes" },
  { code: 5, label: "Cold Drinks / Energy Drinks" },
  { code: 6, label: "Veg Food" },
  { code: 7, label: "Non Veg Food" },
  { code: 8, label: "Liquor" },
];
const LIQUOR_BRAND_OPTIONS = [
  [10, "Tuborg Strong"], [11, "Tuborg"], [12, "Tuborg Classic"], [13, "Kingfisher"], [14, "Kingfisher Ultra"], [15, "Carlsberg Beer"], [16, "Heineken Beer"], [17, "Budweiser"], [18, "Godfather Beer"], [19, "London Beer"], [20, "Breezer"],
  [21, "Royal Stag"], [22, "Royal Stag Double"], [23, "Royal Green"], [24, "Signature"], [25, "Imperial Blue"], [26, "McDowell's Rum"], [27, "McDowell's"], [28, "McDowell's Platinum"], [29, "B7"], [30, "DSP Black"], [31, "Goa"], [32, "Grand Masters"], [33, "Iconiq White"], [34, "Royal Challenge"], [35, "Oaksmith Silver"], [36, "Oaksmith Gold"], [37, "Oaken"], [38, "Antiquity"], [39, "Green Label"], [40, "Officer's Choice"], [41, "Jameson"], [42, "Black Dog"], [43, "Teachers"], [44, "Black & White"], [45, "VAT 69"], [46, "Ballantine's"], [47, "Haywards 2000"], [48, "Haywards"], [49, "Masters Delight"], [50, "Classic Gold"], [51, "Brown Man"], [52, "Premium Whisky"], [53, "Barrel Whisky"], [54, "X-Treme Whisky"], [55, "Empire"], [56, "Blenders Reserve"], [57, "After Dark"], [58, "Amber Whisky"], [59, "Vulcan Blue"], [60, "Alpha Bull"], [61, "Kalani White"],
  [62, "Bullet Rum"], [63, "Old Monk"], [64, "Dark Old Rum"], [65, "Gold Medal Rum"], [66, "Mad Rum"], [67, "Blak Bacardi"],
  [68, "Smirnoff"], [69, "Vodka"], [70, "Xclamation"], [71, "Xclamation Vodka"], [72, "Silver Kastle Vodka"], [73, "Gold Medal Vodka"], [74, "Shaky Vodka Jamun"], [75, "Smirnoff Jamun"],
  [76, "Bombay"], [77, "Bombay Quarter"], [78, "Lemon Duet Gin"], [79, "Knight Fox Gin"], [80, "Doctor Brandy"],
  [81, "Let's Go Cranberry"], [82, "Bacardi Limon"], [83, "Magic Moments"], [84, "Magik Moments"], [85, "Magic Moment"],
].map(([code, label]) => ({ code, label }));
const codeLabel = (code) => CATEGORY_CODE_OPTIONS.find((option) => option.code === Number(code))?.label || "";
const liquorBrandLabel = (code) => LIQUOR_BRAND_OPTIONS.find((option) => option.code === Number(code))?.label || "";

export default function ServonAssistantModal({ visible, onClose, initialMode = "manual" }) {
  const navigation = useNavigation();
  const { business } = useAuth();
  const { language } = useLocale();

  // Data loaded for MANUAL order mode (also the authoritative price source).
  const [menu, setMenu] = useState([]);
  const [tables, setTables] = useState([]);
  const [profile, setProfile] = useState(null);

  // Manual order state
  const [mode, setMode] = useState(initialMode);
  const [categoryCode, setCategoryCode] = useState("");
  const [liquorBrandCode, setLiquorBrandCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeTouched, setCodeTouched] = useState(false);
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
      const [tableRes, profileRes] = await Promise.all([getTables(), getProfile()]);
      setMenu([]);
      setTables(tableRes.data || []);
      setProfile(profileRes.data || null);
    } catch (err) {
      console.error("Assistant load data error:", err);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setMode(initialMode);
      setCategoryCode("");
      setLiquorBrandCode("");
      setCodeTouched(false);
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

  const menuLabel = (item) => localizedItemName(item, language);
  const loadCategoryCode = async (nextCode) => {
    const clean = String(nextCode || "").replace(/\D/g, "").slice(0, 1);
    setCategoryCode(clean);
    setLiquorBrandCode("");
    setCodeTouched(Boolean(clean));
    setMenu([]);
    if (!clean) return;
    if (!CATEGORY_CODE_OPTIONS.some((option) => String(option.code) === clean)) return;
    if (clean === "8") return;
    setCodeLoading(true);
    try {
      const res = await getMenu({ category_code: clean });
      setMenu(res.data || []);
    } catch (err) {
      console.error("Category code menu load error:", err);
      setMenu([]);
    } finally {
      setCodeLoading(false);
    }
  };
  const loadLiquorBrandCode = async (brandCode) => {
    const clean = String(brandCode || "").replace(/\D/g, "").slice(0, 2);
    setLiquorBrandCode(clean);
    setCodeTouched(Boolean(clean));
    setMenu([]);
    if (!liquorBrandLabel(clean)) return;
    setCodeLoading(true);
    try {
      const res = await getMenu({ liquor_brand_code: clean });
      setMenu(res.data || []);
    } catch (err) {
      console.error("Liquor brand menu load error:", err);
      setMenu([]);
    } finally {
      setCodeLoading(false);
    }
  };

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
        name_mr: i.name_mr || null,
        name_hi: i.name_hi || null,
        menu_type: i.menu_type || "food",
        liquor_code: i.liquor_code || null,
        liquor_brand_code: i.liquor_brand_code || null,
        size_ml: i.size_ml || null,
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
        orderSource: "staff",
        initialStatus: "CONFIRMED",
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

  const buildVoiceOrderLines = () => {
    const lines = (voiceIntent?.items || []).map((it) => ({
      menuItem: it.menuItem,
      requestedName: it.requestedName,
      quantity: it.quantity || 1,
    }));
    const resolvedNames = new Set(lines.map((line) => line.requestedName));

    (voiceIntent?.ambiguities || []).forEach((ambiguity) => {
      if (resolvedNames.has(ambiguity.requestedName)) return;
      const menuItem = resolvedAmbiguities[ambiguity.requestedName];
      if (menuItem) {
        lines.push({
          menuItem,
          requestedName: ambiguity.requestedName,
          quantity: ambiguity.quantity || 1,
        });
      }
    });

    return lines;
  };

  const voiceOrderLines = buildVoiceOrderLines();
  const voiceSubtotal = voiceOrderLines.reduce(
    (sum, line) => sum + (parseFloat(line.menuItem?.price) || 0) * (line.quantity || 1),
    0
  );
  const voiceCgstP = parseFloat(profile?.cgst_percentage || voiceIntent?.summary?.cgstPercent || 0);
  const voiceSgstP = parseFloat(profile?.sgst_percentage || voiceIntent?.summary?.sgstPercent || 0);
  const voiceCgst = (voiceSubtotal * voiceCgstP) / 100;
  const voiceSgst = (voiceSubtotal * voiceSgstP) / 100;
  const voiceGrand = voiceSubtotal + voiceCgst + voiceSgst;
  const resolvedVoiceNames = new Set((voiceIntent?.items || []).map((it) => it.requestedName));
  const voiceAmbiguities = (voiceIntent?.ambiguities || []).filter(
    (ambiguity) => !resolvedVoiceNames.has(ambiguity.requestedName)
  );
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
    if (voiceOrderLines.length === 0) { Alert.alert("Cannot Confirm", "No items were recognised. Please edit and try again."); return; }
    setPlacing(true);
    try {
      const items = voiceOrderLines.map((line) => ({
        id: line.menuItem.id,
        name: line.menuItem.name,
        price: line.menuItem.price,
        quantity: line.quantity || 1,
        name_mr: line.menuItem.name_mr || null,
        name_hi: line.menuItem.name_hi || null,
        menu_type: line.menuItem.menu_type || "food",
        liquor_code: line.menuItem.liquor_code || null,
        size_ml: line.menuItem.size_ml || null,
        imageUrl: line.menuItem.image_url,
        is_thali: line.menuItem.is_thali || false,
        thali_includes: line.menuItem.thali_includes || [],
        thali_custom: line.menuItem.thali_custom || "",
      }));
      await placeOrder({
        businessId: business?.id,
        tableId: voiceIntent.table.id,
        items,
        orderSource: "staff",
        initialStatus: "CONFIRMED",
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
      <LocalizedText translate style={styles.sectionLabel}>TABLE</LocalizedText>
      <View style={styles.tableWrap}>
        <Ionicons name="restaurant-outline" size={16} color={COLORS.subtext} style={{ marginRight: 6 }} />
        <View style={styles.picker}>
          {tables.length === 0 ? (
            <LocalizedText translate style={styles.pickerEmpty}>No tables yet. Manage tables in the Tables tab.</LocalizedText>
          ) : (
            tables.map((t) => {
              const active = selectedTable?.id === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.tableChip, active && styles.tableChipActive]}
                  onPress={() => setSelectedTable(t)}
                >
                  <LocalizedText style={[styles.tableChipText, active && styles.tableChipTextActive]}>
                    {t.table_number}
                  </LocalizedText>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </View>

      <LocalizedText translate style={styles.sectionLabel}>ADD ITEMS</LocalizedText>
      <View style={styles.codeButtons}>
        {CATEGORY_CODE_OPTIONS.map((option) => {
          const active = String(option.code) === String(categoryCode);
          return (
            <TouchableOpacity
              key={option.code}
              style={[styles.codeBtn, active && styles.codeBtnActive]}
              onPress={() => loadCategoryCode(option.code)}
            >
              <LocalizedText style={[styles.codeBtnText, active && styles.codeBtnTextActive]}>{option.code}</LocalizedText>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.searchBox}>
        <Ionicons name="keypad-outline" size={16} color={COLORS.muted} />
        <TextInput
          style={styles.searchInput}
          value={categoryCode}
          onChangeText={loadCategoryCode}
          placeholder={localizeText("Enter category code...", language)}
          placeholderTextColor={COLORS.muted}
          keyboardType="number-pad"
          returnKeyType="done"
        />
      </View>

      {!categoryCode && (
        <LocalizedText translate style={styles.hint}>Enter a category code to view items.</LocalizedText>
      )}
      {!!categoryCode && categoryCode !== "8" && codeLabel(categoryCode) && (
        <LocalizedText translate style={styles.codeHeading}>{codeLabel(categoryCode)}</LocalizedText>
      )}
      {categoryCode === "8" && !liquorBrandCode && (
        <>
          <LocalizedText translate style={styles.codeHeading}>Liquor Brands</LocalizedText>
          <View style={styles.brandGrid}>
            {LIQUOR_BRAND_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.code}
                style={styles.brandBtn}
                onPress={() => loadLiquorBrandCode(option.code)}
              >
                <LocalizedText style={styles.brandCode}>{option.code}</LocalizedText>
                <LocalizedText style={styles.brandLabel} numberOfLines={2}>{option.label}</LocalizedText>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
      {categoryCode === "8" && !!liquorBrandCode && (
        <View style={styles.brandHeaderRow}>
          <TouchableOpacity style={styles.backBrandBtn} onPress={() => { setLiquorBrandCode(""); setMenu([]); }}>
            <Ionicons name="arrow-back" size={14} color={COLORS.text} />
            <LocalizedText translate style={styles.backBrandText}>Liquor Brands</LocalizedText>
          </TouchableOpacity>
          <LocalizedText style={styles.codeHeading}>{`${liquorBrandCode} - ${liquorBrandLabel(liquorBrandCode)}`}</LocalizedText>
        </View>
      )}
      {codeLoading && <ActivityIndicator color={COLORS.text} style={{ marginVertical: 12 }} />}

      {!codeLoading && (categoryCode !== "8" || liquorBrandCode) && menu.map((item) => (
        <View key={item.id} style={styles.menuRow}>
          <View style={{ flex: 1 }}>
            <LocalizedText style={styles.menuName}>{menuLabel(item)}</LocalizedText>
            <LocalizedText style={styles.menuPrice}>
              {item.menu_type === "liquor"
                ? `${item.size_ml ? `${Number(item.size_ml)} ML · ` : ""}${localizeText("Brand Code", language)} ${item.liquor_brand_code}`
                : item.category ? `${item.category} · ${localizeText("Code", language)} ${item.category_code}` : `${localizeText("Code", language)} ${item.category_code}`}
            </LocalizedText>
            <LocalizedText style={styles.menuPrice}>{money(item.price)}</LocalizedText>
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
      {!codeLoading && codeTouched && categoryCode !== "8" && menu.length === 0 && (
        <LocalizedText translate style={styles.emptyText}>Category code not found</LocalizedText>
      )}
      {!codeLoading && categoryCode === "8" && liquorBrandCode && menu.length === 0 && (
        <LocalizedText translate style={styles.emptyText}>Category code not found</LocalizedText>
      )}

      {selectedItems.length > 0 && (
        <>
          <LocalizedText translate style={styles.sectionLabel}>SELECTED ITEMS</LocalizedText>
          {selectedItems.map((i) => (
            <View key={i.id} style={styles.selRow}>
              <LocalizedText style={styles.selName}>{menuLabel(i)} × {i.quantity}</LocalizedText>
              <LocalizedText style={styles.selPrice}>{money(i.price * i.quantity)}</LocalizedText>
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
                <LocalizedText translate style={styles.primaryBtnText}>Create Order</LocalizedText>
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
      <LocalizedText style={styles.voiceTitle}>
        {listening ? "Listening…" : thinking ? "Understanding…" : "Speak your order or room details"}
      </LocalizedText>
      <LocalizedText style={styles.voiceSubtitle}>
        {listening
          ? "Tap stop when you're done"
          : thinking
          ? "Detecting order or room request"
          : "Example: “Table 4, two biryanis and one paneer bhaji”\nor “Room 204, three guests”"}
      </LocalizedText>

      <TouchableOpacity
        style={[styles.primaryBtn, styles.voiceBtn, listening && { backgroundColor: COLORS.red }, thinking && { opacity: 0.5 }]}
        onPress={listening ? stopRecording : startRecording}
        disabled={thinking}
      >
        <Ionicons name={listening ? "stop" : "mic"} size={18} color="#fff" />
        <LocalizedText style={styles.primaryBtnText}>{listening ? "Stop" : "Start Recording"}</LocalizedText>
      </TouchableOpacity>

      {!!vError && <LocalizedText style={styles.errorText}>{vError}</LocalizedText>}
    </View>
  );

  // ── Voice: Order confirmation body ────────────────────────────────────
  const orderConfirmBody = (
    <View>
      <View style={styles.heardBox}>
        <LocalizedText translate style={styles.heardLabel}>I HEARD</LocalizedText>
        <LocalizedText style={styles.heardText}>"{result?.transcript}"</LocalizedText>
      </View>

      <View style={styles.confirmCard}>
        <LocalizedText translate style={styles.confirmTitle}>Create Order</LocalizedText>
        <LocalizedText style={styles.tableLine}>
          <Ionicons name="restaurant-outline" size={14} color={COLORS.subtext} /> Table{" "}
          {voiceIntent?.table?.table_number || voiceIntent?.tableRaw || "—"}
        </LocalizedText>

        {voiceOrderLines.map((line, idx) => (
          <View key={`${line.menuItem.id}-${idx}`} style={styles.ciRow}>
            <LocalizedText style={styles.ciName}>{line.menuItem.name} × {line.quantity || 1}</LocalizedText>
            <LocalizedText style={styles.ciPrice}>{money((parseFloat(line.menuItem.price) || 0) * (line.quantity || 1))}</LocalizedText>
          </View>
        ))}

        {voiceAmbiguities.length > 0 && (
          <View style={styles.ambigBox}>
            <LocalizedText translate style={styles.ambigTitle}>Choose the correct item</LocalizedText>
            {voiceAmbiguities.map((a, ai) => (
              <View key={ai} style={{ marginBottom: 8 }}>
                <LocalizedText style={styles.ambigReq}>“{a.requestedName}”</LocalizedText>
                {a.options.length === 0 ? (
                  <LocalizedText translate style={styles.ambigNone}>No match on your menu.</LocalizedText>
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
                        <LocalizedText style={[styles.optionText, chosen && styles.optionTextActive]}>
                          {op.name} — {money(op.price)}
                        </LocalizedText>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            ))}
          </View>
        )}

        {voiceOrderLines.length > 0 && (
          <View style={styles.bill}>
            <BillRow label="Subtotal" value={money(voiceSubtotal)} />
            {voiceCgstP > 0 && (
              <BillRow label={`CGST (${voiceCgstP}%)`} value={money(voiceCgst)} />
            )}
            {voiceSgstP > 0 && (
              <BillRow label={`SGST (${voiceSgstP}%)`} value={money(voiceSgst)} />
            )}
            <View style={styles.billDivider} />
            <BillRow label="Grand Total" value={money(voiceGrand)} strong />
          </View>
        )}
      </View>

      {voiceIntent?.errors?.length > 0 && (
        <View style={styles.errorBox}>
          {voiceIntent.errors.map((e, i) => <LocalizedText key={i} style={styles.errorText}>{e}</LocalizedText>)}
        </View>
      )}

      <View style={styles.confirmActions}>
        <TouchableOpacity style={[styles.secondaryBtn]} onPress={() => { setResult(null); setVError(""); }}>
          <LocalizedText translate style={styles.secondaryText}>Edit</LocalizedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, placing && { opacity: 0.6 }]}
          onPress={confirmVoiceOrder}
          disabled={placing || voiceIntent?.errors?.length > 0}
        >
          {placing ? <ActivityIndicator color="#fff" /> : (
            <><Ionicons name="checkmark" size={18} color="#fff" /><LocalizedText translate style={styles.primaryBtnText}>Create Order</LocalizedText></>
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
        <LocalizedText translate style={styles.heardLabel}>I HEARD</LocalizedText>
        <LocalizedText style={styles.heardText}>"{result?.transcript}"</LocalizedText>
      </View>

      <View style={styles.confirmCard}>
        <LocalizedText style={styles.confirmTitle}>
          {voiceIntent?.action === "check_out" ? "Room Check-Out" : "Room Check-In"}
        </LocalizedText>
        <LocalizedText style={styles.tableLine}>
          <Ionicons name="bed-outline" size={14} color={COLORS.subtext} /> Room{" "}
          {voiceIntent?.room?.room_number || voiceIntent?.roomRaw || "—"}
        </LocalizedText>

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
          {voiceIntent.warnings.map((w, i) => <LocalizedText key={i} style={styles.warnText}>{w}</LocalizedText>)}
        </View>
      )}

      <View style={styles.confirmActions}>
        <TouchableOpacity style={[styles.secondaryBtn]} onPress={() => { setResult(null); setVError(""); }}>
          <LocalizedText translate style={styles.secondaryText}>Edit</LocalizedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, placing && { opacity: 0.6 }]}
          onPress={confirmVoiceRoom}
          disabled={placing || voiceIntent?.errors?.length > 0}
        >
          {placing ? <ActivityIndicator color="#fff" /> : (
            <><Ionicons name="checkmark" size={18} color="#fff" /><LocalizedText translate style={styles.primaryBtnText}>Save</LocalizedText></>
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
            <LocalizedText style={styles.title}>{mode === "voice" ? "Servon Assistant" : "Create Order"}</LocalizedText>
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
              <LocalizedText translate style={[styles.tabText, mode === "manual" && styles.tabTextActive]}>Manual</LocalizedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === "voice" && styles.tabActive]}
              onPress={() => switchMode("voice")}
            >
              <Ionicons name="mic-outline" size={16} color={mode === "voice" ? COLORS.text : COLORS.subtext} />
              <LocalizedText translate style={[styles.tabText, mode === "voice" && styles.tabTextActive]}>Voice</LocalizedText>
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
      <LocalizedText style={[styles.billLabel, strong && styles.billLabelStrong]}>{label}</LocalizedText>
      <LocalizedText style={[styles.billValue, strong && styles.billValueStrong]}>{value}</LocalizedText>
    </View>
  );
}

function GuestStatBox({ label, value }) {
  return (
    <View style={styles.guestStatBox}>
      <LocalizedText style={styles.guestStatBoxValue}>{value}</LocalizedText>
      <LocalizedText style={styles.guestStatBoxLabel}>{label}</LocalizedText>
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
  codeButtons: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  codeBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  codeBtnActive: { backgroundColor: COLORS.text, borderColor: COLORS.text },
  codeBtnText: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  codeBtnTextActive: { color: "#fff" },
  codeHeading: { fontSize: 13, fontWeight: "800", color: COLORS.text, marginBottom: 6, textTransform: "uppercase" },
  brandGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  brandBtn: { width: "31%", minWidth: 120, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: COLORS.bg, padding: 10 },
  brandCode: { fontSize: 16, fontWeight: "900", color: COLORS.text },
  brandLabel: { fontSize: 11, fontWeight: "700", color: COLORS.subtext, marginTop: 2 },
  brandHeaderRow: { marginBottom: 8 },
  backBrandBtn: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10, backgroundColor: COLORS.bg, marginBottom: 6 },
  backBrandText: { fontSize: 12, fontWeight: "800", color: COLORS.text },
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
