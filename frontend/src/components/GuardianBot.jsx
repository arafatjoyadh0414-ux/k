import React, { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Loader2, Car } from "lucide-react";
import api from "../lib/api";

/*
 * GuardianBot — public AI car-knowledge assistant. A floating "ASK GUARDIAN"
 * bubble in the bottom-left corner that opens a chat panel. Any visitor (no
 * sign-in) can ask any car-related question and get a smart, accurate answer
 * powered by Claude Sonnet 4.5 via /api/guardian/message.
 *
 * The session id is persisted in localStorage so the conversation continues
 * across page navigations. Messages are also persisted server-side keyed by
 * session_id so reloads restore the thread.
 */

const SESSION_KEY = "joy_guardian_sid";
const STARTERS = [
  { q: "AC is blowing warm air on my Toyota Vitz — where do I start?" },
  { q: "Best engine oil grade for a Honda Vezel in Dhaka monsoon?" },
  { q: "How do I tell if my battery is dying before it strands me?" },
  { q: "Is BDT 22,000 fair for a Premio full brake-pad set + machining?" },
];

const formatTime = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

const GuardianBot = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const sessionRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Restore session id on mount
  useEffect(() => {
    let sid = "";
    try {
      sid = localStorage.getItem(SESSION_KEY) || "";
    } catch { /* ignore */ }
    sessionRef.current = sid || "";
  }, []);

  // When opening, hydrate history from server if we have a session id
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const sid = sessionRef.current;
    if (sid && messages.length === 0) {
      api.get("/guardian/history", { params: { session_id: sid } })
        .then((r) => {
          if (cancelled) return;
          const msgs = (r.data?.messages || []).map((m) => ({
            role: m.role,
            content: m.content,
            ts: m.created_at,
          }));
          setMessages(msgs);
        })
        .catch(() => { /* fresh thread is fine */ });
    }
    setTimeout(() => inputRef.current?.focus(), 120);
    return () => { cancelled = true; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to latest message
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const send = async (overrideText) => {
    const text = (overrideText ?? draft).trim();
    if (!text || sending) return;

    const userMsg = { role: "user", content: text, ts: new Date().toISOString() };
    setMessages((m) => [...m, userMsg]);
    setDraft("");
    setSending(true);

    try {
      const r = await api.post("/guardian/message", {
        session_id: sessionRef.current || "",
        message: text,
      });
      const newSid = r.data?.session_id || sessionRef.current || "";
      if (newSid && newSid !== sessionRef.current) {
        sessionRef.current = newSid;
        try { localStorage.setItem(SESSION_KEY, newSid); } catch { /* ignore */ }
      }
      setMessages((m) => [...m, {
        role: "assistant",
        content: r.data?.reply || "Sorry, I had no answer for that.",
        ts: new Date().toISOString(),
      }]);
    } catch (e) {
      const detail = e.response?.data?.detail || "Connection lost. Please try again.";
      setMessages((m) => [...m, { role: "assistant", content: detail, ts: new Date().toISOString(), error: true }]);
    } finally {
      setSending(false);
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const showStarters = messages.length === 0 && !sending;

  return (
    <>
      {/* Floating trigger bubble — bottom-left so it doesn't collide with the
          existing /chat ChatWidget which lives bottom-right. */}
      <button
        type="button"
        data-testid="guardian-bot-trigger"
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-5 left-5 z-40 group inline-flex items-center gap-2.5 pl-3.5 pr-4 py-3 rounded-full shadow-2xl backdrop-blur-md transition-all hover:-translate-y-0.5 ${
          open
            ? "bg-zinc-900 text-white"
            : "bg-gradient-to-br from-[#E11D48] via-[#BE123C] to-zinc-900 text-white hover:shadow-[#E11D48]/40"
        }`}
        aria-label="Ask the JOY Guardian — AI car expert"
      >
        <span className={`relative grid place-items-center w-7 h-7 rounded-full ${open ? "bg-white/10" : "bg-white/20"}`}>
          {open ? <X className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
          {!open && <span className="absolute inset-0 rounded-full bg-white/30 animate-ping opacity-50" />}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] font-bold whitespace-nowrap">
          {open ? "Close" : "Ask Guardian"}
        </span>
      </button>

      {/* Slide-in panel */}
      {open && (
        <div
          data-testid="guardian-bot-panel"
          className="fixed inset-x-3 bottom-24 sm:left-5 sm:right-auto sm:bottom-24 sm:w-[400px] z-40 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-xl shadow-2xl flex flex-col max-h-[min(640px,calc(100vh-160px))]"
        >
          {/* Header */}
          <div className="flex items-start gap-3 px-4 sm:px-5 py-3.5 border-b border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-white/[0.03] rounded-t-xl">
            <div className="grid place-items-center w-10 h-10 rounded-full bg-gradient-to-br from-[#E11D48] to-zinc-900 text-white shrink-0">
              <Car className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-base font-semibold text-zinc-900 dark:text-white tracking-tight">JOY Guardian</div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                Ask anything about cars — diagnostics, maintenance, parts, prices.
              </div>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-3" data-testid="guardian-messages">
            {showStarters && (
              <>
                <div className="rounded-md bg-zinc-50 dark:bg-white/[0.04] border border-zinc-100 dark:border-white/5 p-3">
                  <div className="text-sm text-zinc-700 dark:text-zinc-200 leading-relaxed">
                    Hey — I'm <span className="font-semibold">Guardian</span>, your no-nonsense automotive assistant. Diagnostics, maintenance, fluids, parts compatibility, BD-market context — I've got you. Try one of these:
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {STARTERS.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      data-testid={`guardian-starter-${i}`}
                      onClick={() => send(s.q)}
                      className="text-left text-xs sm:text-sm px-3 py-2.5 rounded-md border border-zinc-200 dark:border-white/10 hover:border-zinc-900 dark:hover:border-[#E11D48] text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white transition-colors leading-snug"
                    >
                      {s.q}
                    </button>
                  ))}
                </div>
              </>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                data-testid={`guardian-msg-${m.role}-${i}`}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] px-3.5 py-2.5 rounded-lg text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-zinc-900 dark:bg-[#E11D48] text-white"
                      : m.error
                      ? "bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-500/30"
                      : "bg-zinc-100 dark:bg-white/[0.06] text-zinc-900 dark:text-zinc-100"
                  }`}
                >
                  <div>{m.content}</div>
                  {m.ts && (
                    <div className={`text-[10px] mt-1 opacity-60 ${m.role === "user" ? "text-white/80" : ""}`}>
                      {formatTime(m.ts)}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start" data-testid="guardian-typing">
                <div className="bg-zinc-100 dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400 px-3.5 py-2.5 rounded-lg text-sm flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="px-3 sm:px-4 py-3 border-t border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 rounded-b-xl">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                placeholder="Ask anything about cars…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKey}
                data-testid="guardian-input"
                className="flex-1 resize-none bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 focus:border-zinc-900 dark:focus:border-[#E11D48] rounded-md px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none transition-colors max-h-[100px]"
                maxLength={1500}
              />
              <button
                type="button"
                onClick={() => send()}
                disabled={!draft.trim() || sending}
                data-testid="guardian-send"
                aria-label="Send"
                className="grid place-items-center w-10 h-10 rounded-md bg-zinc-900 dark:bg-[#E11D48] hover:bg-[#E11D48] dark:hover:bg-[#BE123C] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1.5 px-1">
              Powered by Claude Sonnet 4.5 · No sign-in required · Bengali supported
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GuardianBot;
