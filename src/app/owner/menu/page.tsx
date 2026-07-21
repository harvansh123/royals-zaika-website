"use client";
import { useEffect, useState, useRef } from "react";
// supabase client not needed — all operations use server-side API routes
import Image from "next/image";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, Loader2, ImagePlus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { formatPrice } from "@/lib/utils";

type Item = {
  id: string; name: string; description: string | null;
  price: number; discounted_price: number | null;
  image_url: string | null; is_veg: boolean;
  is_available: boolean; category_id: string | null;
  is_featured: boolean; is_bestseller: boolean;
};
type Category = { id: string; name: string };

const EMPTY_FORM = {
  name: "", description: "", price: "", discounted_price: "",
  is_veg: true, is_featured: false, is_bestseller: false, category_id: "",
};

export default function OwnerMenuPage() {
  const [items, setItems]         = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editItem, setEditItem]   = useState<Item | null>(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [search, setSearch]       = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    // Use server-side API (service role) — direct supabase queries with anon key
    // fail due to RLS infinite recursion on menu_items (owner policy queries users
    // table which re-triggers get_user_role → recursion → menuItems = null).
    try {
      const res  = await fetch("/api/owner/menu", { credentials: "include" });
      const json = await res.json();
      if (res.ok) {
        setCategories(json.categories ?? []);
        setItems(json.items ?? []);
      } else {
        toast.error(json.error ?? "Failed to load menu");
      }
    } catch {
      toast.error("Network error loading menu");
    }
    setLoading(false);
  }

  function openAdd() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview(null);
    setShowForm(true);
  }

  function openEdit(item: Item) {
    setEditItem(item);
    setForm({
      name: item.name,
      description: item.description ?? "",
      price: String(item.price),
      discounted_price: item.discounted_price ? String(item.discounted_price) : "",
      is_veg: item.is_veg,
      is_featured: item.is_featured,
      is_bestseller: item.is_bestseller,
      category_id: item.category_id ?? "",
    });
    setImageFile(null);
    setImagePreview(item.image_url);
    setShowForm(true);
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function handleRemoveImage(e: React.MouseEvent) {
    e.stopPropagation();
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function toggleAvailability(item: Item) {
    const newVal = !item.is_available;
    const res  = await fetch("/api/owner/menu", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: item.id, is_available: newVal }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Failed to update"); return; }
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_available: newVal } : i));
    toast.success(newVal ? "Item is now In Stock" : "Item marked Out of Stock");
  }

  async function deleteItem(itemId: string) {
    if (!confirm("Delete this item?")) return;
    const res  = await fetch("/api/owner/menu", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id: itemId }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Failed to delete"); return; }
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    toast.success("Item deleted");
  }

  async function handleSave() {
    if (!form.name || !form.price) { toast.error("Name and price are required"); return; }
    if (!form.category_id) { toast.error("Please select a category"); return; }
    setSaving(true);
    try {
      let imageUrl = imagePreview && !imagePreview.startsWith("blob:") ? imagePreview : null;

      // Upload image via server-side API (service role bypasses Storage RLS)
      if (imageFile) {
        const uploadForm = new FormData();
        uploadForm.append("file", imageFile);

        const upRes  = await fetch("/api/owner/upload", {
          method:      "POST",
          credentials: "include",
          body:        uploadForm,
        });
        const upJson = await upRes.json();

        if (!upRes.ok) {
          toast.error("Image upload failed: " + (upJson.error ?? "Please try again"));
          setSaving(false);
          return;
        }
        imageUrl = upJson.url;
      }

      const payload = {
        name:             form.name,
        description:      form.description || null,
        price:            parseFloat(form.price),
        discounted_price: form.discounted_price ? parseFloat(form.discounted_price) : null,
        is_veg:           form.is_veg,
        is_featured:      form.is_featured,
        is_bestseller:    form.is_bestseller,
        category_id:      form.category_id || null,
        image_url:        imageUrl,
        is_available:     true,
      };

      if (editItem) {
        // Use server API to bypass RLS for update
        const res  = await fetch("/api/owner/menu", {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ id: editItem.id, ...payload }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setItems((prev) => prev.map((i) => i.id === editItem.id ? { ...i, ...payload } : i));
        // Bust customer-side sessionStorage cache so new item appears in menu immediately
        try { sessionStorage.removeItem("menu_v2"); } catch {}
        toast.success("Item updated!");
      } else {
        // Use server API to bypass RLS for insert
        const res  = await fetch("/api/owner/menu", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setItems((prev) => [...prev, json.item]);
        // Bust customer-side sessionStorage cache so new item appears in menu immediately
        try { sessionStorage.removeItem("menu_v2"); } catch {}
        toast.success("Item added! ✅");
      }
      setShowForm(false);
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const filtered = items.filter((i) =>
    !search || i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-5 md:p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-bold text-2xl md:text-3xl" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-primary)" }}>Menu</h1>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 py-2.5 px-5">
          <Plus size={18} /> Add Item
        </button>
      </div>

      {/* Search */}
      <input value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search menu items..."
        className="input-field mb-6 max-w-sm" />

      {/* Stats Row */}
      <div className="flex gap-4 mb-6 text-sm flex-wrap">
        {[
          { label: "Total Items",     value: items.length },
          { label: "In Stock",        value: items.filter((i) => i.is_available).length,  color: "#22c55e" },
          { label: "Out of Stock",    value: items.filter((i) => !i.is_available).length, color: "#ef4444" },
        ].map(({ label, value, color }) => (
          <div key={label} className="px-4 py-2.5 rounded-xl" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
            <span className="font-bold mr-1" style={{ color: color ?? "var(--text-primary)" }}>{value}</span>
            <span style={{ color: "var(--text-secondary)" }}>{label}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-orange-500" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <div key={item.id} className="rounded-2xl overflow-hidden transition-all"
              style={{ background: "var(--card-bg)", border: `1px solid ${item.is_available ? "var(--border)" : "rgba(239,68,68,0.3)"}` }}>
              {/* Image */}
              <div className="relative h-40 w-full" style={{ background: "var(--bg-secondary)" }}>
                {item.image_url ? (
                  <Image src={item.image_url} alt={item.name} fill className="object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-4xl">🍽️</div>
                )}
                {/* Veg badge */}
                <div className="absolute top-2 left-2 w-5 h-5 rounded-sm border-2 flex items-center justify-center"
                  style={{ borderColor: item.is_veg ? "#22c55e" : "#ef4444", background: "var(--card-bg)" }}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.is_veg ? "#22c55e" : "#ef4444" }} />
                </div>
                {/* Out of stock overlay */}
                {!item.is_available && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }}>
                    <span className="text-white font-bold text-sm px-3 py-1 rounded-full" style={{ background: "rgba(239,68,68,0.9)" }}>Out of Stock</span>
                  </div>
                )}
              </div>

              <div className="p-4">
                <p className="font-semibold mb-0.5 truncate" style={{ color: "var(--text-primary)" }}>{item.name}</p>
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-bold text-orange-500">{formatPrice(item.discounted_price ?? item.price)}</span>
                  {item.discounted_price && (
                    <span className="text-xs line-through" style={{ color: "var(--text-muted)" }}>{formatPrice(item.price)}</span>
                  )}
                </div>

                {/* Actions Row */}
                <div className="flex items-center gap-2">
                  {/* Stock Toggle — most prominent */}
                  <button onClick={() => toggleAvailability(item)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={item.is_available
                      ? { background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }
                      : { background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
                    {item.is_available ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    {item.is_available ? "In Stock" : "Out of Stock"}
                  </button>
                  <button onClick={() => openEdit(item)}
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                    style={{ background: "var(--bg-glass)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => deleteItem(item.id)}
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                    style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md rounded-3xl p-6 max-h-[90vh] overflow-y-auto" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>{editItem ? "Edit Item" : "Add New Item"}</h2>
              <button onClick={() => setShowForm(false)} style={{ color: "var(--text-muted)" }}><X size={20} /></button>
            </div>

            {/* Image Upload */}
            <div className="mb-4">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              <div 
                onClick={() => !imagePreview && fileRef.current?.click()}
                className={`relative h-36 rounded-2xl overflow-hidden flex items-center justify-center transition-all ${!imagePreview ? "cursor-pointer" : ""}`}
                style={{ background: "var(--bg-glass)", border: "2px dashed var(--border)" }}>
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="preview" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-3 opacity-0 hover:opacity-100 transition-opacity">
                      <button type="button" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }} className="px-3 py-1.5 rounded-lg bg-white/20 text-white font-medium backdrop-blur-sm hover:bg-white/30 text-sm">
                        Change
                      </button>
                      <button type="button" onClick={handleRemoveImage} className="px-3 py-1.5 rounded-lg bg-red-500/80 text-white font-medium backdrop-blur-sm hover:bg-red-500 text-sm">
                        Remove
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    <ImagePlus size={28} className="mx-auto mb-2 text-orange-500" />
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Click to upload photo</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Item Name *" className="input-field" />
              <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Description (optional)" className="input-field resize-none h-16 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                  placeholder="Price ₹ *" className="input-field" />
                <input type="number" value={form.discounted_price} onChange={(e) => setForm((p) => ({ ...p, discounted_price: e.target.value }))}
                  placeholder="Sale Price ₹" className="input-field" />
              </div>

              <select value={form.category_id} onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value }))}
                className="input-field"
                style={!form.category_id ? { border: "1.5px solid rgba(249,115,22,0.5)" } : {}}>
                <option value="">⚠️ Select Category *</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              {/* Toggles */}
              <div className="flex gap-3">
                {[
                  { key: "is_veg",       label: "🥦 Veg" },
                  { key: "is_featured",  label: "⭐ Featured" },
                  { key: "is_bestseller",label: "🏆 Bestseller" },
                ].map(({ key, label }) => (
                  <button key={key} type="button"
                    onClick={() => setForm((p) => ({ ...p, [key]: !(p as any)[key] }))}
                    className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
                    style={(form as any)[key]
                      ? { background: "rgba(249,115,22,0.12)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)" }
                      : { background: "var(--bg-glass)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                    {label}
                  </button>
                ))}
              </div>

              <button onClick={handleSave} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
                {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : <><Check size={16} /> {editItem ? "Save Changes" : "Add Item"}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
