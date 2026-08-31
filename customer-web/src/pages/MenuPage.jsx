import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom"; // ✅ Added useLocation
import { fetchPublicMenu, fetchTableInfo } from "../api";
import { useCart } from "../context/CartContext";
import { LanguageSelector, useLocale } from "../context/LocaleContext";

// --- Helper Functions from Friend's Push ---

// Builds the full list of items in a thali from allItems + thali_custom string
function getThaliContents(item, allItems) {
  let includes = item.thali_includes;

  // ✅ FIX: Convert string → array
  if (typeof includes === "string") {
    try {
      includes = JSON.parse(includes);
    } catch {
      includes = [];
    }
  }

  const picked = (includes || []).map(String);

  const pickedNames = allItems
    .filter((i) => picked.includes(String(i.id)))
    .map((i) => i.name);

  const custom = (item.thali_custom || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return [...pickedNames, ...custom];
}

// Inline chip list with +N more toggle
function ThaliContents({ contents }) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 3;
  const visible = expanded ? contents : contents.slice(0, LIMIT);
  const extra = contents.length - LIMIT;

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {visible.map((name, i) => (
          <span key={i} style={styles.thaliChip}>
            {name}
          </span>
        ))}
      </div>
      {contents.length > LIMIT && (
        <button
          style={styles.seeMoreBtn}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((p) => !p);
          }}
        >
          {expanded ? t("showLess") : t("more", { count: extra })}
        </button>
      )}
    </div>
  );
}

// --- Main Component ---

