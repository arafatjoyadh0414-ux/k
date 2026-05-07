import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, X, Send, Loader2, Bot, ShoppingCart, Package, Check } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

/*
 * GuardianBot (rebranded JOY Genius / "Mr Genius") — the single unified AI
 * assistant for both public visitors and signed-in workshop users. The
 * backend (/api/guardian/message) silently detects auth and switches its
 * system prompt to include the user's portal context (orders, credit,
 * tier-priced catalogue) when signed in. Same Claude Sonnet 4.5 brain,
 * different scope.
 *
 * Trigger label: "Ask Mr Genius" (bottom-left floating bubble).
 * Header in panel: "JOY Genius Assistant" + "Powered by Claude".
 */

const SESSION_KEY = "joy_genius_sid";

const PUBLIC_STARTERS = [
  { q: "AC is blowing warm air on my Toyota Vitz — where do I start?" },
  { q: "Best engine oil grade for a Honda Vezel in Dhaka monsoon?" },
  { q: "How do I tell if my battery is dying before it strands me?" },
  { q: "Is BDT 22,000 fair for a Premio full brake-pad set + machining?" },
];

const PORTAL_STARTERS = [
  { q: "Show me brake pads in stock" },
  { q: "Where's my last order?" },
  { q: "How much credit do I have left?" },
  { q: "Parts for Toyota Aqua hybrid" },
];

const formatTime = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

