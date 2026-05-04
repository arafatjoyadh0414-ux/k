import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import api, { fmtBDT } from "../lib/api";
import { ArrowLeft, Plus, ShoppingCart, Package } from "lucide-react";
import { useCart } from "../context/CartContext";
import { toast } from "sonner";

const ProductDetail = () => {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [qty, setQty] = useState(1);
  const [related, setRelated] = useState([]);
  const { add } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data } = await api.get(`/products/${id}`);
      setP(data);
      setQty(data.moq || 1);
      const r = await api.get("/products", { params: { category: data.category } });
      setRelated((r.data || []).filter((x) => x.product_id !== data.product_id).slice(0, 4));
    })();
  }, [id]);

  if (!p) return <Layout><div className="overline">Loading…</div></Layout>;

  const handleAdd = () => {
    if (qty < p.moq) { toast.error(`MOQ is ${p.moq}`); return; }
    add({ ...p, price_bdt: p.your_price_bdt }, qty);
    toast.success(`Added ${qty} × ${p.name}`);
  };

  const buyNow = () => {
    handleAdd();
    navigate("/cart");
  };

  const images = [p.image_url, ...(p.gallery || [])].filter(Boolean);

  return (
    <Layout>
      <div className="space-y-6">
        <Link to="/products" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-[#E11D48]">
          <ArrowLeft className="w-4 h-4" /> Back to products
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Image */}
          <div className="lg:col-span-6">
            <div className="industrial-card overflow-hidden bg-slate-100">
              <div className="aspect-[4/3]">
                {images[0] ? (
                  <img src={images[0]} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-slate-400"><Package className="w-16 h-16" /></div>
                )}
              </div>
              {images.length > 1 && (
                <div className="p-3 grid grid-cols-4 gap-2">
                  {images.slice(0, 4).map((src, i) => (
                    <div key={i} className="aspect-square bg-white border border-slate-200 overflow-hidden">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="lg:col-span-6 space-y-5">
            <div>
              <div className="overline">{p.category} · {p.brand}</div>
              <h1 className="font-display text-3xl lg:text-4xl mt-1 leading-tight">{p.name}</h1>
              <div className="text-xs text-slate-500 mt-2 font-mono">SKU {p.sku}</div>
            </div>

            <div className="border-y border-slate-200 py-4">
              <div className="overline">Your Price {p.your_tier !== "retail" && `(${p.your_tier} tier)`}</div>
              <div className="flex items-baseline gap-3 mt-1">
                <div className="font-display text-4xl">{fmtBDT(p.your_price_bdt)}</div>
                {p.your_price_bdt < p.retail_price_bdt && (
                  <div className="text-sm line-through text-slate-400">{fmtBDT(p.retail_price_bdt)}</div>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-1">MOQ {p.moq} · Stock {p.stock > 0 ? <span className="text-emerald-700 font-semibold">{p.stock}</span> : <span className="text-red-600">Out of stock</span>}</div>
            </div>

            {p.description && (
              <div>
                <div className="overline mb-2">Description</div>
                <p className="text-sm text-slate-700 leading-relaxed">{p.description}</p>
              </div>
            )}

            {p.kit_features?.length > 0 && (
              <div>
                <div className="overline mb-2">Includes</div>
                <ul className="space-y-1 text-sm">
                  {p.kit_features.map((f) => <li key={f}>· {f}</li>)}
                </ul>
              </div>
            )}

            {p.car_fits?.length > 0 && (
              <div>
                <div className="overline mb-2">Fits</div>
                <div className="flex flex-wrap gap-2">
                  {p.car_fits.map((f, i) => (
                    <span key={i} className="text-xs bg-slate-100 border border-slate-200 px-2 py-1 rounded-sm">
                      {f.brand} {f.model} {f.year_from}{f.year_to && f.year_from !== f.year_to ? `-${f.year_to}` : ""}
                      {f.engine && ` · ${f.engine}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {p.is_bundle && p.bundle_items_resolved?.length > 0 && (
              <div>
                <div className="overline mb-2">Bundle Contents</div>
                <ul className="space-y-1.5">
                  {p.bundle_items_resolved.map((bi) => (
                    <li key={bi.product_id} className="flex items-center gap-2 text-sm">
                      <div className="w-8 h-8 bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                        {bi.image_url && <img src={bi.image_url} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <span className="flex-1">{bi.name}</span>
                      <span className="text-slate-500">×{bi.quantity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <div>
                <label className="overline block mb-1.5">Quantity</label>
                <input type="number" min={p.moq} value={qty}
                  onChange={(e) => setQty(Math.max(p.moq, parseInt(e.target.value) || p.moq))}
                  data-testid="pd-qty"
                  className="w-24 border border-slate-200 px-3 py-2 rounded-sm" />
              </div>
              <button onClick={handleAdd} data-testid="pd-add"
                className="inline-flex items-center gap-2 bg-slate-900 hover:bg-[#E11D48] text-white text-sm font-semibold px-5 py-2.5 rounded-sm transition-colors duration-200">
                <Plus className="w-4 h-4" /> Add to Cart
              </button>
              <button onClick={buyNow} data-testid="pd-buy"
                className="inline-flex items-center gap-2 bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-semibold px-5 py-2.5 rounded-sm transition-colors duration-200">
                <ShoppingCart className="w-4 h-4" /> Buy Now
              </button>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <div>
            <div className="overline mb-3">Frequently bought together</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {related.map((r) => (
                <Link key={r.product_id} to={`/products/${r.product_id}`}
                  className="industrial-card overflow-hidden hover:border-slate-900 transition-colors duration-200">
                  <div className="aspect-square bg-slate-100">
                    {r.image_url && <img src={r.image_url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="p-3">
                    <div className="text-xs text-slate-500 font-mono">{r.sku}</div>
                    <div className="text-sm font-semibold mt-1 line-clamp-2">{r.name}</div>
                    <div className="font-display text-lg mt-1">{fmtBDT(r.your_price_bdt)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ProductDetail;
