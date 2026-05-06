import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import api, { fmtBDT } from "../lib/api";
import { useCart } from "../context/CartContext";
import { Plus, Trash2, Edit3, Wrench, Car, X, Check, ShoppingCart, FileText, ChevronDown, ChevronUp } from "lucide-react";

const STATUS_LABELS = {
  open: { label: "Open", classes: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300" },
  in_progress: { label: "In progress", classes: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300" },
  completed: { label: "Completed", classes: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300" },
  cancelled: { label: "Cancelled", classes: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300" },
};

const JobCards = () => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(filter ? `/job-cards?status=${filter}` : "/job-cards");
      setCards(r.data.job_cards || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to load");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  const remove = async (j) => {
    if (!window.confirm(`Delete job card ${j.job_id}?`)) return;
    try {
      await api.delete(`/job-cards/${j.job_id}`);
      toast.success("Deleted");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const setStatus = async (j, status) => {
    try {
      await api.patch(`/job-cards/${j.job_id}`, { status });
      toast.success(`Status → ${status}`);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  return (
    <Layout>
      <div className="max-w-6xl">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400 mb-1">Workshop Management</div>
            <h1 className="text-2xl sm:text-3xl font-display tracking-tight text-zinc-900 dark:text-white">Job Cards</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">Track customer jobs, link parts to each repair, push to cart with one tap.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              data-testid="jc-filter"
              className="px-3 py-2 text-sm border border-zinc-200 dark:border-white/10 rounded-sm bg-white dark:bg-zinc-900 outline-none"
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button
              onClick={() => setShowCreate(true)}
              data-testid="jc-create-btn"
              className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-[#E11D48] text-white px-4 py-2 rounded-sm text-sm font-semibold"
            >
              <Plus className="w-4 h-4" /> New job
            </button>
          </div>
        </div>

        {showCreate && <JobCardForm onCancel={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}

        {loading ? (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</div>
        ) : cards.length === 0 ? (
          <div className="industrial-card border border-zinc-200 dark:border-white/10 rounded-sm p-8 text-center" data-testid="jc-empty">
            <Wrench className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
            <h3 className="font-display text-lg text-zinc-900 dark:text-white">No job cards yet</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Create your first job card to track repairs and link required parts.</p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="jc-list">
            {cards.map((c) => (
              <div key={c.job_id} data-testid={`jc-${c.job_id}`} className="industrial-card border border-zinc-200 dark:border-white/10 rounded-sm">
                <div className="p-4 sm:p-5 flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{c.job_id}</span>
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-sm font-semibold ${STATUS_LABELS[c.status]?.classes}`}>
                        {STATUS_LABELS[c.status]?.label}
                      </span>
                    </div>
                    <h3 className="font-display text-base sm:text-lg text-zinc-900 dark:text-white mt-1">{c.customer_name}</h3>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 inline-flex items-center gap-3 flex-wrap">
                      <span className="inline-flex items-center gap-1"><Car className="w-3 h-3" /> {c.vehicle_brand} {c.vehicle_model}{c.vehicle_year ? ` ${c.vehicle_year}` : ""}{c.vehicle_plate ? ` · ${c.vehicle_plate}` : ""}</span>
                      {c.mechanic_name && <span>· Mechanic: {c.mechanic_name}</span>}
                    </div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-2 line-clamp-2"><strong className="text-zinc-900 dark:text-white">Complaint:</strong> {c.complaint}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg text-zinc-900 dark:text-white">{fmtBDT(c.total_bdt)}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{c.parts_count} parts</div>
                  </div>
                </div>
                {expanded === c.job_id && <JobCardExpanded card={c} onChange={load} />}
                <div className="flex items-center justify-between border-t border-zinc-200 dark:border-white/10 px-4 sm:px-5 py-2 flex-wrap gap-2">
                  <button onClick={() => setExpanded(expanded === c.job_id ? null : c.job_id)} className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-[#E11D48] inline-flex items-center gap-1">
                    {expanded === c.job_id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {expanded === c.job_id ? "Hide details" : "Details, parts, push to cart"}
                  </button>
                  <div className="flex items-center gap-2">
                    {c.status === "open" && <button onClick={() => setStatus(c, "in_progress")} className="text-xs font-semibold border border-zinc-200 dark:border-white/10 hover:border-[#E11D48] hover:text-[#E11D48] px-3 py-1 rounded-sm transition-colors" data-testid={`jc-start-${c.job_id}`}>Start</button>}
                    {c.status === "in_progress" && <button onClick={() => setStatus(c, "completed")} className="text-xs font-semibold border border-zinc-200 dark:border-white/10 hover:border-emerald-500 hover:text-emerald-500 px-3 py-1 rounded-sm transition-colors" data-testid={`jc-complete-${c.job_id}`}>Mark complete</button>}
                    <button onClick={() => remove(c)} className="text-xs font-semibold text-zinc-500 hover:text-[#E11D48] px-2 py-1" data-testid={`jc-delete-${c.job_id}`}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

const JobCardExpanded = ({ card, onChange }) => {
  const [editingParts, setEditingParts] = useState(false);
  const [parts, setParts] = useState(card.parts || []);
  const [skuInput, setSkuInput] = useState("");
  const [qtyInput, setQtyInput] = useState(1);
  const [labour, setLabour] = useState(card.labour_charge_bdt || 0);
  const [pushing, setPushing] = useState(false);
  const { addItem } = useCart();
  const navigate = useNavigate();

  const lookupAndAddSku = async () => {
    const sku = skuInput.trim();
    if (!sku) return;
    try {
      const r = await api.get(`/products?search=${encodeURIComponent(sku)}`);
      const p = (r.data || []).find((x) => x.sku?.toLowerCase() === sku.toLowerCase()) || (r.data || [])[0];
      if (!p) {
        toast.error(`SKU ${sku} not found`);
        return;
      }
      setParts((arr) => [...arr, { sku: p.sku, name: p.name, quantity: parseInt(qtyInput, 10) || 1, price_bdt: p.your_price_bdt || p.price_bdt, source: "catalog" }]);
      setSkuInput("");
      setQtyInput(1);
    } catch (e) { toast.error("Lookup failed"); }
  };

  const removePart = (i) => setParts((arr) => arr.filter((_, idx) => idx !== i));
  const updateQty = (i, q) => setParts((arr) => arr.map((p, idx) => (idx === i ? { ...p, quantity: parseInt(q, 10) || 0 } : p)));

  const saveParts = async () => {
    try {
      await api.patch(`/job-cards/${card.job_id}`, { parts, labour_charge_bdt: parseFloat(labour) || 0 });
      toast.success("Job card updated");
      setEditingParts(false);
      onChange();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const pushToCart = async () => {
    setPushing(true);
    try {
      const r = await api.post(`/job-cards/${card.job_id}/to-cart`);
      const items = r.data.items || [];
      if (!items.length) {
        toast.error("No parts on this job card");
        return;
      }
      items.forEach((item) => addItem(item, item.quantity));
      toast.success(`${items.length} part${items.length !== 1 ? "s" : ""} pushed to cart`);
      if (r.data.missing_skus?.length) {
        toast.warning(`${r.data.missing_skus.length} SKU(s) missing from catalog — open Request Any Part`);
      }
      navigate("/cart");
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setPushing(false); }
  };

  return (
    <div className="border-t border-zinc-200 dark:border-white/10 px-4 sm:px-5 py-4 bg-zinc-50 dark:bg-white/[0.02]">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-display text-sm text-zinc-900 dark:text-white">Required parts</h4>
        {!editingParts ? (
          <button onClick={() => setEditingParts(true)} className="text-xs font-semibold text-[#E11D48] inline-flex items-center gap-1" data-testid={`jc-edit-parts-${card.job_id}`}><Edit3 className="w-3 h-3" /> Edit</button>
        ) : (
          <div className="flex gap-2">
            <button onClick={saveParts} className="text-xs font-semibold bg-zinc-900 dark:bg-[#E11D48] text-white px-3 py-1 rounded-sm" data-testid={`jc-save-parts-${card.job_id}`}>Save</button>
            <button onClick={() => { setEditingParts(false); setParts(card.parts || []); }} className="text-xs font-semibold text-zinc-500">Cancel</button>
          </div>
        )}
      </div>
      {parts.length === 0 ? (
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">No parts added yet.</div>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-white/10 mb-3">
          {parts.map((p, i) => (
            <li key={i} className="py-2 flex items-center gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-zinc-900 dark:text-white truncate">{p.name || p.sku}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{p.sku}</div>
              </div>
              {editingParts ? (
                <input value={p.quantity} onChange={(e) => updateQty(i, e.target.value)} type="number" min="1" className="w-16 px-2 py-1 text-sm border border-zinc-200 dark:border-white/10 rounded-sm bg-white dark:bg-zinc-900 outline-none" />
              ) : (
                <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">× {p.quantity}</span>
              )}
              <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 w-24 text-right">{fmtBDT((p.price_bdt || 0) * p.quantity)}</span>
              {editingParts && <button onClick={() => removePart(i)} className="text-zinc-500 hover:text-[#E11D48]"><X className="w-4 h-4" /></button>}
            </li>
          ))}
        </ul>
      )}
      {editingParts && (
        <div className="grid grid-cols-12 gap-2 mb-3">
          <input value={skuInput} onChange={(e) => setSkuInput(e.target.value)} placeholder="Add SKU (e.g. JA-BRK-001)" className="col-span-7 px-3 py-2 text-sm border border-zinc-200 dark:border-white/10 rounded-sm bg-white dark:bg-zinc-900 outline-none focus:border-[#E11D48]" data-testid={`jc-sku-input-${card.job_id}`} />
          <input value={qtyInput} onChange={(e) => setQtyInput(e.target.value)} type="number" min="1" placeholder="Qty" className="col-span-2 px-3 py-2 text-sm border border-zinc-200 dark:border-white/10 rounded-sm bg-white dark:bg-zinc-900 outline-none focus:border-[#E11D48]" />
          <button onClick={lookupAndAddSku} className="col-span-3 inline-flex items-center justify-center gap-1 bg-zinc-900 dark:bg-[#E11D48] text-white px-3 py-2 rounded-sm text-sm font-semibold" data-testid={`jc-add-sku-${card.job_id}`}><Plus className="w-3 h-3" /> Add</button>
        </div>
      )}
      {editingParts && (
        <div className="flex items-center gap-2 mb-3">
          <label className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Labour ৳</label>
          <input value={labour} onChange={(e) => setLabour(e.target.value)} type="number" min="0" className="w-32 px-3 py-1.5 text-sm border border-zinc-200 dark:border-white/10 rounded-sm bg-white dark:bg-zinc-900 outline-none focus:border-[#E11D48]" />
        </div>
      )}
      <button onClick={pushToCart} disabled={pushing || !card.parts?.length} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#E11D48] hover:bg-[#BE123C] text-white px-5 py-2 rounded-sm text-sm font-semibold disabled:opacity-50" data-testid={`jc-push-cart-${card.job_id}`}>
        <ShoppingCart className="w-4 h-4" /> {pushing ? "Pushing…" : "Push parts to cart"}
      </button>
      <ShareJobCardActions card={card} />
    </div>
  );
};

const ShareJobCardActions = ({ card }) => {
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const generate = async () => {
    try {
      const r = await api.get(`/job-cards/${card.job_id}/share`);
      setShareUrl(r.data.share_url);
      navigator.clipboard?.writeText(r.data.share_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Share link copied");
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  const pdfUrl = `${process.env.REACT_APP_BACKEND_URL}/api/job-cards/${card.job_id}/pdf`;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
      <button
        onClick={generate}
        className="inline-flex items-center gap-1.5 border border-zinc-200 dark:border-white/10 hover:border-[#E11D48] hover:text-[#E11D48] text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-sm font-semibold transition-colors"
        data-testid={`jc-share-${card.job_id}`}
      >
        {copied ? "Link copied ✓" : "Share with customer"}
      </button>
      <a
        href={pdfUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 border border-zinc-200 dark:border-white/10 hover:border-[#E11D48] hover:text-[#E11D48] text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-sm font-semibold transition-colors"
        data-testid={`jc-pdf-${card.job_id}`}
      >
        Download PDF
      </a>
      {shareUrl && (
        <a href={shareUrl} target="_blank" rel="noreferrer" className="text-zinc-500 dark:text-zinc-400 underline truncate max-w-xs">{shareUrl}</a>
      )}
    </div>
  );
};

const JobCardForm = ({ onCancel, onSaved }) => {
  const [form, setForm] = useState({
    customer_name: "", customer_phone: "",
    vehicle_brand: "", vehicle_model: "", vehicle_year: "", vehicle_plate: "", vin: "",
    complaint: "", mechanic_name: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const f = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        vehicle_year: form.vehicle_year ? parseInt(form.vehicle_year, 10) : null,
      };
      await api.post("/job-cards", payload);
      toast.success("Job card created");
      onSaved();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };

  const inp = "px-3 py-2 text-sm border border-zinc-200 dark:border-white/10 rounded-sm bg-white dark:bg-zinc-900 outline-none focus:border-[#E11D48]";
  return (
    <form onSubmit={submit} data-testid="jc-form" className="industrial-card border border-zinc-200 dark:border-white/10 rounded-sm p-5 mb-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input required value={form.customer_name} onChange={(e) => f("customer_name", e.target.value)} placeholder="Customer name *" className={inp} data-testid="jc-form-customer" />
        <input value={form.customer_phone} onChange={(e) => f("customer_phone", e.target.value)} placeholder="Phone (optional)" className={inp} />
      </div>
      <div className="grid grid-cols-12 gap-2">
        <input required value={form.vehicle_brand} onChange={(e) => f("vehicle_brand", e.target.value)} placeholder="Brand *" className={`${inp} col-span-6 sm:col-span-3`} />
        <input required value={form.vehicle_model} onChange={(e) => f("vehicle_model", e.target.value)} placeholder="Model *" className={`${inp} col-span-6 sm:col-span-3`} />
        <input value={form.vehicle_year} onChange={(e) => f("vehicle_year", e.target.value)} type="number" placeholder="Year" className={`${inp} col-span-4 sm:col-span-2`} />
        <input value={form.vehicle_plate} onChange={(e) => f("vehicle_plate", e.target.value)} placeholder="Plate" className={`${inp} col-span-8 sm:col-span-4`} />
      </div>
      <input value={form.vin} onChange={(e) => f("vin", e.target.value)} placeholder="VIN (17 chars, optional)" maxLength="17" className={`${inp} w-full font-mono`} />
      <textarea required value={form.complaint} onChange={(e) => f("complaint", e.target.value)} placeholder="Complaint / symptoms *" rows="2" className={`${inp} w-full resize-none`} data-testid="jc-form-complaint" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input value={form.mechanic_name} onChange={(e) => f("mechanic_name", e.target.value)} placeholder="Mechanic" className={inp} />
        <input value={form.notes} onChange={(e) => f("notes", e.target.value)} placeholder="Notes" className={inp} />
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-[#E11D48] text-white px-5 py-2 rounded-sm text-sm font-semibold disabled:opacity-50" data-testid="jc-form-submit">
          <Check className="w-4 h-4" /> {saving ? "Saving…" : "Create job"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-zinc-500 hover:text-[#E11D48] px-3 py-2">Cancel</button>
      </div>
    </form>
  );
};

export default JobCards;