const GuardianBot = () => {
  const { user } = useAuth();
  const { add: addToCart } = useCart();
  const navigate = useNavigate();
  const isAuth = !!user;
  const starters = isAuth ? PORTAL_STARTERS : PUBLIC_STARTERS;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const sessionRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let sid = "";
    try { sid = localStorage.getItem(SESSION_KEY) || ""; } catch { /* ignore */ }
    sessionRef.current = sid || "";
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const sid = sessionRef.current;
    if (sid && messages.length === 0) {
      api.get("/guardian/history", { params: { session_id: sid } })
        .then((r) => {
          if (cancelled) return;
          const msgs = (r.data?.messages || []).map((m) => ({
            role: m.role, content: m.content, ts: m.created_at, actions: m.actions || [],
          }));
          setMessages(msgs);
        })
        .catch(() => { /* fresh thread */ });
    }
    setTimeout(() => inputRef.current?.focus(), 120);
    return () => { cancelled = true; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const newSession = () => {
    sessionRef.current = "";
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    setMessages([]);
  };

  const send = async (overrideText) => {
    const text = (overrideText ?? draft).trim();
    if (!text || sending) return;

    setMessages((m) => [...m, { role: "user", content: text, ts: new Date().toISOString() }]);
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
        actions: r.data?.actions || [],
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

  // One-tap actions emitted by Genius (auth-only). Each action carries enriched
  // product data so we can hand it straight to the cart context.
  const handleAction = (msgIdx, actionIdx, action) => {
    if (action.type === "add_to_cart") {
      addToCart(
        {
          product_id: action.product_id,
          name: action.name,
          sku: action.sku,
          image_url: action.image_url,
          price_bdt: action.price_bdt,
          moq: 1,
        },
        action.qty || 1,
      );
      toast.success(`Added ${action.qty || 1} × ${action.name}`, { duration: 2200 });
    } else if (action.type === "view_order") {
      setOpen(false);
      navigate(`/orders/${action.order_id}`);
      return;
    }
    // Mark consumed so the chip flips to a check-mark
    setMessages((all) =>
      all.map((m, i) => {
        if (i !== msgIdx) return m;
        const next = (m.actions || []).map((a, j) =>
          j === actionIdx ? { ...a, consumed: true } : a,
        );
        return { ...m, actions: next };
      }),
    );
  };

  const renderActions = (msgIdx, actions) => {
    if (!actions || actions.length === 0) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-1.5" data-testid={`guardian-actions-${msgIdx}`}>
        {actions.map((a, j) => {
          if (a.type === "add_to_cart") {
            const consumed = !!a.consumed;
            return (
              <button
                key={j}
                type="button"
                disabled={consumed}
                data-testid={`guardian-action-${msgIdx}-${j}`}
                data-action-type="add_to_cart"
                data-consumed={consumed ? "true" : "false"}
                onClick={() => handleAction(msgIdx, j, a)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-[0.14em] transition-all ${
                  consumed
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                    : "bg-[#E11D48] hover:bg-[#BE123C] text-white border border-[#E11D48] shadow-sm hover:-translate-y-0.5"
                }`}
              >
                {consumed ? <Check className="w-3 h-3" /> : <ShoppingCart className="w-3 h-3" />}
                {consumed ? "Added" : `Add ${a.qty || 1} × ${(a.name || "").split(" ").slice(0, 4).join(" ")}`}
                {!consumed && a.price_bdt > 0 && (
                  <span className="opacity-80">·BDT {Math.round(a.price_bdt).toLocaleString()}</span>
                )}
              </button>
            );
          }
          if (a.type === "view_order") {
            return (
              <button
                key={j}
                type="button"
                data-testid={`guardian-action-${msgIdx}-${j}`}
                data-action-type="view_order"
                onClick={() => handleAction(msgIdx, j, a)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-[0.14em] bg-zinc-900 hover:bg-zinc-700 text-white border border-zinc-900 dark:border-zinc-700 shadow-sm hover:-translate-y-0.5 transition-all"
              >
                <Package className="w-3 h-3" /> View order
              </button>
            );
          }
          return null;
        })}
      </div>
    );
  };

  const showStarters = messages.length === 0 && !sending;

  return (
    <>
      {/* Floating "Ask Mr Genius" trigger — bottom-left */}
      <button
        type="button"
        data-testid="guardian-bot-trigger"
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-5 left-5 z-40 group inline-flex items-center gap-2.5 pl-3 pr-4 py-2.5 sm:py-3 rounded-full shadow-2xl backdrop-blur-md transition-all hover:-translate-y-0.5 ${
          open
            ? "bg-zinc-900 text-white"
            : "bg-gradient-to-br from-[#E11D48] via-[#BE123C] to-zinc-900 text-white hover:shadow-[#E11D48]/40"
        }`}
        aria-label="Ask Mr Genius — JOY's AI automotive assistant"
      >
        <span className={`relative grid place-items-center w-7 h-7 rounded-full ${open ? "bg-white/10" : "bg-white/20"}`}>
          {open ? <X className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
          {!open && <span className="absolute inset-0 rounded-full bg-white/30 animate-ping opacity-50" />}
        </span>
        <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.22em] font-bold whitespace-nowrap">
          {open ? "Close" : "Ask Mr Genius"}
        </span>
      </button>

      {/* Slide-in panel */}
      {open && (
        <div
          data-testid="guardian-bot-panel"
          className="fixed inset-x-3 bottom-24 sm:left-5 sm:right-auto sm:bottom-24 sm:w-[420px] z-40 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-xl shadow-2xl flex flex-col max-h-[min(660px,calc(100vh-160px))] overflow-hidden"
        >
          {/* Sophisticated header — dark gradient with mono brand line */}
          <div className="relative px-4 sm:px-5 py-4 bg-gradient-to-br from-zinc-950 via-zinc-900 to-[#3F0B1B] text-white border-b border-zinc-900">
            <div className="flex items-start gap-3">
              <div className="grid place-items-center w-10 h-10 rounded-full bg-[#E11D48] text-white shrink-0 ring-2 ring-white/10">
                <Bot className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-lg font-semibold tracking-tight leading-tight">JOY Genius Assistant</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Sparkles className="w-3 h-3 text-[#FFB1C1]" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-400">Powered by Claude</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={newSession}
                  data-testid="guardian-new-session"
                  className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400 hover:text-white border border-white/10 hover:border-white/40 px-2.5 py-1 rounded-full transition-colors"
                  aria-label="Start a new conversation"
                  title="Start a new conversation"
                >
                  New
                </button>
                <button
                  type="button"
                  data-testid="guardian-close"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="w-8 h-8 grid place-items-center rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-3 bg-white dark:bg-zinc-950" data-testid="guardian-messages">
            {showStarters && (
              <>
                {/* Sophisticated intro card */}
                <div className="rounded-lg bg-gradient-to-br from-zinc-50 to-white dark:from-white/[0.04] dark:to-transparent border border-zinc-100 dark:border-white/5 p-4">
                  <div className="text-sm text-zinc-700 dark:text-zinc-200 leading-relaxed">
                    <span className="font-display font-semibold text-zinc-900 dark:text-white">Hey — I'm Genius</span>, your no-nonsense automotive assistant.
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mt-2">
                    Diagnostics, maintenance, fluids, parts compatibility, BD market context, world market context — anything and everything related to automobiles. I've got you.
                  </div>
                  <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#E11D48]">Try one of these</div>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {starters.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      data-testid={`guardian-starter-${i}`}
                      onClick={() => send(s.q)}
                      className="text-left text-xs sm:text-sm px-3.5 py-2.5 rounded-lg border border-zinc-200 dark:border-white/10 hover:border-[#E11D48] hover:bg-[#E11D48]/5 dark:hover:bg-[#E11D48]/10 text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white transition-all leading-snug group"
                    >
                      <span className="text-[#E11D48] mr-2 font-mono text-[10px] tracking-wider opacity-70 group-hover:opacity-100">0{i + 1}</span>
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
                className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-zinc-900 dark:bg-[#E11D48] text-white rounded-br-md"
                      : m.error
                      ? "bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-500/30 rounded-bl-md"
                      : "bg-zinc-100 dark:bg-white/[0.06] text-zinc-900 dark:text-zinc-100 rounded-bl-md"
                  }`}
                >
                  <div>{m.content}</div>
                  {m.ts && (
                    <div className={`text-[10px] mt-1 opacity-60 ${m.role === "user" ? "text-white/80" : ""}`}>
                      {formatTime(m.ts)}
                    </div>
                  )}
                </div>
                {m.role === "assistant" && renderActions(i, m.actions)}
              </div>
            ))}

            {sending && (
              <div className="flex justify-start" data-testid="guardian-typing">
                <div className="bg-zinc-100 dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400 px-3.5 py-2.5 rounded-2xl rounded-bl-md text-sm flex items-center gap-2">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: "120ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: "240ms" }} />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em]">Thinking</span>
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="px-3 sm:px-4 py-3 border-t border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                placeholder={isAuth ? "Ask anything — parts, prices, orders…" : "Ask anything about cars…"}
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
            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1.5 px-1 flex items-center gap-1.5">
              {isAuth ? (
                <><span className="text-[#E11D48]">●</span><span>Signed in as {user?.name?.split(" ")[0] || "you"}</span><span>·</span><span>Portal context active</span><span>·</span><span>বাংলা supported</span></>
              ) : (
                <><span>No sign-in required</span><span>·</span><span>English / বাংলা</span><span>·</span><span>Powered by Claude Sonnet 4.5</span></>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GuardianBot;
