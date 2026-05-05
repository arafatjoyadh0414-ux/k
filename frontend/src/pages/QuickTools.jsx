import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import api, { fmtBDT } from "../lib/api";
import { useCart } from "../context/CartContext";
import { Boxes, Plus, Trash2, ShoppingCart, Zap, ClipboardPaste, Save } from "lucide-react";
import { toast } from "sonner";

const QuickTools = () => {
  const [tab, setTab] = useState("bundles");
  return (
    <Layout>
      <div className="space-y-6" data-testid="quick-tools-page">
        <div>
          <div className="overline">Power tools</div>
          <h1 className="font-display text-3xl lg:text-4xl mt-1 flex items-center gap-3">
            <Zap className="w-7 h-7 text-[#E11D48]" /> Order faster
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Save your service kits, paste a list of SKUs, and skip the cart-build dance.
          </p>
        </div>

        <div className="flex gap-1 border-b border-slate-200">
          <Tab active={tab === "bundles"} onClick={() => setTab("bundles")} testid="tab-bundles" icon={Boxes} label="My Service Kits" />
          <Tab active={tab === "bulk"} onClick={() => setTab("bulk")} testid="tab-bulk" icon={ClipboardPaste} label="Bulk SKU Paste" />
        </div>

        {tab === "bundles" ? <SavedBundles /> : <BulkPaste />}
      </div>
    </Layout>
  );
};

const Tab = ({ active, onClick, label, icon: Icon, testid }) => (
  <button
    onClick={onClick}
    data-testid={testid}
    className={`inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 border-b-2 transition-colors ${
      active ? "border-[#E11D48] text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"
    }`}
  >
    <Icon className="w-4 h-4" /> {label}
  </button>
);

