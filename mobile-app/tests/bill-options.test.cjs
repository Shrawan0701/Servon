const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

const totalsExports = {};
vm.runInNewContext(babel.transformSync(fs.readFileSync(path.join(__dirname, '../src/utils/billTotals.js'), 'utf8'), {
  configFile: false, babelrc: false, plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
}).code, { exports: totalsExports });

function mountOptions() {
  const states = [];
  let cursor = 0;
  const printed = [];
  const alerts = [];
  const source = fs.readFileSync(path.join(__dirname, "../src/hooks/useBillOptions.js"), "utf8");
  const { code } = babel.transformSync(source, {
    configFile: false, babelrc: false,
    plugins: [require.resolve("@babel/plugin-transform-modules-commonjs")],
  });
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (name.endsWith("billTotals")) return totalsExports;
      if (name === "react") return {
        useState(initial) {
          const slot = cursor++;
          if (!(slot in states)) states[slot] = initial;
          return [states[slot], (value) => { states[slot] = typeof value === "function" ? value(states[slot]) : value; }];
        },
        useMemo: (fn) => fn(),
        useCallback: (fn) => fn,
      };
      if (name === "react-native") return { Alert: { alert: (...args) => alerts.push(args) } };
      if (name.endsWith("LocaleContext")) return { useLocale: () => ({ language: "en" }) };
      return { localizeText: (text) => text };
    },
  });
  const order = { id: "order-1", table_number: "2", total_amount: "25.00", created_at: new Date().toISOString(), status: "CONFIRMED" };
  const orders = [order, { ...order, id: "paid", status: "PAID", total_amount: 100 }, { ...order, id: "other", table_number: "3", total_amount: 200 }];
  const render = () => { cursor = 0; return exports.default(orders, (...args) => printed.push(args)); };
  render().openDiscountModal(order);
  return { render, printed, alerts, order };
}

test("billing opens before printing, shares discount choices and resets for the next bill", () => {
  const { render, printed, order } = mountOptions();
  let props = render().billOptionsModalProps;
  assert.equal(props.visible, true);
  assert.equal(printed.length, 0);
  assert.equal(props.modalSubtotal, 25);
  props.setDiscountType("percentage");
  props.setDiscountValue("10");
  props = render().billOptionsModalProps;
  assert.equal(props.modalDiscountAmount, 2.5);
  props.onApply();
  assert.equal(printed[0][0].id, order.id);
  assert.equal(printed[0][1].type, "percentage");
  assert.equal(printed[0][1].value, 10);
  assert.equal(render().billOptionsModalProps.visible, false);
  render().openDiscountModal(order);
  assert.equal(render().billOptionsModalProps.discountType, "none");
});

test("outstanding bills accept a blank phone and calculate the unpaid balance", () => {
  const { render, printed, alerts } = mountOptions();
  let props = render().billOptionsModalProps;
  props.setDiscountType("outstanding");
  props.setOutstandingForm({ customerName: "Customer", phoneNumber: "", paidAmount: "10.00", remainingAmount: "" });
  props = render().billOptionsModalProps;
  assert.equal(props.outstandingRemainingCents, 1500);
  props.onApply();
  assert.equal(alerts.length, 0);
  assert.equal(printed[0][2].phoneNumber, "");
  assert.equal(printed[0][2].remainingAmount, "15.00");
});

test("invalid provided phones, inconsistent payments and excessive percentage discounts keep the popup open", () => {
  const { render, printed, alerts } = mountOptions();
  let props = render().billOptionsModalProps;
  props.setDiscountType("outstanding");
  props.setOutstandingForm({ customerName: "Customer", phoneNumber: "123", paidAmount: "", remainingAmount: "" });
  render().billOptionsModalProps.onApply();
  props.setOutstandingForm({ customerName: "Customer", phoneNumber: "", paidAmount: "10", remainingAmount: "20" });
  render().billOptionsModalProps.onApply();
  props.setDiscountType("percentage");
  props.setDiscountValue("101");
  render().billOptionsModalProps.onApply();
  assert.equal(alerts.length, 3);
  assert.equal(printed.length, 0);
  assert.equal(render().billOptionsModalProps.visible, true);
});
