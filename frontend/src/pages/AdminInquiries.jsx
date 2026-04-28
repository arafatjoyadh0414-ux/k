import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api, { statusColor } from "../lib/api";
import { Phone, Mail, MapPin, Car } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["new", "contacted", "scheduled", "converted", "closed"];

const AdminInquiries = () => {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState(null);
  const [note, setNote] = useState("");

  const load = async () => {
    const { data } = await api.get("/admin/inquiries", { params: filter ? { status: filter } : {} });
    setItems(data || []);
  };
  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/admin/inquiries/${id}`, { status, admin_note: note });
      setEditing(null); setNote("");
      await load();
      toast.success(`Status: ${status}`);
    } catch (e) { toast.error("Failed"); }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <div className="overline">Sales Pipeline</div>
          <h1 className="font-display text-3xl lg:text-4xl mt-1">Kit Inquiries</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          {["", ...STATUSES].map((s) => (
            <button key={s || "all"} data-testid={`inq-filter-${s || 'all'}`} onClick={() => setFilter(s)}
              className={`text-xs font-semibold px-3 py-2 rounded-sm border ${filter === s ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-900"}`}>
              {s || "All"}
            </button>
          ))}
        </div>

        {items.length === 0 ? (
          <div className="industrial-card p-12 text-center text-sm text-slate-500">No inquiries{filter ? ` with status "${filter}"` : ""}.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((q) => (
              <div key={q.inquiry_id} className="industrial-card p-5" data-testid={`inq-card-${q.inquiry_id}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="overline">{new Date(q.created_at).toLocaleDateString()}</div>
                    <div className="font-display text-lg mt-0.5">{q.name}</div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-1 border rounded-sm ${statusColor(q.status === "new" ? "info" : q.status === "converted" ? "approved" : q.status === "closed" ? "rejected" : "pending")}`}>
                    {q.status}
                  </span>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-400" /> <a href={`tel:${q.phone}`} className="hover:text-[#E11D48]">{q.phone}</a></div>
                  {q.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-slate-400" /> <a href={`mailto:${q.email}`} className="hover:text-[#E11D48] truncate">{q.email}</a></div>}
                  {q.city && <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {q.city}</div>}
                  <div className="flex items-center gap-2"><Car className="w-3.5 h-3.5 text-slate-400" /> {q.car_make_model}</div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="overline mb-1">Wants</div>
                  <div className="text-sm font-semibold">{q.kit_name}</div>
                  {q.message && <div className="text-xs text-slate-600 mt-2 italic">"{q.message}"</div>}
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100">
                  {editing === q.inquiry_id ? (
                    <>
                      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Admin note (optional)"
                        className="w-full border border-slate-200 px-2 py-1 text-xs rounded-sm mb-2" />
                      <div className="grid grid-cols-2 gap-1">
                        {STATUSES.map((s) => (
                          <button key={s} onClick={() => updateStatus(q.inquiry_id, s)}
                            className="text-xs py-1.5 border border-slate-200 hover:border-[#E11D48] hover:text-[#E11D48] rounded-sm">
                            {s}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setEditing(null)} className="text-xs text-slate-500 mt-2 hover:text-slate-900">Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => setEditing(q.inquiry_id)} data-testid={`update-inq-${q.inquiry_id}`}
                      className="w-full text-xs font-semibold py-1.5 bg-slate-900 text-white hover:bg-[#E11D48] rounded-sm transition-colors duration-200">
                      Update Status
                    </button>
                  )}
                  {q.admin_note && <div className="text-xs text-slate-500 mt-2 italic">Note: {q.admin_note}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminInquiries;
