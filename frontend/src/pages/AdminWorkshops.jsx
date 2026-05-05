import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api, { fmtBDT, statusColor } from "../lib/api";
import { Link } from "react-router-dom";

const AdminWorkshops = () => {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("");

  const load = async () => {
    const { data } = await api.get("/admin/workshops", { params: filter ? { kyc_status: filter } : {} });
    setItems(data || []);
  };
  useEffect(() => { load(); }, [filter]);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <div className="overline">Admin</div>
          <h1 className="font-display text-3xl lg:text-4xl mt-1">Workshops</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          {["", "not_submitted", "pending", "approved", "rejected"].map((s) => (
            <button key={s || "all"} onClick={() => setFilter(s)} data-testid={`ws-filter-${s || 'all'}`}
              className={`text-xs font-semibold px-3 py-2 rounded-sm border ${filter === s ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-900"}`}>
              {s ? s.replace("_", " ") : "All"}
            </button>
          ))}
        </div>

        <div className="industrial-card overflow-hidden">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No workshops found.</div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left px-5 py-3 overline">Company</th>
                      <th className="text-left px-5 py-3 overline">Owner</th>
                      <th className="text-left px-5 py-3 overline">City</th>
                      <th className="text-left px-5 py-3 overline">KYC</th>
                      <th className="text-left px-5 py-3 overline">Credit Used / Limit</th>
                      <th className="text-left px-5 py-3 overline"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((w) => (
                      <tr key={w.workshop_id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-5 py-3 font-semibold">{w.company_name || "—"}</td>
                        <td className="px-5 py-3 text-xs">{w.owner_name}<br/><span className="text-slate-500">{w.email}</span></td>
                        <td className="px-5 py-3">{w.city || "—"}</td>
                        <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 border rounded-sm ${statusColor(w.kyc_status)}`}>{w.kyc_status?.replace("_"," ")}</span></td>
                        <td className="px-5 py-3 text-xs">{fmtBDT(w.credit_used)} / {fmtBDT(w.credit_limit)}</td>
                        <td className="px-5 py-3 text-right">
                          <Link to={`/admin/workshops/${w.workshop_id}`} className="text-xs font-semibold text-[#E11D48] hover:underline" data-testid={`ws-manage-${w.workshop_id}`}>Manage →</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {items.map((w) => (
                  <Link key={w.workshop_id} to={`/admin/workshops/${w.workshop_id}`} data-testid={`ws-manage-${w.workshop_id}`}
                    className="block p-4 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{w.company_name || "—"}</div>
                        <div className="text-xs text-slate-600 truncate mt-0.5">{w.owner_name}</div>
                        <div className="text-[10px] text-slate-500 truncate">{w.email}</div>
                        {w.city && <div className="text-[10px] text-slate-500 mt-0.5">{w.city}</div>}
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-sm flex-shrink-0 ${statusColor(w.kyc_status)}`}>{w.kyc_status?.replace("_"," ")}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-2 border-t border-slate-100 pt-2">
                      <span className="text-slate-500">Credit:</span> {fmtBDT(w.credit_used)} / {fmtBDT(w.credit_limit)}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AdminWorkshops;
