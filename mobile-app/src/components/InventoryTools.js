import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import API from "../api";
import {
  IngredientEditor,
  InvButton,
  InvField,
  InvChoice,
  ingredientKey,
  inventoryStyles as s,
} from "./InventoryRecipeEditor";

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
}) {
  const [tab, setTab] = useState(initialTab),
    [preparations, setPreparations] = useState([]),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState("");
  async function load() {
    setLoading(true);
    setLoadError("");
    try {
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
          <Text style={[s.title, { flex: 1 }]}>Inventory tools</Text>
          <InvButton secondary onPress={onClose}>
            Close
          </InvButton>
        </View>
        <View style={s.row}>
          {[
            ["scan", "Scan Inventory"],
            ["preparations", "Preparations"],
            ["bulk", "Bulk Recipes"],
            ["history", "Count & Stock History"],
          ].map(([id, label]) => (
            <InvButton
              secondary={tab !== id}
              key={id}
              onPress={() => setTab(id)}
            >
              {label}
            </InvButton>
          ))}
        </View>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        {loading ? (
          <ActivityIndicator />
        ) : loadError ? (
          <View>
            <Text style={s.error}>{loadError}</Text>
            <InvButton onPress={load}>Retry</InvButton>
          </View>
        ) : (
          <>
            {tab === "scan" && <Scanner stock={stock} onChanged={onChanged} />}
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
              />
            )}
            {tab === "history" && <History onChanged={onChanged} />}
          </>
        )}
      </ScrollView>
    </View>
  );
}
function Scanner({ stock, onChanged }) {
  const [target, setTarget] = useState("all"),
    [photo, setPhoto] = useState(null),
    [scan, setScan] = useState(null),
    [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function choose(camera = false) {
    setError("");
    try {
      let result;
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted)
          throw new Error(
            "Camera permission is needed. You can upload a photo instead.",
          );
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.85,
        });
      } else
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.85,
        });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.fileSize > 5 * 1024 * 1024)
        throw new Error("Choose a photo smaller than 5 MB.");
      setPhoto(asset);
      setScan(null);
      setRows([]);
      setMessage("");
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function analyze() {
    setBusy(true);
    setError("");
    try {
      const data = new FormData();
      if (Platform.OS === "web") {
        const blob = photo.file || (await (await fetch(photo.uri)).blob());
        data.append("image", blob, photo.fileName || "inventory.jpg");
      } else
        data.append("image", {
          uri: photo.uri,
          name: photo.fileName || "inventory.jpg",
          type: photo.mimeType || "image/jpeg",
        });
      if (target !== "all") data.append("inventory_item_id", String(target));
      const result = (
        await API.post("/inventory/scans", data, {
          timeout: 65000,
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data;
      setScan(result);
      setRows(
        result.detections.map((d, index) => {
          const match = stock.find((s) => s.id === d.inventory_item_id);
          return {
            ...d,
            key: index,
            inventory_item_id: d.inventory_item_id || "",
            full_bottles: String(d.count),
            opened_ml: "0",
            bottle_size_ml: match?.bottle_size
              ? String(
                  Number(match.bottle_size) *
                    (match.unit === "litre" ? 1000 : 1),
                )
              : "",
            include: true,
          };
        }),
      );
      if (["confirmed", "reconciled"].includes(result.status))
        setScan((await API.get(`/inventory/scans/${result.id}`)).data);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function patch(index, change) {
    setRows(rows.map((r, i) => (i === index ? { ...r, ...change } : r)));
  }
  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const included = rows.filter((r) => r.include);
      if (!included.length) throw new Error("Include at least one product.");
      if (included.some((r) => !r.inventory_item_id))
        throw new Error(
          "Map every included product to existing stock, or exclude it.",
        );
      const counts = included.map((r) => ({
        inventory_item_id: r.inventory_item_id,
        full_bottles: r.full_bottles,
        opened_ml: r.opened_ml,
        bottle_size_ml: r.bottle_size_ml,
      }));
      const result = (
        await API.post(`/inventory/scans/${scan.id}/confirm`, { counts })
      ).data;
      setScan(result);
      setMessage("Physical count saved. Expected stock is unchanged.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View>
      <Text style={s.title}>Scan Inventory</Text>
      <Text style={s.hint}>
        Photograph visible sealed bottles or packaged products. AI counts can be
        wrong: check every match and count before confirming. Opened liquid is
        entered manually.
      </Text>
      <InvChoice
        label="Catalogue to identify"
        value={target}
        options={[{ id: "all", name: "All existing stock items" }, ...stock]}
        onChange={setTarget}
      />
      <View style={s.row}>
        <InvButton secondary onPress={() => choose(false)} disabled={busy}>
          Upload photograph
        </InvButton>
        {Platform.OS !== "web" && (
          <InvButton secondary onPress={() => choose(true)} disabled={busy}>
            Open camera
          </InvButton>
        )}
      </View>
      {Platform.OS === "web" && (
        <Text style={s.hint}>
          On a phone, the upload chooser may offer your camera.
        </Text>
      )}
      {photo && (
        <Image
          accessibilityLabel="Inventory photograph"
          source={{ uri: photo.uri }}
          style={{
            height: 210,
            width: "100%",
            borderRadius: 14,
            marginVertical: 10,
            resizeMode: "contain",
          }}
        />
      )}
      <InvButton disabled={!photo || busy} onPress={analyze}>
        {busy ? "Working…" : "Analyze photograph"}
      </InvButton>
      {scan?.status === "review" && (
        <View>
          <Text style={[s.title, { marginTop: 16 }]}>
            Review detected products
          </Text>
          <Text style={s.hint}>
            Counts must cover the whole stock pool for each included item.
            Combine duplicate product groups into one row. Exclude uncounted
            products; they are never treated as zero.
          </Text>
          {!rows.length && (
            <Text style={s.hint}>
              No recognizable products detected. Take a clearer photograph or
              add a count below.
            </Text>
          )}
          {rows.map((r, index) => {
            const item = stock.find(
              (x) => String(x.id) === String(r.inventory_item_id),
            );
            const allowed = stock.filter((x) =>
              ["ml", "litre", "pcs"].includes(x.unit),
            );
            const total =
              item && r.bottle_size_ml !== ""
                ? Number(r.full_bottles) * Number(r.bottle_size_ml) +
                  Number(r.opened_ml)
                : null;
            return (
              <View
                key={r.key}
                style={[s.card, !r.include && { opacity: 0.55 }]}
              >
                <Text style={s.label}>{r.label}</Text>
                <Text style={s.hint}>
                  {Math.round(r.confidence * 100)}% model confidence ·{" "}
                  {r.confidence < 0.8
                    ? "Uncertain—map manually"
                    : "Check product and package size"}
                  {r.note ? `\n${r.note}` : ""}
                </Text>
                <InvButton
                  secondary
                  onPress={() => patch(index, { include: !r.include })}
                >
                  {r.include
                    ? "Exclude this detection"
                    : "Include this detection"}
                </InvButton>
                {r.include && (
                  <>
                    <InvChoice
                      label="Match existing stock"
                      options={allowed}
                      value={r.inventory_item_id}
                      onChange={(id) => {
                        const x = stock.find((s) => s.id === id);
                        patch(index, {
                          inventory_item_id: id,
                          bottle_size_ml: x.bottle_size
                            ? String(
                                Number(x.bottle_size) *
                                  (x.unit === "litre" ? 1000 : 1),
                              )
                            : "",
                          opened_ml: "0",
                        });
                      }}
                    />
                    <InvField
                      numeric
                      label={
                        item?.unit === "pcs"
                          ? "Visible pieces / sealed bottles"
                          : "Full sealed bottles"
                      }
                      value={r.full_bottles}
                      onChangeText={(v) => patch(index, { full_bottles: v })}
                    />
                    {["ml", "litre"].includes(item?.unit) && (
                      <>
                        <InvField
                          numeric
                          label="One full bottle (ml)"
                          value={r.bottle_size_ml}
                          onChangeText={(v) =>
                            patch(index, { bottle_size_ml: v })
                          }
                        />
                        <InvField
                          numeric
                          label="Remaining opened stock (ml, manual entry)"
                          value={r.opened_ml}
                          onChangeText={(v) => patch(index, { opened_ml: v })}
                        />
                        <Text style={s.hint}>
                          Total: {total ?? "—"} ml
                          {item.unit === "litre" && total !== null
                            ? ` = ${total / 1000} litres`
                            : ""}
                          . Opened stock is excluded from full-bottle count.
                        </Text>
                      </>
                    )}
                  </>
                )}
              </View>
            );
          })}
          <InvButton
            secondary
            onPress={() =>
              setRows([
                ...rows,
                {
                  key: keyFor(),
                  label: "Manual product",
                  confidence: 0,
                  inventory_item_id: "",
                  full_bottles: "0",
                  opened_ml: "0",
                  bottle_size_ml: "",
                  include: true,
                },
              ])
            }
          >
            Add missing product count
          </InvButton>
          <InvButton disabled={busy} onPress={confirm}>
            Confirm reviewed physical count
          </InvButton>
        </View>
      )}
      {scan?.counts && (
        <CountReview scan={scan} onUpdated={setScan} onChanged={onChanged} />
      )}
      {!!message && <Text style={s.success}>{message}</Text>}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
function CountReview({ scan, onUpdated, onChanged }) {
  const [note, setNote] = useState(""),
    [reviewing, setReviewing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function reconcile() {
    setBusy(true);
    setError("");
    try {
      const result = (
        await API.post(`/inventory/scans/${scan.id}/reconcile`, { note })
      ).data;
      onUpdated(result);
      setReviewing(false);
      await onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View>
      <Text style={[s.title, { marginTop: 16 }]}>
        Physical count · {scan.status}
      </Text>
      <Text style={s.hint}>
        Confirmed{" "}
        {scan.confirmed_at ? new Date(scan.confirmed_at).toLocaleString() : ""}{" "}
        by {scan.confirmed_by}
      </Text>
      {scan.counts.map((c) => (
        <View key={c.id} style={s.card}>
          <Text style={s.label}>{c.name}</Text>
          <Text style={s.hint}>
            Expected at scan: {Number(c.expected_stock)} {c.unit}
            {"\n"}Confirmed physical: {Number(c.physical_stock)} {c.unit}
            {"\n"}Variance: {Number(c.variance) > 0 ? "+" : ""}
            {Number(c.variance)} {c.unit}
            {"\n"}Current expected: {Number(c.current_stock)} {c.unit}
          </Text>
          {c.reconciled_at && (
            <Text style={s.hint}>
              Reconciled {new Date(c.reconciled_at).toLocaleString()} ·{" "}
              {c.reconciliation_note}
            </Text>
          )}
        </View>
      ))}
      {scan.status === "confirmed" && (
        <>
          <Text style={s.hint}>
            Reconciliation applies the recorded variance to current expected
            stock, preserving later orders and restocks. Owner permission is
            required.
          </Text>
          <InvField
            label="Reason for stock adjustment"
            value={note}
            onChangeText={(v) => {
              setNote(v);
              setReviewing(false);
            }}
          />
          {reviewing ? (
            <View style={s.card}>
              <Text style={s.label}>Apply these variances to inventory?</Text>
              <Text style={s.hint}>
                This creates permanent adjustment entries. Reason: {note}
              </Text>
              <InvButton disabled={busy} onPress={reconcile}>
                {busy ? "Applying…" : "Confirm stock adjustment"}
              </InvButton>
              <InvButton
                secondary
                disabled={busy}
                onPress={() => setReviewing(false)}
              >
                Keep count without adjustment
              </InvButton>
            </View>
          ) : (
            <InvButton
              disabled={!note.trim()}
              onPress={() => setReviewing(true)}
            >
              Review reconciliation
            </InvButton>
          )}
        </>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
function Preparations({ stock, preparations, onChanged }) {
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
      <Text style={s.title}>Shared preparations</Text>
      <Text style={s.hint}>
        Define each gravy, paste or marinade once. Servon calculates raw
        ingredient use when a dish is sold. These definitions do not maintain
        separate prepared stock or deduct a batch in advance. Use separate names
        for vegetarian and non-vegetarian preparations when needed.
      </Text>
      {!draft ? (
        <>
          <InvButton onPress={() => edit()}>Create preparation</InvButton>
          {!preparations.length && (
            <Text style={s.hint}>No shared preparations yet.</Text>
          )}
          {preparations.map((p) => (
            <View key={p.id} style={s.card}>
              <Text style={s.label}>{p.name}</Text>
              <Text style={s.hint}>
                {Number(p.yield_quantity)} {p.yield_unit} per batch ·{" "}
                {Number(p.wastage_percent)}% wastage · version {p.version}
              </Text>
              <InvButton secondary onPress={() => edit(p)}>
                Edit recipe
              </InvButton>
            </View>
          ))}
        </>
      ) : (
        <View style={s.card}>
          <InvField
            label="Preparation name"
            value={draft.name}
            onChangeText={(v) => setDraft({ ...draft, name: v })}
          />
          <InvField
            numeric
            label="Expected batch yield before wastage"
            value={draft.yield_quantity}
            onChangeText={(v) => setDraft({ ...draft, yield_quantity: v })}
          />
          <Text style={s.label}>Yield unit</Text>
          <View style={s.row}>
            {["kg", "gm", "litre", "ml", "pcs"].map((u) => (
              <InvButton
                disabled={!!draft.id && draft.yield_unit !== u}
                key={u}
                secondary={draft.yield_unit !== u}
                onPress={() => setDraft({ ...draft, yield_unit: u })}
              >
                {u}
              </InvButton>
            ))}
          </View>
          <InvField
            numeric
            label="Optional yield loss (%)"
            value={draft.wastage_percent}
            onChangeText={(v) => setDraft({ ...draft, wastage_percent: v })}
          />
          <Text style={s.hint}>
            Usable yield:{" "}
            {(
              Number(draft.yield_quantity) *
              (1 - Number(draft.wastage_percent) / 100)
            ).toFixed(3)}{" "}
            {draft.yield_unit}. Ingredient quantities below describe one full
            batch.
          </Text>
          <IngredientEditor
            stock={stock}
            preparations={preparations}
            excludePreparation={draft.id}
            value={draft.ingredients}
            onChange={(ingredients) => setDraft({ ...draft, ingredients })}
          />
          <InvButton disabled={busy} onPress={save}>
            {busy ? "Saving…" : "Save preparation"}
          </InvButton>
          <InvButton secondary disabled={busy} onPress={() => setDraft(null)}>
            Cancel
          </InvButton>
          {draft.id && (
            <InvButton
              secondary
              disabled={busy}
              onPress={() => (archive ? archivePrep() : setArchive(true))}
            >
              {archive ? "Confirm archive preparation" : "Archive preparation"}
            </InvButton>
          )}
        </View>
      )}
      {!!message && <Text style={s.success}>{message}</Text>}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
function BulkRecipes({ stock, preparations, menu, onChanged }) {
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
          `${ingredientName(row) || "ingredient"}: ${Number(row.quantity_required)} ${row.unit || (row.preparation_id ? preparations.find((p) => p.id === row.preparation_id)?.yield_unit : stock.find((s) => s.id === row.inventory_item_id)?.unit)}`,
      )
      .join("\n") || "No ingredients";
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
      if (isPreview) setPreview(result);
      else {
        setPreview(null);
        setSelected([]);
        setOverrides({});
        setMessage(`${result.results.length} dish recipes saved successfully.`);
        await onChanged();
      }
    } catch (e) {
      setError(errorText(e));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View>
      <Text style={s.title}>Bulk recipe setup</Text>
      <Text style={s.hint}>
        Select dishes, add common ingredients, then edit quantities per dish.
        Defaults are suggestions; verify each recipe.
      </Text>
      <InvField
        label="Search dishes"
        value={search}
        onChangeText={(v) => {
          setSearch(v);
          setPage(0);
        }}
      />
      <InvChoice
        label="Menu category"
        value={category}
        options={[
          { id: "all", name: "All categories" },
          ...[...new Set(menu.map((m) => m.category).filter(Boolean))].map(
            (c) => ({ id: c, name: c }),
          ),
        ]}
        onChange={(v) => {
          setCategory(v);
          setPage(0);
        }}
      />
      <View style={s.row}>
        {[
          ["all", "All recipes"],
          ["configured", "Configured"],
          ["missing", "Unconfigured"],
        ].map(([id, label]) => (
          <InvButton
            key={id}
            secondary={filter !== id}
            onPress={() => {
              setFilter(id);
              setPage(0);
            }}
          >
            {label}
          </InvButton>
        ))}
      </View>
      <View style={s.row}>
        <InvButton
          secondary
          disabled={busy || filtered.length > 250}
          onPress={() => {
            setSelected(filtered.map((m) => m.id));
            changed();
          }}
        >
          Select all {filtered.length} filtered dishes
        </InvButton>
        <InvButton
          secondary
          disabled={busy}
          onPress={() => {
            setSelected([]);
            changed();
          }}
        >
          Clear selection
        </InvButton>
      </View>
      {filtered.length > 250 && (
        <Text style={s.hint}>
          Narrow your search to 250 dishes or fewer to select all.
        </Text>
      )}
      <Text style={s.hint}>{selected.length} dishes selected</Text>
      {displayed.map((m) => (
        <InvButton
          disabled={busy}
          key={m.id}
          secondary={!selected.includes(m.id)}
          onPress={() => {
            setSelected(
              selected.includes(m.id)
                ? selected.filter((id) => id !== m.id)
                : [...selected, m.id],
            );
            changed();
          }}
        >
          {selected.includes(m.id) ? "✓ " : ""}
          {m.name} ·{" "}
          {m.ingredient_count
            ? `${m.ingredient_count} ingredients configured`
            : "Recipe unconfigured"}
        </InvButton>
      ))}
      <View style={s.row}>
        <InvButton
          secondary
          disabled={page === 0}
          onPress={() => setPage(page - 1)}
        >
          Previous
        </InvButton>
        <Text>
          {page + 1} / {Math.max(1, Math.ceil(filtered.length / 30))}
        </Text>
        <InvButton
          secondary
          disabled={(page + 1) * 30 >= filtered.length}
          onPress={() => setPage(page + 1)}
        >
          Next
        </InvButton>
      </View>
      <Text style={[s.title, { marginTop: 22 }]}>Common ingredients</Text>
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
      <View style={s.row}>
        <InvButton
          secondary={mode !== "merge"}
          onPress={() => {
            setMode("merge");
            changed();
          }}
        >
          Add / update selected ingredients
        </InvButton>
        <InvButton
          secondary={mode !== "replace"}
          onPress={() => {
            setMode("replace");
            changed();
          }}
        >
          Replace entire recipes
        </InvButton>
      </View>
      <Text style={mode === "replace" ? s.error : s.hint}>
        {mode === "replace"
          ? "Replacement removes every unrelated ingredient from the selected recipes. Review the before and after lists carefully."
          : "Adding preserves unrelated ingredients and updates matching ingredient quantities."}
      </Text>
      {selected.length > 0 && ingredients.length > 0 && (
        <>
          <Text style={[s.title, { marginTop: 18 }]}>Per-dish quantities</Text>
          {selected.map((id) => (
            <View key={id} style={s.card}>
              <Text style={s.label}>{menu.find((m) => m.id === id)?.name}</Text>
              {ingredients.map((row) => (
                <InvField
                  key={ingredientKey(row)}
                  numeric
                  label={`${ingredientName(row)} (${row.unit})`}
                  value={
                    overrides[`${id}/${ingredientKey(row)}`] ??
                    row.quantity_required
                  }
                  onChangeText={(v) => {
                    setOverrides({
                      ...overrides,
                      [`${id}/${ingredientKey(row)}`]: v,
                    });
                    changed();
                  }}
                />
              ))}
            </View>
          ))}
        </>
      )}
      <InvButton
        disabled={busy || !selected.length || !ingredients.length}
        onPress={() => submit(true)}
      >
        {busy ? "Working…" : "Preview all recipe changes"}
      </InvButton>
      {preview && (
        <View>
          <Text style={s.title}>Review {preview.results.length} changes</Text>
          {preview.results.map((r) => (
            <View style={s.card} key={r.menu_item_id}>
              <Text style={s.label}>
                {menu.find((m) => m.id === r.menu_item_id)?.name}
              </Text>
              <Text style={s.hint}>
                Before{"\n"}
                {recipeDescription(r.before)}
                {"\n\n"}After{"\n"}
                {recipeDescription(r.after)}
              </Text>
            </View>
          ))}
          <InvButton disabled={busy} onPress={() => submit(false)}>
            {mode === "replace"
              ? "Confirm replacement of selected recipes"
              : "Confirm and apply all changes"}
          </InvButton>
        </View>
      )}
      {!!message && <Text style={s.success}>{message}</Text>}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
function History({ onChanged }) {
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
      <Text style={s.title}>Count & stock history</Text>
      <InvButton secondary disabled={busy} onPress={() => load(offset)}>
        Refresh history
      </InvButton>
      {busy && <ActivityIndicator />}
      {detail ? (
        <>
          <InvButton secondary onPress={() => setDetail(null)}>
            Back to history
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
              Status: {detail.status}.{" "}
              {detail.error ||
                "This scan has not been confirmed. Re-upload the same photo to resume review."}
            </Text>
          )}
        </>
      ) : (
        <>
          <Text style={s.label}>Recent scans</Text>
          {!scans.length && <Text style={s.hint}>No scans recorded.</Text>}
          {scans.map((scan) => (
            <InvButton secondary key={scan.id} onPress={() => open(scan.id)}>
              {new Date(scan.created_at).toLocaleString()} · {scan.status} ·{" "}
              {scan.detections.length} product groups
            </InvButton>
          ))}
          <Text style={[s.label, { marginTop: 22 }]}>Inventory movements</Text>
          {!logs.length && (
            <Text style={s.hint}>No movements on this page.</Text>
          )}
          {logs.map((log) => (
            <View key={log.id} style={s.card}>
              <Text style={s.label}>
                {log.name || "Stock item"} ·{" "}
                {Number(log.change_amount) > 0 ? "+" : ""}
                {Number(log.change_amount)} {log.unit}
              </Text>
              <Text style={s.hint}>
                {log.reason} · {new Date(log.created_at).toLocaleString()}
                {log.order_id ? `\nOrder: ${log.order_id}` : ""}
                {log.menu_item_id ? `\nMenu item: ${log.menu_item_id}` : ""}
                {log.actor ? `\nBy: ${log.actor}` : ""}
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
              Previous movements
            </InvButton>
            <InvButton
              secondary
              disabled={busy || logs.length < 50}
              onPress={() => load(offset + 50)}
            >
              Next movements
            </InvButton>
          </View>
        </>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
