import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";
import { Bot, MessageSquare, Users, MousePointerClick, Sparkles, Download } from "lucide-react";

const KPI = ({ icon: Icon, label, value, sub, tone = "slate" }) => (
  <div className="industrial-card p-5" data-testid={`genius-kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}>
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

const VolumeChart = ({ data }) => {
  if (!data?.length) {
    return <div className="text-sm text-slate-500">No chat activity in this window.</div>;
  }
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-32" data-testid="genius-volume-chart">
      {data.map((d) => {
        const h = Math.max(2, Math.round((d.count / max) * 100));
        return (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group min-w-0">
            <div
              className="w-full bg-zinc-900 hover:bg-[#E11D48] rounded-sm transition-colors relative"
              style={{ height: `${h}%` }}
              title={`${d.day}: ${d.count} messages`}
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

const AdminGeniusAnalytics = () => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api
      .get(`/admin/genius-analytics?days=${days}`)
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

  const clickRatePct = useMemo(
    () => (data ? Math.round((data.click_rate || 0) * 100) : 0),
    [data]
  );

  return (
    <Layout>
      <div className="space-y-6" data-testid="admin-genius-analytics">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="overline flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#E11D48]" /> Mr Genius · AI observability
            </div>
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl leading-tight mt-1">
              Genius Analytics
            </h1>
            <p className="text-sm text-slate-500 mt-1.5 max-w-xl">
              How the JOY AI Assistant is performing — chat volume, top user questions, action-chip
              surfacing, and click-through rate.
            </p>
          </div>
          <div className="flex items-center gap-2" data-testid="genius-window-tabs">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                data-testid={`genius-window-${d}d`}
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
        ) : !data || data.total_messages === 0 ? (
          <div className="industrial-card p-10 text-center">
            <Bot className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
            <div className="font-display text-xl mb-1">No Genius activity yet</div>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Once visitors start chatting with Mr Genius, this dashboard will surface their top
              questions, the actions Genius surfaces, and how often users tap them.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPI
                icon={MessageSquare}
                label="Total messages"
                value={data.total_messages.toLocaleString("en-IN")}
                sub={`${data.total_user_messages} user · ${data.total_assistant_replies} AI`}
              />
              <KPI
                icon={Users}
                label="Sessions"
                value={data.total_sessions.toLocaleString("en-IN")}
                sub={`${data.unique_users} unique users`}
              />
              <KPI
                icon={Sparkles}
                label="Actions surfaced"
                value={data.actions_surfaced.toLocaleString("en-IN")}
                sub="One-tap commerce chips"
              />
              <KPI
                icon={MousePointerClick}
                label="Click-through rate"
                value={`${clickRatePct}%`}
                sub={`${data.actions_clicked} clicks`}
                tone={clickRatePct > 25 ? "emerald" : "slate"}
              />
            </div>

            <div className="industrial-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="overline">Daily message volume</div>
                  <div className="font-display text-lg mt-0.5">{data.window_days}-day trend</div>
                </div>
              </div>
              <VolumeChart data={data.daily_volume} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="industrial-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="overline">Top user questions</div>
                    <div className="font-display text-lg mt-0.5">What people ask Genius</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadCSV(data.top_questions, `genius-top-questions-${days}d.csv`)}
                    data-testid="genius-questions-export"
                    className="text-xs inline-flex items-center gap-1.5 text-slate-600 hover:text-zinc-900"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV
                  </button>
                </div>
                {data.top_questions.length === 0 ? (
                  <div className="text-sm text-slate-500">No questions captured yet.</div>
                ) : (
                  <ul className="divide-y divide-zinc-100" data-testid="genius-top-list">
                    {data.top_questions.map((q, i) => (
                      <li key={q.query_norm} className="py-2.5 flex items-center gap-3" data-testid={`genius-q-row-${i}`}>
                        <span className="font-mono text-xs text-zinc-400 w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                        <span className="font-medium text-sm text-zinc-900 flex-1 truncate">{q.query}</span>
                        <span className="font-mono text-sm text-zinc-700 tabular-nums">{q.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="industrial-card p-5">
                <div className="overline mb-3">Actions surfaced by type</div>
                {data.actions_by_type.length === 0 ? (
                  <div className="text-sm text-slate-500">
                    Genius hasn't surfaced any commerce action chips yet in this window.
                  </div>
                ) : (
                  <ul className="space-y-2" data-testid="genius-actions-list">
                    {data.actions_by_type.map((a) => {
                      const pct = data.actions_surfaced
                        ? Math.round((a.count / data.actions_surfaced) * 100)
                        : 0;
                      return (
                        <li key={a.type} className="border border-zinc-200 rounded-sm p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-mono text-[11px] uppercase tracking-wider">{a.type}</span>
                            <span className="font-mono text-sm tabular-nums">{a.count}</span>
                          </div>
                          <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-zinc-900 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default AdminGeniusAnalytics;
