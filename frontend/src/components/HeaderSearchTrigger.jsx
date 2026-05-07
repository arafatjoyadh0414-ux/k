import React, { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import PublicSearchBar from "./PublicSearchBar";

/*
 * HeaderSearchTrigger — a search icon mounted in the Landing header. When
 * clicked it opens a full-width inline search overlay anchored to the top
 * of the page (under the header), so visitors can search the public catalog
 * from the very first scroll position without sign-in.
 *
 * Mobile: full-width sheet that slides down from the header.
 * Desktop: a centred dropdown panel with backdrop.
 *
 * Closes on ESC, backdrop click, or the explicit close button.
 */

const HeaderSearchTrigger = ({ inline = false }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onEsc);
    // Lock body scroll while overlay is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Auto-focus the input once the overlay mounts
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const el = document.querySelector('[data-testid="public-search-input"]');
      el?.focus();
    }, 80);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <>
      {/* Trigger button — pill (header) or wide input-style (chip rail / mobile) */}
      <button
        type="button"
        data-testid={inline ? "mobile-search-trigger" : "header-search-trigger"}
        onClick={() => setOpen(true)}
        aria-label="Search parts"
        className={
          inline
            ? "flex-1 min-w-0 inline-flex items-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-white/15 hover:border-[#E11D48]/50 px-3 h-9 rounded-full text-xs font-medium transition-all bg-white dark:bg-white/[0.04]"
            : "inline-flex items-center gap-2 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-white/15 hover:border-zinc-300 hover:shadow-md dark:hover:border-white/40 px-3 sm:px-4 h-10 rounded-full text-xs sm:text-sm font-medium transition-all bg-white/90 dark:bg-white/[0.04]"
        }
      >
        <Search className={inline ? "w-3.5 h-3.5 shrink-0" : "w-4 h-4"} />
        {inline ? (
          <span className="truncate font-mono tracking-[0.04em] text-[11px]">Search parts, SKU, OEM…</span>
        ) : (
          <span className="hidden sm:inline">Search parts</span>
        )}
      </button>

      {/* Overlay */}
      {open && (
        <div
          data-testid="header-search-overlay"
          className="fixed inset-0 z-[60]"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close search"
            data-testid="header-search-close-backdrop"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
          />

          {/* Panel */}
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-4 sm:pt-10">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-xl shadow-2xl p-3 sm:p-5 animate-in slide-in-from-top-4 fade-in">
              <div className="flex items-center gap-3 mb-3 sm:mb-4">
                <div className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                  Search the parts catalogue
                </div>
                <div className="ml-auto">
                  <button
                    type="button"
                    data-testid="header-search-close"
                    onClick={() => setOpen(false)}
                    aria-label="Close search"
                    className="w-8 h-8 grid place-items-center rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <PublicSearchBar variant="hero" />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HeaderSearchTrigger;
