import { useLocalizeText } from "./LocalizedText";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import API from "../api";
import { Ionicons } from "@expo/vector-icons";

export const unitsFor = (unit) =>
  ["kg", "gm", "g"].includes(unit)
    ? ["kg", "gm"]
    : ["litre", "ml"].includes(unit)
      ? ["litre", "ml"]
      : ["pcs"];
export const ingredientKey = (row) =>
  row.preparation_id ? `p:${row.preparation_id}` : `i:${row.inventory_item_id}`;
export function InvButton({
  children,
  onPress,
  disabled,
  secondary = false,
  icon,
  style,
  accessibilityLabel,
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ||
        (typeof children === "string" ? children : undefined)
      }
      disabled={disabled}
      onPress={onPress}
      style={[
        s.button,
        secondary && s.secondary,
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={19}
          color={secondary ? "#334155" : "#fff"}
        />
      )}
      <Text style={[s.buttonText, secondary && { color: "#111827" }]}>
        {children}
      </Text>
    </TouchableOpacity>
  );
}
export function InvField({
  label,
  value,
  onChangeText,
  numeric = false,
  ...props
}) {
  return (
    <View style={{ marginVertical: 7 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={s.input}
        value={String(value ?? "")}
        onChangeText={onChangeText}
        keyboardType={numeric ? "decimal-pad" : "default"}
        {...props}
      />
    </View>
  );
}
export function InvChoice({
  label,
  options,
  value,
  onChange,
  compact = false,
  disabled = false,
}) {
  const tr = useLocalizeText();
  const [query, setQuery] = useState(""),
    [open, setOpen] = useState(false);
  const selected = options.find((x) => String(x.id) === String(value));
  return (
    <View style={{ marginVertical: compact ? 0 : 6 }}>
      {!compact && <Text style={s.label}>{label}</Text>}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => setOpen(!open)}
        style={[s.choice, compact && { minWidth: 76 }]}
      >
        <Text style={s.choiceText}>{selected?.name || tr("Choose item")}</Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color="#64748B"
        />
      </TouchableOpacity>
      {open && (
        <View style={s.card}>
          {options.length > 6 && (
            <TextInput
              accessibilityLabel={tr("Search {label}", { label })}
              style={s.input}
              value={query}
              onChangeText={setQuery}
              placeholder={tr("Search…")}
            />
          )}
          <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
            {options
              .filter((x) => x.name.toLowerCase().includes(query.toLowerCase()))
              .map((x) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={x.name}
                  style={s.choiceOption}
                  key={x.id}
                  onPress={() => {
                    onChange(x.id);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Text style={s.choiceText}>{x.name}</Text>
                  {String(x.id) === String(value) && (
                    <Ionicons name="checkmark" size={18} color="#008060" />
                  )}
                </TouchableOpacity>
              ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
export function IngredientEditor({
  stock,
  preparations,
  value,
  onChange,
  excludePreparation,
  context = "serving",
}) {
  const tr = useLocalizeText();
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const catalogue = [
    ...stock.map((x) => ({
      ...x,
      key: `i:${x.id}`,
      kind: "Stock",
      unit: x.unit,
    })),
    ...preparations
      .filter((x) => x.id !== excludePreparation)
      .map((x) => ({
        ...x,
        key: `p:${x.id}`,
        kind: "Preparation",
        unit: x.yield_unit,
      })),
  ];
  function toggle(record) {
    setQuery("");
    setShowAll(false);
    const found = value.some((x) => ingredientKey(x) === record.key);
    onChange(
      found
        ? value.filter((x) => ingredientKey(x) !== record.key)
        : [
            ...value,
            {
              ...(record.kind === "Stock"
                ? { inventory_item_id: record.id }
                : { preparation_id: record.id }),
              quantity_required: "",
              unit:
                record.unit === "kg"
                  ? "gm"
                  : record.unit === "litre"
                    ? "ml"
                    : record.unit,
            },
          ],
    );
  }
  const remaining = catalogue.filter(
    (x) =>
      !value.some((r) => ingredientKey(r) === x.key) &&
      x.name.toLowerCase().includes(query.toLowerCase()),
  );
  function patch(index, changes) {
    onChange(
      value.map((row, i) => (i === index ? { ...row, ...changes } : row)),
    );
  }
  return (
    <View>
      <Text style={s.hint}>
        {context === "batch"
          ? tr("How much goes into one batch?")
          : tr("How much is used for one serving?")}
      </Text>
      {value.map((row, index) => {
        const record = catalogue.find((x) => x.key === ingredientKey(row));
        return (
          <View key={ingredientKey(row)} style={[s.card, { padding: 14 }]}>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>
                  {record?.name || tr("Unavailable ingredient")}
                </Text>
                {record?.kind === "Preparation" && (
                  <Text style={s.smallHint}>
                    {tr("Shared gravy / preparation")}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={tr("Remove {name}", {
                  name: record?.name || tr("Ingredient"),
                })}
                style={s.iconButton}
                onPress={() => onChange(value.filter((_, i) => i !== index))}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <View style={[s.row, { marginTop: 8, alignItems: "flex-start" }]}>
              <TextInput
                style={[s.input, { flex: 1, minWidth: 90 }]}
                accessibilityLabel={tr("Quantity of {name}", {
                  name: record?.name || tr("Ingredient"),
                })}
                keyboardType="decimal-pad"
                placeholder={tr("e.g. 100")}
                value={String(row.quantity_required ?? "")}
                onChangeText={(v) => patch(index, { quantity_required: v })}
              />
              <InvChoice
                compact
                label={tr("Unit for {name}", {
                  name: record?.name || tr("Ingredient"),
                })}
                options={unitsFor(record?.unit || row.unit).map((unit) => ({
                  id: unit,
                  name: unit === "gm" ? "g" : unit === "litre" ? "L" : unit,
                }))}
                value={row.unit === "g" ? "gm" : row.unit || record?.unit}
                onChange={(unit) => patch(index, { unit })}
              />
            </View>
          </View>
        );
      })}
      <InvField
        label={
          value.length ? tr("Add another ingredient") : tr("Add ingredients")
        }
        value={query}
        onChangeText={setQuery}
        placeholder={tr("Search tomato, paneer, gravy…")}
      />
      <ScrollView style={{ maxHeight: 230 }} nestedScrollEnabled>
        {remaining.slice(0, query || showAll ? undefined : 5).map((record) => (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={tr("Add {name}", { name: record.name })}
            style={s.catalogueRow}
            key={record.key}
            onPress={() => toggle(record)}
          >
            <View style={s.miniIcon}>
              <Ionicons
                name={
                  record.kind === "Preparation"
                    ? "restaurant-outline"
                    : "leaf-outline"
                }
                size={18}
                color="#008060"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{record.name}</Text>
              <Text style={s.smallHint}>
                {record.kind === "Preparation"
                  ? tr("Shared preparation")
                  : tr("Stock ingredient")}
              </Text>
            </View>
            <Ionicons name="add-circle-outline" size={23} color="#008060" />
          </TouchableOpacity>
        ))}
        {!catalogue.length && (
          <Text style={s.hint}>
            {tr("Add stock items before configuring a recipe.")}
          </Text>
        )}
        {!!catalogue.length && !remaining.length && (
          <Text style={s.hint}>
            {query
              ? tr("No matching ingredients. Try a different name.")
              : tr("All available ingredients have been added.")}
          </Text>
        )}
      </ScrollView>
      {!query &&
        catalogue.filter((x) => !value.some((r) => ingredientKey(r) === x.key))
          .length > 5 && (
          <InvButton secondary onPress={() => setShowAll(!showAll)}>
            {showAll
              ? tr("Show fewer ingredients")
              : tr("Show all ingredients")}
          </InvButton>
        )}
    </View>
  );
}
export default function InventoryRecipeEditor({
  menuItem,
  stock,
  onClose,
  onSaved,
}) {
  const tr = useLocalizeText();
  const [preparations, setPreparations] = useState([]),
    [ingredients, setIngredients] = useState([]),
    [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [p, r] = await Promise.all([
          API.get("/inventory/preparations"),
          API.get(
            `/inventory/recipes/${menuItem.variants?.[0]?.id || menuItem.id}`,
          ),
        ]);
        if (active) {
          setPreparations(p.data);
          setIngredients(
            r.data.map((x) => ({
              ...x,
              quantity_required: String(x.quantity_required),
            })),
          );
          setSelected(
            r.data
              .filter((x) => x.inventory_item_id)
              .map((x) => x.inventory_item_id),
          );
        }
      } catch (e) {
        if (active)
          setError(
            e.response?.data?.error ||
              "Recipe could not be loaded. Close and retry.",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [menuItem.id]);
  async function save() {
    setSaving(true);
    setError("");
    try {
      if (menuItem.is_liquor_group) {
        if (selected.length > 1)
          throw new Error(
            "Choose one stock pool for this liquor brand to avoid duplicate consumption.",
          );
        const changes = menuItem.variants.map((v) => ({
          menu_item_id: v.id,
          ingredients: selected.map((id) => {
            if (!(Number(v.size_ml) > 0))
              throw new Error("Every liquor variant needs a serving size.");
            return {
              inventory_item_id: id,
              quantity_required: Number(v.size_ml),
              unit: "ml",
            };
          }),
        }));
        await API.post("/inventory/recipes/bulk", { mode: "replace", changes });
      } else {
        if (
          ingredients.some(
            (x) =>
              !Number.isFinite(Number(x.quantity_required)) ||
              Number(x.quantity_required) <= 0,
          )
        )
          throw new Error(
            "Enter a positive quantity for every selected ingredient.",
          );
        await API.put(`/inventory/recipes/${menuItem.id}`, { ingredients });
      }
      await onSaved();
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || e.message || "Could not save recipe");
    } finally {
      setSaving(false);
    }
  }
  return (
    <View style={{ flex: 1, backgroundColor: "#F7F9F8" }}>
      <View
        style={[
          s.row,
          {
            padding: 20,
            borderBottomWidth: 1,
            borderColor: "#E2E8E5",
            backgroundColor: "#fff",
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{menuItem.name}</Text>
          <Text style={s.hint}>{tr("Ingredients for one serving")}</Text>
        </View>
        <TouchableOpacity
          style={s.iconButton}
          accessibilityRole="button"
          accessibilityLabel={tr("Close recipe")}
          onPress={onClose}
          disabled={saving}
        >
          <Ionicons name="close" size={24} color="#334155" />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        {loading ? (
          <ActivityIndicator />
        ) : menuItem.is_liquor_group ? (
          <View>
            <Text style={s.hint}>
              {tr(
                "Choose the stock used for this brand. Each serving size is linked automatically.",
              )}
            </Text>
            {stock
              .filter((x) => ["ml", "litre"].includes(x.unit))
              .map((x) => (
                <InvButton
                  key={x.id}
                  secondary={!selected.includes(x.id)}
                  onPress={() =>
                    setSelected(selected.includes(x.id) ? [] : [x.id])
                  }
                >
                  {x.name} ({x.unit})
                </InvButton>
              ))}
            <Text style={s.hint}>
              {menuItem.variants
                .map((x) => `${x.name}: ${x.size_ml} ml`)
                .join("\n")}
            </Text>
          </View>
        ) : (
          <IngredientEditor
            stock={stock}
            preparations={preparations}
            value={ingredients}
            onChange={setIngredients}
          />
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={s.error}>
            {tr(error)}
          </Text>
        )}
      </ScrollView>
      <View style={s.footer}>
        <Text style={s.hint}>
          {(menuItem.is_liquor_group ? selected.length : ingredients.length)
            ? tr("Stock is deducted automatically when this dish is ordered.")
            : tr(
                "No ingredients selected. Saving will turn off stock tracking for this dish.",
              )}
        </Text>
        <InvButton
          onPress={save}
          disabled={loading || saving || (!ingredients.length && !!error)}
        >
          {saving ? tr("Saving…") : tr("Save recipe")}
        </InvButton>
      </View>
    </View>
  );
}
export const inventoryStyles = StyleSheet.create({
  content: {
    padding: 20,
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
    paddingBottom: 40,
  },
  title: { fontSize: 22, fontWeight: "800", color: "#111827" },
  label: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 6 },
  hint: { fontSize: 14, color: "#52645D", lineHeight: 22, marginVertical: 6 },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E8E2D9",
    borderRadius: 12,
    padding: 13,
    color: "#111827",
    fontSize: 15,
  },
  button: {
    backgroundColor: "#008060",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 4,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 48,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    flexShrink: 1,
    textAlign: "center",
  },
  secondary: { backgroundColor: "#EDF2EF" },
  card: {
    borderWidth: 1,
    borderColor: "#E8E2D9",
    borderRadius: 14,
    padding: 16,
    marginVertical: 8,
    backgroundColor: "#fff",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  choice: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
    padding: 13,
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#DCE5DF",
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  choiceText: { fontSize: 15, color: "#243A30", flexShrink: 1 },
  choiceOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 13,
    gap: 8,
    minHeight: 44,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EDF2EF",
  },
  smallHint: { fontSize: 12, color: "#64756C", lineHeight: 18 },
  catalogueRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#E6ECE8",
    minHeight: 62,
  },
  miniIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#E6F3EC",
    justifyContent: "center",
    alignItems: "center",
  },
  footer: {
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#E2E8E5",
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
  },
  error: {
    color: "#B91C1C",
    backgroundColor: "#FEF2F2",
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  success: {
    color: "#047857",
    backgroundColor: "#ECFDF5",
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
});
const s = inventoryStyles;
