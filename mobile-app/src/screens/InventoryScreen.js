import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View, Text as NativeText, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  ActivityIndicator, Modal, TextInput, ScrollView, Platform, Alert,
} from "react-native";
import LocalizedText, { localizeText } from "../components/LocalizedText";
import { useLocale } from "../context/LocaleContext";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  getInventory, addInventoryItem, updateInventoryItem, restockInventoryItem,
  deleteInventoryItem, getMenuRecipes, getRecipeForItem, setRecipeForItem,
} from "../api";

const isWeb = Platform.OS === "web";

// ─── Web-only CSS (same pattern as DashboardScreen) ────────────────────
if (isWeb && typeof document !== "undefined") {
  let style = document.getElementById("servon-inventory-css");
  if (!style) {
    style = document.createElement("style");
    style.id = "servon-inventory-css";
    document.head.appendChild(style);
  }
  style.textContent = `
    .inv-stock-card {
      background: #fff; border: 1px solid #EAE6E0; border-radius: 14px;
      padding: 14px 16px; display: flex; flex-direction: column;
      transition: box-shadow 0.18s ease, transform 0.18s ease;
    }
    .inv-stock-card:hover { box-shadow: 0 6px 16px rgba(0,0,0,0.07); transform: translateY(-1px); }
    .inv-stock-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      gap: 12px; padding: 16px 24px 32px; max-width: 1200px; margin: 0 auto; width: 100%;
    }
    .inv-recipe-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 12px; padding: 16px 24px 32px; max-width: 1200px; margin: 0 auto; width: 100%;
    }
    .inv-recipe-card {
      background: #fff; border: 1px solid #EAE6E0; border-radius: 14px;
      padding: 13px 16px; cursor: pointer; display: flex; align-items: center; gap: 12px;
      transition: box-shadow 0.18s ease, transform 0.18s ease;
    }
    .inv-recipe-card:hover { box-shadow: 0 6px 16px rgba(0,0,0,0.07); transform: translateY(-1px); }
    .inv-btn-restock:hover { background: #0EA371 !important; }
    .inv-fab-web:hover { background: #1F2937 !important; }
  `;
}

const UNITS = [
  { key: "kg", label: "Kilograms", short: "kg" },
  { key: "gm", label: "Grams", short: "gm" },
  { key: "litre", label: "Litres", short: "L" },
  { key: "ml", label: "Millilitres", short: "ml" },
  { key: "pcs", label: "Pieces", short: "pcs" },
];
const EMPTY_ITEM_FORM = { name: "", unit: "kg", current_stock: "", low_stock_threshold: "" };

