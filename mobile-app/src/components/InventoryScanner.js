import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import InventoryCamera from "./InventoryCamera";
import API from "../api";
import { MenuLinkPicker } from "./InventoryMenuLinks";
import {
  chosenLinks,
  initialMenuSelection,
  groupMenu,
} from "../utils/inventoryMenuMatching";
import { useLocalizeText } from "./LocalizedText";
import {
  InvButton,
  InvChoice,
  InvField,
  inventoryStyles as s,
} from "./InventoryRecipeEditor";

const errorText = (error) =>
  error.response?.data?.error ||
  error.message ||
  "Request failed. Please retry.";
const sessionKey = () =>
  `scan-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const volumeUnit = (unit) => ["ml", "litre"].includes(unit);
const display = (value, unit, tr) =>
  `${Number(Number(value).toFixed(3))} ${unit === "pcs" ? tr("Pieces") : unit}`;
const summaryStyle = {
  backgroundColor: "#EEF5EF",
  padding: 14,
  borderRadius: 12,
  marginTop: 12,
};

function More({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginTop: 10 }}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={[s.row, { minHeight: 44 }]}
      >
        <Text
          style={{ flex: 1, fontSize: 13, fontWeight: "600", color: "#62766A" }}
        >
          {title}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color="#62766A"
        />
      </TouchableOpacity>
      {open && children}
    </View>
  );
}

function Counter({ value, onChange, unit, tr }) {
  const amount = Number(value);
  return (
    <View style={{ marginVertical: 8 }}>
      <Text style={s.label}>
        {unit === "pcs" ? tr("Pieces") : tr("Bottles")}
      </Text>
      <View
        style={[
          s.row,
          {
            flexWrap: "nowrap",
            backgroundColor: "#F6F8F5",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#DFE6DC",
            padding: 4,
          },
        ]}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={tr("Decrease count")}
          onPress={() =>
            onChange(
              String(Math.max(0, (Number.isFinite(amount) ? amount : 0) - 1)),
            )
          }
          style={{ padding: 12 }}
        >
          <Ionicons name="remove" size={24} color="#38684B" />
        </TouchableOpacity>
        <TextInput
          accessibilityLabel={tr("Number counted")}
          style={{
            flex: 1,
            minWidth: 60,
            textAlign: "center",
            fontSize: 25,
            fontWeight: "700",
            color: "#173D2D",
            padding: 8,
          }}
          keyboardType="number-pad"
          value={value}
          onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ""))}
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={tr("Increase count")}
          onPress={() =>
            onChange(String((Number.isFinite(amount) ? amount : 0) + 1))
          }
          style={{ padding: 12 }}
        >
          <Ionicons name="add" size={24} color="#38684B" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Product({ row, stock, menu, onChange, onOpenMenu, disabled, tr }) {
  const isNew = row.inventory_item_id === "new";
  const item = stock.find(
    (record) => String(record.id) === String(row.inventory_item_id),
  );
  const unit = isNew ? row.new_unit : item?.unit;
  const hasVolume = volumeUnit(unit);
  const bottles = Number(row.full_bottles),
    size = Number(row.bottle_size_ml),
    opened = Number(row.opened_ml || 0);
  const ready =
    row.full_bottles !== "" &&
    Number.isInteger(bottles) &&
    bottles >= 0 &&
    (!hasVolume || (size > 0 && opened >= 0 && opened < size));
  const totalMl = bottles * size + opened;
  const productName = isNew ? row.new_name : item?.name || row.label;
  return (
    <View
      style={[s.card, { padding: 16 }, !row.include && { opacity: 0.5 }]}
      pointerEvents={disabled ? "none" : "auto"}
    >
      <View style={[s.row, { flexWrap: "nowrap" }]}>
        <View style={{ flex: 1 }}>
          <Text
            style={[s.label, { fontSize: 16, lineHeight: 22, marginBottom: 3 }]}
          >
            {productName || tr("New product")}
          </Text>
          <Text style={s.smallHint}>
            {isNew ? tr("New item") : tr("Already in your stock")}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="checkbox"
          accessibilityLabel={tr("Include {name}", {
            name: productName || tr("New product"),
          })}
          accessibilityState={{ checked: row.include }}
          onPress={() => onChange({ include: !row.include })}
          style={{ padding: 10 }}
        >
          <Ionicons
            name={row.include ? "checkbox" : "square-outline"}
            size={25}
            color="#327450"
          />
        </TouchableOpacity>
      </View>
      {row.include && (
        <>
          <InvChoice
            label={tr("Save to")}
            value={row.inventory_item_id}
            options={[
              { id: "new", name: tr("New stock item") },
              ...stock
                .filter((record) =>
                  ["pcs", "ml", "litre"].includes(record.unit),
                )
                .map((record) => ({
                  ...record,
                  name: `${record.name} · ${record.unit === "pcs" ? tr("Pieces") : record.unit}`,
                })),
            ]}
            onChange={(id) => {
              const match = stock.find(
                (record) => String(record.id) === String(id),
              );
              onChange({
                inventory_item_id: id,
                ...initialMenuSelection(menu, id === "new" ? null : id),
                bottle_size_ml: match?.bottle_size
                  ? String(
                      Number(match.bottle_size) *
                        (match.unit === "litre" ? 1000 : 1),
                    )
                  : row.bottle_size_ml,
                opened_ml: "0",
              });
            }}
          />

          {isNew && (
            <View style={[s.row, { marginTop: 10, marginBottom: 4 }]}>
              {[
                ["ml", "Bottles"],
                ["pcs", "Pieces"],
              ].map(([value, label]) => (
                <TouchableOpacity
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: value === "pcs" ? !hasVolume : hasVolume,
                  }}
                  onPress={() => onChange({ new_unit: value, opened_ml: "0" })}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 17,
                    borderRadius: 9,
                    backgroundColor: (value === "pcs" ? !hasVolume : hasVolume)
                      ? "#E4EFE4"
                      : "#F5F7F3",
                    borderWidth: 1,
                    borderColor: (value === "pcs" ? !hasVolume : hasVolume)
                      ? "#5E956C"
                      : "#E0E7DB",
                  }}
                >
                  <Text
                    style={{
                      color: "#38664A",
                      fontSize: 13,
                      fontWeight: "600",
                    }}
                  >
                    {tr(label)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <Counter
            value={row.full_bottles}
            onChange={(value) => onChange({ full_bottles: value })}
            unit={unit}
            tr={tr}
          />
          {hasVolume && (
            <View>
              <Text style={[s.label, { marginTop: 8 }]}>
                {tr("Bottle size (ml)")}
              </Text>
              <View style={[s.row, { gap: 6 }]}>
                {[180, 330, 650, 750, 1000].map((value) => (
                  <TouchableOpacity
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: size === value }}
                    onPress={() => onChange({ bottle_size_ml: String(value) })}
                    style={{
                      borderWidth: 1,
                      borderColor: size === value ? "#377B55" : "#DDE5DB",
                      backgroundColor: size === value ? "#EAF2E8" : "#fff",
                      borderRadius: 8,
                      paddingHorizontal: 11,
                      paddingVertical: 10,
                    }}
                  >
                    <Text style={{ color: "#38614A", fontSize: 12 }}>
                      {value}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                accessibilityLabel={tr("Bottle size (ml)")}
                style={[s.input, { marginTop: 8 }]}
                keyboardType="decimal-pad"
                value={row.bottle_size_ml}
                placeholder={tr("Or enter another size")}
                onChangeText={(value) => onChange({ bottle_size_ml: value })}
              />
            </View>
          )}
          <View style={summaryStyle}>
            <Text style={{ color: "#64796B", fontSize: 11 }}>
              {tr("Count total")}
            </Text>
            <Text
              style={{
                fontSize: 23,
                fontWeight: "700",
                color: "#1F593A",
                marginTop: 3,
              }}
            >
              {ready
                ? display(
                    hasVolume
                      ? totalMl / (unit === "litre" ? 1000 : 1)
                      : bottles,
                    unit,
                    tr,
                  )
                : tr("Choose a bottle size")}
            </Text>
            {ready && hasVolume && (
              <Text style={{ fontSize: 12, color: "#6F8272", marginTop: 3 }}>
                {bottles} × {size} ml{opened > 0 ? ` + ${opened} ml` : ""}
              </Text>
            )}
          </View>
          {row.confidence < 0.8 && !row.manual && (
            <Text style={[s.smallHint, { color: "#9A661B", marginTop: 9 }]}>
              {tr("Please check the product name.")}
            </Text>
          )}
          <MenuLinkPicker
            row={row}
            menu={menu}
            unit={unit}
            onChange={onChange}
            onOpenMenu={onOpenMenu}
          />
          <More title={tr("Edit details")}>
            {isNew && (
              <>
                <InvField
                  label={tr("Product name")}
                  value={row.new_name}
                  onChangeText={(value) => onChange({ new_name: value })}
                />
                <InvChoice
                  label={tr("Count in")}
                  value={row.new_unit}
                  options={[
                    { id: "ml", name: tr("Millilitres") },
                    { id: "litre", name: tr("Litres") },
                    { id: "pcs", name: tr("Bottles / pieces") },
                  ]}
                  onChange={(value) =>
                    onChange({ new_unit: value, opened_ml: "0" })
                  }
                />
              </>
            )}
            {hasVolume && (
              <InvField
                label={tr("Liquid in an opened bottle (ml)")}
                numeric
                value={row.opened_ml}
                onChangeText={(value) => onChange({ opened_ml: value })}
              />
            )}
            {!!row.note && <Text style={s.smallHint}>{row.note}</Text>}
            {!!item && (
              <Text style={s.smallHint}>
                {tr("In stock: {quantity}", {
                  quantity: display(item.current_stock, item.unit, tr),
                })}
              </Text>
            )}
          </More>
        </>
      )}
    </View>
  );
}

export default function Scanner({ stock, menu = [], onChanged, onOpenMenu }) {
  const tr = useLocalizeText();
  const [target, setTarget] = useState("all"),
    [photo, setPhoto] = useState(null),
    [scan, setScan] = useState(null),
    [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [cameraOpen, setCameraOpen] = useState(false);
  const [countOnly, setCountOnly] = useState(false),
    [note, setNote] = useState(""),
    [editingSaved, setEditingSaved] = useState(false);
  const session = useRef(sessionKey()),
    inFlight = useRef(false);
  const patch = (index, change) =>
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...change } : row)),
    );
  function acceptPhoto(asset) {
    if (asset.fileSize > 5 * 1024 * 1024)
      throw new Error("Choose a photo smaller than 5 MB.");
    session.current = sessionKey();
    setCameraOpen(false);
    setPhoto(asset);
    setScan(null);
    setRows([]);
    setEditingSaved(false);
    setError("");
    analyze(asset);
  }
  async function choose(camera = false) {
    if (busy) return;
    setError("");
    if (camera && Platform.OS === "web") {
      setCameraOpen(true);
      return;
    }
    try {
      if (
        camera &&
        !(await ImagePicker.requestCameraPermissionsAsync()).granted
      )
        throw new Error(
          "Camera permission is needed. You can upload a photo instead.",
        );
      const result = camera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 0.85,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.85,
          });
      if (!result.canceled) acceptPhoto(result.assets[0]);
    } catch (error) {
      setError(errorText(error));
    }
  }
  async function analyze(image = photo) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setEditingSaved(false);
    try {
      const data = new FormData();
      if (Platform.OS === "web")
        data.append(
          "image",
          image.file || (await (await fetch(image.uri)).blob()),
          image.fileName || "inventory.jpg",
        );
      else
        data.append("image", {
          uri: image.uri,
          name: image.fileName || "inventory.jpg",
          type: image.mimeType || "image/jpeg",
        });
      if (target !== "all") data.append("inventory_item_id", String(target));
      data.append("scan_session", session.current);
      let result = (
        await API.post("/inventory/scans", data, {
          timeout: 65000,
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data;
      if (["confirmed", "reconciled"].includes(result.status))
        result = (await API.get(`/inventory/scans/${result.id}`)).data;
      setScan(result);
      setRows(
        result.detections.map((d, index) => {
          const match = stock.find(
            (record) => String(record.id) === String(d.inventory_item_id),
          );
          const isBottle =
            d.product_type !== "package" || Boolean(d.bottle_size_ml);
          return {
            ...d,
            key: index,
            inventory_item_id: match?.id || "new",
            ...initialMenuSelection(menu, match?.id),
            new_name: d.label,
            new_unit: isBottle ? "ml" : "pcs",
            full_bottles: String(d.count),
            opened_ml: "0",
            bottle_size_ml: match?.bottle_size
              ? String(
                  Number(match.bottle_size) *
                    (match.unit === "litre" ? 1000 : 1),
                )
              : d.bottle_size_ml
                ? String(d.bottle_size_ml)
                : "",
            include: true,
          };
        }),
      );
    } catch (error) {
      setError(errorText(error));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function save() {
    if (inFlight.current) return;
    setError("");
    const included = rows.filter((row) => row.include);
    if (!included.length) {
      setError("Include at least one product.");
      return;
    }
    for (const row of included) {
      const item = stock.find(
        (record) => String(record.id) === String(row.inventory_item_id),
      );
      const unit = row.inventory_item_id === "new" ? row.new_unit : item?.unit;
      const links = chosenLinks(row, menu, unit);
      if (row.menu_mode !== "stock" && !links.length) {
        setError("Choose a menu item or save without a menu link.");
        return;
      }
      if (links.some((link) => !(Number(link.quantity_required) > 0))) {
        setError("Enter stock used per order for each selected menu item.");
        return;
      }
      if (
        !volumeUnit(unit) &&
        groupMenu(menu).some(
          (group) => group.liquor && (row.menu_groups || []).includes(group.id),
        ) &&
        row.menu_mode !== "stock"
      ) {
        setError("Use ml or litres stock for liquor servings");
        return;
      }
      if (row.inventory_item_id !== "new" && !item) {
        setError("Choose New stock item or select an existing item.");
        return;
      }
      if (row.inventory_item_id === "new" && !row.new_name?.trim()) {
        setError("Enter a product name in Edit details.");
        return;
      }
      if (
        row.full_bottles === "" ||
        !Number.isInteger(Number(row.full_bottles)) ||
        Number(row.full_bottles) < 0
      ) {
        setError("Enter a whole number of bottles or pieces.");
        return;
      }
      if (volumeUnit(unit) && !(Number(row.bottle_size_ml) > 0)) {
        setError("Choose a bottle size before saving.");
        return;
      }
      if (
        volumeUnit(unit) &&
        (!(Number(row.opened_ml || 0) >= 0) ||
          Number(row.opened_ml || 0) >= Number(row.bottle_size_ml))
      ) {
        setError("Opened liquid must be less than one full bottle.");
        return;
      }
    }
    const counts = included.map((row) => ({
      ...(row.inventory_item_id === "new"
        ? { new_item: { name: row.new_name.trim(), unit: row.new_unit } }
        : { inventory_item_id: row.inventory_item_id }),
      menu_links: chosenLinks(
        row,
        menu,
        row.inventory_item_id === "new"
          ? row.new_unit
          : stock.find(
              (record) => String(record.id) === String(row.inventory_item_id),
            )?.unit,
      ),
      full_bottles: row.full_bottles,
      opened_ml: row.opened_ml || "0",
      bottle_size_ml: row.bottle_size_ml,
    }));
    inFlight.current = true;
    setBusy(true);
    try {
      const result = (
        await API.post(`/inventory/scans/${scan.id}/confirm`, {
          counts,
          apply_stock: !countOnly,
          replace_counts: editingSaved,
          note: note.trim() || undefined,
        })
      ).data;
      setScan(result);
      setEditingSaved(false);
      await onChanged?.();
    } catch (error) {
      setError(errorText(error));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  function editCount() {
    setRows(
      scan.counts.map((count) => ({
        key: count.id,
        label: count.name,
        ...initialMenuSelection(menu, count.inventory_item_id),
        inventory_item_id: count.inventory_item_id,
        full_bottles:
          count.full_bottles == null
            ? String(
                volumeUnit(count.unit)
                  ? Math.floor(
                      (Number(count.physical_stock) *
                        (count.unit === "litre" ? 1000 : 1)) /
                        Number(count.bottle_size_ml || 1),
                    )
                  : Number(count.physical_stock),
              )
            : String(count.full_bottles),
        bottle_size_ml: count.bottle_size_ml
          ? String(count.bottle_size_ml)
          : "",
        opened_ml: String(count.opened_ml || 0),
        include: true,
        confidence: 1,
      })),
    );
    setScan({ ...scan, status: "review", counts: undefined });
    setEditingSaved(true);
    setError("");
  }
  function rescan() {
    if (busy) return;
    session.current = sessionKey();
    setScan(null);
    setError("");
    setEditingSaved(false);
    if (photo) analyze(photo);
    else choose(false);
  }
  const saved =
    ["confirmed", "reconciled"].includes(scan?.status) && scan?.counts;
  return (
    <View dataSet={{ scannerVersion: "3" }}>
      {!saved && (
        <View style={[s.row, { marginBottom: 16 }]}>
          {["Photo", "Check", "Save stock"].map((label, index) => (
            <View
              key={label}
              style={{
                flex: 1,
                borderTopWidth: 3,
                paddingTop: 8,
                borderColor: index <= (scan ? 1 : 0) ? "#357A54" : "#DEE7DD",
              }}
            >
              <Text
                style={{ fontSize: 11, color: "#6A7F70", fontWeight: "600" }}
              >
                {index + 1}. {tr(label)}
              </Text>
            </View>
          ))}
        </View>
      )}
      {cameraOpen && (
        <InventoryCamera
          onCapture={acceptPhoto}
          onClose={() => setCameraOpen(false)}
        />
      )}
      {!photo && !scan && !busy && !cameraOpen && (
        <View style={[s.card, { padding: 24 }]}>
          <Text style={[s.title, { fontSize: 22 }]}>
            {tr("Take a shelf photo")}
          </Text>
          <Text style={s.hint}>{tr("Keep bottle labels visible.")}</Text>
          <InvButton icon="camera-outline" onPress={() => choose(true)}>
            {tr("Take photo")}
          </InvButton>
          <InvButton
            secondary
            icon="image-outline"
            onPress={() => choose(false)}
          >
            {tr("Upload photo")}
          </InvButton>
        </View>
      )}
      {!!photo && !saved && !cameraOpen && (
        <View style={[s.row, { alignItems: "center", marginBottom: 12 }]}>
          <Image
            accessibilityLabel={tr("Inventory photograph")}
            source={{ uri: photo.uri }}
            style={{
              width: 75,
              height: 85,
              resizeMode: "contain",
              borderRadius: 9,
            }}
          />
          <View style={{ flex: 1 }}>
            <Text style={s.label}>
              {scan ? tr("Check the count and size") : tr("Your photo")}
            </Text>
            {!busy && (
              <TouchableOpacity
                onPress={() => choose(false)}
                style={{ paddingVertical: 10 }}
              >
                <Text style={{ color: "#407950", fontSize: 12 }}>
                  {tr("Change photo")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      {!scan && !busy && stock.length > 0 && (
        <More title={tr("Choose one product (optional)")}>
          <InvChoice
            label={tr("Product to count")}
            value={target}
            options={[
              { id: "all", name: tr("All products in the photo") },
              ...stock,
            ]}
            onChange={setTarget}
          />
        </More>
      )}
      {busy && (
        <View style={{ padding: 20, alignItems: "center" }}>
          <ActivityIndicator color="#327450" />
          <Text style={s.hint}>
            {scan ? tr("Saving stock…") : tr("Counting bottles…")}
          </Text>
        </View>
      )}
      {photo && !scan && !busy && (
        <InvButton onPress={() => analyze()}>
          {tr("Retry this photo")}
        </InvButton>
      )}
      {scan?.status === "review" && !cameraOpen && (
        <View>
          {!rows.length && (
            <Text style={s.hint}>
              {tr("No products found. Try another photo or add an item.")}
            </Text>
          )}
          {rows.map((row, index) => (
            <Product
              key={row.key}
              row={row}
              stock={stock}
              menu={menu}
              onOpenMenu={onOpenMenu}
              onChange={(change) => patch(index, change)}
              disabled={busy}
              tr={tr}
            />
          ))}
          <InvButton disabled={busy} icon="checkmark-outline" onPress={save}>
            {countOnly ? tr("Save count only") : tr("Save stock")}
          </InvButton>
          <More title={tr("More options")}>
            <InvButton
              secondary
              disabled={busy}
              onPress={() =>
                setRows((current) => [
                  ...current,
                  {
                    key: sessionKey(),
                    label: "",
                    manual: true,
                    menu_mode: "link",
                    menu_groups: [],
                    new_name: "",
                    new_unit: "ml",
                    inventory_item_id: "new",
                    full_bottles: "1",
                    opened_ml: "0",
                    bottle_size_ml: "",
                    include: true,
                    confidence: 1,
                  },
                ])
              }
            >
              {tr("Add a missing item")}
            </InvButton>
            <View style={s.row}>
              <InvButton secondary disabled={busy} onPress={() => choose(true)}>
                {tr("Take photo")}
              </InvButton>
              <InvButton
                secondary
                disabled={busy}
                onPress={() => choose(false)}
              >
                {tr("Upload photo")}
              </InvButton>
            </View>
            <InvField
              label={tr("Note (optional)")}
              value={note}
              onChangeText={setNote}
            />
            <TouchableOpacity
              accessibilityRole="checkbox"
              accessibilityState={{ checked: countOnly }}
              onPress={() => !busy && setCountOnly(!countOnly)}
              style={[s.row, { paddingVertical: 14 }]}
            >
              <Ionicons
                name={countOnly ? "checkbox" : "square-outline"}
                size={23}
                color="#327450"
              />
              <Text style={{ flex: 1, fontSize: 13, color: "#5A7060" }}>
                {tr("Save count only — do not change stock")}
              </Text>
            </TouchableOpacity>
          </More>
        </View>
      )}
      {saved && (
        <CountReview
          scan={scan}
          onUpdated={setScan}
          onChanged={onChanged}
          onEdit={editCount}
          onRescan={rescan}
          onCamera={() => choose(true)}
        />
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {tr(error)}
        </Text>
      )}
    </View>
  );
}

export function CountReview({
  scan,
  onUpdated,
  onChanged,
  onEdit,
  onRescan,
  onCamera,
}) {
  const tr = useLocalizeText();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState("");
  const inFlight = useRef(false);
  const applied = scan.status === "reconciled",
    removed = scan.counts.some((count) => count.archived);
  async function apply() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const result = (
        await API.post(`/inventory/scans/${scan.id}/reconcile`, {
          note: note.trim() || undefined,
        })
      ).data;
      onUpdated(result);
      await onChanged?.();
    } catch (error) {
      setError(errorText(error));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <View>
      <View style={[s.row, { marginVertical: 18 }]}>
        <Ionicons
          name={applied ? "checkmark-circle" : "document-text-outline"}
          size={28}
          color="#327450"
        />
        <Text style={[s.title, { flex: 1, fontSize: 23 }]}>
          {applied ? tr("Stock saved") : tr("Count saved, stock not updated")}
        </Text>
      </View>
      {scan.counts.map((count) => (
        <View key={count.id} style={[s.card, { padding: 17 }]}>
          <Text style={s.label}>{count.name}</Text>
          <Text style={{ fontSize: 11, color: "#849281", marginTop: 7 }}>
            {count.archived
              ? tr("Item removed")
              : applied
                ? tr("Stock now")
                : tr("Your count")}
          </Text>
          <Text
            style={{
              fontSize: 29,
              color: count.archived ? "#8D9586" : "#245F3B",
              fontWeight: "700",
              marginTop: 2,
            }}
          >
            {count.archived
              ? "—"
              : display(
                  applied ? count.current_stock : count.physical_stock,
                  count.unit,
                  tr,
                )}
          </Text>
          <Text style={[s.smallHint, { marginTop: 8 }]}>
            {count.menu_links?.length
              ? tr("Menu: {names}", {
                  names: [
                    ...new Set(count.menu_links.map((link) => link.name)),
                  ].join(", "),
                })
              : tr("Not linked to a menu item")}
          </Text>
          <More title={tr("View comparison")}>
            <Text style={s.hint}>
              {tr("Before photo: {quantity}", {
                quantity: display(count.expected_stock, count.unit, tr),
              })}
            </Text>
            <Text style={s.hint}>
              {tr("Your count: {quantity}", {
                quantity: display(count.physical_stock, count.unit, tr),
              })}
            </Text>
            <Text style={s.hint}>
              {tr("Change: {quantity}", {
                quantity: `${Number(count.variance) > 0 ? "+" : ""}${display(count.variance, count.unit, tr)}`,
              })}
            </Text>
            {!!count.reconciliation_note && (
              <Text style={s.smallHint}>{count.reconciliation_note}</Text>
            )}
          </More>
        </View>
      ))}
      {removed && !applied && (
        <Text style={s.error}>
          {tr("This item was removed. Start a new scan to add it again.")}
        </Text>
      )}
      {!applied && !removed && (
        <>
          <InvButton disabled={busy} onPress={apply}>
            {busy ? tr("Saving stock…") : tr("Save stock")}
          </InvButton>
          {onEdit && (
            <InvButton secondary disabled={busy} onPress={onEdit}>
              {tr("Edit count")}
            </InvButton>
          )}
        </>
      )}
      {onRescan && (
        <InvButton secondary disabled={busy} onPress={onRescan}>
          {tr("Scan again")}
        </InvButton>
      )}
      <More title={tr("More options")}>
        {onCamera && (
          <InvButton secondary disabled={busy} onPress={onCamera}>
            {tr("Take photo")}
          </InvButton>
        )}
        {!applied && !removed && (
          <InvField
            label={tr("Note (optional)")}
            value={note}
            onChangeText={setNote}
          />
        )}
        <Text style={s.smallHint}>
          {tr("Saved")}{" "}
          {scan.confirmed_at
            ? new Date(scan.confirmed_at).toLocaleString()
            : ""}
        </Text>
      </More>
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {tr(error)}
        </Text>
      )}
    </View>
  );
}
