import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import Layout from "../components/Layout";
import api from "../lib/api";
import { useCart } from "../context/CartContext";
import { Plus, Trash2, Truck, Car, ShoppingCart, ChevronRight, X, Edit3, Check } from "lucide-react";

const Fleets = () => {
  const [fleets, setFleets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingFleetId, setEditingFleetId] = useState(null);
  const [suggestions, setSuggestions] = useState({}); // fleet_id -> array
  const [loadingSuggestions, setLoadingSuggestions] = useState(null);
  const { addItem } = useCart();

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/fleets`);
      setFleets(r.data.fleets || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to load fleets");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const remove = async (f) => {
    if (!window.confirm(`Delete fleet "${f.name}"?`)) return;
    try {
      await api.delete(`/fleets/${f.fleet_id}`);
      toast.success("Fleet deleted");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const loadSuggestions = async (fleet_id) => {
    setLoadingSuggestions(fleet_id);
    try {
      const r = await api.get(`/fleets/${fleet_id}/reorder-suggestions`);
      setSuggestions((s) => ({ ...s, [fleet_id]: r.data.suggestions || [] }));
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to load suggestions");
    } finally {
      setLoadingSuggestions(null);
    }
  };

  const addSuggestionToCart = (s) => {
    addItem({
      product_id: s.product_id,
      sku: s.sku,
      name: s.name,
      price_bdt: s.your_price_bdt,
      image_url: s.image_url,
    }, s.suggested_qty);
    toast.success(`Added ${s.suggested_qty}× ${s.name} to cart`);
  };

  const addAllToCart = (fleet_id) => {
    const list = suggestions[fleet_id] || [];
    list.forEach((s) => addSuggestionToCart(s));
  };

  return (
    <Layout>
      <div className="max-w-6xl">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400 mb-1">Fleet Command Center</div>
            <h1 className="text-2xl sm:text-3xl font-display tracking-tight text-zinc-900 dark:text-white">Saved Fleets</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">Group your repeat customers' vehicles into fleets for one-tap reordering of past parts.</p>
          </div>
          <button
            data-testid="fleets-create-btn"
            onClick={() => { setEditingFleetId("new"); setShowCreate(true); }}
            className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-[#E11D48] hover:bg-zinc-700 dark:hover:bg-[#BE123C] text-white px-4 py-2 rounded-sm text-sm font-semibold"
          >
            <Plus className="w-4 h-4" /> New fleet
          </button>
        </div>

        {showCreate && (
          <FleetForm
            fleet={null}
            onCancel={() => { setShowCreate(false); setEditingFleetId(null); }}
            onSaved={() => { setShowCreate(false); setEditingFleetId(null); load(); }}
          />
        )}

        {loading ? (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</div>
        ) : fleets.length === 0 ? (
          <div data-testid="fleets-empty" className="industrial-card border border-zinc-200 dark:border-white/10 rounded-sm p-8 text-center">
            <Truck className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
            <h3 className="font-display text-lg text-zinc-900 dark:text-white">No fleets yet</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Create your first fleet to start one-tap reordering for repeat customers.</p>
          </div>
        ) : (
          <div data-testid="fleets-list" className="space-y-4">
            {fleets.map((f) => (
              <div key={f.fleet_id} data-testid={`fleet-${f.fleet_id}`} className="industrial-card border border-zinc-200 dark:border-white/10 rounded-sm p-5 sm:p-6">
                {editingFleetId === f.fleet_id ? (
                  <FleetForm
                    fleet={f}
                    onCancel={() => setEditingFleetId(null)}
                    onSaved={() => { setEditingFleetId(null); load(); }}
                  />
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display text-lg sm:text-xl text-zinc-900 dark:text-white">{f.name}</h3>
                        {f.description && <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{f.description}</p>}
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 inline-flex items-center gap-1.5">
                          <Car className="w-3 h-3" /> {f.vehicle_count} vehicle{f.vehicle_count !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingFleetId(f.fleet_id)}
                          className="p-2 text-zinc-500 hover:text-[#E11D48] transition-colors"
                          title="Edit"
                          data-testid={`fleet-edit-${f.fleet_id}`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => remove(f)}
                          className="p-2 text-zinc-500 hover:text-[#E11D48] transition-colors"
                          title="Delete"
                          data-testid={`fleet-delete-${f.fleet_id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {f.vehicles?.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {f.vehicles.slice(0, 8).map((v, idx) => (
                          <span key={idx} className="text-xs bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 px-2 py-1 rounded-sm font-mono">
                            {v.brand} {v.model}{v.year ? ` ${v.year}` : ""}{v.plate ? ` · ${v.plate}` : ""}
                          </span>
                        ))}
                        {f.vehicles.length > 8 && (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 px-2 py-1">+ {f.vehicles.length - 8} more</span>
                        )}
                      </div>
                    )}

                    {/* Reorder suggestions */}
                    <div className="mt-5 pt-5 border-t border-zinc-200 dark:border-white/10">
                      {!suggestions[f.fleet_id] ? (
                        <button
                          data-testid={`fleet-suggest-${f.fleet_id}`}
                          onClick={() => loadSuggestions(f.fleet_id)}
                          disabled={loadingSuggestions === f.fleet_id}
                          className="inline-flex items-center gap-2 bg-[#E11D48] hover:bg-[#BE123C] text-white px-4 py-2 rounded-sm text-sm font-semibold disabled:opacity-50"
                        >
                          {loadingSuggestions === f.fleet_id ? "Computing…" : "Show one-tap reorder list"}
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      ) : suggestions[f.fleet_id].length === 0 ? (
                        <div className="text-sm text-zinc-500 dark:text-zinc-400">No order history for this fleet yet — place a few orders and we'll learn your patterns.</div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                            <h4 className="font-display text-base text-zinc-900 dark:text-white">Suggested reorder · top {suggestions[f.fleet_id].length} parts</h4>
                            <button
                              data-testid={`fleet-add-all-${f.fleet_id}`}
                              onClick={() => addAllToCart(f.fleet_id)}
                              className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-2 rounded-sm text-sm font-semibold hover:opacity-90"
                            >
                              <ShoppingCart className="w-4 h-4" /> Add all to cart
                            </button>
                          </div>
                          <ul className="divide-y divide-zinc-200 dark:divide-white/10">
                            {suggestions[f.fleet_id].map((s) => (
                              <li key={s.product_id} className="flex items-center gap-3 py-3">
                                {s.image_url && <img src={s.image_url} alt="" className="w-12 h-12 object-cover rounded-sm" />}
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{s.name}</div>
                                  <div className="text-xs text-zinc-500 dark:text-zinc-400">{s.sku} · {s.brand} · ৳ {s.your_price_bdt.toLocaleString("en-IN")} <span className="line-through text-zinc-400 dark:text-zinc-500">৳ {s.retail_price_bdt.toLocaleString("en-IN")}</span></div>
                                </div>
                                <div className="text-right text-xs">
                                  <div className="font-mono text-zinc-900 dark:text-white">Qty {s.suggested_qty}</div>
                                  <div className="text-zinc-500 dark:text-zinc-400">stock {s.stock}</div>
                                </div>
                                <button
                                  onClick={() => addSuggestionToCart(s)}
                                  className="ml-2 inline-flex items-center gap-1.5 text-xs font-semibold border border-zinc-200 dark:border-white/10 hover:border-[#E11D48] hover:text-[#E11D48] px-3 py-1.5 rounded-sm transition-colors"
                                  data-testid={`fleet-add-one-${s.product_id}`}
                                >
                                  <Plus className="w-3 h-3" /> Add
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

const FleetForm = ({ fleet, onCancel, onSaved }) => {
  const [name, setName] = useState(fleet?.name || "");
  const [description, setDescription] = useState(fleet?.description || "");
  const [vehicles, setVehicles] = useState(fleet?.vehicles?.length ? [...fleet.vehicles] : [{ brand: "", model: "", year: "", plate: "" }]);
  const [submitting, setSubmitting] = useState(false);

  const addRow = () => setVehicles((v) => [...v, { brand: "", model: "", year: "", plate: "" }]);
  const removeRow = (i) => setVehicles((v) => v.filter((_, idx) => idx !== i));
  const updateRow = (i, key, val) => setVehicles((v) => v.map((row, idx) => (idx === i ? { ...row, [key]: val } : row)));

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const cleanVehicles = vehicles
        .filter((v) => v.brand?.trim() && v.model?.trim())
        .map((v) => ({
          brand: v.brand.trim(),
          model: v.model.trim(),
          year: v.year ? parseInt(v.year, 10) : null,
          plate: v.plate?.trim() || null,
          customer_name: v.customer_name?.trim() || null,
          notes: v.notes?.trim() || null,
        }));
      const payload = { name: name.trim(), description: description.trim() || null, vehicles: cleanVehicles };
      if (fleet?.fleet_id) {
        await api.patch(`/fleets/${fleet.fleet_id}`, payload);
        toast.success("Fleet updated");
      } else {
        await api.post(`/fleets`, payload);
        toast.success("Fleet created");
      }
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save fleet");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form data-testid="fleet-form" onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          data-testid="fleet-form-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Fleet name (e.g. Pathao Axio Fleet)"
          className="px-4 py-2.5 text-sm border border-zinc-200 dark:border-white/10 rounded-sm bg-white dark:bg-zinc-900 outline-none focus:border-[#E11D48]"
        />
        <input
          data-testid="fleet-form-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="px-4 py-2.5 text-sm border border-zinc-200 dark:border-white/10 rounded-sm bg-white dark:bg-zinc-900 outline-none focus:border-[#E11D48]"
        />
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Vehicles</div>
        <div className="space-y-2">
          {vehicles.map((v, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <input value={v.brand} onChange={(e) => updateRow(i, "brand", e.target.value)} placeholder="Brand" className="col-span-3 px-3 py-2 text-sm border border-zinc-200 dark:border-white/10 rounded-sm bg-white dark:bg-zinc-900 outline-none focus:border-[#E11D48]" />
              <input value={v.model} onChange={(e) => updateRow(i, "model", e.target.value)} placeholder="Model" className="col-span-3 px-3 py-2 text-sm border border-zinc-200 dark:border-white/10 rounded-sm bg-white dark:bg-zinc-900 outline-none focus:border-[#E11D48]" />
              <input value={v.year || ""} onChange={(e) => updateRow(i, "year", e.target.value)} placeholder="Year" type="number" className="col-span-2 px-3 py-2 text-sm border border-zinc-200 dark:border-white/10 rounded-sm bg-white dark:bg-zinc-900 outline-none focus:border-[#E11D48]" />
              <input value={v.plate || ""} onChange={(e) => updateRow(i, "plate", e.target.value)} placeholder="Plate / VIN" className="col-span-3 px-3 py-2 text-sm border border-zinc-200 dark:border-white/10 rounded-sm bg-white dark:bg-zinc-900 outline-none focus:border-[#E11D48]" />
              <button type="button" onClick={() => removeRow(i)} className="col-span-1 text-zinc-500 hover:text-[#E11D48]"><X className="w-4 h-4 mx-auto" /></button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addRow} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 hover:border-[#E11D48] hover:text-[#E11D48] px-3 py-1.5 rounded-sm transition-colors">
          <Plus className="w-3 h-3" /> Add vehicle
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button data-testid="fleet-form-submit" type="submit" disabled={submitting} className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-[#E11D48] text-white px-5 py-2 rounded-sm text-sm font-semibold disabled:opacity-50">
          <Check className="w-4 h-4" /> {submitting ? "Saving…" : (fleet ? "Save changes" : "Create fleet")}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-zinc-500 hover:text-[#E11D48] px-3 py-2">Cancel</button>
      </div>
    </form>
  );
};

export default Fleets;