export default function InventoryScreen() {
  const navigation = useNavigation();
  const { language } = useLocale();
  const [activeTab, setActiveTab] = useState("stock"); // 'stock' | 'recipes'
  const [items, setItems] = useState([]);
  const [recipeMenu, setRecipeMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [numColumns, setNumColumns] = useState(isWeb ? 3 : 1);

  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
  const [savingItem, setSavingItem] = useState(false);

  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockTarget, setRestockTarget] = useState(null);
  const [restockAmount, setRestockAmount] = useState("");
  const [restocking, setRestocking] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [recipeMenuItem, setRecipeMenuItem] = useState(null);
  const [recipeSelections, setRecipeSelections] = useState({}); // { inventory_item_id: quantity_string }
  const [savingRecipe, setSavingRecipe] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (isWeb) {
        const updateLayout = () => {
          const width = window.innerWidth;
          setNumColumns(width > 1200 ? 3 : width > 768 ? 2 : 1);
        };
        updateLayout();
        window.addEventListener("resize", updateLayout);
        return () => window.removeEventListener("resize", updateLayout);
      }
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const [invRes, recipeRes] = await Promise.all([getInventory(), getMenuRecipes()]);
      setItems(invRes.data || []);
      setRecipeMenu(recipeRes.data || []);
    } catch (err) {
      console.error("Load inventory error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ─── STOCK ITEM CRUD ──────────────────────────────────────────────
  const openAddItem = () => {
    setEditingItem(null);
    setItemForm(EMPTY_ITEM_FORM);
    setShowItemModal(true);
  };

  const openEditItem = (item) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      unit: item.unit,
      current_stock: String(item.current_stock),
      low_stock_threshold: String(item.low_stock_threshold),
    });
    setShowItemModal(true);
  };

  const handleSaveItem = async () => {
    if (!itemForm.name.trim()) {
      Alert.alert(localizeText("Item name needed", language), localizeText("Please type a name for this item, like Tomato or Rice.", language));
      return;
    }
    setSavingItem(true);
    try {
      if (editingItem) {
        await updateInventoryItem(editingItem.id, {
          name: itemForm.name,
          unit: itemForm.unit,
          low_stock_threshold: parseFloat(itemForm.low_stock_threshold) || 0,
        });
      } else {
        await addInventoryItem({
          name: itemForm.name,
          unit: itemForm.unit,
          current_stock: parseFloat(itemForm.current_stock) || 0,
          low_stock_threshold: parseFloat(itemForm.low_stock_threshold) || 0,
        });
      }
      setShowItemModal(false);
      await loadData();
    } catch (err) {
      Alert.alert(localizeText("Could not save", language), err.response?.data?.error || localizeText("Something went wrong. Please try again.", language));
    } finally {
      setSavingItem(false);
    }
  };

  const openRestock = (item) => {
    setRestockTarget(item);
    setRestockAmount("");
    setShowRestockModal(true);
  };

  const handleRestock = async (presetAmount) => {
    const amount = presetAmount ?? parseFloat(restockAmount);
    if (!amount || amount <= 0) {
      Alert.alert(localizeText("Enter an amount", language), localizeText("Please enter how much stock you're adding.", language));
      return;
    }
    setRestocking(true);
    try {
      await restockInventoryItem(restockTarget.id, amount);
      setShowRestockModal(false);
      await loadData();
    } catch (err) {
      Alert.alert(localizeText("Could not restock", language), localizeText("Something went wrong. Please try again.", language));
    } finally {
      setRestocking(false);
    }
  };

  const openDelete = (item) => {
    setDeleteTarget(item);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteInventoryItem(deleteTarget.id);
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      setShowDeleteModal(false);
      setDeleteTarget(null);
    } catch (err) {
      Alert.alert(localizeText("Could not delete", language), localizeText("Something went wrong. Please try again.", language));
    } finally {
      setDeleting(false);
    }
  };

  // ─── RECIPE CRUD ──────────────────────────────────────────────────
  const openRecipeModal = async (menuItem) => {
    setRecipeMenuItem(menuItem);
    setShowRecipeModal(true);
    setRecipeSelections({});
    try {
      const res = await getRecipeForItem(menuItem.id);
      const selections = {};
      (res.data || []).forEach((row) => {
        selections[row.inventory_item_id] = String(row.quantity_required);
      });
      setRecipeSelections(selections);
    } catch (err) {
      console.error("Load recipe error:", err);
    }
  };

  const toggleIngredient = (inventoryItemId) => {
    setRecipeSelections((prev) => {
      const copy = { ...prev };
      if (copy[inventoryItemId] !== undefined) {
        delete copy[inventoryItemId];
      } else {
        copy[inventoryItemId] = "";
      }
      return copy;
    });
  };

  const setIngredientQty = (inventoryItemId, value) => {
    setRecipeSelections((prev) => ({ ...prev, [inventoryItemId]: value }));
  };

  const handleSaveRecipe = async () => {
    const ingredients = Object.entries(recipeSelections)
      .filter(([, qty]) => parseFloat(qty) > 0)
      .map(([inventory_item_id, qty]) => ({
        inventory_item_id: parseInt(inventory_item_id, 10),
        quantity_required: parseFloat(qty),
      }));

    setSavingRecipe(true);
    try {
      await setRecipeForItem(recipeMenuItem.id, ingredients);
      setShowRecipeModal(false);
      await loadData();
    } catch (err) {
      Alert.alert("Could not save", "Something went wrong. Please try again.");
    } finally {
      setSavingRecipe(false);
    }
  };

  const lowStockCount = useMemo(() => items.filter((i) => i.is_low).length, [items]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111" />
        <LocalizedText translate style={styles.loadingText}>Loading inventory...</LocalizedText>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FAF8F5" }}>
      {/* ─── HEADER ─── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <LocalizedText translate style={styles.headerTitle}>Inventory</LocalizedText>
            <LocalizedText style={styles.headerHint}>
              {lowStockCount > 0
                ? `${lowStockCount} item${lowStockCount > 1 ? "s" : ""} running low - restock soon`
                : "Track your stock and link it to your menu"}
            </LocalizedText>
          </View>
        </View>

        {/* Big, clear tab switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "stock" && styles.tabBtnActive]}
            onPress={() => setActiveTab("stock")}
            activeOpacity={0.8}
          >
            <Ionicons name="cube" size={16} color={activeTab === "stock" ? "#fff" : "#6B7280"} />
            <LocalizedText translate style={[styles.tabBtnText, activeTab === "stock" && styles.tabBtnTextActive]}>
              My Stock
            </LocalizedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "recipes" && styles.tabBtnActive]}
            onPress={() => setActiveTab("recipes")}
            activeOpacity={0.8}
          >
            <Ionicons name="link" size={16} color={activeTab === "recipes" ? "#fff" : "#6B7280"} />
            <LocalizedText translate style={[styles.tabBtnText, activeTab === "recipes" && styles.tabBtnTextActive]}>
              Link Menu Items
            </LocalizedText>
          </TouchableOpacity>
        </View>

        {activeTab === "stock" && (
          <TouchableOpacity style={styles.headerAddBtn} onPress={openAddItem} activeOpacity={0.85}>
            <Ionicons name="add-circle" size={18} color="#fff" />
            <LocalizedText translate style={styles.headerAddBtnText}>Add New Stock Item</LocalizedText>
          </TouchableOpacity>
        )}
      </View>

      {/* ─── STOCK TAB ─── */}
      {activeTab === "stock" ? (
        isWeb ? (
          <ScrollView
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
          >
            {items.length === 0 ? (
              <EmptyStockState onAdd={openAddItem} />
            ) : (
              <div className="inv-stock-grid">
                {items.map((item) => (
                  <StockCardWeb
                    key={item.id}
                    item={item}
                    onRestock={() => openRestock(item)}
                    onEdit={() => openEditItem(item)}
                    onDelete={() => openDelete(item)}
                  />
                ))}
              </div>
            )}
          </ScrollView>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => String(i.id)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<EmptyStockState onAdd={openAddItem} />}
            renderItem={({ item }) => (
              <StockCardNative
                item={item}
                onRestock={() => openRestock(item)}
                onEdit={() => openEditItem(item)}
                onDelete={() => openDelete(item)}
              />
            )}
          />
        )
      ) : isWeb ? (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
        >
          {recipeMenu.length === 0 ? (
            <EmptyRecipeState />
          ) : (
            <div className="inv-recipe-grid">
              {recipeMenu.map((item) => (
                <RecipeCardWeb key={item.id} item={item} onPress={() => openRecipeModal(item)} />
              ))}
            </div>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={recipeMenu}
          keyExtractor={(i) => String(i.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<EmptyRecipeState />}
          renderItem={({ item }) => (
            <RecipeCardNative item={item} onPress={() => openRecipeModal(item)} />
          )}
        />
      )}

      {/* ─── ADD/EDIT ITEM MODAL ─── */}
      <Modal visible={showItemModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.formModal}>
            <View style={styles.formModalHeader}>
              <LocalizedText style={styles.formModalTitle}>
                {editingItem ? "Edit Stock Item" : "Add New Stock Item"}
              </LocalizedText>
              <TouchableOpacity style={styles.closeIconBtn} onPress={() => setShowItemModal(false)}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <LocalizedText translate style={styles.fieldLabel}>What is this item called?</LocalizedText>
              <TextInput
                style={styles.input}
                value={itemForm.name}
                onChangeText={(v) => setItemForm((p) => ({ ...p, name: v }))}
                placeholder={localizeText("For example: Tomato, Potato, Cold Drink", language)}
                placeholderTextColor="#A8A29E"
              />

              <LocalizedText translate style={styles.fieldLabel}>How do you measure it?</LocalizedText>
              <View style={styles.unitRow}>
                {UNITS.map((u) => (
                  <TouchableOpacity
                    key={u.key}
                    style={[styles.unitChip, itemForm.unit === u.key && styles.unitChipActive]}
                    onPress={() => setItemForm((p) => ({ ...p, unit: u.key }))}
                    activeOpacity={0.8}
                  >
                    <LocalizedText style={[styles.unitChipText, itemForm.unit === u.key && styles.unitChipTextActive]}>
                      {u.label}
                    </LocalizedText>
                  </TouchableOpacity>
                ))}
              </View>

              {!editingItem && (
                <>
                  <LocalizedText translate style={styles.fieldLabel}>How much do you have right now?</LocalizedText>
                  <TextInput
                    style={styles.input}
                    value={itemForm.current_stock}
                    onChangeText={(v) => setItemForm((p) => ({ ...p, current_stock: v }))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#A8A29E"
                  />
                </>
              )}

              <LocalizedText translate style={styles.fieldLabel}>Warn me when stock falls below</LocalizedText>
              <LocalizedText translate style={styles.fieldSubLabel}>
                We'll show a low-stock alert once it drops under this number
              </LocalizedText>
              <TextInput
                style={styles.input}
                value={itemForm.low_stock_threshold}
                onChangeText={(v) => setItemForm((p) => ({ ...p, low_stock_threshold: v }))}
                keyboardType="decimal-pad"
                placeholder={localizeText("For example: 2", language)}
                placeholderTextColor="#A8A29E"
              />
            </ScrollView>
            <TouchableOpacity style={styles.formSaveBtn} onPress={handleSaveItem} disabled={savingItem} activeOpacity={0.85}>
              {savingItem ? <ActivityIndicator color="#fff" /> : <LocalizedText translate style={styles.formSaveBtnText}>Save Item</LocalizedText>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── RESTOCK MODAL ─── */}
      <Modal visible={showRestockModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.formModal}>
            <View style={styles.formModalHeader}>
              <LocalizedText translate style={styles.formModalTitle}>Add Stock</LocalizedText>
              <TouchableOpacity style={styles.closeIconBtn} onPress={() => setShowRestockModal(false)}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.restockItemBanner}>
              <View style={styles.restockItemIconWrap}>
                <Ionicons name="cube" size={20} color="#111827" />
              </View>
              <View>
                <LocalizedText style={styles.restockItemName}>{restockTarget?.name}</LocalizedText>
                <LocalizedText style={styles.restockItemCurrent}>
                  You currently have {restockTarget ? formatQty(restockTarget.current_stock) : 0} {restockTarget?.unit}
                </LocalizedText>
              </View>
            </View>

            <LocalizedText translate style={styles.fieldLabel}>How much are you adding?</LocalizedText>
            <View style={styles.restockInputWrap}>
              <TextInput
                style={styles.restockInput}
                value={restockAmount}
                onChangeText={setRestockAmount}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#A8A29E"
                autoFocus
              />
              <LocalizedText style={styles.restockInputUnit}>{restockTarget?.unit}</LocalizedText>
            </View>

            <LocalizedText translate style={styles.quickAddLabel}>Or tap a quick amount</LocalizedText>
            <View style={styles.presetRow}>
              {[1, 5, 10, 25].map((p) => (
                <TouchableOpacity key={p} style={styles.presetChip} onPress={() => handleRestock(p)} activeOpacity={0.8}>
                  <LocalizedText style={styles.presetChipText}>+{p} {restockTarget?.unit}</LocalizedText>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.formSaveBtn} onPress={() => handleRestock()} disabled={restocking} activeOpacity={0.85}>
              {restocking ? <ActivityIndicator color="#fff" /> : <LocalizedText translate style={styles.formSaveBtnText}>Add to Stock</LocalizedText>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── DELETE CONFIRM MODAL ─── */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalBox}>
            <View style={styles.deleteIconCircle}>
              <Ionicons name="trash-outline" size={28} color="#EF4444" />
            </View>
            <LocalizedText style={styles.deleteTitle}>Remove {deleteTarget?.name}?</LocalizedText>
            <LocalizedText translate style={styles.deleteSub}>
              This item and any menu links to it will be removed. This cannot be undone.
            </LocalizedText>
            <View style={styles.deleteActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDeleteModal(false)} activeOpacity={0.8}>
                <LocalizedText translate style={styles.cancelBtnText}>Cancel</LocalizedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteConfirmBtn} onPress={confirmDelete} disabled={deleting} activeOpacity={0.85}>
                {deleting ? <ActivityIndicator color="#fff" size="small" /> : <LocalizedText translate style={styles.deleteConfirmBtnText}>Yes, Remove</LocalizedText>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── RECIPE MODAL ─── */}
      <Modal visible={showRecipeModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <View style={styles.recipeModalHeaderBar}>
            <View style={{ flex: 1 }}>
              <LocalizedText style={styles.formModalTitle}>{recipeMenuItem?.name}</LocalizedText>
              <LocalizedText translate style={styles.recipeModalSub}>
                Tick each ingredient this dish uses, and how much per order
              </LocalizedText>
            </View>
            <TouchableOpacity style={styles.closeIconBtn} onPress={() => setShowRecipeModal(false)}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, maxWidth: isWeb ? 640 : "100%", alignSelf: "center", width: "100%" }}>
            {items.length === 0 ? (
              <View style={styles.recipeEmptyNotice}>
                <Ionicons name="information-circle-outline" size={22} color="#9CA3AF" />
                <LocalizedText translate style={styles.emptySub}>
                  You haven't added any stock items yet. Go to the "My Stock" tab, add items like
                  tomato or rice, then come back here to link them.
                </LocalizedText>
              </View>
            ) : (
              items.map((invItem) => {
                const isSelected = recipeSelections[invItem.id] !== undefined;
                return (
                  <TouchableOpacity
                    key={invItem.id}
                    style={[styles.ingredientRow, isSelected && styles.ingredientRowActive]}
                    onPress={() => toggleIngredient(invItem.id)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.ingredientToggle}>
                      <Ionicons
                        name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                        size={26}
                        color={isSelected ? "#10B981" : "#D1D5DB"}
                      />
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <LocalizedText style={styles.ingredientName}>{invItem.name}</LocalizedText>
                        <LocalizedText style={styles.ingredientStock}>
                          {formatQty(invItem.current_stock)} {invItem.unit} available now
                        </LocalizedText>
                      </View>
                    </View>
                    {isSelected && (
                      <View style={styles.ingredientQtyWrap} onStartShouldSetResponder={() => true}>
                        <LocalizedText translate style={styles.ingredientQtyLabel}>Used per order:</LocalizedText>
                        <TextInput
                          style={styles.ingredientQtyInput}
                          value={recipeSelections[invItem.id]}
                          onChangeText={(v) => setIngredientQty(invItem.id, v)}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor="#A8A29E"
                        />
                        <LocalizedText style={styles.ingredientQtyUnit}>{invItem.unit}</LocalizedText>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
          <View style={styles.recipeModalFooter}>
            <TouchableOpacity style={styles.formSaveBtn} onPress={handleSaveRecipe} disabled={savingRecipe} activeOpacity={0.85}>
              {savingRecipe ? <ActivityIndicator color="#fff" /> : <LocalizedText translate style={styles.formSaveBtnText}>Save This Recipe</LocalizedText>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── EMPTY STATES ───────────────────────────────────────────────────
function EmptyStockState({ onAdd }) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="cube-outline" size={40} color="#111" />
      </View>
      <LocalizedText translate style={styles.emptyTitle}>No stock items yet</LocalizedText>
      <LocalizedText translate style={styles.emptySub}>
        Add raw materials you use every day - like tomato, potato, rice, or cold drinks -
        and we'll keep track of how much you have left.
      </LocalizedText>
      <TouchableOpacity style={styles.bigAddBtn} onPress={onAdd} activeOpacity={0.85}>
        <Ionicons name="add-circle" size={22} color="#fff" />
        <LocalizedText translate style={styles.bigAddBtnText}>Add Your First Item</LocalizedText>
      </TouchableOpacity>
    </View>
  );
}

function EmptyRecipeState() {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="link-outline" size={40} color="#111" />
      </View>
      <LocalizedText translate style={styles.emptyTitle}>No menu items found</LocalizedText>
      <LocalizedText translate style={styles.emptySub}>
        Add items to your Menu tab first — like Vada Pav or Butter Chicken — then come back
        here to link each one to the stock it uses.
      </LocalizedText>
    </View>
  );
}

// ─── WEB CARDS ───────────────────────────────────────────────────────
function StockCardWeb({ item, onRestock, onEdit, onDelete }) {
  return (
    <div className="inv-stock-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{item.name}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 }}>
            {unitLabel(item.unit)}
          </div>
        </div>
        {item.is_low && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, background: "#FEF2F2", borderRadius: 8, padding: "3px 7px", flexShrink: 0 }}>
            <Ionicons name="alert-circle" size={11} color="#EF4444" />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#EF4444" }}>Low</span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginTop: 10 }}>
        <span style={{ fontSize: 24, fontWeight: 800, color: "#111827", lineHeight: 1 }}>{formatQty(item.current_stock)}</span>
        <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 700, marginBottom: 3 }}>{item.unit}</span>
      </div>
      <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
        Alert below {formatQty(item.low_stock_threshold)} {item.unit}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 12, paddingTop: 12, borderTop: "1px solid #F3F4F6" }}>
        <button
          className="inv-btn-restock"
          onClick={onRestock}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            background: "#10B981", border: "none", borderRadius: 10, padding: "9px 0",
            color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
          }}
        >
          <Ionicons name="add-circle-outline" size={14} color="#fff" />
          Add Stock
        </button>
        <button
          onClick={onEdit}
          style={{
            width: 36, height: 36, borderRadius: 10, background: "#F3F4F6",
            border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}
          title="Edit item"
        >
          <Ionicons name="create-outline" size={15} color="#374151" />
        </button>
        <button
          onClick={onDelete}
          style={{
            width: 36, height: 36, borderRadius: 10, background: "#FEF2F2",
            border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}
          title="Remove item"
        >
          <Ionicons name="trash-outline" size={15} color="#EF4444" />
        </button>
      </div>
    </div>
  );
}

function RecipeCardWeb({ item, onPress }) {
  const linked = item.ingredient_count > 0;
  return (
    <div className="inv-recipe-card" onClick={onPress}>
      <div
        style={{
          width: 38, height: 38, borderRadius: 11, flexShrink: 0,
          background: linked ? "#ECFDF5" : "#F3F4F6",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Ionicons name="restaurant-outline" size={17} color={linked ? "#10B981" : "#9CA3AF"} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{item.name}</div>
        <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginTop: 1 }}>{item.category}</div>
      </div>
      {linked ? (
        <div style={{ background: "#ECFDF5", borderRadius: 9, padding: "5px 9px", flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#10B981" }}>
            {item.ingredient_count} linked
          </span>
        </div>
      ) : (
        <div style={{ background: "#FFFBEB", borderRadius: 9, padding: "5px 9px", flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#B45309" }}>Set up now</span>
        </div>
      )}
      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
    </div>
  );
}

// ─── NATIVE CARDS ────────────────────────────────────────────────────
function StockCardNative({ item, onRestock, onEdit, onDelete }) {
  return (
    <View style={styles.stockCard}>
      <View style={styles.stockCardTop}>
        <View style={{ flex: 1 }}>
          <LocalizedText style={styles.stockName}>{item.name}</LocalizedText>
          <LocalizedText style={styles.stockUnitLabel}>{unitLabel(item.unit)}</LocalizedText>
        </View>
        {item.is_low && (
          <View style={styles.lowBadge}>
            <Ionicons name="alert-circle" size={12} color="#EF4444" />
            <LocalizedText translate style={styles.lowBadgeText}>Low Stock</LocalizedText>
          </View>
        )}
      </View>

      <View style={styles.stockValueRow}>
        <LocalizedText style={styles.stockValue}>{formatQty(item.current_stock)}</LocalizedText>
        <LocalizedText style={styles.stockValueUnit}>{item.unit}</LocalizedText>
      </View>
      <LocalizedText style={styles.thresholdText}>Alert when below {formatQty(item.low_stock_threshold)} {item.unit}</LocalizedText>

      <View style={styles.stockCardActions}>
        <TouchableOpacity style={styles.restockBtn} onPress={onRestock} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={16} color="#fff" />
          <LocalizedText translate style={styles.restockBtnText}>Add Stock</LocalizedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconActionBtn} onPress={onEdit} activeOpacity={0.8}>
          <Ionicons name="create-outline" size={16} color="#374151" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconActionBtnDanger} onPress={onDelete} activeOpacity={0.8}>
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function RecipeCardNative({ item, onPress }) {
  const linked = item.ingredient_count > 0;
  return (
    <TouchableOpacity style={styles.recipeCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.recipeIconWrap, { backgroundColor: linked ? "#ECFDF5" : "#F3F4F6" }]}>
        <Ionicons name="restaurant-outline" size={18} color={linked ? "#10B981" : "#9CA3AF"} />
      </View>
      <View style={{ flex: 1 }}>
        <LocalizedText style={styles.recipeName}>{item.name}</LocalizedText>
        <LocalizedText style={styles.recipeCategory}>{item.category}</LocalizedText>
      </View>
      {linked ? (
        <View style={styles.configuredBadge}>
          <LocalizedText style={styles.configuredBadgeText}>{item.ingredient_count} linked</LocalizedText>
        </View>
      ) : (
        <View style={styles.notConfiguredBadge}>
          <LocalizedText translate style={styles.notConfiguredBadgeText}>Set up now</LocalizedText>
        </View>
      )}
      <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

function unitLabel(unit) {
  return { kg: "Measured by weight", gm: "Measured by weight", litre: "Measured by volume", ml: "Measured by volume", pcs: "Measured by count" }[unit] || "";
}

function formatQty(value) {
  const num = parseFloat(value) || 0;
  return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, "");
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { fontSize: 14, color: "#9CA3AF", fontWeight: "600" },

  header: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E8E2D9", paddingBottom: 12 },
  headerTop: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 14, gap: 14, maxWidth: 1200, alignSelf: "center", width: "100%" },
  backBtn: { width: 38, height: 38, borderRadius: 11, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#111827" },
  headerHint: { fontSize: 12.5, color: "#6B7280", marginTop: 3, lineHeight: 17 },

  tabRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginTop: 14, maxWidth: 1200, alignSelf: "center", width: "100%" },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11, borderRadius: 12, backgroundColor: "#F3F4F6" },
  tabBtnActive: { backgroundColor: "#111827" },
  tabBtnText: { fontSize: 13, fontWeight: "700", color: "#6B7280" },
  tabBtnTextActive: { color: "#fff" },

  headerAddBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    backgroundColor: "#10B981", borderRadius: 12, paddingVertical: 12,
    marginHorizontal: 20, marginTop: 10, maxWidth: 1160, alignSelf: "center", width: "auto",
  },
  headerAddBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  listContent: { padding: 14, flexGrow: 1 },

  stockCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#E8E2D9" },
  stockCardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  stockName: { fontSize: 15, fontWeight: "800", color: "#111827" },
  stockUnitLabel: { fontSize: 10, color: "#9CA3AF", fontWeight: "700", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.3 },
  lowBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#FEF2F2", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  lowBadgeText: { fontSize: 10, fontWeight: "700", color: "#EF4444" },

  stockValueRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: 10 },
  stockValue: { fontSize: 24, fontWeight: "800", color: "#111827", lineHeight: 26 },
  stockValueUnit: { fontSize: 13, color: "#6B7280", fontWeight: "700", marginBottom: 3 },
  thresholdText: { fontSize: 11, color: "#9CA3AF", marginTop: 4 },

  stockCardActions: { flexDirection: "row", gap: 6, marginTop: 12, borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 12 },
  restockBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "#10B981", borderRadius: 10, paddingVertical: 10 },
  restockBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  iconActionBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  iconActionBtnDanger: { width: 38, height: 38, borderRadius: 10, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" },

  recipeCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 14, padding: 13, marginBottom: 9, borderWidth: 1, borderColor: "#E8E2D9" },
  recipeIconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  recipeName: { fontSize: 14, fontWeight: "700", color: "#111827" },
  recipeCategory: { fontSize: 11, color: "#9CA3AF", fontWeight: "600", marginTop: 2 },
  configuredBadge: { backgroundColor: "#ECFDF5", borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 },
  configuredBadgeText: { fontSize: 10, fontWeight: "700", color: "#10B981" },
  notConfiguredBadge: { backgroundColor: "#FFFBEB", borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 },
  notConfiguredBadgeText: { fontSize: 10, fontWeight: "700", color: "#B45309" },

  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, paddingTop: 60, alignSelf: "center", maxWidth: 480 },
  emptyIconCircle: { width: 78, height: 78, borderRadius: 39, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  emptyTitle: { fontSize: 21, fontWeight: "800", color: "#111827" },
  emptySub: { fontSize: 14, color: "#6B7280", textAlign: "center", marginTop: 10, lineHeight: 21 },
  bigAddBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#111827", borderRadius: 100, paddingVertical: 16, paddingHorizontal: 30, marginTop: 26 },
  bigAddBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  recipeEmptyNotice: { flexDirection: "row", gap: 10, backgroundColor: "#F9FAFB", borderRadius: 14, padding: 16, alignItems: "flex-start" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(28,25,23,0.6)", justifyContent: "center", padding: 20 },
  formModal: { backgroundColor: "#fff", borderRadius: 22, padding: 24, width: "100%", maxWidth: 440, alignSelf: "center", maxHeight: "88%" },
  formModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  formModalTitle: { fontSize: 19, fontWeight: "800", color: "#111827" },
  closeIconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  recipeModalSub: { fontSize: 12, color: "#9CA3AF", marginTop: 4, lineHeight: 17 },
  recipeModalHeaderBar: { flexDirection: "row", alignItems: "flex-start", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },

  fieldLabel: { fontSize: 13, fontWeight: "800", color: "#111827", marginBottom: 4, marginTop: 18 },
  fieldSubLabel: { fontSize: 12, color: "#9CA3AF", marginBottom: 8, lineHeight: 16 },
  input: { borderWidth: 1.5, borderColor: "#E8E2D9", borderRadius: 13, padding: 15, fontSize: 16, color: "#111", backgroundColor: "#F9FAFB", marginTop: 6 },

  unitRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  unitChip: { paddingHorizontal: 15, paddingVertical: 11, borderRadius: 11, borderWidth: 1.5, borderColor: "#E8E2D9", backgroundColor: "#fff" },
  unitChipActive: { backgroundColor: "#111827", borderColor: "#111827" },
  unitChipText: { fontSize: 13.5, fontWeight: "700", color: "#6B7280" },
  unitChipTextActive: { color: "#fff" },

  formSaveBtn: { backgroundColor: "#111827", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 22 },
  formSaveBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },

  restockItemBanner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F9FAFB", borderRadius: 14, padding: 14, marginBottom: 6 },
  restockItemIconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  restockItemName: { fontSize: 15, fontWeight: "800", color: "#111827" },
  restockItemCurrent: { fontSize: 12.5, color: "#6B7280", marginTop: 2 },

  restockInputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 13, paddingHorizontal: 16, marginTop: 6, backgroundColor: "#F9FAFB" },
  restockInput: { flex: 1, fontSize: 24, fontWeight: "800", paddingVertical: 15, color: "#111827" },
  restockInputUnit: { fontSize: 15, fontWeight: "700", color: "#9CA3AF" },
  quickAddLabel: { fontSize: 12.5, color: "#9CA3AF", fontWeight: "600", marginTop: 16, marginBottom: 8 },
  presetRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  presetChip: { flexGrow: 1, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12, backgroundColor: "#ECFDF5", alignItems: "center" },
  presetChipText: { fontSize: 13.5, fontWeight: "800", color: "#10B981" },

  deleteModalBox: { backgroundColor: "#fff", borderRadius: 22, padding: 28, width: "100%", maxWidth: 380, alignSelf: "center", alignItems: "center" },
  deleteIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  deleteTitle: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 8, textAlign: "center" },
  deleteSub: { fontSize: 13.5, color: "#78716C", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  deleteActions: { flexDirection: "row", gap: 10, width: "100%" },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: "#E8E2D9", borderRadius: 13, paddingVertical: 15, alignItems: "center" },
  cancelBtnText: { fontSize: 14.5, fontWeight: "700", color: "#374151" },
  deleteConfirmBtn: { flex: 1, backgroundColor: "#EF4444", borderRadius: 13, paddingVertical: 15, alignItems: "center" },
  deleteConfirmBtnText: { fontSize: 14.5, fontWeight: "700", color: "#fff" },

  ingredientRow: { borderWidth: 1.5, borderColor: "#E8E2D9", borderRadius: 16, padding: 16, marginBottom: 10, backgroundColor: "#fff" },
  ingredientRowActive: { borderColor: "#BBF7D0", backgroundColor: "#F3FDF6" },
  ingredientToggle: { flexDirection: "row", alignItems: "center" },
  ingredientName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  ingredientStock: { fontSize: 12.5, color: "#9CA3AF", marginTop: 2 },
  ingredientQtyWrap: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#E5F5EA" },
  ingredientQtyLabel: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  ingredientQtyInput: { flex: 1, borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 11, padding: 11, fontSize: 16, fontWeight: "700", color: "#111827", backgroundColor: "#fff" },
  ingredientQtyUnit: { fontSize: 13, color: "#6B7280", fontWeight: "700" },
  recipeModalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
});