import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Belt-and-suspenders DOM hide for any platform-injected "Made with Emergent" badge.
// Runs after first paint and observes future mutations.
const hideEmergentBadge = () => {
  const selectors = [
    '#emergent-badge',
    '[id^="emergent-badge"]',
    '[class*="emergent-badge"]',
    '[class*="made-with-emergent"]',
    'a[href*="emergent.sh"]',
    'a[href*="emergent.dev"]',
    'a[href*="app.emergent.sh"]',
  ];
  document.querySelectorAll(selectors.join(',')).forEach((el) => {
    el.style.setProperty('display', 'none', 'important');
  });
  // Anchor text fallback (in case classes/ids change)
  document.querySelectorAll('a').forEach((a) => {
    const txt = (a.textContent || '').trim().toLowerCase();
    if (txt === 'made with emergent') {
      a.style.setProperty('display', 'none', 'important');
    }
  });
};

if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    hideEmergentBadge();
    const obs = new MutationObserver(() => hideEmergentBadge());
    obs.observe(document.body, { childList: true, subtree: true });

    // PWA service worker registration (production-only by default; dev opt-in via REACT_APP_ENABLE_SW)
    if ('serviceWorker' in navigator && (process.env.NODE_ENV === 'production' || process.env.REACT_APP_ENABLE_SW === '1')) {
      navigator.serviceWorker.register('/service-worker.js').catch(() => { /* ignore registration failures */ });
    }
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
