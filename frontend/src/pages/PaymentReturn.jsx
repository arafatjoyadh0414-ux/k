import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import Layout from "../components/Layout";
import api from "../lib/api";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

const PaymentReturn = () => {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [state, setState] = useState({ status: "checking", orderId: null, message: "Verifying payment…" });
  const attempts = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionId) {
      setState({ status: "error", message: "No session ID provided." });
      return;
    }

    const poll = async () => {
      if (attempts.current >= 8) {
        setState({ status: "timeout", message: "Payment status check timed out. Refresh in a moment." });
        return;
      }
      attempts.current += 1;
      try {
        const { data } = await api.get(`/checkout/status/${sessionId}`);
        if (data.payment_status === "paid") {
          setState({ status: "paid", orderId: data.order_id, message: "Payment successful!" });
          // Auto navigate after 2 seconds
          setTimeout(() => navigate(`/orders/${data.order_id}`, { replace: true }), 2000);
          return;
        }
        if (data.status === "expired") {
          setState({ status: "expired", message: "Payment session expired." });
          return;
        }
        setTimeout(poll, 2500);
      } catch (e) {
        setState({ status: "error", message: e.response?.data?.detail || "Failed to verify payment." });
      }
    };
    poll();
  }, [sessionId, navigate]);

  return (
    <Layout>
      <div className="max-w-xl mx-auto py-12">
        <div className="industrial-card p-8 text-center">
          {state.status === "checking" && (
            <>
              <Loader2 className="w-12 h-12 mx-auto text-slate-400 animate-spin" />
              <div className="font-display text-2xl mt-4">Confirming payment…</div>
              <div className="text-sm text-slate-500 mt-2">Don't close this page.</div>
            </>
          )}
          {state.status === "paid" && (
            <>
              <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-600" />
              <div className="font-display text-2xl mt-4">Payment received</div>
              <div className="text-sm text-slate-500 mt-2">Redirecting to your order…</div>
              <Link to={`/orders/${state.orderId}`} className="inline-block mt-4 text-[#E11D48] font-semibold hover:underline" data-testid="view-order-link">
                View order →
              </Link>
            </>
          )}
          {(state.status === "error" || state.status === "expired" || state.status === "timeout") && (
            <>
              <XCircle className="w-14 h-14 mx-auto text-red-500" />
              <div className="font-display text-2xl mt-4">{state.message}</div>
              <Link to="/cart" className="inline-block mt-4 bg-slate-900 text-white px-5 py-2 rounded-sm font-semibold hover:bg-[#E11D48]">
                Back to cart
              </Link>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default PaymentReturn;
