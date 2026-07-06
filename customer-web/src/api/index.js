import axios from "axios"; 
const API = axios.create({ 
baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api", 
}); 
export const fetchPublicMenu = (businessId) => API.get(`/menu/public/${businessId}`); 
export const fetchTableInfo = (tableId) => API.get(`/tables/public/${tableId}`); 
export const placeOrder = (data) => API.post("/orders/place", data); 
export const editOrder = (orderId, data) => API.put(`/orders/edit/${orderId}`, data);
export const getBusinessProfile = (businessId) =>
  API.get(`/business/public/${businessId}`);
export default API;