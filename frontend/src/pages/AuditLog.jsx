import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import Layout from "../components/Layout";
import api from "../lib/api";
import { History, Filter, Crown, Wrench, ClipboardList, Calculator } from "lucide-react";

const ACTION_LABELS = {
  "job_card.create": "Created job card",
  "job_card.update": "Updated job card",
  "job_card.delete": "Deleted job card",
  "order.create": "Placed order",
  "order.update": "Updated order",
  "order.cancel": "Cancelled order",
  "fleet.create": "Created fleet",
  "fleet.update": "Updated fleet",
  "fleet.delete": "Deleted fleet",
  "team.invite": "Invited member",
  "team.accept": "Accepted invitation",
  "team.remove": "Removed member",
  "return.create": "Requested return",
};
const ROLE_ICON = { owner: Crown, manager: ClipboardList, parts_manager: Wrench, mechanic: Wrench, accountant: Calculator };

const AuditLog = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [filterUser, setFilterUser] = useState("");
  const [members, setMembers] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: String(days), limit: "200" });
      if (filterUser) params.set("user_id", filterUser);
      const r = await api.get(`/audit-log?${params.toString()}`);
      setEntries(r.data.entries || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to load");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    api.get("/team/members").then((r) => setMembers(r.data.members || [])).catch(() => {});
  }, []);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days, filterUser]);

  return (
    <Layout>
      <div className="max-w-5xl">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400 mb-1">Workspace</div>
            <h1 className="text-2xl sm:text-3xl font-display tracking-tight text-zinc-900 dark:text-white inline-flex items-center gap-2">
              <History className="w-6 h-6 text-[#E11D48]" /> Activity Log
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">Per-teammate audit trail of every order, return, and workspace action.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              data-testid="audit-days"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value, 10))}
              className="px-3 py-2 text-sm border border-zinc-200 dark:border-white/10 rounded-sm bg-white dark:bg-zinc-900 outline-none"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>
            <select
              data-testid="audit-user"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="px-3 py-2 text-sm border border-zinc-200 dark:border-white/10 rounded-sm bg-white dark:bg-zinc-900 outline-none"
            >
              <option value="">All teammates</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.name || m.email}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</div>
        ) : entries.length === 0 ? (
          <div data-testid="audit-empty" className="industrial-card border border-zinc-200 dark:border-white/10 rounded-sm p-8 text-center">
            <Filter className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
            <h3 className="font-display text-lg text-zinc-900 dark:text-white">No activity in this period</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Try widening the date range or selecting a different teammate.</p>
          </div>
        ) : (
          <ul data-testid="audit-entries" className="industrial-card border border-zinc-200 dark:border-white/10 rounded-sm divide-y divide-zinc-200 dark:divide-white/10">
            {entries.map((e) => {
              const Icon = ROLE_ICON[e.user_role] || Wrench;
              const label = ACTION_LABELS[e.action] || e.action;
              return (
                <li key={e.log_id} data-testid={`audit-${e.log_id}`} className="px-4 sm:px-5 py-3 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-sm bg-zinc-100 dark:bg-white/5 grid place-items-center shrink-0">
                    <Icon className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-zinc-900 dark:text-white">
                      <strong>{e.user_name || e.user_email}</strong>{" "}
                      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>{" "}
                      <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">{e.target_id}</span>
                    </div>
                    {e.summary && <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{e.summary}</div>}
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-mono whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Layout>
  );
};

export default AuditLog;
