import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ArrowRight, Loader2, X } from "lucide-react";
import api, { fmtBDT } from "../lib/api";

/*
 * PublicSearchBar — hero-mounted live parts search visible to ANY visitor
 * (no sign-in required). Used to let dealers quickly verify whether a
 * specific part is stocked before they go through KYC/onboarding.
 *
 * Calls the public endpoint GET /api/public/catalog (no auth) and filters
 * client-side by name/SKU/brand/car_fits with a 220ms debounce. Renders an
 * autocomplete-style dropdown of up to 6 best matches; each result shows
 * brand, fit-list and a "Sign in for tier price" CTA. Opens the dropdown on
 * focus, closes on blur or ESC. Fully keyboard accessible (↑ ↓ Enter).
 */

const MAX_RESULTS = 6;
const DEBOUNCE_MS = 220;

// Lightweight in-module cache so the catalog is only fetched once per page
// load no matter how many search bars mount.
let _catalogPromise = null;
const fetchCatalogOnce = () => {
  if (!_catalogPromise) {
    _catalogPromise = api
      .get("/public/catalog")
      .then((r) => Array.isArray(r.data) ? r.data : [])
      .catch(() => []);
  }
  return _catalogPromise;
};

const matches = (p, term) => {
  const s = term.trim().toLowerCase();
  if (!s) return false;
  return (
    (p.name || "").toLowerCase().includes(s) ||
    (p.sku || "").toLowerCase().includes(s) ||
    (p.brand || "").toLowerCase().includes(s) ||
    (p.category || "").toLowerCase().includes(s) ||
    (p.car_fits || []).join(" ").toLowerCase().includes(s)
  );
};

