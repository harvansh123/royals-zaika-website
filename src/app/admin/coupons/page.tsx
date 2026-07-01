"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { Coupon } from "@/lib/database.types";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, X, Save, Tag, Copy } from "lucide-react";
import toast from "react-hot-toast";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

const EMPTY = { code: "", description: "", discount_type: "percentage" as const, discount_value: "", min_order_amount: "0", max_discount: "", usage_limit: "", valid_until: "" };

export default function AdminCouponsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);

  useEffect(() => {
    if (!user || user.role !== "admin") { router.push("/"); return; }
    supabase.from("coupons").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { setCoupons(data ?? []); setLoading(false); });
  }, [user]);

  function upd(key: string, val: any) { setForm((p) => ({ ...p, [key]: val })); }

  async function handleSave() {
    if (!form.code || !form.discount_value) { toast.error("Code and discount value are required"); return; }
    setSaving(true);
    const payload = {
      code: form.code.toUpperCase(),
      description: form.description || null,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      min_order_amount: Number(form.min_order_amount) || 0,
      max_discount: form.max_discount ? Number(form.max_discount) : null,
      usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      valid_until: form.valid_until || null,
      is_active: true,
    };
    const { error } = await supabase.from("coupons").insert(payload);
    if (error) toast.error(error.message);
    else {
      toast.success("Coupon created!");
      setShowModal(false);
      setForm(EMPTY);
      const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
      setCoupons(data ?? []);
    }
    setSaving(false);
  }

  async function toggleCoupon(coupon: Coupon) {
    await supabase.from("coupons").update({ is_active: !coupon.is_active }).eq("id", coupon.id);
    setCoupons((prev) => prev.map((c) => c.id === coupon.id ? { ...c, is_active: !c.is_active } : c));
    toast.success(coupon.is_active ? "Coupon deactivated" : "Coupon activated");
  }

  async function deleteCoupon(id: string) {
    if (!confirm("Delete this coupon?")) return;
    await supabase.from("coupons").delete().eq("id", id);
    setCoupons((prev) => prev.filter((c) => c.id !== id));
    toast.success("Coupon deleted");
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 size={32} className="animate-spin text-brand" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-3xl text-white">Coupon Management</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Create Coupon
        </button>
      </div>

      <div className="space-y-3">
        {coupons.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Tag size={40} className="mx-auto mb-3 opacity-30" />
            <p>No coupons yet</p>
          </div>
        ) : coupons.map((coupon) => (
          <div key={coupon.id} className={cn("glass rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4", !coupon.is_active && "opacity-50")}>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <span className="font-display font-bold text-lg text-brand">{coupon.code}</span>
                <button onClick={() => { navigator.clipboard.writeText(coupon.code); toast.success("Copied!"); }} className="text-gray-500 hover:text-white">
                  <Copy size={13} />
                </button>
                <span className={cn("badge text-[10px]", coupon.is_active ? "badge-brand" : "badge bg-gray-500/10 text-gray-400 border border-gray-500/20")}>
                  {coupon.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-sm text-gray-400 mb-2">{coupon.description}</p>
              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                <span>💰 {coupon.discount_type === "percentage" ? `${coupon.discount_value}% off` : `₹${coupon.discount_value} off`}</span>
                <span>🛒 Min: {formatPrice(coupon.min_order_amount)}</span>
                {coupon.max_discount && <span>🔒 Max: {formatPrice(coupon.max_discount)}</span>}
                <span>📊 Used: {coupon.used_count}{coupon.usage_limit ? `/${coupon.usage_limit}` : ""}</span>
                {coupon.valid_until && <span>⏰ Till {new Date(coupon.valid_until).toLocaleDateString("en-IN")}</span>}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => toggleCoupon(coupon)} className={cn("text-xs px-3 py-1.5 rounded-lg border transition-all", coupon.is_active ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-green-500/30 text-green-400 hover:bg-green-500/10")}>
                {coupon.is_active ? "Deactivate" : "Activate"}
              </button>
              <button onClick={() => deleteCoupon(coupon.id)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-dark rounded-3xl p-6 w-full max-w-md border border-white/10 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-xl text-white">Create Coupon</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-500 hover:text-white" /></button>
            </div>
            <div className="space-y-4">
              <input placeholder="Coupon Code (e.g. SAVE50) *" value={form.code} onChange={(e) => upd("code", e.target.value.toUpperCase())} className="input-field uppercase" />
              <input placeholder="Description" value={form.description} onChange={(e) => upd("description", e.target.value)} className="input-field" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.discount_type} onChange={(e) => upd("discount_type", e.target.value)} className="input-field">
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed (₹)</option>
                </select>
                <input placeholder={form.discount_type === "percentage" ? "Value (e.g. 20)" : "Amount (e.g. 50)"} type="number" value={form.discount_value} onChange={(e) => upd("discount_value", e.target.value)} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Min Order (₹)" type="number" value={form.min_order_amount} onChange={(e) => upd("min_order_amount", e.target.value)} className="input-field" />
                <input placeholder="Max Discount (₹)" type="number" value={form.max_discount} onChange={(e) => upd("max_discount", e.target.value)} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Usage Limit" type="number" value={form.usage_limit} onChange={(e) => upd("usage_limit", e.target.value)} className="input-field" />
                <input placeholder="Valid Until" type="date" value={form.valid_until} onChange={(e) => upd("valid_until", e.target.value)} className="input-field" />
              </div>
              <button onClick={handleSave} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? "Creating..." : "Create Coupon"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
