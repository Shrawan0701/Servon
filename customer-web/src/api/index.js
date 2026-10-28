import axios from "axios"; 
const API = axios.create({ 
baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api", 
}); 
export const fetchPublicMenu = (businessId) => API.get(`/menu/public/${businessId}`); 
export const fetchTableInfo = (tableId) => API.get(`/tables/public/${tableId}`); 
export const placeOrder = async (data) => {
  const fingerprint = JSON.stringify(data);
  let pending;
  try { pending = JSON.parse(sessionStorage.getItem('servon:pending-order') || 'null'); } catch { /* Storage may be unavailable. */ }
  if (!pending || pending.fingerprint !== fingerprint) {
    pending = { fingerprint, key: `customer-order-${Date.now()}-${Math.random().toString(36).slice(2)}` };
    try { sessionStorage.setItem('servon:pending-order', JSON.stringify(pending)); } catch { /* Still send an idempotency key. */ }
  }
  const response = await API.post("/orders/place", data, { headers: { 'Idempotency-Key': pending.key } });
  try { sessionStorage.removeItem('servon:pending-order'); } catch { /* No persistent storage. */ }
  return response;
};
export const servonVoicePublic = (formData) =>
  API.post("/action/voice-public", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }); 
export const editOrder = (orderId, data) => API.put(`/orders/edit/${orderId}`, data);
export const getBusinessProfile = (businessId) =>
  API.get(`/business/public/${businessId}`);
export default API;
