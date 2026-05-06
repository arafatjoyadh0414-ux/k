import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import api, { fmtBDT, statusColor, downloadInvoice } from "../lib/api";
import { ArrowLeft, CheckCircle2, Circle, RefreshCw, Printer, RotateCcw, X } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useLang } from "../context/LanguageContext";
import { toast } from "sonner";

const FLOW = ["placed", "confirmed", "packed", "shipped", "delivered"];

const OrderDetail = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [showReturn, setShowReturn] = useState(false);
  const [returnItems, setReturnItems] = useState({});
  const [returnReason, setReturnReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { add } = useCart();
  const { t } = useLang();
  const navigate = useNavigate();

  const load = async () => {
    const { data } = await api.get(`/orders/${id}`);
    setOrder(data);
    // initialise returnItems with 0s
    const init = {};
    (data.items || []).forEach((it) => { init[it.product_id] = { qty: 0, reason: "" }; });
    setReturnItems(init);
  };
  useEffect(() => { load(); }, [id]);

  if (!order) return <Layout><div className="overline">Loading…</div></Layout>;

  const currentIdx = FLOW.indexOf(order.status);
  const isPendingPayment = order.status === "pending_payment";

  const reorder = async () => {
    let added = 0;
    for (const it of order.items) {
      const p = {
        product_id: it.product_id, name: it.name, sku: it.sku,
        image_url: it.image_url, price_bdt: it.price_bdt, moq: 1,
      };
      add(p, it.quantity);
      added += 1;
    }
    toast.success(`Reordered ${added} item${added > 1 ? "s" : ""} → check Cart`);
    navigate("/cart");
  };

  const printInvoice = () => {
    window.print();
  };

  const downloadPDF = async () => {
    try {
      await downloadInvoice(order.order_id);
    } catch (e) {
      toast.error("Failed to download invoice");
    }
  };

  // Return-window check: 7 days after delivered
  const deliveredAt = order?.status_history?.find((h) => h.status === "delivered")?.at;
  const withinReturnWindow = (() => {
    if (!deliveredAt) return false;
    const days = (Date.now() - new Date(deliveredAt).getTime()) / 86400000;
    return days <= 7;
  })();
  const canReturn = order?.status === "delivered" && withinReturnWindow;

  const submitReturn = async () => {
    const items = Object.entries(returnItems)
      .filter(([, v]) => v.qty > 0)
      .map(([product_id, v]) => ({ product_id, quantity: v.qty, reason: v.reason || "" }));
    if (items.length === 0) {
      toast.error("Pick at least one item & qty");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/returns", { order_id: order.order_id, items, reason: returnReason });
      toast.success("Return request submitted");
      setShowReturn(false);
      navigate("/returns");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

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
          <div className="flex flex-wrap gap-2 items-center">
            <span className={`text-xs px-3 py-1.5 border rounded-sm ${statusColor(order.status)}`}>{order.status}</span>
            <span className={`text-xs px-3 py-1.5 border rounded-sm ${statusColor(order.payment_status)}`}>
              {order.payment_method.toUpperCase()} · {order.payment_status}
            </span>
            <button onClick={reorder} data-testid="reorder-button"
              className="print:hidden inline-flex items-center gap-2 bg-slate-900 hover:bg-[#E11D48] text-white text-sm font-semibold px-4 py-2 rounded-sm transition-colors duration-200">
              <RefreshCw className="w-4 h-4" /> {t("order.reorder")}
            </button>
            <button onClick={downloadPDF} data-testid="download-invoice-button"
              className="print:hidden inline-flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-900 text-sm font-semibold px-4 py-2 rounded-sm transition-colors duration-200">
              <Printer className="w-4 h-4" /> {t("order.invoice")} PDF
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`JOY Automart order ${order.order_id} · ${fmtBDT(order.total_bdt)} · status: ${order.status}\n${typeof window !== "undefined" ? window.location.href : ""}`)}`}
              target="_blank"
              rel="noreferrer"
              data-testid="order-whatsapp-share"
              className="print:hidden inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ca352] text-white text-sm font-semibold px-4 py-2 rounded-sm transition-colors duration-200"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.683 5.526l-.999 3.648 3.805-.873z"/></svg>
              WhatsApp
            </a>
            {canReturn && (
              <button onClick={() => setShowReturn(true)} data-testid="open-return-button"
                className="print:hidden inline-flex items-center gap-2 bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 text-sm font-semibold px-4 py-2 rounded-sm transition-colors duration-200">
                <RotateCcw className="w-4 h-4" /> {t("order.request_return")}
              </button>
            )}
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
              {order.discount_amount_bdt > 0 ? (
                <>
                  <div className="text-sm text-slate-500 mt-2">Subtotal: {fmtBDT(order.subtotal_bdt)}</div>
                  <div className="text-sm text-emerald-700">{order.discount_label} ({(order.discount_pct * 100).toFixed(0)}%): -{fmtBDT(order.discount_amount_bdt)}</div>
                  {order.delivery_fee_bdt > 0 && (
                    <div className="text-sm text-slate-500">Delivery: +{fmtBDT(order.delivery_fee_bdt)}</div>
                  )}
                  <div className="font-display text-3xl mt-2">{fmtBDT(order.total_bdt)}</div>
                </>
              ) : (
                <>
                  {order.delivery_fee_bdt > 0 && (
                    <div className="text-xs text-slate-500 mt-2">Includes delivery {fmtBDT(order.delivery_fee_bdt)}</div>
                  )}
                  <div className="font-display text-3xl mt-1">{fmtBDT(order.total_bdt)}</div>
                </>
              )}
              {order.due_date && (
                <div className="text-xs text-slate-500 mt-2">Due: {new Date(order.due_date).toLocaleDateString()}</div>
              )}
            </div>
            {order.delivery_person_name && (
              <div className="industrial-card p-5" data-testid="workshop-delivery-card">
                <div className="overline mb-2">Out for Delivery</div>
                <div className="text-sm font-semibold">{order.delivery_person_name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{order.delivery_person_phone}</div>
                {order.delivery_vehicle_no && (
                  <div className="text-xs text-slate-500 font-mono">Vehicle: {order.delivery_vehicle_no}</div>
                )}
                {order.expected_delivery_date && (
                  <div className="text-xs text-slate-500 mt-1">Expected: {order.expected_delivery_date}</div>
                )}
              </div>
            )}
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

      {showReturn && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden"
          data-testid="return-modal"
          onClick={() => setShowReturn(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-sm w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div>
                <div className="overline">RMA</div>
                <div className="font-display text-xl mt-0.5">{t("returns.create_title")}</div>
              </div>
              <button
                onClick={() => setShowReturn(false)}
                className="text-slate-400 hover:text-slate-900"
                data-testid="close-return-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-xs text-slate-500">
                {t("returns.window_note")} ({order.order_id})
              </div>

              <div className="space-y-2">
                {order.items.map((it) => {
                  const ri = returnItems[it.product_id] || { qty: 0, reason: "" };
                  return (
                    <div
                      key={it.product_id}
                      className="grid grid-cols-12 gap-3 items-center p-3 border border-slate-200 rounded-sm"
                      data-testid={`return-item-row-${it.product_id}`}
                    >
                      <div className="col-span-5 min-w-0">
                        <div className="font-semibold text-sm truncate">{it.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{it.sku} · {fmtBDT(it.price_bdt)} ea</div>
                      </div>
                      <div className="col-span-3">
                        <label className="overline block mb-1">Qty (max {it.quantity})</label>
                        <input
                          type="number"
                          min="0"
                          max={it.quantity}
                          value={ri.qty}
                          data-testid={`return-qty-${it.product_id}`}
                          onChange={(e) => {
                            const q = Math.max(0, Math.min(parseInt(e.target.value) || 0, it.quantity));
                            setReturnItems((prev) => ({ ...prev, [it.product_id]: { ...ri, qty: q } }));
                          }}
                          className="w-full border border-slate-200 px-2 py-1.5 text-sm rounded-sm"
                        />
                      </div>
                      <div className="col-span-4">
                        <label className="overline block mb-1">Reason</label>
                        <input
                          type="text"
                          value={ri.reason}
                          placeholder="Wrong fitment / damaged…"
                          data-testid={`return-reason-${it.product_id}`}
                          onChange={(e) =>
                            setReturnItems((prev) => ({
                              ...prev,
                              [it.product_id]: { ...ri, reason: e.target.value },
                            }))
                          }
                          className="w-full border border-slate-200 px-2 py-1.5 text-sm rounded-sm"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="overline block mb-1.5">{t("returns.reason_label")}</label>
                <textarea
                  value={returnReason}
                  data-testid="return-overall-reason"
                  onChange={(e) => setReturnReason(e.target.value)}
                  rows={2}
                  placeholder="Optional overall note for admin"
                  className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm"
                />
              </div>
            </div>
            <div className="p-5 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
              <button
                onClick={() => setShowReturn(false)}
                className="bg-white border border-slate-200 text-sm font-semibold px-5 py-2 rounded-sm"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={submitReturn}
                disabled={submitting}
                data-testid="submit-return-button"
                className="bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-semibold px-5 py-2 rounded-sm disabled:opacity-60 transition-colors"
              >
                {submitting ? "…" : t("returns.submit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default OrderDetail;
