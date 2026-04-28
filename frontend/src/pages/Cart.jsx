import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { useCart } from "../context/CartContext";
import api, { fmtBDT } from "../lib/api";
import { Trash2, Package, CreditCard, Truck } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const Cart = () => {
  const { items, update, remove, total, clear } = useCart();
  const [ws, setWs] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [shipping, setShipping] = useState("");
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/workshop/me");
      setWs(data.workshop);
      if (data.workshop?.address) setShipping(data.workshop.address);
    })();
  }, []);

  const available = (ws?.credit_limit || 0) - (ws?.credit_used || 0);
  const kycOk = ws?.kyc_status === "approved";
  const creditOk = paymentMethod !== "credit" || total <= available;

  const place = async () => {
    if (!kycOk) { toast.error("KYC must be approved first."); return; }
    if (!shipping.trim()) { toast.error("Enter shipping address."); return; }
    if (!creditOk) { toast.error("Insufficient credit."); return; }
    setPlacing(true);
    try {
      const { data } = await api.post("/orders", {
        items: items.map((x) => ({ product_id: x.product_id, quantity: x.quantity })),
        payment_method: paymentMethod,
        shipping_address: shipping,
        notes,
      });
      clear();
      toast.success(`Order placed: ${data.order_id}`);
      navigate(`/orders/${data.order_id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Order failed");
    } finally { setPlacing(false); }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <div className="overline">Checkout</div>
          <h1 className="font-display text-3xl lg:text-4xl mt-1">Review & Confirm</h1>
        </div>

        {items.length === 0 ? (
          <div className="industrial-card p-12 text-center">
            <Package className="w-12 h-12 mx-auto text-slate-300" />
            <div className="font-display text-xl mt-3">Your cart is empty</div>
            <div className="text-sm text-slate-500 mt-1">Browse the catalog to add parts.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 industrial-card">
              <div className="px-5 py-4 border-b border-slate-200 overline">Items</div>
              <div>
                {items.map((x) => (
                  <div key={x.product_id} className="flex items-center gap-4 p-4 border-b border-slate-100 last:border-b-0" data-testid={`cart-row-${x.sku}`}>
                    <div className="w-16 h-16 bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                      {x.image_url && <img src={x.image_url} alt={x.name} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{x.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{x.sku}</div>
                      <div className="text-xs text-slate-500">MOQ: {x.moq} · {fmtBDT(x.price_bdt)} each</div>
                    </div>
                    <input
                      type="number" min={x.moq} value={x.quantity}
                      onChange={(e) => update(x.product_id, Math.max(x.moq, parseInt(e.target.value) || x.moq))}
                      data-testid={`cart-qty-${x.sku}`}
                      className="w-20 border border-slate-200 px-2 py-1 text-sm rounded-sm"
                    />
                    <div className="w-28 text-right font-semibold">{fmtBDT(x.price_bdt * x.quantity)}</div>
                    <button onClick={() => remove(x.product_id)} data-testid={`cart-remove-${x.sku}`} className="text-slate-400 hover:text-[#E11D48]">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="industrial-card p-5 h-fit space-y-5">
              <div>
                <div className="overline">Subtotal</div>
                <div className="font-display text-3xl mt-1" data-testid="cart-subtotal">{fmtBDT(total)}</div>
              </div>

              <div>
                <div className="overline mb-2">Payment</div>
                <div className="space-y-2">
                  <label className={`flex items-start gap-3 border p-3 rounded-sm cursor-pointer ${paymentMethod==="credit" ? "border-[#E11D48] bg-rose-50" : "border-slate-200"}`}>
                    <input type="radio" name="pm" data-testid="pm-credit" checked={paymentMethod==="credit"} onChange={() => setPaymentMethod("credit")} />
                    <div className="flex-1">
                      <div className="text-sm font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4" /> Pay on Credit</div>
                      <div className="text-xs text-slate-500 mt-0.5">Available: {fmtBDT(available)} · 30-day terms</div>
                      {paymentMethod==="credit" && !creditOk && <div className="text-xs text-red-600 mt-1">Total exceeds available credit</div>}
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 border p-3 rounded-sm cursor-pointer ${paymentMethod==="cod" ? "border-[#E11D48] bg-rose-50" : "border-slate-200"}`}>
                    <input type="radio" name="pm" data-testid="pm-cod" checked={paymentMethod==="cod"} onChange={() => setPaymentMethod("cod")} />
                    <div className="flex-1">
                      <div className="text-sm font-semibold flex items-center gap-2"><Truck className="w-4 h-4" /> Cash on Delivery</div>
                      <div className="text-xs text-slate-500 mt-0.5">Pay our courier on receipt</div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <div className="overline mb-2">Shipping address</div>
                <textarea data-testid="shipping-address" rows={3} value={shipping} onChange={(e) => setShipping(e.target.value)}
                  className="w-full border border-slate-200 p-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
                  placeholder="Workshop full address with area, city, postal code" />
              </div>

              <div>
                <div className="overline mb-2">Notes (optional)</div>
                <textarea data-testid="order-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-slate-200 p-2 text-sm rounded-sm" placeholder="Delivery preferences, contact instructions…" />
              </div>

              {!kycOk && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-sm">
                  KYC must be approved before placing orders. Visit Profile to submit.
                </div>
              )}

              <button
                disabled={!kycOk || placing || !creditOk}
                onClick={place}
                data-testid="place-order-button"
                className="w-full bg-[#E11D48] hover:bg-[#BE123C] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-sm transition-colors duration-200"
              >
                {placing ? "Placing order…" : `Place Order · ${fmtBDT(total)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Cart;
