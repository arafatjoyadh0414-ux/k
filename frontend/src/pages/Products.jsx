import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api, { fmtBDT } from "../lib/api";
import { useCart } from "../context/CartContext";
import { Search, Plus, Package } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["All", "Body Kits", "Brake", "Engine", "Suspension", "Electrical", "Drivetrain", "Fluids", "Modifications", "Performance", "Accessories", "Lighting", "Tyres & Wheels", "Tools", "Audio"];

const ProductCard = ({ p, onAdd }) => {
  const [qty, setQty] = useState(p.moq || 1);
  return (
    <div className="industrial-card overflow-hidden flex flex-col" data-testid={`product-card-${p.sku}`}>
      <div className="aspect-[4/3] bg-slate-100 overflow-hidden border-b border-slate-200">
        {p.image_url ? (
          <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center text-slate-400"><Package className="w-10 h-10" /></div>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <div className="overline">{p.category} · {p.brand}</div>
        <div className="font-display text-base mt-1 leading-tight">{p.name}</div>
        <div className="text-xs text-slate-500 mt-1 font-mono">{p.sku}</div>

        <div className="mt-auto pt-4 flex items-end justify-between">
          <div>
            <div className="overline">Wholesale</div>
            <div className="font-display text-xl">{fmtBDT(p.price_bdt)}</div>
            <div className="text-xs text-slate-500">MOQ: {p.moq}</div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <input
              type="number" min={p.moq} value={qty}
              onChange={(e) => setQty(Math.max(p.moq, parseInt(e.target.value) || p.moq))}
              data-testid={`product-qty-${p.sku}`}
              className="w-20 border border-slate-200 px-2 py-1 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
            />
            <button
              onClick={() => onAdd(p, qty)}
              data-testid={`add-to-cart-${p.sku}`}
              className="inline-flex items-center gap-1 bg-slate-900 hover:bg-[#E11D48] text-white text-xs font-semibold px-3 py-2 rounded-sm transition-colors duration-200"
            >
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
  const [loading, setLoading] = useState(true);
  const { add } = useCart();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const params = {};
      if (q) params.q = q;
      if (cat && cat !== "All") params.category = cat;
      const { data } = await api.get("/products", { params });
      setItems(data || []);
      setLoading(false);
    })();
  }, [q, cat]);

  const handleAdd = (p, qty) => {
    if (qty < p.moq) { toast.error(`Minimum order quantity is ${p.moq}`); return; }
    add(p, qty);
    toast.success(`Added ${qty} × ${p.name}`);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <div className="overline">Catalog</div>
          <h1 className="font-display text-3xl lg:text-4xl mt-1">Auto Parts & Consumables</h1>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="relative flex-1 max-w-xl">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              data-testid="product-search"
              type="text" placeholder="Search by name, SKU, or brand…"
              value={q} onChange={(e) => setQ(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c} onClick={() => setCat(c)}
                data-testid={`filter-${c.toLowerCase()}`}
                className={`text-xs font-semibold px-3 py-2 rounded-sm border transition-colors duration-200 ${
                  cat === c
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-900"
                }`}
              >{c}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="overline">Loading products…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No products found.</div>
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
