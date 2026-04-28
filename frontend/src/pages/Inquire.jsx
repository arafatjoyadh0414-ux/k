import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import api, { fmtBDT } from "../lib/api";
import { CheckCircle2, ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";

const LOGO = "https://customer-assets.emergentagent.com/job_458d530b-69c9-4d64-8b89-03923696b1c8/artifacts/gnewd2f2_IMG-20260209-WA0017.jpg";

const Inquire = () => {
  const { sku: paramSku } = useParams();
  const [search] = useSearchParams();
  const initialSku = paramSku || search.get("kit") || "";
  const [kits, setKits] = useState([]);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", city: "",
    car_make_model: "", kit_sku: initialSku, message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/kits");
      setKits(data || []);
      if (!form.kit_sku && data?.length) setForm((f) => ({ ...f, kit_sku: data[0].sku }));
    })();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.car_make_model.trim() || !form.kit_sku) {
      toast.error("Please fill in name, phone, car, and pick a kit"); return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post("/inquiries", form);
      setSubmitted(data.inquiry_id);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to submit");
    } finally { setSubmitting(false); }
  };

  const selectedKit = kits.find((k) => k.sku === form.kit_sku);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={LOGO} alt="Joy Automart" className="w-9 h-9 object-contain" />
            <div>
              <div className="font-display text-lg leading-none">Joy Automart</div>
              <div className="overline mt-1">Schedule Install</div>
            </div>
          </Link>
          <Link to="/" className="text-sm text-slate-600 hover:text-[#E11D48] flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {submitted ? (
          <div className="industrial-card p-10 text-center max-w-xl mx-auto">
            <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-600" />
            <div className="font-display text-3xl mt-4">We've got your inquiry</div>
            <div className="text-sm text-slate-600 mt-2">Our team will call you within 24 hours to schedule your install.</div>
            <div className="mt-4 text-xs font-mono text-slate-500">Reference: {submitted}</div>
            <Link to="/" className="inline-block mt-6 bg-slate-900 text-white px-5 py-2.5 rounded-sm font-semibold hover:bg-[#E11D48] transition-colors duration-200">
              Back to home
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3 space-y-2">
              <div className="overline">For Retail Customers</div>
              <h1 className="font-display text-4xl lg:text-5xl tracking-tight leading-[1.05]">
                Schedule your <span className="text-[#E11D48]">transformation</span>.
              </h1>
              <p className="text-slate-600 mt-3 max-w-lg">
                Tell us your car and which kit you want — we'll match you to a JOY-certified workshop and schedule the 48-hour install.
              </p>

              <form onSubmit={submit} className="mt-8 space-y-4" data-testid="inquire-form">
                <Field label="Your Name *" testid="inq-name" v={form.name} on={(v) => setForm({ ...form, name: v })} />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Phone *" testid="inq-phone" v={form.phone} on={(v) => setForm({ ...form, phone: v })} placeholder="+8801..." />
                  <Field label="Email" testid="inq-email" v={form.email} on={(v) => setForm({ ...form, email: v })} type="email" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Car Make & Model *" testid="inq-car" v={form.car_make_model} on={(v) => setForm({ ...form, car_make_model: v })} placeholder="e.g. BYD Sealion 6 2025" />
                  <Field label="City" testid="inq-city" v={form.city} on={(v) => setForm({ ...form, city: v })} placeholder="Dhaka" />
                </div>
                <div>
                  <label className="overline block mb-1.5">Choose Kit *</label>
                  <select
                    data-testid="inq-kit"
                    value={form.kit_sku}
                    onChange={(e) => setForm({ ...form, kit_sku: e.target.value })}
                    className="w-full border border-slate-200 px-3 py-2.5 text-sm rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
                  >
                    {kits.map((k) => (
                      <option key={k.sku} value={k.sku}>{k.name} · {fmtBDT(k.price_bdt)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="overline block mb-1.5">Message (optional)</label>
                  <textarea
                    data-testid="inq-msg"
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    rows={3}
                    placeholder="Color preference, timeline, special requests…"
                    className="w-full border border-slate-200 px-3 py-2.5 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  data-testid="submit-inquiry-button"
                  className="w-full bg-[#E11D48] hover:bg-[#BE123C] disabled:bg-slate-300 text-white font-semibold py-3 rounded-sm transition-colors duration-200 inline-flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {submitting ? "Submitting…" : "Schedule My Install"}
                </button>
                <p className="text-xs text-slate-500 text-center">No payment now. Our team will call within 24 hours.</p>
              </form>
            </div>

            {selectedKit && (
              <div className="lg:col-span-2 lg:sticky lg:top-6 self-start">
                <div className="industrial-card overflow-hidden">
                  <div className="aspect-[4/3] bg-slate-950">
                    <img src={selectedKit.image_url} alt={selectedKit.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-5">
                    <div className="overline">{selectedKit.brand}</div>
                    <div className="font-display text-xl mt-1">{selectedKit.name}</div>
                    <p className="text-sm text-slate-600 mt-2">{selectedKit.description}</p>
                    <div className="mt-4">
                      <div className="overline">From</div>
                      <div className="font-display text-2xl">{fmtBDT(selectedKit.price_bdt)}</div>
                      <div className="text-xs text-slate-500 mt-0.5">+ ৳50k–1L install</div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <div className="overline mb-2">Includes</div>
                      <ul className="space-y-1 text-xs text-slate-700">
                        {selectedKit.kit_features?.slice(0, 5).map((f) => <li key={f}>· {f}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, v, on, type = "text", placeholder, testid }) => (
  <div>
    <label className="overline block mb-1.5">{label}</label>
    <input
      data-testid={testid}
      type={type}
      value={v}
      onChange={(e) => on(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-slate-200 px-3 py-2.5 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
    />
  </div>
);

export default Inquire;
