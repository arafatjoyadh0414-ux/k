import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "../components/Layout";
import api, { fmtBDT, statusColor } from "../lib/api";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";

const FLOW = ["placed", "confirmed", "packed", "shipped", "delivered"];

const OrderDetail = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data);
    })();
  }, [id]);

  if (!order) return <Layout><div className="overline">Loading…</div></Layout>;

  const currentIdx = FLOW.indexOf(order.status);
  const isPendingPayment = order.status === "pending_payment";

  return (
    <Layout>
      <div className="space-y-6">
        <Link to="/orders" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-[#E11D48]">
          <ArrowLeft className="w-4 h-4" /> Back to orders
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="overline">Order</div>
            <h1 className="font-display text-3xl mt-1 font-mono">{order.order_id}</h1>
            <div className="text-xs text-slate-500 mt-1">Placed {new Date(order.created_at).toLocaleString()}</div>
          </div>
          <div className="flex gap-2">
            <span className={`text-xs px-3 py-1.5 border rounded-sm ${statusColor(order.status)}`}>{order.status}</span>
            <span className={`text-xs px-3 py-1.5 border rounded-sm ${statusColor(order.payment_status)}`}>
              {order.payment_method.toUpperCase()} · {order.payment_status}
            </span>
          </div>
        </div>

        {/* Timeline */}
        <div className="industrial-card p-5">
          <div className="overline mb-4">Tracking</div>
          {order.status === "cancelled" ? (
            <div className="text-sm text-red-600">This order was cancelled.</div>
          ) : isPendingPayment ? (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-sm">
              Awaiting online payment. Tracking begins once payment is received.
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              {FLOW.map((s, i) => {
                const reached = i <= currentIdx;
                const histEntry = order.status_history?.find(h => h.status === s);
                return (
                  <div key={s} className="flex-1 text-center relative">
                    {i > 0 && (
                      <div className={`absolute top-3 left-0 right-1/2 h-0.5 ${i <= currentIdx ? "bg-[#E11D48]" : "bg-slate-200"}`} />
                    )}
                    {i < FLOW.length - 1 && (
                      <div className={`absolute top-3 left-1/2 right-0 h-0.5 ${i < currentIdx ? "bg-[#E11D48]" : "bg-slate-200"}`} />
                    )}
                    <div className="relative inline-block">
                      {reached ? <CheckCircle2 className="w-7 h-7 text-[#E11D48] bg-white" /> : <Circle className="w-7 h-7 text-slate-300 bg-white" />}
                    </div>
                    <div className={`mt-2 text-xs font-semibold ${reached ? "text-slate-900" : "text-slate-400"}`}>{s.toUpperCase()}</div>
                    {histEntry && (
                      <div className="text-[10px] text-slate-500 mt-0.5">{new Date(histEntry.at).toLocaleDateString()}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Items + summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 industrial-card">
            <div className="px-5 py-4 border-b border-slate-200 overline">Items</div>
            {order.items.map((it, i) => (
              <div key={i} className="flex items-center gap-4 p-4 border-b border-slate-100 last:border-b-0">
                <div className="w-14 h-14 bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                  {it.image_url && <img src={it.image_url} alt={it.name} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{it.name}</div>
                  <div className="text-xs text-slate-500 font-mono">{it.sku}</div>
                </div>
                <div className="text-sm">{it.quantity} × {fmtBDT(it.price_bdt)}</div>
                <div className="w-28 text-right font-semibold">{fmtBDT(it.line_total)}</div>
              </div>
            ))}
          </div>

          <div className="space-y-5">
            <div className="industrial-card p-5">
              <div className="overline">Total</div>
              <div className="font-display text-3xl mt-1">{fmtBDT(order.total_bdt)}</div>
              {order.due_date && (
                <div className="text-xs text-slate-500 mt-2">Due: {new Date(order.due_date).toLocaleDateString()}</div>
              )}
            </div>
            <div className="industrial-card p-5">
              <div className="overline mb-2">Ship to</div>
              <div className="text-sm whitespace-pre-line">{order.shipping_address}</div>
              {order.notes && (
                <>
                  <div className="overline mt-4 mb-2">Notes</div>
                  <div className="text-sm text-slate-600">{order.notes}</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default OrderDetail;
