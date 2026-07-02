"use client";
import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/lib/supabase/client";
import Image from "next/image";
import {
  ChevronLeft, Loader2, Upload, X, CheckCircle, Star, ImagePlus
} from "lucide-react";
import StarRating from "@/components/reviews/StarRating";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

const CATEGORY_RATINGS = [
  { key: "food_quality_rating", label: "Food Quality",         emoji: "🍽️" },
  { key: "taste_rating",        label: "Taste",                emoji: "😋" },
  { key: "packaging_rating",    label: "Packaging",            emoji: "📦" },
  { key: "delivery_rating",     label: "Delivery Experience",  emoji: "🛵" },
];

export default function WriteReviewPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [order,        setOrder]        = useState<any>(null);
  const [orderItems,   setOrderItems]   = useState<any[]>([]);
  const [existingReview, setExistingReview] = useState<any>(null);
  const [loading,      setLoading]      = useState(true);

  // Ratings
  const [overallRating, setOverallRating] = useState(0);
  const [catRatings,    setCatRatings]    = useState<Record<string, number>>({});
  const [comment,       setComment]       = useState("");
  const [itemRatings,   setItemRatings]   = useState<Record<string, { rating: number; comment: string }>>({});

  // Photos
  const [photos,        setPhotos]        = useState<File[]>([]);
  const [photoUrls,     setPhotoUrls]     = useState<string[]>([]);  // existing uploaded
  const [previews,      setPreviews]      = useState<string[]>([]);

  const [submitting,   setSubmitting]    = useState(false);
  const [submitted,    setSubmitted]     = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/auth/login"); return; }
    if (user) loadOrderData();
  }, [user, authLoading]);

  async function loadOrderData() {
    setLoading(true);
    try {
      // Fetch order
      const res  = await fetch(`/api/customer/orders/${orderId}`, { credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok || !json.order) { toast.error("Order not found"); router.back(); return; }

      const ord = json.order;
      if (ord.status !== "delivered") {
        toast.error("You can only review delivered orders");
        router.back(); return;
      }
      if (ord.user_id !== user!.id) {
        toast.error("Not your order");
        router.back(); return;
      }

      setOrder(ord);
      setOrderItems(ord.order_items ?? []);

      // Check existing review
      const revRes  = await fetch(`/api/reviews?orderId=${orderId}`);
      const revJson = await revRes.json();
      if (revJson.review) {
        const r = revJson.review;
        setExistingReview(r);
        setOverallRating(r.overall_rating);
        setComment(r.comment ?? "");
        setPhotoUrls(r.photos ?? []);
        const cats: Record<string, number> = {};
        CATEGORY_RATINGS.forEach(({ key }) => { if (r[key]) cats[key] = r[key]; });
        setCatRatings(cats);

        const items: Record<string, { rating: number; comment: string }> = {};
        (r.review_item_ratings ?? []).forEach((ir: any) => {
          items[ir.menu_item_id] = { rating: ir.rating, comment: ir.comment ?? "" };
        });
        setItemRatings(items);
      }
    } catch (e: any) {
      toast.error("Failed to load order");
    }
    setLoading(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const remaining = 5 - photos.length - photoUrls.length;
    if (files.length > remaining) {
      toast.error(`Max ${5 - photoUrls.length} more photos allowed`);
      return;
    }
    const valid = files.filter((f) => {
      if (f.size > 5 * 1024 * 1024) { toast.error(`${f.name} exceeds 5MB`); return false; }
      if (!["image/jpeg","image/jpg","image/png","image/webp"].includes(f.type)) {
        toast.error(`${f.name}: only JPG, PNG, WEBP allowed`); return false;
      }
      return true;
    });
    setPhotos((p) => [...p, ...valid]);
    setPreviews((p) => [...p, ...valid.map((f) => URL.createObjectURL(f))]);
  }

  function removeNewPhoto(idx: number) {
    setPhotos((p) => p.filter((_, i) => i !== idx));
    setPreviews((p) => p.filter((_, i) => i !== idx));
  }
  function removeExistingPhoto(url: string) {
    setPhotoUrls((p) => p.filter((u) => u !== url));
  }

  async function uploadPhotos(): Promise<string[]> {
    const uploaded: string[] = [];
    for (const file of photos) {
      const ext  = file.name.split(".").pop();
      const path = `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("review-photos").upload(path, file, { upsert: true });
      if (error) { console.error("Upload error:", error); continue; }
      const { data } = supabase.storage.from("review-photos").getPublicUrl(path);
      uploaded.push(data.publicUrl);
    }
    return uploaded;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!overallRating) { toast.error("Please select an overall rating"); return; }
    if (comment && comment.length > 0 && comment.length < 10) {
      toast.error("Comment must be at least 10 characters"); return;
    }

    setSubmitting(true);
    try {
      // Upload new photos
      const newUrls   = await uploadPhotos();
      const allPhotos = [...photoUrls, ...newUrls];

      // Build item_ratings array
      const item_ratings = orderItems.map((oi: any) => ({
        menu_item_id:  oi.menu_item_id,
        order_item_id: oi.id,
        rating:        itemRatings[oi.menu_item_id]?.rating ?? overallRating,
        comment:       itemRatings[oi.menu_item_id]?.comment || null,
      })).filter((ir) => ir.rating > 0);

      const payload = {
        order_id: orderId,
        overall_rating:      overallRating,
        food_quality_rating: catRatings["food_quality_rating"] || null,
        taste_rating:        catRatings["taste_rating"]        || null,
        packaging_rating:    catRatings["packaging_rating"]    || null,
        delivery_rating:     catRatings["delivery_rating"]     || null,
        comment:             comment.trim() || null,
        photos:              allPhotos,
        item_ratings,
      };

      let res: Response;
      if (existingReview) {
        // Edit existing
        res = await fetch(`/api/reviews/${existingReview.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, item_ratings }),
        });
      } else {
        // Create new
        res = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Submission failed");

      // Mark popup as done
      localStorage.setItem(`rp_${orderId}`, "done");
      setSubmitted(true);
      toast.success("Review submitted! Thank you ⭐");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={36} className="animate-spin text-orange-500" />
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-4 shadow-lg"
        style={{ background: "linear-gradient(135deg,#f97316,#dc2626)" }}>⭐</div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)", fontFamily: "'Outfit',sans-serif" }}>
        Thank You!
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        Your review helps us improve and helps other customers make great choices.
      </p>
      <button onClick={() => router.push("/menu")}
        className="btn-primary px-8 py-3 font-semibold">
        Back to Menu
      </button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()}
          className="p-2 rounded-xl transition-colors hover:opacity-70"
          style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="font-bold text-xl sm:text-2xl" style={{ fontFamily: "'Outfit',sans-serif", color: "var(--text-primary)" }}>
            {existingReview ? "Edit Your Review" : "Write a Review"}
          </h1>
          {order && (
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Order #{order.order_number}
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Overall Rating */}
        <div className="rounded-2xl p-5"
          style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
          <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Overall Experience *</p>
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>How would you rate this order overall?</p>
          <StarRating value={overallRating} onChange={setOverallRating} size={36} showLabel />
        </div>

        {/* Category Ratings */}
        <div className="rounded-2xl p-5 space-y-4"
          style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Rate Specific Aspects</p>
          {CATEGORY_RATINGS.map(({ key, label, emoji }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {emoji} {label}
              </span>
              <StarRating
                value={catRatings[key] ?? 0}
                onChange={(v) => setCatRatings((p) => ({ ...p, [key]: v }))}
                size={22}
              />
            </div>
          ))}
        </div>

        {/* Item Ratings */}
        {orderItems.length > 0 && (
          <div className="rounded-2xl p-5"
            style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
            <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Rate Each Item</p>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              Tap the stars to rate individual dishes
            </p>
            <div className="space-y-4">
              {orderItems.map((oi: any) => (
                <div key={oi.id} className="border-b pb-4 last:border-0 last:pb-0"
                  style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="font-medium text-sm truncate" style={{ color: "var(--text-primary)" }}>
                      {oi.name}
                    </p>
                    <StarRating
                      value={itemRatings[oi.menu_item_id]?.rating ?? 0}
                      onChange={(v) => setItemRatings((p) => ({
                        ...p,
                        [oi.menu_item_id]: { ...p[oi.menu_item_id], rating: v },
                      }))}
                      size={20}
                    />
                  </div>
                  <input
                    value={itemRatings[oi.menu_item_id]?.comment ?? ""}
                    onChange={(e) => setItemRatings((p) => ({
                      ...p,
                      [oi.menu_item_id]: { ...p[oi.menu_item_id], comment: e.target.value },
                    }))}
                    placeholder="Optional comment for this item…"
                    maxLength={200}
                    className="w-full text-xs rounded-lg px-3 py-2 outline-none"
                    style={{
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border)",
                      color: "var(--text-secondary)",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Written Review */}
        <div className="rounded-2xl p-5"
          style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
          <label className="font-semibold block mb-1" style={{ color: "var(--text-primary)" }}>
            Your Review
          </label>
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            Min 10, max 1000 characters (optional but helpful!)
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your honest experience — taste, quality, delivery time…"
            rows={5}
            maxLength={1000}
            className="w-full text-sm rounded-xl p-3 resize-none outline-none focus:ring-2 focus:ring-orange-400"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          />
          <div className="flex justify-between mt-1">
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {comment.length > 0 && comment.length < 10 ? "Minimum 10 characters" : ""}
            </p>
            <p className="text-[10px]" style={{ color: comment.length > 900 ? "#ef4444" : "var(--text-muted)" }}>
              {comment.length}/1000
            </p>
          </div>
        </div>

        {/* Photo Upload */}
        <div className="rounded-2xl p-5"
          style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
          <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Add Photos</p>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            Up to 5 photos (JPG, PNG, WEBP • max 5MB each)
          </p>

          <div className="flex flex-wrap gap-3">
            {/* Existing uploaded photos */}
            {photoUrls.map((url, i) => (
              <div key={`ex-${i}`} className="relative w-20 h-20 rounded-xl overflow-hidden">
                <Image src={url} alt="Uploaded" fill className="object-cover" />
                <button type="button" onClick={() => removeExistingPhoto(url)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center">
                  <X size={10} />
                </button>
              </div>
            ))}
            {/* New photo previews */}
            {previews.map((url, i) => (
              <div key={`new-${i}`} className="relative w-20 h-20 rounded-xl overflow-hidden">
                <Image src={url} alt="Preview" fill className="object-cover" />
                <button type="button" onClick={() => removeNewPhoto(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center">
                  <X size={10} />
                </button>
              </div>
            ))}
            {/* Upload button */}
            {(photos.length + photoUrls.length) < 5 && (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-20 h-20 rounded-xl flex flex-col items-center justify-center gap-1 transition-all hover:opacity-80"
                style={{ border: "2px dashed var(--border)", color: "var(--text-muted)" }}>
                <ImagePlus size={20} />
                <span className="text-[9px]">Add</span>
              </button>
            )}
          </div>

          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
            multiple className="hidden"
            onChange={handleFileChange} />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !overallRating}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#f97316,#dc2626)" }}
        >
          {submitting ? (
            <><Loader2 size={18} className="animate-spin" /> Submitting…</>
          ) : (
            <><Star size={18} /> {existingReview ? "Update Review" : "Submit Review"}</>
          )}
        </button>

        {existingReview && (
          <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
            Reviews can be edited within 24 hours of submission.
          </p>
        )}
      </form>
    </div>
  );
}
