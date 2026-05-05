import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";
import { Plus, Trash2, Edit, Bike, Truck, Package2, Phone, Link as LinkIcon, Copy } from "lucide-react";
import { toast } from "sonner";

const empty = {
  name: "",
  phone: "",
  nid_no: "",
  vehicle_type: "bike",
  vehicle_no: "",
  coverage_areas: [],
  status: "active",
  notes: "",
};

const VEHICLE_ICON = {
  bike: Bike,
  van: Package2,
  pickup: Truck,
  truck: Truck,
};

const AdminDeliveryPersons = () => {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [areasStr, setAreasStr] = useState("");

  const load = async () => {
    const { data } = await api.get("/admin/delivery-persons");
    setItems(data || []);
  };
  useEffect(() => {
    load();
  }, []);

  const startNew = () => {
    setEditing("new");
    setForm(empty);
    setAreasStr("");
  };
  const startEdit = (d) => {
    setEditing(d.delivery_person_id);
    setForm({ ...d });
    setAreasStr((d.coverage_areas || []).join(", "));
  };
  const cancel = () => {
    setEditing(null);
    setForm(empty);
    setAreasStr("");
  };

  const save = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    const payload = {
      ...form,
      coverage_areas: areasStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      if (editing === "new") await api.post("/admin/delivery-persons", payload);
      else await api.put(`/admin/delivery-persons/${editing}`, payload);
      cancel();
      await load();
      toast.success("Saved");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this delivery person?")) return;
    try {
      await api.delete(`/admin/delivery-persons/${id}`);
      await load();
      toast.success("Deleted");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="overline">Logistics</div>
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl leading-tight mt-1">Delivery Team</h1>
            <p className="text-sm text-slate-500 mt-1">
              Riders and drivers you can assign to outgoing orders.
            </p>
          </div>
          <button
            onClick={startNew}
            data-testid="new-delivery-person-button"
            className="inline-flex items-center gap-2 bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-semibold px-4 py-2 rounded-sm"
          >
            <Plus className="w-4 h-4" /> Add Delivery Person
          </button>
        </div>

        {editing && (
          <div className="industrial-card p-5 space-y-4" data-testid="delivery-person-form">
            <div className="overline">{editing === "new" ? "New Delivery Person" : "Edit Delivery Person"}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <F l="Name *" testid="dp-name" v={form.name} on={(v) => setForm({ ...form, name: v })} />
              <F l="Phone *" testid="dp-phone" v={form.phone} on={(v) => setForm({ ...form, phone: v })} placeholder="01XXXXXXXXX" />
              <F l="NID Number" testid="dp-nid" v={form.nid_no} on={(v) => setForm({ ...form, nid_no: v })} />
              <div>
                <label className="overline block mb-1.5">Vehicle Type</label>
                <select
                  data-testid="dp-vehicle-type"
                  value={form.vehicle_type}
                  onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                  className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm bg-white"
                >
                  <option value="bike">Motorbike</option>
                  <option value="van">Van</option>
                  <option value="pickup">Pickup</option>
                  <option value="truck">Truck</option>
                </select>
              </div>
              <F l="Vehicle Number" testid="dp-vehicle-no" v={form.vehicle_no} on={(v) => setForm({ ...form, vehicle_no: v })} placeholder="DHA-METRO-XX-1234" />
              <div>
                <label className="overline block mb-1.5">Status</label>
                <select
                  data-testid="dp-status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm bg-white"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <F
                l="Coverage Areas (comma-separated)"
                testid="dp-areas"
                v={areasStr}
                on={setAreasStr}
                placeholder="Dhaka, Gulshan, Banani, Uttara"
                className="lg:col-span-3"
              />
            </div>
            <div>
              <label className="overline block mb-1.5">Notes</label>
              <textarea
                data-testid="dp-notes"
                value={form.notes || ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={save}
                data-testid="save-delivery-person-button"
                className="bg-slate-900 hover:bg-[#E11D48] text-white text-sm font-semibold px-5 py-2 rounded-sm transition-colors duration-200"
              >
                Save
              </button>
              <button onClick={cancel} className="bg-white border border-slate-200 text-sm font-semibold px-5 py-2 rounded-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="industrial-card p-10 text-center text-sm text-slate-500" data-testid="dp-empty">
            No delivery persons yet. Add your first above.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="dp-grid">
            {items.map((d) => {
              const Icon = VEHICLE_ICON[d.vehicle_type] || Package2;
              return (
                <div
                  key={d.delivery_person_id}
                  className="industrial-card p-5"
                  data-testid={`dp-card-${d.delivery_person_id}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-display text-lg">{d.name}</div>
                      <div className="text-xs text-slate-500 inline-flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" /> {d.phone}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-sm ${
                        d.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                    <Icon className="w-4 h-4" />
                    <span className="capitalize">{d.vehicle_type}</span>
                    {d.vehicle_no && <span className="font-mono text-slate-500">· {d.vehicle_no}</span>}
                  </div>

                  {d.coverage_areas?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {d.coverage_areas.map((c) => (
                        <span
                          key={c}
                          className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-sm"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="text-xs text-slate-500 mt-3">
                    Active orders:{" "}
                    <span className="font-semibold text-slate-800">{d.active_assignments || 0}</span>
                  </div>

                  {d.access_token && (
                    <div className="mt-3 bg-slate-50 border border-slate-200 rounded-sm p-2">
                      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                        <LinkIcon className="w-3 h-3" /> Driver mobile link
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-[10px] font-mono text-slate-700 truncate flex-1" data-testid={`dp-link-${d.delivery_person_id}`}>
                          {`${window.location.origin}/driver/${d.delivery_person_id}?token=${d.access_token}`}
                        </code>
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/driver/${d.delivery_person_id}?token=${d.access_token}`;
                            navigator.clipboard.writeText(url);
                            toast.success("Driver link copied");
                          }}
                          className="text-[10px] font-semibold text-slate-600 hover:text-[#E11D48] flex items-center gap-1"
                          data-testid={`copy-dp-link-${d.delivery_person_id}`}
                        >
                          <Copy className="w-3 h-3" /> Copy
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 mt-4 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => startEdit(d)}
                      className="text-xs font-semibold text-slate-600 hover:text-[#E11D48] flex items-center gap-1"
                      data-testid={`edit-dp-${d.delivery_person_id}`}
                    >
                      <Edit className="w-3 h-3" /> Edit
                    </button>
                    <button
                      onClick={() => del(d.delivery_person_id)}
                      className="text-xs font-semibold text-slate-600 hover:text-red-600 flex items-center gap-1"
                      data-testid={`del-dp-${d.delivery_person_id}`}
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

const F = ({ l, v, on, type = "text", placeholder, testid, className = "" }) => (
  <div className={className}>
    <label className="overline block mb-1.5">{l}</label>
    <input
      data-testid={testid}
      type={type}
      value={v || ""}
      onChange={(e) => on(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-slate-200 px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
    />
  </div>
);

export default AdminDeliveryPersons;
