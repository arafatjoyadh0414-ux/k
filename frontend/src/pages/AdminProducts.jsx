import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api, { fmtBDT } from "../lib/api";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

const empty = {
  name: "", sku: "", category: "Brake", description: "", image_url: "",
  price_bdt: 0, moq: 1, stock: 100, brand: "",
};

const AdminProducts = () => {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = async () => {
    const { data } = await api.get("/products");
    setItems(data || []);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditing("new"); setForm(empty); };
  const startEdit = (p) => { setEditing(p.product_id); setForm({ ...p }); };
  const cancel = () => { setEditing(null); setForm(empty); };

  const save = async () => {
    try {
      const payload = { ...form, price_bdt: parseFloat(form.price_bdt), moq: parseInt(form.moq), stock: parseInt(form.stock) };
      if (editing === "new") await api.post("/admin/products", payload);
      else await api.put(`/admin/products/${editing}`, payload);
      cancel();
      await load();
      toast.success("Saved");
    } catch (e) { toast.error("Failed"); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    await api.delete(`/admin/products/${id}`);
    await load();
    toast.success("Deleted");
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="overline">Catalog</div>
            <h1 className="font-display text-3xl lg:text-4xl mt-1">Products</h1>
          </div>
          <button onClick={startNew} data-testid="new-product-button"
            className="inline-flex items-center gap-2 bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-semibold px-4 py-2 rounded-sm">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>

        {editing && (
          <div className="industrial-card p-5">
            <div className="overline mb-3">{editing === "new" ? "New Product" : "Edit Product"}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <F l="Name" v={form.name} on={(v) => setForm({ ...form, name: v })} testid="prod-name" />
              <F l="SKU" v={form.sku} on={(v) => setForm({ ...form, sku: v })} testid="prod-sku" />
              <F l="Category" v={form.category} on={(v) => setForm({ ...form, category: v })} testid="prod-cat" />
              <F l="Brand" v={form.brand} on={(v) => setForm({ ...form, brand: v })} testid="prod-brand" />
              <F l="Price (BDT)" v={form.price_bdt} on={(v) => setForm({ ...form, price_bdt: v })} type="number" testid="prod-price" />
              <F l="MOQ" v={form.moq} on={(v) => setForm({ ...form, moq: v })} type="number" testid="prod-moq" />
              <F l="Stock" v={form.stock} on={(v) => setForm({ ...form, stock: v })} type="number" testid="prod-stock" />
              <F l="Image URL" v={form.image_url} on={(v) => setForm({ ...form, image_url: v })} className="lg:col-span-2" testid="prod-img" />
              <F l="Description" v={form.description} on={(v) => setForm({ ...form, description: v })} className="lg:col-span-3" multiline testid="prod-desc" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={save} data-testid="save-product-button"
                className="bg-slate-900 hover:bg-[#E11D48] text-white text-sm font-semibold px-5 py-2 rounded-sm transition-colors duration-200">Save</button>
              <button onClick={cancel} className="bg-white border border-slate-200 text-sm font-semibold px-5 py-2 rounded-sm">Cancel</button>
            </div>
          </div>
        )}

        <div className="industrial-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-5 py-3 overline">SKU</th>
                <th className="text-left px-5 py-3 overline">Name</th>
                <th className="text-left px-5 py-3 overline">Category</th>
                <th className="text-left px-5 py-3 overline">Price</th>
                <th className="text-left px-5 py-3 overline">MOQ</th>
                <th className="text-left px-5 py-3 overline">Stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.product_id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono text-xs">{p.sku}</td>
                  <td className="px-5 py-3 font-semibold">{p.name}</td>
                  <td className="px-5 py-3 text-xs">{p.category}</td>
                  <td className="px-5 py-3">{fmtBDT(p.price_bdt)}</td>
                  <td className="px-5 py-3">{p.moq}</td>
                  <td className="px-5 py-3">{p.stock}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => startEdit(p)} className="text-slate-600 hover:text-[#E11D48]" data-testid={`edit-prod-${p.sku}`}><Edit className="w-4 h-4" /></button>
                      <button onClick={() => del(p.product_id)} className="text-slate-600 hover:text-red-600" data-testid={`del-prod-${p.sku}`}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
};

const F = ({ l, v, on, type = "text", multiline, className = "", testid }) => (
  <div className={className}>
    <label className="overline block mb-1.5">{l}</label>
    {multiline ? (
      <textarea data-testid={testid} value={v || ""} onChange={(e) => on(e.target.value)} rows={2}
        className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm" />
    ) : (
      <input data-testid={testid} type={type} value={v || ""} onChange={(e) => on(e.target.value)}
        className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm" />
    )}
  </div>
);

export default AdminProducts;
