import { useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl,
  ActivityIndicator, Modal, TextInput, Image, ScrollView
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getMenu, addMenuItem, updateMenuItem, deleteMenuItem, toggleMenuItemAvailability } from "../api";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker"; // <-- NEW
import { Ionicons } from "@expo/vector-icons"; // <-- NEW

const CATEGORIES = ["Starters", "Main Course", "Breads", "Rice & Biryani", "Desserts", "Beverages", "Soups", "Salads", "Snacks", "Specials"];

// Your Cloudinary Details
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/da9ej0tre/image/upload";
const UPLOAD_PRESET = "servon_menu"; // The unsigned preset you created

export default function MenuScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  
  // Added image_url to state
  const [form, setForm] = useState({ name: "", description: "", price: "", category: "Starters", image_url: null });
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => { loadMenu(); }, []));

  const loadMenu = async () => {
    try {
      const res = await getMenu();
      setItems(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const openAdd = () => { 
    setEditItem(null); 
    setForm({ name: "", description: "", price: "", category: "Starters", image_url: null }); 
    setShowModal(true); 
  };

  const openEdit = (item) => { 
    setEditItem(item); 
    setForm({ 
      name: item.name, 
      description: item.description || "", 
      price: String(item.price), 
      category: item.category,
      image_url: item.image_url || null 
    }); 
    setShowModal(true); 
  };

  // Image Picker Logic
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3], // Wide aspect ratio looks best for food menus
      quality: 0.7, // Compress slightly for faster loads
    });

    if (!result.canceled) {
      setForm((prev) => ({ ...prev, image_url: result.assets[0].uri }));
    }
  };

  // Cloudinary Upload Logic
  const uploadImageToCloudinary = async (uri) => {
    const data = new FormData();
    data.append("file", { uri, type: "image/jpeg", name: "menu_item.jpg" });
    data.append("upload_preset", UPLOAD_PRESET);
    data.append("cloud_name", "da9ej0tre");

    try {
      const response = await fetch(CLOUDINARY_URL, { method: "POST", body: data });
      const json = await response.json();
      return json.secure_url; // The live Cloudinary URL
    } catch (error) {
      console.error("Cloudinary upload error:", error);
      throw new Error("Image upload failed");
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.price || !form.category) { 
      Alert.alert("Required", "Name, price, and category are required"); return; 
    }
    setSaving(true);
    try {
      let finalImageUrl = form.image_url;

      // If it's a local file URI (from image picker), upload it to Cloudinary first
      if (form.image_url && !form.image_url.startsWith("http")) {
        finalImageUrl = await uploadImageToCloudinary(form.image_url);
      }

      const data = { 
        name: form.name, 
        description: form.description, 
        price: parseFloat(form.price), 
        category: form.category,
        image_url: finalImageUrl 
      };

      if (editItem) {
        await updateMenuItem(editItem.id, data);
      } else {
        await addMenuItem(data);
      }
      setShowModal(false);
      await loadMenu();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Save failed");
    } finally { setSaving(false); }
  };

  const handleDelete = (id) => {
    Alert.alert("Delete Item", "Are you sure?", [
      { text: "Cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try { await deleteMenuItem(id); setItems((prev) => prev.filter((i) => i.id !== id)); }
          catch (err) { Alert.alert("Error", "Delete failed"); }
        }
      },
    ]);
  };

  const handleToggle = async (id) => {
    try {
      const res = await toggleMenuItemAvailability(id);
      setItems((prev) => prev.map((i) => i.id === id ? res.data : i));
    } catch (err) { Alert.alert("Error", "Toggle failed"); }
  };

  if (loading) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><ActivityIndicator size="large" color="#111" /></View>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      <View style={{ padding: 12, alignItems: "flex-end" }}>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>+ Add Item</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadMenu(); }} />}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={<Text style={{ textAlign: "center", marginTop: 40, color: "#888" }}>No menu items yet</Text>}
        renderItem={({ item }) => (
          <View style={styles.menuCard}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.menuImg} />
              ) : (
                <View style={[styles.menuImg, { backgroundColor: "#f0f0f0", alignItems: "center", justifyContent: "center" }]}>
                  <Text style={{ fontSize: 24 }}>🍽</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <TouchableOpacity onPress={() => handleToggle(item.id)} style={[styles.availBadge, { backgroundColor: item.is_available ? "#198754" : "#aaa" }]}>
                    <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>{item.is_available ? "Available" : "Hidden"}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.catTag}>{item.category}</Text>
                {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
                <Text style={styles.price}>₹{item.price}</Text>
              </View>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}><Text style={styles.editBtnText}>Edit</Text></TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}><Text style={styles.deleteBtnText}>Delete</Text></TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}><Text style={{ fontSize: 16, color: "#555" }}>Cancel</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>{editItem ? "Edit Item" : "Add Item"}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#111" /> : <Text style={{ fontSize: 16, fontWeight: "700", color: "#111" }}>Save</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            
            {/* NEW: IMAGE UPLOAD BOX */}
            <Text style={[styles.fieldLabel, { marginTop: 0 }]}>Item Image</Text>
            <TouchableOpacity style={styles.imagePickerBox} onPress={pickImage}>
              {form.image_url ? (
                <Image source={{ uri: form.image_url }} style={styles.previewImage} />
              ) : (
                <View style={{ alignItems: "center" }}>
                  <Ionicons name="camera-outline" size={32} color="#888" />
                  <Text style={{ color: "#888", marginTop: 8, fontWeight: "500" }}>Tap to upload photo</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Item Name *</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="e.g. Paneer Tikka" />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput style={[styles.input, { height: 80 }]} value={form.description} onChangeText={(v) => setForm((p) => ({ ...p, description: v }))} placeholder="Optional description" multiline />

            <Text style={styles.fieldLabel}>Price (₹) *</Text>
            <TextInput style={styles.input} value={form.price} onChangeText={(v) => setForm((p) => ({ ...p, price: v }))} placeholder="e.g. 250" keyboardType="decimal-pad" />

            <Text style={styles.fieldLabel}>Category *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catTab, form.category === cat && styles.catTabActive]}
                  onPress={() => setForm((p) => ({ ...p, category: cat }))}
                >
                  <Text style={[{ fontSize: 13 }, form.category === cat && { color: "#fff" }]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  addBtn: { backgroundColor: "#111", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  menuCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#ebebeb" },
  menuImg: { width: 72, height: 72, borderRadius: 10 },
  itemName: { fontSize: 15, fontWeight: "700", color: "#111", flex: 1, marginRight: 8 },
  catTag: { fontSize: 12, color: "#888", marginTop: 2 },
  desc: { fontSize: 13, color: "#555", marginTop: 4 },
  price: { fontSize: 16, fontWeight: "700", color: "#111", marginTop: 6 },
  availBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, alignSelf: "flex-start" },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  editBtn: { flex: 1, borderRadius: 8, borderWidth: 1.5, borderColor: "#111", padding: 10, alignItems: "center" },
  editBtnText: { fontWeight: "600", color: "#111" },
  deleteBtn: { flex: 1, borderRadius: 8, borderWidth: 1.5, borderColor: "#dc3545", padding: 10, alignItems: "center" },
  deleteBtnText: { fontWeight: "600", color: "#dc3545" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#ebebeb" },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1.5, borderColor: "#ddd", borderRadius: 10, padding: 12, fontSize: 15, color: "#111", backgroundColor: "#fafafa" },
  catTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: "#ddd", backgroundColor: "#fff", marginRight: 8 },
  catTabActive: { backgroundColor: "#111", borderColor: "#111" },
  
  // NEW: Image Picker Styles
  imagePickerBox: {
    height: 160,
    backgroundColor: "#fafafa",
    borderWidth: 2,
    borderColor: "#ddd",
    borderStyle: "dashed",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
});