import { BrowserRouter, Routes, Route } from "react-router-dom"; 
import MenuPage from "./pages/MenuPage"; 
import CartPage from "./pages/CartPage"; 
import OrderSuccessPage from "./pages/OrderSuccessPage"; 
import NotFoundPage from "./pages/NotFoundPage"; 
import { CartProvider } from "./context/CartContext"; 
import FeedbackPage from "./pages/FeedbackPage";
 
export default function App() { 
  return ( 
    <CartProvider> 
      <BrowserRouter> 
        <Routes> 
          {/* ✅ FIXED: Added /menu as a valid path for Query Parameters */}
          <Route path="/menu/:businessId?/:tableId?" element={<MenuPage />} /> 
          <Route path="/cart/:businessId?/:tableId?" element={<CartPage />} /> 
          
          <Route path="/order-success/:orderId" element={<OrderSuccessPage />} /> 
          <Route path="/feedback/:businessId" element={<FeedbackPage />} />
          <Route path="*" element={<NotFoundPage />} /> 
        </Routes> 
      </BrowserRouter> 
    </CartProvider> 
  );
}