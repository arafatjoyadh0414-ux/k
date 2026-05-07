import React from "react";
import { useTheme } from "../../context/ThemeContext";
import { useCountUp } from "../../hooks/useScrollReveal";

export const LOGO =
  "https://customer-assets.emergentagent.com/job_458d530b-69c9-4d64-8b89-03923696b1c8/artifacts/gnewd2f2_IMG-20260209-WA0017.jpg";

// Build live ticker from real platform stats / news
export const formatAgo = (iso) => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min} MIN AGO`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} HR AGO`;
  return "RECENTLY";
};

export const buildTicker = (stats, news) => {
  const newsItems = (news || []).filter((n) => n?.title);
  if (newsItems.length) {
    return newsItems.slice(0, 30).map((n) => {
      let title = (n.title || "").trim();
      const src = (n.source || "").trim();
      if (src && title.toLowerCase().endsWith(`- ${src.toLowerCase()}`)) {
        title = title.slice(0, -1 * (src.length + 2)).trim().replace(/\s+-\s*$/, "");
      }
      const srcSuffix = src ? ` · ${src.toUpperCase()}` : "";
      return `📰 ${title.toUpperCase()}${srcSuffix}`;
    });
  }
  if (!stats) {
    return [
      "● SYSTEM ONLINE",
      "BANGLADESH'S FIRST B2B AUTOMOTIVE PLATFORM",
      "VIN PARTS FINDER · 17-CHAR DECODE",
      "BANANI EXPERIENCE CENTRE · OPENS Q2 2026",
    ];
  }
  const ago = formatAgo(stats.last_order_at);
  const credit =
    stats.credit_used_bdt >= 1e7
      ? `৳ ${(stats.credit_used_bdt / 1e7).toFixed(1)} CR CREDIT DEPLOYED`
      : `৳ ${(stats.credit_used_bdt / 1e5).toFixed(1)} L CREDIT DEPLOYED`;
  const items = [
    "● SYSTEM ONLINE",
    `${stats.workshops_count} DEALERS CONNECTED`,
    `${stats.orders_today} ORDERS SHIPPING TODAY`,
    credit,
    ago ? `LATEST ORDER · ${ago}` : "LATEST ORDER · LIVE",
    `${stats.active_now} ACTIVE NOW`,
    "BANANI EXPERIENCE CENTRE · OPENS Q2 2026",
  ];
  if (stats.featured_message) {
    items.unshift(`★ ${stats.featured_message.toUpperCase()}`);
  }
  return items;
};

// Counter that ramps up on scroll into view
export const StatCounter = ({ to, suffix = "", className = "" }) => {
  const [ref, val] = useCountUp(to);
  return (
    <span ref={ref} className={className}>
      {val.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
};

// Premium image tile with caption (used on Experience Centre teaser)
export const ExpTile = ({ src, caption, ratio = "aspect-[4/3]", testid, fit = "cover" }) => (
  <figure
    data-testid={testid}
    className={`relative overflow-hidden rounded-md sm:rounded-lg border border-white/10 group ${ratio}`}
  >
    <img
      src={src}
      alt={caption}
      className={`w-full h-full ${
        fit === "contain" ? "object-contain bg-zinc-900" : "object-cover"
      } transition-transform duration-700 ease-out group-hover:scale-[1.03]`}
      loading="lazy"
    />
    {fit !== "contain" && (
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />
    )}
    <figcaption
      className={`absolute left-2 sm:left-3 ${
        fit === "contain" ? "top-2 sm:top-3" : "bottom-2 sm:bottom-3"
      } backdrop-blur-md bg-black/55 border border-white/15 text-white font-mono text-[9px] sm:text-[10px] tracking-[0.18em] uppercase px-2.5 py-1 rounded-full max-w-[calc(100%-1rem)] truncate`}
    >
      {caption}
    </figcaption>
  </figure>
);

// Compact stat block
export const Stat = ({ n, l }) => (
  <div className="border border-zinc-200 rounded-sm p-4 bg-white">
    <div className="font-display text-2xl sm:text-3xl text-zinc-900">{n}</div>
    <div className="overline text-zinc-500 mt-0.5 text-[10px]">{l}</div>
  </div>
);

// Theme toggle button
export const ThemeToggle = () => {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      data-testid="theme-toggle"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="magnetic relative inline-flex items-center justify-center w-9 h-9 rounded-full border hairline dark:border-white/10 hover:border-zinc-900 dark:hover:border-white text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
    >
      {isDark ? (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
};
