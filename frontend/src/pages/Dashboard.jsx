import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api, { fmtBDT, statusColor } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { ShieldAlert, Wallet, ArrowUpRight, Package, ShoppingCart } from "lucide-react";

const KycBanner = ({ status, onSubmit }) => {
  if (status === "approved") return null;
  const map = {
    not_submitted: { tone: "border-amber-300 bg-amber-50", text: "Complete your KYC to unlock ordering and credit." },
    pending: { tone: "border-blue-300 bg-blue-50", text: "Your KYC is under review. We'll notify you once approved." },
    rejected: { tone: "border-red-300 bg-red-50", text: "Your KYC was rejected. Please update your documents and resubmit." },
  };
  const m = map[status] || map.not_submitted;
  return (
    <div data-testid="kyc-banner" className={`border ${m.tone} rounded-sm p-4 flex items-start gap-3`}>
      <ShieldAlert className="w-5 h-5 text-amber-700 mt-0.5" />
      <div className="flex-1">
        <div className="font-semibold text-sm">{m.text}</div>
        <Link to="/profile" data-testid="kyc-banner-cta" className="text-sm text-[#E11D48] font-semibold hover:underline">
          Go to Profile & KYC →
        </Link>
      </div>
    </div>
  );
};

const StatBlock = ({ label, value, sub }) => (
  <div className="industrial-card p-5">
    <div className="overline">{label}</div>
    <div className="font-display text-3xl mt-2">{value}</div>
    {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
  </div>
);

const Dashboard = () => {
  const { user } = useAuth();
  const [ws, setWs] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [w, o] = await Promise.all([
          api.get("/workshop/me"),
          api.get("/orders"),
        ]);
        setWs(w.data.workshop);
        setOrders(o.data || []);
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <Layout><div className="overline">Loading…</div></Layout>;
  const available = (ws?.credit_limit || 0) - (ws?.credit_used || 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="overline">Welcome back</div>
            <h1 className="font-display text-3xl lg:text-4xl mt-1">{user?.name?.split(" ")[0] || "Workshop"} — your bay floor</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/products" data-testid="dashboard-shop-button"
              className="inline-flex items-center gap-2 bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-semibold px-4 py-2 rounded-sm transition-colors duration-200">
              <Package className="w-4 h-4" /> Browse Catalog
            </Link>
            <Link to="/cart" data-testid="dashboard-cart-button"
              className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-900 text-sm font-semibold px-4 py-2 rounded-sm transition-colors duration-200">
              <ShoppingCart className="w-4 h-4" /> Cart
            </Link>
          </div>
        </div>

        <KycBanner status={ws?.kyc_status || "not_submitted"} />

        {/* Credit summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="industrial-card p-5 lg:col-span-2 bg-slate-900 text-white border-slate-900">
            <div className="flex items-start justify-between">
              <div>
                <div className="overline" style={{color: "#94a3b8"}}>Credit Status</div>
                <div className="font-display text-4xl mt-2" data-testid="credit-available">{fmtBDT(available)}</div>
                <div className="text-sm text-slate-300 mt-1">Available credit</div>
              </div>
              <Wallet className="w-8 h-8 text-[#E11D48]" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="overline" style={{color: "#94a3b8"}}>Limit</div>
                <div className="font-semibold mt-1">{fmtBDT(ws?.credit_limit || 0)}</div>
              </div>
              <div>
                <div className="overline" style={{color: "#94a3b8"}}>Used</div>
                <div className="font-semibold mt-1">{fmtBDT(ws?.credit_used || 0)}</div>
              </div>
            </div>
            <div className="mt-4 h-2 bg-slate-700 overflow-hidden rounded-sm">
              <div className="h-full bg-[#E11D48]" style={{ width: ws?.credit_limit ? `${Math.min(100, (ws.credit_used / ws.credit_limit) * 100)}%` : "0%" }} />
            </div>
          </div>
          <StatBlock label="Total Orders" value={orders.length} sub="lifetime" />
          <StatBlock label="In Progress" value={orders.filter(o => !["delivered","cancelled"].includes(o.status)).length} sub="active orders" />
        </div>

        {/* Recent orders */}
        <div className="industrial-card">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <div className="overline">Recent Orders</div>
              <div className="font-display text-xl mt-1">Last 5 placed</div>
            </div>
            <Link to="/orders" className="text-sm font-semibold text-[#E11D48] hover:underline flex items-center gap-1">
              View all <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          {orders.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No orders yet. Browse the catalog to place your first.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-5 py-3 overline">Order ID</th>
                  <th className="text-left px-5 py-3 overline">Items</th>
                  <th className="text-left px-5 py-3 overline">Total</th>
                  <th className="text-left px-5 py-3 overline">Status</th>
                  <th className="text-left px-5 py-3 overline">Payment</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 5).map((o) => (
                  <tr key={o.order_id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-3"><Link to={`/orders/${o.order_id}`} className="font-mono text-xs hover:text-[#E11D48]">{o.order_id}</Link></td>
                    <td className="px-5 py-3">{o.items.length} items</td>
                    <td className="px-5 py-3 font-semibold">{fmtBDT(o.total_bdt)}</td>
                    <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 border rounded-sm ${statusColor(o.status)}`}>{o.status}</span></td>
                    <td className="px-5 py-3 text-xs uppercase">{o.payment_method}</td>
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

export default Dashboard;
