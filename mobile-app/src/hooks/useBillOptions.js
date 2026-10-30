import { useState, useCallback, useMemo } from "react";
import { Alert } from "react-native";
import { localizeText } from "../components/LocalizedText";
import { useLocale } from "../context/LocaleContext";
import { billTotals } from "../utils/billTotals";

const parseMoneyToCents = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const normalized = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  const [rupees, paise = ""] = normalized.split(".");
  return Number(rupees) * 100 + Number((paise + "00").slice(0, 2));
};

const numberToCents = (value) => Math.round(Number(value || 0) * 100);
export const formatCents = (cents) => (Number(cents || 0) / 100).toFixed(2);

const isToday = (value) => new Date(value).toDateString() === new Date().toDateString();

export default function useBillOptions(orders, onPrint, profile = null) {
  const { language } = useLocale();
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [selectedOrderForDiscount, setSelectedOrderForDiscount] = useState(null);
  const [discountType, setDiscountType] = useState("none");
  const [discountValue, setDiscountValue] = useState("");
  const [outstandingForm, setOutstandingForm] = useState({
    customerName: "",
    phoneNumber: "",
    paidAmount: "",
    remainingAmount: "",
  });

  const openDiscountModal = useCallback((order) => {
    setSelectedOrderForDiscount(order);
    setDiscountType("none");
    setDiscountValue("");
    setOutstandingForm({ customerName: "", phoneNumber: "", paidAmount: "", remainingAmount: "" });
    setShowDiscountModal(true);
  }, []);

  const modalSubtotal = useMemo(() => {
    if (!selectedOrderForDiscount) return 0;
    return orders
      .filter((o) => o.table_number === selectedOrderForDiscount.table_number && o.status !== "PAID" && o.status !== "REJECTED" && isToday(o.created_at))
      .reduce((sum, o) => sum + (o.items ? (typeof o.items === "string" ? JSON.parse(o.items) : o.items).reduce((total, i) => total + Number(i.price || 0) * Number(i.quantity || 0), 0) : Number(o.subtotal_before_discount ?? o.total_amount ?? 0)), 0);
  }, [selectedOrderForDiscount, orders]);

  const modalDiscountAmount = useMemo(() => {
    if (!selectedOrderForDiscount) return 0;
    const value = parseFloat(discountValue) || 0;
    if (discountType === "percentage") return (modalSubtotal * Math.min(100, Math.max(0, value))) / 100;
    if (discountType === "flat") return Math.min(Math.max(0, value), modalSubtotal);
    return 0;
  }, [discountType, discountValue, modalSubtotal, selectedOrderForDiscount]);

  const billOrders = selectedOrderForDiscount ? orders.filter((o) => o.table_number === selectedOrderForDiscount.table_number && !['PAID', 'REJECTED'].includes(o.status) && isToday(o.created_at)) : [];
  const modalPayable = billTotals(billOrders, { type: discountType, value: Math.max(0, parseFloat(discountValue) || 0) }, profile).grandTotal;
  const outstandingTotalCents = numberToCents(billTotals(billOrders, { type: 'none', value: 0 }, profile).grandTotal);
  const outstandingRemainingCents = useMemo(() => {
    const paid = parseMoneyToCents(outstandingForm.paidAmount);
    const remaining = parseMoneyToCents(outstandingForm.remainingAmount);
    if (remaining !== null && !Number.isNaN(remaining)) return remaining;
    if (paid !== null && !Number.isNaN(paid)) return Math.max(0, outstandingTotalCents - paid);
    return outstandingTotalCents;
  }, [outstandingForm.paidAmount, outstandingForm.remainingAmount, outstandingTotalCents]);

  const applyDiscount = useCallback(() => {
    if (!selectedOrderForDiscount) return;
    if (discountType === "outstanding") {
      const name = outstandingForm.customerName.trim();
      const phone = outstandingForm.phoneNumber.trim();
      const totalCents = outstandingTotalCents;
      let paidCents = parseMoneyToCents(outstandingForm.paidAmount);
      let remainingCents = parseMoneyToCents(outstandingForm.remainingAmount);

      if (!name) {
        Alert.alert(localizeText("Invalid", language), "Customer name is required.");
        return;
      }
      if (phone && !/^\d{10}$/.test(phone)) {
        Alert.alert(localizeText("Invalid", language), "Phone number must be exactly 10 digits.");
        return;
      }
      if (Number.isNaN(paidCents) || Number.isNaN(remainingCents)) {
        Alert.alert(localizeText("Invalid", language), "Enter valid rupee amounts with up to 2 decimals.");
        return;
      }
      if (paidCents === null && remainingCents === null) {
        paidCents = 0;
        remainingCents = totalCents;
      } else if (paidCents !== null && remainingCents === null) {
        remainingCents = totalCents - paidCents;
      } else if (paidCents === null && remainingCents !== null) {
        paidCents = totalCents - remainingCents;
      }
      if (paidCents < 0 || remainingCents < 0 || remainingCents > totalCents || paidCents + remainingCents !== totalCents) {
        Alert.alert(localizeText("Invalid", language), "Paid and remaining amounts must add up to the total.");
        return;
      }

      onPrint(selectedOrderForDiscount, { type: "none", value: 0 }, {
        customerName: name,
        phoneNumber: phone,
        totalAmount: formatCents(totalCents),
        paidAmount: formatCents(paidCents),
        remainingAmount: formatCents(remainingCents),
      });
      setShowDiscountModal(false);
      setSelectedOrderForDiscount(null);
      return;
    }

    const value = parseFloat(discountValue);
    if (discountType !== "none" && (!Number.isFinite(value) || value <= 0 || (discountType === "percentage" && value > 100))) {
      Alert.alert(localizeText("Invalid", language), localizeText("Please enter a valid discount amount.", language));
      return;
    }
    const discount = { type: discountType, value: value || 0 };
    onPrint(selectedOrderForDiscount, discount);
    setShowDiscountModal(false);
    setSelectedOrderForDiscount(null);
  }, [discountType, discountValue, outstandingForm, modalSubtotal, selectedOrderForDiscount, onPrint, language, outstandingTotalCents]);

  return {
    openDiscountModal,
    billOptionsModalProps: {
      visible: showDiscountModal,
      onClose: () => { setShowDiscountModal(false); setSelectedOrderForDiscount(null); },
      discountType, setDiscountType, discountValue, setDiscountValue,
      onApply: applyDiscount, modalSubtotal, modalDiscountAmount, modalPayable,
      outstandingForm, setOutstandingForm, outstandingTotalCents, outstandingRemainingCents,
    },
  };
}
