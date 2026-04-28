import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api, { fmtBDT, statusColor } from "../lib/api";
import { Link, useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useCart } from "../context/CartContext";
import { toast } from "sonner";

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const { add } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await api.get("/orders", { params: filter ? { status: filter } : {} });
      setOrders(data || []);
      setLoading(false);
    })();
  }, [filter]);

  const reorder = async (e, orderId) => {
    e.preventDefault();
    e.stopPropagation();
    const { data } = await api.get(`/orders/${orderId}`);
    data.items.forEach((it) => {
      add({
        product_id: it.product_id, name: it.name, sku: it.sku,
        image_url: it.image_url, price_bdt: it.price_bdt, moq: 1,
      }, it.quantity);
    });
    toast.success(`Reordered ${data.items.length} item${data.items.length > 1 ? "s" : ""}`);
    navigate("/cart");
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <div className="overline">Order History</div>
          <h1 className="font-display text-3xl lg:text-4xl mt-1">Your Orders</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          {["", "placed", "confirmed", "packed", "shipped", "delivered", "cancelled"].map((s) => (
            <button key={s || "all"} data-testid={`filter-status-${s || 'all'}`} onClick={() => setFilter(s)}
              className={`text-xs font-semibold px-3 py-2 rounded-sm border ${filter === s ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-900"}`}>
              {s ? s : "All"}
            </button>
          ))}
        </div>

        <div className="industrial-card overflow-x-auto">
          {loading ? (
            <div className="p-8 overline">Loading…</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No orders found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-5 py-3 overline">Order ID</th>
                  <th className="text-left px-5 py-3 overline">Date</th>
                  <th className="text-left px-5 py-3 overline">Items</th>
                  <th className="text-left px-5 py-3 overline">Total</th>
                  <th className="text-left px-5 py-3 overline">Status</th>
                  <th className="text-left px-5 py-3 overline">Payment</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.order_id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-3"><Link to={`/orders/${o.order_id}`} className="font-mono text-xs hover:text-[#E11D48]" data-testid={`order-link-${o.order_id}`}>{o.order_id}</Link></td>
                    <td className="px-5 py-3 text-xs">{new Date(o.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-3">{o.items.length}</td>
                    <td className="px-5 py-3 font-semibold">{fmtBDT(o.total_bdt)}</td>
                    <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 border rounded-sm ${statusColor(o.status)}`}>{o.status}</span></td>
                    <td className="px-5 py-3 text-xs uppercase">{o.payment_method} · <span className={statusColor(o.payment_status)}>{o.payment_status}</span></td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={(e) => reorder(e, o.order_id)} data-testid={`reorder-${o.order_id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-[#E11D48] transition-colors duration-200">
                        <RefreshCw className="w-3 h-3" /> Reorder
                      </button>
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

export default Orders;
