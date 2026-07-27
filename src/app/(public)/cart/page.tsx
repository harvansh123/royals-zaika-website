"use client";
import { useCartStore } from "@/stores/cartStore";
import { useAuthStore } from "@/stores/authStore";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2, ArrowRight, ShoppingBag, ChevronLeft, Tag } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useState, useEffect, useMemo } from "react";

type ActiveOffer = {
  id: string; title: string; description: string | null;
  discount_type: "percentage" | "flat"; discount_value: number;
  min_order_amount: number; max_discount_amount: number | null;
};

function calcDiscount(offer: ActiveOffer, sub: number): number {
  if (sub < offer.min_order_amount) return 0;
  let d = offer.discount_type === "percentage"
    ? (sub * offer.discount_value) / 100
    : offer.discount_value;
  if (offer.max_discount_amount) d = Math.min(d, offer.max_discount_amount);
  return Math.round(Math.min(d, sub) * 100) / 100;
}

export default function CartPage() {
  const router = useRouter();
  const { items, updateQty, removeItem, subtotal, deliveryFee, total } = useCartStore();
  const { user } = useAuthStore();
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const [activeOffer, setActiveOffer] = useState<ActiveOffer | null>(null);

  const sub     = subtotal();
  const fee     = deliveryFee();
  // Offer discount (calculated fresh — not persisted in cart store)
  const offerDiscount = useMemo(() => activeOffer ? calcDiscount(activeOffer, sub) : 0, [activeOffer, sub]);
  const grand   = Math.max(0, sub + fee - offerDiscount);
  const freeAt  = 499;
  const progress = Math.min((sub / freeAt) * 100, 100);

  // Restaurant open/closed status
  const [isRestaurantOpen, setIsRestaurantOpen] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/restaurant-settings")
      .then(r => r.json())
      .then(d => setIsRestaurantOpen(d.is_open !== false))
      .catch(() => setIsRestaurantOpen(true));
    // Fetch active offer
    fetch("/api/offers")
      .then(r => r.json())
      .then(d => setActiveOffer(d.offer ?? null))
      .catch(() => {});
  }, []);

  if (items.length === 0) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center max-w-xs">
          <div className="w-24 h-24 mx-auto mb-6 rounded-3xl flex items-center justify-center text-5xl"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            🛒
          </div>
          <h2 className="font-bold text-2xl text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Your cart is empty
          </h2>
          <p className="text-gray-500 mb-8 text-sm">Add some delicious dishes to get started!</p>
          <Link href="/menu" className="btn-primary inline-flex items-center gap-2 py-3 px-6">
            <ShoppingBag size={18} /> Browse Menu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-10">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="font-bold text-2xl text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Your Cart
          </h1>
          <p className="text-gray-500 text-sm">{items.reduce((s, i) => s + i.quantity, 0)} items</p>
        </div>
      </div>

      {/* Free delivery progress */}
      {sub >= freeAt ? (
        <div className="mb-5 p-4 rounded-2xl flex items-center gap-3"
          style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
          <span className="text-xl">🎉</span>
          <div>
            <p className="text-green-400 font-bold text-sm">Free Delivery Unlocked!</p>
            <p className="text-green-400/70 text-xs">Your order qualifies for free delivery</p>
          </div>
        </div>
      ) : fee > 0 && (
        <div className="mb-5 p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Add <span className="text-green-400 font-semibold">{formatPrice(Math.max(0, freeAt - sub))}</span> more for free delivery</span>
            <span className="text-green-400">FREE</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-green-400 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="space-y-3 mb-6">
        {items.map(({ id, menu_item, quantity }) => (
          <div key={id} className="flex gap-4 p-4 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>

            {/* Image */}
            <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-gray-800">
              {menu_item.image_url && !imgErrors[id] ? (
                <Image src={menu_item.image_url} alt={menu_item.name} width={80} height={80}
                  className="object-cover w-full h-full"
                  onError={() => setImgErrors((p) => ({ ...p, [id]: true }))} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl">🍽️</div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5">
                  <div className={`w-3.5 h-3.5 rounded-sm border-2 flex-shrink-0 flex items-center justify-center
                    ${menu_item.is_veg ? "border-green-500" : "border-red-500"}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${menu_item.is_veg ? "bg-green-500" : "bg-red-500"}`} />
                  </div>
                  <p className="font-semibold text-white text-sm leading-snug line-clamp-2">{menu_item.name}</p>
                </div>
                <button onClick={() => { removeItem(id); toast.success("Removed"); }}
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>

              <p className="font-bold text-orange-400 text-sm mb-3">
                {formatPrice((menu_item.discounted_price ?? menu_item.price) * quantity)}
                {quantity > 1 && (
                  <span className="text-gray-500 font-normal text-xs ml-1">
                    (₹{menu_item.discounted_price ?? menu_item.price} × {quantity})
                  </span>
                )}
              </p>

              {/* Quantity controls */}
              <div className="flex items-center gap-1 w-fit">
                <button onClick={() => updateQty(id, quantity - 1)}
                  className="w-8 h-8 rounded-lg border border-orange-500/50 flex items-center justify-center text-orange-400 hover:bg-orange-500/10 transition-colors">
                  <Minus size={14} />
                </button>
                <span className="w-9 text-center text-white font-bold text-sm">{quantity}</span>
                <button onClick={() => updateQty(id, quantity + 1)}
                  className="w-8 h-8 rounded-lg border border-orange-500/50 flex items-center justify-center text-orange-400 hover:bg-orange-500/10 transition-colors">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add more link */}
      <Link href="/menu" className="flex items-center gap-2 text-orange-400 text-sm font-medium mb-6 hover:text-orange-300 transition-colors">
        <ShoppingBag size={15} /> Add more items
      </Link>



      {/* Restaurant Closed Banner */}
      {isRestaurantOpen === false && (
        <div className="mb-5 p-4 rounded-2xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
          <p className="text-red-400 font-bold text-sm flex items-center gap-2">
            🔴 Restaurant is Currently Closed
          </p>
          <p className="text-red-400/80 text-xs mt-1">
            We are not accepting new orders right now. Please try again later.
          </p>
        </div>
      )}

      {/* Proceed to Address / Checkout */}
      <button
        onClick={() => {
          if (!user) { toast.error("Please login first"); router.push("/auth/login"); return; }
          if (isRestaurantOpen === false) { toast.error("Restaurant is currently closed. Please try again later."); return; }
          router.push("/checkout/address");
        }}
        disabled={isRestaurantOpen === false}
        className="w-full btn-primary flex items-center justify-between py-4 px-6 text-base rounded-2xl disabled:opacity-60"
      >
        <span className="font-bold">
          {isRestaurantOpen === false ? "🔴 Restaurant Closed" : "Proceed to Checkout"}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-bold">{formatPrice(sub)}</span>
          <ArrowRight size={18} />
        </div>
      </button>
    </div>
  );
}
