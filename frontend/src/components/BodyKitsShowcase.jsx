import React, { useEffect, useMemo, useRef, useState } from "react";
import SHADOW_GT_1 from "../assets/body-kits/shadow-gt-1.png";
import SHADOW_GT_2 from "../assets/body-kits/shadow-gt-2.png";
import SHADOW_GT_3 from "../assets/body-kits/shadow-gt-3.png";
import SHADOW_GT_4 from "../assets/body-kits/shadow-gt-4.png";
import CYBER_BEAST from "../assets/byd-cyberbeast.jpg";
import WIDE_BODY_KIT from "../assets/body-kits/wide-body-bydkit.png";
import CYBER_RIMS from "../assets/body-kits/cyber-beast-rims.png";

/*
 * BodyKitsShowcase — interactive tabbed showcase for JOY BEAST body kits.
 * Tabs swap the showcased hero image. Shadow GT tab is a multi-image gallery
 * (auto-rotate carousel + clickable thumbnails). All other tabs show a single
 * hero image. Designed for mobile, tablet & desktop with zero layout shift.
 */

const KITS = [
  {
    id: "shadow-gt",
    name: "Shadow GT",
    tier: "Entry sport",
    headline: "Stealth aero. Daily-driver poise.",
    blurb:
      "Carbon-composite splitters, side skirts, ducktail spoiler — the Shadow GT signature body kit, photographed at our Atelier.",
    gallery: [SHADOW_GT_1, SHADOW_GT_2, SHADOW_GT_3, SHADOW_GT_4],
  },
  {
    id: "cyber-beast",
    name: "Cyber Beast",
    tier: "Flagship aero",
    featured: true,
    headline: "Wide-body. Forged. Unmistakable.",
    blurb:
      "Our flagship aero programme. Wide fender flares, vented bonnet, performance brake pack and red anodised calipers.",
    gallery: [CYBER_BEAST],
  },
  {
    id: "wide-body",
    name: "Beast Wide Body",
    tier: "Wide-body",
    headline: "Track-bred stance. Street legal.",
    blurb:
      "Aggressive wide-body conversion with motorsport-grade aero balance, forged 22\" multi-spokes, ground-up paint match.",
    gallery: [WIDE_BODY_KIT],
  },
  {
    id: "atelier",
    name: "Custom Atelier",
    tier: "Bespoke",
    headline: "One commission. One signature.",
    blurb:
      "Forged-wheel programmes, bespoke leather interiors and one-off liveries — built to brief at the Banani Atelier.",
    gallery: [CYBER_RIMS],
  },
];

const SHADOW_ROTATE_MS = 3800;

