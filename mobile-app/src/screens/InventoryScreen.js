import InventoryRecipeEditor from "../components/InventoryRecipeEditor";
import InventoryTools from "../components/InventoryTools";
import { StockMenuLinkEditor } from "../components/InventoryMenuLinks";
import { searchItems } from "../utils/itemSearch";
import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View, Text as NativeText, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  ActivityIndicator, Modal, TextInput, ScrollView, Platform, Alert,
  useWindowDimensions,
} from "react-native";
import LocalizedText, { localizeText, useLocalizeText } from "../components/LocalizedText";
import { useLocale } from "../context/LocaleContext";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  getInventory, addInventoryItem, updateInventoryItem, restockInventoryItem, reduceInventoryItem,
  deleteInventoryItem, getMenuRecipes,
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
    .inv-stock-card, .inv-recipe-card {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      box-sizing: border-box; background: #fff; border: 1px solid #DFE5DF;
      border-radius: 12px; color: #20332A;
    }
    .inv-stock-card { padding: 20px; display: flex; flex-direction: column; box-shadow: 0 2px 4px #20332A03; }
    .inv-stock-grid, .inv-recipe-grid {
      box-sizing: border-box; display: grid; gap: 16px; padding: 22px 24px 36px;
      max-width: 1400px; margin: 0 auto; width: 100%; align-items: start;
    }
    .inv-stock-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); }
    .inv-recipe-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); }
    .inv-stock-heading { display: flex; gap: 12px; align-items: center; }
    .inv-stock-symbol { width: 42px; height: 42px; border-radius: 10px; display: grid; place-items: center; background: #EDF3E8; flex-shrink: 0; }
    .inv-stock-name { font-size: 17px; font-weight: 600; line-height: 1.35; overflow-wrap: anywhere; }
    .inv-stock-measure { font-size: 12px; color: #627166; line-height: 1.4; margin-top: 3px; }
    .inv-stock-quantity { font-size: 27px; font-weight: 700; letter-spacing: -.6px; line-height: 1.3; margin-top: 22px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
    .inv-stock-threshold { font-size: 13px; line-height: 1.5; color: #627166; margin-top: 5px; margin-bottom: 14px; }
    .inv-recipe-card { padding: 17px; cursor: pointer; display: flex; align-items: center; gap: 12px; min-height: 88px; transition: border-color .15s, background .15s; }
    .inv-recipe-card:hover { border-color: #9FB697; background: #FBFDF8; }
    .inv-recipe-card:focus-visible { outline: 3px solid #8BAF84; outline-offset: 3px; }
    @media (max-width: 650px) {
      .inv-stock-grid, .inv-recipe-grid { padding: 16px 16px 28px; gap: 12px; }
      .inv-stock-card { padding: 18px; }
      .inv-stock-quantity { margin-top: 18px; font-size: 26px; }
    }
  `;
}

const UNITS = [
  { key: "kg", label: "Kilograms", short: "kg" },
  { key: "gm", label: "Grams", short: "gm" },
  { key: "litre", label: "Litres", short: "L" },
  { key: "ml", label: "Millilitres", short: "ml" },
  { key: "pcs", label: "Pieces", short: "pcs" },
];
const EMPTY_ITEM_FORM = {
  name: "",
  unit: "kg",
  current_stock: "",
  low_stock_threshold: "",
  bottle_count: "",
  bottle_size: "",
};
const isVolumeUnit = (unit) => unit === "ml" || unit === "litre";
const liquorLinkKey = (item) => `liquor-${item.liquor_brand_code || String(item.name || "").trim().toLowerCase()}`;

export default function InventoryScreen() {
  const tr = useLocalizeText();
  const navigation = useNavigation();
  const { language } = useLocale();
  const { width: screenWidth } = useWindowDimensions();
  const compactLayout = screenWidth < 900;
  const [toolsTab, setToolsTab] = useState(null);
  const [linkItem, setLinkItem] = useState(null);
  const openMenu = () => { setToolsTab(null); setLinkItem(null); navigation.navigate("Tabs", { screen: "Menu" }); };
  const [showMore, setShowMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState("stock"); // 'stock' | 'recipes'
  const [items, setItems] = useState([]);
  const [recipeMenu, setRecipeMenu] = useState([]);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [stockSearch, setStockSearch] = useState("");
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
  const [restockBottleCount, setRestockBottleCount] = useState("");
  const [restockBottleSize, setRestockBottleSize] = useState("");
  const [restocking, setRestocking] = useState(false);
  const [reducingStock, setReducingStock] = useState(false);
  const [stockChangeError, setStockChangeError] = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [recipeMenuItem, setRecipeMenuItem] = useState(null);

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
    setLoadError("");
    try {
      const [invRes, recipeRes] = await Promise.all([getInventory(), getMenuRecipes()]);
      setItems(invRes.data || []);
      setRecipeMenu(recipeRes.data || []);
    } catch (err) {
      setLoadError(err.response?.data?.error || "Inventory could not be loaded. Please retry.");
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
      bottle_count: "",
      bottle_size: item.bottle_size ? String(item.bottle_size) : "",
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
          bottle_size: isVolumeUnit(itemForm.unit) ? parseFloat(itemForm.bottle_size) || null : null,
        });
      } else {
        const bottleCount = parseFloat(itemForm.bottle_count) || 0;
        const bottleSize = parseFloat(itemForm.bottle_size) || 0;
        const computedStock = isVolumeUnit(itemForm.unit) && bottleCount > 0 && bottleSize > 0
          ? bottleCount * bottleSize
          : parseFloat(itemForm.current_stock) || 0;
        await addInventoryItem({
          name: itemForm.name,
          unit: itemForm.unit,
          current_stock: computedStock,
          low_stock_threshold: parseFloat(itemForm.low_stock_threshold) || 0,
          bottle_size: isVolumeUnit(itemForm.unit) && bottleSize > 0 ? bottleSize : null,
        });
      }
      setShowItemModal(false);
      await loadData();
    } catch (err) {
      Alert.alert(localizeText("Could not save", language), err.response?.data?.error || localizeText(err.response?.data?.error || "Something went wrong. Please try again.", language));
    } finally {
      setSavingItem(false);
    }
  };

  const openRestock = (item, reduce = false) => {
    setStockChangeError("");
    setReducingStock(reduce);
    setRestockTarget(item);
    setRestockAmount("");
    setRestockBottleCount("");
    setRestockBottleSize(item.bottle_size ? String(item.bottle_size) : "");
    setShowRestockModal(true);
  };

  const handleRestock = async (presetAmount) => {
    if (restocking) return;
    setStockChangeError("");
    const bottleCount = parseFloat(restockBottleCount) || 0;
    const bottleSize = parseFloat(restockBottleSize) || 0;
    const amount = presetAmount ?? (
      isVolumeUnit(restockTarget?.unit) && bottleCount > 0 && bottleSize > 0
        ? bottleCount * bottleSize
        : parseFloat(restockAmount)
    );
    if (!Number.isFinite(amount) || amount <= 0) {
      setStockChangeError(tr(reducingStock ? "Please enter how much stock you want to reduce." : "Please enter how much stock you're adding."));
      Alert.alert(localizeText("Enter an amount", language), localizeText(reducingStock ? "Please enter how much stock you want to reduce." : "Please enter how much stock you're adding.", language));
      return;
    }
    if (reducingStock && amount > Number(restockTarget.current_stock)) {
      setStockChangeError(tr("You cannot reduce more than the available stock."));
      Alert.alert(tr("Not enough stock"), tr("You cannot reduce more than the available stock."));
      return;
    }
    setRestocking(true);
    try {
      if (reducingStock) {
        await reduceInventoryItem(restockTarget.id, amount);
      } else {
        await restockInventoryItem(restockTarget.id, amount, {
          bottle_size: isVolumeUnit(restockTarget?.unit) && bottleSize > 0 ? bottleSize : undefined,
        });
      }
      setShowRestockModal(false);
      await loadData();
    } catch (err) {
      setStockChangeError(err.response?.data?.error || tr("Something went wrong. Please try again."));
      Alert.alert(localizeText(reducingStock ? "Could not reduce stock" : "Could not restock", language), err.response?.data?.error || localizeText("Something went wrong. Please try again.", language));
    } finally {
      setRestocking(false);
    }
  };

  const openDelete = (item) => {
    setDeleteError("");
    setDeleteTarget(item);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (deleting || !deleteTarget) return;
    setDeleteError("");
    setDeleting(true);
    try {
      await deleteInventoryItem(deleteTarget.id);
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      setShowDeleteModal(false);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setDeleteError(err.response?.data?.error || "Something went wrong. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  // ─── RECIPE CRUD ──────────────────────────────────────────────────
  const openRecipeModal = (menuItem) => { setRecipeMenuItem(menuItem); setShowRecipeModal(true); };

  const lowStockCount = useMemo(() => items.filter((i) => i.is_low).length, [items]);
  const recipeMenuForDisplay = useMemo(() => {
    const grouped = [];
    const liquorGroups = new Map();

    recipeMenu.forEach((item) => {
      if (item.menu_type === "liquor") {
        const key = liquorLinkKey(item);
        const existing = liquorGroups.get(key);
        if (existing) {
          existing.variants.push(item);
          existing.ingredient_count = Math.max(existing.ingredient_count || 0, item.ingredient_count || 0);
        } else {
          const group = {
            ...item,
            id: key,
            is_liquor_group: true,
            variants: [item],
          };
          liquorGroups.set(key, group);
          grouped.push(group);
        }
      } else {
        grouped.push(item);
      }
    });

    return grouped;
  }, [recipeMenu]);
  const filteredRecipeMenu = useMemo(() => {
    const query = recipeSearch.trim().toLowerCase();
    if (!query) return recipeMenuForDisplay;

    return searchItems(recipeMenuForDisplay, query, (item) => ({
      aliases: (item.variants || []).map((variant) => `${variant.name || ""} ${Number(variant.size_ml) > 0 ? `${variant.size_ml} ml` : ""}`),
      metadata: (item.variants || []).map((variant) => variant.category),
    }));
  }, [recipeMenuForDisplay, recipeSearch]);

  const filteredStock = useMemo(() => {
    const query = stockSearch.trim().toLocaleLowerCase();
    return searchItems(items, query);
  }, [items, stockSearch]);
  const renderStockSearch = () => (
    <View style={[styles.recipeSearchWrap, styles.stockSearchWrap]}>
      <Ionicons name="search" size={17} color="#9CA3AF" />
      <TextInput
        style={styles.recipeSearchInput}
        value={stockSearch}
        onChangeText={setStockSearch}
        placeholder={tr("Search stock items...")}
        accessibilityLabel={tr("Search stock items...")}
        placeholderTextColor="#A8A29E"
        returnKeyType="search"
        autoCorrect={false}
      />
      {!!stockSearch && <TouchableOpacity accessibilityRole="button" accessibilityLabel={tr("Clear search")} style={styles.recipeSearchClear} onPress={() => setStockSearch("")}>
        <Ionicons name="close" size={16} color="#6B7280" />
      </TouchableOpacity>}
    </View>
  );
  const stockEmptyState = items.length === 0 ? <EmptyStockState onAdd={openAddItem} /> : (
    <View style={styles.emptyContainer}><Ionicons name="search-outline" size={36} color="#627166" /><NativeText style={styles.emptyTitle}>{tr("No stock items found")}</NativeText></View>
  );

  const renderRecipeSearch = () => (
    <View style={styles.recipeSearchWrap}>
      <Ionicons name="search" size={18} color="#9CA3AF" />
      <TextInput
        style={styles.recipeSearchInput}
        value={recipeSearch}
        onChangeText={setRecipeSearch}
        placeholder={localizeText("Search menu items...", language)}
        placeholderTextColor="#A8A29E"
      />
      {recipeSearch ? (
        <TouchableOpacity style={styles.recipeSearchClear} onPress={() => setRecipeSearch("")} activeOpacity={0.75}>
          <Ionicons name="close" size={16} color="#6B7280" />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111" />
        <LocalizedText translate style={styles.loadingText}>Loading inventory...</LocalizedText>
      </View>
    );
  }

  const inventoryHeader = (
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <LocalizedText translate style={styles.headerTitle}>Inventory</LocalizedText>
            <NativeText style={styles.headerHint}>
              {lowStockCount > 0
                ? tr("{count} items running low - restock soon", { count: lowStockCount })
                : tr("Stock counts and dish ingredients, all in one place")}
            </NativeText>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={tr("More inventory options")} style={styles.moreButton} onPress={() => setShowMore(true)}><Ionicons name="ellipsis-horizontal" size={22} color="#334155" /><NativeText style={styles.moreLabel}>{tr("More")}</NativeText></TouchableOpacity>
        </View>

        <View style={[styles.workspaceToolbar, compactLayout && styles.workspaceToolbarCompact]}>
        <View style={[styles.tabRow, !compactLayout && styles.tabRowDesktop]}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "stock" && styles.tabBtnActive]}
            onPress={() => setActiveTab("stock")}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "stock" }}
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
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "recipes" }}
            activeOpacity={0.8}
          >
            <Ionicons name="link" size={16} color={activeTab === "recipes" ? "#fff" : "#6B7280"} />
            <LocalizedText translate style={[styles.tabBtnText, activeTab === "recipes" && styles.tabBtnTextActive]}>
              Dish ingredients
            </LocalizedText>
          </TouchableOpacity>
        </View>

        <View style={[styles.mainActions, !compactLayout && styles.mainActionsDesktop]}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={activeTab === "stock" ? tr("Scan stock") : tr("Set up several dishes")} style={styles.primaryAction} onPress={() => setToolsTab(activeTab === "stock" ? "scan" : "bulk")}>
            <Ionicons name={activeTab === "stock" ? "camera-outline" : "layers-outline"} size={21} color="#fff" />
            <NativeText style={styles.primaryActionText}>{activeTab === "stock" ? tr("Scan stock") : tr("Set up several dishes")}</NativeText>
          </TouchableOpacity>
          {activeTab === "stock" && <TouchableOpacity accessibilityRole="button" accessibilityLabel={tr("New item")} style={styles.secondaryAction} onPress={openAddItem}>
            <Ionicons name="add" size={21} color="#243A30" /><NativeText style={styles.secondaryActionText}>{tr("New item")}</NativeText>
          </TouchableOpacity>}
        </View>
        </View>
        <View style={styles.sectionIntro}>
          <NativeText style={styles.sectionTitle}>{activeTab === "stock" ? tr("Your stock: {count} items", { count: items.length }) : tr("Choose a dish to add its ingredients")}</NativeText>
          <NativeText style={styles.sectionHint}>{activeTab === "stock" ? tr("Scan bottles to check counts, or add stock when supplies arrive.") : tr("Set quantities once. Stock updates automatically with each order.")}</NativeText>
        </View>
        {!!loadError && <View style={{ padding: 12 }}><NativeText accessibilityRole="alert" style={{ color: "#B91C1C" }}>{tr(loadError)}</NativeText><TouchableOpacity accessibilityRole="button" onPress={loadData}><NativeText>{tr("Retry loading inventory")}</NativeText></TouchableOpacity></View>}
      </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F3F5F2" }}>
      {!isWeb && !compactLayout && inventoryHeader}

      {/* ─── STOCK TAB ─── */}
      {activeTab === "stock" ? (
        isWeb ? (
          <ScrollView
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
            keyboardShouldPersistTaps="handled"
          >
            {inventoryHeader}
            {renderStockSearch()}
            {filteredStock.length === 0 ? (
              stockEmptyState
            ) : (
              <div className="inv-stock-grid">
                {filteredStock.map((item) => (
                  <StockCardWeb
                    key={item.id}
                    item={item}
                    onRestock={() => openRestock(item)}
                    onReduce={() => openRestock(item, true)}
                    onLink={() => setLinkItem(item)}
                    onEdit={() => openEditItem(item)}
                    onDelete={() => openDelete(item)}
                  />
                ))}
              </div>
            )}
          </ScrollView>
        ) : (
          <FlatList
            data={filteredStock}
            keyExtractor={(i) => String(i.id)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={<View>{compactLayout && <View style={styles.mobileListHeader}>{inventoryHeader}</View>}{renderStockSearch()}</View>}
            ListEmptyComponent={stockEmptyState}
            renderItem={({ item }) => (
              <StockCardNative
                item={item}
                onRestock={() => openRestock(item)}
                onReduce={() => openRestock(item, true)}
                onLink={() => setLinkItem(item)}
                onEdit={() => openEditItem(item)}
                onDelete={() => openDelete(item)}
              />
            )}
          />
        )
      ) : isWeb ? (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
          keyboardShouldPersistTaps="handled"
        >
          {inventoryHeader}
          {renderRecipeSearch()}
          {recipeMenuForDisplay.length === 0 ? (
            <EmptyRecipeState />
          ) : filteredRecipeMenu.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="search-outline" size={40} color="#111" />
              </View>
              <LocalizedText translate style={styles.emptyTitle}>No menu items found</LocalizedText>
            </View>
          ) : (
            <div className="inv-recipe-grid">
              {filteredRecipeMenu.map((item) => (
                <RecipeCardWeb key={item.id} item={item} onPress={() => openRecipeModal(item)} />
              ))}
            </div>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={filteredRecipeMenu}
          keyExtractor={(i) => String(i.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={<View>{compactLayout && <View style={styles.mobileListHeader}>{inventoryHeader}</View>}{renderRecipeSearch()}</View>}
          ListEmptyComponent={recipeMenuForDisplay.length === 0 ? <EmptyRecipeState /> : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="search-outline" size={40} color="#111" />
              </View>
              <LocalizedText translate style={styles.emptyTitle}>No menu items found</LocalizedText>
            </View>
          )}
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
                    disabled={!!editingItem && itemForm.unit !== u.key}
                    style={[styles.unitChip, itemForm.unit === u.key && styles.unitChipActive]}
                    onPress={() => setItemForm((p) => ({
                      ...p,
                      unit: u.key,
                      bottle_count: isVolumeUnit(u.key) ? p.bottle_count : "",
                      bottle_size: isVolumeUnit(u.key) ? p.bottle_size : "",
                    }))}
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
                  {isVolumeUnit(itemForm.unit) && (
                    <>
                      <LocalizedText translate style={styles.fieldLabel}>How many bottles do you have?</LocalizedText>
                      <TextInput
                        style={styles.input}
                        value={itemForm.bottle_count}
                        onChangeText={(v) => setItemForm((p) => ({ ...p, bottle_count: v }))}
                        keyboardType="decimal-pad"
                        placeholder={localizeText("For example: 50", language)}
                        placeholderTextColor="#A8A29E"
                      />
                      <LocalizedText translate style={styles.fieldLabel}>How much is one bottle?</LocalizedText>
                      <View style={styles.restockInputWrap}>
                        <TextInput
                          style={styles.restockInput}
                          value={itemForm.bottle_size}
                          onChangeText={(v) => setItemForm((p) => ({ ...p, bottle_size: v }))}
                          keyboardType="decimal-pad"
                          placeholder={itemForm.unit === "ml" ? "180" : "0.18"}
                          placeholderTextColor="#A8A29E"
                        />
                        <LocalizedText style={styles.restockInputUnit}>{itemForm.unit}</LocalizedText>
                      </View>
                      <LocalizedText translate style={styles.fieldSubLabel}>
                        Leave bottle fields empty if you want to enter total stock directly.
                      </LocalizedText>
                    </>
                  )}
                  <LocalizedText translate style={styles.fieldLabel}>
                    {isVolumeUnit(itemForm.unit) ? "Total stock directly" : "How much do you have right now?"}
                  </LocalizedText>
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

              {editingItem && isVolumeUnit(itemForm.unit) && (
                <>
                  <LocalizedText translate style={styles.fieldLabel}>How much is one bottle?</LocalizedText>
                  <View style={styles.restockInputWrap}>
                    <TextInput
                      style={styles.restockInput}
                      value={itemForm.bottle_size}
                      onChangeText={(v) => setItemForm((p) => ({ ...p, bottle_size: v }))}
                      keyboardType="decimal-pad"
                      placeholder={itemForm.unit === "ml" ? "180" : "0.18"}
                      placeholderTextColor="#A8A29E"
                    />
                    <LocalizedText style={styles.restockInputUnit}>{itemForm.unit}</LocalizedText>
                  </View>
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
      <Modal visible={showRestockModal} transparent animationType="fade" onRequestClose={() => !restocking && setShowRestockModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.formModal}>
            <View style={styles.formModalHeader}>
              <LocalizedText translate style={styles.formModalTitle}>{reducingStock ? "Reduce Stock" : "Add Stock"}</LocalizedText>
              <TouchableOpacity style={styles.closeIconBtn} disabled={restocking} onPress={() => setShowRestockModal(false)}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.restockItemBanner}>
                <View style={styles.restockItemIconWrap}>
                  <Ionicons name="cube" size={20} color="#111827" />
                </View>
                <View>
                  <LocalizedText style={styles.restockItemName}>{restockTarget?.name}</LocalizedText>
                  <LocalizedText translate={false} style={styles.restockItemCurrent}>
                    {tr("You currently have {stock}", { stock: restockTarget ? formatStockDisplay(restockTarget, tr) : 0 })}
                  </LocalizedText>
                </View>
              </View>

              {isVolumeUnit(restockTarget?.unit) && (
                <>
                  <LocalizedText translate style={styles.fieldLabel}>{reducingStock ? "How many bottles do you want to reduce?" : "How many bottles are you adding?"}</LocalizedText>
                  <TextInput
                    style={styles.input}
                    value={restockBottleCount}
                    onChangeText={(value) => { setRestockBottleCount(value); setRestockAmount(""); }}
                    keyboardType="decimal-pad"
                    placeholder={localizeText("For example: 50", language)}
                    placeholderTextColor="#A8A29E"
                  />
                  <LocalizedText translate style={styles.fieldLabel}>How much is one bottle?</LocalizedText>
                  <View style={styles.restockInputWrap}>
                    <TextInput
                      style={styles.restockInput}
                      value={restockBottleSize}
                      onChangeText={setRestockBottleSize}
                      keyboardType="decimal-pad"
                      placeholder={restockTarget?.unit === "ml" ? "180" : "0.18"}
                      placeholderTextColor="#A8A29E"
                    />
                    <LocalizedText style={styles.restockInputUnit}>{restockTarget?.unit}</LocalizedText>
                  </View>
                  <LocalizedText translate style={styles.fieldSubLabel}>
                    Or enter a direct stock amount below.
                  </LocalizedText>
                </>
              )}

              <LocalizedText translate style={styles.fieldLabel}>{reducingStock ? "How much stock do you want to reduce?" : "How much are you adding?"}</LocalizedText>
              <View style={styles.restockInputWrap}>
                <TextInput
                  style={styles.restockInput}
                  value={restockAmount}
                  onChangeText={(value) => { setRestockAmount(value); setRestockBottleCount(""); }}
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
                  <TouchableOpacity key={p} style={styles.presetChip} disabled={restocking} onPress={() => { setRestockBottleCount(""); setRestockAmount(String(p)); }} activeOpacity={0.8}>
                    <LocalizedText style={styles.presetChipText}>{reducingStock ? "-" : "+"}{p} {restockTarget?.unit}</LocalizedText>
                  </TouchableOpacity>
                ))}
              </View>

              {!!stockChangeError && <NativeText accessibilityRole="alert" style={{ color: "#B91C1C", marginBottom: 12 }}>{stockChangeError}</NativeText>}
              <TouchableOpacity style={styles.formSaveBtn} onPress={() => handleRestock()} disabled={restocking} activeOpacity={0.85}>
                {restocking ? <ActivityIndicator color="#fff" /> : <LocalizedText translate style={styles.formSaveBtnText}>{reducingStock ? "Reduce Stock" : "Add to Stock"}</LocalizedText>}
              </TouchableOpacity>
            </ScrollView>
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
            <LocalizedText translate={false} style={styles.deleteTitle}>{tr("Remove {name}?", { name: deleteTarget?.name })}</LocalizedText>
            <LocalizedText translate style={styles.deleteSub}>
              This item will be removed from stock, dish recipes and preparations. Past stock history will be kept.
            </LocalizedText>
            {!!deleteError && <LocalizedText translate accessibilityRole="alert" style={{ color: "#B91C1C", fontSize: 13, lineHeight: 20, textAlign: "center", marginBottom: 16 }}>{deleteError}</LocalizedText>}
            <View style={styles.deleteActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDeleteModal(false)} disabled={deleting} activeOpacity={0.8}>
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
      <Modal visible={!!linkItem} animationType="slide" onRequestClose={() => setLinkItem(null)}>
        {linkItem && <SafeAreaView style={{ flex: 1 }}><StockMenuLinkEditor item={linkItem} menu={recipeMenu} onClose={() => setLinkItem(null)} onSaved={loadData} onOpenMenu={openMenu} /></SafeAreaView>}
      </Modal>
      <Modal visible={showRecipeModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowRecipeModal(false)}>
        {showRecipeModal && recipeMenuItem && <InventoryRecipeEditor menuItem={recipeMenuItem} stock={items} onClose={() => setShowRecipeModal(false)} onSaved={loadData} />}
      </Modal>
      <Modal visible={showMore || toolsTab !== null} transparent animationType="fade" onRequestClose={() => { setShowMore(false); setToolsTab(null); }}>
        {showMore ? (
        <View style={[styles.modalOverlay, { justifyContent: "center" }]}>
          <View style={{ backgroundColor: "#fff", borderRadius: 24, width: "100%", alignSelf: "center", maxWidth: 440, padding: 22 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}><NativeText style={{ flex: 1, fontSize: 21, fontWeight: "800", color: "#172B22" }}>{tr("More inventory options")}</NativeText><TouchableOpacity accessibilityRole="button" accessibilityLabel={tr("Close more options")} style={styles.moreButton} onPress={() => setShowMore(false)}><Ionicons name="close" size={23} color="#334155" /></TouchableOpacity></View>
            {[["preparations", "restaurant-outline", "Gravies & preparations", "Save a base recipe to reuse in many dishes"], ["bulk", "layers-outline", "Set up several dishes", "Add common ingredients to dishes together"], ["history", "time-outline", "Stock history", "View photo counts and stock changes"]].map(([key, icon, title, hint]) => <TouchableOpacity key={key} accessibilityRole="button" accessibilityLabel={tr(title)} style={styles.toolOption} onPress={() => { setShowMore(false); setToolsTab(key); }}><View style={styles.toolIcon}><Ionicons name={icon} size={23} color="#008060" /></View><View style={{ flex: 1 }}><NativeText style={styles.sectionTitle}>{tr(title)}</NativeText><NativeText style={styles.sectionHint}>{tr(hint)}</NativeText></View><Ionicons name="chevron-forward" size={17} color="#64756C" /></TouchableOpacity>)}
          </View>
        </View>
        ) : toolsTab !== null && <SafeAreaView style={{ flex: 1, backgroundColor: "#FAF8F5" }}><InventoryTools key={toolsTab} initialTab={toolsTab} stock={items} menu={recipeMenu} onClose={() => setToolsTab(null)} onChanged={loadData} onOpenMenu={openMenu} /></SafeAreaView>}
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
function StockActions({ item, onRestock, onReduce, onEdit, onDelete }) {
  const tr = useLocalizeText();
  const [open, setOpen] = useState(false);
  return <View>
    <View style={styles.stockCardActions}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={tr("Add stock to {name}", { name: item.name })} style={styles.restockBtn} onPress={onRestock}><Ionicons name="add-circle-outline" size={18} color="#fff" /><LocalizedText translate style={styles.restockBtnText}>Add Stock</LocalizedText></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={tr("Options for {name}", { name: item.name })} accessibilityState={{ expanded: open }} style={[styles.iconActionBtn, { width: 46, height: 46 }]} onPress={() => setOpen(!open)}><Ionicons name="ellipsis-horizontal" size={22} color="#334155" /></TouchableOpacity>
    </View>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={tr("Reduce stock for {name}", { name: item.name })} style={[styles.itemOption, { marginTop: 8, justifyContent: "center" }]} onPress={onReduce}>
      <Ionicons name="remove-circle-outline" size={18} color="#AD4A40" />
      <NativeText style={{ color: "#AD4A40", fontWeight: "600", fontSize: 14 }}>{tr("Reduce Stock")}</NativeText>
    </TouchableOpacity>
    {open && <View style={{ paddingTop: 8, gap: 6 }}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={tr("Edit item")} style={styles.itemOption} onPress={() => { setOpen(false); onEdit(); }}><Ionicons name="create-outline" size={18} color="#334155" /><NativeText style={styles.secondaryActionText}>{tr("Edit item")}</NativeText></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={tr("Remove item")} style={styles.itemOption} onPress={() => { setOpen(false); onDelete(); }}><Ionicons name="trash-outline" size={18} color="#B91C1C" /><NativeText style={{ color: "#B91C1C", fontWeight: "600", fontSize: 14 }}>{tr("Remove item")}</NativeText></TouchableOpacity>
    </View>}
  </View>;
}

function StockCardWeb({ item, onRestock, onReduce, onEdit, onDelete, onLink }) {
  const tr = useLocalizeText();
  return (
    <div className="inv-stock-card">
      <div className="inv-stock-heading">
        <div className="inv-stock-symbol"><Ionicons name="cube-outline" size={21} color="#42604E" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="inv-stock-name">{item.name}</div>
          <div className="inv-stock-measure">
            {item.bottle_size && isVolumeUnit(item.unit) ? `${Number(item.bottle_size) * (item.unit === "litre" ? 1000 : 1)} ml ${tr("bottle")}` : tr(unitLabel(item.unit))}
          </div>
        </div>
        {item.is_low && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, background: "#FEF2F2", borderRadius: 8, padding: "3px 7px", flexShrink: 0 }}>
            <Ionicons name="alert-circle" size={11} color="#EF4444" />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#A4473B" }}>{tr("Low")}</span>
          </div>
        )}
      </div>

      <div className="inv-stock-quantity">{formatStockDisplay(item, tr)}</div>
      <div className="inv-stock-threshold">{tr("Alert below {quantity} {unit}", { quantity: formatQty(item.low_stock_threshold), unit: item.unit })}
      </div>

      <TouchableOpacity accessibilityRole="button" onPress={onLink} style={styles.menuLinkButton}><Ionicons name="link-outline" size={16} color="#42604E" /><NativeText style={styles.menuLinkText}>{Number(item.menu_link_count) > 0 ? tr("{count} menu links", { count: item.menu_link_count }) : tr("Link to menu")}</NativeText><Ionicons name="chevron-forward" size={14} color="#627166" /></TouchableOpacity>
      <StockActions item={item} onReduce={onReduce} onRestock={onRestock} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

function RecipeCardWeb({ item, onPress }) {
  const tr = useLocalizeText();
  const linked = item.ingredient_count > 0;
  return (
    <div className="inv-recipe-card" role="button" tabIndex={0} onClick={onPress} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onPress(); } }}>
      <div
        style={{
          width: 38, height: 38, borderRadius: 11, flexShrink: 0,
          background: linked ? "#EDF4E8" : "#F3F4F6",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Ionicons name="restaurant-outline" size={17} color={linked ? "#39805A" : "#7B897F"} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#20332A" }}>{item.name}</div>
        <div style={{ fontSize: 11, color: "#7B897F", fontWeight: 600, marginTop: 1 }}>{tr(item.category)}</div>
      </div>
      {linked ? (
        <div style={{ background: "#EDF4E8", borderRadius: 9, padding: "5px 9px", flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#39805A" }}>
            {tr("{count} linked", { count: item.ingredient_count })}</span>
        </div>
      ) : (
        <div style={{ background: "#FFFBEB", borderRadius: 9, padding: "5px 9px", flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#B45309" }}>{tr("Set up now")}</span>
        </div>
      )}
      <Ionicons name="chevron-forward" size={16} color="#7B897F" />
    </div>
  );
}

// ─── NATIVE CARDS ────────────────────────────────────────────────────
function StockCardNative({ item, onRestock, onReduce, onEdit, onDelete, onLink }) {
  const tr = useLocalizeText();
  return (
    <View style={styles.stockCard}>
      <View style={styles.stockCardTop}>
        <View style={styles.stockSymbol}><Ionicons name="cube-outline" size={21} color="#42604E" /></View>
        <View style={{ flex: 1 }}>
          <LocalizedText translate={false} style={styles.stockName}>{item.name}</LocalizedText>
          <LocalizedText translate={false} style={styles.stockUnitLabel}>{item.bottle_size && isVolumeUnit(item.unit) ? `${Number(item.bottle_size) * (item.unit === "litre" ? 1000 : 1)} ml ${tr("bottle")}` : tr(unitLabel(item.unit))}</LocalizedText>
        </View>
        {item.is_low && (
          <View style={styles.lowBadge}>
            <Ionicons name="alert-circle" size={12} color="#EF4444" />
            <LocalizedText translate style={styles.lowBadgeText}>Low Stock</LocalizedText>
          </View>
        )}
      </View>

      <View style={styles.stockValueRow}>
        <LocalizedText translate={false} style={styles.stockValue}>{formatStockDisplay(item, tr)}</LocalizedText>
      </View>
      <LocalizedText translate={false} style={styles.thresholdText}>{tr("Alert below {quantity} {unit}", { quantity: formatQty(item.low_stock_threshold), unit: item.unit })}</LocalizedText>

      <TouchableOpacity accessibilityRole="button" onPress={onLink} style={styles.menuLinkButton}><Ionicons name="link-outline" size={16} color="#42604E" /><NativeText style={styles.menuLinkText}>{Number(item.menu_link_count) > 0 ? tr("{count} menu links", { count: item.menu_link_count }) : tr("Link to menu")}</NativeText><Ionicons name="chevron-forward" size={14} color="#627166" /></TouchableOpacity>
      <StockActions item={item} onReduce={onReduce} onRestock={onRestock} onEdit={onEdit} onDelete={onDelete} />
    </View>
  );
}

function RecipeCardNative({ item, onPress }) {
  const tr = useLocalizeText();
  const linked = item.ingredient_count > 0;
  return (
    <TouchableOpacity style={styles.recipeCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.recipeIconWrap, { backgroundColor: linked ? "#EDF4E8" : "#F3F4F6" }]}>
        <Ionicons name="restaurant-outline" size={18} color={linked ? "#39805A" : "#7B897F"} />
      </View>
      <View style={{ flex: 1 }}>
        <LocalizedText style={styles.recipeName}>{item.name}</LocalizedText>
        <LocalizedText style={styles.recipeCategory}>{item.category}</LocalizedText>
      </View>
      {linked ? (
        <View style={styles.configuredBadge}>
          <LocalizedText translate={false} style={styles.configuredBadgeText}>{tr("{count} linked", { count: item.ingredient_count })}</LocalizedText>
        </View>
      ) : (
        <View style={styles.notConfiguredBadge}>
          <LocalizedText translate style={styles.notConfiguredBadgeText}>Set up now</LocalizedText>
        </View>
      )}
      <Ionicons name="chevron-forward" size={17} color="#7B897F" />
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

function formatStockDisplay(item, tr) {
  const stock = parseFloat(item?.current_stock) || 0;
  const bottleSize = parseFloat(item?.bottle_size) || 0;
  if (isVolumeUnit(item?.unit) && bottleSize > 0) {
    const bottles = Math.floor(stock / bottleSize);
    const remainder = stock - bottles * bottleSize;
    const parts = [];
    if (bottles > 0) parts.push(tr(bottles === 1 ? "{count} bottle" : "{count} bottles", { count: bottles }));
    if (remainder > 0 || bottles === 0) parts.push(`${formatQty(remainder)} ${item.unit}`);
    return parts.join(" + ");
  }
  return `${formatQty(stock)} ${item?.unit || ""}`.trim();
}

const styles = StyleSheet.create({
  workspaceToolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 20, paddingHorizontal: 24, paddingVertical: 20, width: "100%", maxWidth: 1400, alignSelf: "center" },
  workspaceToolbarCompact: { flexDirection: "column", gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  tabRowDesktop: { flex: 1, maxWidth: 440, width: "auto" },
  mainActionsDesktop: { width: 300 },
  stockSymbol: { width: 42, height: 42, borderRadius: 10, backgroundColor: "#EDF3E8", alignItems: "center", justifyContent: "center" },
  menuLinkButton: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#F5F8F0", borderRadius: 7, paddingHorizontal: 10, minHeight: 40, paddingVertical: 9 },
  menuLinkText: { flex: 1, fontSize: 12, fontWeight: "600", color: "#42604E" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { fontSize: 14, color: "#7B897F", fontWeight: "600" },

  header: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#DFE5DF", paddingBottom: 12 },
  headerTop: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingTop: 20, gap: 14, maxWidth: 1400, alignSelf: "center", width: "100%" },
  backBtn: { width: 42, height: 42, borderRadius: 11, backgroundColor: "#F0F4ED", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 24, fontWeight: "700", color: "#20332A" },
  headerHint: { fontSize: 12.5, color: "#627166", marginTop: 3, lineHeight: 17 },

  tabRow: { flexDirection: "row", gap: 6, width: "100%", backgroundColor: "#F0F4ED", padding: 4, borderRadius: 9 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 42, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 7, backgroundColor: "transparent" },
  tabBtnActive: { backgroundColor: "#173D2D" },
  tabBtnText: { fontSize: 13, fontWeight: "700", color: "#627166" },
  tabBtnTextActive: { color: "#fff" },

  moreButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", padding: 5, borderRadius: 12, backgroundColor: "#EDF2EF" },
  moreLabel: { fontSize: 11, fontWeight: "600", color: "#334155" },
  mainActions: { flexDirection: "row", gap: 8, width: "100%" },
  primaryAction: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: "#244F3B", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, minHeight: 46 },
  primaryActionText: { fontSize: 15, fontWeight: "700", color: "#fff", flexShrink: 1 },
  secondaryAction: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#EDF2EF", borderRadius: 8, paddingHorizontal: 16, minHeight: 46, borderWidth: 1, borderColor: "#D5E0D1" },
  secondaryActionText: { fontSize: 14, fontWeight: "700", color: "#243A30" },
  sectionIntro: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 6, maxWidth: 1400, width: "100%", alignSelf: "center" },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#243A30" },
  sectionHint: { fontSize: 12, color: "#52645D", lineHeight: 20, marginTop: 4 },
  toolOption: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderColor: "#E6ECE8", paddingVertical: 18 },
  toolIcon: { width: 44, height: 44, backgroundColor: "#E6F3EC", borderRadius: 8, alignItems: "center", justifyContent: "center" },
  itemOption: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, minHeight: 44, backgroundColor: "#F7F9F8", borderRadius: 10 },
  headerAddBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    backgroundColor: "#39805A", borderRadius: 12, paddingVertical: 12,
    marginHorizontal: 20, marginTop: 10, maxWidth: 1160, alignSelf: "center", width: "auto",
  },
  headerAddBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  listContent: { padding: 14, flexGrow: 1 },

  stockCard: { backgroundColor: "#fff", borderRadius: 12, padding: 18, marginBottom: 10, borderWidth: 1, borderColor: "#DFE5DF" },
  stockCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  stockName: { fontSize: 17, fontWeight: "600", color: "#20332A" },
  stockUnitLabel: { fontSize: 12, color: "#627166", fontWeight: "400", marginTop: 3 },
  lowBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#FEF2F2", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  lowBadgeText: { fontSize: 10, fontWeight: "700", color: "#EF4444" },

  stockValueRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: 20 },
  stockValue: { flexShrink: 1, fontSize: 27, fontWeight: "700", color: "#20332A", lineHeight: 36, letterSpacing: -.5 },
  stockValueUnit: { fontSize: 13, color: "#627166", fontWeight: "700", marginBottom: 3 },
  thresholdText: { fontSize: 13, color: "#627166", marginTop: 5, marginBottom: 14 },

  stockCardActions: { flexDirection: "row", gap: 6, marginTop: 12, borderTopWidth: 1, borderTopColor: "#F0F4ED", paddingTop: 12 },
  restockBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "#244F3B", minHeight: 46, borderRadius: 8, paddingVertical: 11 },
  restockBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  iconActionBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: "#F0F4ED", alignItems: "center", justifyContent: "center" },
  iconActionBtnDanger: { width: 38, height: 38, borderRadius: 10, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" },

  recipeCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 12, padding: 13, marginBottom: 9, borderWidth: 1, borderColor: "#DFE5DF" },
  recipeSearchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#DFE5DF", borderRadius: 12, paddingHorizontal: 14, marginHorizontal: 20, marginTop: 14, maxWidth: 1160, alignSelf: "center", width: "92%" },
  mobileListHeader: { marginHorizontal: -14, marginTop: -14 },
  stockSearchWrap: { maxWidth: 420, marginHorizontal: 16, width: "90%" },
  recipeSearchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: "#20332A", fontWeight: "600" },
  recipeSearchClear: { width: 28, height: 28, borderRadius: 9, backgroundColor: "#F0F4ED", alignItems: "center", justifyContent: "center" },
  recipeIconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  recipeName: { fontSize: 14, fontWeight: "700", color: "#20332A" },
  recipeCategory: { fontSize: 12, color: "#7B897F", fontWeight: "600", marginTop: 2 },
  configuredBadge: { backgroundColor: "#EDF4E8", borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 },
  configuredBadgeText: { fontSize: 10, fontWeight: "700", color: "#39805A" },
  notConfiguredBadge: { backgroundColor: "#FFFBEB", borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 },
  notConfiguredBadgeText: { fontSize: 10, fontWeight: "700", color: "#B45309" },

  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, paddingTop: 60, alignSelf: "center", maxWidth: 480 },
  emptyIconCircle: { width: 78, height: 78, borderRadius: 39, backgroundColor: "#F0F4ED", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  emptyTitle: { fontSize: 21, fontWeight: "700", color: "#20332A" },
  emptySub: { fontSize: 14, color: "#627166", textAlign: "center", marginTop: 10, lineHeight: 21 },
  bigAddBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#20332A", borderRadius: 9, paddingVertical: 14, paddingHorizontal: 30, marginTop: 26 },
  bigAddBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  recipeEmptyNotice: { flexDirection: "row", gap: 10, backgroundColor: "#F9FAFB", borderRadius: 12, padding: 16, alignItems: "flex-start" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(28,25,23,0.6)", justifyContent: "center", padding: 20 },
  formModal: { backgroundColor: "#fff", borderRadius: 12, padding: 24, width: "100%", maxWidth: 440, alignSelf: "center", maxHeight: "88%" },
  formModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  formModalTitle: { fontSize: 19, fontWeight: "700", color: "#20332A" },
  closeIconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#F0F4ED", alignItems: "center", justifyContent: "center" },
  recipeModalSub: { fontSize: 12, color: "#7B897F", marginTop: 4, lineHeight: 17 },
  recipeModalHeaderBar: { flexDirection: "row", alignItems: "flex-start", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F4ED" },

  fieldLabel: { fontSize: 13, fontWeight: "700", color: "#20332A", marginBottom: 4, marginTop: 18 },
  fieldSubLabel: { fontSize: 12, color: "#7B897F", marginBottom: 8, lineHeight: 16 },
  input: { borderWidth: 1.5, borderColor: "#DFE5DF", borderRadius: 8, padding: 15, fontSize: 16, color: "#111", backgroundColor: "#F9FAFB", marginTop: 6 },

  unitRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  unitChip: { paddingHorizontal: 15, paddingVertical: 11, borderRadius: 11, borderWidth: 1.5, borderColor: "#DFE5DF", backgroundColor: "#fff" },
  unitChipActive: { backgroundColor: "#20332A", borderColor: "#20332A" },
  unitChipText: { fontSize: 13.5, fontWeight: "700", color: "#627166" },
  unitChipTextActive: { color: "#fff" },

  formSaveBtn: { backgroundColor: "#20332A", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 22 },
  formSaveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  restockItemBanner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F9FAFB", borderRadius: 12, padding: 14, marginBottom: 6 },
  restockItemIconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#F0F4ED", alignItems: "center", justifyContent: "center" },
  restockItemName: { fontSize: 15, fontWeight: "700", color: "#20332A" },
  restockItemCurrent: { fontSize: 12.5, color: "#627166", marginTop: 2 },

  restockInputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 8, paddingHorizontal: 16, marginTop: 6, backgroundColor: "#F9FAFB" },
  restockInput: { flex: 1, fontSize: 24, fontWeight: "700", paddingVertical: 15, color: "#20332A" },
  restockInputUnit: { fontSize: 15, fontWeight: "700", color: "#7B897F" },
  quickAddLabel: { fontSize: 12.5, color: "#7B897F", fontWeight: "600", marginTop: 16, marginBottom: 8 },
  presetRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  presetChip: { flexGrow: 1, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12, backgroundColor: "#EDF4E8", alignItems: "center" },
  presetChipText: { fontSize: 13.5, fontWeight: "700", color: "#39805A" },

  deleteModalBox: { backgroundColor: "#fff", borderRadius: 12, padding: 28, width: "100%", maxWidth: 380, alignSelf: "center", alignItems: "center" },
  deleteIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  deleteTitle: { fontSize: 18, fontWeight: "700", color: "#20332A", marginBottom: 8, textAlign: "center" },
  deleteSub: { fontSize: 13.5, color: "#78716C", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  deleteActions: { flexDirection: "row", gap: 10, width: "100%" },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: "#DFE5DF", borderRadius: 8, paddingVertical: 15, alignItems: "center" },
  cancelBtnText: { fontSize: 14.5, fontWeight: "700", color: "#374151" },
  deleteConfirmBtn: { flex: 1, backgroundColor: "#EF4444", borderRadius: 8, paddingVertical: 15, alignItems: "center" },
  deleteConfirmBtnText: { fontSize: 14.5, fontWeight: "700", color: "#fff" },

  ingredientRow: { borderWidth: 1.5, borderColor: "#DFE5DF", borderRadius: 16, padding: 16, marginBottom: 10, backgroundColor: "#fff" },
  ingredientRowActive: { borderColor: "#BBF7D0", backgroundColor: "#F3FDF6" },
  ingredientToggle: { flexDirection: "row", alignItems: "center" },
  ingredientName: { fontSize: 16, fontWeight: "700", color: "#20332A" },
  ingredientStock: { fontSize: 12.5, color: "#7B897F", marginTop: 2 },
  ingredientQtyWrap: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#E5F5EA" },
  ingredientQtyLabel: { fontSize: 13, fontWeight: "600", color: "#627166" },
  ingredientQtyInput: { flex: 1, borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 11, padding: 11, fontSize: 16, fontWeight: "700", color: "#20332A", backgroundColor: "#fff" },
  ingredientQtyUnit: { fontSize: 13, color: "#627166", fontWeight: "700" },
  recipeModalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: "#F0F4ED" },
});