const PublicSearchBar = ({ variant = "hero" }) => {
  const [catalog, setCatalog] = useState(null); // null=loading, []=empty
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef(null);

  // Lazy-fetch catalog the first time the user focuses the input — keeps
  // initial Landing TTFB lean.
  const ensureCatalog = () => {
    if (catalog === null) fetchCatalogOnce().then(setCatalog);
  };

  // Debounce the typed query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const results = (() => {
    if (!debouncedQuery.trim() || !catalog) return [];
    return catalog.filter((p) => matches(p, debouncedQuery)).slice(0, MAX_RESULTS);
  })();

  // Fire-and-forget search-intent capture — only after the debounce settles,
  // and only once per unique query. Powers the admin "Search Intelligence"
  // dashboard (top queries, zero-result demand signals).
  const lastLoggedRef = useRef("");
  useEffect(() => {
    const q = (debouncedQuery || "").trim();
    if (!q || q.length < 2 || catalog === null) return;
    if (lastLoggedRef.current === q) return;
    lastLoggedRef.current = q;
    api
      .post("/public/search-log", {
        query: q,
        source: variant === "hero" ? "landing" : "catalog",
        hit_count: results.length,
      })
      .catch(() => {});
  }, [debouncedQuery, catalog, results.length, variant]);

  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); return; }
    if (e.key === "Enter" && results[activeIdx]) {
      window.location.href = `/inquire/${encodeURIComponent(results[activeIdx].sku)}`;
    }
  };

  const isHero = variant === "hero";

  return (
    <div
      ref={wrapRef}
      className="relative w-full max-w-2xl"
      data-testid="public-search-bar"
    >
      <div
        className={`relative flex items-center gap-2.5 ${
          isHero
            ? "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 hover:border-zinc-300 hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] focus-within:border-zinc-300 focus-within:shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:hover:border-white/30 dark:focus-within:border-[#E11D48]/60 dark:focus-within:shadow-[0_8px_32px_rgba(225,29,72,0.18)]"
            : "bg-zinc-50 border border-zinc-200 dark:bg-zinc-900 dark:border-white/10"
        } rounded-full pl-5 sm:pl-6 pr-1.5 py-2 transition-all duration-300`}
      >
        <Search className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-zinc-400 dark:text-zinc-500 shrink-0" />
        <input
          type="search"
          placeholder='Search parts — try "brake pad", "Harrier", "JA-ACC-001"…'
          aria-label="Search parts catalogue"
          data-testid="public-search-input"
          value={query}
          onFocus={() => { ensureCatalog(); setOpen(true); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIdx(0); }}
          onKeyDown={onKeyDown}
          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] sm:text-base text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
        />
        {query && (
          <button
            type="button"
            data-testid="public-search-clear"
            aria-label="Clear search"
            onClick={() => { setQuery(""); setDebouncedQuery(""); }}
            className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <Link
          to="/catalog"
          data-testid="public-search-browse-all"
          className="hidden sm:inline-flex items-center gap-1.5 bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-semibold px-4 py-2 rounded-full transition-colors whitespace-nowrap"
        >
          Browse all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Result dropdown */}
      {open && (query.trim() || catalog === null) && (
        <div
          role="listbox"
          data-testid="public-search-dropdown"
          className="absolute left-0 right-0 mt-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-md shadow-2xl overflow-hidden z-30 max-h-[420px] overflow-y-auto"
        >
          {catalog === null ? (
            <div className="px-4 py-6 text-sm text-zinc-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading catalogue…
            </div>
          ) : !debouncedQuery.trim() ? (
            <div className="px-4 py-4 text-xs text-zinc-500 dark:text-zinc-400">
              Start typing — search by part name, SKU, brand or vehicle.
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-5">
              <div className="text-sm text-zinc-700 dark:text-zinc-200 font-semibold">No catalogue match for "{debouncedQuery}".</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                We can usually source it within 48 hrs. Submit a part request and our team will quote you.
              </div>
              <Link
                to={`/inquire?q=${encodeURIComponent(debouncedQuery)}`}
                data-testid="public-search-request-quote"
                className="mt-3 inline-flex items-center gap-1.5 bg-zinc-900 dark:bg-[#E11D48] hover:bg-zinc-700 dark:hover:bg-[#BE123C] text-white text-xs font-semibold px-3.5 py-2 rounded-full transition-colors"
              >
                Request a quote <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-white/10" data-testid="public-search-results">
              {results.map((p, i) => (
                <li key={p.sku || p.product_id || i}>
                  <Link
                    to={`/inquire/${encodeURIComponent(p.sku || "")}`}
                    data-testid={`public-search-result-${i}`}
                    role="option"
                    aria-selected={i === activeIdx}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={`flex items-start gap-3 px-3 sm:px-4 py-3 transition-colors ${
                      i === activeIdx
                        ? "bg-zinc-50 dark:bg-white/[0.04]"
                        : "hover:bg-zinc-50 dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt=""
                        loading="lazy"
                        className="w-12 h-12 rounded-sm object-cover bg-zinc-100 dark:bg-zinc-800 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-sm bg-zinc-100 dark:bg-zinc-800 grid place-items-center text-zinc-400 shrink-0">
                        <Search className="w-4 h-4" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-zinc-900 dark:text-white truncate">{p.name}</div>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                        {p.sku && <span className="font-mono uppercase tracking-wider">{p.sku}</span>}
                        {p.brand && <><span className="opacity-40">·</span><span>{p.brand}</span></>}
                        {p.category && <><span className="opacity-40">·</span><span>{p.category}</span></>}
                      </div>
                      {p.car_fits?.length > 0 && (
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-1 truncate">
                          Fits: {p.car_fits.slice(0, 3).join(" · ")}{p.car_fits.length > 3 && " · …"}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0 hidden sm:block">
                      {typeof p.price_bdt === "number" ? (
                        <>
                          <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">From</div>
                          <div className="font-mono text-sm text-zinc-900 dark:text-white font-semibold">{fmtBDT(p.price_bdt)}</div>
                          <div className="text-[10px] text-[#E11D48] mt-0.5">Sign in for tier price</div>
                        </>
                      ) : (
                        <div className="text-[10px] text-[#E11D48] mt-2">Sign in for price</div>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
              {/* Footer — link to full catalogue */}
              <li>
                <Link
                  to="/catalog"
                  data-testid="public-search-view-all"
                  className="flex items-center justify-between px-3 sm:px-4 py-3 bg-zinc-50 dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/[0.05] text-xs font-semibold text-zinc-700 dark:text-zinc-200"
                >
                  <span>Browse the full catalogue ({catalog?.length || 0}+ parts)</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default PublicSearchBar;
