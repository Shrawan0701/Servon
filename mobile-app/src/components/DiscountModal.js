import React from "react";
import { View, TextInput, TouchableOpacity, StyleSheet, Modal, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import LocalizedText from "./LocalizedText";
import { formatCents } from "../hooks/useBillOptions";

const DiscountModal = ({
  visible,
  onClose,
  discountType,
  setDiscountType,
  discountValue,
  setDiscountValue,
  onApply,
  modalSubtotal,
  modalDiscountAmount,
  modalPayable,
  outstandingForm,
  setOutstandingForm,
  outstandingTotalCents,
  outstandingRemainingCents,
}) => {
  const updateOutstanding = (field, value) => setOutstandingForm((prev) => ({ ...prev, [field]: value }));
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.discountModalOverlay} onPress={onClose}>
        <Pressable style={styles.discountModal} onPress={(e) => e.stopPropagation()}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.discountModalHeader}>
              <LocalizedText translate style={styles.discountModalTitle}>Apply Discount</LocalizedText>
              <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.6}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.discountSegment}>
              {[
                { key: "outstanding", label: "Outstanding", icon: "person-outline" },
                { key: "none", label: "None", icon: "close-circle-outline" },
                { key: "percentage", label: "% Off", icon: "pricetag-outline" },
                { key: "flat", label: "₹ Off", icon: "cash-outline" },
              ].map((item) => (
                <TouchableOpacity
                  key={item.key}
                  activeOpacity={0.75}
                  style={[styles.segmentBtn, discountType === item.key && styles.segmentBtnActive]}
                  onPress={() => { setDiscountType(item.key); setDiscountValue(""); }}
                >
                  <Ionicons name={item.icon} size={16} color={discountType === item.key ? "#fff" : "#6B7280"} />
                  <LocalizedText style={[styles.segmentText, discountType === item.key && styles.segmentTextActive]}>{item.label}</LocalizedText>
                </TouchableOpacity>
              ))}
            </View>
            {discountType === "outstanding" ? (
              <View style={styles.outstandingFields}>
                <TextInput style={styles.outstandingInput} placeholder="Customer Name" placeholderTextColor="#9CA3AF" value={outstandingForm.customerName} onChangeText={(v) => updateOutstanding("customerName", v)} />
                <TextInput style={styles.outstandingInput} placeholder="Phone Number (optional)" placeholderTextColor="#9CA3AF" keyboardType="number-pad" maxLength={10} value={outstandingForm.phoneNumber} onChangeText={(v) => updateOutstanding("phoneNumber", v.replace(/\D/g, ""))} />
                <View style={styles.outstandingReadonly}>
                  <LocalizedText style={styles.previewLabel}>Total Amount</LocalizedText>
                  <LocalizedText style={styles.previewValue}>Rs. {formatCents(outstandingTotalCents)}</LocalizedText>
                </View>
                <TextInput
                  style={styles.outstandingInput}
                  placeholder="Paid Amount (optional, default 0.00)"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={outstandingForm.paidAmount}
                  onChangeText={(v) => updateOutstanding("paidAmount", v.replace(/[^0-9.]/g, ""))}
                  selectTextOnFocus
                />
                <TextInput
                  style={styles.outstandingInput}
                  placeholder={`Remaining Amount (default ${formatCents(outstandingRemainingCents)})`}
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={outstandingForm.remainingAmount}
                  onChangeText={(v) => updateOutstanding("remainingAmount", v.replace(/[^0-9.]/g, ""))}
                  selectTextOnFocus
                />
              </View>
            ) : discountType !== "none" && (
              <>
                <View style={styles.discountInputWrap}>
                  <LocalizedText style={styles.discountPrefix}>{discountType === "percentage" ? "%" : "₹"}</LocalizedText>
                  <TextInput style={styles.discountInputField} placeholder="0" keyboardType="numeric" value={discountValue} onChangeText={setDiscountValue} autoFocus />
                </View>
                {discountType === "percentage" && (
                  <View style={styles.presetRow}>
                    {[5, 10, 15, 20].map((p) => (
                      <TouchableOpacity key={p} activeOpacity={0.7} style={styles.presetChip} onPress={() => setDiscountValue(String(p))}>
                        <LocalizedText style={styles.presetChipText}>{p}%</LocalizedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
            <View style={styles.previewBox}>
              <View style={styles.previewRow}>
                <LocalizedText translate style={styles.previewLabel}>Subtotal</LocalizedText>
                <LocalizedText style={styles.previewValue}>₹{Number(modalSubtotal).toFixed(2)}</LocalizedText>
              </View>
              {modalDiscountAmount > 0 && (
                <View style={styles.previewRow}>
                  <LocalizedText translate style={[styles.previewLabel, { color: "#EF4444" }]}>Discount</LocalizedText>
                  <LocalizedText style={[styles.previewValue, { color: "#EF4444" }]}>-₹{Number(modalDiscountAmount).toFixed(2)}</LocalizedText>
                </View>
              )}
              <View style={[styles.previewRow, { borderTopWidth: 1, borderTopColor: "#E5E7EB", paddingTop: 8, marginTop: 4 }]}>
                <LocalizedText translate style={styles.previewTotalLabel}>Payable</LocalizedText>
                <LocalizedText style={styles.previewTotalValue}>₹{Number(modalPayable ?? modalSubtotal - modalDiscountAmount).toFixed(2)}</LocalizedText>
              </View>
            </View>
            <View style={styles.discountModalButtons}>
              <TouchableOpacity activeOpacity={0.8} style={[styles.discountModalBtn, { backgroundColor: "#F3F4F6" }]} onPress={onClose}>
                <LocalizedText translate style={[styles.discountModalBtnText, { color: "#374151" }]}>Cancel</LocalizedText>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={[styles.discountModalBtn, { backgroundColor: "#111827" }]} onPress={onApply}>
                <Ionicons name="print-outline" size={16} color="#fff" />
                <LocalizedText translate style={styles.discountModalBtnText}>Apply & Print</LocalizedText>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default DiscountModal;

const styles = StyleSheet.create({
  discountModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  discountModal: { backgroundColor: "#fff", borderRadius: 22, padding: 22, width: "100%", maxWidth: 480, maxHeight: "100%" },
  discountModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  discountModalTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  discountSegment: { flexDirection: "row", backgroundColor: "#F3F4F6", borderRadius: 12, padding: 4, gap: 4, marginBottom: 16 },
  segmentBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 9, borderRadius: 9 },
  segmentBtnActive: { backgroundColor: "#111827" },
  segmentText: { fontSize: 12, fontWeight: "700", color: "#6B7280" },
  segmentTextActive: { color: "#fff" },
  discountInputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 14, marginBottom: 10 },
  discountPrefix: { fontSize: 18, fontWeight: "800", color: "#9CA3AF", marginRight: 8 },
  discountInputField: { flex: 1, fontSize: 20, fontWeight: "700", paddingVertical: 12, color: "#111827" },
  outstandingFields: { gap: 10, marginBottom: 12 },
  outstandingInput: { borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontWeight: "700", color: "#111827" },
  outstandingReadonly: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1.5, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  presetRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  presetChip: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: "#ECFDF5", alignItems: "center" },
  presetChipText: { fontSize: 13, fontWeight: "700", color: "#10B981" },
  previewBox: { backgroundColor: "#FAF8F5", borderRadius: 14, padding: 14, marginBottom: 18, marginTop: 4 },
  previewRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  previewLabel: { fontSize: 13, color: "#6B7280", fontWeight: "600" },
  previewValue: { fontSize: 13, color: "#111827", fontWeight: "700" },
  previewTotalLabel: { fontSize: 15, color: "#111827", fontWeight: "800" },
  previewTotalValue: { fontSize: 18, color: "#111827", fontWeight: "900" },
  discountModalButtons: { flexDirection: "row", gap: 10 },
  discountModalBtn: { flex: 1, flexDirection: "row", paddingVertical: 13, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 6 },
  discountModalBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
