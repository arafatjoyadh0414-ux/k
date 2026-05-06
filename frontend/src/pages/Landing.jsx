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
      {/* Top bar — dark navy, matches prerender shell */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <img src={LOGO} alt="JOY Automart" className="w-10 h-10 object-contain" />
            <div>
              <div className="font-display text-lg leading-none">JOY Automart</div>
              <div className="overline text-slate-300 mt-1">B2B Workshop Portal · Bangladesh</div>
            </div>
          </div>
          <button
            data-testid="top-login-button"
            onClick={handleLogin}
            className="bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-semibold px-5 py-2.5 rounded-sm transition-colors"
          >
            Sign in
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-12 pb-16 lg:pt-16 lg:pb-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-7">
          <div className="overline text-[#E11D48] mb-4">For Repair Workshops · Dhaka &amp; Nationwide</div>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl leading-[1.05] tracking-tight">
            B2B platform built for<br />
            car dealers, workshops<br />
            <span className="text-[#E11D48]">&amp; suppliers.</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600 mt-6 max-w-xl leading-relaxed">
            One technology platform for Bangladesh's automotive trade — wholesale distribution,
            inventory financing, import operations, and digital procurement, all under one roof.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              data-testid="hero-google-login-button"
              onClick={handleLogin}
              className="inline-flex items-center gap-3 bg-slate-900 hover:bg-[#E11D48] text-white px-6 py-3 rounded-sm font-semibold transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#fff" d="M24 9.5c3.4 0 6.4 1.2 8.8 3.4l6.6-6.6C35.4 2.6 30 .5 24 .5 14.7.5 6.7 5.8 2.9 13.6l7.7 6c1.8-5.5 6.9-9.6 13.4-9.6z"/><path fill="#fff" opacity=".8" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.4 5.5-5 7.2l7.7 6c4.5-4.2 7.1-10.4 7.1-17.7z"/><path fill="#fff" opacity=".6" d="M10.6 28.4c-.5-1.4-.8-2.9-.8-4.4s.3-3 .8-4.4l-7.7-6C1.3 17 0 20.4 0 24s1.3 7 2.9 10.4l7.7-6z"/><path fill="#fff" opacity=".9" d="M24 47.5c6 0 11.4-2 15.4-5.4l-7.7-6c-2.1 1.4-4.8 2.3-7.7 2.3-6.5 0-11.6-4.1-13.4-9.6l-7.7 6C6.7 42.2 14.7 47.5 24 47.5z"/></svg>
              Continue with Google
            </button>
            <a href="/catalog" data-testid="hero-catalog-link"
               className="inline-flex items-center gap-2 bg-white border border-slate-300 hover:border-slate-900 text-slate-900 px-6 py-3 rounded-sm font-semibold transition-colors">
              Browse catalog
            </a>
            <a href="https://wa.me/8801886799533" data-testid="hero-whatsapp-link"
               className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ca352] text-white px-5 py-3 rounded-sm font-semibold transition-colors">
              WhatsApp 01886-799533
            </a>
            <a href="/inquire" data-testid="hero-inquire-link"
               className="text-sm font-semibold text-slate-700 hover:text-[#E11D48] underline-offset-4 hover:underline">
              Schedule a Kit Install →
            </a>
          </div>
        </div>

        {/* Hero image — Modelista-kitted Harrier on Gulshan with JOY Automart building */}
        <div className="lg:col-span-5 relative">
          <div className="relative border border-slate-200 rounded-sm overflow-hidden shadow-sm">
            <img
              src={HERO}
              alt="2022 Toyota Harrier with Modelista body kit on a Dhaka avenue with the JOY Automart building in the skyline"
              className="w-full h-[360px] sm:h-[420px] lg:h-[460px] object-cover"
            />
            {/* Compact live-order ribbon — no inner detail tabs */}
            <div className="absolute bottom-3 left-3 right-3 sm:left-4 sm:right-4 bg-white/95 backdrop-blur border border-slate-200 px-3 py-2 flex items-center gap-3 text-xs">
              <span className="inline-block w-2 h-2 rounded-full bg-[#E11D48] animate-pulse" />
              <span className="overline">Live Order</span>
              <span className="text-slate-300">·</span>
              <span className="font-semibold text-slate-900 truncate">ORD-A12B</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-600 hidden sm:inline">Shipped</span>
              <span className="ml-auto font-semibold">৳ 18,000</span>
            </div>
          </div>
        </div>
      </section>

      {/* Metric cards — matches prerender shell */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
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

      {/* How it works — 4 steps */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
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

      {/* Slow-connection / WhatsApp fallback */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="bg-slate-50 border border-slate-200 rounded-sm p-6 sm:p-7">
          <div className="overline text-slate-500">Don't have JavaScript or a slow connection?</div>
          <h3 className="font-display text-xl sm:text-2xl mt-2 mb-2">Order on WhatsApp instead.</h3>
          <p className="text-sm text-slate-600 max-w-2xl mb-4">
            Send your part number and quantity to <strong>01886-799533</strong>. Our team confirms stock + price within minutes.
          </p>
          <a href="https://wa.me/8801886799533" data-testid="cta-whatsapp-link"
             className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ca352] text-white px-5 py-2.5 rounded-sm font-semibold text-sm transition-colors">
            Open WhatsApp →
          </a>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
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
            className="inline-flex items-center gap-3 bg-slate-900 hover:bg-[#E11D48] text-white px-6 py-3 rounded-sm font-semibold transition-colors self-start lg:self-auto"
          >
            Get started →
          </button>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500">
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
