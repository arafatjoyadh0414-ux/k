import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import api, { fmtBDT, statusColor } from "../lib/api";
import { RotateCcw, Check, X, Package, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

const REFUND_METHODS = ["credit-back", "reship", "cash"];

const AdminReturns = () => {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [decisions, setDecisions] = useState({});

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/admin/returns", { params: filter ? { status: filter } : {} });
    setItems(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [filter]);

  const update = (id, patch) => setDecisions((d) => ({ ...d, [id]: { ...(d[id] || {}), ...patch } }));

  const decide = async (r, decision) => {
    const cur = decisions[r.return_id] || {};
    const refund_method = cur.refund_method || (decision === "approved" ? "credit-back" : "");
    const admin_note = cur.admin_note || "";
    if (decision === "approved" && !refund_method) {
      toast.error("Please select a refund method");
      return;
    }
    try {
      await api.patch(`/admin/returns/${r.return_id}`, { decision, refund_method, admin_note });
      toast.success(`Return ${decision}`);
      update(r.return_id, {});
      await load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="overline">RMA</div>
            <h1 className="font-display text-3xl lg:text-4xl mt-1 flex items-center gap-3">
              <RotateCcw className="w-7 h-7 text-[#E11D48]" /> Returns
            </h1>
          </div>
          <div className="flex gap-1">
            {["", "requested", "approved", "rejected", "completed"].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                data-testid={`filter-returns-${s || "all"}`}
                className={`text-xs font-semibold px-3 py-1.5 rounded-sm border transition-colors ${
                  filter === s
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-900"
                }`}
              >
                {s ? s.toUpperCase() : "ALL"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="overline">Loading…</div>
        ) : items.length === 0 ? (
          <div className="industrial-card p-12 text-center" data-testid="admin-returns-empty">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <div className="text-sm text-slate-600">No return requests yet.</div>
          </div>
        ) : (
          <div className="space-y-3" data-testid="admin-returns-list">
            {items.map((r) => {
              const open = expanded === r.return_id;
              const dec = decisions[r.return_id] || {};
              const canDecide = r.status === "requested";
              return (
                <div key={r.return_id} className="industrial-card" data-testid={`admin-return-${r.return_id}`}>
                  <button
                    onClick={() => setExpanded(open ? null : r.return_id)}
                    className="w-full text-left hover:bg-slate-50 transition-colors"
                    data-testid={`admin-return-toggle-${r.return_id}`}
                  >
                    {/* Desktop layout */}
                    <div className="hidden md:grid grid-cols-12 px-5 py-4 items-center">
                      <div className="col-span-3 min-w-0">
                        <div className="font-mono text-sm truncate">{r.return_id}</div>
                        <div className="text-xs text-slate-500">{new Date(r.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="col-span-3 min-w-0">
                        <div className="text-sm font-semibold truncate">{r.company_name}</div>
                        <Link to={`/admin/orders/${r.order_id}`} className="text-xs text-slate-500 font-mono hover:text-[#E11D48] truncate block" onClick={(e) => e.stopPropagation()}>{r.order_id}</Link>
                      </div>
                      <div className="col-span-2 text-center text-sm">{r.items?.length} items</div>
                      <div className="col-span-2 text-right font-semibold">{fmtBDT(r.refund_total_bdt)}</div>
                      <div className="col-span-2 text-right flex items-center justify-end gap-2">
                        <span className={`text-xs px-2.5 py-1 border rounded-sm ${statusColor(r.status)}`}>{r.status}</span>
                        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </div>
                    {/* Mobile layout */}
                    <div className="md:hidden p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-xs text-slate-500">{r.return_id}</div>
                          <div className="text-sm font-semibold truncate mt-0.5">{r.company_name}</div>
                          <Link to={`/admin/orders/${r.order_id}`} className="text-[10px] text-slate-500 font-mono hover:text-[#E11D48]" onClick={(e) => e.stopPropagation()}>{r.order_id}</Link>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className={`text-[10px] uppercase tracking-wider px-2 py-1 border rounded-sm ${statusColor(r.status)}`}>{r.status}</span>
                          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2">
                        <span className="text-slate-500">{r.items?.length} items · {new Date(r.created_at).toLocaleDateString()}</span>
                        <span className="font-semibold">{fmtBDT(r.refund_total_bdt)}</span>
                      </div>
                    </div>
                  </button>

                  {open && (
                    <div className="border-t border-slate-200 p-5 space-y-4 bg-slate-50">
                      {r.reason && (
                        <div>
                          <div className="overline mb-1">Reason</div>
                          <div className="text-sm">{r.reason}</div>
                        </div>
                      )}
                      <div>
                        <div className="overline mb-2">Items</div>
                        <div className="space-y-2">
                          {r.items.map((it, i) => (
                            <div key={i} className="flex items-center gap-3 bg-white p-3 border border-slate-200 rounded-sm">
                              <div className="w-12 h-12 bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                                {it.image_url && <img src={it.image_url} alt="" className="w-full h-full object-cover" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm">{it.name}</div>
                                <div className="text-xs text-slate-500 font-mono">{it.sku} · {it.quantity} × {fmtBDT(it.price_bdt)}</div>
                                {it.reason && <div className="text-xs text-slate-600 italic mt-0.5">"{it.reason}"</div>}
                              </div>
                              <div className="font-semibold text-sm">{fmtBDT(it.line_refund_bdt)}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {canDecide ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end pt-2 border-t border-slate-200">
                          <div>
                            <label className="overline block mb-1.5">Refund Method</label>
                            <select
                              data-testid={`refund-method-${r.return_id}`}
                              value={dec.refund_method || "credit-back"}
                              onChange={(e) => update(r.return_id, { refund_method: e.target.value })}
                              className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm bg-white"
                            >
                              {REFUND_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <label className="overline block mb-1.5">Admin Note</label>
                            <input
                              data-testid={`admin-note-${r.return_id}`}
                              value={dec.admin_note || ""}
                              onChange={(e) => update(r.return_id, { admin_note: e.target.value })}
                              placeholder="Internal note (optional)"
                              className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm"
                            />
                          </div>
                          <div className="md:col-span-3 flex flex-wrap gap-2">
                            <button
                              onClick={() => decide(r, "approved")}
                              data-testid={`approve-return-${r.return_id}`}
                              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-sm transition-colors"
                            >
                              <Check className="w-4 h-4" /> Approve & Refund
                            </button>
                            <button
                              onClick={() => decide(r, "rejected")}
                              data-testid={`reject-return-${r.return_id}`}
                              className="inline-flex items-center gap-1.5 bg-white border border-red-300 text-red-600 hover:bg-red-50 text-sm font-semibold px-4 py-2 rounded-sm transition-colors"
                            >
                              <X className="w-4 h-4" /> Reject
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-slate-200 text-sm">
                          <span className="overline">Decision</span>
                          <div className="mt-1">
                            <span className={`text-xs px-2.5 py-1 border rounded-sm ${statusColor(r.status)}`}>{r.status}</span>
                            {r.refund_method && <span className="ml-2 text-slate-600">via <b>{r.refund_method}</b></span>}
                          </div>
                          {r.admin_note && <div className="mt-1 text-slate-600 italic">"{r.admin_note}"</div>}
                          {r.status === "approved" && (
                            <button
                              onClick={() => decide(r, "completed")}
                              data-testid={`complete-return-${r.return_id}`}
                              className="mt-3 inline-flex items-center gap-1.5 bg-slate-900 hover:bg-[#E11D48] text-white text-xs font-semibold px-3 py-1.5 rounded-sm transition-colors"
                            >
                              Mark Completed
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminReturns;
