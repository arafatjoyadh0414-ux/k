import React from "react";
import { useAuth } from "../context/AuthContext";
import { Navigate, Link } from "react-router-dom";
import HARRIER_HERO from "../assets/harrier-hero.jpg";
import BYD_CYBERBEAST from "../assets/byd-cyberbeast.jpg";
import EXP_FACADE_1 from "../assets/exp/facade-1.jpg";
import EXP_FACADE_2 from "../assets/exp/facade-2.jpg";
import EXP_CAFE from "../assets/exp/cafe.jpg";
import EXP_MEZZANINE from "../assets/exp/mezzanine.jpg";
import EXP_CONFERENCE from "../assets/exp/conference.jpg";
import EXP_NIGHT from "../assets/exp/night-00.jpg";

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
        <div className="max-w-7xl mx-auto px-5 sm:px-6 h-16 sm:h-[72px] flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 group" data-testid="header-logo-link" aria-label="JOY Automart — Go to home">
            <img src={LOGO} alt="JOY Automart" className="w-11 h-11 sm:w-12 sm:h-12 object-contain rounded-sm transition-transform group-hover:scale-105" />
            <div className="leading-tight">
              <div className="font-display text-lg sm:text-xl text-slate-900 tracking-tight font-semibold">JOY Automart</div>
              <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-slate-500 mt-0.5">B2B Platform · Bangladesh</div>
            </div>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <a
              href="https://www.joyautomart.com"
              target="_blank"
              rel="noreferrer"
              className="hidden lg:inline-flex items-center px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              data-testid="header-retail-link"
            >
              Retail Store
            </a>
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
              className="inline-flex items-center bg-slate-900 hover:bg-slate-700 text-white text-[13px] sm:text-sm font-medium px-5 sm:px-6 py-2.5 rounded-full transition-colors whitespace-nowrap"
            >
              Sign in
            </button>
          </nav>
        </div>
      </header>

      {/* Full-width hero image at the very top — clean, no overlays on the picture */}
      <section className="relative">
        <div className="w-full overflow-hidden">
          <img
            src={HERO}
            alt="Aggressive 2022 Toyota Harrier sport SUV with Modelista body kit — JOY Automart brand campaign for car dealers, workshops & suppliers"
            className="w-full h-[280px] sm:h-[400px] md:h-[500px] lg:h-[560px] object-cover"
          />
        </div>
      </section>

      {/* Headline + copy — sophisticated, L'Oréal-style positioning */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 pt-12 sm:pt-16 pb-10 sm:pb-12">
        <div className="text-[10px] sm:text-[11px] tracking-[0.2em] uppercase text-[#E11D48] font-semibold">
          Bangladesh's First AI-Powered Auto Parts Commerce &amp; Data Platform
        </div>
        <h1 className="font-display text-3xl sm:text-5xl lg:text-[56px] leading-[1.05] tracking-tight mt-4 max-w-4xl">
          Smarter parts.{" "}
          <span className="text-slate-900">Stronger journeys.</span>{" "}
          <span className="text-[#E11D48]">One platform.</span>
        </h1>
        <p className="text-base sm:text-lg text-slate-600 mt-5 sm:mt-6 max-w-2xl leading-relaxed">
          JOY Automart is rebuilding Bangladesh's automotive aftermarket end-to-end —
          B2B parts supply for car dealers and workshops, B2C retail for car owners,
          a flagship Experience Centre, and an AI-driven data layer that gives the
          industry intelligence it has never had before.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            data-testid="hero-google-login-button"
            onClick={handleLogin}
            className="inline-flex items-center gap-2.5 bg-slate-900 hover:bg-slate-700 text-white px-5 sm:px-6 py-3 rounded-full text-sm font-semibold transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 48 48"><path fill="#fff" d="M24 9.5c3.4 0 6.4 1.2 8.8 3.4l6.6-6.6C35.4 2.6 30 .5 24 .5 14.7.5 6.7 5.8 2.9 13.6l7.7 6c1.8-5.5 6.9-9.6 13.4-9.6z"/><path fill="#fff" opacity=".8" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.4 5.5-5 7.2l7.7 6c4.5-4.2 7.1-10.4 7.1-17.7z"/><path fill="#fff" opacity=".6" d="M10.6 28.4c-.5-1.4-.8-2.9-.8-4.4s.3-3 .8-4.4l-7.7-6C1.3 17 0 20.4 0 24s1.3 7 2.9 10.4l7.7-6z"/><path fill="#fff" opacity=".9" d="M24 47.5c6 0 11.4-2 15.4-5.4l-7.7-6c-2.1 1.4-4.8 2.3-7.7 2.3-6.5 0-11.6-4.1-13.4-9.6l-7.7 6C6.7 42.2 14.7 47.5 24 47.5z"/></svg>
            Open the B2B portal
          </button>
          <a href="https://www.joyautomart.com" target="_blank" rel="noreferrer" data-testid="hero-retail-link"
             className="inline-flex items-center gap-2 bg-white border border-slate-300 hover:border-slate-900 text-slate-900 px-5 sm:px-6 py-3 rounded-full text-sm font-semibold transition-colors">
            Visit retail store →
          </a>
          <a href="/catalog" data-testid="hero-catalog-link"
             className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900 px-3 py-2 text-sm font-semibold transition-colors">
            Browse catalog
          </a>
          <a href="https://wa.me/8801886799533" data-testid="hero-whatsapp-link"
             className="inline-flex items-center gap-2 text-slate-700 hover:text-[#25D366] px-3 py-2 text-sm font-semibold transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.683 5.526l-.999 3.648 3.805-.873z"/></svg>
            01886-799533
          </a>
        </div>
      </section>

      {/* What we do — 5 pillars (sophisticated cards) */}
      <section className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-14 sm:py-16">
          <div className="overline text-slate-500 mb-2">What we do</div>
          <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl tracking-tight max-w-3xl mb-2">
            Five businesses. One ecosystem.
          </h2>
          <p className="text-slate-600 max-w-2xl text-sm sm:text-base mb-10">
            From the bay floor to the boardroom — we cover the entire automotive aftermarket value chain.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-5">
            <div className="bg-white border border-slate-200 p-6 rounded-sm">
              <div className="overline text-[#E11D48] mb-3">01 · B2B Wholesale</div>
              <div className="font-display text-lg mb-2">Workshops &amp; Dealers</div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Verified parts, tier-based wholesale pricing, 30-day credit, and live order tracking
                for car dealers and auto-repair workshops nationwide.
              </p>
            </div>
            <div className="bg-white border border-slate-200 p-6 rounded-sm">
              <div className="overline text-[#E11D48] mb-3">02 · B2C Retail</div>
              <div className="font-display text-lg mb-2">Online &amp; Walk-in</div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Direct-to-consumer auto parts e-commerce on{" "}
                <a href="https://www.joyautomart.com" target="_blank" rel="noreferrer"
                   className="text-slate-900 underline underline-offset-2 hover:text-[#E11D48]">www.joyautomart.com</a>{" "}
                — paired with our flagship retail showroom.
              </p>
            </div>
            <div className="bg-white border border-slate-200 p-6 rounded-sm">
              <div className="overline text-[#E11D48] mb-3">03 · Experience Centre</div>
              <div className="font-display text-lg mb-2">Bangladesh's first</div>
              <p className="text-sm text-slate-600 leading-relaxed">
                A 1,560 sq ft premium showroom on Banani Link Road —
                hero car zone, JOY Café, mezzanine viewing room. Launching in 2 months.
              </p>
            </div>
            <div className="bg-white border border-slate-200 p-6 rounded-sm">
              <div className="overline text-[#E11D48] mb-3">04 · Data &amp; AI</div>
              <div className="font-display text-lg mb-2">Industry intelligence</div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Every transaction, every part, every vehicle, every behaviour — captured and modelled.
                Demand forecasting, smart pricing, predictive insights.
              </p>
            </div>
            <div className="bg-slate-900 text-white border border-slate-900 p-6 rounded-sm">
              <div className="overline text-[#E11D48] mb-3">05 · JOY BEAST</div>
              <div className="font-display text-lg mb-2">The atelier</div>
              <p className="text-sm text-slate-300 leading-relaxed">
                Our in-house premium modification house. Body kits, forged wheels, performance tuning,
                bespoke leather interiors and custom builds — engineered in Bangladesh.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* JOY BEAST — In-house premium modification & body-kit atelier */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
            <div className="lg:col-span-5 order-1">
              <div className="overline text-[#E11D48] mb-3">JOY BEAST · The Atelier</div>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight leading-[1.05]">
                A premium modification house. Built in Bangladesh.
              </h2>
              <p className="text-slate-600 mt-5 leading-relaxed text-sm sm:text-base">
                JOY BEAST is our in-house atelier — a luxury modification brand that competes with the
                world's finest tuning houses. Every build is hand-finished at the Experience Centre with
                workshop-grade fitment guarantees. From bolt-on aero kits to ground-up wide-body conversions
                and bespoke leather interiors, this is where ordinary cars become signature builds.
              </p>

              {/* Service pillars */}
              <div className="mt-7 space-y-4">
                <div className="flex gap-3">
                  <div className="shrink-0 w-9 h-9 grid place-items-center bg-slate-900 text-white rounded-sm">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17l4-8 4 8 4-12 4 12"/><path d="M3 21h18"/></svg>
                  </div>
                  <div>
                    <div className="font-display text-base text-slate-900">Body Kits &amp; Aero</div>
                    <div className="text-sm text-slate-600 mt-0.5">Wide-body fender flares, splitters, diffusers, side skirts, vented bonnets, ducktail spoilers — moulded in carbon-composite, painted to OEM-match.</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="shrink-0 w-9 h-9 grid place-items-center bg-slate-900 text-white rounded-sm">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                  </div>
                  <div>
                    <div className="font-display text-base text-slate-900">Forged Wheels &amp; Performance Brakes</div>
                    <div className="text-sm text-slate-600 mt-0.5">21–22" forged multi-spoke alloys, big-brake upgrades with red anodised calipers, performance pads &amp; lines.</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="shrink-0 w-9 h-9 grid place-items-center bg-slate-900 text-white rounded-sm">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8h18l-2 13H5L3 8z"/><path d="M8 8V5a4 4 0 0 1 8 0v3"/></svg>
                  </div>
                  <div>
                    <div className="font-display text-base text-slate-900">Bespoke Interior &amp; Upholstery</div>
                    <div className="text-sm text-slate-600 mt-0.5">Full-grain Nappa leather, Alcantara headliners, contrast stitching, custom dashboards, carbon-fibre trim, premium audio &amp; ambient lighting.</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="shrink-0 w-9 h-9 grid place-items-center bg-slate-900 text-white rounded-sm">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>
                  </div>
                  <div>
                    <div className="font-display text-base text-slate-900">Performance Tuning</div>
                    <div className="text-sm text-slate-600 mt-0.5">ECU remaps, stage-1/2 power packs, sport exhausts, lowering springs &amp; coilovers, cold-air intakes — dyno-validated upgrades for measurable gains.</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="shrink-0 w-9 h-9 grid place-items-center bg-slate-900 text-white rounded-sm">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  </div>
                  <div>
                    <div className="font-display text-base text-slate-900">Custom Atelier Builds</div>
                    <div className="text-sm text-slate-600 mt-0.5">Ground-up bespoke commissions — fleet liveries, one-off concept builds, and full Cyber Beast wide-body conversions on request.</div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <a href="/inquire" data-testid="beast-inquire-link"
                   className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-colors">
                  Schedule a kit consultation →
                </a>
                <Link to="/kits" data-testid="beast-kits-link"
                      className="inline-flex items-center gap-2 border border-slate-300 hover:border-slate-900 text-slate-900 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors">
                  Browse all kits
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7 order-2">
              <div className="relative overflow-hidden rounded-sm border border-slate-200">
                <img
                  src={BYD_CYBERBEAST}
                  alt="JOY BEAST Cyber Beast — modified BYD Sealion 6 with wide-body aero kit, forged wheels, and red performance brake calipers"
                  className="w-full h-[300px] sm:h-[420px] lg:h-[540px] object-cover"
                />
                <div className="absolute top-3 left-3 bg-black/80 backdrop-blur text-white text-[10px] tracking-[0.2em] uppercase px-3 py-1.5 rounded-sm font-semibold">
                  Cyber Beast · BYD Sealion 6
                </div>
              </div>
              {/* Kit tier strip below image */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { t: "Shadow GT", d: "Entry sport" },
                  { t: "Cyber Beast", d: "Flagship aero", featured: true },
                  { t: "Beast Wide Body", d: "Wide-body" },
                  { t: "Custom Atelier", d: "Bespoke" },
                ].map((k) => (
                  <div key={k.t} className={`p-3 rounded-sm border text-center ${k.featured ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-900"}`}>
                    <div className="font-display text-sm">{k.t}</div>
                    <div className={`text-[10px] uppercase tracking-wider mt-0.5 ${k.featured ? "text-slate-300" : "text-slate-500"}`}>{k.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Experience Centre — Bangladesh's first */}
      <section className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            <div className="lg:col-span-5">
              <div className="inline-flex items-center gap-2 bg-[#E11D48] text-white text-[10px] sm:text-[11px] tracking-[0.2em] uppercase font-bold px-3 py-1.5 rounded-full mb-5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-70"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                Launching in 2 months
              </div>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight leading-[1.05]">
                The first automotive Experience Centre Bangladesh has ever seen.
              </h2>
              <p className="text-slate-300 mt-5 sm:mt-6 leading-relaxed text-sm sm:text-base">
                A 1,560 sq ft flagship space on Banani Link Road — sitting beside OTTOFIX,
                BYD and the European Luxury Car Showroom. Hero car zone. JOY Café.
                Mezzanine viewing room. Premium consultation suite. Built for the way
                car dealers, fleet owners, and enthusiasts actually want to experience
                their parts and modifications.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span className="text-[#E11D48] mt-1">▍</span>
                  <span><strong className="text-white">Hero Car Zone</strong> — display the build, then drive it home.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#E11D48] mt-1">▍</span>
                  <span><strong className="text-white">JOY Café</strong> — bar-style lounge with espresso while consultations run.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#E11D48] mt-1">▍</span>
                  <span><strong className="text-white">Premium Consultation Suite</strong> — private office for fleet &amp; dealer accounts.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-[#E11D48] mt-1">▍</span>
                  <span><strong className="text-white">Mezzanine Viewing Room</strong> — 75–85" panel for events, training, brand experiences.</span>
                </li>
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="/inquire" data-testid="exp-inquire-link"
                   className="inline-flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors">
                  Reserve a private viewing →
                </a>
                <a href="https://www.joyautomart.com" target="_blank" rel="noreferrer" data-testid="exp-retail-link"
                   className="inline-flex items-center gap-2 border border-white/30 hover:border-white text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-colors">
                  Visit retail website
                </a>
              </div>
            </div>
            <div className="lg:col-span-7 grid grid-cols-2 gap-3">
              <div className="col-span-2 relative overflow-hidden rounded-sm">
                <img src={EXP_FACADE_1} alt="JOY Automart Experience Centre — front elevation, night view" className="w-full h-[280px] sm:h-[360px] object-cover" />
                <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur text-white text-[10px] tracking-[0.2em] uppercase px-3 py-1.5 rounded-sm">Front Elevation · 24 ft wide</div>
              </div>
              <div className="relative overflow-hidden rounded-sm">
                <img src={EXP_CAFE} alt="JOY Café and main showroom floor" className="w-full h-[140px] sm:h-[200px] object-cover" />
                <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur text-white text-[9px] tracking-[0.18em] uppercase px-2 py-1 rounded-sm">JOY Café</div>
              </div>
              <div className="relative overflow-hidden rounded-sm">
                <img src={EXP_MEZZANINE} alt="Mezzanine viewing room above the showroom" className="w-full h-[140px] sm:h-[200px] object-cover" />
                <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur text-white text-[9px] tracking-[0.18em] uppercase px-2 py-1 rounded-sm">Mezzanine</div>
              </div>
              <div className="relative overflow-hidden rounded-sm">
                <img src={EXP_FACADE_2} alt="Experience Centre — side angle" className="w-full h-[140px] sm:h-[200px] object-cover" />
                <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur text-white text-[9px] tracking-[0.18em] uppercase px-2 py-1 rounded-sm">Side Elevation</div>
              </div>
              <div className="relative overflow-hidden rounded-sm">
                <img src={EXP_CONFERENCE} alt="Premium consultation suite & conference room" className="w-full h-[140px] sm:h-[200px] object-cover" />
                <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur text-white text-[9px] tracking-[0.18em] uppercase px-2 py-1 rounded-sm">Consultation Suite</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technology — VIN parts finder, AI, blockchain roadmap */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
          <div className="overline text-slate-500 mb-2">The technology stack</div>
          <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl tracking-tight max-w-3xl mb-2">
            The smartest auto-parts experience in Bangladesh.
          </h2>
          <p className="text-slate-600 max-w-2xl text-sm sm:text-base mb-10">
            Every part of our platform is engineered to remove friction, surface the right answer instantly,
            and learn from every transaction — for both B2B workshops and B2C car owners.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            {/* VIN Parts Finder */}
            <div className="border border-slate-200 rounded-sm bg-white p-6 sm:p-7 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-sm">Live</div>
              <div className="w-10 h-10 grid place-items-center bg-slate-900 text-white rounded-sm mb-4">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
                </svg>
              </div>
              <div className="font-display text-lg text-slate-900">VIN Parts Finder</div>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Scan or paste any 17-character VIN — we decode the make, model, year, trim and engine,
                then surface every compatible part in stock with OEM cross-references. Available in the
                <strong className="text-slate-900"> B2B portal</strong> and the
                <strong className="text-slate-900"> B2C retail store</strong>.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-wider text-slate-500">
                <span className="border border-slate-200 px-2 py-1 rounded-sm">NHTSA + WMI</span>
                <span className="border border-slate-200 px-2 py-1 rounded-sm">Catalog match</span>
                <span className="border border-slate-200 px-2 py-1 rounded-sm">VIN history</span>
              </div>
            </div>

            {/* AI Assistant */}
            <div className="border border-slate-200 rounded-sm bg-white p-6 sm:p-7 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-sm">Live</div>
              <div className="w-10 h-10 grid place-items-center bg-slate-900 text-white rounded-sm mb-4">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 8V4M8 12H4M16 12h4M12 16v4"/>
                  <rect x="8" y="8" width="8" height="8" rx="1"/>
                </svg>
              </div>
              <div className="font-display text-lg text-slate-900">JOY AI Assistant</div>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Powered by Claude. Diagnose symptoms, recommend the right part, build a full order in chat,
                cross-reference OEM numbers, and answer fitment questions — for the bay-floor mechanic
                and the home car owner alike.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-wider text-slate-500">
                <span className="border border-slate-200 px-2 py-1 rounded-sm">Diagnostics</span>
                <span className="border border-slate-200 px-2 py-1 rounded-sm">Smart reorder</span>
                <span className="border border-slate-200 px-2 py-1 rounded-sm">Cross-ref</span>
              </div>
            </div>

            {/* Blockchain — future */}
            <div className="border border-slate-200 rounded-sm bg-slate-50 p-6 sm:p-7 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-sm">Roadmap</div>
              <div className="w-10 h-10 grid place-items-center bg-slate-900 text-white rounded-sm mb-4">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1"/>
                  <rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/>
                  <rect x="14" y="14" width="7" height="7" rx="1"/>
                  <path d="M10 6.5h4M6.5 10v4M17.5 10v4M10 17.5h4"/>
                </svg>
              </div>
              <div className="font-display text-lg text-slate-900">Blockchain Provenance</div>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Coming soon. Tamper-proof part-history and ownership records on-chain — every genuine part
                stamped with a verifiable origin trail. Anti-counterfeit, fleet-grade auditability, and
                fraud-resistant resale value.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-wider text-slate-500">
                <span className="border border-slate-200 px-2 py-1 rounded-sm">Provenance</span>
                <span className="border border-slate-200 px-2 py-1 rounded-sm">Anti-counterfeit</span>
                <span className="border border-slate-200 px-2 py-1 rounded-sm">2026 roadmap</span>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/vin-lookup" data-testid="tech-vin-link"
                  className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-colors">
              Try the VIN parts finder →
            </Link>
            <a href="https://www.joyautomart.com" target="_blank" rel="noreferrer" data-testid="tech-retail-vin-link"
               className="inline-flex items-center gap-2 border border-slate-300 hover:border-slate-900 text-slate-900 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors">
              Use it on retail store
            </a>
          </div>
        </div>
      </section>

      {/* Persona cards — explicit dealer / workshop / supplier mention */}
      <section className="max-w-7xl mx-auto px-5 sm:px-6 pb-14">
        <div className="overline text-slate-500 mb-2">Built for three sides of the trade</div>
        <h2 className="font-display text-2xl sm:text-3xl tracking-tight mb-6">One platform. Every player.</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          {[
            {
              k: "For Car Dealers",
              t: "Source faster, finance smarter",
              d: "Wholesale parts at dealer pricing, body kit fitments, service-bay supply, and inventory financing — keep showroom prep flowing."
            },
            {
              k: "For Auto Workshops",
              t: "Order on credit, fix in hours",
              d: "Verified parts, AI-assisted diagnostics, 30-day credit terms, and live order tracking — built for the bay floor."
            },
            {
              k: "For Suppliers",
              t: "Reach 312+ verified buyers",
              d: "Onboard your catalog, fulfil B2B orders nationwide, and settle invoices digitally. We handle KYC, credit, and logistics."
            },
          ].map(({ k, t, d }) => (
            <div key={k} className="border border-slate-200 p-5 rounded-sm bg-white">
              <div className="overline text-[#E11D48]">{k}</div>
              <div className="font-display text-xl mt-2">{t}</div>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Capability cards */}
      <section className="max-w-7xl mx-auto px-5 sm:px-6 pb-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          {[
            { k: "38+ Parts", t: "Verified catalog", d: "Brakes, suspension, engine, fluids, lighting, electrical, drivetrain — all in stock." },
            { k: "6 Signature Kits", t: "Body kits, fitted", d: "From Shadow GT entry to Cyber Beast flagship + JOY Beast Wide Body for BYD Sealion 6." },
            { k: "Tier Pricing", t: "Silver · Gold · Platinum", d: "Up to 12% off retail, applied automatically. Volume discounts stack on top." },
            { k: "30-day Credit", t: "Inventory financing", d: "Approved dealers & workshops get a credit limit. Order today, settle in 30. Track usage live." },
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
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="sm:col-span-2">
              <div className="flex items-center gap-3 mb-3">
                <img src={LOGO} alt="JOY Automart" className="w-9 h-9 object-contain" />
                <div className="font-display text-lg text-slate-900">JOY Automart</div>
              </div>
              <p className="text-sm text-slate-600 max-w-md leading-relaxed">
                Bangladesh's first AI-powered auto parts commerce &amp; data platform.
                B2B wholesale · B2C retail · Experience Centre · JOY BEAST atelier.
              </p>
            </div>
            <div>
              <div className="overline text-slate-500 mb-3">Platforms</div>
              <ul className="space-y-2 text-sm text-slate-700">
                <li><button onClick={handleLogin} className="hover:text-[#E11D48]" data-testid="footer-portal-link">B2B Portal · Sign in</button></li>
                <li><a href="https://www.joyautomart.com" target="_blank" rel="noreferrer" className="hover:text-[#E11D48]" data-testid="footer-retail-link">Retail Store · joyautomart.com</a></li>
                <li><Link to="/catalog" className="hover:text-[#E11D48]">Catalog</Link></li>
                <li><Link to="/inquire" className="hover:text-[#E11D48]">JOY BEAST kits</Link></li>
              </ul>
            </div>
            <div>
              <div className="overline text-slate-500 mb-3">Company</div>
              <ul className="space-y-2 text-sm text-slate-700">
                <li><a href="https://wa.me/8801886799533" className="hover:text-[#E11D48]">WhatsApp · 01886-799533</a></li>
                <li><a href="mailto:sales@joyautomart.com" className="hover:text-[#E11D48]">sales@joyautomart.com</a></li>
                <li><Link to="/terms" className="hover:text-[#E11D48]" data-testid="footer-terms-link">Terms</Link></li>
                <li><Link to="/privacy" className="hover:text-[#E11D48]" data-testid="footer-privacy-link">Privacy</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-200 mt-8 pt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500">
            <div>© {new Date().getFullYear()} JOY Automart · Dhaka, Bangladesh</div>
            <div>Smarter parts · Stronger journeys</div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
