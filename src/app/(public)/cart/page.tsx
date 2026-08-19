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
import { trackBeginCheckout } from "@/lib/gtag";

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
  const { items, updateQty, removeItem, subtotal, total } = useCartStore();
  const { user } = useAuthStore();
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const [activeOffer, setActiveOffer] = useState<ActiveOffer | null>(null);
  // State declared before computed variables that reference them
  const [isRestaurantOpen, setIsRestaurantOpen] = useState<boolean | null>(null);
  const [freeDeliveryMin, setFreeDeliveryMin]   = useState(499); // from restaurant settings

  const sub     = subtotal();
  // Offer discount (calculated fresh — not persisted in cart store)
  const offerDiscount = useMemo(() => activeOffer ? calcDiscount(activeOffer, sub) : 0, [activeOffer, sub]);
  // Grand total shown in cart: subtotal - discount only (delivery calculated at checkout after address)
  const grand   = Math.max(0, sub - offerDiscount);
  const freeAt  = freeDeliveryMin; // owner-configured, loaded from restaurant settings
  const progress = Math.min((sub / freeAt) * 100, 100);


  useEffect(() => {
    fetch("/api/restaurant-settings")
      .then(r => r.json())
      .then(d => {
        setIsRestaurantOpen(d.is_open !== false);
        setFreeDeliveryMin(Number(d.free_delivery_min_order ?? 499));
      })
      .catch(() => setIsRestaurantOpen(true));
    // Fetch active offer
    fetch("/api/offers")
      .then(r => r.json())
      .then(d => setActiveOffer(d.offer ?? null))
      .catch(() => {});
  }, []);

  // ── OTP for last placed order (shown on empty cart) ─────────────────
  const [lastOrderOtp,    setLastOrderOtp]    = useState<string | null>(null);
  const [lastOrderNum,    setLastOrderNum]    = useState<string | null>(null);
  const [otpLoading,      setOtpLoading]      = useState(false);

  useEffect(() => {
    const lastOrderId = sessionStorage.getItem("cj_last_order_id");
    if (!lastOrderId) return;
    setOtpLoading(true);
    // Fetch OTP from notifications table (customer can read own notifications)
    (async () => {
      try {
        const { supabase } = await import("@/lib/supabase/client");
        const { data: notifs } = await supabase
          .from("notifications")
          .select("data")
          .eq("type", "delivery_otp")
          .order("created_at", { ascending: false });
        const notif = (notifs ?? []).find((n: any) => n.data?.order_id === lastOrderId);
        if (notif?.data?.otp) {
          setLastOrderOtp(notif.data.otp);
          setLastOrderNum(notif.data.order_number ?? null);
        }
      } catch {
        // silent — OTP just won't show
      } finally {
        setOtpLoading(false);
      }
    })();
  }, []);

  if (items.length === 0) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center max-w-sm w-full">

          {/* ── OTP Card (shown if last order has OTP) ── */}
          {otpLoading && (
            <div className="mb-6 p-5 rounded-2xl flex items-center justify-center gap-3"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)" }}>
              <div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
              <p className="text-sm text-gray-400">Loading your Delivery OTP...</p>
            </div>
          )}

          {!otpLoading && lastOrderOtp && (
            <div className="mb-6 rounded-2xl overflow-hidden"
              style={{ background: "linear-gradient(145deg,rgba(99,102,241,0.15),rgba(99,102,241,0.05))", border: "2px solid rgba(99,102,241,0.5)", boxShadow: "0 8px 32px rgba(99,102,241,0.15)" }}>

              {/* Header */}
              <div className="px-5 pt-5 pb-3 flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <h2 className="font-black text-lg text-indigo-400">Delivery OTP</h2>
                {lastOrderNum && <span className="text-xs text-gray-500">• Order #{lastOrderNum}</span>}
              </div>

              {/* OTP Digits */}
              <div className="flex justify-center gap-2 px-4 pb-5">
                {lastOrderOtp.split("").map((digit, i) => (
                  <div key={i}
                    className="w-12 h-14 rounded-xl flex items-center justify-center font-black text-3xl text-white shadow-lg"
                    style={{ background: "rgba(99,102,241,0.4)", border: "1px solid rgba(99,102,241,0.8)" }}>
                    {digit}
                  </div>
                ))}
              </div>

              {/* Warning messages */}
              <div className="mx-4 mb-4 rounded-xl px-4 py-3"
                style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)" }}>
                <p className="text-sm font-semibold text-amber-400 mb-1 text-center">
                  ⚠️ Share this OTP with the delivery rider only after you have received your complete order.
                </p>
                <p className="text-xs text-amber-400/70 text-center font-medium">
                  Never share this OTP before receiving your order.
                </p>
              </div>
            </div>
          )}

          {/* Empty cart icon + text */}
          <div className="w-24 h-24 mx-auto mb-6 rounded-3xl flex items-center justify-center text-5xl"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            🛒
          </div>
          <h2 className="font-bold text-2xl text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
            {lastOrderOtp ? "Order Placed Successfully!" : "Your cart is empty"}
          </h2>
          <p className="text-gray-500 mb-8 text-sm">
            {lastOrderOtp ? "Your food is being prepared 🍛" : "Add some delicious dishes to get started!"}
          </p>
          <Link href="/menu" className="btn-primary inline-flex items-center gap-2 py-3 px-6">
            <ShoppingBag size={18} /> Continue to Browse Menu
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
      ) : sub < freeAt && (
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
          // GA4: begin_checkout — fires only when user is logged in + restaurant open
          trackBeginCheckout({
            value: grand,
            items: items.map((i) => ({
              id:       i.id,
              name:     i.menu_item.name,
              price:    i.menu_item.discounted_price ?? i.menu_item.price,
              quantity: i.quantity,
            })),
          });
          router.push("/checkout/address");
        }}
        disabled={isRestaurantOpen === false}
        className="w-full btn-primary flex items-center justify-between py-4 px-6 text-base rounded-2xl disabled:opacity-60"
      >
        <span className="font-bold">
          {isRestaurantOpen === false ? "🔴 Restaurant Closed" : "Proceed to Checkout"}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-bold">{formatPrice(grand)}</span>
          <ArrowRight size={18} />
        </div>
      </button>

      {/* Delivery charge note */}
      <p className="text-center text-xs mt-3" style={{ color: "var(--text-muted)" }}>
        🚚 Delivery charge will be calculated after address selection
      </p>
    </div>
  );
}
