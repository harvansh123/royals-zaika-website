"use client";
import { useEffect, useState, use } from "react";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/lib/supabase/client";
import { MenuItem, Category } from "@/lib/database.types";
import { Star, Clock, Flame, Plus, Minus, Heart } from "lucide-react";
import Image from "next/image";
import { useCartStore } from "@/stores/cartStore";
import { formatPrice, getSpiceLabel } from "@/lib/utils";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

export default function FoodDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [item, setItem]       = useState<MenuItem | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { items, addItem, updateQty } = useCartStore();
  const { user } = useAuthStore();
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const cartItem = item ? items.find((i) => i.id === item.id) : null;
  const qty = cartItem?.quantity ?? 0;

  useEffect(() => {
    async function load() {
      const { data: menuItem } = await supabase
        .from("menu_items").select("*").eq("slug", slug).single();
      if (!menuItem) { setLoading(false); return; }
      setItem(menuItem);

      const [{ data: cat }, { data: revs }] = await Promise.all([
        supabase.from("categories").select("*").eq("id", menuItem.category_id).single(),
        supabase.from("reviews").select("*, users(name, avatar_url)").eq("menu_item_id", menuItem.id).order("created_at", { ascending: false }).limit(10),
      ]);
      setCategory(cat);
      setReviews(revs ?? []);
      setLoading(false);
    }
    load();
  }, [slug]);

  async function submitReview() {
    if (!user) { toast.error("Login to submit a review"); return; }
    if (!item) return;
    setSubmitting(true);
    const { error } = await supabase.from("reviews").upsert({
      user_id: user.id, menu_item_id: item.id, rating: newRating, comment: newComment
    }, { onConflict: "user_id,menu_item_id,order_id" });
    if (error) toast.error("Failed to submit review");
    else { toast.success("Review submitted!"); setNewComment(""); }
    // Refresh reviews
    const { data: revs } = await supabase.from("reviews").select("*, users(name, avatar_url)").eq("menu_item_id", item.id).order("created_at", { ascending: false }).limit(10);
    setReviews(revs ?? []);
    setSubmitting(false);
  }

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-pulse space-y-4">
      <div className="skeleton h-72 rounded-2xl shimmer" />
      <div className="skeleton h-8 w-3/4 shimmer" />
      <div className="skeleton h-4 w-full shimmer" />
    </div>
  );

  if (!item) return (
    <div className="min-h-screen flex items-center justify-center text-center">
      <div><div className="text-6xl mb-4">🍽️</div><h2 className="text-xl text-white">Dish not found</h2></div>
    </div>
  );

  const price = item.discounted_price ?? item.price;
  const hasDiscount = item.discounted_price && item.discounted_price < item.price;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-32">
      {/* Image */}
      <div className="relative h-72 md:h-96 rounded-3xl overflow-hidden mb-6 bg-[#1a1a2e]">
        {item.image_url ? (
          <Image src={item.image_url} alt={item.name} fill className="object-cover" sizes="(max-width:768px) 100vw, 768px" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-8xl">🍽️</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Badges */}
        <div className="absolute top-4 left-4 flex gap-2">
          {item.is_bestseller && <span className="badge-brand">🏆 Bestseller</span>}
          {hasDiscount && <span className="badge bg-green-500/20 text-green-300 border border-green-500/20">{Math.round((1 - item.discounted_price! / item.price) * 100)}% OFF</span>}
        </div>

        {/* Veg */}
        <div className="absolute top-4 right-4">
          <div className={cn("w-6 h-6 rounded border-2 flex items-center justify-center bg-black/40", item.is_veg ? "border-green-500" : "border-red-500")}>
            <div className={cn("w-3 h-3 rounded-full", item.is_veg ? "bg-green-500" : "bg-red-500")} />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="mb-6">
        {category && <p className="text-brand text-xs font-medium mb-1">{category.icon} {category.name}</p>}
        <h1 className="font-display font-bold text-2xl md:text-3xl text-white mb-2">{item.name}</h1>
        {item.description && <p className="text-gray-400 leading-relaxed">{item.description}</p>}

        {/* Meta Tags */}
        <div className="flex flex-wrap gap-3 mt-4">
          {item.rating > 0 && (
            <div className="flex items-center gap-1.5 badge bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
              <Star size={12} fill="currentColor" />{item.rating.toFixed(1)} ({item.review_count} reviews)
            </div>
          )}
          <div className="flex items-center gap-1.5 badge bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Clock size={12} />{item.preparation_time} min
          </div>
          <div className="flex items-center gap-1.5 badge bg-red-500/10 text-red-400 border border-red-500/20">
            <Flame size={12} />{getSpiceLabel(item.spice_level)}
          </div>
          {item.calories && (
            <div className="badge bg-purple-500/10 text-purple-400 border border-purple-500/20">
              {item.calories} kcal
            </div>
          )}
        </div>
      </div>

      {/* Price + Cart */}
      <div className="glass rounded-2xl p-5 mb-6 flex items-center justify-between">
        <div>
          <p className="font-display font-bold text-3xl text-white">{formatPrice(price)}</p>
          {hasDiscount && <p className="text-gray-500 line-through text-sm">{formatPrice(item.price)}</p>}
        </div>
        {qty === 0 ? (
          <button
            onClick={() => { addItem(item); toast.success(`${item.name} added!`, { icon: "🛒" }); }}
            className="btn-primary flex items-center gap-2 py-3 px-6"
          >
            <Plus size={18} /> Add to Cart
          </button>
        ) : (
          <div className="flex items-center gap-3 glass rounded-xl px-2 py-1.5 border border-brand/30">
            <button onClick={() => updateQty(item.id, qty - 1)} className="w-9 h-9 flex items-center justify-center text-brand hover:bg-brand/10 rounded-lg">
              <Minus size={16} />
            </button>
            <span className="text-white font-bold text-lg w-6 text-center">{qty}</span>
            <button onClick={() => updateQty(item.id, qty + 1)} className="w-9 h-9 flex items-center justify-center text-brand hover:bg-brand/10 rounded-lg">
              <Plus size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Reviews */}
      <div className="mb-6">
        <h2 className="font-semibold text-xl text-white mb-4">Customer Reviews</h2>

        {/* Write Review */}
        {user && (
          <div className="glass rounded-2xl p-5 mb-5">
            <p className="text-sm font-medium text-white mb-3">Rate this dish</p>
            <div className="flex gap-2 mb-3">
              {[1,2,3,4,5].map((n) => (
                <button key={n} onClick={() => setNewRating(n)}>
                  <Star size={24} className={n <= newRating ? "text-yellow-400 fill-yellow-400" : "text-gray-600"} />
                </button>
              ))}
            </div>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Share your experience..."
              className="input-field resize-none h-20 text-sm mb-3"
            />
            <button onClick={submitReview} disabled={submitting} className="btn-primary py-2 px-5 text-sm">
              {submitting ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        )}

        {reviews.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No reviews yet. Be the first!</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((rev) => (
              <div key={rev.id} className="glass rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 gradient-brand rounded-full flex items-center justify-center text-sm font-bold">
                    {(rev.users?.name ?? "U")[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{rev.users?.name ?? "Anonymous"}</p>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map((n) => (
                        <Star key={n} size={11} className={n <= rev.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-700"} />
                      ))}
                    </div>
                  </div>
                </div>
                {rev.comment && <p className="text-sm text-gray-400">{rev.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
