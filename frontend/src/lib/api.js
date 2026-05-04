import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const TOKEN_KEY = "ja_session_token";

export const getStoredToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
};

export const setStoredToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (_) { /* ignore */ }
};

const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

// Attach Bearer token from localStorage on every request as a fallback to the
// session_token cookie. Required when frontend and backend live on different
// domains (e.g. custom domain b2bjoymart.com) where the cross-site cookie may
// not be persisted by the browser.
api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers = config.headers || {};
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default api;

export const fmtBDT = (n) => {
  const num = Number(n || 0);
  return "৳ " + num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
};

export const statusColor = (s) => {
  const m = {
    placed: "bg-blue-100 text-blue-800 border-blue-200",
    confirmed: "bg-indigo-100 text-indigo-800 border-indigo-200",
    packed: "bg-amber-100 text-amber-800 border-amber-200",
    shipped: "bg-purple-100 text-purple-800 border-purple-200",
    delivered: "bg-emerald-100 text-emerald-800 border-emerald-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
    not_submitted: "bg-slate-100 text-slate-700 border-slate-200",
    paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
    unpaid: "bg-amber-100 text-amber-800 border-amber-200",
    requested: "bg-amber-100 text-amber-800 border-amber-200",
    completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };
  return m[s] || "bg-slate-100 text-slate-700 border-slate-200";
};

export const downloadInvoice = async (orderId) => {
  const res = await api.get(`/orders/${orderId}/invoice.pdf`, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoice-${orderId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};
