import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Navigate } from "react-router-dom";
import { toast } from "sonner";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Crown, Mail, Loader2 } from "lucide-react";

const AcceptInvite = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { user, loading: authLoading } = useAuth();
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setError("No invitation token in the URL.");
      setLoading(false);
      return;
    }
    api
      .get(`/team/invitations/lookup/${encodeURIComponent(token)}`)
      .then((r) => setInvite(r.data))
      .catch((e) => setError(e.response?.data?.detail || "Invitation not found"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const r = await api.post(`/team/invitations/accept`, { token });
      setAccepted(r.data);
      toast.success(`Welcome to ${r.data.workshop?.company_name || "the team"}!`);
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not accept invitation");
    } finally {
      setAccepting(false);
    }
  };

  if (accepted) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 grid place-items-center px-4 py-10">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-sm p-7 sm:p-8 shadow-sm" data-testid="accept-invite-card">
        <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#E11D48] mb-2">Workshop invitation</div>
        <h1 className="font-display text-2xl tracking-tight text-zinc-900 dark:text-white mb-1">JOY Automart</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">Bangladesh's first AI-powered B2B auto parts platform</p>

        {loading ? (
          <div className="text-sm text-zinc-500 dark:text-zinc-400 inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Looking up invitation…
          </div>
        ) : error ? (
          <div data-testid="accept-invite-error" className="text-sm bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300 px-3 py-3 rounded-sm">
            {error}
          </div>
        ) : invite ? (
          <>
            <div className="bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-sm p-4 mb-5">
              <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5 inline-flex items-center gap-1.5">
                <Crown className="w-3 h-3" /> {invite.workshop_name}
              </div>
              <div className="text-sm text-zinc-900 dark:text-white">
                You're invited to join as a <strong>{invite.role.replace("_", " ")}</strong>.
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 inline-flex items-center gap-1.5">
                <Mail className="w-3 h-3" /> Invitation sent to {invite.email}
                {invite.invited_by?.name && <span> · by {invite.invited_by.name}</span>}
              </div>
            </div>

            {authLoading ? (
              <div className="text-sm text-zinc-500 dark:text-zinc-400">Loading session…</div>
            ) : !user ? (
              <div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-3">
                  Sign in with the email <strong>{invite.email}</strong> to accept this invitation.
                </p>
                <a
                  href={`${process.env.REACT_APP_BACKEND_URL}/auth/google?redirect=${encodeURIComponent(window.location.href)}`}
                  data-testid="accept-invite-signin-link"
                  className="block w-full text-center bg-zinc-900 dark:bg-[#E11D48] text-white px-5 py-2.5 rounded-sm text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Sign in with Google
                </a>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3">After signing in, return to this page to accept.</p>
              </div>
            ) : (user.email || "").toLowerCase() !== invite.email.toLowerCase() ? (
              <div className="text-sm bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 px-3 py-3 rounded-sm">
                You're signed in as <strong>{user.email}</strong>, but this invitation is for <strong>{invite.email}</strong>. Please sign out and sign in with the correct address.
              </div>
            ) : (
              <button
                data-testid="accept-invite-confirm"
                onClick={handleAccept}
                disabled={accepting}
                className="w-full bg-[#E11D48] hover:bg-[#BE123C] text-white px-5 py-2.5 rounded-sm text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {accepting ? "Joining…" : `Accept &  join ${invite.workshop_name}`}
              </button>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default AcceptInvite;
