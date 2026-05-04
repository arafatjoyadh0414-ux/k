import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api, { fmtBDT } from "../lib/api";
import { useCart } from "../context/CartContext";
import { Link } from "react-router-dom";
import { Boxes, Check, ShoppingCart, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const PackCard = ({ pack, onAdd }) => {
  const youSave = pack.retail_price_bdt - pack.your_price_bdt;
  return (
    <div className="industrial-card overflow-hidden flex flex-col" data-testid={`pack-card-${pack.sku}`}>
      <div className="relative h-40 bg-slate-950 overflow-hidden">
        {pack.image_url && (
          <img src={pack.image_url} alt={pack.name} className="w-full h-full object-cover opacity-90" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />
        <div className="absolute top-3 left-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] px-2.5 py-1 rounded-sm bg-[#E11D48] text-white inline-flex items-center gap-1.5">
            <Boxes className="w-3 h-3" /> Service Pack
          </span>
        </div>
        <div className="absolute bottom-3 left-3 right-3 text-white">
          <div className="font-display text-xl leading-tight">{pack.name.replace("JOY ", "")}</div>
        </div>
      </div>

      <div className="p-5 flex flex-col flex-1">
        <p className="text-sm text-slate-600 leading-relaxed">{pack.description}</p>

        <div className="mt-4">
          <div className="overline mb-2">Includes</div>
          <ul className="space-y-1.5">
            {(pack.bundle_items_resolved || []).map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm" data-testid={`pack-item-${pack.sku}-${i}`}>
                <Check className="w-4 h-4 text-[#E11D48] shrink-0 mt-0.5" />
                <span className="flex-1">{b.name}</span>
                <span className="text-slate-500 font-mono text-xs">x{b.quantity}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto pt-5 flex items-end justify-between gap-3">
          <div>
            <div className="overline">Your Price</div>
            <div className="font-display text-2xl mt-1">{fmtBDT(pack.your_price_bdt)}</div>
            {youSave > 0 && (
              <div className="text-[11px] text-slate-500 mt-0.5">
                <span className="line-through">{fmtBDT(pack.retail_price_bdt)}</span>
                <span className="ml-1.5 text-emerald-700 font-semibold">save {fmtBDT(youSave)}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => onAdd(pack)}
            data-testid={`add-pack-${pack.sku}`}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-[#E11D48] text-white text-xs font-semibold px-3.5 py-2 rounded-sm transition-colors duration-200 shrink-0"
          >
            <ShoppingCart className="w-3.5 h-3.5" /> Add Pack
          </button>
        </div>
      </div>
    </div>
  );
};

const ServicePacks = () => {
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { add } = useCart();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/service-packs");
        setPacks(data || []);
      } catch (e) {
        toast.error("Failed to load service packs");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleAdd = (pack) => {
    add(
      {
        product_id: pack.product_id,
        name: pack.name,
        sku: pack.sku,
        image_url: pack.image_url,
        price_bdt: pack.your_price_bdt,
        moq: pack.moq || 1,
      },
      1
    );
    toast.success(`${pack.name} added to cart`);
  };

  return (
    <Layout>
      <div className="space-y-8">
        <section className="industrial-card overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-7 p-8 lg:p-10 bg-slate-950 text-white">
              <div className="overline" style={{ color: "#cbd5e1" }}>Bundle savings</div>
              <h1 className="font-display text-4xl lg:text-5xl mt-3 leading-[1.05]">
                JOY Service Packs.<br />
                <span className="text-[#E11D48]">One click. Full service.</span>
              </h1>
              <p className="text-slate-300 mt-5 max-w-md">
                Pre-curated parts bundles for routine and major service jobs. Stock once, sell many — already discounted at your tier price.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/products"
                  data-testid="packs-browse-parts"
                  className="inline-flex items-center gap-2 bg-transparent border border-slate-700 hover:border-white text-white text-sm font-semibold px-5 py-3 rounded-sm transition-colors duration-200"
                >
                  Or browse parts <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
            <div className="lg:col-span-5 p-8 lg:p-10 bg-white border-l border-slate-200">
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-4 h-4 text-[#E11D48] mt-0.5 shrink-0" />
                  <div><span className="font-semibold">Time-tested combos</span> — built from our top-selling SKUs</div>
                </div>
                <div className="flex items-start gap-3">
                  <Sparkles className="w-4 h-4 text-[#E11D48] mt-0.5 shrink-0" />
                  <div><span className="font-semibold">Tier price applied</span> — already includes your workshop discount</div>
                </div>
                <div className="flex items-start gap-3">
                  <Sparkles className="w-4 h-4 text-[#E11D48] mt-0.5 shrink-0" />
                  <div><span className="font-semibold">Sells fast</span> — ready-to-quote service packages for your customers</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <div className="overline">The lineup</div>
            <h2 className="font-display text-3xl mt-1">Pick a pack. We'll pick the parts.</h2>
          </div>

          {loading ? (
            <div className="overline">Loading service packs…</div>
          ) : packs.length === 0 ? (
            <div className="industrial-card p-10 text-center text-sm text-slate-500" data-testid="packs-empty">
              No service packs available yet. Check back soon.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="packs-grid">
              {packs.map((p) => (
                <PackCard key={p.product_id} pack={p} onAdd={handleAdd} />
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
};

export default ServicePacks;
