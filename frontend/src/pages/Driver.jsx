import React, { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Bike, Phone, MapPin, Package2, CheckCircle2, Truck, RefreshCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "../components/ui/sonner";

const BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmtBDT = (n) => `৳${(Number(n) || 0).toLocaleString("en-IN")}`;

const StatusPill = ({ s }) => {
  const map = {
    packed: "bg-amber-100 text-amber-800 border-amber-200",
    shipped: "bg-blue-100 text-blue-800 border-blue-200",
    delivered: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded border ${map[s] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
      {s}
    </span>
  );
};

const OrderCard = ({ o, onUpdate, busy }) => {
  const [showItems, setShowItems] = useState(false);
  const isPacked = o.status === "packed";
  const isShipped = o.status === "shipped";
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm" data-testid={`driver-order-${o.order_id}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono text-xs text-slate-500">{o.order_id}</div>
        <StatusPill s={o.status} />
      </div>
      <div className="font-display text-base leading-tight">{o.company_name}</div>
      {o.city && <div className="text-xs text-slate-500 mt-0.5">{o.city}</div>}
      <div className="flex items-start gap-2 mt-3 text-sm">
        <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 leading-snug">{o.shipping_address}</div>
      </div>
      {o.contact_phone && (
        <a href={`tel:${o.contact_phone}`} className="inline-flex items-center gap-1.5 text-sm text-[#E11D48] font-semibold mt-2" data-testid={`driver-call-${o.order_id}`}>
          <Phone className="w-4 h-4" /> {o.contact_phone}
        </a>
      )}
      <div className="flex items-center gap-3 mt-3 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1"><Package2 className="w-3.5 h-3.5" /> {o.item_count || 0} items</span>
        <span>· {fmtBDT(o.total_bdt)}</span>
        <span className={`uppercase tracking-wider ${o.payment_method === "cod" ? "text-amber-700 font-bold" : "text-slate-500"}`}>
          · {o.payment_method === "cod" ? "COLLECT COD" : "credit"}
        </span>
      </div>
      <button onClick={() => setShowItems((v) => !v)} className="text-xs text-slate-500 mt-2 underline" data-testid={`driver-toggle-items-${o.order_id}`}>
        {showItems ? "Hide" : "Show"} items
      </button>
      {showItems && (
        <ul className="mt-2 space-y-1 text-xs text-slate-600 border-t border-slate-100 pt-2">
          {(o.items || []).map((it, i) => (
            <li key={i} className="flex justify-between">
              <span className="truncate">{it.name}</span>
              <span className="font-mono ml-2">×{it.quantity}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 mt-4">
        {isPacked && (
          <button onClick={() => onUpdate(o.order_id, "shipped")} disabled={busy}
            data-testid={`driver-action-shipped-${o.order_id}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5 rounded-md transition disabled:opacity-50">
            <Truck className="w-4 h-4" /> Picked up · Out for delivery
          </button>
        )}
        {isShipped && (
          <button onClick={() => onUpdate(o.order_id, "delivered")} disabled={busy}
            data-testid={`driver-action-delivered-${o.order_id}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2.5 rounded-md transition disabled:opacity-50">
            <CheckCircle2 className="w-4 h-4" /> Mark delivered
          </button>
        )}
      </div>
    </div>
  );
};

export default function Driver() {
  const { driverId } = useParams();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState(false);

  const load = useCallback(async () => {
    if (!token) { setAuthError(true); setLoading(false); return; }
    setLoading(true);
    try {
      const [pr, or] = await Promise.all([
        axios.get(`${BASE}/driver/${driverId}/profile`, { params: { token } }),
        axios.get(`${BASE}/driver/${driverId}/orders`, { params: { token } }),
      ]);
      setProfile(pr.data);
      setOrders(or.data || []);
      setAuthError(false);
    } catch (e) {
      if (e.response?.status === 401 || e.response?.status === 404) {
        setAuthError(true);
      } else {
        toast.error("Could not load. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [driverId, token]);

  useEffect(() => { load(); }, [load]);

  const onUpdate = async (orderId, status) => {
    if (!window.confirm(`Mark this order as ${status.toUpperCase()}?`)) return;
    setBusy(true);
    try {
      await axios.patch(
        `${BASE}/driver/${driverId}/orders/${orderId}/status`,
        { status, note: "" },
        { params: { token } },
      );
      toast.success(`Order ${status}`);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Update failed");
    } finally {
      setBusy(false);
    }
  };

  if (authError) {
    return (
      <div className="min-h-screen bg-slate-50 grid place-items-center px-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6 max-w-sm text-center" data-testid="driver-auth-error">
          <ShieldAlert className="w-10 h-10 text-[#E11D48] mx-auto" />
          <div className="font-display text-lg mt-3">Link not valid</div>
          <p className="text-sm text-slate-600 mt-2">Ask the JOY Automart admin for a fresh link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Toaster richColors position="top-center" />
      <header className="bg-slate-950 text-white px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Bike className="w-6 h-6 text-[#E11D48]" />
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Driver Portal</div>
            <div className="font-display text-base leading-tight" data-testid="driver-name">
              {profile?.name || "—"}
            </div>
          </div>
          <button onClick={load} disabled={loading} data-testid="driver-refresh"
            className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-md disabled:opacity-50">
            <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>
      <main className="px-4 pt-4 space-y-3 max-w-md mx-auto" data-testid="driver-orders-list">
        <div className="flex items-center justify-between">
          <div className="font-display text-lg">Active deliveries</div>
          <div className="text-xs text-slate-500">{orders.length} active</div>
        </div>
        {loading && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-slate-500 text-sm">Loading…</div>
        )}
        {!loading && orders.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 text-center" data-testid="driver-empty">
            <Package2 className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="font-display text-base mt-2">No active orders</div>
            <p className="text-sm text-slate-500 mt-1">Pull to refresh when you get a new assignment.</p>
          </div>
        )}
        {!loading && orders.map((o) => (
          <OrderCard key={o.order_id} o={o} onUpdate={onUpdate} busy={busy} />
        ))}
      </main>
    </div>
  );
}
