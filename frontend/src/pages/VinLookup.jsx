import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api, { fmtBDT } from "../lib/api";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { Search, Car, Sparkles, AlertCircle, Bookmark, Trash2, Plus, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

const VehicleCard = ({ v }) => (
  <div className="industrial-card p-5 bg-slate-950 text-white" data-testid="vin-vehicle-card" style={{ backgroundColor: "#020617" }}>
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      <Car className="w-4 h-4 text-[#E11D48]" />
      <div className="overline" style={{ color: "#cbd5e1" }}>Decoded vehicle</div>
      {v.cached && <span className="text-[10px] uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded-sm">cached</span>}
      {Array.isArray(v.sources) && v.sources.map((s) => (
        <span key={s} className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm ${
          s === "nhtsa" ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30"
          : s === "wmi"  ? "bg-blue-500/20 text-blue-200 border border-blue-500/30"
          : s === "year_code" ? "bg-slate-500/20 text-slate-200 border border-slate-500/30"
          : "bg-amber-500/20 text-amber-200 border border-amber-500/30"}`}>
          {s === "nhtsa" ? "NHTSA" : s === "wmi" ? "WMI" : s === "year_code" ? "year-code" : "AI"}
        </span>
      ))}
    </div>
    <div className="font-display text-2xl leading-tight" data-testid="vin-vehicle-title">
      {v.year || "—"} {v.make || "Unknown make"} {v.model || ""}
    </div>
    {v.trim && <div className="text-sm text-slate-300 mt-0.5">{v.trim}</div>}
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-xs">
      {v.body_class && <Field label="Body" value={v.body_class} />}
      {v.engine_l && <Field label="Engine" value={`${parseFloat(v.engine_l).toFixed(1)}L${v.engine_cyl ? ` · ${v.engine_cyl} cyl` : ""}`} />}
      {v.fuel && <Field label="Fuel" value={v.fuel} />}
      {v.transmission && <Field label="Transmission" value={v.transmission} />}
      {v.drive_type && <Field label="Drive" value={v.drive_type} />}
      {(v.plant_country || v.wmi_country) && <Field label="Built in" value={v.plant_country || v.wmi_country} />}
      {v.manufacturer && <Field label="Manufacturer" value={v.manufacturer} />}
    </div>
    {v.ai_inferred && (
      <div className="mt-3 flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-sm p-2 text-[11px] text-amber-200" data-testid="vin-ai-inferred-warning">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>
          Some details (model/engine/body) were AI-inferred from the WMI prefix and year-code because the global
          NHTSA database had partial data for this market. Confidence: <b>{v.ai_confidence || "medium"}</b>. Verify with the vehicle's documents before ordering.
        </span>
      </div>
    )}
    <div className="text-[10px] text-slate-500 mt-3 font-mono">{v.vin}</div>
  </div>
);

const Field = ({ label, value }) => (
  <div className="bg-white/5 border border-white/10 rounded-sm px-2.5 py-2">
    <div className="text-[9px] uppercase tracking-[0.1em] text-slate-300">{label}</div>
    <div className="text-sm font-mono text-white mt-0.5">{value}</div>
  </div>
);

const SuggestionRow = ({ s, onRequest }) => (
  <div className="border border-slate-200 rounded-sm p-3" data-testid={`vin-suggestion-${(s.category || s.name || "").replace(/\s+/g, "-").toLowerCase()}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="overline">{s.category || "Part"}</div>
        <div className="font-display text-sm mt-0.5">{s.name || "—"}</div>
        {s.oem_hint && (
          <div className="text-xs text-slate-600 mt-1">
            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded-sm text-[11px]">{s.oem_hint}</span>
          </div>
        )}
        {s.common_brands && (
          <div className="text-[11px] text-slate-500 mt-1">
            Cross-ref: {Array.isArray(s.common_brands) ? s.common_brands.join(" · ") : s.common_brands}
          </div>
        )}
        {s.notes && <div className="text-[11px] text-slate-500 italic mt-1">{s.notes}</div>}
      </div>
      <button onClick={() => onRequest(s)} data-testid={`request-quote-${(s.name || "").replace(/\s+/g, "-").toLowerCase()}`}
        className="flex-shrink-0 inline-flex items-center gap-1 bg-slate-900 hover:bg-[#E11D48] text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-sm transition-colors">
        <ExternalLink className="w-3 h-3" /> Request quote
      </button>
    </div>
  </div>
);

const VinLookup = () => {
  const [vinInput, setVinInput] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savedVins, setSavedVins] = useState([]);
  const [includeAi, setIncludeAi] = useState(true);
  const [photos, setPhotos] = useState([]);
  const { add } = useCart();

  const loadSaved = async () => {
    try {
      const { data } = await api.get("/vin/saved");
      setSavedVins(data || []);
    } catch (_) { /* not logged in */ }
  };
  useEffect(() => { loadSaved(); }, []);

  const isValid = VIN_RE.test(vinInput.toUpperCase());

  const lookup = async (vinOverride) => {
    const vin = (vinOverride || vinInput).toUpperCase().trim();
    if (!VIN_RE.test(vin)) {
      toast.error("VIN must be 17 chars (A-Z minus I/O/Q, 0-9)");
      return;
    }
    setLoading(true);
    setResult(null);
    setPhotos([]);
    try {
      const { data } = await api.get("/vin/parts", {
        params: { vin, include_ai: includeAi },
      });
      setResult(data);
      setVinInput(vin);
      // Fire-and-forget photo gallery — never blocks the main flow
      const v = data?.vehicle || {};
      if (v.make) {
        api.get("/vin/photos", { params: { make: v.make, model: v.model || "", year: v.year || "" } })
          .then(({ data: pd }) => setPhotos(pd?.photos || []))
          .catch(() => {});
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  const saveVin = async () => {
    if (!result?.vehicle?.vin) return;
    try {
      await api.post("/vin/saved", { vin: result.vehicle.vin });
      toast.success("VIN saved");
      await loadSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Save failed");
    }
  };

  const removeSaved = async (id) => {
    try {
      await api.delete(`/vin/saved/${id}`);
      await loadSaved();
    } catch (_) {}
  };

  const requestQuote = (suggestion) => {
    const v = result?.vehicle || {};
    const partName = suggestion.name || suggestion.category || "Part";
    const note = `For ${v.year || ""} ${v.make || ""} ${v.model || ""} (VIN ${v.vin}). OEM hint: ${suggestion.oem_hint || "—"}`;
    const params = new URLSearchParams({
      car_brand: v.make || "",
      car_model: v.model || "",
      car_year: String(v.year || ""),
      part_name: partName,
      notes: note,
    });
    window.location.href = `/part-requests?${params.toString()}`;
  };

  const addToCart = (p, qty = 1) => {
    const itemForCart = { ...p, price_bdt: p.your_price_bdt || p.price_bdt };
    add(itemForCart, Math.max(qty, p.moq || 1));
    toast.success(`Added ${p.name}`);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <div className="overline">VIN Lookup · Find Parts</div>
          <h1 className="font-display text-3xl lg:text-4xl mt-1" data-testid="vin-page-title">
            Type a VIN. Get parts.
          </h1>
          <p className="text-sm text-slate-600 mt-2 max-w-2xl">
            Decode any vehicle's VIN through the global NHTSA database. We match in-stock JOY parts
            and use AI to suggest cross-reference part numbers for everything else — with a one-tap
            request to our sourcing team for unstocked items.
          </p>
        </div>

        <div className="industrial-card p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                data-testid="vin-input"
                type="text"
                value={vinInput}
                onChange={(e) => setVinInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter" && isValid) lookup(); }}
                placeholder="Enter 17-character VIN (e.g. JTJBM7FX2D5044123)"
                className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48] font-mono text-sm uppercase"
                maxLength={17}
              />
              <div className={`mt-1.5 text-[11px] ${isValid ? "text-emerald-600" : "text-slate-500"}`}>
                {vinInput.length === 0 ? "VINs are stamped on the dashboard or driver-side door jamb · 17 chars" :
                 isValid ? "✓ Valid VIN format" :
                 `${vinInput.length}/17 chars · ${17 - vinInput.length} more to go`}
              </div>
            </div>
            <button
              onClick={() => lookup()}
              disabled={!isValid || loading}
              data-testid="vin-lookup-btn"
              className="bg-[#E11D48] hover:bg-[#BE123C] disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-bold px-6 py-3 rounded-sm transition self-start"
            >
              {loading ? "Decoding…" : "Lookup parts →"}
            </button>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-slate-600 mt-3 cursor-pointer">
            <input type="checkbox" checked={includeAi} onChange={(e) => setIncludeAi(e.target.checked)} data-testid="vin-include-ai" />
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Include AI part suggestions (slower, ~5s)
          </label>
        </div>

        {savedVins.length > 0 && (
          <div className="industrial-card p-4">
            <div className="overline mb-2 flex items-center gap-1"><Bookmark className="w-3 h-3" /> Saved VINs</div>
            <div className="flex flex-wrap gap-2">
              {savedVins.map((s) => (
                <div key={s.saved_id} className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-sm pl-3 pr-1 py-1" data-testid={`saved-vin-${s.saved_id}`}>
                  <button onClick={() => lookup(s.vin)} className="text-xs hover:text-[#E11D48]">
                    <span className="font-mono text-[11px]">{s.vin.slice(-6)}</span>
                    <span className="ml-2 text-slate-600">{s.label}</span>
                  </button>
                  <button onClick={() => removeSaved(s.saved_id)} className="p-1 text-slate-400 hover:text-red-500" data-testid={`remove-saved-${s.saved_id}`}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="industrial-card p-6 text-center text-slate-500 text-sm">Decoding VIN…</div>
        )}

        {result && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <VehicleCard v={result.vehicle} />
                {photos.length > 0 && (
                  <div className="mt-3" data-testid="vin-photo-gallery">
                    <div className="overline mb-2 flex items-center justify-between">
                      <span>Reference photo</span>
                      <span className={`text-[10px] normal-case px-2 py-0.5 rounded-sm ${
                        photos[0].source === "google"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        {photos[0].source === "google" ? "Year-specific" : "Model generation · upgrade for exact-year match"}
                      </span>
                    </div>
                    <a href={photos[0].page_url} target="_blank" rel="noopener noreferrer"
                      data-testid="vin-photo-0"
                      className="block aspect-[16/9] overflow-hidden rounded-sm border border-slate-200 bg-slate-50 relative group">
                      <img src={photos[0].url} alt={photos[0].title} loading="lazy"
                        className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-xs text-white">
                        {photos[0].title}
                      </div>
                    </a>
                  </div>
                )}
              </div>
              <div className="industrial-card p-5">
                <div className="overline">Action</div>
                <div className="text-sm mt-2">
                  Save this VIN for one-tap reorders next time the same vehicle comes in.
                </div>
                <button onClick={saveVin} data-testid="save-vin-btn"
                  className="mt-3 inline-flex items-center gap-1.5 bg-slate-900 hover:bg-[#E11D48] text-white text-xs font-semibold px-4 py-2 rounded-sm transition">
                  <Bookmark className="w-3.5 h-3.5" /> Save VIN
                </button>
              </div>
            </div>

            {/* Matched JOY products */}
            <section data-testid="vin-matched-section">
              <div className="flex items-center gap-2 mb-3">
                <Car className="w-4 h-4 text-emerald-600" />
                <div className="font-display text-lg">In stock at Joy Automart</div>
                <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-sm">
                  {result.in_stock_count} match{result.in_stock_count === 1 ? "" : "es"}
                </span>
              </div>
              {result.matched_products?.length === 0 ? (
                <div className="industrial-card p-6 text-center" data-testid="vin-no-matches">
                  <div className="text-sm text-slate-600">No exact catalog matches for this vehicle yet.</div>
                  <p className="text-xs text-slate-500 mt-1">Check the AI suggestions below — every item can be requested from our sourcing team.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {result.matched_products.map((p) => (
                    <div key={p.product_id} className="industrial-card overflow-hidden flex flex-col" data-testid={`vin-match-${p.sku}`}>
                      <Link to={`/products/${p.product_id}`} className="aspect-[4/3] bg-slate-100 border-b border-slate-200">
                        {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />}
                      </Link>
                      <div className="p-3 flex-1 flex flex-col">
                        <div className="overline">{p.category}</div>
                        <Link to={`/products/${p.product_id}`} className="font-display text-sm mt-0.5 hover:text-[#E11D48] leading-tight">{p.name}</Link>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">{p.sku}</div>
                        <div className="mt-auto pt-3 flex items-end justify-between">
                          <div>
                            <div className="font-display text-base">{fmtBDT(p.your_price_bdt || p.price_bdt)}</div>
                            <div className="text-[10px] text-slate-500">MOQ: {p.moq}</div>
                          </div>
                          <button onClick={() => addToCart(p, p.moq)} data-testid={`vin-add-${p.sku}`}
                            className="inline-flex items-center gap-1 bg-slate-900 hover:bg-[#E11D48] text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-sm transition">
                            <Plus className="w-3 h-3" /> Add
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* AI suggestions */}
            {result.ai_suggestions?.length > 0 && (
              <section data-testid="vin-ai-section">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <div className="font-display text-lg">AI part suggestions</div>
                  <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-sm">
                    {result.ai_suggestions.length} parts
                  </span>
                </div>
                <div className="industrial-card p-3 bg-amber-50/40 border-amber-200 mb-3 flex items-start gap-2 text-xs text-amber-900">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>OEM numbers and brands below are <b>AI-generated cross-references</b>, not from a verified parts database. Always confirm with the vehicle's actual service manual or your supplier before ordering.</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {result.ai_suggestions.map((s, i) => (
                    <SuggestionRow key={i} s={s} onRequest={requestQuote} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default VinLookup;