export default function BodyKitsShowcase() {
  const [activeId, setActiveId] = useState("shadow-gt");
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const touchStartX = useRef(null);

  const active = useMemo(
    () => KITS.find((k) => k.id === activeId) || KITS[0],
    [activeId]
  );
  const isShadow = active.id === "shadow-gt";
  const gallery = active.gallery;
  const currentImg = gallery[galleryIdx % gallery.length];

  // Reset gallery index when tab changes
  useEffect(() => {
    setGalleryIdx(0);
    setImgLoaded(false);
  }, [activeId]);

  // Auto-rotate carousel — only when Shadow GT (multi-image) is active
  useEffect(() => {
    if (!isShadow || gallery.length <= 1) return undefined;
    const id = setInterval(() => {
      setGalleryIdx((i) => (i + 1) % gallery.length);
    }, SHADOW_ROTATE_MS);
    return () => clearInterval(id);
  }, [isShadow, gallery.length]);

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50 && gallery.length > 1) {
      setGalleryIdx((i) =>
        dx < 0 ? (i + 1) % gallery.length : (i - 1 + gallery.length) % gallery.length
      );
    }
    touchStartX.current = null;
  };

  return (
    <div data-testid="body-kits-showcase">
      {/* Hero image stage */}
      <div
        className="relative overflow-hidden rounded-sm border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-zinc-900"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="relative w-full h-[300px] sm:h-[420px] lg:h-[540px]">
          {gallery.map((src, i) => (
            <img
              key={`${active.id}-${i}`}
              src={src}
              alt={`${active.name} — ${active.headline}`}
              loading={i === 0 ? "eager" : "lazy"}
              onLoad={() => i === galleryIdx && setImgLoaded(true)}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-out ${
                i === galleryIdx ? "opacity-100" : "opacity-0"
              }`}
              data-testid={`kit-image-${active.id}-${i}`}
            />
          ))}

          {/* Skeleton shimmer until first image loads */}
          {!imgLoaded && (
            <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-zinc-200 to-zinc-100 dark:from-zinc-800 dark:to-zinc-900" />
          )}

          {/* Top-left badge */}
          <div className="absolute top-3 left-3 bg-black/80 backdrop-blur text-white text-[10px] tracking-[0.2em] uppercase px-3 py-1.5 rounded-sm font-semibold">
            {active.name} · {active.tier}
          </div>

          {/* Bottom caption — premium gradient overlay */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-4 sm:px-6 py-3 sm:py-4">
            <div className="text-white font-display text-base sm:text-lg leading-tight">
              {active.headline}
            </div>
            <div className="text-zinc-300 text-xs sm:text-[13px] mt-1 max-w-2xl">
              {active.blurb}
            </div>
          </div>

          {/* Carousel arrows + counter — only Shadow GT */}
          {isShadow && gallery.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                data-testid="shadow-gt-prev"
                onClick={() =>
                  setGalleryIdx(
                    (i) => (i - 1 + gallery.length) % gallery.length
                  )
                }
                className="hidden sm:grid place-items-center absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/85 text-white backdrop-blur-sm transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Next image"
                data-testid="shadow-gt-next"
                onClick={() =>
                  setGalleryIdx((i) => (i + 1) % gallery.length)
                }
                className="hidden sm:grid place-items-center absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/85 text-white backdrop-blur-sm transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
              <div className="absolute top-3 right-3 bg-black/70 backdrop-blur text-white text-[10px] tracking-[0.2em] uppercase px-2.5 py-1 rounded-sm font-mono">
                {String(galleryIdx + 1).padStart(2, "0")} / {String(gallery.length).padStart(2, "0")}
              </div>
            </>
          )}
        </div>

        {/* Thumbnail strip — rendered only when gallery has multiple images */}
        {gallery.length > 1 && (
          <div className="bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-white/10 px-2 sm:px-3 py-2 sm:py-3">
            <div className="flex gap-2 sm:gap-3 overflow-x-auto no-scrollbar">
              {gallery.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setGalleryIdx(i)}
                  data-testid={`shadow-gt-thumb-${i}`}
                  aria-label={`Show image ${i + 1}`}
                  className={`relative shrink-0 w-20 h-14 sm:w-28 sm:h-20 rounded-sm overflow-hidden border-2 transition-all ${
                    i === galleryIdx
                      ? "border-[#E11D48] shadow-[0_0_0_2px_rgba(225,29,72,0.18)]"
                      : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  <img
                    src={src}
                    alt={`${active.name} thumbnail ${i + 1}`}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tab strip — clickable kit selectors */}
      <div
        role="tablist"
        aria-label="Body kit tiers"
        className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2"
      >
        {KITS.map((k) => {
          const isActive = k.id === activeId;
          return (
            <button
              key={k.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              data-testid={`kit-tab-${k.id}`}
              onClick={() => setActiveId(k.id)}
              onTouchStart={() => setActiveId(k.id)}
              className={`p-3 rounded-sm border text-center transition-all duration-300 will-change-transform ${
                isActive
                  ? "bg-zinc-900 text-white border-zinc-900 shadow-lg -translate-y-0.5"
                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 hover:border-zinc-900 dark:hover:border-white/40"
              }`}
            >
              <div className="font-display text-sm">{k.name}</div>
              <div
                className={`text-[10px] uppercase tracking-wider mt-0.5 ${
                  isActive ? "text-zinc-300" : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {k.tier}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
