import { useEffect, useState, useMemo } from "react"; 
import { useParams, useNavigate } from "react-router-dom"; 
import { fetchPublicMenu, fetchTableInfo } from "../api"; 
import { useCart } from "../context/CartContext"; 
 
export default function MenuPage() { 
  const { businessId, tableId } = useParams(); 
  const navigate = useNavigate(); 
  const { addToCart, removeFromCart, getQuantity, totalItems, totalAmount } = useCart(); 
 
  const [menuItems, setMenuItems] = useState([]); 
  const [businessInfo, setBusinessInfo] = useState(null); 
  const [selectedCategory, setSelectedCategory] = useState("All"); 
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState(null); 
 
  useEffect(() => { 
    const load = async () => { 
      try { 
        const [menuRes, tableRes] = await Promise.all([ 
          fetchPublicMenu(businessId), 
          fetchTableInfo(tableId), 
        ]); 
        setMenuItems(menuRes.data); 
        setBusinessInfo(tableRes.data); 
      } catch (err) { 
        setError("Failed to load menu. Please try again."); 
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
        <h4>{error}</h4> 
      </div> 
    );
  } 
 
  return ( 
    <div style={{ paddingBottom: totalItems > 0 ? 80 : 20 }}> 
      {/* Business Header */} 
      <div className="business-header"> 
        <div className="d-flex align-items-center gap-3"> 
          {businessInfo?.logo_url && ( 
            <img src={businessInfo.logo_url} alt="logo" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }} /> 
          )} 
          <div> 
            <h5 className="mb-0 fw-700">{businessInfo?.business_name}</h5> 
            <small className="text-muted">Table {businessInfo?.table_number}</small> 
          </div> 
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
            {cat} 
          </button> 
        ))} 
      </div>

      <div className="px-3"> 
        <div className="row g-3"> 
          {filteredItems.map((item) => { 
            const qty = getQuantity(item.id); 
            return ( 
              <div key={item.id} className="col-6"> 
                <div className="menu-card h-100" style={{ display: 'flex', flexDirection: 'column' }}> 
                  
                  {/* UPDATED IMAGE STYLING */}
                  {item.image_url ? ( 
                    <img 
                      src={item.image_url} 
                      alt={item.name} 
                      style={{ width: '100%', height: 140, objectFit: 'cover', borderTopLeftRadius: 12, borderTopRightRadius: 12 }} 
                    /> 
                  ) : ( 
                    <div style={{ height: 140, background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", borderTopLeftRadius: 12, borderTopRightRadius: 12 }}> 
                      <span style={{ fontSize: 36 }}>🍽</span> 
                    </div> 
                  )} 
                  
                  <div className="p-2 d-flex flex-column" style={{ flex: 1 }}> 
                    <div className="fw-600" style={{ fontSize: 14 }}>{item.name}</div> 
                    {item.description && ( 
                      <div className="text-muted" style={{ fontSize: 12, marginTop: 2, WebkitLineClamp: 2, overflow: "hidden", display: "-webkit-box", WebkitBoxOrient: "vertical", flex: 1 }}> 
                        {item.description} 
                      </div> 
                    )} 
                    
                    <div className="d-flex justify-content-between align-items-center mt-auto pt-2"> 
                      <span style={{ fontWeight: 700, fontSize: 15 }}>₹{item.price}</span> 
                      {qty === 0 ? ( 
                        <button className="qty-btn" onClick={() => addToCart(item)}>+</button> 
                      ) : ( 
                        <div className="qty-control"> 
                          <button className="qty-btn" onClick={() => removeFromCart(item.id)}>–</button> 
                          <span style={{ fontWeight: 700, minWidth: '16px', textAlign: 'center' }}>{qty}</span>
                          <button className="qty-btn" onClick={() => addToCart(item)}>+</button> 
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
          <span>{totalItems} item{totalItems > 1 ? "s" : ""}</span> 
          <span>View Cart · ₹{totalAmount.toFixed(0)} →</span> 
        </div> 
      )} 
    </div> 
  ); 
}