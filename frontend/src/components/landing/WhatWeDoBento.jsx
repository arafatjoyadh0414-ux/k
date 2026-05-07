import React from "react";

const PILLARS = [
  {
    n: "01",
    k: "B2B Wholesale",
    t: "Workshops & Dealers",
    d: "Verified parts, tier-based wholesale pricing, 30-day credit, and live order tracking for car dealers and auto-repair workshops nationwide.",
  },
  {
    n: "02",
    k: "B2C Retail",
    t: "Online & Walk-in",
    d: (
      <>
        Direct-to-consumer auto parts e-commerce on{" "}
        <a
          href="https://www.joyautomart.com"
          target="_blank"
          rel="noreferrer"
          className="text-zinc-900 underline underline-offset-2 hover:text-[#E11D48]"
        >
          www.joyautomart.com
        </a>{" "}
        — paired with our flagship retail showroom.
      </>
    ),
  },
  {
    n: "03",
    k: "Experience Centre",
    t: "Bangladesh's first",
    d: "A flagship retail showroom on the 100 ft Madani Avenue corridor — hero car zone, JOY Café, mezzanine viewing room. Launching in 2 months.",
  },
  {
    n: "04",
    k: "Data & AI",
    t: "Industry intelligence",
    d: "Every transaction, every part, every vehicle, every behaviour — captured and modelled. Demand forecasting, smart pricing, predictive insights.",
  },
  {
    n: "05",
    k: "JOY BEAST",
    t: "The atelier",
    featured: true,
    d: "Our in-house premium modification house. Body kits, forged wheels, performance tuning, bespoke leather interiors and custom builds — engineered in Bangladesh.",
  },
];

const WhatWeDoBento = () => (
  <section className="border-y hairline bg-zinc-50/40 relative">
    <div className="max-w-7xl mx-auto px-5 sm:px-6 py-14 sm:py-20 reveal">
      <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-zinc-500 mb-2">What we do</div>
      <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[1.05] max-w-3xl mb-2">
        Five businesses. <span className="text-zinc-500">One ecosystem.</span>
      </h2>
      <p className="text-zinc-500 max-w-2xl text-sm sm:text-base mb-10">
        From the bay floor to the boardroom — we cover the entire automotive aftermarket value chain.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 -m-px">
        {PILLARS.map(({ n, k, t, d, featured }) => (
          <div
            key={n}
            className={`border hairline p-6 ${featured ? "bg-zinc-950 text-white border-zinc-950" : "bg-white"}`}
          >
            <div className={`mono-accent text-2xl ${featured ? "text-[#E11D48]" : "text-zinc-300"}`}>{n}</div>
            <div
              className={`font-mono text-[10px] uppercase tracking-[0.2em] mt-3 mb-1.5 ${
                featured ? "text-[#E11D48]" : "text-zinc-500"
              }`}
            >
              {k}
            </div>
            <div className="font-display text-lg mb-2">{t}</div>
            <p className={`text-sm leading-relaxed ${featured ? "text-zinc-300" : "text-zinc-600"}`}>{d}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default WhatWeDoBento;
