import React from "react";
import { Stat } from "./landingHelpers";

const STEPS = [
  { n: "01", t: "Sign up", d: "Google + trade license." },
  { n: "02", t: "Get approved", d: "Tier + credit, same day." },
  { n: "03", t: "Order", d: "Catalogue, SKU paste, or AI." },
  { n: "04", t: "Track + settle", d: "Live tracking, COD or credit." },
];

const ValuePropSection = () => (
  <section
    id="value-prop"
    className="max-w-7xl mx-auto px-5 sm:px-6 py-8 sm:py-10 reveal scroll-mt-28"
  >
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
      <div className="lg:col-span-7">
        <div className="overline text-zinc-500 mb-1.5">One platform · every player</div>
        <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl tracking-tight text-zinc-900 mb-5 leading-tight">
          Dealers source. Workshops fix. Suppliers sell.
        </h2>
        <p className="text-sm sm:text-base text-zinc-700 leading-relaxed max-w-2xl" data-testid="dws-summary">
          <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#E11D48] mr-2">D · W · S</span>
          A single verified network synchronising{" "}
          <span className="font-semibold text-zinc-900">dealers</span>,
          <span className="font-semibold text-zinc-900"> workshops</span> and
          <span className="font-semibold text-zinc-900"> suppliers</span> — wholesale parts on 30-day credit, AI-matched
          SKUs for the bay floor and 312+ approved B2B buyers, with KYC, credit and logistics handled end-to-end.
        </p>
      </div>

      <div className="lg:col-span-5 grid grid-cols-2 gap-3">
        <Stat n="1000+" l="Verified parts" />
        <Stat n="4" l="Body-kit lines" />
        <Stat n="10–35%" l="Tier off retail price" />
        <Stat n="30d" l="Credit terms" />
      </div>
    </div>

    <div className="mt-10 sm:mt-12 pt-8 sm:pt-10 border-t border-zinc-200">
      <div className="overline text-zinc-500 mb-3">How it works</div>
      <ol className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {STEPS.map(({ n, t, d }) => (
          <li key={n} className="border-l-[3px] border-[#E11D48] pl-3 sm:pl-4">
            <div className="overline text-[#E11D48]">{n}</div>
            <div className="font-semibold text-sm sm:text-base mt-0.5 text-zinc-900">{t}</div>
            <p className="text-xs sm:text-sm text-zinc-600 mt-1 leading-snug">{d}</p>
          </li>
        ))}
      </ol>
    </div>
  </section>
);

export default ValuePropSection;
