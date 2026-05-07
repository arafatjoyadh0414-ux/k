import React from "react";
import { Link } from "react-router-dom";
import EC_INTERIOR_LUXE from "../../assets/experience-centre/ec-interior-luxe.png";

const ExperienceCentreTeaser = () => (
  <section
    id="experience-centre"
    className="bg-zinc-950 text-zinc-300 relative overflow-hidden border-y border-white/10 scroll-mt-28"
  >
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
            A flagship destination on the 100 ft Madani Avenue corridor — calibrated for the discerning collector
            and engineered for the automotive enthusiast.
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
);

export default ExperienceCentreTeaser;
