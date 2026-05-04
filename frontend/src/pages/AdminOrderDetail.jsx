import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "../components/Layout";
import api, { fmtBDT, statusColor } from "../lib/api";
import { ArrowLeft, Truck, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

const FLOW = ["placed", "confirmed", "packed", "shipped", "delivered"];

const AdminOrderDetail = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [note, setNote] = useState("");
  const [riders, setRiders] = useState([]);
  const [deliveryForm, setDeliveryForm] = useState({
    delivery_person_id: "",
    delivery_fee_bdt: "",
    expected_delivery_date: "",
    note: "",
  });

  const load = async () => {
    const { data } = await api.get(`/orders/${id}`);
    setOrder(data);
    setDeliveryForm({
      delivery_person_id: data.delivery_person_id || "",
      delivery_fee_bdt: data.delivery_fee_bdt != null ? String(data.delivery_fee_bdt) : "",
      expected_delivery_date: data.expected_delivery_date || "",
      note: "",
    });
  };
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/admin/delivery-persons", { params: { status: "active" } });
        setRiders(data || []);
      } catch (_) { /* ignore */ }
    })();
  }, []);

  const updateStatus = async (status) => {
    try {
      await api.patch(`/admin/orders/${id}/status`, { status, note });
      setNote("");
      await load();
      toast.success(`Status: ${status}`);
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const markPaid = async () => {
    try {
      await api.patch(`/admin/orders/${id}/payment`);
      await load();
      toast.success("Marked paid");
    } catch (e) { toast.error("Failed"); }
  };

  const saveDelivery = async () => {
    try {
      const payload = {
        delivery_person_id: deliveryForm.delivery_person_id || "",
        delivery_fee_bdt: deliveryForm.delivery_fee_bdt === "" ? 0 : parseFloat(deliveryForm.delivery_fee_bdt),
        expected_delivery_date: deliveryForm.expected_delivery_date || "",
        note: deliveryForm.note || "",
      };
      await api.patch(`/admin/orders/${id}/delivery`, payload);
      await load();
      toast.success("Delivery details saved");
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  if (!order) return <Layout><div className="overline">Loading…</div></Layout>;

  const next = FLOW[FLOW.indexOf(order.status) + 1];

  return (
    <Layout>
      <div className="space-y-6">
        <Link to="/admin/orders" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-[#E11D48]">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="overline">Order</div>
            <h1 className="font-display text-3xl mt-1 font-mono">{order.order_id}</h1>
            <div className="text-sm text-slate-500 mt-1">{order.company_name} · {new Date(order.created_at).toLocaleString()}</div>
          </div>
          <div className="flex gap-2">
            <span className={`text-xs px-3 py-1.5 border rounded-sm ${statusColor(order.status)}`}>{order.status}</span>
            <span className={`text-xs px-3 py-1.5 border rounded-sm ${statusColor(order.payment_status)}`}>
              {order.payment_method.toUpperCase()} · {order.payment_status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 industrial-card">
            <div className="px-5 py-4 border-b border-slate-200 overline">Items</div>
            {order.items.map((it, i) => (
              <div key={i} className="flex items-center gap-4 p-4 border-b border-slate-100 last:border-b-0">
                <div className="w-14 h-14 bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                  {it.image_url && <img src={it.image_url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{it.name}</div>
                  <div className="text-xs text-slate-500 font-mono">{it.sku}</div>
                </div>
                <div className="text-sm">{it.quantity} × {fmtBDT(it.price_bdt)}</div>
                <div className="w-28 text-right font-semibold">{fmtBDT(it.line_total)}</div>
              </div>
            ))}
            <div className="p-4 flex justify-between border-t-2 border-slate-300">
              <div className="font-semibold">Total</div>
              <div className="font-display text-xl" data-testid="admin-order-total">{fmtBDT(order.total_bdt)}</div>
            </div>
            {order.delivery_fee_bdt > 0 && (
              <div className="px-4 pb-3 -mt-2 text-xs text-slate-500 text-right">
                (incl. delivery fee {fmtBDT(order.delivery_fee_bdt)})
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="industrial-card p-5">
              <div className="overline mb-2">Shipping</div>
              <div className="text-sm whitespace-pre-line">{order.shipping_address}</div>
              {order.notes && <><div className="overline mt-3 mb-1">Notes</div><div className="text-sm text-slate-600">{order.notes}</div></>}
            </div>

            <div className="industrial-card p-5" data-testid="delivery-card">
              <div className="overline mb-3 flex items-center gap-2"><Truck className="w-4 h-4" /> Delivery</div>

              {order.delivery_person_name && (
                <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-sm text-sm">
                  <div className="flex items-center gap-2 font-semibold">
                    <UserIcon className="w-3.5 h-3.5" /> {order.delivery_person_name}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{order.delivery_person_phone}</div>
                  {order.delivery_vehicle_no && (
                    <div className="text-xs text-slate-500 font-mono">Vehicle: {order.delivery_vehicle_no}</div>
                  )}
                  {order.expected_delivery_date && (
                    <div className="text-xs text-slate-500 mt-1">Expected: {order.expected_delivery_date}</div>
                  )}
                </div>
              )}

              {order.status !== "cancelled" && order.status !== "delivered" && (
                <div className="space-y-2.5">
                  <div>
                    <label className="overline block mb-1">Assign Rider</label>
                    <select
                      data-testid="assign-delivery-person-select"
                      value={deliveryForm.delivery_person_id}
                      onChange={(e) => setDeliveryForm({ ...deliveryForm, delivery_person_id: e.target.value })}
                      className="w-full border border-slate-200 px-2.5 py-2 text-sm rounded-sm bg-white"
                    >
                      <option value="">— Select —</option>
                      {riders.map((r) => (
                        <option key={r.delivery_person_id} value={r.delivery_person_id}>
                          {`${r.name} · ${r.vehicle_type}${r.vehicle_no ? ` (${r.vehicle_no})` : ""}`}
                        </option>
                      ))}
                    </select>
                    {riders.length === 0 && (
                      <Link to="/admin/delivery-persons" className="text-[11px] text-[#E11D48] hover:underline mt-1 inline-block">
                        + Add a delivery person first
                      </Link>
                    )}
                  </div>
                  <div>
                    <label className="overline block mb-1">Delivery Fee (BDT)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      data-testid="delivery-fee-input"
                      value={deliveryForm.delivery_fee_bdt}
                      onChange={(e) => setDeliveryForm({ ...deliveryForm, delivery_fee_bdt: e.target.value })}
                      placeholder="0"
                      className="w-full border border-slate-200 px-2.5 py-2 text-sm rounded-sm"
                    />
                    <div className="text-[10px] text-slate-500 mt-1">Will be added to order total. Adjusts credit usage if unpaid credit order.</div>
                  </div>
                  <div>
                    <label className="overline block mb-1">Expected Date</label>
                    <input
                      type="date"
                      data-testid="expected-date-input"
                      value={deliveryForm.expected_delivery_date}
                      onChange={(e) => setDeliveryForm({ ...deliveryForm, expected_delivery_date: e.target.value })}
                      className="w-full border border-slate-200 px-2.5 py-2 text-sm rounded-sm"
                    />
                  </div>
                  <button
                    onClick={saveDelivery}
                    data-testid="save-delivery-button"
                    className="w-full bg-slate-900 hover:bg-[#E11D48] text-white text-sm font-semibold py-2 rounded-sm transition-colors duration-200"
                  >
                    Save Delivery Details
                  </button>
                </div>
              )}
            </div>

            {order.status !== "cancelled" && order.status !== "delivered" && (
              <div className="industrial-card p-5">
                <div className="overline mb-2">Status Update</div>
                <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)"
                  data-testid="status-note"
                  className="w-full border border-slate-200 p-2 text-sm rounded-sm mb-3" />
                <div className="flex flex-col gap-2">
                  {next && (
                    <button onClick={() => updateStatus(next)} data-testid="advance-status-button"
                      className="bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-semibold py-2 rounded-sm transition-colors duration-200">
                      Mark as {next}
                    </button>
                  )}
                  <button onClick={() => updateStatus("cancelled")}
                    data-testid="cancel-order-button"
                    className="bg-white border border-red-300 text-red-600 hover:bg-red-50 text-sm font-semibold py-2 rounded-sm">
                    Cancel order
                  </button>
                </div>
              </div>
            )}

            {order.payment_status !== "paid" && (
              <button onClick={markPaid} data-testid="mark-paid-button"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2 rounded-sm">
                Mark Payment Received
              </button>
            )}

            <div className="industrial-card p-5">
              <div className="overline mb-3">Status History</div>
              <div className="space-y-2">
                {(order.status_history || []).slice().reverse().map((h, i) => (
                  <div key={i} className="text-xs border-l-2 border-slate-200 pl-3">
                    <div className="font-semibold uppercase">{h.status}</div>
                    <div className="text-slate-500">{new Date(h.at).toLocaleString()}</div>
                    {h.note && <div className="text-slate-600 italic">"{h.note}"</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminOrderDetail;
