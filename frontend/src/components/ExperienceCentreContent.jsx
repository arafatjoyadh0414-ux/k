import React from "react";
import EC_HERO from "../assets/experience-centre/ec-hero-interior.png";
import EC_DAY_NIGHT from "../assets/experience-centre/ec-day-night-facade.png";
import EC_FACADE_VARIATIONS from "../assets/experience-centre/ec-facade-variations.png";
import EC_INTERIOR_LUXE from "../assets/experience-centre/ec-interior-luxe.png";
import EC_CAFE_WHEELS from "../assets/experience-centre/ec-cafe-wheels.png";
import EC_MOD_ZONE from "../assets/experience-centre/ec-mod-zone.png";
import EC_ARCHITECTURE from "../assets/experience-centre/ec-architecture-overview.png";

// Reusable EC tile (kept here so the page is self-contained)
const ExpTile = ({ src, caption, ratio = "aspect-[4/3]", testid, fit = "cover" }) => (
  <figure
    data-testid={testid}
    className={`relative overflow-hidden rounded-md sm:rounded-lg border border-white/10 group ${ratio}`}
  >
    <img
      src={src}
      alt={caption}
      className={`w-full h-full ${fit === "contain" ? "object-contain bg-zinc-900" : "object-cover"} transition-transform duration-700 ease-out group-hover:scale-[1.03]`}
      loading="lazy"
    />
    {fit !== "contain" && (
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />
    )}
    <figcaption className={`absolute left-2 sm:left-3 ${fit === "contain" ? "top-2 sm:top-3" : "bottom-2 sm:bottom-3"} backdrop-blur-md bg-black/55 border border-white/15 text-white font-mono text-[9px] sm:text-[10px] tracking-[0.18em] uppercase px-2.5 py-1 rounded-full max-w-[calc(100%-1rem)] truncate`}>
      {caption}
    </figcaption>
  </figure>
);

