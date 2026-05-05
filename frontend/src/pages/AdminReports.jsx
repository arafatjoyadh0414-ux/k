import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api, { fmtBDT } from "../lib/api";
import { TrendingUp, DollarSign, Package, ShoppingCart, AlertTriangle, Download } from "lucide-react";

const KPI = ({ icon: Icon, label, value, sub, tone = "slate" }) => (
  <div className="industrial-card p-5">
    <div className="flex items-center justify-between">
      <div className="overline">{label}</div>
      <Icon className={`w-4 h-4 text-${tone}-400`} />
    </div>
    <div className="font-display text-3xl mt-2">{value}</div>
    {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
  </div>
);

const downloadCSV = (rows, filename) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const AdminReports = () => {
  const [r, setR] = useState(null);
  useEffect(() => {
    (async () => {
      const { data } = await api.get("/admin/reports/summary");
      setR(data);
    })();
  }, []);

  if (!r) return <Layout><div className="overline">Loading…</div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <div className="overline">Analytics</div>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl leading-tight mt-1">Reports</h1>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI icon={DollarSign} label="Revenue" value={fmtBDT(r.revenue_bdt)} />
          <KPI icon={TrendingUp} label="Profit" value={fmtBDT(r.profit_bdt)} sub={`${r.gross_margin_pct}% gross margin`} />
          <KPI icon={ShoppingCart} label="Orders" value={r.order_count} />
          <KPI icon={AlertTriangle} label="Low-stock SKUs" value={r.low_stock?.length || 0} sub="stock < 10" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="industrial-card">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="overline">Top 20 SKUs</div>
              <button onClick={() => downloadCSV(r.top_skus, "top-skus.csv")} data-testid="export-top-skus"
                className="text-xs font-semibold text-[#E11D48] hover:underline flex items-center gap-1">
                <Download className="w-3 h-3" /> CSV
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-2 overline">SKU</th>
                  <th className="text-left px-4 py-2 overline">Name</th>
                  <th className="text-right px-4 py-2 overline">Qty</th>
                  <th className="text-right px-4 py-2 overline">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {r.top_skus.map((x) => (
                  <tr key={x.sku} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-mono text-xs">{x.sku}</td>
                    <td className="px-4 py-2 truncate max-w-xs">{x.name}</td>
                    <td className="px-4 py-2 text-right">{x.quantity}</td>
                    <td className="px-4 py-2 text-right font-semibold">{fmtBDT(x.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {r.top_skus.length === 0 && <div className="p-6 text-sm text-slate-500 text-center">No orders yet.</div>}
          </div>

          <div className="industrial-card">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="overline">Top Workshops by Revenue</div>
              <button onClick={() => downloadCSV(r.top_workshops, "top-workshops.csv")} className="text-xs font-semibold text-[#E11D48] hover:underline flex items-center gap-1">
                <Download className="w-3 h-3" /> CSV
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-2 overline">Workshop</th>
                  <th className="text-right px-4 py-2 overline">Orders</th>
                  <th className="text-right px-4 py-2 overline">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {r.top_workshops.map((x) => (
                  <tr key={x.workshop_id} className="border-t border-slate-100">
                    <td className="px-4 py-2 truncate max-w-xs">{x.company_name}</td>
                    <td className="px-4 py-2 text-right">{x.orders}</td>
                    <td className="px-4 py-2 text-right font-semibold">{fmtBDT(x.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {r.top_workshops.length === 0 && <div className="p-6 text-sm text-slate-500 text-center">No orders yet.</div>}
          </div>

          <div className="industrial-card">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="overline">Revenue by Category</div>
              <button onClick={() => downloadCSV(r.by_category, "by-category.csv")} className="text-xs font-semibold text-[#E11D48] hover:underline flex items-center gap-1">
                <Download className="w-3 h-3" /> CSV
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-2 overline">Category</th>
                  <th className="text-right px-4 py-2 overline">Qty</th>
                  <th className="text-right px-4 py-2 overline">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {r.by_category.map((x) => (
                  <tr key={x.category} className="border-t border-slate-100">
                    <td className="px-4 py-2">{x.category}</td>
                    <td className="px-4 py-2 text-right">{x.quantity}</td>
                    <td className="px-4 py-2 text-right font-semibold">{fmtBDT(x.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {r.by_category.length === 0 && <div className="p-6 text-sm text-slate-500 text-center">No orders yet.</div>}
          </div>

          <div className="industrial-card">
            <div className="px-5 py-4 border-b border-slate-200 overline">Low-stock SKUs (below 10)</div>
            {r.low_stock.length === 0 ? (
              <div className="p-6 text-sm text-emerald-700 text-center">All stock levels healthy ✓</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-2 overline">SKU</th>
                    <th className="text-left px-4 py-2 overline">Name</th>
                    <th className="text-right px-4 py-2 overline">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {r.low_stock.map((x) => (
                    <tr key={x.sku} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-mono text-xs">{x.sku}</td>
                      <td className="px-4 py-2 truncate max-w-xs">{x.name}</td>
                      <td className="px-4 py-2 text-right font-semibold text-red-600">{x.stock}</td>
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

export default AdminReports;
