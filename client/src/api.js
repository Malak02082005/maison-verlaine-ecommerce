// Every call to the backend goes through this file.

// ---------- Login token (kept in the browser so customers stay logged in) ----------
const TOKEN_KEY = 'shop_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// Called when the server says our token is no longer valid (expired / deleted account)
let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

// ---------- Where the backend lives ----------
// Locally this stays empty: Vite forwards /api/... to http://localhost:5001 (see vite.config.js).
// In production, set VITE_API_URL to the deployed backend, e.g. https://your-api.onrender.com
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function request(url, { method = 'GET', body } = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && token) {
    clearToken();
    onUnauthorized?.();
  }
  if (!res.ok) throw new Error(data.message || 'Something went wrong. Please try again.');
  return data;
}

// { category: 'Dresses', size: '' } → "?category=Dresses" (empty values are left out)
const toQuery = (params = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null));
  return query.size ? `?${query}` : '';
};

// ---------- Accounts ----------
export const register = (data) => request('/api/auth/register', { method: 'POST', body: data });
export const login = (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password } });
export const getMe = () => request('/api/auth/me');
export const updateMe = (data) => request('/api/auth/me', { method: 'PUT', body: data }); // { name, email }
export const changePassword = (currentPassword, newPassword) =>
  request('/api/auth/me/password', { method: 'PUT', body: { currentPassword, newPassword } });

// ---------- Products ----------
export const getCatalog = () => request('/api/catalog'); // categories, types, sizes, shipping rules
export const getProducts = (params) => request(`/api/products${toQuery(params)}`);
export const getFilters = (category) => request(`/api/products/filters${toQuery({ category })}`);
export const getProduct = (idOrSlug) => request(`/api/products/${encodeURIComponent(idOrSlug)}`);
export const createProduct = (data) => request('/api/products', { method: 'POST', body: data });
export const updateProduct = (id, data) => request(`/api/products/${id}`, { method: 'PUT', body: data });
export const deleteProduct = (id) => request(`/api/products/${id}`, { method: 'DELETE' });

// ---------- Orders ----------
// items: [{ productId, size, quantity }], paymentMethod: "card" | "cod" → { order, clientSecret }
// (clientSecret is null for cash on delivery)
export const placeOrder = (items, shippingAddress, paymentMethod = 'card') =>
  request('/api/orders', { method: 'POST', body: { items, shippingAddress, paymentMethod } });
export const getMyOrders = () => request('/api/orders/mine');
export const getOrder = (id) => request(`/api/orders/${id}`);
export const getOrderPayment = (id) => request(`/api/orders/${id}/payment`); // → { clientSecret }
export const confirmPayment = (id) => request(`/api/orders/${id}/confirm-payment`, { method: 'POST' });
// reason: one of the cancel reasons (see GET /api/catalog); note: optional, required for "Other"
export const cancelOrder = (id, reason, note) =>
  request(`/api/orders/${id}/cancel`, { method: 'POST', body: { reason, note } });

// ---------- Admin ----------
export const getAdminStats = () => request('/api/admin/stats');
export const getAdminOrders = (status) => request(`/api/admin/orders${toQuery({ status })}`);
export const getInventory = () => request('/api/admin/inventory');
// sizes: [{ size, stock }] → the updated stock row
export const updateStock = (productId, sizes) =>
  request(`/api/admin/products/${productId}/stock`, { method: 'PATCH', body: { sizes } });
export const getAdminUsers = (search) => request(`/api/admin/users${toQuery({ search })}`);
export const getAdminUser = (id) => request(`/api/admin/users/${id}`); // with their orders
export const setUserRole = (id, role) => request(`/api/admin/users/${id}/role`, { method: 'PATCH', body: { role } });
export const setOrderStatus = (id, status) =>
  request(`/api/admin/orders/${id}/status`, { method: 'PATCH', body: { status } });