const ExperienceCentreContent = ({ showCTAs = true }) => (
  <section className="bg-zinc-950 text-zinc-300 relative overflow-hidden">
    <div className="aurora-blob" aria-hidden="true" />
    <div className="absolute inset-0 grid-bg-dark opacity-50" aria-hidden="true" />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-24 relative z-10 reveal">

      {/* Header — copy + CTAs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end mb-8 sm:mb-10 lg:mb-12">
        <div className="lg:col-span-7">
          <div className="inline-flex items-center gap-2 backdrop-blur-md bg-[#E11D48]/15 border border-[#E11D48]/40 text-[#FFB1C1] font-mono text-[10px] sm:text-[11px] tracking-[0.2em] uppercase font-bold px-3 py-1.5 rounded-full mb-5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFB1C1] opacity-70"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FFB1C1]"></span>
            </span>
            Banani · Madani Avenue · Opens Q2 2026
          </div>
          <h1 className="font-display text-[28px] xs:text-[32px] sm:text-4xl md:text-5xl lg:text-[56px] xl:text-6xl tracking-tighter leading-[1.02] text-white">
            The first automotive Experience Centre Bangladesh has ever seen.
          </h1>
          <p className="text-zinc-400 mt-4 sm:mt-5 leading-relaxed text-sm sm:text-base max-w-2xl">
            A 1,560 sq ft flagship space on Madani Avenue, sitting beside OTTOFIX, BYD and the
            European Luxury Car Showroom. 65 ft × 24 ft, G+1 — designed to make every customer
            experience parts the way enthusiasts deserve.
          </p>
        </div>
        {showCTAs && (
          <div className="lg:col-span-5 flex flex-wrap gap-3 lg:justify-end">
            <a href="/inquire" data-testid="exp-inquire-link"
               className="magnetic inline-flex items-center gap-2 bg-white text-zinc-900 hover:bg-zinc-100 px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap">
              Reserve a private viewing →
            </a>
            <a href="https://www.joyautomart.com" target="_blank" rel="noreferrer" data-testid="exp-retail-link"
               className="magnetic inline-flex items-center gap-2 backdrop-blur-md bg-white/5 border border-white/20 hover:border-white/60 text-white px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap">
              Visit retail website
            </a>
          </div>
        )}
      </div>

      {/* HERO panoramic */}
      <figure className="relative overflow-hidden rounded-md sm:rounded-lg border border-white/10 group bg-zinc-900">
        <img
          src={EC_INTERIOR_LUXE}
          alt="JOY Automart Experience Centre — premium interior concept renders"
          className="w-full h-[220px] xs:h-[260px] sm:h-[360px] md:h-[460px] lg:h-[560px] object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.02]"
          loading="lazy"
        />
        <figcaption className="absolute top-3 sm:top-4 left-3 sm:left-4 flex items-center gap-2 backdrop-blur-md bg-black/55 border border-white/15 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.18em] text-zinc-100">Concept renders · Phase 1</span>
        </figcaption>
        <figcaption className="absolute top-3 sm:top-4 right-3 sm:right-4 hidden sm:flex items-center gap-2 backdrop-blur-md bg-[#E11D48]/85 px-3 py-1.5 rounded-full">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white font-bold">Showroom · 65 ft × 24 ft</span>
        </figcaption>
      </figure>

      {/* Bands */}
      <div className="mt-6 sm:mt-8 lg:mt-10 space-y-6 sm:space-y-8">
        {/* Storefront */}
        <div>
          <div className="flex items-baseline justify-between mb-3 sm:mb-4 flex-wrap gap-2">
            <div>
              <div className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.24em] text-[#E11D48]">01 · Storefront</div>
              <h3 className="font-display text-xl sm:text-2xl lg:text-3xl text-white tracking-tight mt-1">Architectural presence — day &amp; night.</h3>
            </div>
            <div className="text-xs sm:text-sm text-zinc-400 max-w-md">
              Glass façade · 18 ft height · illuminated JOY logo · oriented to Madani Avenue traffic.
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <ExpTile src={EC_MOD_ZONE} caption="Façade Studies · Day & Night" ratio="aspect-[16/10]" testid="ec-tile-day-night" />
            <ExpTile src={EC_DAY_NIGHT} caption="Showroom Atmosphere · Madani Avenue, Dhaka" ratio="aspect-[16/10]" testid="ec-tile-facade-variations" />
          </div>
        </div>

        {/* Interior */}
        <div>
          <div className="flex items-baseline justify-between mb-3 sm:mb-4 flex-wrap gap-2">
            <div>
              <div className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.24em] text-[#E11D48]">02 · Interior</div>
              <h3 className="font-display text-xl sm:text-2xl lg:text-3xl text-white tracking-tight mt-1">Premium spaces, engineered for the bay floor.</h3>
            </div>
            <div className="text-xs sm:text-sm text-zinc-400 max-w-md">
              Hero car zone · JOY Café bar · wheel wall · modification consultation desks · mezzanine.
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <ExpTile src={EC_HERO} caption="Architecture · Interior Perspective" ratio="aspect-[4/3]" testid="ec-tile-interior-luxe" />
            <ExpTile src={EC_CAFE_WHEELS} caption="JOY Café · Wheel Wall" ratio="aspect-[4/3]" testid="ec-tile-cafe-wheels" />
            <ExpTile src={EC_FACADE_VARIATIONS} caption="Showroom Volume · 65 ft × 24 ft" ratio="aspect-[4/3]" testid="ec-tile-mod-zone" />
          </div>
        </div>

        {/* Blueprint */}
        <div>
          <div className="flex items-baseline justify-between mb-3 sm:mb-4 flex-wrap gap-2">
            <div>
              <div className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.24em] text-[#E11D48]">03 · Blueprint</div>
              <h3 className="font-display text-xl sm:text-2xl lg:text-3xl text-white tracking-tight mt-1">Floor plans &amp; building section.</h3>
            </div>
            <div className="text-xs sm:text-sm text-zinc-400 max-w-md">
              Linear customer journey · entrance → hero car → experience → premium consultation.
            </div>
          </div>
          <ExpTile src={EC_ARCHITECTURE} caption="Front elevation · interior perspective · mezzanine · ground floor plan · building section" ratio="aspect-[16/9] sm:aspect-[21/9]" testid="ec-tile-architecture" fit="contain" />
        </div>
      </div>

      {/* Feature bullets */}
      <ul className="mt-8 sm:mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          ["Hero Car Zone", "Display the build, then drive it home."],
          ["JOY Café", "Bar lounge with espresso while consultations run."],
          ["Consultation Suite", "Private space for fleet & dealer accounts."],
          ["Mezzanine", "75–85” panel for events, training, brand experiences."],
        ].map(([title, body]) => (
          <li key={title} className="rounded-md sm:rounded-lg border border-white/10 bg-white/[0.03] backdrop-blur-sm p-4 sm:p-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#E11D48] mb-1.5">▍</div>
            <div className="font-display text-base sm:text-lg text-white tracking-tight">{title}</div>
            <div className="text-xs sm:text-sm text-zinc-400 mt-1.5 leading-relaxed">{body}</div>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export default ExperienceCentreContent;
