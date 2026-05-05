import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api, { fmtBDT } from "../lib/api";
import { Send, Check, Clock } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["new", "checking", "quoted", "confirmed", "ordered", "delivered", "cancelled"];
const STATUS_STYLE = {
  new: "bg-slate-100 text-slate-700 border-slate-200",
  checking: "bg-blue-100 text-blue-800 border-blue-200",
  quoted: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-indigo-100 text-indigo-800 border-indigo-200",
  ordered: "bg-purple-100 text-purple-800 border-purple-200",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

const AdminPartRequests = () => {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ quote_bdt: 0, quote_lead_time_days: 0, supplier_note: "", admin_note: "", status: "", note: "" });

  const load = async () => {
    const { data } = await api.get("/admin/part-requests", { params: filter ? { status: filter } : {} });
    setItems(data || []);
  };
  useEffect(() => { load(); }, [filter]);

  const openEdit = (r) => {
    setEditing(r.request_id);
    setForm({
      quote_bdt: r.quote_bdt || 0,
      quote_lead_time_days: r.quote_lead_time_days || 0,
      supplier_note: r.supplier_note || "",
      admin_note: r.admin_note || "",
      status: "",
      note: "",
    });
  };

  const save = async () => {
    try {
      await api.patch(`/admin/part-requests/${editing}`, {
        ...form,
        quote_bdt: parseFloat(form.quote_bdt) || 0,
        quote_lead_time_days: parseInt(form.quote_lead_time_days) || 0,
      });
      setEditing(null);
      await load();
      toast.success("Updated");
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <div className="overline">Sourcing Desk</div>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl leading-tight mt-1">Part Requests</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          {["", ...STATUSES].map((s) => (
            <button key={s || "all"} onClick={() => setFilter(s)} data-testid={`admin-pr-filter-${s || 'all'}`}
              className={`text-xs font-semibold px-3 py-2 rounded-sm border ${filter === s ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-900"}`}>
              {s || "All"}
            </button>
          ))}
        </div>

        {items.length === 0 ? (
          <div className="industrial-card p-10 text-center text-sm text-slate-500">No part requests{filter ? ` with status "${filter}"` : ""}.</div>
        ) : (
          <div className="space-y-4">
            {items.map((r) => (
              <div key={r.request_id} className="industrial-card p-5" data-testid={`admin-pr-${r.request_id}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-xs text-slate-500">{r.request_id}</div>
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 border rounded-sm ${STATUS_STYLE[r.status] || ""}`}>{r.status}</span>
                      {r.urgency === "urgent" && <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 uppercase tracking-wider rounded-sm">Urgent</span>}
                    </div>
                    <div className="font-display text-xl mt-1">{r.part_name}{r.part_number && <span className="text-sm text-slate-500 font-mono ml-2">#{r.part_number}</span>}</div>
                    <div className="text-sm mt-1">{r.car_brand} {r.car_model} {r.car_year ? `(${r.car_year})` : ""}{r.vin_chassis && <span className="text-slate-500 font-mono text-xs ml-2">VIN: {r.vin_chassis}</span>}</div>
                    <div className="text-xs text-slate-500 mt-1">{r.company_name} · Qty {r.quantity} · Budget {r.budget_bdt ? fmtBDT(r.budget_bdt) : "—"}</div>
                    {r.notes && <div className="text-sm text-slate-600 mt-2 italic">"{r.notes}"</div>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {r.quote_bdt > 0 && (
                      <div className="text-right">
                        <div className="overline">Quoted</div>
                        <div className="font-display text-xl text-[#E11D48]">{fmtBDT(r.quote_bdt)}</div>
                        {r.quote_lead_time_days > 0 && <div className="text-xs text-slate-500">{r.quote_lead_time_days} days lead</div>}
                      </div>
                    )}
                    <button onClick={() => openEdit(r)} data-testid={`admin-pr-edit-${r.request_id}`}
                      className="text-xs font-semibold bg-slate-900 text-white px-3 py-1.5 hover:bg-[#E11D48] rounded-sm transition-colors duration-200">
                      Manage
                    </button>
                  </div>
                </div>

                {editing === r.request_id && (
                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="overline block mb-1.5">Quote (BDT)</label>
                        <input type="number" value={form.quote_bdt} onChange={(e) => setForm({ ...form, quote_bdt: e.target.value })}
                          data-testid="pr-quote-bdt" className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm" />
                      </div>
                      <div>
                        <label className="overline block mb-1.5">Lead Time (days)</label>
                        <input type="number" value={form.quote_lead_time_days} onChange={(e) => setForm({ ...form, quote_lead_time_days: e.target.value })}
                          className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="overline block mb-1.5">Supplier Note</label>
                      <input type="text" value={form.supplier_note} onChange={(e) => setForm({ ...form, supplier_note: e.target.value })}
                        placeholder="e.g. 'Guangzhou supplier, OEM grade'" className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm" />
                    </div>
                    <div>
                      <label className="overline block mb-1.5">Admin Note (internal)</label>
                      <input type="text" value={form.admin_note} onChange={(e) => setForm({ ...form, admin_note: e.target.value })}
                        className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="overline block mb-1.5">Change Status</label>
                        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                          data-testid="pr-status-select" className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm bg-white">
                          <option value="">— No change —</option>
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="overline block mb-1.5">Status Note</label>
                        <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
                          placeholder="Optional history note" className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={save} data-testid="pr-save"
                        className="inline-flex items-center gap-2 bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-semibold px-5 py-2 rounded-sm">
                        <Send className="w-4 h-4" /> Save
                      </button>
                      <button onClick={() => setEditing(null)} className="bg-white border border-slate-200 text-sm font-semibold px-5 py-2 rounded-sm">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminPartRequests;
