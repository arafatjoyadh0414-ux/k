import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";
import { Search, TrendingUp, Users, AlertCircle, Download, Sparkles, Target } from "lucide-react";

const KPI = ({ icon: Icon, label, value, sub, tone = "slate" }) => (
  <div className="industrial-card p-5" data-testid={`search-kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}>
    <div className="flex items-center justify-between">
      <div className="overline">{label}</div>
      <Icon className={`w-4 h-4 text-${tone}-400`} />
    </div>
    <div className="font-display text-2xl sm:text-3xl mt-2">{value}</div>
    {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
  </div>
);

const downloadCSV = (rows, filename) => {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// Sparkline-style simple bar chart for daily volume
const VolumeChart = ({ data }) => {
  if (!data?.length) {
    return <div className="text-sm text-slate-500">No search activity in this window yet.</div>;
  }
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-32" data-testid="search-volume-chart">
      {data.map((d) => {
        const h = Math.max(2, Math.round((d.count / max) * 100));
        return (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group min-w-0">
            <div
              className="w-full bg-[#E11D48]/80 hover:bg-[#E11D48] rounded-sm transition-colors relative"
              style={{ height: `${h}%` }}
              title={`${d.day}: ${d.count} searches`}
            >
              <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] bg-zinc-900 text-white px-1.5 py-0.5 rounded font-mono whitespace-nowrap">
                {d.count}
              </div>
            </div>
            <div className="text-[8px] text-slate-500 font-mono tracking-tighter">
              {d.day.slice(5)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const STATUS_CHIP = {
  open: { label: "OPEN", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  sourcing: { label: "SOURCING", cls: "bg-blue-50 text-blue-800 border-blue-200" },
  added: { label: "ADDED", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  rejected: { label: "REJECTED", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
};

const NEXT_STATUS = { open: "sourcing", sourcing: "added" };

const AdminSearchIntelligence = () => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leadsData, setLeadsData] = useState(null);
  const [leadsFilter, setLeadsFilter] = useState("open");
  const [updatingLead, setUpdatingLead] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api
      .get(`/admin/search-analytics?days=${days}`)
      .then((r) => {
        if (mounted) setData(r.data);
      })
      .catch(() => {
        if (mounted) setData(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [days]);

  const refreshLeads = (filter) => {
    const f = filter || leadsFilter;
    const q = f === "all" ? "" : `?status=${f}`;
    api
      .get(`/admin/sourcing-leads${q}`)
      .then((r) => setLeadsData(r.data))
      .catch(() => setLeadsData(null));
  };

  useEffect(() => {
    refreshLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadsFilter]);

  const advanceLead = async (lead) => {
    const next = NEXT_STATUS[lead.status];
    if (!next) return;
    setUpdatingLead(lead.lead_id);
    try {
      await api.post(`/admin/sourcing-leads/${lead.lead_id}/status`, { status: next });
      refreshLeads();
    } finally {
      setUpdatingLead(null);
    }
  };

  const rejectLead = async (lead) => {
    setUpdatingLead(lead.lead_id);
    try {
      await api.post(`/admin/sourcing-leads/${lead.lead_id}/status`, { status: "rejected" });
      refreshLeads();
    } finally {
      setUpdatingLead(null);
    }
  };

  const zeroResultPct = useMemo(
    () => (data ? Math.round((data.zero_result_rate || 0) * 100) : 0),
    [data]
  );

  return (
    <Layout>
      <div className="space-y-6" data-testid="admin-search-intelligence">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="overline flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#E11D48]" /> AI · Demand discovery
            </div>
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl leading-tight mt-1">
              Search Intelligence
            </h1>
            <p className="text-sm text-slate-500 mt-1.5 max-w-xl">
              Real-time view of what visitors search for on the public catalogue — top queries,
              zero-result demand signals, traffic sources, and daily volume.
            </p>
          </div>
          <div className="flex items-center gap-2" data-testid="search-window-tabs">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                data-testid={`search-window-${d}d`}
                className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-full border transition-colors ${
                  days === d
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {loading && !data ? (
          <div className="overline">Loading…</div>
        ) : !data || data.total_logs === 0 ? (
          <div className="industrial-card p-10 text-center">
            <Search className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
            <div className="font-display text-xl mb-1">No searches captured yet</div>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Once visitors start searching the public catalogue, this dashboard will surface their
              top queries, zero-result demand signals, and source pages — fuel for sourcing &amp;
              merchandising decisions.
            </p>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPI icon={Search} label="Total searches" value={data.total_logs.toLocaleString("en-IN")} sub={`Last ${data.window_days} days`} />
              <KPI icon={TrendingUp} label="Unique queries" value={data.unique_queries.toLocaleString("en-IN")} />
              <KPI icon={Users} label="Unique visitors" value={data.unique_visitors.toLocaleString("en-IN")} />
              <KPI
                icon={AlertCircle}
                label="Zero-result rate"
                value={`${zeroResultPct}%`}
                sub="Demand we don't carry"
                tone={zeroResultPct > 20 ? "rose" : "slate"}
              />
            </div>

            {/* Daily volume */}
            <div className="industrial-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="overline">Daily search volume</div>
                  <div className="font-display text-lg mt-0.5">{data.window_days}-day trend</div>
                </div>
              </div>
              <VolumeChart data={data.daily_volume} />
            </div>

            {/* Top queries + Zero-result side-by-side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="industrial-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="overline">Top search queries</div>
                    <div className="font-display text-lg mt-0.5">What visitors look for</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadCSV(data.top_queries, `top-queries-${days}d.csv`)}
                    data-testid="search-top-export"
                    className="text-xs inline-flex items-center gap-1.5 text-slate-600 hover:text-zinc-900"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV
                  </button>
                </div>
                {data.top_queries.length === 0 ? (
                  <div className="text-sm text-slate-500">No queries yet.</div>
                ) : (
                  <ul className="divide-y divide-zinc-100" data-testid="search-top-list">
                    {data.top_queries.map((q, i) => (
                      <li key={q.query_norm} className="py-2.5 flex items-center gap-3" data-testid={`search-top-row-${i}`}>
                        <span className="font-mono text-xs text-zinc-400 w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                        <span className="font-medium text-sm text-zinc-900 flex-1 truncate">{q.query}</span>
                        {q.zero_result_count > 0 && (
                          <span className="text-[10px] font-mono uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-100 px-1.5 py-0.5 rounded">
                            {q.zero_result_count} zero
                          </span>
                        )}
                        <span className="font-mono text-sm text-zinc-700 tabular-nums">{q.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="industrial-card p-5 border-rose-100 bg-rose-50/30">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="overline text-rose-700">Zero-result demand · Sourcing leads</div>
                    <div className="font-display text-lg mt-0.5">Parts visitors want, we don't carry</div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      downloadCSV(data.zero_result_queries, `zero-result-leads-${days}d.csv`)
                    }
                    data-testid="search-zero-export"
                    className="text-xs inline-flex items-center gap-1.5 text-slate-600 hover:text-zinc-900"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV
                  </button>
                </div>
                {data.zero_result_queries.length === 0 ? (
                  <div className="text-sm text-slate-500">No zero-result queries — every search hit something.</div>
                ) : (
                  <ul className="divide-y divide-rose-100" data-testid="search-zero-list">
                    {data.zero_result_queries.map((q, i) => (
                      <li key={q.query_norm} className="py-2.5 flex items-center gap-3" data-testid={`search-zero-row-${i}`}>
                        <span className="font-mono text-xs text-rose-400 w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                        <span className="font-medium text-sm text-zinc-900 flex-1 truncate">{q.query}</span>
                        <span className="font-mono text-sm text-rose-700 tabular-nums">{q.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* By source */}
            <div className="industrial-card p-5">
              <div className="overline mb-3">Search by source page</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" data-testid="search-by-source">
                {data.by_source.map((s) => (
                  <div key={s.source} className="border border-zinc-200 rounded-sm p-3">
                    <div className="overline text-[10px]">{s.source}</div>
                    <div className="font-display text-2xl mt-1">{s.count.toLocaleString("en-IN")}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sourcing Leads — auto-promoted from zero-result demand */}
            <div className="industrial-card p-5 border-2 border-zinc-900" data-testid="sourcing-leads-section">
              <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                <div>
                  <div className="overline flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-[#E11D48]" /> Auto-promoted · Demand → Action
                  </div>
                  <div className="font-display text-xl mt-1">Sourcing Leads</div>
                  <p className="text-xs text-slate-500 mt-1">
                    Zero-result queries that crossed{" "}
                    <strong>{leadsData?.threshold ?? 5}+ searches in {leadsData?.window_days ?? 7} days</strong>{" "}
                    are auto-promoted into actionable leads.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap" data-testid="leads-filter-tabs">
                  {["open", "sourcing", "added", "rejected", "all"].map((f) => {
                    const count =
                      f === "all"
                        ? Object.values(leadsData?.by_status || {}).reduce((a, b) => a + b, 0)
                        : leadsData?.by_status?.[f] || 0;
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setLeadsFilter(f)}
                        data-testid={`leads-filter-${f}`}
                        className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded-full border transition-colors ${
                          leadsFilter === f
                            ? "bg-zinc-900 text-white border-zinc-900"
                            : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400"
                        }`}
                      >
                        {f} {count > 0 && <span className="opacity-70">· {count}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {!leadsData ? (
                <div className="text-sm text-slate-500">Loading leads…</div>
              ) : leadsData.leads.length === 0 ? (
                <div className="text-center py-8" data-testid="leads-empty">
                  <Target className="w-7 h-7 text-zinc-300 mx-auto mb-2" />
                  <div className="text-sm font-medium">No leads in this view</div>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Leads auto-create when ≥5 unique searches for the same missing part land within 7 days.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-zinc-100" data-testid="leads-list">
                  {leadsData.leads.map((lead, i) => {
                    const chip = STATUS_CHIP[lead.status] || STATUS_CHIP.open;
                    const next = NEXT_STATUS[lead.status];
                    return (
                      <li key={lead.lead_id} className="py-3 flex items-center gap-3" data-testid={`leads-row-${i}`}>
                        <span className="font-mono text-xs text-zinc-400 w-6 shrink-0">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-zinc-900 truncate">{lead.sample_query}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                            {lead.search_count_window} searches · {lead.unique_visitors_window} visitors ·{" "}
                            {lead.priority?.toUpperCase()} priority
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-mono uppercase tracking-wider border px-2 py-0.5 rounded ${chip.cls}`}
                        >
                          {chip.label}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {next && lead.status !== "rejected" && (
                            <button
                              type="button"
                              onClick={() => advanceLead(lead)}
                              disabled={updatingLead === lead.lead_id}
                              data-testid={`leads-advance-${i}`}
                              className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                            >
                              → {NEXT_STATUS[lead.status]}
                            </button>
                          )}
                          {lead.status !== "rejected" && lead.status !== "added" && (
                            <button
                              type="button"
                              onClick={() => rejectLead(lead)}
                              disabled={updatingLead === lead.lead_id}
                              data-testid={`leads-reject-${i}`}
                              className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded border border-zinc-300 text-zinc-600 hover:border-rose-300 hover:text-rose-700 disabled:opacity-50 transition-colors"
                            >
                              Reject
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default AdminSearchIntelligence;
