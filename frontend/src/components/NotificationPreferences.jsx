import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Package, AlertTriangle, Megaphone, Calendar } from "lucide-react";
import api from "../lib/api";

/*
 * NotificationPreferences — granular per-category toggles so users can opt
 * out of categories they don't want without losing the main browser push
 * subscription. Backed by `notification_prefs` field on the user document.
 */

const CATEGORIES = [
  {
    id: "order_updates",
    label: "Order updates",
    desc: "Shipped, packed, out for delivery, delivered, cancelled.",
    Icon: Package,
  },
  {
    id: "low_stock",
    label: "Low stock alerts",
    desc: "We'll ping you when SKUs you've ordered are running out.",
    Icon: AlertTriangle,
  },
  {
    id: "promotional",
    label: "Featured offers & news",
    desc: "Tier price drops, new body-kit lines, BD auto-industry highlights.",
    Icon: Megaphone,
  },
  {
    id: "daily_digest",
    label: "Daily digest",
    desc: "Once a day: orders, credit and what's hot in the catalog.",
    Icon: Calendar,
  },
];

const NotificationPreferences = () => {
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    let mounted = true;
    api
      .get("/push/prefs")
      .then((r) => {
        if (!mounted) return;
        setPrefs(r.data?.prefs || {});
      })
      .catch(() => {
        if (mounted) setPrefs({});
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const toggle = async (key) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next); // optimistic
    setSaving(key);
    try {
      const r = await api.put("/push/prefs", { [key]: next[key] });
      setPrefs(r.data?.prefs || next);
      toast.success(next[key] ? "Subscribed" : "Unsubscribed", { duration: 1800 });
    } catch (e) {
      // rollback
      setPrefs(prefs);
      toast.error(e.response?.data?.detail || "Failed to save preference");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div
        data-testid="notification-prefs-loading"
        className="industrial-card border border-zinc-200 dark:border-white/10 rounded-sm p-5 flex items-center gap-3 text-sm text-zinc-500"
      >
        <Loader2 className="w-4 h-4 animate-spin" /> Loading preferences…
      </div>
    );
  }

  return (
    <div
      data-testid="notification-prefs-card"
      className="industrial-card border border-zinc-200 dark:border-white/10 rounded-sm p-4 sm:p-5"
    >
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
        <div className="font-semibold text-zinc-900 dark:text-white">Notification preferences</div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          Granular controls
        </div>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
        Pick exactly which alerts reach this device. Test pings always go through so you can verify setup.
      </p>
      <ul className="divide-y divide-zinc-100 dark:divide-white/10 -mx-1">
        {CATEGORIES.map(({ id, label, desc, Icon }) => {
          const active = !!prefs?.[id];
          return (
            <li
              key={id}
              className="flex items-center gap-3 sm:gap-4 px-1 py-3 sm:py-4"
              data-testid={`pref-row-${id}`}
            >
              <div
                className={`w-9 h-9 rounded-sm grid place-items-center shrink-0 ${
                  active
                    ? "bg-[#E11D48]/10 text-[#E11D48] dark:bg-[#E11D48]/15 dark:text-[#FFB1C1]"
                    : "bg-zinc-100 text-zinc-500 dark:bg-white/5 dark:text-zinc-400"
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-zinc-900 dark:text-white text-sm">{label}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">{desc}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={active}
                aria-label={`${active ? "Disable" : "Enable"} ${label}`}
                disabled={saving === id}
                data-testid={`pref-toggle-${id}`}
                data-checked={active ? "true" : "false"}
                onClick={() => toggle(id)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                  active ? "bg-[#E11D48]" : "bg-zinc-200 dark:bg-white/15"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                    active ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default NotificationPreferences;
