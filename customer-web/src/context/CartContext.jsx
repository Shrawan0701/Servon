import { createContext, useContext, useState } from "react"; 
 
const CartContext = createContext(); 
 
export function CartProvider({ children }) { 
  const [cartItems, setCartItems] = useState([]); 
 
  const addToCart = (item) => { 
    setCartItems((prev) => { 
      const existing = prev.find((i) => i.id === item.id); 
      if (existing) { 
        return prev.map((i) => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i); 
      } 
      return [...prev, { ...item, quantity: 1 }]; 
    }); 
  }; 
 
  const removeFromCart = (itemId) => { 
    setCartItems((prev) => { 
      const existing = prev.find((i) => i.id === itemId); 
      if (existing && existing.quantity > 1) { 
        return prev.map((i) => i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i); 
      } 
      return prev.filter((i) => i.id !== itemId); 
    }); 
  }; 
 
  const clearCart = () => setCartItems([]);
  const totalAmount = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0); 
const totalItems = cartItems.reduce((sum, i) => sum + i.quantity, 0); 
const getQuantity = (itemId) => { 
const item = cartItems.find((i) => i.id === itemId); 
return item ? item.quantity : 0; 
}; 
return ( 
<CartContext.Provider value={{ cartItems, addToCart, removeFromCart, clearCart, totalAmount, 
totalItems, getQuantity }}> 
{children} 
</CartContext.Provider> 
); 
} 
export const useCart = () => useContext(CartContext);