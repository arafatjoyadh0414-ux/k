import { useEffect } from "react";

/**
 * Tiny global scroll-reveal: any element with className `reveal` gets `.in-view`
 * added once it enters the viewport, then is unobserved. Zero deps, ~40 lines.
 * Honours `prefers-reduced-motion` via the CSS itself.
 */
export const useScrollReveal = () => {
  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;
    const els = document.querySelectorAll(".reveal:not(.in-view)");
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            obs.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
};

/**
 * Counter that ticks from 0 → target once the element scrolls into view.
 * Returns a ref to attach to the element. Pure CSS-friendly, ~50 lines.
 */
import { useRef, useState } from "react";

export const useCountUp = (target, { duration = 1400 } = {}) => {
  const ref = useRef(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      setVal(target); return;
    }
    let raf, started = null;
    const tick = (t) => {
      if (!started) started = t;
      const p = Math.min(1, (t - started) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          raf = requestAnimationFrame(tick);
          obs.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => { obs.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [target, duration]);
  return [ref, val];
};
