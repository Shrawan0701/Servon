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

export const unitsFor = (unit) =>
  ["kg", "gm", "g"].includes(unit)
    ? ["kg", "gm"]
    : ["litre", "ml"].includes(unit)
      ? ["litre", "ml"]
      : ["pcs"];
export const ingredientKey = (row) =>
  row.preparation_id ? `p:${row.preparation_id}` : `i:${row.inventory_item_id}`;
export function InvButton({ children, onPress, disabled, secondary = false }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        s.button,
        secondary && s.secondary,
        disabled && { opacity: 0.45 },
      ]}
    >
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
export function InvChoice({ label, options, value, onChange }) {
  const [query, setQuery] = useState(""),
    [open, setOpen] = useState(false);
  const selected = options.find((x) => String(x.id) === String(value));
  return (
    <View style={{ marginVertical: 6 }}>
      <Text style={s.label}>{label}</Text>
      <InvButton secondary onPress={() => setOpen(!open)}>
        {selected?.name || "Choose…"} {open ? "▴" : "▾"}
      </InvButton>
      {open && (
        <View style={s.card}>
          <TextInput
            accessibilityLabel={`Search ${label}`}
            style={s.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search…"
          />
          <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
            {options
              .filter((x) => x.name.toLowerCase().includes(query.toLowerCase()))
              .map((x) => (
                <InvButton
                  secondary
                  key={x.id}
                  onPress={() => {
                    onChange(x.id);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  {x.name}
                </InvButton>
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
}) {
  const [query, setQuery] = useState("");
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
              unit: record.unit,
            },
          ],
    );
  }
  function patch(index, changes) {
    onChange(
      value.map((row, i) => (i === index ? { ...row, ...changes } : row)),
    );
  }
  return (
    <View>
      <Text style={s.hint}>
        Quantities are per serving or per preparation batch. Select existing
        stock or a shared preparation.
      </Text>
      {value.map((row, index) => {
        const record = catalogue.find((x) => x.key === ingredientKey(row));
        return (
          <View key={ingredientKey(row)} style={s.card}>
            <View style={s.row}>
              <Text style={[s.label, { flex: 1 }]}>
                {record?.name || "Unavailable ingredient"} · {record?.kind}
              </Text>
              <InvButton
                secondary
                onPress={() => onChange(value.filter((_, i) => i !== index))}
              >
                Remove
              </InvButton>
            </View>
            <InvField
              label={`Quantity of ${record?.name || "ingredient"}`}
              numeric
              value={row.quantity_required}
              onChangeText={(v) => patch(index, { quantity_required: v })}
            />
            <View style={s.row}>
              {unitsFor(record?.unit || row.unit).map((unit) => (
                <InvButton
                  key={unit}
                  secondary={(row.unit || record?.unit) !== unit}
                  onPress={() => patch(index, { unit })}
                >
                  {unit}
                </InvButton>
              ))}
            </View>
          </View>
        );
      })}
      <InvField
        label="Search ingredients and preparations"
        value={query}
        onChangeText={setQuery}
        placeholder="Tomato, paneer, gravy…"
      />
      <ScrollView style={{ maxHeight: 230 }} nestedScrollEnabled>
        {catalogue
          .filter(
            (x) =>
              !value.some((r) => ingredientKey(r) === x.key) &&
              x.name.toLowerCase().includes(query.toLowerCase()),
          )
          .map((record) => (
            <InvButton
              key={record.key}
              secondary
              onPress={() => toggle(record)}
            >
              + {record.name} · {record.kind} ({record.unit})
            </InvButton>
          ))}
        {!catalogue.length && (
          <Text style={s.hint}>
            Add stock items before configuring a recipe.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
export default function InventoryRecipeEditor({
  menuItem,
  stock,
  onClose,
  onSaved,
}) {
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
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View
        style={[
          s.row,
          { padding: 20, borderBottomWidth: 1, borderColor: "#EAE6E0" },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{menuItem.name}</Text>
          <Text style={s.hint}>Recipe ingredients consumed per serving</Text>
        </View>
        <InvButton secondary onPress={onClose} disabled={saving}>
          Close
        </InvButton>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        {loading ? (
          <ActivityIndicator />
        ) : menuItem.is_liquor_group ? (
          <View>
            <Text style={s.hint}>
              Choose one volume stock pool. Each menu variant deducts its
              configured serving size in ml.
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
            {error}
          </Text>
        )}
      </ScrollView>
      <View style={{ padding: 20 }}>
        <Text style={s.hint}>
          Saving replaces this dish’s recipe. An empty recipe disables
          ingredient tracking for future sales.
        </Text>
        <InvButton
          onPress={save}
          disabled={loading || saving || (!ingredients.length && !!error)}
        >
          {saving ? "Saving…" : "Save This Recipe"}
        </InvButton>
      </View>
    </View>
  );
}
export const inventoryStyles = StyleSheet.create({
  content: {
    padding: 20,
    width: "100%",
    maxWidth: 850,
    alignSelf: "center",
    paddingBottom: 40,
  },
  title: { fontSize: 22, fontWeight: "800", color: "#111827" },
  label: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 6 },
  hint: { fontSize: 13, color: "#6B7280", lineHeight: 20, marginVertical: 6 },
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
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 4,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  secondary: { backgroundColor: "#F3F4F6" },
  card: {
    borderWidth: 1,
    borderColor: "#E8E2D9",
    borderRadius: 14,
    padding: 16,
    marginVertical: 8,
    backgroundColor: "#fff",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
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
