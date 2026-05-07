import React from "react";
import BodyKitsShowcase from "../BodyKitsShowcase";

const BeastService = ({ icon, title, body }) => (
  <div className="flex gap-3">
    <div className="shrink-0 w-9 h-9 grid place-items-center bg-zinc-900 text-white rounded-sm">
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {icon}
      </svg>
    </div>
    <div>
      <div className="font-display text-base text-zinc-900">{title}</div>
      <div className="text-sm text-zinc-600 mt-0.5">{body}</div>
    </div>
  </div>
);

const JoyBeastSection = () => (
  <section id="joy-beast" className="bg-white scroll-mt-28">
    <div className="max-w-7xl mx-auto px-5 sm:px-6 py-14 sm:py-20 reveal">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
        <div className="lg:col-span-5 order-1">
          <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#E11D48] mb-3">
            JOY BEAST · The Atelier
          </div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-tight leading-[1.05]">
            A premium modification house. Built in Bangladesh.
          </h2>
          <p className="text-zinc-600 mt-5 leading-relaxed text-sm sm:text-base">
            JOY BEAST is our in-house atelier — a luxury modification brand that competes with the world's
            finest tuning houses. Every build is hand-finished at the Experience Centre with workshop-grade
            fitment guarantees. From bolt-on aero kits to ground-up wide-body conversions and bespoke
            leather interiors, this is where ordinary cars become signature builds.
          </p>

          <div className="mt-7 space-y-4">
            <BeastService
              icon={<><path d="M3 17l4-8 4 8 4-12 4 12" /><path d="M3 21h18" /></>}
              title="Body Kits & Aero"
              body="Wide-body fender flares, splitters, diffusers, side skirts, vented bonnets, ducktail spoilers — moulded in carbon-composite, painted to OEM-match."
            />
            <BeastService
              icon={<><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></>}
              title="Forged Wheels & Performance Brakes"
              body={
                <>
                  21–22" forged multi-spoke alloys, big-brake upgrades with red anodised calipers, performance pads &amp; lines.
                </>
              }
            />
            <BeastService
              icon={<><path d="M3 8h18l-2 13H5L3 8z" /><path d="M8 8V5a4 4 0 0 1 8 0v3" /></>}
              title="Bespoke Interior & Upholstery"
              body="Full-grain Nappa leather, Alcantara headliners, contrast stitching, custom dashboards, carbon-fibre trim, premium audio & ambient lighting."
            />
            <BeastService
              icon={<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />}
              title="Performance Tuning"
              body="ECU remaps, stage-1/2 power packs, sport exhausts, lowering springs & coilovers, cold-air intakes — dyno-validated upgrades for measurable gains."
            />
            <BeastService
              icon={<><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></>}
              title="Custom Atelier Builds"
              body="Ground-up bespoke commissions — fleet liveries, one-off concept builds, and full Cyber Beast wide-body conversions on request."
            />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/inquire"
              data-testid="beast-inquire-link"
              className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-700 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-colors"
            >
              Schedule a kit consultation →
            </a>
          </div>
        </div>

        <div className="lg:col-span-7 order-2">
          <BodyKitsShowcase />
        </div>
      </div>
    </div>
  </section>
);

export default JoyBeastSection;
