import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { fmtBDT } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useLang } from "../context/LanguageContext";
import { Bot, MessageCircle, Send, X, Sparkles, ShoppingCart, ExternalLink, Package, ClipboardList } from "lucide-react";
import { toast } from "sonner";

const SESSION_KEY = "ja_chat_session";

const Bubble = ({ onClick }) => (
  <button
    onClick={onClick}
    data-testid="chat-bubble"
    className="fixed bottom-6 right-6 z-40 bg-[#E11D48] hover:bg-[#BE123C] text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 hover:scale-105 print:hidden"
    title="Ask JOY Assistant"
  >
    <MessageCircle className="w-6 h-6" />
    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-white animate-pulse" />
  </button>
);

const ProductPill = ({ sku, onAdd }) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: d } = await api.get("/products");
        const p = (d || []).find((x) => x.sku === sku);
        if (alive) setData(p || null);
      } catch (_) { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [sku]);

  if (!data) {
    return (
      <div className="text-xs bg-white border border-slate-200 rounded-sm px-3 py-2 inline-flex items-center gap-2 font-mono text-slate-500" data-testid={`chat-product-${sku}-loading`}>
        <Package className="w-3.5 h-3.5" /> {sku}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-sm p-2.5 flex items-center gap-3 my-1.5" data-testid={`chat-product-${sku}`}>
      <div className="w-12 h-12 bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
        {data.image_url && <img src={data.image_url} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate leading-tight">{data.name}</div>
        <div className="text-[10px] font-mono text-slate-500 mt-0.5">{data.sku}</div>
        <div className="text-xs font-display mt-0.5 text-[#E11D48]">{fmtBDT(data.your_price_bdt || data.price_bdt)}</div>
      </div>
      <button
        onClick={() => onAdd(data)}
        data-testid={`chat-add-${sku}`}
        className="text-[10px] font-semibold bg-slate-900 hover:bg-[#E11D48] text-white px-2.5 py-1.5 rounded-sm transition-colors duration-200 inline-flex items-center gap-1 shrink-0"
      >
        <ShoppingCart className="w-3 h-3" /> Add
      </button>
    </div>
  );
};

const OrderPill = ({ orderId }) => (
  <Link
    to={`/orders/${orderId}`}
    data-testid={`chat-order-${orderId}`}
    className="text-xs bg-white border border-slate-200 hover:border-[#E11D48] rounded-sm px-3 py-2 inline-flex items-center gap-2 font-mono my-1 transition-colors"
  >
    <ClipboardList className="w-3.5 h-3.5" /> {orderId} <ExternalLink className="w-3 h-3 text-slate-400" />
  </Link>
);

const NavPill = ({ path, label }) => (
  <Link
    to={path}
    data-testid={`chat-nav-${path.replace(/[^a-z0-9]+/gi, "-")}`}
    className="text-xs bg-slate-900 hover:bg-[#E11D48] text-white px-3 py-2 rounded-sm font-semibold inline-flex items-center gap-1.5 my-1 transition-colors"
  >
    {label || path} <ExternalLink className="w-3 h-3" />
  </Link>
);

const ConfirmOrderPanel = ({ items, shipping, payment, onPlace }) => (
  <div className="bg-amber-50 border border-amber-200 rounded-sm p-3 my-2" data-testid="chat-place-order-panel">
    <div className="overline mb-1.5" style={{ color: "#92400e" }}>Confirm order</div>
    <ul className="text-xs space-y-0.5 mb-2">
      {items.map((it, i) => (
        <li key={i} className="font-mono">{it.quantity} × {it.sku}</li>
      ))}
    </ul>
    {shipping && <div className="text-xs text-slate-600 mb-1"><b>Ship to:</b> {shipping}</div>}
    {payment && <div className="text-xs text-slate-600 mb-2"><b>Payment:</b> {payment}</div>}
    <button
      onClick={onPlace}
      data-testid="chat-place-order-button"
      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-sm transition-colors"
    >
      Place this order →
    </button>
  </div>
);

const Drawer = ({ open, onClose }) => {
  const { user } = useAuth();
  const { add } = useCart();
  const { lang, t } = useLang();
  const navigate = useNavigate();
  const scrollRef = useRef(null);

  const [sessionId, setSessionId] = useState(() => {
    try { return localStorage.getItem(SESSION_KEY) || ""; } catch { return ""; }
  });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (sessionId) {
      try { localStorage.setItem(SESSION_KEY, sessionId); } catch (_) { /* ignore */ }
    }
  }, [sessionId]);

  useEffect(() => {
    // Load history when drawer opens for an existing session
    if (!open || !sessionId) return;
    (async () => {
      try {
        const { data } = await api.get("/chat/history", { params: { session_id: sessionId } });
        const restored = (data || []).map((m) => {
          if (m.role === "assistant") {
            try {
              const obj = JSON.parse(m.content);
              return { role: "assistant", reply: obj.reply || "", actions: obj.actions || [] };
            } catch {
              return { role: "assistant", reply: m.content, actions: [] };
            }
          }
          return { role: "user", reply: m.content, actions: [] };
        });
        setMessages(restored);
      } catch (_) { /* ignore */ }
    })();
  }, [open, sessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleAdd = async (product) => {
    add(
      {
        product_id: product.product_id,
        name: product.name,
        sku: product.sku,
        image_url: product.image_url,
        price_bdt: product.your_price_bdt || product.price_bdt,
        moq: product.moq || 1,
      },
      product.moq || 1
    );
    toast.success(`${product.name} added to cart`);
  };

  const handlePlaceOrder = async (action) => {
    if (placing) return;
    setPlacing(true);
    try {
      // Resolve SKUs to product_ids
      const { data: catalog } = await api.get("/products");
      const skuMap = Object.fromEntries((catalog || []).map((p) => [p.sku, p]));
      const items = (action.items || [])
        .map((it) => {
          const p = skuMap[it.sku];
          if (!p) return null;
          return { product_id: p.product_id, quantity: it.quantity };
        })
        .filter(Boolean);
      if (items.length === 0) {
        toast.error("No matching products found in catalog");
        setPlacing(false);
        return;
      }
      const { data: order } = await api.post("/orders", {
        items,
        shipping_address: action.shipping_address || "",
        payment_method: action.payment_method || "credit",
        notes: "Placed via JOY Assistant",
      });
      toast.success(`Order ${order.order_id} placed!`);
      navigate(`/orders/${order.order_id}`);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", reply: text, actions: [] }]);
    setLoading(true);
    try {
      const { data } = await api.post("/chat/message", { session_id: sessionId, message: text });
      if (!sessionId && data.session_id) setSessionId(data.session_id);
      setMessages((m) => [...m, { role: "assistant", reply: data.reply || "", actions: data.actions || [] }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", reply: "Sorry, I couldn't reach the server. Please try again.", actions: [] }]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const reset = () => {
    setMessages([]);
    setSessionId("");
    try { localStorage.removeItem(SESSION_KEY); } catch (_) { /* ignore */ }
  };

  if (!open) return null;

  const greeting = lang === "bn"
    ? "নমস্কার! আমি JOY Assistant। আপনাকে কিভাবে সাহায্য করতে পারি?"
    : "Hi! I'm JOY Assistant. Ask me about parts, prices, your orders, or just say what you need.";

  const placeholder = lang === "bn" ? "একটি প্রশ্ন লিখুন…" : "Ask anything — parts, prices, orders…";

  return (
    <div
      className="fixed inset-0 z-50 print:hidden"
      data-testid="chat-drawer"
      role="dialog"
    >
      <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[440px] bg-white border-l border-slate-200 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#E11D48] flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="font-display text-base leading-none">JOY Assistant</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-300 mt-1 inline-flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> Powered by Claude
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={reset}
              className="text-[10px] uppercase tracking-[0.15em] text-slate-300 hover:text-white px-2 py-1 transition-colors"
              data-testid="chat-reset"
              title="New conversation"
            >
              new
            </button>
            <button
              onClick={onClose}
              className="text-slate-300 hover:text-white p-1 transition-colors"
              data-testid="chat-close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50" data-testid="chat-messages">
          {messages.length === 0 && (
            <div className="text-sm text-slate-600 leading-relaxed bg-white border border-slate-200 rounded-sm p-3" data-testid="chat-greeting">
              {greeting}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[
                  lang === "bn" ? "ব্রেক প্যাড দেখাও" : "Show me brake pads",
                  lang === "bn" ? "আমার অর্ডার?" : "Where's my last order?",
                  lang === "bn" ? "Toyota Aqua এর জন্য পার্ট" : "Parts for Toyota Aqua",
                ].map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(s)}
                    data-testid={`chat-suggest-${i}`}
                    className="text-xs bg-slate-100 hover:bg-slate-900 hover:text-white border border-slate-200 px-2.5 py-1 rounded-sm transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] ${
                  m.role === "user"
                    ? "bg-slate-900 text-white"
                    : "bg-white border border-slate-200 text-slate-900"
                } px-3.5 py-2.5 rounded-sm`}
                data-testid={`chat-msg-${i}`}
              >
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.reply}</div>
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-2 space-y-0">
                    {m.actions.map((a, j) => {
                      if (a.type === "show_product" || a.type === "show_kit") {
                        return <ProductPill key={j} sku={a.sku} onAdd={handleAdd} />;
                      }
                      if (a.type === "show_order") {
                        return <OrderPill key={j} orderId={a.order_id} />;
                      }
                      if (a.type === "navigate") {
                        return <NavPill key={j} path={a.path} label={a.label} />;
                      }
                      if (a.type === "place_order") {
                        return (
                          <ConfirmOrderPanel
                            key={j}
                            items={a.items || []}
                            shipping={a.shipping_address}
                            payment={a.payment_method}
                            onPlace={() => handlePlaceOrder(a)}
                          />
                        );
                      }
                      return null;
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start" data-testid="chat-typing">
              <div className="bg-white border border-slate-200 px-3.5 py-2.5 rounded-sm">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0.15s" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0.3s" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="p-3 border-t border-slate-200 bg-white">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={placeholder}
              rows={1}
              data-testid="chat-input"
              className="flex-1 border border-slate-200 px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48] resize-none max-h-32"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              data-testid="chat-send"
              className="bg-[#E11D48] hover:bg-[#BE123C] disabled:opacity-50 text-white p-2.5 rounded-sm transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="text-[10px] text-slate-400 mt-1.5 px-1">
            {user?.name ? `Signed in as ${user.name}` : ""} · {lang === "bn" ? "Bangla / English সাপোর্টেড" : "English / বাংলা supported"}
          </div>
        </div>
      </div>
    </div>
  );
};

const ChatWidget = () => {
  const [open, setOpen] = useState(false);
  const { user, loading } = useAuth();

  // Hide for unauthenticated users; auth-only feature
  if (loading || !user) return null;

  return (
    <>
      {!open && <Bubble onClick={() => setOpen(true)} />}
      <Drawer open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default ChatWidget;
