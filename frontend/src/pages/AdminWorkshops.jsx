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

        <div className="industrial-card overflow-x-auto">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No workshops found.</div>
          ) : (
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
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AdminWorkshops;
