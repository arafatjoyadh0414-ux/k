import React, { useEffect, useState } from "react";
import { Download } from "lucide-react";

/**
 * "Install JOY Automart" button — uses the beforeinstallprompt event on
 * Chrome/Android/Desktop. Hidden on iOS where install is via Share-sheet.
 */
const InstallPwaButton = ({ className = "", testid = "pwa-install-btn" }) => {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone;
    if (standalone) setInstalled(true);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;

  const onClick = async () => {
    deferred.prompt();
    try { await deferred.userChoice; } catch (_) { /* user dismissed */ }
    setDeferred(null);
  };

  return (
    <button
      data-testid={testid}
      onClick={onClick}
      className={`inline-flex items-center gap-2 bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-semibold px-4 py-2 rounded-full ${className}`}
      aria-label="Install JOY Automart on your device"
    >
      <Download className="w-4 h-4" /> Install app
    </button>
  );
};

export default InstallPwaButton;
