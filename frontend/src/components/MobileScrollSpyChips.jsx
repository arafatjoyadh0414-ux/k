import React, { useEffect, useRef, useState } from "react";

/*
 * MobileScrollSpyChips — horizontal-scroll chip nav that highlights the
 * currently visible section as the user scrolls the landing page.
 * Only renders on mobile/tablet (hidden lg:hidden on >=1024px) where the
 * top header nav already covers desktop navigation.
 *
 * Each chip taps a section id; clicking a chip smooth-scrolls there.
 * Uses IntersectionObserver to highlight the active chip with no scroll
 * jank and zero layout shift on the surrounding content.
 */

const SECTIONS = [
  { id: "hero", label: "Home" },
  { id: "joy-beast", label: "JOY BEAST" },
  { id: "experience-centre", label: "Experience" },
  { id: "tech-stack", label: "Tech" },
  { id: "value-prop", label: "Why Joy" },
  { id: "bd-news", label: "BD News" },
  { id: "cta", label: "Get started" },
];

export default function MobileScrollSpyChips() {
  const [active, setActive] = useState(SECTIONS[0].id);
  const railRef = useRef(null);
  const chipRefs = useRef({});

  // Observe all sections; pick the one currently most centrally visible
  useEffect(() => {
    const targets = SECTIONS
      .map((s) => document.getElementById(s.id))
      .filter(Boolean);
    if (!targets.length) return undefined;

    const visibility = new Map();
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => visibility.set(e.target.id, e.intersectionRatio));
        let bestId = null;
        let bestRatio = 0;
        visibility.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        });
        if (bestId && bestRatio > 0.15) setActive(bestId);
      },
      {
        // Trigger when section is roughly in the upper-middle band of viewport
        rootMargin: "-25% 0px -55% 0px",
        threshold: [0, 0.15, 0.35, 0.6, 0.85, 1],
      }
    );
    targets.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // Scroll the active chip into view inside the rail (rail-only horizontal —
  // never touch the document scroll, otherwise it fights with onChip's
  // window.scrollTo for the section)
  useEffect(() => {
    const el = chipRefs.current[active];
    const rail = railRef.current;
    if (!el || !rail) return;
    const target = el.offsetLeft - rail.clientWidth / 2 + el.clientWidth / 2;
    rail.scrollTo({ left: target, behavior: "smooth" });
  }, [active]);

  const onChip = (id) => {
    const target = document.getElementById(id);
    if (!target) return;
    // Optimistic highlight — IntersectionObserver will reconcile after scroll
    setActive(id);
    const headerOffset = 72; // sticky header height
    const top = target.getBoundingClientRect().top + window.scrollY - headerOffset - 12;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <div
      data-testid="mobile-scroll-spy"
      className="lg:hidden sticky top-16 sm:top-[72px] z-20 backdrop-blur-xl bg-white/85 dark:bg-zinc-950/85 border-b hairline dark:border-white/10"
    >
      <div
        ref={railRef}
        className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar"
      >
        {SECTIONS.map((s) => {
          const isActive = s.id === active;
          return (
            <button
              key={s.id}
              ref={(el) => (chipRefs.current[s.id] = el)}
              type="button"
              data-testid={`chip-${s.id}`}
              data-active={isActive ? "true" : "false"}
              onClick={() => onChip(s.id)}
              aria-current={isActive ? "true" : undefined}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-[0.16em] border transition-all ${
                isActive
                  ? "bg-zinc-900 dark:bg-[#E11D48] text-white border-zinc-900 dark:border-[#E11D48] shadow-sm"
                  : "bg-white/70 dark:bg-zinc-900/70 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-white/10 hover:border-zinc-900 dark:hover:border-white/40"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
