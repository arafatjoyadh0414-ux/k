import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";
import { Plus, Trash2, Edit, Star } from "lucide-react";
import { toast } from "sonner";

const empty = {
  name: "", country: "", contact_person: "", phone_whatsapp: "", email: "",
  categories: [], moq: "", lead_time_days: 0, payment_terms: "", rating: 0, notes: "",
};

const AdminSuppliers = () => {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [categoriesStr, setCategoriesStr] = useState("");

  const load = async () => {
    const { data } = await api.get("/admin/suppliers");
    setItems(data || []);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditing("new"); setForm(empty); setCategoriesStr(""); };
  const startEdit = (s) => {
    setEditing(s.supplier_id);
    setForm({ ...s });
    setCategoriesStr((s.categories || []).join(", "));
  };
  const cancel = () => { setEditing(null); setForm(empty); setCategoriesStr(""); };

  const save = async () => {
    const payload = {
      ...form,
      lead_time_days: parseInt(form.lead_time_days) || 0,
      rating: parseInt(form.rating) || 0,
      categories: categoriesStr.split(",").map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (editing === "new") await api.post("/admin/suppliers", payload);
      else await api.put(`/admin/suppliers/${editing}`, payload);
      cancel();
      await load();
      toast.success("Saved");
    } catch (e) { toast.error("Failed"); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this supplier?")) return;
    await api.delete(`/admin/suppliers/${id}`);
    await load();
    toast.success("Deleted");
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="overline">Network</div>
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl leading-tight mt-1">Suppliers</h1>
          </div>
          <button onClick={startNew} data-testid="new-supplier-button"
            className="inline-flex items-center gap-2 bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-semibold px-4 py-2 rounded-sm">
            <Plus className="w-4 h-4" /> Add Supplier
          </button>
        </div>

        {editing && (
          <div className="industrial-card p-5 space-y-4">
            <div className="overline">{editing === "new" ? "New Supplier" : "Edit Supplier"}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <F l="Name *" testid="sup-name" v={form.name} on={(v) => setForm({ ...form, name: v })} />
              <F l="Country" testid="sup-country" v={form.country} on={(v) => setForm({ ...form, country: v })} placeholder="China / India / BD" />
              <F l="Contact Person" testid="sup-contact" v={form.contact_person} on={(v) => setForm({ ...form, contact_person: v })} />
              <F l="Phone / WhatsApp" testid="sup-phone" v={form.phone_whatsapp} on={(v) => setForm({ ...form, phone_whatsapp: v })} />
              <F l="Email" testid="sup-email" v={form.email} on={(v) => setForm({ ...form, email: v })} type="email" />
              <F l="MOQ" testid="sup-moq" v={form.moq} on={(v) => setForm({ ...form, moq: v })} placeholder="e.g. 5 kits" />
              <F l="Lead Time (days)" testid="sup-lead" v={form.lead_time_days} on={(v) => setForm({ ...form, lead_time_days: v })} type="number" />
              <F l="Payment Terms" testid="sup-pay" v={form.payment_terms} on={(v) => setForm({ ...form, payment_terms: v })} placeholder="e.g. 30% advance, 70% BL" />
              <F l="Rating (1-5)" testid="sup-rating" v={form.rating} on={(v) => setForm({ ...form, rating: v })} type="number" />
              <F l="Categories (comma-separated)" testid="sup-cats" v={categoriesStr} on={setCategoriesStr} placeholder="Brake, Engine, Body Kits" className="lg:col-span-2" />
            </div>
            <div>
              <label className="overline block mb-1.5">Notes</label>
              <textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={save} data-testid="save-supplier-button" className="bg-slate-900 hover:bg-[#E11D48] text-white text-sm font-semibold px-5 py-2 rounded-sm transition-colors duration-200">Save</button>
              <button onClick={cancel} className="bg-white border border-slate-200 text-sm font-semibold px-5 py-2 rounded-sm">Cancel</button>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="industrial-card p-10 text-center text-sm text-slate-500">No suppliers yet. Add your first above.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((s) => (
              <div key={s.supplier_id} className="industrial-card p-5" data-testid={`sup-card-${s.supplier_id}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-display text-lg">{s.name}</div>
                    {s.country && <div className="text-xs text-slate-500">{s.country}</div>}
                  </div>
                  {s.rating > 0 && (
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={`w-3.5 h-3.5 ${n <= s.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                      ))}
                    </div>
                  )}
                </div>
                {s.contact_person && <div className="text-sm mt-2">{s.contact_person}</div>}
                {s.phone_whatsapp && <div className="text-xs text-slate-500">{s.phone_whatsapp}</div>}
                {s.email && <div className="text-xs text-slate-500">{s.email}</div>}
                {s.categories?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {s.categories.map((c) => (
                      <span key={c} className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-sm">{c}</span>
                    ))}
                  </div>
                )}
                <div className="flex gap-4 text-xs text-slate-500 mt-3">
                  {s.moq && <div>MOQ: {s.moq}</div>}
                  {s.lead_time_days > 0 && <div>Lead: {s.lead_time_days}d</div>}
                </div>
                {s.payment_terms && <div className="text-xs text-slate-500 mt-1">Terms: {s.payment_terms}</div>}
                <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                  <button onClick={() => startEdit(s)} className="text-xs font-semibold text-slate-600 hover:text-[#E11D48] flex items-center gap-1" data-testid={`edit-sup-${s.supplier_id}`}>
                    <Edit className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => del(s.supplier_id)} className="text-xs font-semibold text-slate-600 hover:text-red-600 flex items-center gap-1" data-testid={`del-sup-${s.supplier_id}`}>
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

const F = ({ l, v, on, type = "text", placeholder, testid, className = "" }) => (
  <div className={className}>
    <label className="overline block mb-1.5">{l}</label>
    <input data-testid={testid} type={type} value={v || ""} onChange={(e) => on(e.target.value)} placeholder={placeholder}
      className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]" />
  </div>
);

export default AdminSuppliers;
