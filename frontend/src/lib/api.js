import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  withCredentials: true,
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
  };
  return m[s] || "bg-slate-100 text-slate-700 border-slate-200";
};
