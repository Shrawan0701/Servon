import { useState, useCallback } from "react";
import {
  View, Text as NativeText, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl,
  ActivityIndicator, Modal, TextInput, Image, ScrollView, Platform, Dimensions
} from "react-native";
import LocalizedText, { localizeText } from "../components/LocalizedText";
import { useLocale } from "../context/LocaleContext";
import { useFocusEffect } from "@react-navigation/native";
import { getMenu, addMenuItem, updateMenuItem, deleteMenuItem, toggleMenuItemAvailability } from "../api";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

const CATEGORIES = ["All", "Starters", "Main Course", "Breads", "Rice & Biryani", "Desserts", "Beverages", "Soups", "Salads", "Snacks", "Specials"];
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/da9ej0tre/image/upload";
const UPLOAD_PRESET = "servon_menu";
const isWeb = Platform.OS === "web";

const EMPTY_FORM = {
  name: "", description: "", price: "", category: "Starters",
  image_url: null, is_thali: false, thali_includes: [], thali_custom: []
};

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useLocale();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [numColumns, setNumColumns] = useState(isWeb ? 3 : 1);

  // ─── Delete confirmation state ───────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Responsive column logic for Web
  useFocusEffect(useCallback(() => {
    if (isWeb) {
      const updateLayout = () => {
        const width = Dimensions.get('window').width;
        if (width > 1200) setNumColumns(3);
        else if (width > 768) setNumColumns(2);
        else setNumColumns(1);
      };
      const subscription = Dimensions.addEventListener('change', updateLayout);
      updateLayout();
      return () => subscription.remove();
    }
  }, []));

  useFocusEffect(useCallback(() => { loadMenu(); }, []));

  const loadMenu = async () => {
  try {
    const res = await getMenu();

    // ✅ FIX: Normalize thali_includes + thali_custom
    const normalized = res.data.map(item => ({
      ...item,
    thali_includes: (() => {
  if (Array.isArray(item.thali_includes)) {
    return item.thali_includes.map(String);
  }

  if (typeof item.thali_includes === "string") {
    try {
      return JSON.parse(item.thali_includes).map(String);
    } catch {
      return [];
    }
  }

  return [];
})(),
      thali_custom: typeof item.thali_custom === "string"
        ? item.thali_custom
        : "",
    }));

   
    setItems(normalized);

  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};


  const filteredItems = selectedFilter === "All" 
    ? items 
    : items.filter(i => i.category === selectedFilter);

  const openAdd = () => {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setCustomInput("");
    setShowModal(true);
  };

 const openEdit = (item) => {
  setEditItem(item);
  setForm({
    name: item.name,
    description: item.description || "",
    price: String(item.price),
    category: item.category,
    image_url: item.image_url || null,
    is_thali: item.is_thali || false,
    thali_includes: (item.thali_includes || []).map(String),
    // CRITICAL FIX: Convert string from DB back to Array for the Modal chips
    thali_custom: typeof item.thali_custom === 'string' 
      ? item.thali_custom.split(",").map(s => s.trim()).filter(Boolean) 
      : [],
  });
  setCustomInput("");
  setShowModal(true);
};

  // --- Logic for Manual Extras ---
  const addCustomItem = () => {
    const parts = customInput.split(",").map(s => s.trim()).filter(Boolean);
    if (!parts.length) return;
    setForm(prev => ({ 
      ...prev, 
      thali_custom: [...new Set([...prev.thali_custom, ...parts])] 
    }));
    setCustomInput("");
  };

  const removeCustomItem = (index) => {
    setForm(prev => ({ 
      ...prev, 
      thali_custom: prev.thali_custom.filter((_, i) => i !== index) 
    }));
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled) {
      setForm((prev) => ({ ...prev, image_url: result.assets[0].uri }));
    }
  };

  const uploadImageToCloudinary = async (uri) => {
    const data = new FormData();
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      data.append("file", blob, "menu_item.jpg");
    } else {
      data.append("file", { uri, type: "image/jpeg", name: "menu_item.jpg" });
    }
    data.append("upload_preset", UPLOAD_PRESET);
    data.append("cloud_name", "da9ej0tre");

    try {
      const response = await fetch(CLOUDINARY_URL, { method: "POST", body: data });
      const json = await response.json();
      return json.secure_url; 
    } catch (error) {
      throw new Error("Image upload failed");
    }
  };

 const handleSave = async () => {

  const finalIncludes = [...form.thali_includes]; // 🔥 FORCE COPY

  console.log("FINAL FORM:", form);
  console.log("FINAL INCLUDES:", finalIncludes);

  if (!form.name || !form.price || !form.category) {
    Alert.alert(localizeText("Required", language), localizeText("Name, price, and category are required", language));
    return;
  }

  setSaving(true);

  try {
    let finalImageUrl = form.image_url;

    if (form.image_url && !form.image_url.startsWith("http")) {
      finalImageUrl = await uploadImageToCloudinary(form.image_url);
    }

    const data = {
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      category: form.category,
      image_url: finalImageUrl,
      is_thali: form.is_thali,

      // 🔥 CRITICAL FIX
      thali_includes: form.is_thali ? JSON.stringify(finalIncludes) : "[]",

      thali_custom: form.is_thali ? form.thali_custom.join(",") : "",
    };

    console.log("SENDING DATA:", data);

    if (editItem) await updateMenuItem(editItem.id, data);
    else await addMenuItem(data);

    setShowModal(false);
    await loadMenu();

  } catch (err) {
    Alert.alert(localizeText("Error", language), err.response?.data?.error || localizeText("Save failed", language));
  } finally {
    setSaving(false);
  }
};

  const handleDelete = (id) => {
    if (Platform.OS === 'web') {
      // Show custom modal instead of browser confirm
      setItemToDelete(id);
      setShowDeleteModal(true);
    } else {
      Alert.alert(localizeText("Delete Item", language), localizeText("Are you sure?", language), [
        { text: localizeText("Cancel", language) },
        { text: localizeText("Delete", language), style: "destructive", onPress: () => confirmDelete(id) }
      ]);
    }
  };

  const confirmDelete = async (id) => {
    setDeleting(true);
    try {
      await deleteMenuItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
      setShowDeleteModal(false);
      setItemToDelete(null);
    } catch {
      Alert.alert(localizeText("Error", language), localizeText("Delete failed", language));
    } finally {
      setDeleting(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      const res = await toggleMenuItemAvailability(id);
      setItems((prev) => prev.map((i) => i.id === id ? res.data : i));
    } catch (err) { Alert.alert(localizeText("Error", language), localizeText("Toggle failed", language)); }
  };

 const toggleThaliItem = (itemId) => {
  const id = String(itemId);

  setForm(prev => {
    const list = prev.thali_includes.map(String);

    if (list.includes(id)) {
      return {
        ...prev,
        thali_includes: list.filter(x => x !== id),
      };
    } else {
      return {
        ...prev,
        thali_includes: [...list, id],
      };
    }
  });
};

  if (loading) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" color="#111" />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FAF8F5" }}>
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity 
                key={cat} 
                onPress={() => setSelectedFilter(cat)}
                style={[styles.filterBtn, selectedFilter === cat && styles.filterBtnActive]}
              >
                <LocalizedText style={[styles.filterBtnText, selectedFilter === cat && { color: "#fff" }]}>{cat}</LocalizedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <LocalizedText translate style={{ color: "#fff", fontWeight: "700" }}>+ Add Item</LocalizedText>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        key={numColumns}
        numColumns={numColumns}
        data={filteredItems}
        keyExtractor={(i) => String(i.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadMenu(); }} />}
        contentContainerStyle={[
          styles.listContent,
          isWeb && { alignSelf: 'center', maxWidth: 1200, width: '100%' }
        ]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
                <Ionicons name="restaurant-outline" size={40} color="#111" />
            </View>
            <LocalizedText translate style={styles.emptyTitle}>Your menu is empty</LocalizedText>
            <LocalizedText translate style={styles.emptySub}>Add your first dish and let customers start ordering in minutes.</LocalizedText>
            <View style={styles.stepsRow}>
                <EmptyStep icon="camera-outline" label="Upload a photo" color="#F59E0B" />
                <EmptyStep icon="pricetag-outline" label="Set name & price" color="#10B981" />
                <EmptyStep icon="layers-outline" label="Pick a category" color="#3B82F6" />
                <EmptyStep icon="storefront-outline" label="Go live instantly" color="#EF4444" />
            </View>
            <TouchableOpacity style={styles.bigAddBtn} onPress={openAdd}>
                <Ionicons name="add-circle" size={24} color="#fff" />
                <LocalizedText translate style={styles.bigAddBtnText}>Add Your First Item</LocalizedText>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.menuCard, isWeb && { width: `${96/numColumns}%`, marginHorizontal: '1%' }]}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.menuImg} resizeMode="cover" />
              ) : (
                <View style={[styles.menuImg, { backgroundColor: "#f0f0f0", alignItems: "center", justifyContent: "center" }]}>
                  <LocalizedText style={{ fontSize: 24 }}>{item.is_thali ? "🍱" : "🍽"}</LocalizedText>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: 'flex-start' }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, flexWrap: 'wrap' }}>
                    <LocalizedText style={styles.itemName}>{item.name}</LocalizedText>
                    {item.is_thali && (
                      <View style={styles.thaliBadge}><LocalizedText translate style={styles.thaliBadgeText}>Thali</LocalizedText></View>
                    )}
                  </View>
                </View>
                <LocalizedText style={styles.catTag}>{item.category}</LocalizedText>

                {/* --- Availability Tick Buttons --- */}
                <View style={styles.availabilityRow}>
                  <TouchableOpacity
                    style={[styles.availabilityBtn, item.is_available && styles.availabilityBtnAvailableActive]}
                    onPress={() => { if (!item.is_available) handleToggle(item.id); }}
                  >
                    <Ionicons
                      name={item.is_available ? "checkmark-circle" : "checkmark-circle-outline"}
                      size={14}
                      color={item.is_available ? "#fff" : "#10B981"}
                    />
                    <LocalizedText translate style={[styles.availabilityBtnText, item.is_available && { color: "#fff" }]}>Available</LocalizedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.availabilityBtn, !item.is_available && styles.availabilityBtnUnavailableActive]}
                    onPress={() => { if (item.is_available) handleToggle(item.id); }}
                  >
                    <Ionicons
                      name={!item.is_available ? "close-circle" : "close-circle-outline"}
                      size={14}
                      color={!item.is_available ? "#fff" : "#EF4444"}
                    />
                    <LocalizedText translate style={[styles.availabilityBtnText, !item.is_available && { color: "#fff" }]}>Not Available</LocalizedText>
                  </TouchableOpacity>
                </View>
                
                {/* --- Display Thali Items on Card --- */}
{item.is_thali && (
  <View style={styles.thaliIncludes}>

    {/* INCLUDED ITEMS */}
    {(Array.isArray(item.thali_includes) ? item.thali_includes : []).map((id, idx) => {
const found = items.find(i => String(i.id) === String(id));
  console.log("MATCHING:", id, "=>", found); // 🔥 DEBUG

  return (
    <View key={`inc-${idx}`} style={styles.thaliChip}>
      <LocalizedText style={styles.thaliChipText}>
        {found ? found.name : `❌ Missing ${id}`}
      </LocalizedText>
    </View>
  );
})}

    {/* CUSTOM ITEMS */}
    {(item.thali_custom || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name, idx) => (
        <View key={`custom-${idx}`} style={styles.thaliChip}>
          <LocalizedText style={styles.thaliChipText}>{name}</LocalizedText>
        </View>
      ))}

  </View>
)}

          {item.description ? <LocalizedText style={styles.desc} numberOfLines={2}>{item.description}</LocalizedText> : null}
                <LocalizedText style={styles.price}>₹{item.price}</LocalizedText>
              </View>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}><LocalizedText translate style={styles.editBtnText}>Edit</LocalizedText></TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}><LocalizedText translate style={styles.deleteBtnText}>Delete</LocalizedText></TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}><LocalizedText translate style={{ fontSize: 16, color: "#78716C" }}>Cancel</LocalizedText></TouchableOpacity>
            <LocalizedText style={styles.modalTitle}>{editItem ? "Edit Item" : "Add Item"}</LocalizedText>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#111" /> : <LocalizedText translate style={{ fontSize: 16, fontWeight: "700", color: "#111" }}>Save</LocalizedText>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, maxWidth: isWeb ? 600 : '100%', alignSelf: 'center', width: '100%' }}>
            <TouchableOpacity style={[styles.thaliToggle, form.is_thali && styles.thaliToggleActive]} onPress={() => setForm((p) => ({ ...p, is_thali: !p.is_thali }))}>
              <LocalizedText translate style={{ fontSize: 20 }}>🍱</LocalizedText>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <LocalizedText translate style={[styles.thaliToggleTitle, form.is_thali && { color: "#fff" }]}>This is a Thali / Combo</LocalizedText>
                <LocalizedText translate style={[styles.thaliToggleSub, form.is_thali && { color: "#ddd" }]}>Bundle multiple items under one price</LocalizedText>
              </View>
              <Ionicons name={form.is_thali ? "checkmark-circle" : "ellipse-outline"} size={22} color={form.is_thali ? "#fff" : "#bbb"} />
            </TouchableOpacity>

            {form.is_thali && (
              <View style={styles.thaliBuilder}>
                <LocalizedText translate style={styles.fieldLabel}>Included Items</LocalizedText>
                <TouchableOpacity style={styles.pickItemsBtn} onPress={() => setShowItemPicker(true)}>
                  <Ionicons name="list-outline" size={18} color="#111" />
                  <LocalizedText style={styles.pickItemsBtnText}>{form.thali_includes.length > 0 ? `${form.thali_includes.length} selected` : "Pick from menu"}</LocalizedText>
                </TouchableOpacity>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {items.filter((i) => form.thali_includes.map(String).includes(String(i.id))).map((i) => (
                    <TouchableOpacity key={i.id} style={styles.selectedChip} onPress={() => toggleThaliItem(i.id)}>
                      <LocalizedText style={styles.selectedChipText}>{i.name}</LocalizedText>
                      <Ionicons name="close" size={12} color="#111" />
                    </TouchableOpacity>
                  ))}
                </View>

                <LocalizedText translate style={[styles.fieldLabel, { marginTop: 12 }]}>Add Extra (Manual)</LocalizedText>
                <View style={styles.customInputRow}>
                  <TextInput 
                    style={styles.customInput} 
                    value={customInput} 
                    onChangeText={setCustomInput} 
                    placeholder={localizeText("e.g. Roasted Papad", language)} 
                    placeholderTextColor="#A8A29E"
                    onSubmitEditing={addCustomItem} 
                    returnKeyType="done" 
                  />
                  <TouchableOpacity style={styles.addExtraBtn} onPress={addCustomItem}>
                    <Ionicons name="add" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {form.thali_custom.map((name, index) => (
                    <TouchableOpacity key={index} style={[styles.selectedChip, { backgroundColor: '#10B98120', borderColor: '#10B981' }]} onPress={() => removeCustomItem(index)}>
                      <LocalizedText style={[styles.selectedChipText, { color: '#059669' }]}>{name}</LocalizedText>
                      <Ionicons name="close" size={12} color="#059669" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <LocalizedText translate style={styles.fieldLabel}>Item Image</LocalizedText>
            <TouchableOpacity style={styles.imagePickerBox} onPress={pickImage}>
              {form.image_url ? <Image source={{ uri: form.image_url }} style={styles.previewImage} resizeMode="cover" /> : <View style={{ alignItems: "center" }}><Ionicons name="camera-outline" size={32} color="#888" /><LocalizedText translate style={{ color: "#888" }}>Tap to upload</LocalizedText></View>}
            </TouchableOpacity>
            <LocalizedText translate style={styles.fieldLabel}>Item Name *</LocalizedText>
            <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="Name" />
            <LocalizedText translate style={styles.fieldLabel}>Price (₹) *</LocalizedText>
            <TextInput style={styles.input} value={form.price} onChangeText={(v) => setForm((p) => ({ ...p, price: v }))} keyboardType="decimal-pad" placeholder="0.00" />
            <LocalizedText translate style={styles.fieldLabel}>Category *</LocalizedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {CATEGORIES.filter(c => c !== "All").map((cat) => (
                <TouchableOpacity key={cat} style={[styles.catTab, form.category === cat && styles.catTabActive]} onPress={() => setForm((p) => ({ ...p, category: cat }))}>
                  <LocalizedText style={[{ fontSize: 13 }, form.category === cat && { color: "#fff" }]}>{cat}</LocalizedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showItemPicker} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
            <View style={styles.pickerContent}>
                <View style={styles.modalHeader}>
                    <LocalizedText translate style={styles.modalTitle}>Pick Thali Items</LocalizedText>
                    <TouchableOpacity onPress={() => setShowItemPicker(false)}><LocalizedText translate style={{fontWeight:'700'}}>Done</LocalizedText></TouchableOpacity>
                </View>
                <FlatList
                    data={items.filter(i => !i.is_thali)}
                    keyExtractor={i => String(i.id)}
                    renderItem={({ item }) => {
                      const active = form.thali_includes.map(String).includes(String(item.id));
                        return (
                            <TouchableOpacity style={[styles.pickerRow, active && styles.pickerRowActive]} onPress={() => toggleThaliItem(item.id)}>
                                <LocalizedText style={[styles.pickerRowText, active && {color: '#fff'}]}>{item.name}</LocalizedText>
                                <Ionicons name={active ? "checkmark-circle" : "ellipse-outline"} size={20} color={active ? "#fff" : "#ccc"} />
                            </TouchableOpacity>
                        );
                    }}
                />
            </View>
        </View>
      </Modal>

      {/* ─── DELETE CONFIRM MODAL (web only) ─── */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalBox}>
            <View style={styles.deleteIconCircle}>
              <Ionicons name="trash-outline" size={28} color="#EF4444" />
            </View>
            <LocalizedText translate style={styles.deleteTitle}>Delete Item?</LocalizedText>
            <LocalizedText translate style={styles.deleteSub}>
              This will permanently remove this menu item. This action cannot be undone.
            </LocalizedText>
            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowDeleteModal(false); setItemToDelete(null); }}
              >
                <LocalizedText translate style={styles.cancelBtnText}>Cancel</LocalizedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={() => confirmDelete(itemToDelete)}
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

function EmptyStep({ icon, label, color }) {
    return (
        <View style={styles.stepItem}>
            <View style={[styles.stepIcon, {backgroundColor: color + '15'}]}>
                <Ionicons name={icon} size={20} color={color} />
            </View>
            <LocalizedText style={styles.stepLabel}>{label}</LocalizedText>
        </View>
    );
}

const styles = StyleSheet.create({
  header: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E8E2D9", paddingVertical: 12 },
  headerInner: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, maxWidth: 1200, alignSelf: 'center', width: '100%' },
  filterScroll: { flex: 1, marginRight: 10 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#F3F4F6", marginRight: 8, borderWidth: 1, borderColor: "#E8E2D9" },
  filterBtnActive: { backgroundColor: "#111827", borderColor: "#111827" },
  filterBtnText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  addBtn: { backgroundColor: "#111827", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  
  listContent: { padding: 12, flexGrow: 1 },
  menuCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#E8E2D9" },
  menuImg: { width: 80, height: 80, borderRadius: 12, overflow: 'hidden' },
  itemName: { fontSize: 16, fontWeight: "800", color: "#111827" },
  catTag: { fontSize: 11, color: "#10B981", fontWeight: "700", textTransform: 'uppercase', marginTop: 4, letterSpacing: 0.5 },
  desc: { fontSize: 13, color: "#78716C", marginTop: 6, lineHeight: 18 },
  price: { fontSize: 18, fontWeight: "800", color: "#111827", marginTop: 8 },
  availBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },

  // ─── Availability tick buttons ───────────────────────────────────────────
  availabilityRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  availabilityBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.2,
    borderColor: "#E8E2D9",
    backgroundColor: "#fff",
  },
  availabilityBtnAvailableActive: { backgroundColor: "#10B981", borderColor: "#10B981" },
  availabilityBtnUnavailableActive: { backgroundColor: "#EF4444", borderColor: "#EF4444" },
  availabilityBtnText: { fontSize: 11, fontWeight: "700", color: "#374151" },

  cardActions: { flexDirection: "row", gap: 10, marginTop: 16, borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 16 },
  editBtn: { flex: 1, borderRadius: 10, borderWidth: 1.5, borderColor: "#111827", padding: 12, alignItems: "center" },
  editBtnText: { fontWeight: "700", color: "#111827", fontSize: 14 },
  deleteBtn: { flex: 1, borderRadius: 10, borderWidth: 1.5, borderColor: "#EF4444", padding: 12, alignItems: "center" },
  deleteBtnText: { fontWeight: "700", color: "#EF4444", fontSize: 14 },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, paddingTop: 40, alignSelf: 'center', maxWidth: 600 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#F3F4F6", alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 24, fontWeight: '900', color: '#111827' },
  emptySub: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginTop: 10, lineHeight: 22 },
  stepsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20, marginTop: 40 },
  stepItem: { alignItems: 'center', width: 110 },
  stepIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  stepLabel: { fontSize: 12, fontWeight: '700', color: '#4B5563', textAlign: 'center' },
  bigAddBtn: { backgroundColor: '#111827', flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 18, paddingHorizontal: 40, borderRadius: 100, marginTop: 50, width: '100%', justifyContent: 'center' },
  bigAddBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#E8E2D9" },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  fieldLabel: { fontSize: 13, fontWeight: "800", color: "#10B981", marginBottom: 8, marginTop: 20, letterSpacing: 1 },
  input: { borderWidth: 1.5, borderColor: "#E8E2D9", borderRadius: 12, padding: 14, fontSize: 15, color: "#111", backgroundColor: "#F9FAFB" },
  catTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: "#E8E2D9", backgroundColor: "#fff", marginRight: 8, marginBottom: 10 },
  catTabActive: { backgroundColor: "#111827", borderColor: "#111827" },
  imagePickerBox: { height: 180, backgroundColor: "#F9FAFB", borderWidth: 2, borderColor: "#E8E2D9", borderStyle: "dashed", borderRadius: 16, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  previewImage: { width: "100%", height: "100%" },
  thaliToggle: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#E8E2D9", borderRadius: 16, padding: 16, backgroundColor: "#F9FAFB" },
  thaliToggleActive: { backgroundColor: "#111827", borderColor: "#111827" },
  thaliToggleTitle: { fontSize: 16, fontWeight: "800", color: "#111" },
  thaliToggleSub: { fontSize: 13, color: "#78716C", marginTop: 2 },
  thaliBuilder: { marginTop: 16, padding: 16, backgroundColor: "#F3F4F6", borderRadius: 16, borderWidth: 1, borderColor: "#E8E2D9" },
  pickItemsBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderColor: "#E8E2D9", borderRadius: 12, padding: 14, backgroundColor: "#fff" },
  pickItemsBtnText: { fontSize: 14, fontWeight: "700", color: "#111", flex: 1 },
  selectedChip: { flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, gap: 6, borderWidth: 1, borderColor: '#E8E2D9' },
  selectedChipText: { fontSize: 12, fontWeight: "700", color: "#111" },
  thaliBadge: { backgroundColor: "#111827", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  thaliBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  thaliIncludes: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 6,
},

thaliChip: {
  backgroundColor: "#DCFCE7", // light green
  paddingVertical: 3,
  paddingHorizontal: 8,
  borderRadius: 12,
  alignSelf: "flex-start",
},

thaliChipText: {
  fontSize: 11,
  color: "#166534", // dark green text
  fontWeight: "500",
},
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(28, 25, 23, 0.5)', justifyContent: 'flex-end' },
  pickerContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%', alignSelf: 'center', width: '100%', maxWidth: 600 },
  pickerRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  pickerRowActive: { backgroundColor: '#111827' },
  pickerRowText: { fontSize: 16, fontWeight: '700' },
  customInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  customInput: { flex: 1, borderWidth: 1.5, borderColor: "#E8E2D9", borderRadius: 12, padding: 12, fontSize: 15, color: "#111", backgroundColor: "#fff" },
  addExtraBtn: { backgroundColor: "#111827", width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // ─── Delete modal styles ───────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: "rgba(28, 25, 23, 0.7)", justifyContent: "center", padding: 20 },
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