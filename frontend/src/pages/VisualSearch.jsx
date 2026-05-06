import React, { useState, useRef } from "react";
import { toast } from "sonner";
import Layout from "../components/Layout";
import api, { fmtBDT } from "../lib/api";
import { useCart } from "../context/CartContext";
import { Camera, Upload, Sparkles, Plus, X, Loader2, Image as ImgIcon } from "lucide-react";

const VisualSearch = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);
  const camRef = useRef(null);
  const { addItem } = useCart();

  const onSelect = (f) => {
    if (!f) return;
    if (f.size > 6 * 1024 * 1024) {
      toast.error("Image too large (max 6 MB)");
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(f);
    setResult(null);
  };

  const submit = async () => {
    if (!file) {
      toast.error("Please select a photo first");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      if (hint.trim()) fd.append("hint", hint.trim());
      const r = await api.post("/visual-search", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(r.data);
      toast.success(`Identified: ${r.data.identification?.part_name || "result"}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Visual search failed");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview("");
    setResult(null);
    setHint("");
  };

  return (
    <Layout>
      <div className="max-w-5xl">
        <div className="mb-6">
          <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400 mb-1">AI Visual Tools</div>
          <h1 className="text-2xl sm:text-3xl font-display tracking-tight text-zinc-900 dark:text-white inline-flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#E11D48]" /> Visual Parts Search
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">Snap a photo of a broken or worn part — Claude Sonnet 4.5 vision identifies it and matches against your tier-priced catalog.</p>
        </div>

        {!result ? (
          <div className="industrial-card border border-zinc-200 dark:border-white/10 rounded-sm p-5 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Part photo</div>
                {preview ? (
                  <div className="relative">
                    <img src={preview} alt="preview" className="w-full max-h-[420px] object-contain bg-zinc-50 dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-white/10" />
                    <button onClick={reset} className="absolute top-2 right-2 bg-black/70 text-white p-1.5 rounded-full" data-testid="vs-clear">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-zinc-300 dark:border-white/15 rounded-sm aspect-[4/3] grid place-items-center">
                    <div className="text-center px-4">
                      <ImgIcon className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">Upload a photo, or take one with your camera</div>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    data-testid="vs-camera-btn"
                    onClick={() => camRef.current?.click()}
                    className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-[#E11D48] text-white px-4 py-2 rounded-sm text-sm font-semibold"
                  >
                    <Camera className="w-4 h-4" /> Take photo
                  </button>
                  <button
                    data-testid="vs-upload-btn"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-2 border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:border-[#E11D48] hover:text-[#E11D48] px-4 py-2 rounded-sm text-sm font-semibold transition-colors"
                  >
                    <Upload className="w-4 h-4" /> Upload from device
                  </button>
                  <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onSelect(e.target.files?.[0])} />
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden" onChange={(e) => onSelect(e.target.files?.[0])} />
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Optional hint</div>
                <textarea
                  data-testid="vs-hint"
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  rows={3}
                  placeholder="e.g. Toyota Axio 2018, front passenger side, makes grinding noise"
                  className="w-full px-4 py-2.5 text-sm border border-zinc-200 dark:border-white/10 rounded-sm bg-white dark:bg-zinc-900 outline-none focus:border-[#E11D48] resize-none"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">Tip: include vehicle make/model/year + symptom for better matches.</p>
                <button
                  data-testid="vs-submit"
                  onClick={submit}
                  disabled={!file || loading}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-[#E11D48] hover:bg-[#BE123C] text-white px-5 py-3 rounded-sm text-sm font-semibold disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {loading ? "Analysing image…" : "Identify part"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <ResultPanel result={result} preview={preview} addItem={addItem} reset={reset} />
        )}
      </div>
    </Layout>
  );
};

const ResultPanel = ({ result, preview, addItem, reset }) => {
  const id = result.identification || {};
  return (
    <div className="space-y-5">
      <div className="industrial-card border border-zinc-200 dark:border-white/10 rounded-sm p-5 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          <div className="md:col-span-4">
            <img src={preview} alt="" className="w-full rounded-sm border border-zinc-200 dark:border-white/10 max-h-72 object-contain bg-zinc-50 dark:bg-zinc-900" />
          </div>
          <div className="md:col-span-8">
            <div className="font-mono text-[11px] uppercase tracking-wider text-[#E11D48] mb-1">Identification</div>
            <h2 className="font-display text-xl sm:text-2xl text-zinc-900 dark:text-white tracking-tight" data-testid="vs-result-name">{id.part_name}</h2>
            <div className="flex flex-wrap gap-2 mt-3">
              {id.category && <span className="text-xs bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 px-2 py-1 rounded-sm">{id.category}</span>}
              {typeof id.confidence === "number" && (
                <span className={`text-xs border px-2 py-1 rounded-sm ${id.confidence >= 0.7 ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300" : id.confidence >= 0.4 ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300" : "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300"}`}>
                  {Math.round(id.confidence * 100)}% confident
                </span>
              )}
              {(id.likely_brands || []).slice(0, 4).map((b) => (
                <span key={b} className="text-xs bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 px-2 py-1 rounded-sm">{b}</span>
              ))}
            </div>
            {id.condition_assessment && <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-3"><strong>Condition:</strong> {id.condition_assessment}</p>}
            {id.replacement_advice && <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-2"><strong>Advice:</strong> {id.replacement_advice}</p>}
            <button data-testid="vs-new-search" onClick={reset} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold border border-zinc-200 dark:border-white/10 hover:border-[#E11D48] hover:text-[#E11D48] px-3 py-1.5 rounded-sm transition-colors">
              <Sparkles className="w-3 h-3" /> New search
            </button>
          </div>
        </div>
      </div>

      {result.matches?.length > 0 ? (
        <div className="industrial-card border border-zinc-200 dark:border-white/10 rounded-sm p-5 sm:p-6">
          <h3 className="font-display text-lg text-zinc-900 dark:text-white mb-3">Catalog matches ({result.matches.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {result.matches.map((p) => (
              <div key={p.product_id} data-testid={`vs-match-${p.sku}`} className="border border-zinc-200 dark:border-white/10 rounded-sm bg-white dark:bg-zinc-900 p-3 flex flex-col">
                {p.image_url && <img src={p.image_url} alt="" className="w-full h-28 object-cover rounded-sm mb-2" />}
                <div className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{p.name}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">{p.sku} · {p.brand}</div>
                <div className="text-sm text-zinc-900 dark:text-white">{fmtBDT(p.your_price_bdt)} <span className="text-xs line-through text-zinc-400 dark:text-zinc-500">{fmtBDT(p.retail_price_bdt)}</span></div>
                <button
                  onClick={() => { addItem(p, p.moq || 1); toast.success(`Added ${p.name}`); }}
                  className="mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-semibold bg-zinc-900 dark:bg-[#E11D48] text-white px-3 py-1.5 rounded-sm hover:opacity-90"
                  data-testid={`vs-add-${p.sku}`}
                >
                  <Plus className="w-3 h-3" /> Add to cart
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="industrial-card border border-zinc-200 dark:border-white/10 rounded-sm p-5 sm:p-6 text-sm text-zinc-500 dark:text-zinc-400">
          No catalog matches yet. Try the <a href="/part-requests" className="text-[#E11D48] underline">Request Any Part</a> form to source it via JOY.
        </div>
      )}
    </div>
  );
};

export default VisualSearch;
