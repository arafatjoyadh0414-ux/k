import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import api, { fmtBDT } from "../lib/api";
import { Award, TrendingUp, Activity, AlertCircle, Bell, Package, ArrowRight, Wallet } from "lucide-react";

const GRADE_COLOR = {
  Anchor: "from-purple-500 to-indigo-600",
  Elite: "from-emerald-500 to-teal-600",
  Partner: "from-sky-500 to-blue-600",
  Starter: "from-slate-500 to-slate-700",
};

const ScoreRing = ({ score, grade }) => {
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative w-36 h-36 shrink-0" data-testid="joy-score-ring">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={radius} stroke="#e2e8f0" strokeWidth="8" fill="none" />
        <circle
          cx="64" cy="64" r={radius}
          stroke="url(#g1)" strokeWidth="8" fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700"
        />
        <defs>
          <linearGradient id="g1" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#E11D48" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-display text-4xl leading-none" data-testid="joy-score-value">{score}</div>
        <div className={`text-[10px] font-bold uppercase tracking-[0.18em] mt-1 bg-gradient-to-r ${GRADE_COLOR[grade] || GRADE_COLOR.Starter} bg-clip-text text-transparent`} data-testid="joy-score-grade">
          {grade}
        </div>
      </div>
    </div>
  );
};

const Insights = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: d } = await api.get("/workshop/insights");
        setData(d);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Layout><div className="overline">Loading insights…</div></Layout>;
  if (!data) return <Layout><div className="text-sm text-slate-600">No insight data yet — place your first order.</div></Layout>;

  const { summary, monthly_spend, top_skus, reorder_nudges, joy_score } = data;
  const maxMonthly = Math.max(1, ...monthly_spend.map((m) => m.spend));

  return (
    <Layout>
      <div className="space-y-8" data-testid="insights-page">
        <div>
          <div className="overline">Workshop intelligence</div>
          <h1 className="font-display text-3xl lg:text-4xl mt-1">Your business at a glance</h1>
        </div>

        {/* Joy Score + summary metrics */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 industrial-card p-6 bg-slate-950 text-white relative overflow-hidden" data-testid="joy-score-card">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-[#E11D48] opacity-10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative flex items-start gap-5 z-10">
              <ScoreRing score={joy_score.score} grade={joy_score.grade} />
              <div className="flex-1 min-w-0">
                <div className="overline" style={{ color: "#cbd5e1" }}>Joy Score</div>
                <div className="font-display text-xl mt-1 leading-tight">Bangladesh's first<br />workshop credit rating</div>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Built from your order volume, payment punctuality, credit discipline, and longevity.
                  Higher scores unlock better credit terms.
                </p>
              </div>
            </div>
            <div className="relative grid grid-cols-3 gap-2 mt-6 z-10">
              {Object.entries(joy_score.components).map(([k, v]) => (
                <div key={k} className="bg-white/10 backdrop-blur-sm border border-white/15 px-2.5 py-2 rounded-sm" data-testid={`score-component-${k}`}>
                  <div className="text-[9px] uppercase tracking-[0.1em] text-slate-200 leading-tight">{k.replace(/_/g, " ")}</div>
                  <div className="text-base font-display text-white mt-0.5">{v}<span className="text-[10px] text-slate-300 ml-0.5">/100</span></div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-2 gap-4">
            <Stat icon={Activity} label="Total orders" value={summary.total_orders} testid="stat-orders" />
            <Stat icon={TrendingUp} label="Total spend" value={fmtBDT(summary.total_spend_bdt)} testid="stat-spend" />
            <Stat icon={Award} label="Discount saved" value={fmtBDT(summary.discount_saved_bdt)} accent testid="stat-saved" />
            <Stat
              icon={Wallet}
              label="Credit available"
              value={fmtBDT(Math.max(0, (summary.credit_limit || 0) - (summary.credit_used || 0)))}
              hint={`${summary.credit_utilization_pct}% used of ${fmtBDT(summary.credit_limit || 0)}`}
              testid="stat-credit"
            />
          </div>
        </section>

        {/* Reorder nudges */}
        {reorder_nudges?.length > 0 && (
          <section className="industrial-card p-5" data-testid="reorder-nudges">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-[#E11D48]" />
              <div className="overline">Time to reorder</div>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Based on your order history, these parts are due for reorder.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {reorder_nudges.map((n) => (
                <div key={n.sku} className="border border-amber-200 bg-amber-50 p-3 rounded-sm" data-testid={`nudge-${n.sku}`}>
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{n.name}</div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">{n.sku}</div>
                      <div className="text-xs text-slate-700 mt-1.5">
                        Usually every <b>{n.avg_days}</b> days · last <b>{n.days_since_last}</b> days ago
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/products" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E11D48] hover:underline mt-3">
              Reorder now <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </section>
        )}

        {/* Monthly spend bar chart */}
        {monthly_spend.length > 0 && (
          <section className="industrial-card p-5" data-testid="monthly-spend-card">
            <div className="overline mb-3">Monthly spend (last 6 months)</div>
            <div className="space-y-2.5">
              {monthly_spend.map((m) => (
                <div key={m.month} className="flex items-center gap-3" data-testid={`monthly-${m.month}`}>
                  <div className="w-16 text-xs font-mono text-slate-500 shrink-0">{m.month}</div>
                  <div className="flex-1 bg-slate-100 h-7 rounded-sm relative overflow-hidden">
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-slate-900 to-[#E11D48] rounded-sm transition-[width] duration-700"
                      style={{ width: `${(m.spend / maxMonthly) * 100}%` }}
                    />
                    <div className="absolute inset-y-0 right-2 flex items-center font-semibold text-xs">
                      {fmtBDT(m.spend)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Top SKUs */}
        {top_skus?.length > 0 && (
          <section className="industrial-card p-5" data-testid="top-skus-card">
            <div className="overline mb-3">Your most-ordered parts</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {top_skus.map((s) => (
                <div key={s.sku} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-sm" data-testid={`top-sku-${s.sku}`}>
                  <Package className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate">{s.name}</div>
                    <div className="text-[10px] font-mono text-slate-500">{s.sku}</div>
                  </div>
                  <div className="text-sm font-display">{s.qty}<span className="text-[10px] text-slate-500 ml-0.5">qty</span></div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
};

const Stat = ({ icon: Icon, label, value, hint, accent, testid }) => (
  <div className={`industrial-card p-4 ${accent ? "bg-emerald-50 border-emerald-200" : ""}`} data-testid={testid}>
    <div className="flex items-center gap-2">
      <Icon className={`w-3.5 h-3.5 ${accent ? "text-emerald-700" : "text-slate-400"}`} />
      <div className="overline">{label}</div>
    </div>
    <div className="font-display text-2xl mt-2" data-testid={`${testid}-value`}>{value}</div>
    {hint && <div className="text-[10px] text-slate-500 mt-1">{hint}</div>}
  </div>
);

export default Insights;
