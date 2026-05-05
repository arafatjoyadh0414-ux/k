import React from "react";
import { useAuth } from "../context/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Wallet, Truck, PackageSearch, Bot, BarChart3, Boxes, Zap } from "lucide-react";

const LOGO = "https://customer-assets.emergentagent.com/job_458d530b-69c9-4d64-8b89-03923696b1c8/artifacts/gnewd2f2_IMG-20260209-WA0017.jpg";
const HERO = "https://images.pexels.com/photos/8986132/pexels-photo-8986132.jpeg";

const Landing = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;

  const handleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/auth/callback";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO} alt="Joy Automart" className="w-10 h-10 object-contain" />
            <div>
              <div className="font-display text-lg leading-none">Joy Automart</div>
              <div className="overline mt-1">B2B Portal · Bangladesh</div>
            </div>
          </div>
          <button
            data-testid="top-login-button"
            onClick={handleLogin}
            className="text-sm font-semibold text-slate-700 hover:text-[#E11D48] transition-colors duration-200 flex items-center gap-2"
          >
            Sign in <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Hero */}
      <section className="border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 py-16 lg:py-24">
          <div className="lg:col-span-7">
            <div className="overline mb-5">For Auto Repair Workshops</div>
            <h1 className="font-display text-5xl lg:text-6xl leading-[1.05] tracking-tight">
              Stock smarter.<br />
              Order on credit.<br />
              <span className="text-[#E11D48]">Run faster.</span>
            </h1>
            <p className="text-lg text-slate-600 mt-6 max-w-xl">
              Joy Automart's wholesale portal gives Bangladesh's repair workshops verified parts,
              transparent B2B pricing, and instant credit-backed ordering—built for the bay floor,
              not the boardroom.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                data-testid="hero-google-login-button"
                onClick={handleLogin}
                className="inline-flex items-center gap-3 bg-[#E11D48] hover:bg-[#BE123C] text-white px-6 py-3 rounded-sm font-semibold transition-colors duration-200"
              >
                <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#fff" d="M24 9.5c3.4 0 6.4 1.2 8.8 3.4l6.6-6.6C35.4 2.6 30 .5 24 .5 14.7.5 6.7 5.8 2.9 13.6l7.7 6c1.8-5.5 6.9-9.6 13.4-9.6z"/><path fill="#fff" opacity=".8" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.4 5.5-5 7.2l7.7 6c4.5-4.2 7.1-10.4 7.1-17.7z"/><path fill="#fff" opacity=".6" d="M10.6 28.4c-.5-1.4-.8-2.9-.8-4.4s.3-3 .8-4.4l-7.7-6C1.3 17 0 20.4 0 24s1.3 7 2.9 10.4l7.7-6z"/><path fill="#fff" opacity=".9" d="M24 47.5c6 0 11.4-2 15.4-5.4l-7.7-6c-2.1 1.4-4.8 2.3-7.7 2.3-6.5 0-11.6-4.1-13.4-9.6l-7.7 6C6.7 42.2 14.7 47.5 24 47.5z"/></svg>
                Continue with Google
              </button>
              <a href="/catalog" data-testid="hero-catalog-link"
                 className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-900 text-slate-900 px-6 py-3 rounded-sm font-semibold transition-colors duration-200">
                Browse catalog
              </a>
              <a href="https://wa.me/8801886799533" data-testid="hero-whatsapp-link"
                 className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ca352] text-white px-5 py-3 rounded-sm font-semibold transition-colors duration-200">
                WhatsApp 01886-799533
              </a>
              <a href="/inquire" data-testid="hero-inquire-link"
                 className="text-sm font-semibold text-slate-700 hover:text-[#E11D48] underline-offset-4 hover:underline">
                Schedule a Kit Install →
              </a>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-6 max-w-lg">
              <div>
                <div className="font-display text-3xl">38+</div>
                <div className="overline mt-1">Parts & Kits</div>
              </div>
              <div>
                <div className="font-display text-3xl">৳ 5L</div>
                <div className="overline mt-1">Credit Lines</div>
              </div>
              <div>
                <div className="font-display text-3xl">48h</div>
                <div className="overline mt-1">Delivery</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="relative border border-slate-200 rounded-sm overflow-hidden">
              <img src={HERO} alt="Mechanic at work" className="w-full h-[460px] object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 bg-white border border-slate-200 p-4">
                <div className="overline">Live order</div>
                <div className="text-sm font-semibold mt-1">ORD-20260209-A12B</div>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-slate-600">Brake Disc Rotor x 4</span>
                  <span className="font-semibold">৳ 18,000</span>
                </div>
                <div className="mt-3 h-1.5 bg-slate-100 overflow-hidden">
                  <div className="h-full bg-[#E11D48]" style={{ width: "65%" }} />
                </div>
                <div className="overline mt-2">Shipped · ETA Tomorrow</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="overline mb-2">Built for the bay floor</div>
        <h2 className="font-display text-3xl lg:text-4xl tracking-tight max-w-3xl">
          A workshop's command center for parts.<br />
          <span className="text-[#E11D48]">Now with AI.</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
          {[
            { Icon: ShieldCheck, t: "KYC Verified Trade", d: "Submit your trade license once. Get verified, unlock credit, and order with confidence." },
            { Icon: Wallet, t: "Credit on Tap", d: "Admin-set credit limits per workshop. 30-day terms. Outstanding balance always visible." },
            { Icon: PackageSearch, t: "Genuine Parts", d: "Brake, engine, suspension, electrical, fluids — curated catalog with B2B tier pricing." },
            { Icon: Truck, t: "Trackable Delivery", d: "From Placed to Delivered — live status, dispatch updates, and delivery person assigned per order." },
            { Icon: Bot, t: "JOY AI Assistant", d: "Ask anything about cars or our catalog — diagnostics, fitment, oil specs, even build a full order in chat." },
            { Icon: BarChart3, t: "Joy Score & Insights", d: "Bangladesh's first workshop credit rating. Monthly spend, top parts, predictive reorder nudges — all on /insights." },
            { Icon: Boxes, t: "Service Packs", d: "Pre-curated bundles — JOY Basic Service, Premium Service, Brake Refresh, Suspension Tune-Up. One click, full job." },
            { Icon: Zap, t: "Quick Tools", d: "Save your own service kits. Paste a bulk SKU list and add 15 items to cart in one shot." },
          ].map(({ Icon, t, d }) => (
            <div key={t} className="industrial-card p-5">
              <div className="w-10 h-10 grid place-items-center bg-slate-900 text-white mb-4 rounded-sm">
                <Icon className="w-5 h-5" />
              </div>
              <div className="font-display text-lg">{t}</div>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 py-14 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="overline mb-2">Apply now</div>
            <h3 className="font-display text-3xl lg:text-4xl tracking-tight">
              Ready to place your first wholesale order?
            </h3>
            <p className="text-slate-600 mt-2">Sign up free. KYC takes a day. Credit gets approved on review.</p>
          </div>
          <button
            data-testid="bottom-cta-button"
            onClick={handleLogin}
            className="inline-flex items-center gap-3 bg-slate-900 hover:bg-[#E11D48] text-white px-6 py-3 rounded-sm font-semibold transition-colors duration-200"
          >
            Get started <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="font-display text-lg leading-none">JOY Automart</div>
            <div className="overline mt-1">B2B Wholesale Portal · Bangladesh</div>
            <p className="text-sm text-slate-600 mt-3 max-w-md">
              Verified parts. Transparent B2B pricing. Credit-backed ordering. Built for the bay floor, not the boardroom.
            </p>
            <div className="text-xs text-slate-500 mt-4 space-y-0.5">
              <div>Dhaka, Bangladesh</div>
              <div>
                <a href="mailto:sales@joyautomart.com" className="hover:text-[#E11D48]">sales@joyautomart.com</a>
              </div>
              <div>
                <a href="https://www.joyautomart.com" target="_blank" rel="noreferrer" className="hover:text-[#E11D48]">www.joyautomart.com</a>
              </div>
            </div>
          </div>
          <div>
            <div className="overline mb-3">Portal</div>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><a href="/" className="hover:text-[#E11D48]">Sign in</a></li>
              <li><Link to="/inquire" className="hover:text-[#E11D48]">Inquire about kits</Link></li>
              <li><a href="https://www.joyautomart.com" target="_blank" rel="noreferrer" className="hover:text-[#E11D48]">Retail website</a></li>
            </ul>
          </div>
          <div>
            <div className="overline mb-3">Legal</div>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><Link to="/terms" className="hover:text-[#E11D48]" data-testid="footer-terms-link">Terms of Service</Link></li>
              <li><Link to="/privacy" className="hover:text-[#E11D48]" data-testid="footer-privacy-link">Privacy Policy</Link></li>
              <li><a href="mailto:support@joyautomart.com" className="hover:text-[#E11D48]">Contact support</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500">
            <div>© {new Date().getFullYear()} JOY Automart. All rights reserved.</div>
            <div>Made in Dhaka with grit and grease.</div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
