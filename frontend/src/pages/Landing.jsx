import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Navigate, Link } from "react-router-dom";
import axios from "axios";
import { useScrollReveal, useCountUp } from "../hooks/useScrollReveal";
import HARRIER_HERO from "../assets/harrier-hero.jpg";
// Experience Centre — premium architectural concept renders (interior + exterior)
import EC_HERO from "../assets/experience-centre/ec-hero-interior.png";
import EC_DAY_NIGHT from "../assets/experience-centre/ec-day-night-facade.png";
import EC_FACADE_VARIATIONS from "../assets/experience-centre/ec-facade-variations.png";
import EC_INTERIOR_LUXE from "../assets/experience-centre/ec-interior-luxe.png";
import EC_CAFE_WHEELS from "../assets/experience-centre/ec-cafe-wheels.png";
import EC_MOD_ZONE from "../assets/experience-centre/ec-mod-zone.png";
import EC_ARCHITECTURE from "../assets/experience-centre/ec-architecture-overview.png";
import InstallPwaButton from "../components/InstallPwaButton";
import BodyKitsShowcase from "../components/BodyKitsShowcase";
import MobileScrollSpyChips from "../components/MobileScrollSpyChips";
import HeaderSearchTrigger from "../components/HeaderSearchTrigger";

const LOGO = "https://customer-assets.emergentagent.com/job_458d530b-69c9-4d64-8b89-03923696b1c8/artifacts/gnewd2f2_IMG-20260209-WA0017.jpg";
const HERO = HARRIER_HERO;

