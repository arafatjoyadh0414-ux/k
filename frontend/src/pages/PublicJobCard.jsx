import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Wrench, Car, Phone, FileText, Loader2, ExternalLink } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const fmt = (n) => {
  try { return `৳ ${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`; } catch { return `৳ ${n}`; }
};

const PublicJobCard = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setError("Invalid link"); setLoading(false); return; }
    axios.get(`${API}/job-cards/public/${token}`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.detail || "Job card not found"))
      .finally(() => setLoading(false));
  }, [token]);

  const pdfUrl = `${API}/job-cards/public/${token}.pdf`;

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top brand strip */}
      <div className="bg-zinc-950 text-white border-b border-[#E11D48]/30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/" className="font-display text-lg tracking-tight">
            <span className="text-[#E11D48]">JOY</span> AUTOMART
          </a>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400">Service Estimate</div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        {loading ? (
          <div className="text-sm text-zinc-500 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-sm">{error}</div>
        ) : data ? (
          <>
            <div className="bg-white border border-zinc-200 rounded-sm p-6 sm:p-8 shadow-sm" data-testid="public-jc-card">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#E11D48] mb-1">Job Card · {data.status?.replace("_", " ")}</div>
                  <h1 className="font-display text-2xl sm:text-3xl tracking-tight text-zinc-900">{data.job_id}</h1>
                  <p className="text-xs text-zinc-500 mt-1">Issued {new Date(data.created_at).toLocaleDateString()}</p>
                </div>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="public-jc-pdf-link"
                  className="inline-flex items-center gap-2 bg-[#E11D48] hover:bg-[#BE123C] text-white px-4 py-2 rounded-sm text-sm font-semibold"
                >
                  <FileText className="w-4 h-4" /> Download PDF
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                <div className="bg-zinc-50 border border-zinc-200 rounded-sm p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Customer</div>
                  <div className="text-sm font-semibold text-zinc-900">{data.customer_name}</div>
                  {data.workshop?.contact_phone && (
                    <div className="text-xs text-zinc-500 mt-1 inline-flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {data.workshop.contact_phone}
                    </div>
                  )}
                </div>
                <div className="bg-zinc-50 border border-zinc-200 rounded-sm p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mb-1 inline-flex items-center gap-1"><Car className="w-3 h-3" /> Vehicle</div>
                  <div className="text-sm font-semibold text-zinc-900">{data.vehicle_brand} {data.vehicle_model}{data.vehicle_year ? ` · ${data.vehicle_year}` : ""}</div>
                  {(data.vehicle_plate || data.vin) && <div className="text-xs text-zinc-500 mt-1 font-mono">{data.vehicle_plate || data.vin}</div>}
                </div>
              </div>

              <div className="mb-6">
                <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Complaint</div>
                <p className="text-sm text-zinc-800">{data.complaint}</p>
                {data.mechanic_name && (
                  <div className="text-xs text-zinc-500 mt-2 inline-flex items-center gap-1.5">
                    <Wrench className="w-3 h-3" /> Assigned mechanic: <strong className="text-zinc-700">{data.mechanic_name}</strong>
                  </div>
                )}
              </div>

              {data.parts?.length > 0 ? (
                <>
                  <div className="font-display text-base text-zinc-900 mb-2">Required parts</div>
                  <table className="w-full text-sm mb-4">
                    <thead className="text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-200">
                      <tr>
                        <th className="text-left py-2 font-mono">SKU</th>
                        <th className="text-left py-2">Part</th>
                        <th className="text-right py-2">Qty</th>
                        <th className="text-right py-2">Unit</th>
                        <th className="text-right py-2">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {data.parts.map((p, i) => (
                        <tr key={i}>
                          <td className="py-2 font-mono text-xs text-zinc-600">{p.sku}</td>
                          <td className="py-2 text-zinc-900">{p.name}</td>
                          <td className="py-2 text-right">{p.quantity}</td>
                          <td className="py-2 text-right">{fmt(p.price_bdt)}</td>
                          <td className="py-2 text-right font-semibold">{fmt((p.price_bdt || 0) * (p.quantity || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <div className="text-sm text-zinc-500 mb-4">Parts list will be added as the diagnosis is completed.</div>
              )}

              <div className="border-t border-zinc-200 pt-3 space-y-1">
                {data.labour_charge_bdt ? (
                  <div className="flex justify-between text-sm text-zinc-700">
                    <span>Labour charge</span><span>{fmt(data.labour_charge_bdt)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-base font-display">
                  <span>Total</span><span className="text-[#E11D48]">{fmt(data.total_bdt)}</span>
                </div>
              </div>

              {data.notes && (
                <div className="mt-5 p-3 bg-amber-50 border border-amber-200 rounded-sm text-xs text-amber-900">
                  <strong>Notes:</strong> {data.notes}
                </div>
              )}
            </div>

            <div className="mt-5 text-xs text-zinc-500 text-center">
              Parts sourced via <a href="/" className="text-[#E11D48] font-semibold inline-flex items-center gap-1">JOY Automart <ExternalLink className="w-3 h-3" /></a> · Bangladesh's first AI-powered B2B auto parts platform
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default PublicJobCard;
