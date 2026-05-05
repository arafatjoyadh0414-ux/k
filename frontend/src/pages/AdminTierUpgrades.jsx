import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api, { fmtBDT } from "../lib/api";
import { Award, ArrowRight, TrendingUp } from "lucide-react";

const TIER_COLOR = {
  silver: "bg-slate-100 text-slate-800 border-slate-200",
  gold: "bg-amber-50 text-amber-800 border-amber-200",
  platinum: "bg-purple-50 text-purple-800 border-purple-200",
};

const AdminTierUpgrades = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/admin/tier-upgrades");
        setItems(data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Layout>
      <div className="space-y-6" data-testid="admin-tier-upgrades-page">
        <div>
          <div className="overline">Joy Score</div>
          <h1 className="font-display text-3xl lg:text-4xl mt-1 flex items-center gap-3">
            <Award className="w-7 h-7 text-[#E11D48]" /> Auto Tier Upgrades
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Audit log of every workshop tier/credit upgrade triggered by the Joy Score engine.
            Triggers: KYC approval, every order placed.
          </p>
        </div>

        {loading ? (
          <div className="overline">Loading…</div>
        ) : items.length === 0 ? (
          <div className="industrial-card p-12 text-center text-slate-500" data-testid="tier-upgrades-empty">
            No auto-upgrades yet. They'll appear here as workshops earn higher Joy Scores.
          </div>
        ) : (
          <div className="industrial-card overflow-hidden" data-testid="tier-upgrades-list">
            {/* Desktop table header — hidden on mobile */}
            <div className="hidden md:grid grid-cols-12 px-5 py-3 border-b border-slate-200 overline bg-slate-50">
              <div className="col-span-3">Workshop</div>
              <div className="col-span-2">When</div>
              <div className="col-span-1 text-center">Score</div>
              <div className="col-span-3">Tier</div>
              <div className="col-span-3 text-right">Credit Limit</div>
            </div>
            {items.map((u) => (
              <div
                key={u.log_id}
                className="border-b border-slate-100 last:border-b-0 text-sm hover:bg-slate-50 transition-colors"
                data-testid={`tier-upgrade-${u.log_id}`}
              >
                {/* Desktop layout */}
                <div className="hidden md:grid grid-cols-12 px-5 py-4 items-center">
                  <div className="col-span-3 min-w-0">
                    <div className="font-semibold truncate">{u.company_name || "—"}</div>
                    <div className="text-[10px] font-mono text-slate-500 truncate">{u.workshop_id}</div>
                  </div>
                  <div className="col-span-2 text-xs text-slate-500">
                    {new Date(u.created_at).toLocaleDateString()}<br />
                    <span className="text-[10px]">{new Date(u.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="col-span-1 text-center">
                    <div className="font-display text-xl">{u.score}</div>
                    <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">{u.grade}</div>
                  </div>
                  <div className="col-span-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {u.from_tier !== u.to_tier ? (
                        <>
                          <span className={`text-[10px] uppercase tracking-[0.1em] px-2 py-1 border rounded-sm ${TIER_COLOR[u.from_tier] || TIER_COLOR.silver}`}>{u.from_tier}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className={`text-[10px] uppercase tracking-[0.1em] px-2 py-1 border rounded-sm font-bold ${TIER_COLOR[u.to_tier] || TIER_COLOR.silver}`}>{u.to_tier}</span>
                        </>
                      ) : (
                        <span className={`text-[10px] uppercase tracking-[0.1em] px-2 py-1 border rounded-sm ${TIER_COLOR[u.to_tier] || TIER_COLOR.silver}`}>{u.to_tier} (credit only)</span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-3 text-right">
                    {u.from_credit_bdt !== u.to_credit_bdt ? (
                      <div className="inline-flex items-center gap-2 text-xs flex-wrap justify-end">
                        <span className="text-slate-500 line-through">{fmtBDT(u.from_credit_bdt)}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="font-semibold text-emerald-700 inline-flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> {fmtBDT(u.to_credit_bdt)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">{fmtBDT(u.to_credit_bdt)}</span>
                    )}
                  </div>
                </div>

                {/* Mobile card layout (≤md) — readable on Z Fold 5 + every phone */}
                <div className="md:hidden p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{u.company_name || "—"}</div>
                      <div className="text-[10px] font-mono text-slate-500 truncate">{u.workshop_id}</div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {new Date(u.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-display text-2xl leading-none">{u.score}</div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-500 mt-0.5">{u.grade}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {u.from_tier !== u.to_tier ? (
                      <>
                        <span className={`text-[10px] uppercase tracking-wider px-2 py-1 border rounded-sm ${TIER_COLOR[u.from_tier] || TIER_COLOR.silver}`}>{u.from_tier}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className={`text-[10px] uppercase tracking-wider px-2 py-1 border rounded-sm font-bold ${TIER_COLOR[u.to_tier] || TIER_COLOR.silver}`}>{u.to_tier}</span>
                      </>
                    ) : (
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-1 border rounded-sm ${TIER_COLOR[u.to_tier] || TIER_COLOR.silver}`}>{u.to_tier} · credit only</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">Credit limit</div>
                    {u.from_credit_bdt !== u.to_credit_bdt ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400 line-through">{fmtBDT(u.from_credit_bdt)}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="font-semibold text-emerald-700 inline-flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> {fmtBDT(u.to_credit_bdt)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-slate-700">{fmtBDT(u.to_credit_bdt)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminTierUpgrades;
