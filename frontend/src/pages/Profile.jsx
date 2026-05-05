import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api, { statusColor } from "../lib/api";
import { Upload, FileCheck, FileX, Loader2 } from "lucide-react";
import { toast } from "sonner";

const DOC_TYPES = [
  { key: "trade_license", label: "Trade License", required: true },
  { key: "nid", label: "Owner NID (Front)", required: false },
  { key: "owner_photo", label: "Owner Photo", required: false },
];

const Profile = () => {
  const [ws, setWs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [form, setForm] = useState({
    company_name: "", contact_phone: "", address: "", city: "", trade_license_no: "",
  });

  const load = async () => {
    const { data } = await api.get("/workshop/me");
    setWs(data.workshop);
    if (data.workshop) {
      setForm({
        company_name: data.workshop.company_name || "",
        contact_phone: data.workshop.contact_phone || "",
        address: data.workshop.address || "",
        city: data.workshop.city || "",
        trade_license_no: data.workshop.trade_license_no || "",
      });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/workshop/profile", form);
      setWs(data);
      toast.success("Profile updated");
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };

  const upload = async (type, file) => {
    setUploading(type);
    try {
      const fd = new FormData();
      fd.append("doc_type", type);
      fd.append("file", file);
      await api.post("/workshop/kyc/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await load();
      toast.success("Document uploaded");
    } catch (e) { toast.error(e.response?.data?.detail || "Upload failed"); }
    finally { setUploading(null); }
  };

  const submitKyc = async () => {
    try {
      await api.post("/workshop/kyc/submit");
      await load();
      toast.success("KYC submitted for review");
    } catch (e) { toast.error(e.response?.data?.detail || "Submit failed"); }
  };

  if (loading) return <Layout><div className="overline">Loading…</div></Layout>;

  const hasDoc = (key) => ws?.documents?.find((d) => d.type === key);
  const profileComplete = form.company_name && form.contact_phone && form.address && form.trade_license_no;
  const canSubmit = profileComplete && hasDoc("trade_license") && (ws?.kyc_status === "not_submitted" || ws?.kyc_status === "rejected");

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="overline">Workshop</div>
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl leading-tight mt-1">Profile & KYC</h1>
          </div>
          <span className={`text-xs px-3 py-1.5 border rounded-sm ${statusColor(ws?.kyc_status)}`} data-testid="kyc-status-badge">
            KYC: {ws?.kyc_status?.replace("_", " ")}
          </span>
        </div>

        {ws?.kyc_status === "rejected" && ws?.kyc_remark && (
          <div className="border border-red-200 bg-red-50 p-3 rounded-sm text-sm">
            <div className="font-semibold text-red-700">Rejected:</div>
            <div className="text-red-700">{ws.kyc_remark}</div>
          </div>
        )}

        {/* Profile form */}
        <div className="industrial-card p-6">
          <div className="overline mb-4">Company Info</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Company Name *" testid="company-name" value={form.company_name} onChange={(v) => setForm({ ...form, company_name: v })} />
            <Field label="Trade License No. *" testid="trade-license-no" value={form.trade_license_no} onChange={(v) => setForm({ ...form, trade_license_no: v })} />
            <Field label="Contact Phone *" testid="contact-phone" value={form.contact_phone} onChange={(v) => setForm({ ...form, contact_phone: v })} />
            <Field label="City *" testid="city" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
            <Field label="Workshop Address *" testid="address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} multiline className="md:col-span-2" />
          </div>
          <div className="mt-5">
            <button
              data-testid="save-profile-button"
              disabled={saving} onClick={saveProfile}
              className="bg-slate-900 hover:bg-[#E11D48] text-white text-sm font-semibold px-5 py-2.5 rounded-sm transition-colors duration-200">
              {saving ? "Saving…" : "Save Profile"}
            </button>
          </div>
        </div>

        {/* Documents */}
        <div className="industrial-card p-6">
          <div className="overline mb-4">KYC Documents</div>
          <div className="space-y-3">
            {DOC_TYPES.map((d) => {
              const existing = hasDoc(d.key);
              return (
                <div key={d.key} className="flex items-center gap-4 border border-slate-200 p-4 rounded-sm">
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{d.label} {d.required && <span className="text-[#E11D48]">*</span>}</div>
                    <div className="text-xs text-slate-500 mt-0.5">PDF, JPG, PNG · max 10MB</div>
                    {existing && (
                      <div className="text-xs text-emerald-700 mt-1 flex items-center gap-1">
                        <FileCheck className="w-3.5 h-3.5" /> {existing.filename}
                      </div>
                    )}
                  </div>
                  <label className="cursor-pointer inline-flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-900 text-sm font-semibold px-4 py-2 rounded-sm transition-colors duration-200">
                    {uploading === d.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {existing ? "Replace" : "Upload"}
                    <input
                      type="file" className="hidden"
                      data-testid={`upload-${d.key}`}
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => { if (e.target.files?.[0]) upload(d.key, e.target.files[0]); }}
                    />
                  </label>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex flex-col md:flex-row md:items-center gap-3">
            <button
              data-testid="submit-kyc-button"
              disabled={!canSubmit} onClick={submitKyc}
              className="bg-[#E11D48] hover:bg-[#BE123C] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-sm transition-colors duration-200">
              Submit for Review
            </button>
            {!profileComplete && <div className="text-xs text-slate-500">Complete profile first</div>}
            {profileComplete && !hasDoc("trade_license") && <div className="text-xs text-slate-500">Trade license required</div>}
            {ws?.kyc_status === "pending" && <div className="text-xs text-blue-700">Pending admin review.</div>}
            {ws?.kyc_status === "approved" && <div className="text-xs text-emerald-700">Approved — you can place orders.</div>}
          </div>
        </div>
      </div>
    </Layout>
  );
};

const Field = ({ label, value, onChange, multiline, className = "", testid }) => (
  <div className={className}>
    <label className="overline block mb-1.5">{label}</label>
    {multiline ? (
      <textarea
        data-testid={testid}
        value={value} onChange={(e) => onChange(e.target.value)} rows={2}
        className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
      />
    ) : (
      <input
        data-testid={testid}
        type="text" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
      />
    )}
  </div>
);

export default Profile;
