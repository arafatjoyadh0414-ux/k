import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api, { fmtBDT, statusColor } from "../lib/api";
import { ShieldCheck, Users, ClipboardList, Wallet, Package } from "lucide-react";
import { Link } from "react-router-dom";

const Stat = ({ icon: Icon, label, value }) => (
  <div className="industrial-card p-5">
    <div className="flex items-center justify-between">
      <div className="overline">{label}</div>
      <Icon className="w-4 h-4 text-slate-400" />
    </div>
    <div className="font-display text-3xl mt-2">{value}</div>
  </div>
);

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [pendingKyc, setPendingKyc] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);

  useEffect(() => {
    (async () => {
      const [s, w, o] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/workshops", { params: { kyc_status: "pending" } }),
        api.get("/orders"),
      ]);
      setStats(s.data);
      setPendingKyc(w.data || []);
      setRecentOrders(o.data || []);
    })();
  }, []);

  if (!stats) return <Layout><div className="overline">Loading…</div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <div className="overline">Operations</div>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl leading-tight mt-1">Admin Console</h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Stat icon={Users} label="Workshops" value={stats.total_workshops} />
          <Stat icon={ShieldCheck} label="Approved" value={stats.approved_workshops} />
          <Stat icon={ShieldCheck} label="Pending KYC" value={stats.pending_kyc} />
          <Stat icon={ClipboardList} label="Orders" value={stats.total_orders} />
          <Stat icon={ClipboardList} label="In-Progress" value={stats.pending_orders} />
          <Stat icon={Wallet} label="Revenue" value={fmtBDT(stats.total_revenue_bdt)} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="industrial-card">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="overline">Pending KYC Reviews</div>
              <Link to="/admin/workshops" className="text-xs font-semibold text-[#E11D48] hover:underline">All workshops →</Link>
            </div>
            {pendingKyc.length === 0 ? (
              <div className="p-6 text-sm text-slate-500 text-center">No KYC pending</div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {pendingKyc.slice(0, 5).map((w) => (
                    <tr key={w.workshop_id} className="border-t border-slate-100">
                      <td className="px-5 py-3">
                        <div className="font-semibold">{w.company_name || "—"}</div>
                        <div className="text-xs text-slate-500">{w.email}</div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link to={`/admin/workshops/${w.workshop_id}`} className="text-xs font-semibold text-[#E11D48] hover:underline">Review</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="industrial-card">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="overline">Recent Orders</div>
              <Link to="/admin/orders" className="text-xs font-semibold text-[#E11D48] hover:underline">All orders →</Link>
            </div>
            {recentOrders.length === 0 ? (
              <div className="p-6 text-sm text-slate-500 text-center">No orders yet</div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {recentOrders.slice(0, 6).map((o) => (
                    <tr key={o.order_id} className="border-t border-slate-100">
                      <td className="px-5 py-3">
                        <Link to={`/admin/orders/${o.order_id}`} className="font-mono text-xs hover:text-[#E11D48]">{o.order_id}</Link>
                        <div className="text-xs text-slate-500">{o.company_name}</div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="font-semibold">{fmtBDT(o.total_bdt)}</div>
                        <span className={`text-[10px] px-2 py-0.5 border rounded-sm ${statusColor(o.status)}`}>{o.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
