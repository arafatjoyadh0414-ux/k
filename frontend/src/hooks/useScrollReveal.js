import { useEffect, useRef, useState } from "react";

/**
 * Defensive scroll-reveal:
 *   - Adds `html.js-reveal-armed` so CSS hides `.reveal` only after JS confirms
 *     the browser has IntersectionObserver. If IO is missing or this hook never
 *     runs, content stays visible by default (no blank-screen risk).
 *   - Observer adds `.in-view` as elements enter the viewport.
 *   - MutationObserver picks up `.reveal` elements added LATER (after data loads),
 *     so we don't miss late-mounted sections.
 *   - Safety net: a global 1500ms timeout (set on first arming) force-reveals
 *     anything still hidden — covers Samsung Browser / older WebView quirks
 *     where IntersectionObserver silently drops callbacks.
 *   - Honours `prefers-reduced-motion` via the CSS itself.
 */
export const useScrollReveal = () => {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;

    // Bail out if IO unavailable — content remains visible (no .js-reveal-armed class).
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in-view"));
      return;
    }

    root.classList.add("js-reveal-armed");

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px -20px 0px" }
    );

    const armReveals = () => {
      document.querySelectorAll(".reveal:not(.in-view):not([data-reveal-armed])").forEach((el) => {
        el.setAttribute("data-reveal-armed", "1");
        io.observe(el);
      });
    };

    armReveals();

    // Catch late-mounted .reveal nodes (data fetched after first render, route changes).
    const mo = new MutationObserver(armReveals);
    mo.observe(document.body, { childList: true, subtree: true });

    // Universal safety: after 1.5s, force-reveal everything still hidden.
    const safety = setTimeout(() => {
      document
        .querySelectorAll(".reveal:not(.in-view)")
        .forEach((el) => el.classList.add("in-view"));
    }, 1500);

    // Belt-and-suspenders: also force-reveal on window load (covers very slow first paint).
    const onLoad = () => {
      setTimeout(() => {
        document
          .querySelectorAll(".reveal:not(.in-view)")
          .forEach((el) => el.classList.add("in-view"));
      }, 800);
    };
    window.addEventListener("load", onLoad, { once: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      clearTimeout(safety);
      window.removeEventListener("load", onLoad);
    };
  }, []);
};

/**
 * Counter that ticks from 0 → target once the element scrolls into view.
 * Returns a ref to attach to the element.
 */
export const useCountUp = (target, { duration = 1400 } = {}) => {
  const ref = useRef(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      setVal(target);
      return;
    }
    if (!("IntersectionObserver" in window)) {
      setVal(target);
      return;
    }
    let raf,
      started = null;
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
    // Safety: snap to target after 1.5s if observer never fires.
    const safety = setTimeout(() => setVal(target), 1500);
    return () => {
      obs.disconnect();
      clearTimeout(safety);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [target, duration]);
  return [ref, val];
};
