import React from "react";

/**
 * TrustedByStrip — minimalist wordmark strip of OEM brands JOY services.
 * Uses display-font text wordmarks (no third-party logos) for maximum
 * visual consistency, perfect tracking, and zero brittle CDN deps.
 */
const BRANDS = [
  { name: "TOYOTA", italic: false, weight: "font-black", tracking: "tracking-[0.32em]" },
  { name: "HONDA", italic: true, weight: "font-bold", tracking: "tracking-[0.18em]" },
  { name: "NISSAN", italic: false, weight: "font-bold", tracking: "tracking-[0.28em]" },
  { name: "MITSUBISHI", italic: false, weight: "font-extrabold", tracking: "tracking-[0.16em]" },
  { name: "BYD", italic: false, weight: "font-black", tracking: "tracking-[0.22em]" },
  { name: "BMW", italic: false, weight: "font-black", tracking: "tracking-[0.36em]" },
  { name: "MERCEDES", italic: false, weight: "font-bold", tracking: "tracking-[0.18em]" },
  { name: "LEXUS", italic: false, weight: "font-bold", tracking: "tracking-[0.28em]" },
];

const TrustedByStrip = () => (
  <section
    className="border-y border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-950"
    data-testid="trusted-by-strip"
  >
    <div className="max-w-7xl mx-auto px-5 sm:px-6 py-8 sm:py-12">
      {/* Eyebrow */}
      <div className="flex items-center gap-3 mb-5 sm:mb-7">
        <span aria-hidden="true" className="block w-8 sm:w-10 h-px bg-[#E11D48]" />
        <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400 font-bold whitespace-nowrap">
          Engineered for · Trusted by workshops servicing
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-zinc-300 to-transparent dark:from-white/15" />
      </div>

      {/* Wordmark grid */}
      <div
        className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-y-5 sm:gap-y-6 gap-x-3 sm:gap-x-6 items-center"
        data-testid="trusted-by-list"
      >
        {BRANDS.map((b) => (
          <div
            key={b.name}
            data-testid={`trusted-by-${b.name.toLowerCase()}`}
            className="text-center group cursor-default"
          >
            <span
              className={`block font-display ${b.weight} ${b.tracking} ${
                b.italic ? "italic" : ""
              } text-[13px] sm:text-[15px] lg:text-[17px] text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors`}
            >
              {b.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TrustedByStrip;
