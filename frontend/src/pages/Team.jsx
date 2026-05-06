import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import Layout from "../components/Layout";
import api from "../lib/api";
import { Users, Mail, Trash2, Copy, Check, Send, Crown, Wrench, ClipboardList, Calculator } from "lucide-react";

const ROLE_OPTIONS = [
  { value: "manager", label: "Manager", desc: "Approve orders, manage credit, full read" },
  { value: "parts_manager", label: "Parts Manager", desc: "Place orders, manage cart & VIN lookups" },
  { value: "mechanic", label: "Mechanic", desc: "View orders & part requests" },
  { value: "accountant", label: "Accountant", desc: "Read-only on orders, invoices, payments" },
];
const ROLE_ICON = { owner: Crown, manager: ClipboardList, parts_manager: Wrench, mechanic: Wrench, accountant: Calculator };

const Team = () => {
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("parts_manager");
  const [submitting, setSubmitting] = useState(false);
  const [copiedToken, setCopiedToken] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [m, i] = await Promise.all([
        api.get(`/team/members`),
        api.get(`/team/invitations`),
      ]);
      setMembers(m.data.members || []);
      setInvites(i.data.invitations || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to load team");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const submitInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/team/invitations`, { email: inviteEmail.trim().toLowerCase(), role: inviteRole });
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to send invitation");
    } finally {
      setSubmitting(false);
    }
  };

  const revokeInvite = async (invite_id) => {
    if (!window.confirm("Revoke this invitation?")) return;
    try {
      await api.delete(`/team/invitations/${invite_id}`);
      toast.success("Invitation revoked");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const removeMember = async (m) => {
    if (!window.confirm(`Remove ${m.name || m.email} from your workshop?`)) return;
    try {
      await api.delete(`/team/members/${m.user_id}`);
      toast.success("Member removed");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const copyInviteLink = (token) => {
    const url = `${window.location.origin}/accept-invite?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(""), 1800);
    toast.success("Invitation link copied");
  };

  return (
    <Layout>
      <div className="max-w-5xl">
        <div className="mb-6">
          <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400 mb-1">Workspace</div>
          <h1 className="text-2xl sm:text-3xl font-display tracking-tight text-zinc-900 dark:text-white">Team &amp; Roles</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">Invite your parts manager, mechanic, or accountant to share this Joy ID workspace. Each member sees the same orders, credit and inventory.</p>
        </div>

        {/* Invite form */}
        <div className="industrial-card border border-zinc-200 dark:border-white/10 rounded-sm p-5 sm:p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Send className="w-4 h-4 text-[#E11D48]" />
            <h2 className="font-display text-lg text-zinc-900 dark:text-white">Invite a teammate</h2>
          </div>
          <form onSubmit={submitInvite} className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <input
              data-testid="team-invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              placeholder="teammate@workshop.com"
              className="md:col-span-5 px-4 py-2.5 text-sm border border-zinc-200 dark:border-white/10 rounded-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none focus:border-[#E11D48]"
            />
            <select
              data-testid="team-invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="md:col-span-4 px-4 py-2.5 text-sm border border-zinc-200 dark:border-white/10 rounded-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none focus:border-[#E11D48]"
            >
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
            </select>
            <button
              data-testid="team-invite-submit"
              type="submit"
              disabled={submitting}
              className="md:col-span-3 inline-flex items-center justify-center gap-2 bg-zinc-900 dark:bg-[#E11D48] hover:bg-zinc-700 dark:hover:bg-[#BE123C] text-white px-5 py-2.5 rounded-sm text-sm font-semibold disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Send invite"}
            </button>
          </form>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3">An email invitation is sent (when notifications are configured) with a 7-day acceptance link. You can also copy the link from the pending list below to send manually.</p>
        </div>

        {/* Members */}
        <div className="industrial-card border border-zinc-200 dark:border-white/10 rounded-sm p-5 sm:p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-[#E11D48]" />
            <h2 className="font-display text-lg text-zinc-900 dark:text-white">Team members ({members.length})</h2>
          </div>
          {loading ? (
            <div className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</div>
          ) : members.length === 0 ? (
            <div className="text-sm text-zinc-500 dark:text-zinc-400">No members yet.</div>
          ) : (
            <ul data-testid="team-members-list" className="divide-y divide-zinc-200 dark:divide-white/10">
              {members.map((m) => {
                const Icon = ROLE_ICON[m.workshop_role || (m.is_owner ? "owner" : "mechanic")] || Wrench;
                return (
                  <li key={m.user_id} data-testid={`team-member-${m.user_id}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    {m.picture ? (
                      <img src={m.picture} alt="" className="w-9 h-9 rounded-sm object-cover border border-zinc-200 dark:border-white/10" />
                    ) : (
                      <div className="w-9 h-9 rounded-sm bg-zinc-200 dark:bg-white/10 grid place-items-center text-zinc-700 dark:text-zinc-300 text-sm font-semibold">
                        {(m.name || m.email)?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                        {m.name || m.email}
                        {m.is_owner && <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 px-1.5 py-0.5 rounded-sm font-bold"><Crown className="w-3 h-3" /> Owner</span>}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{m.email} · {m.joy_id || "—"}</div>
                    </div>
                    <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-white/5 px-2 py-1 rounded-sm font-semibold">
                      <Icon className="w-3 h-3" />
                      {(m.workshop_role || (m.is_owner ? "owner" : "member")).replace("_", " ")}
                    </span>
                    {!m.is_owner && (
                      <button
                        data-testid={`team-remove-${m.user_id}`}
                        onClick={() => removeMember(m)}
                        className="ml-2 p-1.5 text-zinc-400 hover:text-[#E11D48] transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Pending invitations */}
        {invites.length > 0 && (
          <div className="industrial-card border border-zinc-200 dark:border-white/10 rounded-sm p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="w-4 h-4 text-[#E11D48]" />
              <h2 className="font-display text-lg text-zinc-900 dark:text-white">Pending invitations ({invites.length})</h2>
            </div>
            <ul data-testid="team-pending-list" className="divide-y divide-zinc-200 dark:divide-white/10">
              {invites.map((i) => (
                <li key={i.invite_id} data-testid={`team-pending-${i.invite_id}`} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{i.email}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{i.role.replace("_", " ")} · invited {new Date(i.created_at).toLocaleDateString()} · expires {new Date(i.expires_at).toLocaleDateString()}</div>
                  </div>
                  <button
                    onClick={() => copyInviteLink(i.token)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 hover:border-[#E11D48] hover:text-[#E11D48] px-3 py-1.5 rounded-sm transition-colors"
                    data-testid={`team-copy-link-${i.invite_id}`}
                  >
                    {copiedToken === i.token ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedToken === i.token ? "Copied" : "Copy link"}
                  </button>
                  <button
                    onClick={() => revokeInvite(i.invite_id)}
                    className="text-xs font-semibold text-zinc-500 hover:text-[#E11D48] transition-colors"
                    data-testid={`team-revoke-${i.invite_id}`}
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Team;
