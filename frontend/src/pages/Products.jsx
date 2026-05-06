import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import api, { fmtBDT } from "../lib/api";
import { useCart } from "../context/CartContext";
import { Search, Plus, Package, Car, X } from "lucide-react";
import { toast } from "sonner";
import VoiceSearchButton from "../components/VoiceSearchButton";
import { useLang } from "../context/LanguageContext";

// Small wrapper that picks lang from LanguageContext (en | bn)
const VoiceLangButton = ({ onTranscript }) => {
  const { lang } = useLang();
  return <VoiceSearchButton onTranscript={onTranscript} lang={lang} testid="products-voice-search" />;
};

const CATEGORIES = ["All", "Body Kits", "Brake", "Engine", "Suspension", "Electrical", "Drivetrain", "Fluids", "Modifications", "Performance", "Accessories", "Lighting", "Tyres & Wheels", "Tools", "Audio"];

const ProductCard = ({ p, onAdd }) => {
  const [qty, setQty] = useState(p.moq || 1);
  const showSaving = p.your_price_bdt && p.retail_price_bdt && p.your_price_bdt < p.retail_price_bdt;
  return (
    <div className="industrial-card overflow-hidden flex flex-col" data-testid={`product-card-${p.sku}`}>
      <Link to={`/products/${p.product_id}`} className="aspect-[4/3] bg-slate-100 overflow-hidden border-b border-slate-200 block">
        {p.image_url ? (
          <img src={p.image_url} alt={p.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full grid place-items-center text-slate-400"><Package className="w-10 h-10" /></div>
        )}
      </Link>
      <div className="p-4 flex-1 flex flex-col">
        <div className="overline">{p.category} · {p.brand}</div>
        <Link to={`/products/${p.product_id}`} className="font-display text-base mt-1 leading-tight hover:text-[#E11D48]">{p.name}</Link>
        <div className="text-xs text-slate-500 mt-1 font-mono">{p.sku}</div>
        <div className="mt-auto pt-4 flex items-end justify-between">
          <div>
            <div className="overline">{p.your_tier && p.your_tier !== "retail" ? `${p.your_tier} price` : "Retail"}</div>
            <div className="font-display text-xl">{fmtBDT(p.your_price_bdt || p.price_bdt)}</div>
            {showSaving && <div className="text-xs text-slate-400 line-through">{fmtBDT(p.retail_price_bdt)}</div>}
            <div className="text-xs text-slate-500">MOQ: {p.moq}</div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <input type="number" min={p.moq} value={qty}
              onChange={(e) => setQty(Math.max(p.moq, parseInt(e.target.value) || p.moq))}
              data-testid={`product-qty-${p.sku}`}
              className="w-20 border border-slate-200 px-2 py-1 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]" />
            <button onClick={() => onAdd(p, qty)} data-testid={`add-to-cart-${p.sku}`}
              className="inline-flex items-center gap-1 bg-slate-900 hover:bg-[#E11D48] text-white text-xs font-semibold px-3 py-2 rounded-sm transition-colors duration-200">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Products = () => {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [carBrand, setCarBrand] = useState("");
  const [carModel, setCarModel] = useState("");
  const [carYear, setCarYear] = useState("");
  const [vehicleTree, setVehicleTree] = useState({ brands: [], by_brand: {} });
  const [loading, setLoading] = useState(true);
  const { add } = useCart();

  // Load cascade tree once
  useEffect(() => {
    api.get("/vehicles/options").then(({ data }) => setVehicleTree(data || { brands: [], by_brand: {} })).catch(() => {});
  }, []);

  // Reset model/year when brand changes; reset year when model changes
  useEffect(() => { setCarModel(""); setCarYear(""); }, [carBrand]);
  useEffect(() => { setCarYear(""); }, [carModel]);

  const availableModels = carBrand && vehicleTree.by_brand[carBrand]
    ? vehicleTree.by_brand[carBrand].models : [];
  const availableYears = carBrand && carModel && vehicleTree.by_brand[carBrand]?.by_model?.[carModel]
    ? vehicleTree.by_brand[carBrand].by_model[carModel] : [];

  useEffect(() => {
    (async () => {
      setLoading(true);
      const params = {};
      if (q) params.q = q;
      if (cat && cat !== "All") params.category = cat;
      if (carBrand) params.car_brand = carBrand;
      if (carModel) params.car_model = carModel;
      if (carYear) params.car_year = parseInt(carYear);
      const { data } = await api.get("/products", { params });
      setItems(data || []);
      setLoading(false);
    })();
  }, [q, cat, carBrand, carModel, carYear]);

  const handleAdd = (p, qty) => {
    if (qty < p.moq) { toast.error(`Minimum order quantity is ${p.moq}`); return; }
    const itemForCart = { ...p, price_bdt: p.your_price_bdt || p.price_bdt };
    add(itemForCart, qty);
    toast.success(`Added ${qty} × ${p.name}`);
  };

  const clearCar = () => { setCarBrand(""); setCarModel(""); setCarYear(""); };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <div className="overline">Catalogue</div>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl leading-tight mt-1">Auto Parts & Consumables</h1>
        </div>

        <div className="industrial-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Car className="w-4 h-4 text-[#E11D48]" />
            <div className="overline">Find parts for your car</div>
            {(carBrand || carModel || carYear) && (
              <button onClick={clearCar} data-testid="clear-car-filter"
                className="ml-auto text-xs text-slate-500 hover:text-[#E11D48] flex items-center gap-1">
                <X className="w-3 h-3" /> clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <select data-testid="car-brand-filter" value={carBrand} onChange={(e) => setCarBrand(e.target.value)}
              className="border border-slate-200 px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48] bg-white">
              <option value="">Brand · any</option>
              {vehicleTree.brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select data-testid="car-model-filter" value={carModel} onChange={(e) => setCarModel(e.target.value)} disabled={!carBrand}
              className="border border-slate-200 px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48] bg-white disabled:bg-slate-50 disabled:text-slate-400">
              <option value="">{carBrand ? "Model · any" : "Pick a brand first"}</option>
              {availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select data-testid="car-year-filter" value={carYear} onChange={(e) => setCarYear(e.target.value)} disabled={!carModel}
              className="border border-slate-200 px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48] bg-white disabled:bg-slate-50 disabled:text-slate-400">
              <option value="">{carModel ? "Year · any" : "Pick a model first"}</option>
              {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="relative flex-1 max-w-xl flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input data-testid="product-search" type="text" placeholder="Search by name, SKU, brand or speak…"
                value={q} onChange={(e) => setQ(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]" />
            </div>
            <VoiceLangButton onTranscript={setQ} />
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCat(c)} data-testid={`filter-${c.toLowerCase()}`}
                className={`text-xs font-semibold px-3 py-2 rounded-sm border transition-colors duration-200 ${
                  cat === c ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-900"
                }`}>{c}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="overline">Loading products…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-slate-500 mb-4">No products matching your filters.</div>
            <Link to="/part-requests" data-testid="request-any-part-cta"
              className="inline-flex items-center gap-2 bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-semibold px-5 py-2.5 rounded-sm transition-colors duration-200">
              Request this part from our sourcing team →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {items.map((p) => <ProductCard key={p.product_id} p={p} onAdd={handleAdd} />)}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Products;
