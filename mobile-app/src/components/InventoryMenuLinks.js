import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import API from "../api";
import { useLocalizeText } from "./LocalizedText";
import {
  InvButton,
  InvChoice,
  InvField,
  inventoryStyles as s,
} from "./InventoryRecipeEditor";
import {
  groupMenu,
  relatedGroups,
  quantityPerSale,
  chosenLinks,
  initialMenuSelection,
} from "../utils/inventoryMenuMatching";

export function MenuLinkPicker({
  row,
  menu = [],
  unit,
  onChange,
  onOpenMenu,
  allowStockOnly = true,
}) {
  const tr = useLocalizeText();
  const [search, setSearch] = useState(false);
  const groups = useMemo(() => groupMenu(menu), [menu]);
  const related = relatedGroups(menu, row.new_name || row.label);
  const selected = new Set(row.menu_groups || []);
  const visible = [
    ...new Map(
      [
        ...groups.filter((group) => selected.has(group.id)),
        ...related.slice(0, 4),
      ].map((group) => [group.id, group]),
    ).values(),
  ];
  function toggle(id) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ menu_mode: "link", menu_groups: [...next] });
  }
  return (
    <View
      style={{
        marginTop: 18,
        borderTopWidth: 1,
        borderColor: "#E2E9DF",
        paddingTop: 15,
      }}
    >
      <Text style={[s.label, { fontSize: 15 }]}>
        {tr("Related menu items")}
      </Text>
      <Text style={s.smallHint}>
        {tr("Choose what you sell. Stock will reduce when ordered.")}
      </Text>
      {row.menu_mode !== "stock" && (
        <>
          {visible.map((group) => (
            <View key={group.id}>
              <TouchableOpacity
                accessibilityRole="checkbox"
                accessibilityLabel={tr("Choose {name}", { name: group.name })}
                accessibilityState={{ checked: selected.has(group.id) }}
                onPress={() => toggle(group.id)}
                style={[
                  s.row,
                  {
                    flexWrap: "nowrap",
                    minHeight: 57,
                    borderBottomWidth: 1,
                    borderColor: "#EEF2EA",
                    paddingVertical: 10,
                  },
                ]}
              >
                <Ionicons
                  name={selected.has(group.id) ? "checkbox" : "square-outline"}
                  size={23}
                  color="#377B55"
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      color: "#254D34",
                      fontWeight: "600",
                    }}
                  >
                    {group.name}
                  </Text>
                  <Text style={s.smallHint}>
                    {group.liquor
                      ? group.variants
                          .map((item) => `${Number(item.size_ml || 0)} ml`)
                          .join(" · ")
                      : group.variants[0]?.category}
                  </Text>
                </View>
              </TouchableOpacity>
              {selected.has(group.id) &&
                !group.liquor &&
                group.variants.map((item) => (
                  <InvField
                    key={item.id}
                    numeric
                    label={tr("Used per order ({unit})", { unit })}
                    value={
                      row.menu_amounts?.[item.id] ??
                      quantityPerSale(item, row.bottle_size_ml, unit) ??
                      ""
                    }
                    onChangeText={(value) =>
                      onChange({
                        menu_amounts: { ...row.menu_amounts, [item.id]: value },
                      })
                    }
                  />
                ))}
              {selected.has(group.id) && group.liquor && unit === "pcs" && (
                <Text style={s.error}>
                  {tr("Use ml or litres stock for liquor servings")}
                </Text>
              )}
            </View>
          ))}
          {!visible.length && (
            <Text style={[s.smallHint, { marginVertical: 10 }]}>
              {tr("No matching menu item yet.")}
            </Text>
          )}
          {menu.length > 0 &&
            (search ? (
              <InvChoice
                label={tr("Find in menu")}
                options={groups.map((group) => ({
                  id: group.id,
                  name: group.name,
                }))}
                value=""
                onChange={(id) => {
                  if (!selected.has(id)) toggle(id);
                  setSearch(false);
                }}
              />
            ) : (
              <TouchableOpacity
                onPress={() => setSearch(true)}
                style={{ paddingVertical: 12 }}
              >
                <Text style={{ color: "#3F7B53", fontSize: 13 }}>
                  {tr("Search all menu items")}
                </Text>
              </TouchableOpacity>
            ))}
          {!visible.length && (
            <Text style={s.hint}>
              {tr(
                "Add the product in Menu with its selling price to offer it to customers.",
              )}
            </Text>
          )}
          {onOpenMenu && !visible.length && (
            <TouchableOpacity
              onPress={onOpenMenu}
              style={{ paddingVertical: 10 }}
            >
              <Text style={{ color: "#3F7B53", fontSize: 13 }}>
                {tr("Open Menu")}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
      {allowStockOnly && (
        <TouchableOpacity
          accessibilityRole="checkbox"
          accessibilityState={{ checked: row.menu_mode === "stock" }}
          onPress={() =>
            onChange({
              menu_mode: row.menu_mode === "stock" ? "link" : "stock",
            })
          }
          style={[s.row, { paddingVertical: 12 }]}
        >
          <Ionicons
            name={row.menu_mode === "stock" ? "checkbox" : "square-outline"}
            size={21}
            color="#7B8976"
          />
          <Text style={{ flex: 1, color: "#788774", fontSize: 12 }}>
            {tr("Save stock without a new menu link")}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function StockMenuLinkEditor({
  item,
  menu,
  onClose,
  onSaved,
  onOpenMenu,
}) {
  const tr = useLocalizeText();
  const [row, setRow] = useState({
    label: item.name,
    bottle_size_ml: item.bottle_size
      ? String(Number(item.bottle_size) * (item.unit === "litre" ? 1000 : 1))
      : "",
    ...initialMenuSelection(menu, item.id),
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save() {
    if (busy) return;
    const links = chosenLinks(row, menu, item.unit);
    if (!links.length) {
      setError("Choose at least one menu item.");
      return;
    }
    if (links.some((link) => !(Number(link.quantity_required) > 0))) {
      setError("Enter stock used per order for each selected menu item.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await API.put(`/inventory/${item.id}/menu-links`, { menu_links: links });
      await onSaved();
      onClose();
    } catch (error) {
      setError(error.response?.data?.error || error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ flex: 1, backgroundColor: "#FAF8F5" }}>
      <View
        style={{
          padding: 20,
          backgroundColor: "#fff",
          borderBottomWidth: 1,
          borderColor: "#E4E9DE",
        }}
      >
        <View style={s.row}>
          <Text style={[s.title, { flex: 1, fontSize: 22 }]}>
            {tr("Link menu items")}
          </Text>
          <InvButton secondary disabled={busy} onPress={onClose}>
            {tr("Close")}
          </InvButton>
        </View>
        <Text style={s.hint}>{item.name}</Text>
      </View>
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <MenuLinkPicker
          row={row}
          menu={menu}
          unit={item.unit}
          onChange={(change) =>
            setRow((previous) => ({ ...previous, ...change }))
          }
          allowStockOnly={false}
          onOpenMenu={onOpenMenu}
        />
        {!!error && (
          <Text accessibilityRole="alert" style={s.error}>
            {tr(error)}
          </Text>
        )}
        {busy ? (
          <ActivityIndicator color="#377B55" />
        ) : (
          <InvButton onPress={save}>{tr("Save menu links")}</InvButton>
        )}
      </ScrollView>
    </View>
  );
}
