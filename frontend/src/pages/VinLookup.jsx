import React, { useEffect, useState, useCallback } from "react";
import Layout from "../components/Layout";
import api, { fmtBDT } from "../lib/api";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { Search, Car, Sparkles, AlertCircle, Bookmark, Trash2, Plus, ExternalLink, Info, Camera, History, Image as ImageIcon, FileText, CheckCircle2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

const VehicleCard = ({ v }) => (
  <div className="industrial-card p-5 bg-slate-950 text-white" data-testid="vin-vehicle-card" style={{ backgroundColor: "#020617" }}>
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      <Car className="w-4 h-4 text-[#E11D48]" />
      <div className="overline" style={{ color: "#cbd5e1" }}>Decoded vehicle</div>
      {v.cached && <span className="text-[10px] uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded-sm">cached</span>}
      {Array.isArray(v.sources) && v.sources.map((s) => (
        <span key={s} className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm ${
          s === "nhtsa" ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30"
          : s === "wmi"  ? "bg-blue-500/20 text-blue-200 border border-blue-500/30"
          : s === "year_code" ? "bg-slate-500/20 text-slate-200 border border-slate-500/30"
          : "bg-amber-500/20 text-amber-200 border border-amber-500/30"}`}>
          {s === "nhtsa" ? "NHTSA" : s === "wmi" ? "WMI" : s === "year_code" ? "year-code" : "AI"}
        </span>
      ))}
    </div>
    <div className="font-display text-2xl leading-tight" data-testid="vin-vehicle-title">
      {v.year || "—"} {v.make || "Unknown make"} {v.model || ""}
    </div>
    {v.trim && <div className="text-sm text-slate-300 mt-0.5">{v.trim}</div>}
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-xs">
      {v.body_class && <Field label="Body" value={v.body_class} />}
      {v.engine_l && <Field label="Engine" value={`${parseFloat(v.engine_l).toFixed(1)}L${v.engine_cyl ? ` · ${v.engine_cyl} cyl` : ""}`} />}
      {v.fuel && <Field label="Fuel" value={v.fuel} />}
      {v.transmission && <Field label="Transmission" value={v.transmission} />}
      {v.drive_type && <Field label="Drive" value={v.drive_type} />}
      {(v.plant_country || v.wmi_country) && <Field label="Built in" value={v.plant_country || v.wmi_country} />}
      {v.manufacturer && <Field label="Manufacturer" value={v.manufacturer} />}
    </div>
    {v.ai_inferred && (
      <div className="mt-3 flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-sm p-2 text-[11px] text-amber-200" data-testid="vin-ai-inferred-warning">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>
          Some details (model/engine/body) were AI-inferred from the WMI prefix and year-code because the global
          NHTSA database had partial data for this market. Confidence: <b>{v.ai_confidence || "medium"}</b>. Verify with the vehicle's documents before ordering.
        </span>
      </div>
    )}
    {v.verified_by_company && (
      <div className="mt-3 flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-sm p-2 text-[11px] text-emerald-200">
        <span>✓</span>
        <span>Verified by <b>{v.verified_by_company}</b> · workshop-corrected data overrides automated decode for this VIN.</span>
      </div>
    )}
    <div className="text-[10px] text-slate-500 mt-3 font-mono">{v.vin}</div>
  </div>
);

const Field = ({ label, value }) => (
  <div className="bg-white/5 border border-white/10 rounded-sm px-2.5 py-2">
    <div className="text-[9px] uppercase tracking-[0.1em] text-slate-300">{label}</div>
    <div className="text-sm font-mono text-white mt-0.5">{value}</div>
  </div>
);

const CustomerCarCapture = ({ vin }) => {
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/vin/customer-photos", { params: { vin } });
      setPhotos(data || []);
    } catch (_) { /* ignore — endpoint requires auth */ }
  }, [vin]);
  useEffect(() => { load(); }, [load]);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Photo too large. Compress to under 3 MB and try again.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("vin", vin);
      fd.append("note", note);
      fd.append("photo", file);
      await api.post("/vin/customer-photo", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Customer car photo saved");
      setNote("");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const view = async (photoId) => {
    try {
      const { data } = await api.get(`/vin/customer-photos/${photoId}/data`);
      setPreviewUrl(data.data_url);
    } catch (_) {
      toast.error("Could not load photo");
    }
  };

  const remove = async (photoId) => {
    if (!window.confirm("Delete this customer car photo?")) return;
    try {
      await api.delete(`/vin/customer-photos/${photoId}`);
      await load();
    } catch (_) { toast.error("Delete failed"); }
  };

  return (
    <div className="mt-4 industrial-card p-4" data-testid="customer-car-capture">
      <div className="flex items-center justify-between">
        <div>
          <div className="overline">Customer's car · proof of service</div>
          <p className="text-xs text-slate-600 mt-1 max-w-md">
            Snap the actual customer vehicle to attach to this VIN. Helps with disputes
            and creates a service-history trail.
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <input
          data-testid="customer-photo-note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note (license plate, mileage, body damage...)"
          className="flex-1 border border-slate-200 px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
        />
        <label className={`inline-flex items-center justify-center gap-1.5 cursor-pointer text-sm font-bold px-4 py-2 rounded-sm transition ${
          uploading ? "bg-slate-300 text-slate-500" : "bg-[#E11D48] hover:bg-[#BE123C] text-white"
        }`} data-testid="capture-customer-car-btn">
          <Camera className="w-4 h-4" />
          {uploading ? "Uploading…" : "Take photo"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            disabled={uploading}
            onChange={onFile}
            className="hidden"
            data-testid="customer-photo-input"
          />
        </label>
      </div>
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          {photos.map((p) => (
            <div key={p.photo_id} className="relative group" data-testid={`customer-photo-${p.photo_id}`}>
              <button onClick={() => view(p.photo_id)}
                className="block aspect-[4/3] w-full bg-slate-100 border border-slate-200 rounded-sm overflow-hidden hover:border-[#E11D48] transition-colors text-left">
                <div className="w-full h-full grid place-items-center text-slate-400">
                  <Camera className="w-6 h-6" />
                </div>
              </button>
              <div className="text-[10px] text-slate-500 mt-1 truncate">
                {p.note || `${p.company_name} · ${(p.created_at || "").slice(0, 10)}`}
              </div>
              <button onClick={() => remove(p.photo_id)}
                className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded opacity-0 group-hover:opacity-100 transition"
                data-testid={`delete-customer-photo-${p.photo_id}`}>
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewUrl("")} data-testid="customer-photo-preview">
          <img src={previewUrl} alt="Customer car" className="max-h-full max-w-full rounded-sm" />
          <button className="absolute top-4 right-4 bg-white text-slate-900 px-3 py-1 rounded-sm text-sm font-bold">Close</button>
        </div>
      )}
    </div>
  );
};

const SuggestionRow = ({ s, onRequest }) => (
  <div className="border border-slate-200 rounded-sm p-3" data-testid={`vin-suggestion-${(s.category || s.name || "").replace(/\s+/g, "-").toLowerCase()}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="overline">{s.category || "Part"}</div>
        <div className="font-display text-sm mt-0.5">{s.name || "—"}</div>
        {s.oem_hint && (
          <div className="text-xs text-slate-600 mt-1">
            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded-sm text-[11px]">{s.oem_hint}</span>
          </div>
        )}
        {s.common_brands && (
          <div className="text-[11px] text-slate-500 mt-1">
            Cross-ref: {Array.isArray(s.common_brands) ? s.common_brands.join(" · ") : s.common_brands}
          </div>
        )}
        {s.notes && <div className="text-[11px] text-slate-500 italic mt-1">{s.notes}</div>}
      </div>
      <button onClick={() => onRequest(s)} data-testid={`request-quote-${(s.name || "").replace(/\s+/g, "-").toLowerCase()}`}
        className="flex-shrink-0 inline-flex items-center gap-1 bg-slate-900 hover:bg-[#E11D48] text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-sm transition-colors">
        <ExternalLink className="w-3 h-3" /> Request quote
      </button>
    </div>
  </div>
);

const TIMELINE_META = {
  photo: { icon: Camera, color: "bg-blue-500", label: "PHOTO" },
  saved: { icon: Bookmark, color: "bg-slate-700", label: "SAVED" },
  correction: { icon: CheckCircle2, color: "bg-emerald-600", label: "VERIFIED" },
  part_request: { icon: FileText, color: "bg-amber-500", label: "PART REQUEST" },
};

const fmtDateTime = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch (_) { return iso.slice(0, 10); }
};

const ServiceHistory = ({ history, vin }) => {
  const [photoPreview, setPhotoPreview] = useState("");
  const openPhoto = async (photoId) => {
    try {
      const { data } = await api.get(`/vin/customer-photos/${photoId}/data`);
      setPhotoPreview(data.data_url);
    } catch (_) { /* ignore */ }
  };
  const s = history.stats || {};
  return (
    <section data-testid="vin-service-history">
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-[#E11D48]" />
        <div className="font-display text-lg">Service history for this VIN</div>
        <span className="text-xs bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-sm">
          {s.event_count} event{s.event_count === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <Stat label="Total events" value={s.event_count || 0} />
        <Stat label="Photos on file" value={s.photo_count || 0} />
        <Stat label="Workshops" value={s.workshop_count || 0} />
        <Stat label="First seen" value={s.first_seen ? fmtDateTime(s.first_seen) : "—"} small />
      </div>

      <div className="industrial-card p-0 overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {history.timeline.map((t, i) => {
            const meta = TIMELINE_META[t.type] || { icon: Info, color: "bg-slate-500", label: t.type };
            const Icon = meta.icon;
            return (
              <li key={i} className="flex items-start gap-3 p-3 hover:bg-slate-50 transition-colors" data-testid={`timeline-event-${i}`}>
                <div className={`w-8 h-8 rounded-full ${meta.color} text-white grid place-items-center flex-shrink-0`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{meta.label}</span>
                    <span className="text-[10px] text-slate-400">·</span>
                    <span className="text-[10px] text-slate-500 font-mono">{fmtDateTime(t.date)}</span>
                  </div>
                  <div className="font-display text-sm mt-0.5">{t.title}</div>
                  {t.note && <div className="text-xs text-slate-600 mt-0.5">{t.note}</div>}
                  <div className="text-[11px] text-slate-500 mt-0.5">by <b>{t.company_name}</b></div>
                </div>
                {t.type === "photo" && t.photo_id && (
                  <button onClick={() => openPhoto(t.photo_id)} data-testid={`view-photo-${i}`}
                    className="text-[11px] text-[#E11D48] hover:underline self-center font-semibold">View →</button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {photoPreview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPhotoPreview("")}>
          <img src={photoPreview} alt="" className="max-h-full max-w-full rounded-sm" />
          <button className="absolute top-4 right-4 bg-white text-slate-900 px-3 py-1 rounded-sm text-sm font-bold">Close</button>
        </div>
      )}
    </section>
  );
};

const Stat = ({ label, value, small = false }) => (
  <div className="industrial-card p-3">
    <div className="overline">{label}</div>
    <div className={`font-display ${small ? "text-sm" : "text-xl"} mt-1`}>{value}</div>
  </div>
);

const CorrectVinModal = ({ vehicle, onClose, onSaved }) => {
  const [form, setForm] = useState({
    make: vehicle.make || "",
    model: vehicle.model || "",
    year: vehicle.year || "",
    body_class: vehicle.body_class || "",
    engine_l: vehicle.engine_l || "",
    fuel: vehicle.fuel || "",
    transmission: vehicle.transmission || "",
    drive_type: vehicle.drive_type || "",
    trim: vehicle.trim || "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api.post("/vin/correct", {
        vin: vehicle.vin,
        ...form,
        year: form.year ? parseInt(form.year) : null,
      });
      toast.success("Thanks — your correction is now the source of truth for this VIN");
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const F = ({ k, label, type = "text" }) => (
    <label className="block">
      <div className="overline mb-1">{label}</div>
      <input type={type} value={form[k]} onChange={(e) => setForm((s) => ({ ...s, [k]: e.target.value }))}
        data-testid={`correct-${k}`}
        className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]" />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose} data-testid="correct-vin-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white max-w-2xl w-full rounded-sm shadow-xl my-8">
        <div className="border-b border-slate-200 p-4 sticky top-0 bg-white">
          <div className="font-display text-lg">Correct this VIN</div>
          <p className="text-xs text-slate-600 mt-1">
            Your correction becomes the authoritative answer for <span className="font-mono">{vehicle.vin}</span>
            {" "}— every workshop on JOY Automart benefits from your verified data.
          </p>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <F k="make" label="Make (e.g. Mercedes-Benz)" />
          <F k="model" label="Model (e.g. S 500 Hybrid)" />
          <F k="year" label="Year" type="number" />
          <F k="body_class" label="Body (Sedan / SUV / …)" />
          <F k="engine_l" label="Engine (L)" />
          <F k="fuel" label="Fuel (Hybrid / Gasoline / Diesel)" />
          <F k="transmission" label="Transmission" />
          <F k="drive_type" label="Drive (RWD / 4WD / AWD)" />
          <div className="sm:col-span-2"><F k="trim" label="Trim / variant (optional)" /></div>
        </div>
        <div className="border-t border-slate-200 p-4 flex gap-2 justify-end sticky bottom-0 bg-white">
          <button onClick={onClose} className="text-sm text-slate-600 hover:text-slate-900 px-3 py-2">Cancel</button>
          <button onClick={submit} disabled={saving} data-testid="submit-correction"
            className="bg-[#E11D48] hover:bg-[#BE123C] disabled:bg-slate-200 text-white text-sm font-bold px-5 py-2 rounded-sm">
            {saving ? "Saving…" : "Save correction"}
          </button>
        </div>
      </div>
    </div>
  );
};

const BatchPartRequest = ({ vehicle, parts, onUpdate, onRemove, onAdd, onSubmit, submitting }) => {
  const v = vehicle || {};
  return (
    <section className="industrial-card p-5" data-testid="vin-batch-part-request">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="overline">Request parts for this VIN</div>
          <div className="font-display text-lg mt-1 leading-tight">
            Get supplier quotes — sourced + tagged with this car
          </div>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Add the parts you need. Our sourcing team gets the full vehicle context
            (year/make/model/engine + VIN) so quotes come back accurate the first time.
          </p>
        </div>
        <button
          onClick={onAdd}
          data-testid="batch-add-blank-part"
          className="inline-flex items-center gap-1 bg-slate-900 hover:bg-[#E11D48] text-white text-xs font-bold px-3 py-2 rounded-sm transition flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Add part
        </button>
      </div>
      {parts.length === 0 ? (
        <div className="mt-4 text-center text-sm text-slate-500 border border-dashed border-slate-300 rounded-sm py-6 px-4" data-testid="batch-empty">
          No parts added yet. Tap <span className="font-bold text-slate-700">Add part</span> above, or
          tap <span className="font-bold text-slate-700">Request quote</span> on any AI suggestion to add it here.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {parts.map((p, i) => (
            <div key={i} className="border border-slate-200 rounded-sm p-3 bg-slate-50/50" data-testid={`batch-part-${i}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="overline">Part {i + 1}</div>
                <button onClick={() => onRemove(i)} data-testid={`batch-remove-${i}`}
                  className="text-red-500 hover:text-red-700 p-1">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                <input
                  data-testid={`batch-part-name-${i}`}
                  className="md:col-span-5 border border-slate-200 px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
                  placeholder="Part name * (e.g. Front brake pads)"
                  value={p.part_name}
                  onChange={(e) => onUpdate(i, "part_name", e.target.value)}
                />
                <input
                  data-testid={`batch-part-number-${i}`}
                  className="md:col-span-3 border border-slate-200 px-3 py-2 text-sm rounded-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
                  placeholder="OEM/cross-ref #"
                  value={p.part_number}
                  onChange={(e) => onUpdate(i, "part_number", e.target.value)}
                />
                <input
                  data-testid={`batch-part-qty-${i}`}
                  type="number"
                  min={1}
                  className="md:col-span-2 border border-slate-200 px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
                  placeholder="Qty"
                  value={p.quantity}
                  onChange={(e) => onUpdate(i, "quantity", parseInt(e.target.value) || 1)}
                />
                <select
                  data-testid={`batch-part-urgency-${i}`}
                  value={p.urgency || "normal"}
                  onChange={(e) => onUpdate(i, "urgency", e.target.value)}
                  className="md:col-span-2 border border-slate-200 px-3 py-2 text-sm rounded-sm bg-white"
                >
                  <option value="low">Low priority</option>
                  <option value="normal">Normal</option>
                  <option value="high">Urgent</option>
                </select>
                <input
                  data-testid={`batch-part-notes-${i}`}
                  className="md:col-span-12 border border-slate-200 px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
                  placeholder="Notes (optional) — symptoms, brand preference, etc."
                  value={p.notes}
                  onChange={(e) => onUpdate(i, "notes", e.target.value)}
                />
              </div>
            </div>
          ))}
          <div className="flex items-start justify-between gap-3 pt-2 flex-wrap">
            <div className="text-[11px] text-slate-500 max-w-md">
              Sourcing team will see: <b>{v.year} {v.make} {v.model}</b>
              {v.engine_l ? ` · ${parseFloat(v.engine_l).toFixed(1)}L` : ""}
              {v.fuel ? ` · ${v.fuel}` : ""} · VIN <span className="font-mono">{v.vin}</span>
            </div>
            <button
              onClick={onSubmit}
              disabled={submitting || parts.filter((p) => p.part_name?.trim()).length === 0}
              data-testid="batch-submit"
              className="bg-[#E11D48] hover:bg-[#BE123C] disabled:bg-slate-200 disabled:text-slate-500 text-white text-sm font-bold px-5 py-2.5 rounded-sm transition flex-shrink-0"
            >
              {submitting ? "Submitting…" : `Submit ${parts.filter((p) => p.part_name?.trim()).length} request${parts.filter((p) => p.part_name?.trim()).length === 1 ? "" : "s"} →`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

const VinLookup = () => {
  const [vinInput, setVinInput] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savedVins, setSavedVins] = useState([]);
  const [includeAi, setIncludeAi] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [showCorrect, setShowCorrect] = useState(false);
  const [history, setHistory] = useState(null);
  const [batchParts, setBatchParts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const { add } = useCart();

  const loadSaved = async () => {
    try {
      const { data } = await api.get("/vin/saved");
      setSavedVins(data || []);
    } catch (_) { /* not logged in */ }
  };
  useEffect(() => { loadSaved(); }, []);

  const isValid = VIN_RE.test(vinInput.toUpperCase());

  const lookup = async (vinOverride) => {
    const vin = (vinOverride || vinInput).toUpperCase().trim();
    if (!VIN_RE.test(vin)) {
      toast.error("VIN must be 17 chars (A-Z minus I/O/Q, 0-9)");
      return;
    }
    setLoading(true);
    setResult(null);
    setPhotos([]);
    setHistory(null);
    setBatchParts([]);
    try {
      const { data } = await api.get("/vin/parts", {
        params: { vin, include_ai: includeAi },
      });
      setResult(data);
      setVinInput(vin);
      // Fire-and-forget photo gallery — never blocks the main flow
      const v = data?.vehicle || {};
      if (v.make) {
        api.get("/vin/photos", { params: { make: v.make, model: v.model || "", year: v.year || "" } })
          .then(({ data: pd }) => setPhotos(pd?.photos || []))
          .catch(() => {});
      }
      // Fire-and-forget service history
      if (v.vin) {
        api.get("/vin/history", { params: { vin: v.vin } })
          .then(({ data: h }) => setHistory(h))
          .catch(() => setHistory(null));
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  const saveVin = async () => {
    if (!result?.vehicle?.vin) return;
    try {
      await api.post("/vin/saved", { vin: result.vehicle.vin });
      toast.success("VIN saved");
      await loadSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Save failed");
    }
  };

  const removeSaved = async (id) => {
    try {
      await api.delete(`/vin/saved/${id}`);
      await loadSaved();
    } catch (_) {}
  };

  const requestQuote = (suggestion) => {
    // Single suggestion → add to batch panel rather than navigating away
    const v = result?.vehicle || {};
    const part = {
      part_name: suggestion.name || suggestion.category || "Part",
      part_number: suggestion.oem_hint || "",
      quantity: 1,
      notes: suggestion.common_brands ? `Cross-ref: ${Array.isArray(suggestion.common_brands) ? suggestion.common_brands.join(", ") : suggestion.common_brands}` : "",
    };
    setBatchParts((prev) => [...prev, part]);
    toast.success(`Added "${part.part_name}" — scroll down to submit batch`);
    void v; // suppress unused-warn
  };

  const addToCart = (p, qty = 1) => {
    const itemForCart = { ...p, price_bdt: p.your_price_bdt || p.price_bdt };
    add(itemForCart, Math.max(qty, p.moq || 1));
    toast.success(`Added ${p.name}`);
  };

  const submitBatchParts = async () => {
    if (batchParts.length === 0 || !result?.vehicle?.vin) return;
    setSubmitting(true);
    try {
      const { data } = await api.post("/part-requests/vin-batch", {
        vin: result.vehicle.vin,
        vehicle: result.vehicle,
        parts: batchParts.filter((p) => (p.part_name || "").trim()),
        urgency: "normal",
      });
      toast.success(`Submitted ${data.count} part request${data.count === 1 ? "" : "s"} for ${result.vehicle.vin}`);
      setBatchParts([]);
      api.get("/vin/history", { params: { vin: result.vehicle.vin } })
        .then(({ data: h }) => setHistory(h)).catch(() => {});
    } catch (e) {
      toast.error(e.response?.data?.detail || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const updateBatchPart = (i, key, val) => {
    setBatchParts((prev) => prev.map((p, idx) => idx === i ? { ...p, [key]: val } : p));
  };
  const removeBatchPart = (i) => {
    setBatchParts((prev) => prev.filter((_, idx) => idx !== i));
  };
  const addBlankPart = () => {
    setBatchParts((prev) => [...prev, { part_name: "", part_number: "", quantity: 1, notes: "" }]);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <div className="overline">VIN Lookup · Find Parts</div>
          <h1 className="font-display text-3xl lg:text-4xl mt-1" data-testid="vin-page-title">
            Type a VIN. Get parts.
          </h1>
          <p className="text-sm text-slate-600 mt-2 max-w-2xl">
            Decode any vehicle's VIN through the global NHTSA database. We match in-stock JOY parts
            and use AI to suggest cross-reference part numbers for everything else — with a one-tap
            request to our sourcing team for unstocked items.
          </p>
        </div>

        <div className="industrial-card p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                data-testid="vin-input"
                type="text"
                value={vinInput}
                onChange={(e) => setVinInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter" && isValid) lookup(); }}
                placeholder="Enter 17-character VIN (e.g. JTJBM7FX2D5044123)"
                className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48] font-mono text-sm uppercase"
                maxLength={17}
              />
              <div className={`mt-1.5 text-[11px] ${isValid ? "text-emerald-600" : "text-slate-500"}`}>
                {vinInput.length === 0 ? "VINs are stamped on the dashboard or driver-side door jamb · 17 chars" :
                 isValid ? "✓ Valid VIN format" :
                 `${vinInput.length}/17 chars · ${17 - vinInput.length} more to go`}
              </div>
            </div>
            <button
              onClick={() => lookup()}
              disabled={!isValid || loading}
              data-testid="vin-lookup-btn"
              className="bg-[#E11D48] hover:bg-[#BE123C] disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-bold px-6 py-3 rounded-sm transition self-start"
            >
              {loading ? "Decoding…" : "Lookup parts →"}
            </button>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-slate-600 mt-3 cursor-pointer">
            <input type="checkbox" checked={includeAi} onChange={(e) => setIncludeAi(e.target.checked)} data-testid="vin-include-ai" />
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Include AI part suggestions (slower, ~5s)
          </label>
        </div>

        {savedVins.length > 0 && (
          <div className="industrial-card p-4">
            <div className="overline mb-2 flex items-center gap-1"><Bookmark className="w-3 h-3" /> Saved VINs</div>
            <div className="flex flex-wrap gap-2">
              {savedVins.map((s) => (
                <div key={s.saved_id} className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-sm pl-3 pr-1 py-1" data-testid={`saved-vin-${s.saved_id}`}>
                  <button onClick={() => lookup(s.vin)} className="text-xs hover:text-[#E11D48]">
                    <span className="font-mono text-[11px]">{s.vin.slice(-6)}</span>
                    <span className="ml-2 text-slate-600">{s.label}</span>
                  </button>
                  <button onClick={() => removeSaved(s.saved_id)} className="p-1 text-slate-400 hover:text-red-500" data-testid={`remove-saved-${s.saved_id}`}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="industrial-card p-6 text-center text-slate-500 text-sm">Decoding VIN…</div>
        )}

        {result && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <VehicleCard v={result.vehicle} />
                {photos.length > 0 ? (
                  <div className="mt-3" data-testid="vin-photo-gallery">
                    <div className="overline mb-2 flex items-center justify-between">
                      <span>Reference photo</span>
                      <span className={`text-[10px] normal-case px-2 py-0.5 rounded-sm ${
                        photos[0].source === "google"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-blue-50 text-blue-700 border border-blue-200"
                      }`}>
                        {photos[0].source === "google" ? "✓ Year-specific" : "Wikipedia · model generation"}
                      </span>
                    </div>
                    <a href={photos[0].page_url} target="_blank" rel="noopener noreferrer"
                      data-testid="vin-photo-0"
                      className="block aspect-[16/9] overflow-hidden rounded-sm border border-slate-200 bg-slate-50 relative group">
                      <img src={photos[0].url} alt={photos[0].title} loading="lazy"
                        className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-xs text-white">
                        {photos[0].title}
                      </div>
                    </a>
                  </div>
                ) : null}
                {/* Customer's car proof-of-service capture */}
                {result?.vehicle?.vin && (
                  <CustomerCarCapture vin={result.vehicle.vin} />
                )}
              </div>
              <div className="industrial-card p-5">
                <div className="overline">Action</div>
                <div className="text-sm mt-2">
                  Save this VIN for one-tap reorders next time the same vehicle comes in.
                </div>
                <button onClick={saveVin} data-testid="save-vin-btn"
                  className="mt-3 inline-flex items-center gap-1.5 bg-slate-900 hover:bg-[#E11D48] text-white text-xs font-semibold px-4 py-2 rounded-sm transition">
                  <Bookmark className="w-3.5 h-3.5" /> Save VIN
                </button>
                <button onClick={() => setShowCorrect(true)} data-testid="correct-vin-btn"
                  className="mt-2 ml-2 inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-4 py-2 rounded-sm transition">
                  Not right? Correct it →
                </button>
                <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
                  Your correction overrides the automated decode for this VIN — every workshop on
                  the network sees your verified data on subsequent lookups.
                </p>
              </div>
            </div>

            {/* Matched JOY products */}
            <section data-testid="vin-matched-section">
              <div className="flex items-center gap-2 mb-3">
                <Car className="w-4 h-4 text-emerald-600" />
                <div className="font-display text-lg">In stock at Joy Automart</div>
                <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-sm">
                  {result.in_stock_count} match{result.in_stock_count === 1 ? "" : "es"}
                </span>
              </div>
              {result.matched_products?.length === 0 ? (
                <div className="industrial-card p-6 text-center" data-testid="vin-no-matches">
                  <div className="text-sm text-slate-600">No exact catalog matches for this vehicle yet.</div>
                  <p className="text-xs text-slate-500 mt-1">Check the AI suggestions below — every item can be requested from our sourcing team.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {result.matched_products.map((p) => (
                    <div key={p.product_id} className="industrial-card overflow-hidden flex flex-col" data-testid={`vin-match-${p.sku}`}>
                      <Link to={`/products/${p.product_id}`} className="aspect-[4/3] bg-slate-100 border-b border-slate-200">
                        {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />}
                      </Link>
                      <div className="p-3 flex-1 flex flex-col">
                        <div className="overline">{p.category}</div>
                        <Link to={`/products/${p.product_id}`} className="font-display text-sm mt-0.5 hover:text-[#E11D48] leading-tight">{p.name}</Link>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">{p.sku}</div>
                        <div className="mt-auto pt-3 flex items-end justify-between">
                          <div>
                            <div className="font-display text-base">{fmtBDT(p.your_price_bdt || p.price_bdt)}</div>
                            <div className="text-[10px] text-slate-500">MOQ: {p.moq}</div>
                          </div>
                          <button onClick={() => addToCart(p, p.moq)} data-testid={`vin-add-${p.sku}`}
                            className="inline-flex items-center gap-1 bg-slate-900 hover:bg-[#E11D48] text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-sm transition">
                            <Plus className="w-3 h-3" /> Add
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* AI suggestions */}
            {result.ai_suggestions?.length > 0 && (
              <section data-testid="vin-ai-section">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <div className="font-display text-lg">AI part suggestions</div>
                  <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-sm">
                    {result.ai_suggestions.length} parts
                  </span>
                </div>
                <div className="industrial-card p-3 bg-amber-50/40 border-amber-200 mb-3 flex items-start gap-2 text-xs text-amber-900">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>OEM numbers and brands below are <b>AI-generated cross-references</b>, not from a verified parts database. Always confirm with the vehicle's actual service manual or your supplier before ordering.</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {result.ai_suggestions.map((s, i) => (
                    <SuggestionRow key={i} s={s} onRequest={requestQuote} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
        {result && (
          <BatchPartRequest
            vehicle={result.vehicle}
            parts={batchParts}
            onUpdate={updateBatchPart}
            onRemove={removeBatchPart}
            onAdd={addBlankPart}
            onSubmit={submitBatchParts}
            submitting={submitting}
          />
        )}
        {result && history && history.timeline?.length > 0 && (
          <ServiceHistory history={history} vin={result.vehicle.vin} />
        )}
        {showCorrect && result?.vehicle && (
          <CorrectVinModal vehicle={result.vehicle} onClose={() => setShowCorrect(false)} onSaved={() => { setShowCorrect(false); lookup(result.vehicle.vin); }} />
        )}
      </div>
    </Layout>
  );
};

export default VinLookup;
