import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import api, { fmtBDT } from "../lib/api";
import { Send, Plus, Clock, CheckCircle2, XCircle, FileQuestion } from "lucide-react";
import { toast } from "sonner";

const URGENCY = ["urgent", "normal", "low"];
const STATUS_STYLE = {
  new: "bg-slate-100 text-slate-700 border-slate-200",
  checking: "bg-blue-100 text-blue-800 border-blue-200",
  quoted: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-indigo-100 text-indigo-800 border-indigo-200",
  ordered: "bg-purple-100 text-purple-800 border-purple-200",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

const PartRequest = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    car_brand: "", car_model: "", car_year: 0, vin_chassis: "",
    part_name: "", part_number: "", quantity: 1, urgency: "normal",
    budget_bdt: 0, notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/part-requests");
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.car_brand.trim() || !form.part_name.trim()) {
      toast.error("Car brand and part name required"); return;
    }
    setSubmitting(true);
    try {
      await api.post("/part-requests", {
        ...form,
        car_year: parseInt(form.car_year) || 0,
        quantity: parseInt(form.quantity) || 1,
        budget_bdt: parseFloat(form.budget_bdt) || 0,
      });
      toast.success("Part request submitted — JOY team will quote within 48h");
      setShowForm(false);
      setForm({
        car_brand: "", car_model: "", car_year: 0, vin_chassis: "",
        part_name: "", part_number: "", quantity: 1, urgency: "normal",
        budget_bdt: 0, notes: "",
      });
      await load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setSubmitting(false); }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="overline">Sourcing</div>
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl leading-tight mt-1">Request Any Part</h1>
            <p className="text-sm text-slate-600 mt-2 max-w-2xl">
              Can't find a part? Tell us what you need — car, part, quantity, urgency — we'll source it from our suppliers and quote you within 48 hours.
            </p>
          </div>
          {!showForm && (
            <button onClick={() => setShowForm(true)} data-testid="new-part-request-button"
              className="inline-flex items-center gap-2 bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-semibold px-5 py-2.5 rounded-sm transition-colors duration-200">
              <Plus className="w-4 h-4" /> New Request
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={submit} className="industrial-card p-6 space-y-5" data-testid="part-request-form">
            <div className="overline">New Request</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <F l="Car Brand *" testid="pr-brand" v={form.car_brand} on={(v) => setForm({ ...form, car_brand: v })} placeholder="Toyota / BYD / BMW" />
              <F l="Car Model *" testid="pr-model" v={form.car_model} on={(v) => setForm({ ...form, car_model: v })} placeholder="Harrier / Sealion 6" />
              <F l="Year" testid="pr-year" v={form.car_year} on={(v) => setForm({ ...form, car_year: v })} type="number" placeholder="2020" />
              <F l="VIN / Chassis" testid="pr-vin" v={form.vin_chassis} on={(v) => setForm({ ...form, vin_chassis: v })} placeholder="Optional" />
              <F l="Part Name *" testid="pr-part" v={form.part_name} on={(v) => setForm({ ...form, part_name: v })} placeholder="Cabin filter / Front wheel bearing" />
              <F l="Part Number" testid="pr-partno" v={form.part_number} on={(v) => setForm({ ...form, part_number: v })} placeholder="OEM # if known" />
              <F l="Quantity" testid="pr-qty" v={form.quantity} on={(v) => setForm({ ...form, quantity: v })} type="number" />
              <div>
                <label className="overline block mb-1.5">Urgency</label>
                <select data-testid="pr-urgency" value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}
                  className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm bg-white">
                  {URGENCY.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <F l="Budget (BDT)" testid="pr-budget" v={form.budget_bdt} on={(v) => setForm({ ...form, budget_bdt: v })} type="number" placeholder="Optional" />
            </div>
            <div>
              <label className="overline block mb-1.5">Notes</label>
              <textarea data-testid="pr-notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Any specific brand preference, condition (OEM/aftermarket), timeline…"
                className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} data-testid="submit-part-request-button"
                className="inline-flex items-center gap-2 bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-semibold px-5 py-2.5 rounded-sm transition-colors duration-200">
                <Send className="w-4 h-4" /> {submitting ? "Sending…" : "Submit Request"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="bg-white border border-slate-200 text-sm font-semibold px-5 py-2.5 rounded-sm">
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="overline">Loading…</div>
        ) : items.length === 0 ? (
          <div className="industrial-card p-10 text-center">
            <FileQuestion className="w-10 h-10 mx-auto text-slate-300" />
            <div className="font-display text-lg mt-3">No requests yet</div>
            <div className="text-sm text-slate-500 mt-1">Submit your first sourcing request above.</div>
          </div>
        ) : (
          <div className="industrial-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-5 py-3 overline">ID</th>
                  <th className="text-left px-5 py-3 overline">Car</th>
                  <th className="text-left px-5 py-3 overline">Part</th>
                  <th className="text-left px-5 py-3 overline">Qty</th>
                  <th className="text-left px-5 py-3 overline">Quote</th>
                  <th className="text-left px-5 py-3 overline">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.request_id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`pr-row-${r.request_id}`}>
                    <td className="px-5 py-3 font-mono text-xs">{r.request_id}</td>
                    <td className="px-5 py-3">{r.car_brand} {r.car_model} {r.car_year ? `(${r.car_year})` : ""}</td>
                    <td className="px-5 py-3"><div className="font-semibold">{r.part_name}</div>{r.part_number && <div className="text-xs text-slate-500 font-mono">{r.part_number}</div>}</td>
                    <td className="px-5 py-3">{r.quantity}</td>
                    <td className="px-5 py-3 font-semibold">{r.quote_bdt ? fmtBDT(r.quote_bdt) : "—"}{r.quote_lead_time_days ? <div className="text-xs text-slate-500 font-normal">{r.quote_lead_time_days} days lead</div> : null}</td>
                    <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 border rounded-sm ${STATUS_STYLE[r.status] || ""}`}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};

const F = ({ l, v, on, type = "text", placeholder, testid }) => (
  <div>
    <label className="overline block mb-1.5">{l}</label>
    <input data-testid={testid} type={type} value={v || ""} onChange={(e) => on(e.target.value)} placeholder={placeholder}
      className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]" />
  </div>
);

export default PartRequest;
