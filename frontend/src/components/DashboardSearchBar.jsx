import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowRight, Loader2, X } from "lucide-react";
import api, { fmtBDT } from "../lib/api";

/*
 * DashboardSearchBar — authenticated bay-floor search. Calls
 * GET /api/products (auth-only) and filters client-side. Differs from the
 * public PublicSearchBar in that it shows tier prices and links to
 * /products/{id} (the authenticated product detail page) instead of
 * /inquire/{sku}.
 */

const MAX_RESULTS = 6;
const DEBOUNCE_MS = 200;

let _productsPromise = null;
const fetchProductsOnce = () => {
  if (!_productsPromise) {
    _productsPromise = api
      .get("/products")
      .then((r) => Array.isArray(r.data) ? r.data : [])
      .catch(() => []);
  }
  return _productsPromise;
};

const matchesQuery = (p, term) => {
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

const DashboardSearchBar = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef(null);

  const ensureLoaded = () => {
    if (products === null) fetchProductsOnce().then(setProducts);
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const results = (() => {
    if (!debouncedQuery.trim() || !products) return [];
    return products.filter((p) => matchesQuery(p, debouncedQuery)).slice(0, MAX_RESULTS);
  })();

  const goTo = (p) => {
    if (p?.product_id) navigate(`/products/${p.product_id}`);
    else navigate("/products");
  };

  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); return; }
    if (e.key === "Enter") {
      if (results[activeIdx]) goTo(results[activeIdx]);
      else if (debouncedQuery.trim()) navigate(`/products?q=${encodeURIComponent(debouncedQuery)}`);
    }
  };

  return (
    <div ref={wrapRef} className="relative w-full" data-testid="dashboard-search-bar">
      <div className="relative flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 hover:border-zinc-900 dark:hover:border-white/40 focus-within:border-zinc-900 dark:focus-within:border-[#E11D48] rounded-sm pl-4 pr-1.5 py-1.5 transition-colors">
        <Search className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400 dark:text-zinc-500 shrink-0" />
        <input
          type="search"
          placeholder='Search the bay floor — part, SKU, brand or vehicle'
          aria-label="Search products"
          data-testid="dashboard-search-input"
          value={query}
          onFocus={() => { ensureLoaded(); setOpen(true); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIdx(0); }}
          onKeyDown={onKeyDown}
          className="flex-1 min-w-0 bg-transparent outline-none text-sm sm:text-base text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
        />
        {query && (
          <button
            type="button"
            data-testid="dashboard-search-clear"
            aria-label="Clear search"
            onClick={() => { setQuery(""); setDebouncedQuery(""); }}
            className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          data-testid="dashboard-search-cta"
          onClick={() => navigate(debouncedQuery.trim() ? `/products?q=${encodeURIComponent(debouncedQuery)}` : "/products")}
          className="hidden sm:inline-flex items-center gap-1.5 bg-zinc-900 dark:bg-[#E11D48] hover:bg-[#E11D48] dark:hover:bg-[#BE123C] text-white text-xs font-semibold px-4 py-2 rounded-sm transition-colors whitespace-nowrap"
        >
          Search <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {open && (query.trim() || products === null) && (
        <div
          role="listbox"
          data-testid="dashboard-search-dropdown"
          className="absolute left-0 right-0 mt-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-md shadow-2xl overflow-hidden z-30 max-h-[420px] overflow-y-auto"
        >
          {products === null ? (
            <div className="px-4 py-6 text-sm text-zinc-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading bay-floor catalogue…
            </div>
          ) : !debouncedQuery.trim() ? (
            <div className="px-4 py-4 text-xs text-zinc-500 dark:text-zinc-400">
              Type to search by part name, SKU, brand or vehicle.
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-5">
              <div className="text-sm text-zinc-700 dark:text-zinc-200 font-semibold">No bay-floor match for "{debouncedQuery}".</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                Submit a part request — the buying team will source it within 48 hrs.
              </div>
              <button
                type="button"
                onClick={() => navigate(`/part-requests?new=1&q=${encodeURIComponent(debouncedQuery)}`)}
                data-testid="dashboard-search-request-quote"
                className="mt-3 inline-flex items-center gap-1.5 bg-zinc-900 dark:bg-[#E11D48] hover:bg-zinc-700 dark:hover:bg-[#BE123C] text-white text-xs font-semibold px-3.5 py-2 rounded-sm transition-colors"
              >
                Submit part request <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-white/10" data-testid="dashboard-search-results">
              {results.map((p, i) => (
                <li key={p.product_id || p.sku || i}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => goTo(p)}
                    data-testid={`dashboard-search-result-${i}`}
                    role="option"
                    aria-selected={i === activeIdx}
                    className={`w-full text-left flex items-start gap-3 px-3 sm:px-4 py-3 transition-colors ${
                      i === activeIdx
                        ? "bg-zinc-50 dark:bg-white/[0.04]"
                        : "hover:bg-zinc-50 dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    {p.image_url ? (
                      <img src={p.image_url} alt="" loading="lazy" className="w-12 h-12 rounded-sm object-cover bg-zinc-100 dark:bg-zinc-800 shrink-0" />
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
                    </div>
                    <div className="text-right shrink-0 hidden sm:block">
                      {typeof p.workshop_price_bdt === "number" ? (
                        <>
                          <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Workshop</div>
                          <div className="font-mono text-sm text-[#E11D48] font-semibold">{fmtBDT(p.workshop_price_bdt)}</div>
                        </>
                      ) : typeof p.price_bdt === "number" ? (
                        <div className="font-mono text-sm text-zinc-900 dark:text-white font-semibold">{fmtBDT(p.price_bdt)}</div>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardSearchBar;
