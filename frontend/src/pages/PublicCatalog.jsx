import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api, { fmtBDT } from "../lib/api";
import { Search, ArrowRight, Package, Sparkles, Boxes, Lock } from "lucide-react";

const LOGO = "https://customer-assets.emergentagent.com/job_458d530b-69c9-4d64-8b89-03923696b1c8/artifacts/gnewd2f2_IMG-20260209-WA0017.jpg";

const PublicCatalog = () => {
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [activeCat, setActiveCat] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [pRes, cRes] = await Promise.all([
          api.get("/public/catalog"),
          api.get("/public/categories"),
        ]);
        setProducts(pRes.data || []);
        setCats(cRes.data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    let list = products;
    if (activeCat) list = list.filter((p) => p.category === activeCat);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((p) =>
        (p.name || "").toLowerCase().includes(s) ||
        (p.sku || "").toLowerCase().includes(s) ||
        (p.brand || "").toLowerCase().includes(s) ||
        (p.car_fits || []).join(" ").toLowerCase().includes(s)
      );
    }
    return list;
  }, [products, activeCat, q]);

  return (
    <div className="min-h-screen bg-white" data-testid="public-catalog-page">
      <header className="bg-slate-950 text-white border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <Link to="/" className="flex items-center gap-3" data-testid="public-back-home">
            <img src={LOGO} alt="JOY Automart" className="w-10 h-10 object-contain" />
            <div>
              <div className="font-display text-lg leading-none">JOY Automart</div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-300 mt-0.5">Public Catalog</div>
            </div>
          </Link>
          <Link
            to="/dashboard"
            data-testid="public-signin-cta"
            className="inline-flex items-center gap-2 bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-semibold px-5 py-2.5 rounded-sm transition-colors"
          >
            Sign in for tier prices <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-5 py-10">
        <div className="overline">Bangladesh Parts Book</div>
        <h1 className="font-display text-4xl lg:text-5xl mt-2 leading-[1.05]">
          Every part. Every car.<br />
          <span className="text-[#E11D48]">Free to browse.</span>
        </h1>
        <p className="text-slate-600 mt-4 max-w-2xl">
          Search the JOY Automart catalog — wholesale parts and kits in stock for repair workshops across Bangladesh.
          Sign in with your workshop to see your tier-discounted prices and place credit-backed orders.
        </p>

        {/* Search + filters */}
        <div className="mt-8 space-y-4">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              data-testid="public-search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, SKU, brand, or car (e.g. 'Toyota Axio' or 'JA-BRK')"
              className="w-full border border-slate-200 pl-10 pr-3 py-3 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveCat("")}
              data-testid="public-cat-all"
              className={`text-xs font-semibold px-3 py-1.5 rounded-sm border transition-colors ${
                activeCat === "" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-900"
              }`}
            >
              All
            </button>
            {cats.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCat(c)}
                data-testid={`public-cat-${c.replace(/\s+/g, "-")}`}
                className={`text-xs font-semibold px-3 py-1.5 rounded-sm border transition-colors ${
                  activeCat === c ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-900"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="mt-8">
          {loading ? (
            <div className="overline">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="industrial-card p-12 text-center text-slate-500" data-testid="public-empty">
              No parts found. Try a different keyword or category.
            </div>
          ) : (
            <>
              <div className="text-xs text-slate-500 mb-3">
                Showing <b>{filtered.length}</b> of {products.length} parts
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="public-grid">
                {filtered.map((p) => (
                  <article
                    key={p.product_id}
                    className="industrial-card overflow-hidden flex flex-col"
                    data-testid={`public-card-${p.sku}`}
                  >
                    <div className="aspect-square bg-slate-100 overflow-hidden border-b border-slate-200">
                      {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />}
                    </div>
                    <div className="p-3 flex flex-col flex-1">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 inline-flex items-center gap-1">
                        {p.is_kit ? <><Sparkles className="w-3 h-3" /> Body Kit</> : p.is_bundle ? <><Boxes className="w-3 h-3" /> Service Pack</> : <><Package className="w-3 h-3" /> {p.category}</>}
                      </div>
                      <div className="font-semibold text-sm mt-1 leading-tight line-clamp-2">{p.name}</div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">{p.sku}</div>
                      <div className="mt-auto pt-3">
                        <div className="text-xs text-slate-500">B2B price</div>
                        <Link to="/" data-testid={`signin-for-price-${p.sku}`}
                          className="inline-flex items-center gap-1.5 text-sm font-display text-[#E11D48] hover:text-[#BE123C] mt-0.5">
                          <Lock className="w-3.5 h-3.5" /> Sign in to view
                        </Link>
                        {p.stock > 0 ? (
                          <div className="text-[10px] text-emerald-700 mt-1">In stock · {p.stock}</div>
                        ) : (
                          <div className="text-[10px] text-amber-700 mt-1">Pre-order</div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="mt-12 industrial-card p-8 bg-slate-50">
          <div className="overline">For workshops</div>
          <h3 className="font-display text-2xl mt-1">Get tier-discounted prices + 30-day credit</h3>
          <p className="text-sm text-slate-600 mt-2 max-w-2xl">
            Sign in with Google, upload your trade license for KYC, and unlock Silver / Gold / Platinum pricing
            (up to 12% off retail) plus credit-backed ordering.
          </p>
          <div className="mt-4 flex gap-2 flex-wrap">
            <Link to="/dashboard" className="inline-flex items-center gap-2 bg-slate-900 hover:bg-[#E11D48] text-white text-sm font-semibold px-5 py-2.5 rounded-sm transition-colors">
              Sign in <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="https://wa.me/8801886799533" className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ca352] text-white text-sm font-semibold px-5 py-2.5 rounded-sm transition-colors">
              WhatsApp 01886-799533
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 mt-12">
        <div className="max-w-6xl mx-auto px-5 py-6 text-xs text-slate-500 flex flex-wrap justify-between gap-2">
          <div>© {new Date().getFullYear()} JOY Automart · Dhaka, Bangladesh</div>
          <div>
            <Link to="/terms" className="hover:text-[#E11D48]">Terms</Link> · <Link to="/privacy" className="hover:text-[#E11D48]">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicCatalog;
