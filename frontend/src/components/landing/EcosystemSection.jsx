import React from "react";

const ECOSYSTEM = [
  { n: "01", t: "B2B Platform", d: "Workshops & car dealers" },
  { n: "02", t: "B2C", d: "E-commerce auto parts retail" },
  { n: "03", t: "Experience Centre", d: "Flagship store" },
  { n: "04", t: "AI-Driven Data Co.", d: "Industry intelligence layer" },
  { n: "05", t: "JOY Beast Atelier", d: "Body kits · forged & bespoke rims · tuning brand" },
];

const EcosystemSection = () => (
  <section
    className="max-w-7xl mx-auto px-5 sm:px-6 pt-12 sm:pt-20 pb-12 sm:pb-16 reveal"
    data-testid="hero-ecosystem-section"
  >
    {/* Section title */}
    <div className="flex items-center gap-4 mb-7 sm:mb-10" data-testid="hero-ecosystem-title">
      <span aria-hidden="true" className="block w-10 sm:w-14 h-px bg-[#E11D48]" />
      <span className="font-mono text-[12px] sm:text-[14px] lg:text-[15px] uppercase tracking-[0.28em] text-zinc-950 dark:text-white font-bold whitespace-nowrap">
        The JOY Automart Ecosystem
      </span>
      <div className="flex-1 h-px bg-gradient-to-r from-zinc-300 to-transparent dark:from-white/15" />
    </div>

    {/* Magazine-grade hairline list */}
    <ul
      className="divide-y divide-zinc-200 dark:divide-white/10 border-y border-zinc-200 dark:border-white/10"
      data-testid="hero-ecosystem-list"
    >
      {ECOSYSTEM.map((p) => (
        <li
          key={p.n}
          data-testid={`hero-eco-${p.n}`}
          className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_minmax(0,300px)_1fr] items-baseline gap-3 sm:gap-8 py-5 sm:py-7 group hover:bg-zinc-50/60 dark:hover:bg-white/[0.03] transition-colors px-1 sm:px-3"
        >
          <span className="font-mono text-[11px] sm:text-[13px] tracking-[0.22em] text-[#E11D48] font-bold pt-1.5">
            {p.n}
          </span>
          <span className="font-display text-[20px] sm:text-[26px] lg:text-[32px] tracking-[-0.02em] font-semibold text-zinc-950 dark:text-white col-span-2 sm:col-span-1 leading-[1.1]">
            {p.t}
          </span>
          <span className="hidden sm:block text-zinc-600 dark:text-zinc-400 text-[14px] lg:text-[17px] font-medium tracking-[-0.005em] leading-snug col-start-3 self-center">
            {p.d}
          </span>
          <span className="sm:hidden text-zinc-600 dark:text-zinc-400 text-[13px] font-medium leading-snug col-span-2 col-start-1 -mt-0.5">
            {p.d}
          </span>
        </li>
      ))}
    </ul>
  </section>
);

export default EcosystemSection;
