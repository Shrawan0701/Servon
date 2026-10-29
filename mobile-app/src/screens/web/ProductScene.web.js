import React, { useRef, useState } from "react";
import { MarkIcon } from "./MarketingTheme.web";

const tables = [
  {
    id: "01",
    seats: 4,
    busy: true,
    items: [
      [2, "Paneer tikka", "Starters", 560],
      [3, "Garlic naan", "Breads", 180],
      [1, "Dal makhani", "Main course", 260],
    ],
  },
  { id: "02", seats: 2, busy: false },
  {
    id: "03",
    seats: 4,
    busy: true,
    items: [
      [2, "Veg biryani", "Main course", 520],
      [2, "Fresh lime soda", "Beverages", 160],
    ],
  },
  {
    id: "04",
    seats: 4,
    busy: true,
    items: [
      [1, "Butter chicken", "Main course", 340],
      [2, "Butter naan", "Breads", 100],
    ],
  },
  { id: "05", seats: 6, busy: false },
  { id: "06", seats: 2, busy: false },
];
const screens = [
  ["floor", "Dining room", "grid"],
  ["kitchen", "Kitchen", "receipt"],
  ["stock", "Inventory", "layers"],
];

export default function ProductScene() {
  const [view, setView] = useState("floor");
  const [selected, setSelected] = useState("01");
  const tabs = useRef([]);
  const table = tables.find((record) => record.id === selected);
  const items = table.items || [];
  const total = items.reduce((sum, item) => sum + item[3], 0);
  function navigate(event, index) {
    let next;
    if (event.key === "ArrowRight" || event.key === "ArrowDown")
      next = (index + 1) % screens.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      next = (index + screens.length - 1) % screens.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = screens.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    setView(screens[next][0]);
    tabs.current[next]?.focus();
  }
  return (
    <div className="sx-console" id="workspace">
      <div className="sx-console-head">
        <span className="sx-console-brand">Servon.</span>
        <span>PRODUCT PREVIEW / SAMPLE DATA</span>
        <div className="sx-console-workplace">
          Example restaurant <i>S</i>
        </div>
      </div>
      <div className="sx-console-layout">
        <nav
          className="sx-console-nav"
          role="tablist"
          aria-label="Product preview"
        >
          <p>WORKSPACE</p>
          {screens.map(([id, name, icon], index) => (
            <button
              key={id}
              role="tab"
              id={`sx-tab-${id}`}
              aria-controls="sx-preview"
              aria-selected={view === id}
              tabIndex={view === id ? 0 : -1}
              ref={(node) => {
                tabs.current[index] = node;
              }}
              onKeyDown={(event) => navigate(event, index)}
              onClick={() => setView(id)}
            >
              <MarkIcon name={icon} />
              {name}
            </button>
          ))}
          <span>
            The preview uses sample records and does not affect your restaurant.
          </span>
        </nav>
        <div
          className="sx-console-main"
          role="tabpanel"
          id="sx-preview"
          aria-labelledby={`sx-tab-${view}`}
          tabIndex={0}
        >
          <div className="sx-console-title">
            <div>
              <h2>
                {view === "floor"
                  ? "Dining room"
                  : view === "kitchen"
                    ? "Kitchen orders"
                    : "Stock & ingredients"}
              </h2>
              <p>
                {view === "floor"
                  ? "Select a table to view its order"
                  : view === "kitchen"
                    ? "Tickets associated with each table"
                    : "Recorded quantities and recipe connections"}
              </p>
            </div>
            <span>
              {view === "floor"
                ? "Ground floor"
                : view === "kitchen"
                  ? "3 active tickets"
                  : "Inventory overview"}
            </span>
          </div>
          {view === "floor" ? (
            <div className="sx-service-view">
              <div className="sx-room">
                <div className="sx-room-top">
                  <span>MAIN DINING AREA</span>
                  <span>ENTRANCE ↓</span>
                </div>
                <div className="sx-tables">
                  {tables.map((record) => (
                    <button
                      className="sx-table"
                      data-busy={record.busy}
                      aria-label={`Table ${record.id}, ${record.busy ? "occupied" : "available"}`}
                      aria-pressed={selected === record.id}
                      key={record.id}
                      onClick={() => setSelected(record.id)}
                    >
                      {record.id}
                      <small>{record.seats} seats</small>
                    </button>
                  ))}
                </div>
                <div className="sx-room-bottom">
                  <span>
                    <i /> Occupied
                  </span>
                  <span>Available tables have a white background</span>
                </div>
              </div>
              <div className="sx-order-panel" aria-live="polite">
                <header>
                  <h3>Table {selected}</h3>
                  <span>{table.busy ? "Order open" : "Available"}</span>
                </header>
                <p className="sx-order-time">
                  {table.busy
                    ? "Sample order details"
                    : "No order is associated with this table"}
                </p>
                {items.map(([quantity, name, category, amount]) => (
                  <div key={name} className="sx-order-line">
                    <b>{quantity}</b>
                    <div>
                      <strong>{name}</strong>
                      <small>{category}</small>
                    </div>
                    <span>₹{amount}</span>
                  </div>
                ))}
                {table.busy && (
                  <>
                    <div className="sx-order-total">
                      <span>Order subtotal</span>
                      <strong>₹{total.toLocaleString("en-IN")}</strong>
                    </div>
                    <div className="sx-order-status">
                      <MarkIcon name="check" size={11} /> Order items are shown
                      in the kitchen view
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : view === "kitchen" ? (
            <div className="sx-console-list">
              {[
                [
                  "01",
                  "Paneer tikka ×2, Garlic naan ×3, Dal makhani",
                  "Preparing",
                ],
                ["03", "Veg biryani ×2, Fresh lime soda ×2", "New order"],
                ["04", "Butter chicken, Butter naan ×2", "Ready"],
              ].map(([id, order, status]) => (
                <div className="sx-kitchen-row" key={id}>
                  <strong>Table {id}</strong>
                  <div>
                    {order}
                    <p>Kitchen order ticket · Sample order</p>
                  </div>
                  <span>{status}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="sx-console-list">
              {[
                ["Tomatoes", "Ingredient stock", "12 kg", "Recipes linked"],
                ["Paneer", "Ingredient stock", "4 kg", "Recipes linked"],
                [
                  "Base gravy",
                  "Shared preparation",
                  "Recipe",
                  "Used across dishes",
                ],
                [
                  "Bottled drinks",
                  "Physical count",
                  "Review",
                  "Photo count ready",
                ],
              ].map(([name, kind, quantity, status]) => (
                <div className="sx-stock-row" key={name}>
                  <div>
                    <strong>{name}</strong>
                    <small>{kind}</small>
                  </div>
                  <span>{quantity}</span>
                  <span>{status}</span>
                </div>
              ))}
            </div>
          )}
          <div className="sx-console-foot">
            <span>SAMPLE WORKSPACE · SELECT A VIEW TO EXPLORE</span>
            <span>Orders / Kitchen / Inventory</span>
          </div>
        </div>
      </div>
    </div>
  );
}
