"use client";
import { useState, useEffect, useCallback } from "react";
import { formatPrice } from "@/lib/utils";
import { Loader2, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Tag, X, Check } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

type DiscountType = "percentage" | "flat";

interface Offer {
  id: string;
  title: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  priority: number;
  created_at: string;
}

const EMPTY_FORM = {
  title: "",
  description: "",
  discount_type: "percentage" as DiscountType,
  discount_value: "",
  min_order_amount: "0",
  max_discount_amount: "",
  start_date: new Date().toISOString().split("T")[0],
  end_date: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
  is_active: true,
  priority: "0",
};

type FormState = typeof EMPTY_FORM;

function offerStatus(offer: Offer): { label: string; color: string } {
  const today = new Date().toISOString().split("T")[0];
  if (!offer.is_active)          return { label: "Disabled",  color: "#6b7280" };
  if (offer.end_date   < today)  return { label: "Expired",   color: "#ef4444" };
  if (offer.start_date > today)  return { label: "Scheduled", color: "#f59e0b" };
  return { label: "Active", color: "#22c55e" };
}

export default function OwnerOffersPage() {
  const [offers,   setOffers]   = useState<Offer[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState<string | null>(null);
  const [form,     setForm]     = useState<FormState>(EMPTY_FORM);
  const [saving,   setSaving]   = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/owner/offers");
      const json = await res.json();
      setOffers(json.offers ?? []);
    } catch {
      toast.error("Failed to load offers");
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadOffers(); }, [loadOffers]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(true);
  }

  function openEdit(offer: Offer) {
    setForm({
      title:               offer.title,
      description:         offer.description ?? "",
      discount_type:       offer.discount_type,
      discount_value:      String(offer.discount_value),
      min_order_amount:    String(offer.min_order_amount),
      max_discount_amount: offer.max_discount_amount ? String(offer.max_discount_amount) : "",
      start_date:          offer.start_date,
      end_date:            offer.end_date,
      is_active:           offer.is_active,
      priority:            String(offer.priority),
    });
    setEditId(offer.id);
    setShowForm(true);
  }

  function closeForm() { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); }

  function setF(key: keyof FormState, val: any) { setForm((p) => ({ ...p, [key]: val })); }

  async function saveOffer() {
    if (!form.title.trim())             { toast.error("Title is required");         return; }
    if (!form.discount_value)           { toast.error("Discount value is required"); return; }
    if (Number(form.discount_value) <= 0) { toast.error("Discount must be > 0");     return; }
    if (form.discount_type === "percentage" && Number(form.discount_value) > 100) {
      toast.error("Percentage cannot exceed 100"); return;
    }
    if (!form.start_date || !form.end_date) { toast.error("Start and end dates are required"); return; }
    if (form.end_date < form.start_date)    { toast.error("End date must be after start date"); return; }

    setSaving(true);
    try {
      const payload = {
        title:               form.title.trim(),
        description:         form.description.trim() || null,
        discount_type:       form.discount_type,
        discount_value:      Number(form.discount_value),
        min_order_amount:    Number(form.min_order_amount ?? 0),
        max_discount_amount: form.max_discount_amount ? Number(form.max_discount_amount) : null,
        start_date:          form.start_date,
        end_date:            form.end_date,
        is_active:           form.is_active,
        priority:            Number(form.priority ?? 0),
      };

      const url    = editId ? `/api/owner/offers/${editId}` : "/api/owner/offers";
      const method = editId ? "PATCH" : "POST";
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json   = await res.json();

      if (!res.ok) throw new Error(json.error ?? "Save failed");
      toast.success(editId ? "Offer updated ✅" : "Offer created ✅");
      closeForm();
      await loadOffers();
    } catch (err: any) {
      toast.error(err.message);
    }
    setSaving(false);
  }

  async function toggleOffer(offer: Offer) {
    setTogglingId(offer.id);
    try {
      const res  = await fetch(`/api/owner/offers/${offer.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !offer.is_active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setOffers((p) => p.map((o) => o.id === offer.id ? json.offer : o));
      toast.success(!offer.is_active ? "Offer enabled ✅" : "Offer disabled");
    } catch (err: any) {
      toast.error(err.message);
    }
    setTogglingId(null);
  }

  async function deleteOffer(id: string) {
    if (!confirm("Delete this offer? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/owner/offers/${id}`, { method: "DELETE" });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error); }
      setOffers((p) => p.filter((o) => o.id !== id));
      toast.success("Offer deleted");
    } catch (err: any) {
      toast.error(err.message);
    }
    setDeletingId(null);
  }

  return (
    <div className="p-5 md:p-8 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-bold text-2xl md:text-3xl" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-primary)" }}>
            🎉 Offers & Discounts
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Create and manage promotional offers for your customers
          </p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#f97316,#dc2626)" }}>
          <Plus size={16} /> New Offer
        </button>
      </div>

      {/* Offer Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-lg rounded-2xl overflow-y-auto max-h-[90vh]"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>

            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "var(--border)" }}>
              <h2 className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>
                {editId ? "Edit Offer" : "Create New Offer"}
              </h2>
              <button onClick={closeForm} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Title */}
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Offer Title *</label>
                <input value={form.title} onChange={(e) => setF("title", e.target.value)}
                  placeholder="e.g. 20% OFF on all orders!"
                  className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                  style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Description (optional)</label>
                <textarea value={form.description} onChange={(e) => setF("description", e.target.value)}
                  placeholder="e.g. Valid on minimum order of ₹299"
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 resize-none"
                  style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              </div>

              {/* Discount Type + Value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Discount Type *</label>
                  <select value={form.discount_type} onChange={(e) => setF("discount_type", e.target.value as DiscountType)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                    style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
                    Discount Value * {form.discount_type === "percentage" ? "(%)" : "(₹)"}
                  </label>
                  <input type="number" min="1" max={form.discount_type === "percentage" ? "100" : undefined}
                    value={form.discount_value} onChange={(e) => setF("discount_value", e.target.value)}
                    placeholder={form.discount_type === "percentage" ? "e.g. 20" : "e.g. 50"}
                    className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                    style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </div>
              </div>

              {/* Min Order + Max Discount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Min Order Amount (₹)</label>
                  <input type="number" min="0" value={form.min_order_amount}
                    onChange={(e) => setF("min_order_amount", e.target.value)}
                    placeholder="0 = no minimum"
                    className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                    style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Max Discount (₹) (optional)</label>
                  <input type="number" min="0" value={form.max_discount_amount}
                    onChange={(e) => setF("max_discount_amount", e.target.value)}
                    placeholder="Leave blank = no cap"
                    className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                    style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </div>
              </div>

              {/* Start + End Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Start Date *</label>
                  <input type="date" value={form.start_date} onChange={(e) => setF("start_date", e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                    style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>End Date *</label>
                  <input type="date" value={form.end_date} onChange={(e) => setF("end_date", e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                    style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </div>
              </div>

              {/* Priority + Active */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Display Priority</label>
                  <input type="number" min="0" value={form.priority} onChange={(e) => setF("priority", e.target.value)}
                    placeholder="0 = default, higher = shown first"
                    className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                    style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </div>
                <div className="flex flex-col justify-center">
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Status</label>
                  <button onClick={() => setF("is_active", !form.is_active)}
                    className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border",
                      form.is_active
                        ? "bg-green-500/15 border-green-500/30 text-green-400"
                        : "bg-red-500/10 border-red-500/20 text-red-400")}>
                    {form.is_active
                      ? <><ToggleRight size={18} /> Active</>
                      : <><ToggleLeft  size={18} /> Inactive</>}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button onClick={closeForm}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border transition-all"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  Cancel
                </button>
                <button onClick={saveOffer} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#f97316,#dc2626)" }}>
                  {saving ? <><Loader2 size={15} className="animate-spin" /> Saving...</> : <><Check size={15} /> {editId ? "Update Offer" : "Create Offer"}</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offers List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={32} className="animate-spin text-orange-500" />
        </div>
      ) : offers.length === 0 ? (
        <div className="text-center py-20 rounded-2xl"
          style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
          <Tag size={48} className="mx-auto mb-4 text-gray-500" />
          <p className="font-bold text-lg mb-1" style={{ color: "var(--text-primary)" }}>No offers yet</p>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Create your first promotional offer to attract customers</p>
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg,#f97316,#dc2626)" }}>
            <Plus size={15} /> Create Offer
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {offers.map((offer) => {
            const status = offerStatus(offer);
            const isDeleting  = deletingId  === offer.id;
            const isToggling  = togglingId  === offer.id;
            return (
              <div key={offer.id} className="rounded-2xl overflow-hidden"
                style={{ background: "var(--card-bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>

                {/* Card Header */}
                <div className="flex items-start gap-4 p-5"
                  style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.2)" }}>
                    🎉
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <h3 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>{offer.title}</h3>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `${status.color}20`, color: status.color, border: `1px solid ${status.color}40` }}>
                        {status.label}
                      </span>
                    </div>
                    {offer.description && (
                      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{offer.description}</p>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="rounded-xl p-3 text-center"
                      style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)" }}>
                      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Discount</p>
                      <p className="font-bold text-orange-500">
                        {offer.discount_type === "percentage"
                          ? `${offer.discount_value}%`
                          : formatPrice(offer.discount_value)}
                      </p>
                    </div>
                    <div className="rounded-xl p-3 text-center"
                      style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Min Order</p>
                      <p className="font-bold" style={{ color: "var(--text-primary)" }}>
                        {offer.min_order_amount > 0 ? formatPrice(offer.min_order_amount) : "None"}
                      </p>
                    </div>
                    <div className="rounded-xl p-3 text-center"
                      style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Max Disc.</p>
                      <p className="font-bold" style={{ color: "var(--text-primary)" }}>
                        {offer.max_discount_amount ? formatPrice(offer.max_discount_amount) : "No cap"}
                      </p>
                    </div>
                    <div className="rounded-xl p-3 text-center"
                      style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
                      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Priority</p>
                      <p className="font-bold" style={{ color: "var(--text-primary)" }}>{offer.priority}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span>📅 {offer.start_date} → {offer.end_date}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => toggleOffer(offer)} disabled={isToggling}
                      className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border disabled:opacity-60",
                        offer.is_active
                          ? "border-red-500/25 text-red-400 hover:bg-red-500/10"
                          : "border-green-500/25 text-green-400 hover:bg-green-500/10")}>
                      {isToggling ? <Loader2 size={12} className="animate-spin" /> : offer.is_active ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                      {offer.is_active ? "Disable" : "Enable"}
                    </button>

                    <button onClick={() => openEdit(offer)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all"
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                      <Pencil size={12} /> Edit
                    </button>

                    <button onClick={() => deleteOffer(offer.id)} disabled={isDeleting}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-60 ml-auto">
                      {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      {isDeleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
