import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";

const LOGO = "https://customer-assets.emergentagent.com/job_458d530b-69c9-4d64-8b89-03923696b1c8/artifacts/gnewd2f2_IMG-20260209-WA0017.jpg";
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const fmtDate = (s) => {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return String(s).slice(0, 10);
  }
};

const PassportPublic = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API}/vin/passport/${token}`);
        setData(data);
      } catch (e) {
        setError(e?.response?.data?.detail || "Passport not found");
      }
    })();
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
        <div className="text-center">
          <div className="overline text-[#E11D48] mb-2">Passport unavailable</div>
          <h1 className="font-display text-2xl">{error}</h1>
          <Link to="/" className="text-sm text-slate-600 hover:text-[#E11D48] mt-4 inline-block">← Back to JOY Automart</Link>
        </div>
      </div>
    );
  }
  if (!data) {
    return <div className="min-h-screen grid place-items-center text-slate-500 text-sm">Loading passport…</div>;
  }

  const s = data.snapshot || {};
  const decoded = s.decoded || {};
  const stats = s.stats || {};
  const workshop = s.workshop || {};
  const timeline = s.timeline || [];
  const title = `${decoded.year || ""} ${decoded.make || ""} ${decoded.model || ""}`.trim() || data.vin;
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const waText = encodeURIComponent(`Vehicle Health Passport · ${title} · VIN ${data.vin}\n${shareUrl}`);

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3" data-testid="passport-home-link">
            <img src={LOGO} alt="JOY Automart" className="w-10 h-10 object-contain" />
            <div className="leading-tight">
              <div className="font-display text-base text-slate-900">JOY Automart</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Vehicle Health Passport</div>
            </div>
          </Link>
          <a
            href={`${API}/vin/passport/${token}.pdf`}
            target="_blank"
            rel="noreferrer"
            data-testid="passport-pdf-link"
            className="bg-slate-900 hover:bg-slate-700 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-full transition-colors"
          >
            Download PDF
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 sm:px-6 py-8 sm:py-12">
        <div className="overline text-[#E11D48] mb-2">Vehicle Health Passport</div>
        <h1 className="font-display text-3xl sm:text-4xl tracking-tight">{title}</h1>
        <div className="text-sm text-slate-500 mt-1">VIN · {data.vin}</div>

        {/* Verified-by banner */}
        <div className="mt-6 border border-slate-200 bg-slate-50 rounded-sm p-4 sm:p-5 flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-full bg-emerald-100 grid place-items-center">
            <svg className="w-5 h-5 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div className="text-sm leading-relaxed">
            Last serviced &amp; verified by <strong>{workshop.company_name}</strong>
            {workshop.kyc_approved && (
              <span className="ml-2 inline-block bg-amber-100 text-amber-800 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm">
                {(workshop.kyc_tier || "Verified").toString().charAt(0).toUpperCase() + (workshop.kyc_tier || "verified").toString().slice(1)} Tier · KYC
              </span>
            )}
            <div className="text-xs text-slate-500 mt-1">
              Generated {fmtDate(s.generated_at)} · Powered by JOY Automart B2B Platform
            </div>
          </div>
        </div>

        {/* Vehicle info */}
        <section className="mt-10">
          <div className="overline text-slate-500 mb-3">Vehicle</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-sm overflow-hidden">
            {[
              ["Make", decoded.make],
              ["Model", decoded.model],
              ["Year", decoded.year],
              ["Body", decoded.body_class],
              ["Engine", decoded.engine],
              ["Country", decoded.country],
              ["Fuel", decoded.fuel_type],
              ["Transmission", decoded.transmission],
            ].map(([k, v]) => (
              <div key={k} className="bg-white p-3 sm:p-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">{k}</div>
                <div className="font-semibold text-slate-900 text-sm mt-1 truncate">{v || "—"}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Stats */}
        <section className="mt-10">
          <div className="overline text-slate-500 mb-3">Maintenance Summary</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-sm overflow-hidden">
            {[
              ["Service orders", stats.order_count || 0],
              ["Lifetime spend", `৳ ${Number(stats.total_spend_bdt || 0).toLocaleString("en-IN")}`],
              ["Workshops", stats.workshop_count || 0],
              ["Photos on record", stats.photo_count || 0],
            ].map(([k, v]) => (
              <div key={k} className="bg-white p-4 sm:p-5">
                <div className="font-display text-xl sm:text-2xl text-slate-900">{v}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">{k}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Timeline */}
        <section className="mt-10">
          <div className="overline text-slate-500 mb-3">Service History</div>
          {timeline.length === 0 ? (
            <div className="text-sm text-slate-500 border border-dashed border-slate-200 p-6 text-center rounded-sm">
              No recorded service events yet.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-sm overflow-hidden">
              {timeline.map((ev, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 sm:gap-4 p-4 ${i !== timeline.length - 1 ? "border-b border-slate-100" : ""}`}
                  data-testid={`passport-event-${i}`}
                >
                  <div className="shrink-0 w-16 sm:w-20 text-[11px] uppercase tracking-wider text-slate-500 pt-0.5">
                    {fmtDate(ev.date)}
                  </div>
                  <div className="shrink-0 w-2 h-2 mt-1.5 rounded-full bg-[#E11D48]" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-slate-900">{ev.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">{ev.company_name}</div>
                    {ev.note && <div className="text-xs text-slate-600 mt-1 leading-relaxed">{ev.note}</div>}
                  </div>
                  <div className="shrink-0 text-[10px] uppercase tracking-wider text-slate-400 pt-0.5 hidden sm:block">
                    {ev.type}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Share row */}
        <section className="mt-12 border-t border-slate-200 pt-8 flex flex-wrap items-center gap-3">
          <a
            href={`https://wa.me/?text=${waText}`}
            target="_blank"
            rel="noreferrer"
            data-testid="passport-share-whatsapp"
            className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ca352] text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.683 5.526l-.999 3.648 3.805-.873z"/></svg>
            Share on WhatsApp
          </a>
          <a
            href={`${API}/vin/passport/${token}.pdf`}
            target="_blank"
            rel="noreferrer"
            data-testid="passport-download-pdf"
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-colors"
          >
            Download PDF
          </a>
          <button
            data-testid="passport-copy-link"
            onClick={() => { navigator.clipboard?.writeText(shareUrl); }}
            className="inline-flex items-center gap-2 border border-slate-300 hover:border-slate-900 text-slate-900 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors"
          >
            Copy link
          </button>
          <div className="text-xs text-slate-400 ml-auto">Authenticity verifiable at this URL</div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-6 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <div>© {new Date().getFullYear()} JOY Automart · Dhaka, Bangladesh</div>
          <a href="https://www.joyautomart.com" target="_blank" rel="noreferrer" className="hover:text-[#E11D48]">www.joyautomart.com</a>
        </div>
      </footer>
    </div>
  );
};

export default PassportPublic;
