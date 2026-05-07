import React from "react";
import HARRIER_HERO from "../../assets/harrier-hero.jpg";

const TRI_PILLARS = [
  { n: "01", t: "Automotive Commerce" },
  { n: "02", t: "Data Infrastructure" },
  { n: "03", t: "Iconic Experience Platform" },
];

const HeroSection = ({ onLogin }) => (
  <section id="hero" className="relative scroll-mt-28">
    {/* Full-width hero image — clean, no overlays */}
    <div className="w-full overflow-hidden relative">
      <img
        src={HARRIER_HERO}
        alt="Aggressive 2022 Toyota Harrier sport SUV with Modelista body kit — JOY Automart brand campaign for car dealers, workshops & suppliers"
        className="w-full h-[280px] sm:h-[400px] md:h-[500px] lg:h-[560px] object-cover"
      />
    </div>

    {/* Hero CTAs — mounted just below the image for stronger conversion */}
    <div
      className="max-w-5xl mx-auto px-5 sm:px-6 pt-6 sm:pt-8 flex flex-wrap items-center justify-center gap-3"
      data-testid="hero-cta-row"
    >
      <button
        data-testid="hero-google-login-button"
        onClick={onLogin}
        className="magnetic inline-flex items-center gap-2.5 bg-zinc-800 hover:bg-zinc-700 text-white px-5 sm:px-6 py-3 rounded-full text-sm font-semibold shadow-md hover:shadow-xl transition-all"
      >
        <svg className="w-[18px] h-[18px]" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.4 5.5-5 7.2l7.7 6c4.5-4.2 7.1-10.4 7.1-17.7z" />
          <path fill="#34A853" d="M24 47.5c6 0 11.4-2 15.4-5.4l-7.7-6c-2.1 1.4-4.8 2.3-7.7 2.3-6.5 0-11.6-4.1-13.4-9.6l-7.7 6C6.7 42.2 14.7 47.5 24 47.5z" />
          <path fill="#FBBC05" d="M10.6 28.4c-.5-1.4-.8-2.9-.8-4.4s.3-3 .8-4.4l-7.7-6C1.3 17 0 20.4 0 24s1.3 7 2.9 10.4l7.7-6z" />
          <path fill="#EA4335" d="M24 9.5c3.4 0 6.4 1.2 8.8 3.4l6.6-6.6C35.4 2.6 30 .5 24 .5 14.7.5 6.7 5.8 2.9 13.6l7.7 6c1.8-5.5 6.9-9.6 13.4-9.6z" />
        </svg>
        Open the B2B portal
      </button>
      <a
        href="https://www.joyautomart.com"
        target="_blank"
        rel="noreferrer"
        data-testid="hero-retail-link"
        className="inline-flex items-center gap-2 bg-white border border-zinc-300 hover:border-zinc-900 text-zinc-900 px-5 sm:px-6 py-3 rounded-full text-sm font-semibold transition-colors shadow-sm"
      >
        Visit retail store →
      </a>
    </div>

    {/* Tri-pillar manifesto — Bangladesh's First AI-Powered: Commerce · Data · Experience */}
    <div className="max-w-5xl mx-auto px-5 sm:px-6 pt-8 sm:pt-12" data-testid="hero-tripillar">
      <div className="flex items-center justify-center gap-3 sm:gap-4 mb-6 sm:mb-8">
        <span aria-hidden="true" className="block w-10 sm:w-16 h-px bg-[#E11D48]" />
        <span className="font-mono text-[15px] sm:text-[19px] lg:text-[22px] uppercase tracking-[0.24em] sm:tracking-[0.28em] text-[#E11D48] font-bold whitespace-nowrap">
          Bangladesh's First AI-Powered
        </span>
        <span aria-hidden="true" className="block w-10 sm:w-16 h-px bg-[#E11D48]" />
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 text-center" data-testid="hero-tripillar-list">
        {TRI_PILLARS.map((p) => (
          <li
            key={p.n}
            data-testid={`hero-tripillar-${p.n}`}
            className="group relative px-4 py-3 sm:py-4 rounded-2xl bg-white/70 dark:bg-white/[0.04] border border-zinc-200/80 dark:border-white/10 backdrop-blur-sm hover:border-[#E11D48]/40 hover:bg-white dark:hover:bg-white/[0.06] transition-all"
          >
            <span className="font-mono text-[9.5px] sm:text-[10px] tracking-[0.28em] uppercase text-zinc-400 dark:text-zinc-500 font-bold block mb-1">
              {p.n}
            </span>
            <span className="font-display text-[14.5px] sm:text-[15.5px] lg:text-[17px] tracking-[-0.015em] font-semibold text-zinc-950 dark:text-white block">
              {p.t}
            </span>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export default HeroSection;
