import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "../components/Layout";
import api, { fmtBDT, statusColor, API } from "../lib/api";
import { ArrowLeft, FileText, Check, X } from "lucide-react";
import { toast } from "sonner";

const AdminWorkshopDetail = () => {
  const { id } = useParams();
  const [ws, setWs] = useState(null);
  const [creditLimit, setCreditLimit] = useState(0);
  const [remark, setRemark] = useState("");

  const load = async () => {
    const { data } = await api.get(`/admin/workshops/${id}`);
    setWs(data);
    setCreditLimit(data.credit_limit);
  };
  useEffect(() => { load(); }, [id]);

  const decide = async (decision) => {
    if (decision === "rejected" && !remark.trim()) {
      toast.error("Provide a rejection remark"); return;
    }
    try {
      await api.patch(`/admin/workshops/${id}/kyc`, { decision, remark });
      await load();
      toast.success(`KYC ${decision}`);
    } catch (e) { toast.error("Failed"); }
  };

  const setCredit = async () => {
    try {
      await api.patch(`/admin/workshops/${id}/credit`, { credit_limit: parseFloat(creditLimit) });
      await load();
      toast.success("Credit limit updated");
    } catch (e) { toast.error("Failed"); }
  };

  const docUrl = (path) => `${API}/files/${path}`;

  if (!ws) return <Layout><div className="overline">Loading…</div></Layout>;

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl">
        <Link to="/admin/workshops" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-[#E11D48]">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="overline">Workshop</div>
            <h1 className="font-display text-3xl mt-1">{ws.company_name || "Unnamed Workshop"}</h1>
            <div className="text-sm text-slate-500 mt-1">{ws.owner_name} · {ws.email}</div>
          </div>
          <span className={`text-xs px-3 py-1.5 border rounded-sm ${statusColor(ws.kyc_status)}`}>
            KYC: {ws.kyc_status?.replace("_", " ")}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="industrial-card p-5">
              <div className="overline mb-3">Company</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Info l="Trade License" v={ws.trade_license_no || "—"} />
                <Info l="Phone" v={ws.contact_phone || "—"} />
                <Info l="City" v={ws.city || "—"} />
                <Info l="Address" v={ws.address || "—"} />
              </div>
            </div>

            <div className="industrial-card p-5">
              <div className="overline mb-3">Documents</div>
              {ws.documents?.length === 0 ? (
                <div className="text-sm text-slate-500">No documents uploaded.</div>
              ) : (
                <div className="space-y-2">
                  {ws.documents?.map((d) => (
                    <a key={d.path} href={docUrl(d.path)} target="_blank" rel="noreferrer"
                       className="flex items-center gap-3 border border-slate-200 p-3 rounded-sm hover:border-[#E11D48] transition-colors duration-200" data-testid={`doc-${d.type}`}>
                      <FileText className="w-5 h-5 text-slate-500" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm">{d.type.replace("_", " ").toUpperCase()}</div>
                        <div className="text-xs text-slate-500 truncate">{d.filename}</div>
                      </div>
                      <span className="text-xs text-[#E11D48] font-semibold">View →</span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {ws.kyc_status === "pending" && (
              <div className="industrial-card p-5">
                <div className="overline mb-3">Review Decision</div>
                <textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={2}
                  data-testid="kyc-remark"
                  placeholder="Optional remark (required if rejecting)"
                  className="w-full border border-slate-200 p-2 text-sm rounded-sm" />
                <div className="flex gap-2 mt-3">
                  <button onClick={() => decide("approved")} data-testid="kyc-approve-button"
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-sm">
                    <Check className="w-4 h-4" /> Approve
                  </button>
                  <button onClick={() => decide("rejected")} data-testid="kyc-reject-button"
                    className="inline-flex items-center gap-2 bg-white border border-red-300 text-red-600 hover:bg-red-50 text-sm font-semibold px-4 py-2 rounded-sm">
                    <X className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            )}
            {ws.kyc_remark && (
              <div className="text-xs text-slate-600 italic">Last remark: "{ws.kyc_remark}"</div>
            )}
          </div>

          <div className="space-y-5">
            <div className="industrial-card p-5">
              <div className="overline mb-2">Credit</div>
              <div className="text-xs text-slate-500">Used</div>
              <div className="font-semibold mb-2">{fmtBDT(ws.credit_used)}</div>
              <div className="text-xs text-slate-500 mb-1">Set Limit (BDT)</div>
              <input type="number" min="0" value={creditLimit}
                data-testid="credit-limit-input"
                onChange={(e) => setCreditLimit(e.target.value)}
                className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm" />
              <button onClick={setCredit} data-testid="set-credit-button"
                className="mt-3 w-full bg-slate-900 hover:bg-[#E11D48] text-white text-sm font-semibold py-2 rounded-sm transition-colors duration-200">
                Update Limit
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

const Info = ({ l, v }) => (
  <div>
    <div className="overline">{l}</div>
    <div className="mt-1">{v}</div>
  </div>
);

export default AdminWorkshopDetail;
