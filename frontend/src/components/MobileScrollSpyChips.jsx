import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/*
 * MobileScrollSpyChips — horizontal-scroll chip nav that highlights the
 * currently visible section as the user scrolls the landing page.
 * Only renders on mobile/tablet (hidden lg:hidden on >=1024px) where the
 * top header nav already covers desktop navigation.
 *
 * In addition to scroll-spy section chips, supports "link" chips that
 * navigate to other routes (e.g. Catalogue). Link chips never become
 * active via scroll; they are static navigation actions.
 *
 * Each chip taps a section id; clicking a chip smooth-scrolls there.
 * Uses a rAF-throttled scroll listener to highlight the active chip with
 * no scroll jank and zero layout shift on the surrounding content.
 */

const SECTIONS = [
  { id: "hero", label: "Home" },
  { id: "joy-beast", label: "JOY BEAST" },
  { id: "experience-centre", label: "Experience" },
  { id: "tech-stack", label: "Tech" },
  { id: "catalogue", label: "Catalogue", type: "link", to: "/catalog" },
  { id: "bd-news", label: "BD News" },
];

export default function MobileScrollSpyChips() {
  const navigate = useNavigate();
  const scrollSections = SECTIONS.filter((s) => s.type !== "link");
  const [active, setActive] = useState(scrollSections[0]?.id || SECTIONS[0].id);
  const railRef = useRef(null);
  const chipRefs = useRef({});

  // Active-section detection: on every scroll, pick the section whose top
  // is closest to (and at/above) the header offset. Link-type chips are
  // ignored since they don't correspond to in-page sections.
  useEffect(() => {
    const headerOffset = 100; // sticky header (~72px) + chip rail (~40px)
    const computeActive = () => {
      const rects = scrollSections
        .map((s) => {
          const el = document.getElementById(s.id);
          if (!el) return null;
          return { id: s.id, top: el.getBoundingClientRect().top };
        })
        .filter(Boolean);
      if (!rects.length) return;
      rects.sort((a, b) => a.top - b.top);
      let candidate = rects[0].id;
      for (const r of rects) {
        if (r.top - headerOffset <= 1) candidate = r.id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        candidate = rects[rects.length - 1].id;
      }
      setActive((prev) => (prev === candidate ? prev : candidate));
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        computeActive();
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    computeActive();
    return () => window.removeEventListener("scroll", onScroll);
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

  const onChip = (s) => {
    if (s.type === "link" && s.to) {
      navigate(s.to);
      return;
    }
    const target = document.getElementById(s.id);
    if (!target) return;
    setActive(s.id);
    const headerOffset = 72;
    const top = target.getBoundingClientRect().top + window.scrollY - headerOffset - 12;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <div
      data-testid="mobile-scroll-spy"
      className="lg:hidden sticky top-16 sm:top-[72px] z-20 backdrop-blur-xl bg-white/90 dark:bg-zinc-950/90 border-b hairline dark:border-white/10"
    >
      <div className="relative">
        {/* Soft fade masks on left/right so the rail visually fades into the
            container edges instead of getting clipped. */}
        <div aria-hidden="true" className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white dark:from-zinc-950 to-transparent z-[1]" />
        <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white dark:from-zinc-950 to-transparent z-[1]" />
        <div
          ref={railRef}
          className="max-w-7xl mx-auto px-4 sm:px-5 py-2.5 flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar"
        >
          {SECTIONS.map((s) => {
            const isLink = s.type === "link";
            const isActive = !isLink && s.id === active;
            return (
              <button
                key={s.id}
                ref={(el) => (chipRefs.current[s.id] = el)}
                type="button"
                data-testid={`chip-${s.id}`}
                data-active={isActive ? "true" : "false"}
                data-chip-type={isLink ? "link" : "section"}
                onClick={() => onChip(s)}
                aria-current={isActive ? "true" : undefined}
                className={`shrink-0 px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-[11px] font-display tracking-[0.04em] transition-all duration-300 relative whitespace-nowrap ${
                  isActive
                    ? "text-zinc-900 dark:text-white font-semibold"
                    : isLink
                    ? "text-[#E11D48] dark:text-[#FFB1C1] hover:text-[#BE123C] dark:hover:text-white font-medium"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <span className="relative z-[1]">{s.label}</span>
                {!isLink && (
                  <span
                    className={`absolute left-1/2 -translate-x-1/2 bottom-0.5 h-[2px] rounded-full transition-all duration-300 ${
                      isActive ? "w-5 sm:w-6 bg-[#E11D48]" : "w-0 bg-transparent"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
