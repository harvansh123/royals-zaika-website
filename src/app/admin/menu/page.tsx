"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { MenuItem, Category } from "@/lib/database.types";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, X, Save, ToggleLeft, ToggleRight } from "lucide-react";
import toast from "react-hot-toast";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

const EMPTY_FORM = {
  name: "", slug: "", description: "", price: "", discounted_price: "",
  category_id: "", image_url: "", is_veg: true, is_available: true,
  is_featured: false, is_bestseller: false, spice_level: 1, preparation_time: 20,
};

export default function AdminMenuPage() {
  const { user } = useAuthStore();
  const router   = useRouter();
  const [items, setItems]         = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    if (!user || user.role !== "admin") { router.push("/"); return; }
    loadData();
  }, [user]);

  async function loadData() {
    const [{ data: menuItems }, { data: cats }] = await Promise.all([
      supabase.from("menu_items").select("*").order("sort_order"),
      supabase.from("categories").select("*").order("sort_order"),
    ]);
    setItems(menuItems ?? []);
    setCategories(cats ?? []);
    setLoading(false);
  }

  function upd(key: string, val: any) {
    setForm((p) => ({ ...p, [key]: val }));
    if (key === "name" && !editId) {
      setForm((p) => ({ ...p, slug: val.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "") }));
    }
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowModal(true);
  }

  function openEdit(item: MenuItem) {
    setForm({
      name: item.name, slug: item.slug, description: item.description ?? "",
      price: String(item.price), discounted_price: String(item.discounted_price ?? ""),
      category_id: item.category_id, image_url: item.image_url ?? "",
      is_veg: item.is_veg, is_available: item.is_available,
      is_featured: item.is_featured, is_bestseller: item.is_bestseller,
      spice_level: item.spice_level, preparation_time: item.preparation_time,
    });
    setEditId(item.id);
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name || !form.price || !form.category_id) {
      toast.error("Name, price and category are required");
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      price: Number(form.price),
      discounted_price: form.discounted_price ? Number(form.discounted_price) : null,
    };
    const { error } = editId
      ? await supabase.from("menu_items").update(payload).eq("id", editId)
      : await supabase.from("menu_items").insert(payload);

    if (error) toast.error(error.message);
    else { toast.success(editId ? "Item updated!" : "Item added!"); setShowModal(false); loadData(); }
    setSaving(false);
  }

  async function toggleAvailable(item: MenuItem) {
    await supabase.from("menu_items").update({ is_available: !item.is_available }).eq("id", item.id);
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_available: !i.is_available } : i));
    toast.success(item.is_available ? "Item hidden" : "Item visible");
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this item? This cannot be undone.")) return;
    await supabase.from("menu_items").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success("Item deleted");
  }

  const filtered = items.filter((i) => categoryFilter === "all" || i.category_id === categoryFilter);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 size={32} className="animate-spin text-brand" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-3xl text-white">Menu Management</h1>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Item
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-6">
        <button onClick={() => setCategoryFilter("all")} className={cn("flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium border transition-all", categoryFilter === "all" ? "border-brand bg-brand text-white" : "border-white/10 text-gray-400 hover:text-white")}>All ({items.length})</button>
        {categories.map((c) => (
          <button key={c.id} onClick={() => setCategoryFilter(c.id)} className={cn("flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-all whitespace-nowrap", categoryFilter === c.id ? "border-brand bg-brand/10 text-brand" : "border-white/10 text-gray-400 hover:text-white")}>
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => (
          <div key={item.id} className={cn("glass rounded-2xl overflow-hidden border transition-all", !item.is_available && "opacity-50")}>
            <div className="h-36 bg-[#1a1a2e] flex items-center justify-center text-5xl relative">
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
              ) : "🍽️"}
              <div className="absolute top-2 right-2 flex gap-1">
                {item.is_veg
                  ? <span className="badge-veg text-[10px]">Veg</span>
                  : <span className="badge-nonveg text-[10px]">Non-Veg</span>}
              </div>
              {item.is_bestseller && <span className="absolute top-2 left-2 badge-brand text-[10px]">🏆</span>}
            </div>
            <div className="p-4">
              <p className="font-semibold text-white text-sm mb-0.5">{item.name}</p>
              <p className="text-brand font-bold text-sm mb-3">{formatPrice(item.price)}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleAvailable(item)} className={cn("flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all flex-1 justify-center", item.is_available ? "border-green-500/30 text-green-400 hover:bg-green-500/10" : "border-gray-600 text-gray-500 hover:border-white/20")}>
                  {item.is_available ? <><ToggleRight size={14}/> Visible</> : <><ToggleLeft size={14}/> Hidden</>}
                </button>
                <button onClick={() => openEdit(item)} className="w-8 h-8 glass rounded-lg flex items-center justify-center text-blue-400 hover:bg-blue-400/10 transition-colors">
                  <Pencil size={14} />
                </button>
                <button onClick={() => deleteItem(item.id)} className="w-8 h-8 glass rounded-lg flex items-center justify-center text-red-400 hover:bg-red-400/10 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-dark rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-white/10 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-xl text-white">{editId ? "Edit Item" : "Add New Item"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white"><X size={20}/></button>
            </div>
            <div className="space-y-4">
              <input placeholder="Item Name *" value={form.name} onChange={(e) => upd("name", e.target.value)} className="input-field" />
              <input placeholder="Slug (auto)" value={form.slug} onChange={(e) => upd("slug", e.target.value)} className="input-field text-gray-400" />
              <textarea placeholder="Description" value={form.description} onChange={(e) => upd("description", e.target.value)} className="input-field resize-none h-20 text-sm" />
              <select value={form.category_id} onChange={(e) => upd("category_id", e.target.value)} className="input-field">
                <option value="">Select Category *</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Price (₹) *" type="number" value={form.price} onChange={(e) => upd("price", e.target.value)} className="input-field" />
                <input placeholder="Discounted Price" type="number" value={form.discounted_price} onChange={(e) => upd("discounted_price", e.target.value)} className="input-field" />
              </div>
              <input placeholder="Image URL" value={form.image_url} onChange={(e) => upd("image_url", e.target.value)} className="input-field" />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Prep Time (min)" type="number" value={form.preparation_time} onChange={(e) => upd("preparation_time", Number(e.target.value))} className="input-field" />
                <select value={form.spice_level} onChange={(e) => upd("spice_level", Number(e.target.value))} className="input-field">
                  {[1,2,3,4,5].map((n) => <option key={n} value={n}>{["Mild","Medium","Spicy","Very Spicy","Extra Hot"][n-1]}</option>)}
                </select>
              </div>
              {/* Toggles */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "is_veg",        label: "Vegetarian" },
                  { key: "is_available",  label: "Available" },
                  { key: "is_featured",   label: "Featured" },
                  { key: "is_bestseller", label: "Bestseller" },
                ].map(({ key, label }) => (
                  <label key={key} className={cn("flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all", (form as any)[key] ? "border-brand bg-brand/10" : "border-white/10")}>
                    <input type="checkbox" checked={(form as any)[key]} onChange={(e) => upd(key, e.target.checked)} className="sr-only" />
                    <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0", (form as any)[key] ? "border-brand bg-brand" : "border-gray-600")}>
                      {(form as any)[key] && <span className="text-white text-[10px]">✓</span>}
                    </div>
                    <span className="text-sm text-gray-300">{label}</span>
                  </label>
                ))}
              </div>
              <button onClick={handleSave} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? "Saving..." : editId ? "Save Changes" : "Add Item"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
