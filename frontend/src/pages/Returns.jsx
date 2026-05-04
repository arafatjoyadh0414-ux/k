import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import api, { fmtBDT, statusColor } from "../lib/api";
import { useLang } from "../context/LanguageContext";
import { RotateCcw, ArrowRight, Package } from "lucide-react";

const Returns = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLang();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/returns");
        setItems(data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <div className="overline">RMA</div>
          <h1 className="font-display text-3xl lg:text-4xl mt-1 flex items-center gap-3">
            <RotateCcw className="w-7 h-7 text-[#E11D48]" /> {t("returns.title")}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t("returns.window_note")}</p>
        </div>

        {loading ? (
          <div className="overline">{t("common.loading")}</div>
        ) : items.length === 0 ? (
          <div className="industrial-card p-12 text-center" data-testid="returns-empty">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <div className="text-sm text-slate-600">{t("returns.empty")}</div>
            <Link
              to="/orders"
              className="inline-flex items-center gap-2 text-[#E11D48] text-sm font-semibold mt-3 hover:underline"
              data-testid="returns-empty-orders-link"
            >
              View orders <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="industrial-card overflow-hidden" data-testid="returns-list">
            <div className="grid grid-cols-12 px-5 py-3 border-b border-slate-200 overline bg-slate-50">
              <div className="col-span-3">RMA</div>
              <div className="col-span-3">Order</div>
              <div className="col-span-2 text-center">Items</div>
              <div className="col-span-2 text-right">Refund</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            {items.map((r) => (
              <Link
                to={`/orders/${r.order_id}`}
                key={r.return_id}
                className="grid grid-cols-12 px-5 py-4 items-center border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
                data-testid={`return-row-${r.return_id}`}
              >
                <div className="col-span-3">
                  <div className="font-mono text-sm">{r.return_id}</div>
                  <div className="text-xs text-slate-500">{new Date(r.created_at).toLocaleDateString()}</div>
                </div>
                <div className="col-span-3 font-mono text-xs text-slate-600">{r.order_id}</div>
                <div className="col-span-2 text-center text-sm">{r.items?.length || 0}</div>
                <div className="col-span-2 text-right font-semibold">{fmtBDT(r.refund_total_bdt)}</div>
                <div className="col-span-2 text-right">
                  <span className={`text-xs px-2.5 py-1 border rounded-sm ${statusColor(r.status)}`}>
                    {r.status}
                  </span>
                  {r.refund_method && (
                    <div className="text-[10px] text-slate-500 mt-1">{r.refund_method}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Returns;
