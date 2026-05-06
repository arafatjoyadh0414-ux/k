import React from "react";
import { useAuth } from "../context/AuthContext";
import { Navigate, Link } from "react-router-dom";
import HARRIER_HERO from "../assets/harrier-hero.jpg";

const LOGO = "https://customer-assets.emergentagent.com/job_458d530b-69c9-4d64-8b89-03923696b1c8/artifacts/gnewd2f2_IMG-20260209-WA0017.jpg";
const HERO = HARRIER_HERO;

const Landing = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;

  const handleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/auth/callback";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-white" data-testid="landing-page">
      {/* Sophisticated, slim white header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 group" data-testid="header-logo-link">
            <img src={LOGO} alt="JOY Automart" className="w-7 h-7 sm:w-8 sm:h-8 object-contain" />
            <div className="leading-tight">
              <div className="font-display text-[15px] sm:text-base text-slate-900 tracking-tight">JOY Automart</div>
              <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.18em] text-slate-500 -mt-0.5">B2B Platform · Bangladesh</div>
            </div>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/catalog"
              className="hidden sm:inline-flex items-center px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              data-testid="header-catalog-link"
            >
              Catalog
            </Link>
            <a
              href="https://wa.me/8801886799533"
              className="hidden md:inline-flex items-center px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              data-testid="header-whatsapp-link"
            >
              WhatsApp
            </a>
            <button
              data-testid="top-login-button"
              onClick={handleLogin}
              className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-700 text-white text-[13px] sm:text-sm font-medium px-4 sm:px-5 py-2 rounded-full transition-colors"
            >
              Sign in
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none"><path d="M5 12L10 8L5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </nav>
        </div>
      </header>

      {/* Full-width hero image at the very top — clean, no overlays on the picture */}
      <section className="relative">
        <div className="w-full overflow-hidden">
          <img
            src={HERO}
            alt="2022 Toyota Harrier with Modelista body kit on a Dhaka avenue with the JOY Automart building in the skyline"
            className="w-full h-[280px] sm:h-[400px] md:h-[500px] lg:h-[560px] object-cover"
          />
        </div>

        {/* Live activity strip — runs below the hero image, smart proof point */}
        <div className="border-y border-slate-200 bg-slate-50">
          <div className="max-w-7xl mx-auto px-5 sm:px-6 py-3 flex items-center gap-3 sm:gap-5 text-xs sm:text-[13px] text-slate-700 overflow-x-auto whitespace-nowrap">
            <span className="inline-flex items-center gap-2 font-semibold text-slate-900">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E11D48] opacity-60"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E11D48]"></span>
              </span>
              Live activity
            </span>
            <span className="text-slate-300">·</span>
            <span><span className="font-semibold text-slate-900">47</span> orders shipping today</span>
            <span className="text-slate-300">·</span>
            <span><span className="font-semibold text-slate-900">৳ 18.2 Cr</span> credit deployed</span>
            <span className="text-slate-300">·</span>
            <span><span className="font-semibold text-slate-900">312</span> workshops onboarded</span>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <span className="hidden sm:inline">Last order <span className="font-semibold text-slate-900">2 min ago</span></span>
          </div>
        </div>
      </section>

      {/* Headline + copy — calmer, editorial layout below the image */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 pt-12 sm:pt-16 pb-10 sm:pb-12">
        <div className="text-[10px] sm:text-[11px] tracking-[0.2em] uppercase text-[#E11D48] font-semibold">
          For Dealers · Workshops · Suppliers
        </div>
        <h1 className="font-display text-3xl sm:text-5xl lg:text-[56px] leading-[1.05] tracking-tight mt-4 max-w-3xl">
          B2B platform built for{" "}
          <span className="text-slate-900">car dealers, workshops</span>{" "}
          <span className="text-[#E11D48]">&amp; suppliers.</span>
        </h1>
        <p className="text-base sm:text-lg text-slate-600 mt-5 sm:mt-6 max-w-2xl leading-relaxed">
          One technology platform for Bangladesh's automotive trade — wholesale distribution,
          inventory financing, import operations, and digital procurement, all under one roof.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            data-testid="hero-google-login-button"
            onClick={handleLogin}
            className="inline-flex items-center gap-2.5 bg-slate-900 hover:bg-slate-700 text-white px-5 sm:px-6 py-3 rounded-full text-sm font-semibold transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 48 48"><path fill="#fff" d="M24 9.5c3.4 0 6.4 1.2 8.8 3.4l6.6-6.6C35.4 2.6 30 .5 24 .5 14.7.5 6.7 5.8 2.9 13.6l7.7 6c1.8-5.5 6.9-9.6 13.4-9.6z"/><path fill="#fff" opacity=".8" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.4 5.5-5 7.2l7.7 6c4.5-4.2 7.1-10.4 7.1-17.7z"/><path fill="#fff" opacity=".6" d="M10.6 28.4c-.5-1.4-.8-2.9-.8-4.4s.3-3 .8-4.4l-7.7-6C1.3 17 0 20.4 0 24s1.3 7 2.9 10.4l7.7-6z"/><path fill="#fff" opacity=".9" d="M24 47.5c6 0 11.4-2 15.4-5.4l-7.7-6c-2.1 1.4-4.8 2.3-7.7 2.3-6.5 0-11.6-4.1-13.4-9.6l-7.7 6C6.7 42.2 14.7 47.5 24 47.5z"/></svg>
            Continue with Google
          </button>
          <a href="/catalog" data-testid="hero-catalog-link"
             className="inline-flex items-center gap-2 bg-white border border-slate-300 hover:border-slate-900 text-slate-900 px-5 sm:px-6 py-3 rounded-full text-sm font-semibold transition-colors">
            Browse catalog
          </a>
          <a href="https://wa.me/8801886799533" data-testid="hero-whatsapp-link"
             className="inline-flex items-center gap-2 text-slate-700 hover:text-[#25D366] px-3 py-2 text-sm font-semibold transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.683 5.526l-.999 3.648 3.805-.873z"/></svg>
            01886-799533
          </a>
          <a href="/inquire" data-testid="hero-inquire-link"
             className="text-sm font-semibold text-slate-700 hover:text-[#E11D48] underline-offset-4 hover:underline">
            Schedule a Kit Install →
          </a>
        </div>
      </section>

      {/* Metric cards */}
      <section className="max-w-7xl mx-auto px-5 sm:px-6 pb-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          {[
            { k: "38+ Parts", t: "Verified catalog", d: "Brakes, suspension, engine, fluids, lighting, electrical, drivetrain — all in stock." },
            { k: "6 Signature Kits", t: "Body kits, fitted", d: "From Shadow GT entry to Cyber Beast flagship + JOY Beast Wide Body for BYD Sealion 6." },
            { k: "Tier Pricing", t: "Silver · Gold · Platinum", d: "Up to 12% off retail, applied automatically. Volume discounts stack on top." },
            { k: "30-day Credit", t: "Credit-backed orders", d: "Approved workshops get a credit limit. Order today, settle in 30. Track usage in the dashboard." },
          ].map(({ k, t, d }) => (
            <div key={k} className="border border-slate-200 p-5 rounded-sm bg-white">
              <div className="overline text-slate-500">{k}</div>
              <div className="font-display text-xl mt-1.5">{t}</div>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-5 sm:px-6 pb-14">
        <div className="overline text-slate-500">How it works</div>
        <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl tracking-tight mt-2 mb-8">
          From signup to delivery in 4 steps
        </h2>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { n: "01", t: "Sign up free", d: "Google sign-in, then upload your trade license for KYC." },
            { n: "02", t: "Get approved", d: "We verify your shop and assign a tier + credit limit (typically same day)." },
            { n: "03", t: "Order anytime", d: "Browse catalog, paste SKUs, or chat with the AI to build orders fast." },
            { n: "04", t: "Track + settle", d: "Live tracking, PDF invoice, and 7-day return window. Pay COD, online, or on credit." },
          ].map(({ n, t, d }) => (
            <li key={n} className="border-l-[3px] border-[#E11D48] pl-4">
              <div className="overline text-[#E11D48]">{n}</div>
              <div className="font-semibold text-base mt-1">{t}</div>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Live order showcase — repositioned as smart card */}
      <section className="max-w-7xl mx-auto px-5 sm:px-6 pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 border border-slate-200 rounded-sm bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E11D48] opacity-60"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E11D48]"></span>
              </span>
              <span className="overline text-[#E11D48]">Live order tracking</span>
            </div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <div className="font-display text-xl sm:text-2xl text-slate-900">ORD-20260209-A12B</div>
              <span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded-sm font-semibold uppercase tracking-wider">Shipped</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-xs sm:text-sm">
              <div>
                <div className="text-slate-500 uppercase tracking-wider text-[10px]">Items</div>
                <div className="font-semibold text-slate-900 mt-1">Brake Disc Rotor × 4</div>
              </div>
              <div>
                <div className="text-slate-500 uppercase tracking-wider text-[10px]">Total</div>
                <div className="font-semibold text-slate-900 mt-1">৳ 18,000</div>
              </div>
              <div>
                <div className="text-slate-500 uppercase tracking-wider text-[10px]">ETA</div>
                <div className="font-semibold text-slate-900 mt-1">Tomorrow</div>
              </div>
            </div>
            <div className="mt-5 h-1.5 bg-slate-100 overflow-hidden rounded-full">
              <div className="h-full bg-[#E11D48] rounded-full" style={{ width: "65%" }} />
            </div>
            <div className="flex justify-between text-[10px] uppercase tracking-wider text-slate-500 mt-2">
              <span>Placed</span><span>Confirmed</span><span>Packed</span><span className="text-[#E11D48] font-semibold">Shipped</span><span>Delivered</span>
            </div>
          </div>
          <div className="border border-slate-200 rounded-sm bg-slate-900 text-white p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="overline text-slate-400">Don't have JavaScript?</div>
              <h3 className="font-display text-xl mt-2">Order on WhatsApp.</h3>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">
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
      <section className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-12 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="overline mb-2 text-slate-500">Apply now</div>
            <h3 className="font-display text-2xl sm:text-3xl lg:text-4xl tracking-tight">
              Ready to place your first wholesale order?
            </h3>
            <p className="text-slate-600 mt-2 text-sm sm:text-base">Sign up free. KYC takes a day. Credit gets approved on review.</p>
          </div>
          <button
            data-testid="bottom-cta-button"
            onClick={handleLogin}
            className="inline-flex items-center gap-3 bg-slate-900 hover:bg-[#E11D48] text-white px-6 py-3 rounded-full text-sm font-semibold transition-colors self-start lg:self-auto"
          >
            Get started →
          </button>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} JOY Automart · Dhaka, Bangladesh ·{" "}
            <a href="mailto:sales@joyautomart.com" className="hover:text-[#E11D48]">sales@joyautomart.com</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/terms" className="hover:text-[#E11D48]" data-testid="footer-terms-link">Terms</Link>
            <span>·</span>
            <Link to="/privacy" className="hover:text-[#E11D48]" data-testid="footer-privacy-link">Privacy</Link>
            <span>·</span>
            <a href="https://www.joyautomart.com" target="_blank" rel="noreferrer" className="hover:text-[#E11D48]">Retail website</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