// Build live ticker from real platform stats (cached 5min on backend)
const formatAgo = (iso) => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min} MIN AGO`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} HR AGO`;
  return "RECENTLY";
};
const buildTicker = (stats, news) => {
  // Prefer worldwide cars news (refreshes every 1 hour) when available.
  const newsItems = (news || []).filter((n) => n?.title);
  if (newsItems.length) {
    return newsItems.slice(0, 30).map((n) => {
      // Google News titles often already end with " - Source". Strip a trailing duplicate.
      let title = (n.title || "").trim();
      const src = (n.source || "").trim();
      if (src && title.toLowerCase().endsWith(`- ${src.toLowerCase()}`)) {
        title = title.slice(0, -1 * (src.length + 2)).trim().replace(/\s+-\s*$/, "");
      }
      const srcSuffix = src ? ` · ${src.toUpperCase()}` : "";
      return `📰 ${title.toUpperCase()}${srcSuffix}`;
    });
  }
  // Fallback to platform stats
  if (!stats) {
    return [
      "● SYSTEM ONLINE",
      "BANGLADESH'S FIRST B2B AUTOMOTIVE PLATFORM",
      "VIN PARTS FINDER · 17-CHAR DECODE",
      "BANANI EXPERIENCE CENTRE · OPENS Q2 2026",
    ];
  }
  const ago = formatAgo(stats.last_order_at);
  const credit = stats.credit_used_bdt >= 1e7
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

// Stat ticker on the capability cards — counter ramps up on scroll
const StatCounter = ({ to, suffix = "", className = "" }) => {
  const [ref, val] = useCountUp(to);
  return (
    <span ref={ref} className={className}>{val.toLocaleString("en-IN")}{suffix}</span>
  );
};

// Experience Centre image tile — premium glassmorphic caption, fluid aspect ratio
const ExpTile = ({ src, caption, ratio = "aspect-[4/3]", testid, fit = "cover" }) => (
  <figure
    data-testid={testid}
    className={`relative overflow-hidden rounded-md sm:rounded-lg border border-white/10 group ${ratio}`}
  >
    <img
      src={src}
      alt={caption}
      className={`w-full h-full ${fit === "contain" ? "object-contain bg-zinc-900" : "object-cover"} transition-transform duration-700 ease-out group-hover:scale-[1.03]`}
      loading="lazy"
    />
    {fit !== "contain" && (
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />
    )}
    <figcaption className={`absolute left-2 sm:left-3 ${fit === "contain" ? "top-2 sm:top-3" : "bottom-2 sm:bottom-3"} backdrop-blur-md bg-black/55 border border-white/15 text-white font-mono text-[9px] sm:text-[10px] tracking-[0.18em] uppercase px-2.5 py-1 rounded-full max-w-[calc(100%-1rem)] truncate`}>
      {caption}
    </figcaption>
  </figure>
);

// Compact stat block for the condensed value-prop section
const Stat = ({ n, l }) => (
  <div className="border border-zinc-200 rounded-sm p-4 bg-white">
    <div className="font-display text-2xl sm:text-3xl text-zinc-900">{n}</div>
    <div className="overline text-zinc-500 mt-0.5 text-[10px]">{l}</div>
  </div>
);

// Bangladesh Auto Pulse — local automotive news section (hourly refresh)
const BangladeshNewsSection = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/public/cars-news/bangladesh`)
      .then((r) => { if (mounted) setItems(r.data?.items || []); })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  // Don't render the section while empty/loading — keeps the page tight
  if (loading || !items.length) return null;

  const hero = items[0];
  const rest = items.slice(1, 7);

  return (
    <section id="bd-news" className="bg-white dark:bg-zinc-950 border-y border-zinc-200 dark:border-white/10 scroll-mt-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 reveal">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6 sm:mb-8">
          <div>
            <div className="inline-flex items-center gap-2 font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.22em] text-[#E11D48] font-bold mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E11D48] animate-pulse" />
              Bangladesh Auto Pulse · Updated hourly
            </div>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl tracking-tight text-zinc-900 dark:text-white">
              Local headlines. Local intelligence.
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 max-w-xl">
              Real-time Dhaka & Bangladesh automotive news — sales, fuel pricing, BRTA regulation, dealer movements.
            </p>
          </div>
        </div>

        {/* Hero card + side list */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          <a
            href={hero.link || "#"}
            target="_blank"
            rel="noreferrer"
            data-testid="bd-news-hero"
            className="lg:col-span-7 group block bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-md p-5 sm:p-7 hover:border-[#E11D48] transition-colors"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#E11D48] mb-3">FEATURED · {hero.source || "BD"}</div>
            <h3 className="font-display text-xl sm:text-2xl lg:text-3xl tracking-tight text-zinc-900 dark:text-white group-hover:text-[#E11D48] transition-colors leading-tight">
              {hero.title}
            </h3>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-3 inline-flex items-center gap-2">
              {hero.pub_date ? new Date(hero.pub_date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null}
              <span className="text-[#E11D48]">→ Read on {hero.source || "source"}</span>
            </div>
          </a>

          <ul className="lg:col-span-5 grid grid-cols-1 gap-3" data-testid="bd-news-list">
            {rest.map((n, i) => (
              <li key={i}>
                <a
                  href={n.link || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="group block bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-md p-3 sm:p-4 hover:border-[#E11D48] transition-colors"
                  data-testid={`bd-news-item-${i}`}
                >
                  <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400 mb-1">
                    {n.source || "BD news"}
                    {n.pub_date && <span> · {new Date(n.pub_date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>}
                  </div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-white group-hover:text-[#E11D48] transition-colors line-clamp-2">{n.title}</div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

const ThemeToggle = () => {
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
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      )}
    </button>
  );
};

const Landing = () => {
  const { user, loading } = useAuth();
  const [stats, setStats] = useState(null);
  const [news, setNews] = useState([]);
  useScrollReveal();

  useEffect(() => {
    let mounted = true;
    axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/public/stats`)
      .then((r) => { if (mounted) setStats(r.data); })
      .catch(() => { /* ticker falls back to baseline copy */ });
    axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/public/cars-news`)
      .then((r) => { if (mounted) setNews(r.data?.items || []); })
      .catch(() => { /* fall back to platform stats */ });
    return () => { mounted = false; };
  }, []);

  if (loading) return null;
  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;

  const handleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/auth/callback";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const TICKER = buildTicker(stats, news);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 fut" data-testid="landing-page">
      {/* Subtle SVG noise grain — fixed, behind interactive layers */}
      <div className="grain-overlay" aria-hidden="true" />

      {/* Top live activity ribbon — Worldwide automotive news (1h refresh) with platform stats fallback */}
      <div className="bg-zinc-950 dark:bg-black text-zinc-400 dark:text-[#FFB1C1] text-[10px] tracking-[0.18em] uppercase overflow-hidden h-7 flex items-center border-b border-transparent dark:border-[#E11D48]/30 relative" aria-label={news.length ? "Worldwide automotive news ticker" : "Live platform activity ticker"}>
        <div className="hidden sm:flex items-center gap-1.5 bg-[#E11D48] text-white font-mono text-[9px] tracking-[0.22em] uppercase font-bold px-2.5 h-full pl-3 pr-3 flex-shrink-0 relative z-[2] shadow-[2px_0_8px_rgba(0,0,0,0.45)]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
          </span>
          {news.length ? "Live · World Auto News" : "Live"}
        </div>
        <div className="ticker-track px-5 sm:pl-7 sm:pr-4 flex-1 min-w-0 ticker-mask">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} className="font-mono inline-flex items-center gap-2">
              <span>{t}</span>
              <span className="text-zinc-700 dark:text-[#E11D48]/40">/</span>
            </span>
          ))}
        </div>
      </div>

      {/* Glassmorphic sticky header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/70 dark:bg-zinc-950/70 border-b hairline dark:border-white/10">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 h-16 sm:h-[72px] flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group min-w-0 flex-shrink" data-testid="header-logo-link" aria-label="JOY Automart — Go to home">
            <img src={LOGO} alt="JOY Automart" className="w-9 h-9 sm:w-11 sm:h-11 lg:w-12 lg:h-12 object-contain rounded-sm transition-transform group-hover:scale-105 flex-shrink-0" />
            <div className="leading-tight min-w-0">
              <div className="font-display text-base sm:text-lg lg:text-xl text-zinc-900 dark:text-white tracking-tight font-semibold whitespace-nowrap">JOY Automart</div>
              <div className="hidden xs:block font-mono text-[9px] sm:text-[10px] lg:text-[11px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 mt-0.5 whitespace-nowrap">B2B · Bangladesh</div>
            </div>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <Link
              to="/catalog"
              className="hidden sm:inline-flex items-center px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
              data-testid="header-catalog-link"
            >
              Catalogue
            </Link>
            <HeaderSearchTrigger />
            <ThemeToggle />
            <InstallPwaButton testid="landing-install-pwa" className="hidden sm:inline-flex" />
            <button
              data-testid="top-login-button"
              onClick={handleLogin}
              className="magnetic inline-flex items-center bg-zinc-950 dark:bg-[#E11D48] hover:bg-[#E11D48] dark:hover:bg-[#BE123C] text-white text-[13px] sm:text-sm font-medium px-3.5 sm:px-5 lg:px-6 py-2 sm:py-2.5 rounded-full whitespace-nowrap"
            >
              Sign in
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile/tablet scroll-spy chip nav — desktop uses top header instead */}
      <MobileScrollSpyChips />

      {/* Full-width hero image at the very top — clean, no overlays on the picture */}
      <section id="hero" className="relative scroll-mt-28">
        <div className="w-full overflow-hidden">
          <img
            src={HERO}
            alt="Aggressive 2022 Toyota Harrier sport SUV with Modelista body kit — JOY Automart brand campaign for car dealers, workshops & suppliers"
            className="w-full h-[280px] sm:h-[400px] md:h-[500px] lg:h-[560px] object-cover"
          />
        </div>
      </section>

      {/* Headline + copy — sophisticated, L'Oréal-style positioning */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 pt-12 sm:pt-16 pb-10 sm:pb-12 reveal">
        <div className="inline-flex items-center gap-3 mb-4">
          <span className="block w-8 h-px bg-[#E11D48]" aria-hidden="true" />
          <span className="font-mono text-[10px] sm:text-[11px] tracking-[0.24em] uppercase text-[#E11D48] font-semibold">
            Bangladesh's first AI-powered auto parts commerce
          </span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-[64px] leading-[1.02] tracking-tighter max-w-4xl">
          Smarter parts.{" "}
          <span className="text-zinc-900">Stronger journeys.</span>{" "}
          <span className="text-[#E11D48]">One platform.</span>
        </h1>
        <p className="text-base sm:text-lg text-zinc-500 mt-5 sm:mt-6 max-w-2xl leading-relaxed">
          JOY Automart is rebuilding Bangladesh's automotive aftermarket end-to-end —
          B2B parts supply for car dealers and workshops, B2C retail for car owners,
          a flagship Experience Centre, and an AI-driven data layer that gives the
          industry intelligence it has never had before.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            data-testid="hero-google-login-button"
            onClick={handleLogin}
            className="magnetic inline-flex items-center gap-2.5 bg-zinc-950 hover:bg-[#E11D48] text-white px-5 sm:px-6 py-3 rounded-full text-sm font-semibold"
          >
            <svg className="w-4 h-4" viewBox="0 0 48 48"><path fill="#fff" d="M24 9.5c3.4 0 6.4 1.2 8.8 3.4l6.6-6.6C35.4 2.6 30 .5 24 .5 14.7.5 6.7 5.8 2.9 13.6l7.7 6c1.8-5.5 6.9-9.6 13.4-9.6z"/><path fill="#fff" opacity=".8" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.4 5.5-5 7.2l7.7 6c4.5-4.2 7.1-10.4 7.1-17.7z"/><path fill="#fff" opacity=".6" d="M10.6 28.4c-.5-1.4-.8-2.9-.8-4.4s.3-3 .8-4.4l-7.7-6C1.3 17 0 20.4 0 24s1.3 7 2.9 10.4l7.7-6z"/><path fill="#fff" opacity=".9" d="M24 47.5c6 0 11.4-2 15.4-5.4l-7.7-6c-2.1 1.4-4.8 2.3-7.7 2.3-6.5 0-11.6-4.1-13.4-9.6l-7.7 6C6.7 42.2 14.7 47.5 24 47.5z"/></svg>
            Open the B2B portal
          </button>
          <a href="https://www.joyautomart.com" target="_blank" rel="noreferrer" data-testid="hero-retail-link"
             className="inline-flex items-center gap-2 bg-white border border-zinc-300 hover:border-zinc-900 text-zinc-900 px-5 sm:px-6 py-3 rounded-full text-sm font-semibold transition-colors">
            Visit retail store →
          </a>
          <a href="/catalog" data-testid="hero-catalog-link"
             className="inline-flex items-center gap-2 bg-white border border-zinc-300 hover:border-zinc-900 text-zinc-900 px-5 sm:px-6 py-3 rounded-full text-sm font-semibold transition-colors">
            Browse catalogue →
          </a>
          <a href="https://wa.me/8801886799533" data-testid="hero-whatsapp-link"
             className="inline-flex items-center gap-2 bg-white border border-zinc-300 hover:border-[#25D366] hover:text-[#25D366] text-zinc-900 px-5 sm:px-6 py-3 rounded-full text-sm font-semibold transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.683 5.526l-.999 3.648 3.805-.873z"/></svg>
            01886-799533
          </a>
        </div>
      </section>

      {/* What we do — 5 pillars in Swiss hairline bento grid */}
      <section className="border-y hairline bg-zinc-50/40 relative">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-14 sm:py-20 reveal">
          <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-zinc-500 mb-2">What we do</div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[1.05] max-w-3xl mb-2">
            Five businesses. <span className="text-zinc-500">One ecosystem.</span>
          </h2>
          <p className="text-zinc-500 max-w-2xl text-sm sm:text-base mb-10">
            From the bay floor to the boardroom — we cover the entire automotive aftermarket value chain.
          </p>
          {/* Hairline bento — uses negative margins on borders to mimic border-collapse */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 -m-px">
            {[
              { n: "01", k: "B2B Wholesale", t: "Workshops & Dealers",
                d: "Verified parts, tier-based wholesale pricing, 30-day credit, and live order tracking for car dealers and auto-repair workshops nationwide." },
              { n: "02", k: "B2C Retail", t: "Online & Walk-in",
                d: <>Direct-to-consumer auto parts e-commerce on <a href="https://www.joyautomart.com" target="_blank" rel="noreferrer" className="text-zinc-900 underline underline-offset-2 hover:text-[#E11D48]">www.joyautomart.com</a> — paired with our flagship retail showroom.</> },
              { n: "03", k: "Experience Centre", t: "Bangladesh's first",
                d: "A flagship retail showroom on the 100 ft Madani Avenue corridor — hero car zone, JOY Café, mezzanine viewing room. Launching in 2 months." },
              { n: "04", k: "Data & AI", t: "Industry intelligence",
                d: "Every transaction, every part, every vehicle, every behaviour — captured and modelled. Demand forecasting, smart pricing, predictive insights." },
              { n: "05", k: "JOY BEAST", t: "The atelier", featured: true,
                d: "Our in-house premium modification house. Body kits, forged wheels, performance tuning, bespoke leather interiors and custom builds — engineered in Bangladesh." },
            ].map(({ n, k, t, d, featured }) => (
              <div key={n} className={`border hairline p-6 ${featured ? "bg-zinc-950 text-white border-zinc-950" : "bg-white"}`}>
                <div className={`mono-accent text-2xl ${featured ? "text-[#E11D48]" : "text-zinc-300"}`}>{n}</div>
                <div className={`font-mono text-[10px] uppercase tracking-[0.2em] mt-3 mb-1.5 ${featured ? "text-[#E11D48]" : "text-zinc-500"}`}>{k}</div>
                <div className="font-display text-lg mb-2">{t}</div>
                <p className={`text-sm leading-relaxed ${featured ? "text-zinc-300" : "text-zinc-600"}`}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* JOY BEAST — In-house premium modification & body-kit atelier */}
      <section id="joy-beast" className="bg-white scroll-mt-28">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-14 sm:py-20 reveal">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
            <div className="lg:col-span-5 order-1">
              <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#E11D48] mb-3">JOY BEAST · The Atelier</div>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight leading-[1.05]">
                A premium modification house. Built in Bangladesh.
              </h2>
              <p className="text-zinc-600 mt-5 leading-relaxed text-sm sm:text-base">
                JOY BEAST is our in-house atelier — a luxury modification brand that competes with the
                world's finest tuning houses. Every build is hand-finished at the Experience Centre with
                workshop-grade fitment guarantees. From bolt-on aero kits to ground-up wide-body conversions
                and bespoke leather interiors, this is where ordinary cars become signature builds.
              </p>

              {/* Service pillars */}
              <div className="mt-7 space-y-4">
                <div className="flex gap-3">
                  <div className="shrink-0 w-9 h-9 grid place-items-center bg-zinc-900 text-white rounded-sm">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17l4-8 4 8 4-12 4 12"/><path d="M3 21h18"/></svg>
                  </div>
                  <div>
                    <div className="font-display text-base text-zinc-900">Body Kits &amp; Aero</div>
                    <div className="text-sm text-zinc-600 mt-0.5">Wide-body fender flares, splitters, diffusers, side skirts, vented bonnets, ducktail spoilers — moulded in carbon-composite, painted to OEM-match.</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="shrink-0 w-9 h-9 grid place-items-center bg-zinc-900 text-white rounded-sm">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                  </div>
                  <div>
                    <div className="font-display text-base text-zinc-900">Forged Wheels &amp; Performance Brakes</div>
                    <div className="text-sm text-zinc-600 mt-0.5">21–22" forged multi-spoke alloys, big-brake upgrades with red anodised calipers, performance pads &amp; lines.</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="shrink-0 w-9 h-9 grid place-items-center bg-zinc-900 text-white rounded-sm">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8h18l-2 13H5L3 8z"/><path d="M8 8V5a4 4 0 0 1 8 0v3"/></svg>
                  </div>
                  <div>
                    <div className="font-display text-base text-zinc-900">Bespoke Interior &amp; Upholstery</div>
                    <div className="text-sm text-zinc-600 mt-0.5">Full-grain Nappa leather, Alcantara headliners, contrast stitching, custom dashboards, carbon-fibre trim, premium audio &amp; ambient lighting.</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="shrink-0 w-9 h-9 grid place-items-center bg-zinc-900 text-white rounded-sm">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>
                  </div>
                  <div>
                    <div className="font-display text-base text-zinc-900">Performance Tuning</div>
                    <div className="text-sm text-zinc-600 mt-0.5">ECU remaps, stage-1/2 power packs, sport exhausts, lowering springs &amp; coilovers, cold-air intakes — dyno-validated upgrades for measurable gains.</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="shrink-0 w-9 h-9 grid place-items-center bg-zinc-900 text-white rounded-sm">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  </div>
                  <div>
                    <div className="font-display text-base text-zinc-900">Custom Atelier Builds</div>
                    <div className="text-sm text-zinc-600 mt-0.5">Ground-up bespoke commissions — fleet liveries, one-off concept builds, and full Cyber Beast wide-body conversions on request.</div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <a href="/inquire" data-testid="beast-inquire-link"
                   className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-700 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-colors">
                  Schedule a kit consultation →
                </a>
              </div>
            </div>

            <div className="lg:col-span-7 order-2">
              <BodyKitsShowcase />
            </div>
          </div>
        </div>
      </section>

      {/* Bangladesh Auto Pulse — moved to bottom of page */}

      {/* Experience Centre — TEASER strip linking to dedicated /experience-centre page */}
      <section id="experience-centre" className="bg-zinc-950 text-zinc-300 relative overflow-hidden border-y border-white/10 scroll-mt-28">
        <div className="aurora-blob" aria-hidden="true" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 relative z-10 reveal">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
            <div className="lg:col-span-5">
              <img
                src={EC_INTERIOR_LUXE}
                alt="JOY Automart Experience Centre — concept render"
                className="w-full h-48 sm:h-64 lg:h-80 object-cover rounded-md border border-white/10"
                loading="lazy"
              />
            </div>
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 backdrop-blur-md bg-[#E11D48]/15 border border-[#E11D48]/40 text-[#FFB1C1] font-mono text-[10px] sm:text-[11px] tracking-[0.2em] uppercase font-bold px-3 py-1.5 rounded-full mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFB1C1] animate-pulse" />
                Madani Avenue · 100 ft · Opens Q2 2026
              </div>
              <h2 className="font-display text-2xl sm:text-3xl lg:text-5xl tracking-tighter leading-[1.05] text-white">
                Bangladesh's first automotive Experience Centre.
              </h2>
              <p className="text-zinc-400 mt-3 sm:mt-4 leading-relaxed text-sm sm:text-base max-w-xl">
                A flagship destination on the 100 ft Madani Avenue corridor — calibrated for the discerning collector and engineered for the automotive enthusiast.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  to="/experience-centre"
                  data-testid="exp-centre-tab"
                  className="magnetic inline-flex items-center gap-2 bg-white text-zinc-900 hover:bg-zinc-100 px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap"
                >
                  Tour the Experience Centre →
                </Link>
                <a
                  href="/inquire"
                  className="magnetic inline-flex items-center gap-2 backdrop-blur-md bg-white/5 border border-white/20 hover:border-white/60 text-white px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap"
                >
                  Reserve a private viewing
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technology — VIN parts finder, AI, blockchain roadmap */}
      <section id="tech-stack" className="bg-white border-b hairline relative overflow-hidden scroll-mt-28">
        <div className="absolute inset-0 grid-bg" aria-hidden="true" />
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-14 sm:py-20 relative z-10 reveal">
          <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-zinc-500 mb-2">The technology stack</div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[1.05] max-w-3xl mb-2">
            The smartest auto-parts experience in Bangladesh.
          </h2>
          <p className="text-zinc-600 max-w-2xl text-sm sm:text-base mb-10">
            Every part of our platform is engineered to remove friction, surface the right answer instantly,
            and learn from every transaction — for both B2B workshops and B2C car owners.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            {/* VIN Parts Finder */}
            <div className="border border-zinc-200 rounded-sm bg-white p-6 sm:p-7 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-sm">Live</div>
              <div className="w-10 h-10 grid place-items-center bg-zinc-900 text-white rounded-sm mb-4">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
                </svg>
              </div>
              <div className="font-display text-lg text-zinc-900">VIN Parts Finder</div>
              <p className="text-sm text-zinc-600 mt-2 leading-relaxed">
                Scan or paste any 17-character VIN — we decode the make, model, year, trim and engine,
                then surface every compatible part in stock with OEM cross-references. Available in the
                <strong className="text-zinc-900"> B2B portal</strong> and the
                <strong className="text-zinc-900"> B2C retail store</strong>.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
                <span className="border border-zinc-200 px-2 py-1 rounded-sm">NHTSA + WMI</span>
                <span className="border border-zinc-200 px-2 py-1 rounded-sm">Catalogue match</span>
                <span className="border border-zinc-200 px-2 py-1 rounded-sm">VIN history</span>
              </div>
            </div>

            {/* AI Assistant */}
            <div className="border border-zinc-200 rounded-sm bg-white p-6 sm:p-7 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-sm">Live</div>
              <div className="w-10 h-10 grid place-items-center bg-zinc-900 text-white rounded-sm mb-4">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 8V4M8 12H4M16 12h4M12 16v4"/>
                  <rect x="8" y="8" width="8" height="8" rx="1"/>
                </svg>
              </div>
              <div className="font-display text-lg text-zinc-900">JOY AI Assistant</div>
              <p className="text-sm text-zinc-600 mt-2 leading-relaxed">
                Powered by Claude. Diagnose symptoms, recommend the right part, build a full order in chat,
                cross-reference OEM numbers, and answer fitment questions — for the bay-floor mechanic
                and the home car owner alike.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
                <span className="border border-zinc-200 px-2 py-1 rounded-sm">Diagnostics</span>
                <span className="border border-zinc-200 px-2 py-1 rounded-sm">Smart reorder</span>
                <span className="border border-zinc-200 px-2 py-1 rounded-sm">Cross-ref</span>
              </div>
            </div>

            {/* Blockchain — future */}
            <div className="border border-zinc-200 rounded-sm bg-zinc-50 p-6 sm:p-7 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-sm">Roadmap</div>
              <div className="w-10 h-10 grid place-items-center bg-zinc-900 text-white rounded-sm mb-4">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1"/>
                  <rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/>
                  <rect x="14" y="14" width="7" height="7" rx="1"/>
                  <path d="M10 6.5h4M6.5 10v4M17.5 10v4M10 17.5h4"/>
                </svg>
              </div>
              <div className="font-display text-lg text-zinc-900">Blockchain Provenance</div>
              <p className="text-sm text-zinc-600 mt-2 leading-relaxed">
                Coming soon. Tamper-proof part-history and ownership records on-chain — every genuine part
                stamped with a verifiable origin trail. Anti-counterfeit, fleet-grade auditability, and
                fraud-resistant resale value.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
                <span className="border border-zinc-200 px-2 py-1 rounded-sm">Provenance</span>
                <span className="border border-zinc-200 px-2 py-1 rounded-sm">Anti-counterfeit</span>
                <span className="border border-zinc-200 px-2 py-1 rounded-sm">2026 roadmap</span>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href="https://www.joyautomart.com" target="_blank" rel="noreferrer" data-testid="tech-retail-vin-link"
               className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-700 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-colors">
              Use it on retail store →
            </a>
          </div>
        </div>
      </section>

      {/* Condensed value proposition — replaces 3 verbose sections (personas + capabilities + how-it-works) */}
      <section id="value-prop" className="max-w-7xl mx-auto px-5 sm:px-6 py-10 sm:py-14 reveal scroll-mt-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          {/* Three audiences — single tight row */}
          <div className="lg:col-span-7">
            <div className="overline text-zinc-500 mb-1.5">One platform · every player</div>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl tracking-tight text-zinc-900 mb-5 leading-tight">
              Dealers source. Workshops fix. Suppliers sell.
            </h2>
            <p className="text-sm sm:text-base text-zinc-700 leading-relaxed max-w-2xl" data-testid="dws-summary">
              <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#E11D48] mr-2">D · W · S</span>
              A single verified network synchronising <span className="font-semibold text-zinc-900">dealers</span>,
              <span className="font-semibold text-zinc-900"> workshops</span> and
              <span className="font-semibold text-zinc-900"> suppliers</span> — wholesale parts on 30-day credit,
              AI-matched SKUs for the bay floor and 312+ approved B2B buyers, with KYC, credit and logistics handled end-to-end.
            </p>
          </div>

          {/* What you get + How it works combined */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-3">
            <Stat n="1000+" l="Verified parts" />
            <Stat n="4" l="Body-kit lines" />
            <Stat n="10–35%" l="Tier off retail price" />
            <Stat n="30d" l="Credit terms" />
          </div>
        </div>

        {/* How it works — 4 steps, single condensed row */}
        <div className="mt-10 sm:mt-12 pt-8 sm:pt-10 border-t border-zinc-200">
          <div className="overline text-zinc-500 mb-3">How it works</div>
          <ol className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {[
              { n: "01", t: "Sign up", d: "Google + trade license." },
              { n: "02", t: "Get approved", d: "Tier + credit, same day." },
              { n: "03", t: "Order", d: "Catalogue, SKU paste, or AI." },
              { n: "04", t: "Track + settle", d: "Live tracking, COD or credit." },
            ].map(({ n, t, d }) => (
              <li key={n} className="border-l-[3px] border-[#E11D48] pl-3 sm:pl-4">
                <div className="overline text-[#E11D48]">{n}</div>
                <div className="font-semibold text-sm sm:text-base mt-0.5 text-zinc-900">{t}</div>
                <p className="text-xs sm:text-sm text-zinc-600 mt-1 leading-snug">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Live order showcase — repositioned as smart card */}
      <section className="max-w-7xl mx-auto px-5 sm:px-6 pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 border border-zinc-200 rounded-sm bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E11D48] opacity-60"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E11D48]"></span>
              </span>
              <span className="overline text-[#E11D48]">Live order tracking</span>
            </div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <div className="font-display text-xl sm:text-2xl text-zinc-900">ORD-20260209-A12B</div>
              <span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded-sm font-semibold uppercase tracking-wider">Shipped</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-xs sm:text-sm">
              <div>
                <div className="text-zinc-500 uppercase tracking-wider text-[10px]">Items</div>
                <div className="font-semibold text-zinc-900 mt-1">Brake Disc Rotor × 4</div>
              </div>
              <div>
                <div className="text-zinc-500 uppercase tracking-wider text-[10px]">Total</div>
                <div className="font-semibold text-zinc-900 mt-1">৳ 18,000</div>
              </div>
              <div>
                <div className="text-zinc-500 uppercase tracking-wider text-[10px]">ETA</div>
                <div className="font-semibold text-zinc-900 mt-1">Tomorrow</div>
              </div>
            </div>
            <div className="mt-5 h-1.5 bg-zinc-100 overflow-hidden rounded-full">
              <div className="h-full bg-[#E11D48] rounded-full" style={{ width: "65%" }} />
            </div>
            <div className="flex justify-between text-[10px] uppercase tracking-wider text-zinc-500 mt-2">
              <span>Placed</span><span>Confirmed</span><span>Packed</span><span className="text-[#E11D48] font-semibold">Shipped</span><span>Delivered</span>
            </div>
          </div>
          <div className="border border-zinc-200 rounded-sm bg-zinc-900 text-white p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="overline text-zinc-400">Don't have JavaScript?</div>
              <h3 className="font-display text-xl mt-2">Order on WhatsApp.</h3>
              <p className="text-sm text-zinc-300 mt-2 leading-relaxed">
                Send your part number to <strong className="text-white">01886-799533</strong>.
                Stock + price confirmed in minutes.
              </p>
            </div>
            <a href="https://wa.me/8801886799533" data-testid="cta-whatsapp-link"
               className="mt-5 inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ca352] text-white px-5 py-2.5 rounded-full font-semibold text-sm transition-colors">
              Open WhatsApp →
            </a>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section id="cta" className="border-t border-zinc-200 bg-zinc-50 scroll-mt-28">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-12 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="overline mb-2 text-zinc-500">Apply now</div>
            <h3 className="font-display text-2xl sm:text-3xl lg:text-4xl tracking-tight">
              Ready to place your first wholesale order?
            </h3>
            <p className="text-zinc-600 mt-2 text-sm sm:text-base">Sign up free. KYC takes a day. Credit gets approved on review.</p>
          </div>
          <button
            data-testid="bottom-cta-button"
            onClick={handleLogin}
            className="inline-flex items-center gap-3 bg-zinc-900 hover:bg-[#E11D48] text-white px-6 py-3 rounded-full text-sm font-semibold transition-colors self-start lg:self-auto"
          >
            Get started →
          </button>
        </div>
      </section>

      {/* Bangladesh Auto Pulse — at the very bottom, just above the footer */}
      <BangladeshNewsSection />

      <footer className="border-t border-zinc-200 bg-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="sm:col-span-2">
              <div className="flex items-center gap-3 mb-3">
                <img src={LOGO} alt="JOY Automart" className="w-9 h-9 object-contain" />
                <div className="font-display text-lg text-zinc-900">JOY Automart</div>
              </div>
              <p className="text-sm text-zinc-600 max-w-md leading-relaxed">
                Bangladesh's first AI-powered auto parts commerce &amp; data platform.
                B2B wholesale · B2C retail · Experience Centre · JOY BEAST atelier.
              </p>
            </div>
            <div>
              <div className="overline text-zinc-500 mb-3">Platforms</div>
              <ul className="space-y-2 text-sm text-zinc-700">
                <li><button onClick={handleLogin} className="hover:text-[#E11D48]" data-testid="footer-portal-link">B2B Portal · Sign in</button></li>
                <li><a href="https://www.joyautomart.com" target="_blank" rel="noreferrer" className="hover:text-[#E11D48]" data-testid="footer-retail-link">Retail Store · joyautomart.com</a></li>
                <li><Link to="/catalog" className="hover:text-[#E11D48]">Catalogue</Link></li>
                <li><Link to="/inquire" className="hover:text-[#E11D48]">JOY BEAST kits</Link></li>
              </ul>
            </div>
            <div>
              <div className="overline text-zinc-500 mb-3">Company</div>
              <ul className="space-y-2 text-sm text-zinc-700">
                <li><a href="https://wa.me/8801886799533" className="hover:text-[#E11D48]">WhatsApp · 01886-799533</a></li>
                <li><a href="mailto:sales@joyautomart.com" className="hover:text-[#E11D48]">sales@joyautomart.com</a></li>
                <li><Link to="/terms" className="hover:text-[#E11D48]" data-testid="footer-terms-link">Terms</Link></li>
                <li><Link to="/privacy" className="hover:text-[#E11D48]" data-testid="footer-privacy-link">Privacy</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-zinc-200 mt-8 pt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-zinc-500">
            <div>© {new Date().getFullYear()} JOY Automart · Dhaka, Bangladesh</div>
            <div>Smarter parts · Stronger journeys</div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
