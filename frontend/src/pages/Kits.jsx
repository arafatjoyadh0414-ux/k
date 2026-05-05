import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api, { fmtBDT } from "../lib/api";
import { useCart } from "../context/CartContext";
import { Link } from "react-router-dom";
import { Check, Flame, Sparkles, Mountain, Crown, Zap, ShoppingCart, ArrowRight, Phone } from "lucide-react";
import { toast } from "sonner";

const TIER_BADGE = {
  entry:    { label: "Entry Performance", icon: Zap,       color: "bg-slate-900 text-white" },
  mass:     { label: "Mass Market",       icon: Flame,     color: "bg-emerald-600 text-white" },
  special:  { label: "Special Segment",   icon: Mountain,  color: "bg-amber-600 text-white" },
  premium:  { label: "Premium Seller",    icon: Crown,     color: "bg-blue-700 text-white" },
  flagship: { label: "Viral Flagship",    icon: Sparkles,  color: "bg-[#E11D48] text-white" },
};

const KIT_OVERVIEW_IMG = "https://customer-assets.emergentagent.com/job_workshop-dashboard-1/artifacts/4zbzw2t5_file_00000000f52c7207a61592d53fb54486.png";
const KIT_BASE_IMG = "https://customer-assets.emergentagent.com/job_workshop-dashboard-1/artifacts/1eis8km7_file_000000000e8072079096c123f02b91a0.png";

