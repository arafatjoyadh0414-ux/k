import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api, { fmtBDT, statusColor } from "../lib/api";
import { Link } from "react-router-dom";

const AdminOrders = () => {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/orders", { params: filter ? { status: filter } : {} });
      setItems(data || []);
    })();
  }, [filter]);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <div className="overline">Admin</div>
          <h1 className="font-display text-3xl lg:text-4xl mt-1">All Orders</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          {["", "placed", "confirmed", "packed", "shipped", "delivered", "cancelled"].map((s) => (
            <button key={s || "all"} onClick={() => setFilter(s)}
              data-testid={`admin-orders-filter-${s || 'all'}`}
              className={`text-xs font-semibold px-3 py-2 rounded-sm border ${filter === s ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-900"}`}>
              {s || "All"}
            </button>
          ))}
        </div>

        <div className="industrial-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-5 py-3 overline">Order</th>
                <th className="text-left px-5 py-3 overline">Workshop</th>
                <th className="text-left px-5 py-3 overline">Date</th>
                <th className="text-left px-5 py-3 overline">Total</th>
                <th className="text-left px-5 py-3 overline">Status</th>
                <th className="text-left px-5 py-3 overline">Payment</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.order_id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono text-xs">{o.order_id}</td>
                  <td className="px-5 py-3">{o.company_name}</td>
                  <td className="px-5 py-3 text-xs">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3 font-semibold">{fmtBDT(o.total_bdt)}</td>
                  <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 border rounded-sm ${statusColor(o.status)}`}>{o.status}</span></td>
                  <td className="px-5 py-3 text-xs uppercase">{o.payment_method} · <span className={statusColor(o.payment_status)}>{o.payment_status}</span></td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/admin/orders/${o.order_id}`} className="text-xs font-semibold text-[#E11D48] hover:underline" data-testid={`admin-order-manage-${o.order_id}`}>Manage →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <div className="p-8 text-center text-sm text-slate-500">No orders.</div>}
        </div>
      </div>
    </Layout>
  );
};

export default AdminOrders;
