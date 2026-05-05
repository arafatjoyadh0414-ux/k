import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api, { fmtBDT } from "../lib/api";
import { Plus, Repeat, Pause, Play, Trash2, Zap, Calendar, Package2 } from "lucide-react";
import { toast } from "sonner";

const CADENCE_LABEL = {
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Every month",
  custom: "Custom",
};

const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch (_) {
    return iso.slice(0, 10);
  }
};

const Schedule = ({ s, products, onTogglePause, onDelete, onRunNow, onEdit }) => {
  const skuMap = Object.fromEntries(products.map((p) => [p.product_id, p]));
  const lineCount = s.items?.length || 0;
  const totalPreview = (s.items || []).reduce((sum, it) => {
    const p = skuMap[it.product_id];
    return sum + (p?.your_price_bdt || p?.price_bdt || 0) * it.quantity;
  }, 0);
  return (
    <div className="industrial-card p-4" data-testid={`schedule-${s.recurring_id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4 text-[#E11D48]" />
            <div className="font-display text-base">{s.name}</div>
            {!s.is_active && <span className="text-[10px] uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-sm">paused</span>}
            {s.is_active && <span className="text-[10px] uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-sm">active</span>}
          </div>
          <div className="text-xs text-slate-600 mt-1">
            {CADENCE_LABEL[s.cadence] || `Every ${s.cadence_days} days`} · {lineCount} item{lineCount === 1 ? "" : "s"} · ~{fmtBDT(totalPreview)}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
            <div>
              <div className="overline">Next run</div>
              <div className="font-mono mt-0.5" data-testid={`next-run-${s.recurring_id}`}>{fmtDate(s.next_run_at)}</div>
            </div>
            <div>
              <div className="overline">Last run</div>
              <div className="font-mono mt-0.5">{fmtDate(s.last_run_at)}</div>
            </div>
            <div>
              <div className="overline">Total runs</div>
              <div className="font-mono mt-0.5">{s.run_count || 0}</div>
            </div>
          </div>
          {s.last_run_status && s.last_run_status !== "ok" && (
            <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-sm">
              Last run: {s.last_run_status}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button onClick={() => onRunNow(s)} data-testid={`run-now-${s.recurring_id}`}
            className="inline-flex items-center gap-1 bg-[#E11D48] hover:bg-[#BE123C] text-white text-[11px] font-bold px-2.5 py-1.5 rounded-sm transition">
            <Zap className="w-3 h-3" /> Run now
          </button>
          <button onClick={() => onTogglePause(s)} data-testid={`toggle-pause-${s.recurring_id}`}
            className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:border-slate-900 text-slate-700 text-[11px] font-semibold px-2.5 py-1.5 rounded-sm transition">
            {s.is_active ? <><Pause className="w-3 h-3" /> Pause</> : <><Play className="w-3 h-3" /> Resume</>}
          </button>
          <button onClick={() => onDelete(s)} data-testid={`delete-schedule-${s.recurring_id}`}
            className="inline-flex items-center gap-1 text-red-600 hover:bg-red-50 text-[11px] font-semibold px-2.5 py-1.5 rounded-sm transition">
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        </div>
      </div>
      <details className="mt-3 border-t border-slate-100 pt-2">
        <summary className="text-xs text-slate-500 cursor-pointer">Items ({lineCount})</summary>
        <ul className="mt-2 space-y-1 text-xs">
          {(s.items || []).map((it, i) => {
            const p = skuMap[it.product_id];
            return (
              <li key={i} className="flex justify-between border-b border-slate-50 py-1">
                <span className="truncate">{p?.name || it.product_id}</span>
                <span className="font-mono ml-2 text-slate-600">×{it.quantity}</span>
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
};

const NewScheduleForm = ({ products, onCreate, onCancel }) => {
  const [name, setName] = useState("");
  const [cadence, setCadence] = useState("monthly");
  const [cadenceDays, setCadenceDays] = useState(30);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [shippingAddress, setShippingAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([]);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);

  const addItem = () => {
    if (!productId) return;
    const p = products.find((x) => x.product_id === productId);
    if (!p) return;
    setItems((s) => [...s, { product_id: productId, name: p.name, quantity: Math.max(qty, p.moq || 1) }]);
    setProductId("");
    setQty(1);
  };
  const removeItem = (i) => setItems((s) => s.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (items.length === 0) { toast.error("Add at least one item"); return; }
    if (!shippingAddress.trim()) { toast.error("Shipping address required"); return; }
    await onCreate({
      name, cadence, cadence_days: cadence === "custom" ? Number(cadenceDays) : 0,
      payment_method: paymentMethod, shipping_address: shippingAddress, notes,
      items: items.map(({ product_id, quantity }) => ({ product_id, quantity })),
    });
  };

  return (
    <div className="industrial-card p-5" data-testid="new-schedule-form">
      <div className="font-display text-lg mb-3">New recurring schedule</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="overline">Name (optional)</label>
          <input data-testid="schedule-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monthly oil-change kit"
            className="w-full mt-1 border border-slate-200 px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]" />
        </div>
        <div>
          <label className="overline">Cadence</label>
          <select data-testid="schedule-cadence" value={cadence} onChange={(e) => setCadence(e.target.value)}
            className="w-full mt-1 border border-slate-200 px-3 py-2 text-sm rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#E11D48]">
            <option value="weekly">Every week</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Every month</option>
            <option value="custom">Custom (days)</option>
          </select>
        </div>
        {cadence === "custom" && (
          <div>
            <label className="overline">Every N days</label>
            <input data-testid="schedule-cadence-days" type="number" min={1} value={cadenceDays}
              onChange={(e) => setCadenceDays(parseInt(e.target.value) || 1)}
              className="w-full mt-1 border border-slate-200 px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]" />
          </div>
        )}
        <div>
          <label className="overline">Payment</label>
          <select data-testid="schedule-payment" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full mt-1 border border-slate-200 px-3 py-2 text-sm rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#E11D48]">
            <option value="cod">Cash on delivery</option>
            <option value="credit">Credit (30-day)</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="overline">Shipping address</label>
          <input data-testid="schedule-address" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} placeholder="Workshop address"
            className="w-full mt-1 border border-slate-200 px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]" />
        </div>
        <div className="md:col-span-2">
          <label className="overline">Notes (optional)</label>
          <input data-testid="schedule-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full mt-1 border border-slate-200 px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]" />
        </div>
      </div>

      <div className="border-t border-slate-100 mt-4 pt-4">
        <div className="overline mb-2">Items</div>
        <div className="flex flex-col sm:flex-row gap-2">
          <select data-testid="add-product-select" value={productId} onChange={(e) => setProductId(e.target.value)}
            className="flex-1 border border-slate-200 px-3 py-2 text-sm rounded-sm bg-white">
            <option value="">Select a product…</option>
            {products.map((p) => <option key={p.product_id} value={p.product_id}>{p.name} · {p.sku}</option>)}
          </select>
          <input data-testid="add-product-qty" type="number" min={1} value={qty} onChange={(e) => setQty(parseInt(e.target.value) || 1)}
            className="w-24 border border-slate-200 px-3 py-2 text-sm rounded-sm" />
          <button onClick={addItem} disabled={!productId} data-testid="add-product-btn"
            className="bg-slate-900 hover:bg-[#E11D48] disabled:bg-slate-200 text-white text-xs font-semibold px-4 py-2 rounded-sm transition">
            <Plus className="w-3 h-3 inline" /> Add
          </button>
        </div>
        {items.length > 0 && (
          <ul className="mt-3 space-y-1">
            {items.map((it, i) => (
              <li key={i} className="flex justify-between bg-slate-50 px-3 py-1.5 text-xs rounded-sm">
                <span>{it.name}</span>
                <span className="flex items-center gap-3">
                  <span className="font-mono">×{it.quantity}</span>
                  <button onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
        <button onClick={submit} data-testid="submit-schedule"
          className="bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-bold px-5 py-2.5 rounded-sm transition">
          Create schedule
        </button>
        <button onClick={onCancel} className="text-sm text-slate-600 hover:text-slate-900 px-3 py-2.5">
          Cancel
        </button>
      </div>
    </div>
  );
};

const Recurring = () => {
  const [schedules, setSchedules] = useState([]);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [sr, pr] = await Promise.all([
        api.get("/recurring"),
        api.get("/products"),
      ]);
      setSchedules(sr.data || []);
      setProducts(pr.data || []);
    } catch (e) {
      toast.error("Could not load schedules");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const create = async (payload) => {
    try {
      await api.post("/recurring", payload);
      toast.success("Schedule created");
      setShowForm(false);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Create failed");
    }
  };

  const togglePause = async (s) => {
    try {
      await api.patch(`/recurring/${s.recurring_id}`, { is_active: !s.is_active });
      await load();
      toast.success(s.is_active ? "Paused" : "Resumed");
    } catch (e) {
      toast.error("Failed");
    }
  };

  const del = async (s) => {
    if (!window.confirm(`Delete schedule "${s.name}"?`)) return;
    try {
      await api.delete(`/recurring/${s.recurring_id}`);
      await load();
      toast.success("Deleted");
    } catch (e) {
      toast.error("Failed");
    }
  };

  const runNow = async (s) => {
    try {
      const { data } = await api.post(`/recurring/${s.recurring_id}/run-now`);
      if (data.status === "ok") toast.success(`Order ${data.order_id} placed`);
      else toast.error(data.error || "Run failed");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Run failed");
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="overline">Automation</div>
            <h1 className="font-display text-3xl lg:text-4xl mt-1" data-testid="recurring-page-title">
              Recurring orders
            </h1>
            <p className="text-sm text-slate-600 mt-2 max-w-2xl">
              Schedule weekly, biweekly, monthly, or custom-cadence orders. Joy auto-places them
              against your credit limit, applies tier pricing, and respects your KYC status.
            </p>
          </div>
          {!showForm && (
            <button onClick={() => setShowForm(true)} data-testid="new-schedule-btn"
              className="inline-flex items-center gap-2 bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-bold px-5 py-2.5 rounded-sm transition flex-shrink-0">
              <Plus className="w-4 h-4" /> New schedule
            </button>
          )}
        </div>

        {showForm && (
          <NewScheduleForm products={products} onCreate={create} onCancel={() => setShowForm(false)} />
        )}

        {loading ? (
          <div className="overline">Loading schedules…</div>
        ) : schedules.length === 0 ? (
          <div className="industrial-card p-10 text-center" data-testid="recurring-empty">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="font-display text-lg mt-3">No schedules yet</div>
            <p className="text-sm text-slate-500 mt-1">Create one to auto-stock your shop on a regular cadence.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {schedules.map((s) => (
              <Schedule key={s.recurring_id} s={s} products={products}
                onTogglePause={togglePause} onDelete={del} onRunNow={runNow} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Recurring;