const KitCard = ({ kit, onAdd, isAlt }) => {
  const Tier = TIER_BADGE[kit.kit_tier] || TIER_BADGE.entry;
  const Icon = Tier.icon;
  return (
    <div className={`industrial-card overflow-hidden grid grid-cols-1 lg:grid-cols-12 ${isAlt ? "lg:[&>div:first-child]:order-2" : ""}`} data-testid={`kit-card-${kit.sku}`}>
      <div className="lg:col-span-7 bg-slate-950 relative overflow-hidden min-h-[320px]">
        <img src={kit.image_url} alt={kit.name} className="w-full h-full object-cover opacity-95" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
        <div className="absolute top-4 left-4">
          <span className={`text-[10px] font-semibold uppercase tracking-[0.2em] px-3 py-1.5 rounded-sm inline-flex items-center gap-1.5 ${Tier.color}`}>
            <Icon className="w-3.5 h-3.5" /> {Tier.label}
          </span>
        </div>
        <div className="absolute bottom-4 left-4 text-white">
          <div className="overline" style={{color: "#cbd5e1"}}>Joy Signature Series</div>
          <div className="font-display text-2xl sm:text-3xl lg:text-4xl leading-tight mt-1 leading-none">{kit.name.replace(" Body Kit", "")}</div>
        </div>
      </div>

      <div className="lg:col-span-5 p-6 lg:p-8 flex flex-col">
        <div className="overline">{kit.brand}</div>
        <div className="font-display text-2xl mt-1">{kit.name}</div>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">{kit.description}</p>

        <div className="mt-5">
          <div className="overline mb-2">Includes</div>
          <ul className="space-y-1.5">
            {kit.kit_features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-[#E11D48] shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto pt-6 flex items-end justify-between gap-4">
          <div>
            <div className="overline">Wholesale</div>
            <div className="font-display text-3xl mt-1">{fmtBDT(kit.price_bdt)}</div>
            <div className="text-xs text-slate-500 mt-0.5">+ ৳50k–1L installation</div>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => onAdd(kit)}
              data-testid={`add-kit-${kit.sku}`}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-[#E11D48] text-white text-sm font-semibold px-4 py-2.5 rounded-sm transition-colors duration-200"
            >
              <ShoppingCart className="w-4 h-4" /> Add to Cart
            </button>
            <Link
              to={`/inquire/${kit.sku}`}
              data-testid={`inquire-kit-${kit.sku}`}
              className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:border-[#E11D48] hover:text-[#E11D48] text-xs font-semibold px-4 py-2 rounded-sm transition-colors duration-200"
            >
              <Phone className="w-3.5 h-3.5" /> Schedule Install
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

const Kits = () => {
  const [kits, setKits] = useState([]);
  const [loading, setLoading] = useState(true);
  const { add } = useCart();

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/kits");
      setKits(data || []);
      setLoading(false);
    })();
  }, []);

  const handleAdd = (kit) => {
    add(kit, 1);
    toast.success(`${kit.name} added to cart`);
  };

  return (
    <Layout>
      <div className="space-y-10">
        {/* Hero */}
        <section className="relative overflow-hidden border border-slate-200 rounded-sm">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-8 lg:p-12 bg-slate-950 text-white">
              <div className="overline" style={{color: "#cbd5e1"}}>Joy Signature Series</div>
              <h1 className="font-display text-4xl lg:text-5xl mt-3 leading-[1.05]">
                Transform any car<br />in <span className="text-[#E11D48]">48 hours.</span>
              </h1>
              <p className="text-slate-300 mt-5 max-w-md">
                Five precision body kits engineered for Bangladesh's roads — from daily street to flagship show car.
                Imported direct, installed at JOY-certified workshops, owned by you.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="#kit-list" data-testid="kits-explore-cta" className="inline-flex items-center gap-2 bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-semibold px-5 py-3 rounded-sm transition-colors duration-200">
                  Explore Kits <ArrowRight className="w-4 h-4" />
                </a>
                <Link to="/products" className="inline-flex items-center gap-2 bg-transparent border border-slate-700 hover:border-white text-white text-sm font-semibold px-5 py-3 rounded-sm transition-colors duration-200">
                  Or browse parts
                </Link>
              </div>

              <div className="mt-10 grid grid-cols-3 gap-6 max-w-md">
                <div>
                  <div className="font-display text-3xl">5</div>
                  <div className="overline mt-1" style={{color: "#cbd5e1"}}>Kits</div>
                </div>
                <div>
                  <div className="font-display text-3xl">21"</div>
                  <div className="overline mt-1" style={{color: "#cbd5e1"}}>BKU Wheels</div>
                </div>
                <div>
                  <div className="font-display text-3xl">48h</div>
                  <div className="overline mt-1" style={{color: "#cbd5e1"}}>Install</div>
                </div>
              </div>
            </div>

            <div className="bg-white border-l border-slate-200 grid grid-cols-2">
              <div className="border-r border-b border-slate-200 p-3 flex items-center justify-center bg-slate-50">
                <div className="text-center">
                  <div className="overline mb-2">Before</div>
                  <img src={KIT_BASE_IMG} alt="Stock" className="w-full max-h-48 object-contain" />
                </div>
              </div>
              <div className="border-b border-slate-200 p-3 flex items-center justify-center bg-slate-950">
                <div className="text-center">
                  <div className="overline mb-2" style={{color: "#cbd5e1"}}>After</div>
                  <img src={KIT_OVERVIEW_IMG} alt="Kits" className="w-full max-h-48 object-contain" />
                </div>
              </div>
              <div className="col-span-2 p-4 text-center text-xs text-slate-500">
                <span className="font-semibold">VEHICLE:</span> BYD Sealion 6 &nbsp;·&nbsp;
                <span className="font-semibold">WHEEL:</span> 21" BKU Racing &nbsp;·&nbsp;
                <span className="font-semibold">COLOR:</span> Gloss Black
              </div>
            </div>
          </div>
        </section>

        {/* Kits */}
        <section id="kit-list" className="space-y-6">
          <div>
            <div className="overline">The Lineup</div>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl leading-tight mt-1">Five kits. One transformation.</h2>
          </div>

          {loading ? (
            <div className="overline">Loading kits…</div>
          ) : (
            <div className="space-y-6">
              {kits.map((k, i) => (
                <KitCard key={k.product_id} kit={k} onAdd={handleAdd} isAlt={i % 2 === 1} />
              ))}
            </div>
          )}
        </section>

        {/* CTA */}
        <section className="industrial-card p-8 bg-slate-50">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="overline">Workshop partner program</div>
              <div className="font-display text-2xl mt-1">Get certified, install, and earn margin.</div>
              <p className="text-sm text-slate-600 mt-2">Approved workshops can list installation services and earn commission per kit.</p>
            </div>
            <Link to="/profile" className="inline-flex items-center gap-2 bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-semibold px-5 py-3 rounded-sm transition-colors duration-200">
              Apply via Profile <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default Kits;
