import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";
import axios from "axios";
import { useScrollReveal } from "../hooks/useScrollReveal";
import MobileScrollSpyChips from "../components/MobileScrollSpyChips";

import { LOGO, buildTicker } from "../components/landing/landingHelpers";
import LiveTickerStrip from "../components/landing/LiveTickerStrip";
import StickyHeader from "../components/landing/StickyHeader";
import HeroSection from "../components/landing/HeroSection";
import EcosystemSection from "../components/landing/EcosystemSection";
import WhatWeDoBento from "../components/landing/WhatWeDoBento";
import JoyBeastSection from "../components/landing/JoyBeastSection";
import ExperienceCentreTeaser from "../components/landing/ExperienceCentreTeaser";
import TechStackSection from "../components/landing/TechStackSection";
import ValuePropSection from "../components/landing/ValuePropSection";
import LiveOrderShowcase from "../components/landing/LiveOrderShowcase";
import BottomCTASection from "../components/landing/BottomCTASection";
import BangladeshNewsSection from "../components/landing/BangladeshNewsSection";
import LandingFooter from "../components/landing/LandingFooter";

const Landing = () => {
  const { user, loading } = useAuth();
  const [stats, setStats] = useState(null);
  const [news, setNews] = useState([]);
  useScrollReveal();

  useEffect(() => {
    let mounted = true;
    axios
      .get(`${process.env.REACT_APP_BACKEND_URL}/api/public/stats`)
      .then((r) => {
        if (mounted) setStats(r.data);
      })
      .catch(() => {});
    axios
      .get(`${process.env.REACT_APP_BACKEND_URL}/api/public/cars-news`)
      .then((r) => {
        if (mounted) setNews(r.data?.items || []);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return null;
  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;

  const handleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/auth/callback";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const ticker = buildTicker(stats, news);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 fut" data-testid="landing-page">
      {/* Subtle SVG noise grain */}
      <div className="grain-overlay" aria-hidden="true" />

      {/* JOY Automart watermark — fixed-position low-opacity brand mark behind content */}
      <div
        aria-hidden="true"
        data-testid="hero-watermark"
        className="hidden lg:block fixed pointer-events-none select-none z-[1] right-6 bottom-1/3 opacity-[0.045] dark:opacity-[0.07]"
      >
        <img src={LOGO} alt="" className="w-[480px] h-[480px] object-contain" />
      </div>

      <LiveTickerStrip ticker={ticker} hasNews={news.length > 0} />
      <StickyHeader onLogin={handleLogin} />
      <MobileScrollSpyChips />

      <HeroSection onLogin={handleLogin} />
      <EcosystemSection />
      <WhatWeDoBento />
      <JoyBeastSection />
      <ExperienceCentreTeaser />
      <TechStackSection />
      <ValuePropSection />
      <LiveOrderShowcase />
      <BottomCTASection onLogin={handleLogin} />
      <BangladeshNewsSection />
      <LandingFooter onLogin={handleLogin} />
    </div>
  );
};

export default Landing;