const SavedBundles = () => {
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [items, setItems] = useState([{ sku: "", quantity: 1 }]);
  const [products, setProducts] = useState([]);
  const { add } = useCart();

  const load = async () => {
    setLoading(true);
    const [bRes, pRes] = await Promise.all([
      api.get("/workshop/bundles"),
      api.get("/products"),
    ]);
    setBundles(bRes.data || []);
    setProducts(pRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Name required");
    const skuMap = Object.fromEntries(products.map((p) => [p.sku, p]));
    const resolved = items
      .filter((it) => it.sku && it.quantity > 0)
      .map((it) => ({ product_id: skuMap[it.sku.trim().toUpperCase()]?.product_id, quantity: it.quantity }))
      .filter((it) => it.product_id);
    if (resolved.length === 0) return toast.error("No valid SKUs");
    try {
      await api.post("/workshop/bundles", { name: name.trim(), items: resolved });
      toast.success("Service kit saved");
      setName(""); setItems([{ sku: "", quantity: 1 }]); setCreating(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    }
  };

  const handleAddAll = (b) => {
    let added = 0;
    for (const it of b.items_resolved || []) {
      const p = products.find((x) => x.product_id === it.product_id);
      if (p) {
        add(
          {
            product_id: p.product_id, name: p.name, sku: p.sku,
            image_url: p.image_url, price_bdt: p.your_price_bdt || p.price_bdt, moq: p.moq || 1,
          },
          it.quantity
        );
        added++;
      }
    }
    toast.success(`Added ${added} items from "${b.name}" to cart`);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this saved kit?")) return;
    await api.delete(`/workshop/bundles/${id}`);
    load();
  };

  const updateItem = (idx, patch) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    setItems(next);
  };

  if (loading) return <div className="overline">Loading…</div>;

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-600">
          Build a service kit once (e.g. "Toyota Axio Service") — then add it to cart in one click forever.
        </p>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            data-testid="new-bundle-button"
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-[#E11D48] text-white text-sm font-semibold px-4 py-2 rounded-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> New Kit
          </button>
        )}
      </div>

      {creating && (
        <div className="industrial-card p-5 space-y-4" data-testid="new-bundle-form">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='Kit name (e.g. "Toyota Axio 5K Service")'
            data-testid="bundle-name-input"
            className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
          />
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center" data-testid={`bundle-item-${i}`}>
                <input
                  list="prod-skus"
                  value={it.sku}
                  onChange={(e) => updateItem(i, { sku: e.target.value })}
                  placeholder="SKU (start typing…)"
                  data-testid={`bundle-sku-${i}`}
                  className="col-span-7 border border-slate-200 px-3 py-2 text-sm rounded-sm font-mono uppercase"
                />
                <input
                  type="number" min="1"
                  value={it.quantity}
                  onChange={(e) => updateItem(i, { quantity: parseInt(e.target.value) || 1 })}
                  data-testid={`bundle-qty-${i}`}
                  className="col-span-3 border border-slate-200 px-3 py-2 text-sm rounded-sm"
                />
                <button
                  onClick={() => setItems(items.filter((_, x) => x !== i))}
                  className="col-span-2 text-red-600 hover:bg-red-50 rounded-sm py-2 text-xs flex items-center justify-center gap-1"
                  data-testid={`bundle-remove-${i}`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            <datalist id="prod-skus">
              {products.map((p) => <option key={p.sku} value={p.sku}>{p.name}</option>)}
            </datalist>
            <button
              onClick={() => setItems([...items, { sku: "", quantity: 1 }])}
              data-testid="bundle-add-row"
              className="text-xs font-semibold text-[#E11D48] hover:underline inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add another item
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              data-testid="bundle-save-button"
              className="inline-flex items-center gap-1.5 bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-semibold px-5 py-2 rounded-sm"
            >
              <Save className="w-4 h-4" /> Save Kit
            </button>
            <button onClick={() => setCreating(false)} className="bg-white border border-slate-200 text-sm font-semibold px-5 py-2 rounded-sm">Cancel</button>
          </div>
        </div>
      )}

      {bundles.length === 0 ? (
        <div className="industrial-card p-12 text-center text-slate-500" data-testid="bundles-empty">
          No saved kits yet. Create your first reusable service kit above.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="bundles-grid">
          {bundles.map((b) => (
            <div key={b.saved_bundle_id} className="industrial-card p-5" data-testid={`bundle-card-${b.saved_bundle_id}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="overline">Service Kit</div>
                  <div className="font-display text-lg mt-0.5">{b.name}</div>
                </div>
                <button onClick={() => handleDelete(b.saved_bundle_id)} className="text-slate-400 hover:text-red-600" data-testid={`delete-bundle-${b.saved_bundle_id}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <ul className="text-xs text-slate-600 mt-3 space-y-1">
                {(b.items_resolved || []).map((it, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="truncate">{it.quantity} × {it.name}</span>
                    <span className="font-mono text-slate-500 shrink-0 ml-2">{it.sku}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-end justify-between">
                <div>
                  <div className="overline">Kit total</div>
                  <div className="font-display text-lg">{fmtBDT(b.total_bdt)}</div>
                </div>
                <button
                  onClick={() => handleAddAll(b)}
                  data-testid={`add-bundle-${b.saved_bundle_id}`}
                  className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-[#E11D48] text-white text-xs font-semibold px-3 py-2 rounded-sm transition-colors"
                >
                  <ShoppingCart className="w-3.5 h-3.5" /> Add Kit to Cart
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const BulkPaste = () => {
  const [text, setText] = useState("");
  const [products, setProducts] = useState([]);
  const [parsed, setParsed] = useState([]);
  const { add } = useCart();

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/products");
      setProducts(data || []);
    })();
  }, []);

  const parse = () => {
    const lines = text
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const skuMap = Object.fromEntries(products.map((p) => [p.sku.toUpperCase(), p]));
    const out = [];
    for (const line of lines) {
      // Format: "SKU x QTY" or "SKU QTY" or just "SKU" (qty=1)
      const m = line.match(/^([A-Za-z0-9-]+)\s*(?:[xX×*]\s*)?(\d+)?$/);
      if (!m) {
        out.push({ raw: line, sku: line, quantity: 1, found: false });
        continue;
      }
      const sku = m[1].toUpperCase();
      const qty = parseInt(m[2] || "1", 10);
      const p = skuMap[sku];
      if (p) {
        out.push({ raw: line, sku, quantity: qty, found: true, product: p });
      } else {
        out.push({ raw: line, sku, quantity: qty, found: false });
      }
    }
    setParsed(out);
  };

  const addAll = () => {
    let n = 0;
    for (const row of parsed.filter((r) => r.found)) {
      add(
        {
          product_id: row.product.product_id,
          name: row.product.name,
          sku: row.product.sku,
          image_url: row.product.image_url,
          price_bdt: row.product.your_price_bdt || row.product.price_bdt,
          moq: row.product.moq || 1,
        },
        row.quantity
      );
      n++;
    }
    toast.success(`Added ${n} items to cart`);
  };

  const found = parsed.filter((r) => r.found).length;
  const missing = parsed.length - found;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Paste a list of SKUs — one per line, or comma-separated, with optional quantity.
        Examples: <code className="bg-slate-100 px-1 font-mono text-xs">JA-BRK-002 x 4</code>, <code className="bg-slate-100 px-1 font-mono text-xs">JA-ENG-001, JA-FLD-001 x 2</code>
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        data-testid="bulk-paste-textarea"
        placeholder={`JA-BRK-002 x 4\nJA-ENG-001 x 2\nJA-FLD-001\nJA-ENG-003 x 3`}
        className="w-full border border-slate-200 px-3 py-2 text-sm font-mono rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
      />
      <div className="flex gap-2">
        <button
          onClick={parse}
          disabled={!text.trim()}
          data-testid="bulk-parse-button"
          className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-[#E11D48] text-white text-sm font-semibold px-5 py-2 rounded-sm disabled:opacity-50 transition-colors"
        >
          Parse list
        </button>
        {found > 0 && (
          <button
            onClick={addAll}
            data-testid="bulk-add-all-button"
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2 rounded-sm transition-colors"
          >
            <ShoppingCart className="w-4 h-4" /> Add {found} items to cart
          </button>
        )}
      </div>

      {parsed.length > 0 && (
        <div className="industrial-card overflow-hidden" data-testid="bulk-parsed-list">
          <div className="grid grid-cols-12 px-4 py-2 border-b border-slate-200 overline bg-slate-50">
            <div className="col-span-3">SKU</div>
            <div className="col-span-6">Match</div>
            <div className="col-span-1 text-center">Qty</div>
            <div className="col-span-2 text-right">Price</div>
          </div>
          {parsed.map((r, i) => (
            <div
              key={i}
              className={`grid grid-cols-12 px-4 py-2.5 items-center border-b border-slate-100 last:border-b-0 text-sm ${
                r.found ? "" : "bg-red-50"
              }`}
              data-testid={`bulk-row-${i}`}
            >
              <div className="col-span-3 font-mono text-xs">{r.sku}</div>
              <div className="col-span-6">
                {r.found ? <span className="text-slate-700">{r.product.name}</span> : <span className="text-red-600 font-semibold">SKU not found</span>}
              </div>
              <div className="col-span-1 text-center">{r.quantity}</div>
              <div className="col-span-2 text-right font-semibold">
                {r.found ? fmtBDT((r.product.your_price_bdt || r.product.price_bdt) * r.quantity) : "—"}
              </div>
            </div>
          ))}
          {missing > 0 && (
            <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 text-xs text-amber-800">
              {missing} SKU{missing > 1 ? "s" : ""} not found.{" "}
              <Link to="/part-requests" className="underline font-semibold">Submit a sourcing request</Link> for unlisted parts.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuickTools;
