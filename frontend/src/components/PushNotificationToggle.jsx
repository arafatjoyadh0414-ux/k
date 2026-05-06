import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, Loader2 } from "lucide-react";
import api from "../lib/api";

const urlBase64ToUint8Array = (b64) => {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
};

const PushNotificationToggle = () => {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState("default");
  const [subscribed, setSubscribed] = useState(false);
  const [vapidKey, setVapidKey] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (!ok) return;
    setPermission(Notification.permission);
    api.get("/push/public-key").then((r) => setVapidKey(r.data?.public_key || "")).catch(() => {});
    navigator.serviceWorker?.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  const enable = async () => {
    if (!vapidKey) { toast.error("Push service not configured"); return; }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.error("Permission denied. Enable notifications in your browser settings.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const j = sub.toJSON();
      await api.post("/push/subscribe", { endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } });
      setSubscribed(true);
      toast.success("Notifications enabled");
    } catch (e) {
      toast.error(e.message || "Failed to enable notifications");
    } finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const j = sub.toJSON();
        try { await api.post("/push/unsubscribe", { endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } }); } catch (_) {}
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Notifications disabled");
    } catch (e) { toast.error(e.message || "Failed"); }
    finally { setBusy(false); }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const r = await api.post("/push/test");
      toast.success(`Sent to ${r.data?.sent || 0} device(s)`);
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  if (!supported) return null;

  return (
    <div className="industrial-card border border-zinc-200 dark:border-white/10 rounded-sm p-4 sm:p-5" data-testid="push-toggle-card">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-sm grid place-items-center shrink-0 ${subscribed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-zinc-100 text-zinc-500 dark:bg-white/5 dark:text-zinc-400"}`}>
          {subscribed ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-zinc-900 dark:text-white">Push notifications</div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Get instant alerts when your orders ship, low-stock SKUs you care about run out, and other workspace events.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!subscribed ? (
              <button
                data-testid="push-enable-btn"
                onClick={enable}
                disabled={busy || permission === "denied"}
                className="inline-flex items-center gap-2 bg-[#E11D48] hover:bg-[#BE123C] disabled:opacity-50 text-white px-4 py-2 rounded-sm text-sm font-semibold"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                {permission === "denied" ? "Blocked in browser" : "Enable notifications"}
              </button>
            ) : (
              <>
                <button
                  data-testid="push-test-btn"
                  onClick={sendTest}
                  disabled={busy}
                  className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-2 rounded-sm text-sm font-semibold disabled:opacity-50"
                >
                  Send test
                </button>
                <button
                  data-testid="push-disable-btn"
                  onClick={disable}
                  disabled={busy}
                  className="inline-flex items-center gap-2 border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:border-[#E11D48] hover:text-[#E11D48] px-4 py-2 rounded-sm text-sm font-semibold transition-colors"
                >
                  Disable
                </button>
              </>
            )}
          </div>
          {permission === "denied" && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
              Your browser is blocking notifications. To enable, click the lock icon in your address bar → Site settings → Notifications → Allow.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PushNotificationToggle;