export default function MenuPage() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const location = useLocation(); // ✅ Added to read query string (?restaurantId=...)
  
  // ✅ FIX: Support both URL styles (localhost:3000/menu/id/id AND vercel.app/menu?restaurantId=id)
  const params = useParams();
  const queryParams = new URLSearchParams(location.search);

  const businessId = params.businessId || queryParams.get("restaurantId");
  const tableId = params.tableId || queryParams.get("tableId");

  const { addToCart, removeFromCart, getQuantity, totalItems, totalAmount } = useCart();

  const [menuItems, setMenuItems] = useState([]);
  const [businessInfo, setBusinessInfo] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for image lightbox preview
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    // ✅ Safety: Only load if we have both IDs
    if (!businessId || !tableId) {
      setLoading(false);
      setError("invalidQrHelp");
      return;
    }

    const load = async () => {
      try {
        const [menuRes, tableRes] = await Promise.all([
          fetchPublicMenu(businessId),
          fetchTableInfo(tableId),
        ]);
        setMenuItems(menuRes.data);
        setBusinessInfo(tableRes.data);
      } catch (err) {
        setError("menuLoadFailed");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [businessId, tableId]);

  const categories = useMemo(() => {
    const cats = [...new Set(menuItems.map((i) => i.category))].filter(Boolean);
    return ["All", ...cats];
  }, [menuItems]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === "All") return menuItems;
    return menuItems.filter((i) => i.category === selectedCategory);
  }, [menuItems, selectedCategory]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: "100vh" }}>
        <div className="spinner-border" style={{ color: "#111" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center" style={{ height: "100vh" }}>
        <h4>{t(error)}</h4>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: totalItems > 0 ? 80 : 20 }}>
      {/* Business Header */}
      <div className="business-header">
        <div className="d-flex align-items-center gap-3">
          {businessInfo?.logo_url && (
            <img
              src={businessInfo.logo_url}
              alt="logo"
              style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }}
            />
          )}
          <div>
            <h5 className="mb-0 fw-700">{businessInfo?.business_name}</h5>
            <small className="text-muted">{t("table")} {businessInfo?.table_number}</small>
          </div>
          <div style={{ marginLeft: "auto" }}><LanguageSelector /></div>
        </div>
      </div>

      {/* Categories */}
      <div className="d-flex gap-2 overflow-auto px-3 py-3" style={{ scrollbarWidth: "none" }}>
        {categories.map((cat) => (
          <button
            key={cat}
            className={`category-tab ${selectedCategory === cat ? "active" : ""}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat === "All" ? t("all") : cat}
          </button>
        ))}
      </div>

      <div className="px-3">
        <div className="row g-3">
          {filteredItems.map((item) => {
            const qty = getQuantity(item.id);
            const thaliContents = item.is_thali ? getThaliContents(item, menuItems) : [];

            return (
              <div key={item.id} className="col-6">
                <div className="menu-card h-100" style={{ display: "flex", flexDirection: "column" }}>
                  {/* Image Section with Thali Badge */}
                  <div style={{ position: "relative" }}>
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        onClick={() => setSelectedImage(item.image_url)}
                        style={{
                          width: "100%",
                          height: 140, // Kept your preferred height
                          objectFit: "cover",
                          borderTopLeftRadius: 12,
                          borderTopRightRadius: 12,
                          display: "block",
                          cursor: "pointer",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          height: 140, // Kept your preferred height
                          background: "#f0f0f0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderTopLeftRadius: 12,
                          borderTopRightRadius: 12,
                        }}
                      >
                        <span style={{ fontSize: 36 }}>{item.is_thali ? "🍱" : "🍽"}</span>
                      </div>
                    )}

                    {/* Thali badge on image */}
                    {item.is_thali && <span style={styles.thaliBadge}>{t("thali")}</span>}
                  </div>

                  <div className="p-2 d-flex flex-column" style={{ flex: 1 }}>
                    <div className="fw-600" style={{ fontSize: 14 }}>
                      {item.name}
                    </div>

                    {/* Logical Combination: Show Thali Contents or Description */}
                    {item.is_thali && thaliContents.length > 0 ? (
                      <ThaliContents contents={thaliContents} />
                    ) : (
                      item.description && (
                        <div
                          className="text-muted"
                          style={{
                            fontSize: 12,
                            marginTop: 2,
                            WebkitLineClamp: 2,
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitBoxOrient: "vertical",
                            flex: 1,
                          }}
                        >
                          {item.description}
                        </div>
                      )
                    )}

                    <div className="d-flex justify-content-between align-items-center mt-auto pt-2">
                      <span style={{ fontWeight: 700, fontSize: 15 }}>₹{item.price}</span>
                      {qty === 0 ? (
                        <button className="qty-btn" onClick={() => addToCart(item)}>
                          +
                        </button>
                      ) : (
                        <div className="qty-control">
                          <button className="qty-btn" onClick={() => removeFromCart(item.id)}>
                            –
                          </button>
                          <span style={{ fontWeight: 700, minWidth: "16px", textAlign: "center" }}>
                            {qty}
                          </span>
                          <button className="qty-btn" onClick={() => addToCart(item)}>
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky Cart Bar */}
      {totalItems > 0 && (
        <div className="sticky-cart-bar" onClick={() => navigate(`/cart/${businessId}/${tableId}`)}>
          <span>
            {totalItems > 1 ? t("itemsPlural", { count: totalItems }) : t("items", { count: totalItems })}
          </span>
          <span>{t("viewCart", { total: totalAmount.toFixed(0) })}</span>
        </div>
      )}

      {/* Fullscreen Image Preview Overlay Modal */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <div style={{ position: "relative", maxWidth: "100%", maxHeight: "100%" }}>
            <button
              onClick={() => setSelectedImage(null)}
              style={{
                position: "absolute",
                top: -40,
                right: 0,
                background: "transparent",
                border: "none",
                color: "#fff",
                fontSize: 28,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
            <img
              src={selectedImage}
              alt="Expanded item"
              style={{
                maxWidth: "100%",
                maxHeight: "80vh",
                borderRadius: 8,
                objectFit: "contain",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  thaliBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    background: "#111",
    color: "#fff",
    fontSize: 10,
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: 20,
    zIndex: 1,
  },
  thaliChip: {
    fontSize: 10,
    fontWeight: 500,
    color: "#854F0B",
    background: "#FAEEDA",
    borderRadius: 4,
    padding: "2px 6px",
  },
  seeMoreBtn: {
    background: "none",
    border: "none",
    padding: "4px 0 0",
    fontSize: 11,
    color: "#888",
    cursor: "pointer",
    textAlign: "left",
  },
};
