const money = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100;
export function billTotals(orders, discount = { type: 'none', value: 0 }, profile = null) {
  const subtotals = orders.map((o) => {
    const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
    return items ? money(items.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0), 0)) : Number(o.subtotal_before_discount ?? o.total_amount ?? 0);
  });
  const subtotal = money(subtotals.reduce((sum, n) => sum + n, 0));
  const cgstRate = Number(profile?.cgst_percentage || 0) / 100;
  const sgstRate = Number(profile?.sgst_percentage || 0) / 100;
  const orderTotals = subtotals.map((base, index) => {
    const value = discount.type === 'flat' ? Math.min(Number(discount.value || 0), subtotal) * base / (subtotal || 1) : Number(discount.value || 0);
    const off = discount.type === 'percentage' ? base * value / 100 : discount.type === 'flat' ? value : 0;
    const cgst = (base - off) * cgstRate, sgst = (base - off) * sgstRate;
    return { id: orders[index].id, subtotal_before_discount: base, discount_type: discount.type, discount_value: value, discount_amount: off, gst_amount: cgst + sgst, cgst, sgst, total_amount: money(base - off + cgst + sgst) };
  });
  return {
    subtotal, orderTotals,
    discountAmount: money(orderTotals.reduce((sum, o) => sum + o.discount_amount, 0)),
    cgstAmount: money(orderTotals.reduce((sum, o) => sum + o.cgst, 0)),
    sgstAmount: money(orderTotals.reduce((sum, o) => sum + o.sgst, 0)),
    grandTotal: money(orderTotals.reduce((sum, o) => sum + o.total_amount, 0)),
  };
}
