import { useLocalizeText } from "./LocalizedText";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import Scanner, { CountReview } from "./InventoryScanner";
import API from "../api";
import {
  IngredientEditor,
  InvButton,
  InvField,
  InvChoice,
  ingredientKey,
  inventoryStyles as s,
} from "./InventoryRecipeEditor";
import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";

function Details({ title, children, initiallyOpen = false }) {
  const tr = useLocalizeText();
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={{ marginVertical: 8 }}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={[s.row, { minHeight: 44 }]}
      >
        <Text style={[s.label, { flex: 1, marginBottom: 0 }]}>{title}</Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color="#52645D"
        />
      </TouchableOpacity>
      {open && children}
    </View>
  );
}

function Steps({ labels, current }) {
  const tr = useLocalizeText();
  return (
    <View style={[s.row, { marginBottom: 20, flexWrap: "nowrap" }]}>
      {labels.map((label, i) => (
        <View
          key={label}
          style={{
            flex: 1,
            borderTopWidth: 3,
            borderColor: i <= current ? "#008060" : "#DCE5DF",
            paddingTop: 10,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: i === current ? "#008060" : "#64756C",
            }}
          >
            {i + 1}. {tr(label)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const scanStatusLabel = (status, tr) => {
  const labels = {
    review: "Awaiting review",
    confirmed: "Count saved",
    reconciled: "Stock updated",
    processing: "Counting",
    failed: "Failed",
  };
  return labels[status] ? tr(labels[status]) : status;
};
const errorText = (e) =>
  e.response?.data?.error || e.message || "Request failed. Please retry.";
const keyFor = () =>
  `inventory-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export default function InventoryTools({
  initialTab = "scan",
  stock,
  menu,
  onClose,
  onChanged,
  onOpenMenu,
}) {
  const tr = useLocalizeText();
  const scroll = useRef(null);
  const tab = initialTab;
  const [preparations, setPreparations] = useState([]),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState("");
  async function load() {
    setLoadError("");
    try {
      if (["preparations", "bulk"].includes(tab))
        setPreparations((await API.get("/inventory/preparations")).data);
    } catch (e) {
      setLoadError(errorText(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: "#FAF8F5" }}>
      <View
        style={{
          padding: 18,
          backgroundColor: "#fff",
          borderBottomWidth: 1,
          borderColor: "#EAE6E0",
        }}
      >
        <View style={s.row}>
          <Text style={[s.title, { flex: 1 }]}>
            {tr(
              {
                scan: "Count stock from a photo",
                preparations: "Gravies & preparations",
                bulk: "Set up several dishes",
                history: "Stock history",
              }[tab],
            )}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={tr("Close inventory tool")}
            onPress={onClose}
            style={s.iconButton}
          >
            <Ionicons name="close" size={24} color="#334155" />
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        {loading ? (
          <ActivityIndicator />
        ) : loadError ? (
          <View>
            <Text style={s.error}>{tr(loadError)}</Text>
            <InvButton onPress={load}>{tr("Retry")}</InvButton>
          </View>
        ) : (
          <>
            {tab === "scan" && (
              <Scanner
                stock={stock}
                menu={menu}
                onChanged={onChanged}
                onOpenMenu={onOpenMenu}
              />
            )}
            {tab === "preparations" && (
              <Preparations
                stock={stock}
                preparations={preparations}
                onChanged={load}
              />
            )}
            {tab === "bulk" && (
              <BulkRecipes
                stock={stock}
                preparations={preparations}
                menu={menu}
                onChanged={onChanged}
                onStep={() =>
                  scroll.current?.scrollTo({ y: 0, animated: false })
                }
              />
            )}
            {tab === "history" && <History onChanged={onChanged} />}
          </>
        )}
      </ScrollView>
    </View>
  );
}
function Preparations({ stock, preparations, onChanged }) {
  const tr = useLocalizeText();
  const [draft, setDraft] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [archive, setArchive] = useState(false);
  function edit(record) {
    setDraft(
      record
        ? {
            ...record,
            ingredients: record.ingredients.map((r) => ({
              ...r,
              unit: r.preparation_id
                ? preparations.find((p) => p.id === r.preparation_id)
                    ?.yield_unit
                : stock.find((s) => s.id === r.inventory_item_id)?.unit,
            })),
          }
        : {
            name: "",
            yield_quantity: "",
            yield_unit: "kg",
            wastage_percent: "0",
            ingredients: [],
          },
    );
    setError("");
    setMessage("");
    setArchive(false);
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      if (draft.id) await API.put(`/inventory/preparations/${draft.id}`, draft);
      else await API.post("/inventory/preparations", draft);
      setDraft(null);
      setMessage("Preparation saved. Future orders use the updated recipe.");
      await onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function archivePrep() {
    setBusy(true);
    setError("");
    try {
      await API.delete(`/inventory/preparations/${draft.id}`);
      setDraft(null);
      setMessage("Preparation archived.");
      await onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View>
      <Text style={s.hint}>
        {tr(
          "Save a gravy, paste or marinade once, then use it in any dish. Ingredients are deducted when the dish is ordered.",
        )}
      </Text>
      {!draft ? (
        <>
          <InvButton icon="add-circle-outline" onPress={() => edit()}>
            {tr("Add gravy or preparation")}
          </InvButton>
          {!preparations.length && (
            <Text style={s.hint}>{tr("No shared preparations yet.")}</Text>
          )}
          {preparations.map((p) => (
            <View key={p.id} style={s.card}>
              <Text style={s.label}>{p.name}</Text>
              <Text style={s.hint}>
                {tr("{quantity} {unit} per batch · {count} ingredients", {
                  quantity: Number(p.yield_quantity),
                  unit: p.yield_unit,
                  count: p.ingredients.length,
                })}
              </Text>
              <InvButton secondary onPress={() => edit(p)}>
                {tr("Edit recipe")}
              </InvButton>
            </View>
          ))}
        </>
      ) : (
        <View style={s.card}>
          <InvField
            label={tr("Preparation name")}
            value={draft.name}
            onChangeText={(v) => setDraft({ ...draft, name: v })}
          />
          <InvField
            numeric
            label={tr("How much does one batch make?")}
            value={draft.yield_quantity}
            onChangeText={(v) => setDraft({ ...draft, yield_quantity: v })}
          />
          <InvChoice
            label={tr("Batch unit")}
            disabled={!!draft.id}
            value={draft.yield_unit}
            options={[
              { id: "kg", name: tr("Kilograms (kg)") },
              { id: "gm", name: tr("Grams (g)") },
              { id: "litre", name: tr("Litres (L)") },
              { id: "ml", name: tr("Millilitres (ml)") },
              { id: "pcs", name: tr("Pieces") },
            ]}
            onChange={(yield_unit) => setDraft({ ...draft, yield_unit })}
          />
          <Details
            title={`${tr("Batch loss (optional)")}${Number(draft.wastage_percent) ? ` · ${draft.wastage_percent}%` : ""}`}
          >
            <InvField
              numeric
              label={tr("Optional yield loss (%)")}
              value={draft.wastage_percent}
              onChangeText={(v) => setDraft({ ...draft, wastage_percent: v })}
            />
            <Text style={s.hint}>
              {tr(
                "Use 0 if your batch amount already allows for waste. Nothing is deducted while setting up this recipe.",
              )}
            </Text>
          </Details>
          <Text style={s.hint}>
            {tr("Usable yield:")}{" "}
            {(
              Number(draft.yield_quantity) *
              (1 - Number(draft.wastage_percent) / 100)
            ).toFixed(3)}{" "}
            {draft.yield_unit}
            {tr(". Ingredient quantities below describe one full batch.")}
          </Text>
          <IngredientEditor
            stock={stock}
            preparations={preparations}
            excludePreparation={draft.id}
            context="batch"
            value={draft.ingredients}
            onChange={(ingredients) => setDraft({ ...draft, ingredients })}
          />
          <InvButton disabled={busy} onPress={save}>
            {busy ? tr("Saving…") : tr("Save preparation")}
          </InvButton>
          <InvButton secondary disabled={busy} onPress={() => setDraft(null)}>
            {tr("Cancel")}
          </InvButton>
          {draft.id && (
            <InvButton
              secondary
              disabled={busy}
              onPress={() => (archive ? archivePrep() : setArchive(true))}
            >
              {archive
                ? tr("Confirm archive preparation")
                : tr("Archive preparation")}
            </InvButton>
          )}
        </View>
      )}
      {!!message && <Text style={s.success}>{tr(message)}</Text>}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {tr(error)}
        </Text>
      )}
    </View>
  );
}
function BulkRecipes({ stock, preparations, menu, onChanged, onStep }) {
  const tr = useLocalizeText();
  const [step, setStep] = useState(0);
  const [messageValues, setMessageValues] = useState({});
  useEffect(() => {
    onStep();
  }, [step]);
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("all"),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState([]);
  const [ingredients, setIngredients] = useState([]),
    [overrides, setOverrides] = useState({}),
    [mode, setMode] = useState("merge"),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const filtered = useMemo(
    () =>
      menu.filter(
        (m) =>
          `${m.name} ${m.category || ""}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (category === "all" || m.category === category) &&
          (filter === "all" ||
            (filter === "configured"
              ? m.ingredient_count > 0
              : !m.ingredient_count)),
      ),
    [menu, search, category, filter],
  );
  const displayed = filtered.slice(page * 30, (page + 1) * 30);
  const changes = selected.map((id) => ({
    menu_item_id: id,
    ingredients: ingredients.map((row) => ({
      ...row,
      quantity_required:
        overrides[`${id}/${ingredientKey(row)}`] ?? row.quantity_required,
    })),
  }));
  function changed() {
    setPreview(null);
    setMessage("");
    setError("");
  }
  const ingredientName = (row) =>
    row.preparation_id
      ? preparations.find((p) => p.id === row.preparation_id)?.name
      : stock.find((s) => s.id === row.inventory_item_id)?.name;
  const recipeDescription = (rows) =>
    rows
      .map(
        (row) =>
          `${ingredientName(row) || tr("Ingredient")}: ${Number(row.quantity_required)} ${row.unit || (row.preparation_id ? preparations.find((p) => p.id === row.preparation_id)?.yield_unit : stock.find((s) => s.id === row.inventory_item_id)?.unit)}`,
      )
      .join("\n") || tr("No ingredients");
  async function submit(isPreview) {
    setBusy(true);
    setError("");
    try {
      if (!selected.length || !ingredients.length)
        throw new Error("Select dishes and at least one common ingredient.");
      const result = (
        await API.post("/inventory/recipes/bulk", {
          changes,
          mode,
          preview: isPreview,
          preview_token: isPreview ? undefined : preview?.preview_token,
        })
      ).data;
      if (isPreview) {
        setPreview(result);
        setStep(2);
      } else {
        setPreview(null);
        setSelected([]);
        setStep(0);
        setOverrides({});
        setMessage("{count} dish recipes saved successfully.");
        setMessageValues({ count: result.results.length });
        await onChanged();
      }
    } catch (e) {
      setError(errorText(e));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }
  const quantitiesValid = changes.every((change) =>
    change.ingredients.every(
      (row) =>
        Number.isFinite(Number(row.quantity_required)) &&
        Number(row.quantity_required) > 0,
    ),
  );
  return (
    <View>
      <Steps
        labels={["Choose dishes", "Ingredients", "Check & save"]}
        current={step}
      />
      {step === 0 && (
        <>
          <Text style={s.title}>
            {tr("Which dishes use the same ingredients?")}
          </Text>
          <Text style={s.hint}>
            {tr("Choose dishes, then add their common ingredients once.")}
          </Text>
          <InvField
            label={tr("Search dishes")}
            placeholder={tr("Search by dish name...")}
            value={search}
            onChangeText={(v) => {
              setSearch(v);
              setPage(0);
            }}
          />
          <Details
            title={tr(
              category !== "all" || filter !== "all"
                ? "Filter dishes (active)"
                : "Filter dishes",
            )}
          >
            <InvChoice
              label={tr("Category")}
              value={category}
              options={[
                { id: "all", name: tr("All categories") },
                ...[
                  ...new Set(menu.map((m) => m.category).filter(Boolean)),
                ].map((c) => ({ id: c, name: tr(c) })),
              ]}
              onChange={(v) => {
                setCategory(v);
                setPage(0);
              }}
            />
            <InvChoice
              label={tr("Recipe status")}
              value={filter}
              options={[
                { id: "all", name: tr("All dishes") },
                { id: "configured", name: tr("With ingredients") },
                { id: "missing", name: tr("Without ingredients") },
              ]}
              onChange={(v) => {
                setFilter(v);
                setPage(0);
              }}
            />
          </Details>
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Text style={s.label}>
              {tr("{count} selected", { count: selected.length })}
            </Text>
            <View style={s.row}>
              <InvButton
                secondary
                disabled={busy || !filtered.length}
                onPress={() => {
                  setSelected(filtered.slice(0, 250).map((m) => m.id));
                  changed();
                }}
              >
                {filtered.length > 250
                  ? tr("Select first 250")
                  : tr("Select all")}
              </InvButton>
              {!!selected.length && (
                <InvButton
                  secondary
                  disabled={busy}
                  onPress={() => {
                    setSelected([]);
                    changed();
                  }}
                >
                  {tr("Clear")}
                </InvButton>
              )}
            </View>
          </View>
          {filtered.length > 250 && (
            <Text style={s.smallHint}>
              {tr(
                "Up to 250 dishes at a time. Search or filter to narrow the list.",
              )}
            </Text>
          )}
          <ScrollView
            style={{ maxHeight: 380 }}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {displayed.map((m) => {
              const checked = selected.includes(m.id);
              return (
                <TouchableOpacity
                  key={m.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={m.name}
                  accessibilityState={{
                    checked,
                    disabled: !checked && selected.length >= 250,
                  }}
                  disabled={busy || (!checked && selected.length >= 250)}
                  onPress={() => {
                    setSelected(
                      checked
                        ? selected.filter((id) => id !== m.id)
                        : [...selected, m.id],
                    );
                    changed();
                  }}
                  style={[
                    s.catalogueRow,
                    {
                      paddingHorizontal: 12,
                      backgroundColor: checked ? "#EAF5EF" : "#fff",
                      borderRadius: 10,
                      marginTop: 6,
                    },
                  ]}
                >
                  <Ionicons
                    name={checked ? "checkbox" : "square-outline"}
                    size={24}
                    color={checked ? "#008060" : "#94A89B"}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>{m.name}</Text>
                    <Text style={s.smallHint}>
                      {m.category ? tr(m.category) : tr("Dish")}
                      {m.size_ml ? ` - ${m.size_ml} ml` : ""}{" "}
                      {m.ingredient_count
                        ? ` / ${tr("{count} ingredients", { count: m.ingredient_count })}`
                        : ` / ${tr("Not set up yet")}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {!filtered.length && (
            <Text style={s.hint}>{tr("No dishes match your search.")}</Text>
          )}
          {filtered.length > 30 && (
            <View
              style={[
                s.row,
                { justifyContent: "space-between", marginTop: 12 },
              ]}
            >
              <InvButton
                secondary
                disabled={page === 0}
                onPress={() => setPage(page - 1)}
              >
                {tr("Previous")}
              </InvButton>
              <Text style={s.hint}>
                {page + 1} / {Math.ceil(filtered.length / 30)}
              </Text>
              <InvButton
                secondary
                disabled={(page + 1) * 30 >= filtered.length}
                onPress={() => setPage(page + 1)}
              >
                {tr("Next")}
              </InvButton>
            </View>
          )}
          <InvButton
            disabled={!selected.length}
            onPress={() => {
              setStep(1);
              setError("");
            }}
          >
            {tr("Next: add ingredients ({count} dishes)", {
              count: selected.length,
            })}
          </InvButton>
        </>
      )}
      {step === 1 && (
        <>
          <Text style={s.title}>
            {tr("Ingredients for {count} dishes", { count: selected.length })}
          </Text>
          <Text style={s.hint}>
            {tr(
              "Enter the amount for one serving. You can change it for each dish next.",
            )}
          </Text>
          <IngredientEditor
            stock={stock}
            preparations={preparations}
            value={ingredients}
            onChange={(v) => {
              setIngredients(v);
              setOverrides({});
              changed();
            }}
          />
          <Details
            title={
              mode === "replace"
                ? tr("Replace existing recipes (selected)")
                : tr("Existing recipes: keep other ingredients")
            }
          >
            <InvChoice
              label={tr("When saving")}
              value={mode}
              onChange={(v) => {
                setMode(v);
                changed();
              }}
              options={[
                { id: "merge", name: tr("Keep other ingredients") },
                { id: "replace", name: tr("Replace entire recipes") },
              ]}
            />
            <Text style={mode === "replace" ? s.error : s.hint}>
              {mode === "replace"
                ? tr(
                    "This removes all other ingredients from these dishes. Check the changes before saving.",
                  )
                : tr(
                    "Only these ingredients are added or updated. Other ingredients stay as they are.",
                  )}
            </Text>
          </Details>
          <InvButton
            disabled={busy || !ingredients.length || !quantitiesValid}
            onPress={() => submit(true)}
          >
            {busy ? tr("Preparing changes...") : tr("Next: check quantities")}
          </InvButton>
          <InvButton secondary disabled={busy} onPress={() => setStep(0)}>
            {tr("Back to dishes")}
          </InvButton>
        </>
      )}
      {step === 2 && (
        <>
          <Text style={s.title}>{tr("Check quantities, then save")}</Text>
          <Text style={s.hint}>
            {tr(
              "Amounts are per serving. Tap an amount to change it for that dish.",
            )}
          </Text>
          {mode === "replace" && (
            <Text style={s.error}>
              {tr(
                "Replacing entire recipes. Other ingredients will be removed.",
              )}
            </Text>
          )}
          {selected.map((id) => {
            const result = preview?.results.find((r) => r.menu_item_id === id);
            return (
              <View key={id} style={s.card}>
                <Text style={[s.label, { fontSize: 17 }]}>
                  {menu.find((m) => m.id === id)?.name}
                </Text>
                {ingredients.map((row) => (
                  <View
                    key={ingredientKey(row)}
                    style={[s.row, { marginVertical: 6, flexWrap: "nowrap" }]}
                  >
                    <Text style={[s.choiceText, { flex: 1 }]}>
                      {ingredientName(row)}
                    </Text>
                    <TextInput
                      accessibilityLabel={`${menu.find((m) => m.id === id)?.name}: ${ingredientName(row)}`}
                      style={[s.input, { width: 92 }]}
                      keyboardType="decimal-pad"
                      value={String(
                        overrides[`${id}/${ingredientKey(row)}`] ??
                          row.quantity_required,
                      )}
                      onChangeText={(v) => {
                        setOverrides({
                          ...overrides,
                          [`${id}/${ingredientKey(row)}`]: v,
                        });
                        changed();
                      }}
                    />
                    <Text style={[s.smallHint, { width: 30 }]}>
                      {row.unit === "gm"
                        ? "g"
                        : row.unit === "litre"
                          ? "L"
                          : row.unit}
                    </Text>
                  </View>
                ))}
                {result && (
                  <Details title={tr("See recipe changes")}>
                    <Text style={s.hint}>
                      {tr("Before")}
                      {"\n"}
                      {recipeDescription(result.before)}
                      {"\n\n"}
                      {tr("After")}
                      {"\n"}
                      {recipeDescription(result.after)}
                    </Text>
                  </Details>
                )}
              </View>
            );
          })}
          {!preview && (
            <Text style={s.hint}>
              {tr(
                "Quantities changed. Review the updated recipes before saving.",
              )}
            </Text>
          )}
          <InvButton
            disabled={busy || !quantitiesValid}
            onPress={() => submit(!preview)}
          >
            {busy
              ? tr("Working...")
              : preview
                ? tr("Save {count} dish recipes", { count: selected.length })
                : tr("Review updated recipes")}
          </InvButton>
          <InvButton secondary disabled={busy} onPress={() => setStep(1)}>
            {tr("Back to ingredients")}
          </InvButton>
        </>
      )}
      {!!message && (
        <Text accessibilityRole="alert" style={s.success}>
          {tr(message, messageValues)}
        </Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {tr(error)}
        </Text>
      )}
    </View>
  );
}
function History({ onChanged }) {
  const tr = useLocalizeText();
  const [scans, setScans] = useState([]),
    [logs, setLogs] = useState([]),
    [detail, setDetail] = useState(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [offset, setOffset] = useState(0);
  async function load(nextOffset = 0) {
    setBusy(true);
    setError("");
    try {
      const [a, b] = await Promise.all([
        API.get("/inventory/scans"),
        API.get(`/inventory/history?offset=${nextOffset}`),
      ]);
      setScans(a.data);
      setLogs(b.data);
      setOffset(nextOffset);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function open(id) {
    setBusy(true);
    setError("");
    try {
      setDetail((await API.get(`/inventory/scans/${id}`)).data);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View>
      <Text style={s.title}>{tr("Count & stock history")}</Text>
      <InvButton secondary disabled={busy} onPress={() => load(offset)}>
        {tr("Refresh history")}
      </InvButton>
      {busy && <ActivityIndicator />}
      {detail ? (
        <>
          <InvButton secondary onPress={() => setDetail(null)}>
            {tr("Back to history")}
          </InvButton>
          {detail.counts.length ? (
            <CountReview
              scan={detail}
              onUpdated={(s) => {
                setDetail(s);
                load(offset);
              }}
              onChanged={onChanged}
            />
          ) : (
            <Text style={s.hint}>
              {tr("Status:")} {scanStatusLabel(detail.status, tr)}.{" "}
              {tr(
                detail.error ||
                  "This scan has not been confirmed. Re-upload the same photo to resume review.",
              )}
            </Text>
          )}
        </>
      ) : (
        <>
          <Text style={s.label}>{tr("Recent scans")}</Text>
          {!scans.length && (
            <Text style={s.hint}>{tr("No scans recorded.")}</Text>
          )}
          {scans.map((scan) => (
            <InvButton secondary key={scan.id} onPress={() => open(scan.id)}>
              {new Date(scan.created_at).toLocaleString()} ·{" "}
              {scanStatusLabel(scan.status, tr)} ·{" "}
              {tr("{count} product groups", { count: scan.detections.length })}
            </InvButton>
          ))}
          <Text style={[s.label, { marginTop: 22 }]}>
            {tr("Inventory movements")}
          </Text>
          {!logs.length && (
            <Text style={s.hint}>{tr("No movements on this page.")}</Text>
          )}
          {logs.map((log) => (
            <View key={log.id} style={s.card}>
              <Text style={s.label}>
                {log.name || tr("Stock item")} ·{" "}
                {Number(log.change_amount) > 0 ? "+" : ""}
                {Number(log.change_amount)} {log.unit}
              </Text>
              <Text style={s.hint}>
                {tr(log.reason)} · {new Date(log.created_at).toLocaleString()}
                {log.order_id
                  ? `\n${tr("Order: {id}", { id: log.order_id })}`
                  : ""}
                {log.menu_item_id
                  ? `\n${tr("Menu item: {id}", { id: log.menu_item_id })}`
                  : ""}
                {log.actor ? `\n${tr("By: {name}", { name: log.actor })}` : ""}
                {log.note ? `\n${log.note}` : ""}
              </Text>
            </View>
          ))}
          <View style={s.row}>
            <InvButton
              secondary
              disabled={busy || !offset}
              onPress={() => load(offset - 50)}
            >
              {tr("Previous movements")}
            </InvButton>
            <InvButton
              secondary
              disabled={busy || logs.length < 50}
              onPress={() => load(offset + 50)}
            >
              {tr("Next movements")}
            </InvButton>
          </View>
        </>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {tr(error)}
        </Text>
      )}
    </View>
  );
}
