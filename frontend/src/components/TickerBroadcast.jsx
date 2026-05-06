import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";

const TickerBroadcast = () => {
  const [text, setText] = useState("");
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get("/admin/ticker")
      .then(({ data }) => {
        const m = data?.message;
        if (m) { setText(m.text || ""); setActive(!!m.active); }
      })
      .catch(() => { /* nothing pinned yet */ })
      .finally(() => setLoading(false));
  }, []);

  const save = async (nextActive) => {
    setSaving(true);
    try {
      const { data } = await api.post("/admin/ticker", { text, active: nextActive });
      setActive(!!data?.message?.active);
      toast.success(nextActive ? "Broadcast live on the homepage" : "Broadcast cleared");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not save broadcast");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="industrial-card" data-testid="ticker-broadcast">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-[#E11D48]" />
          <div className="overline">Homepage broadcast</div>
        </div>
        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm ${active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
          {active ? "Live" : "Idle"}
        </span>
      </div>
      <div className="p-5 space-y-3">
        <div className="text-xs text-slate-600 leading-relaxed">
          Featured on the homepage live ticker — prepended in red with a ★. Keep it short, punchy, and time-bound.
          Example: <em>"Eid stock — ৳20 lakh extra credit on first orders this week"</em>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 160))}
          rows={2}
          placeholder="Type the broadcast message…"
          disabled={loading}
          data-testid="ticker-message-input"
          className="w-full border border-slate-200 rounded-sm p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]/30 focus:border-[#E11D48]"
        />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            {text.length}/160 chars
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => save(false)}
              disabled={saving || (!active && !text)}
              data-testid="ticker-clear"
              className="text-xs font-semibold border border-slate-300 hover:border-slate-900 text-slate-700 px-4 py-2 rounded-sm disabled:opacity-50"
            >
              Clear broadcast
            </button>
            <button
              onClick={() => save(true)}
              disabled={saving || !text.trim()}
              data-testid="ticker-publish"
              className="text-xs font-semibold bg-[#E11D48] hover:bg-[#BE123C] text-white px-4 py-2 rounded-sm disabled:opacity-50"
            >
              {active ? "Update broadcast" : "Publish broadcast"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TickerBroadcast;
