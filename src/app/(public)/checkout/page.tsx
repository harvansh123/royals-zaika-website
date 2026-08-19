"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/stores/cartStore";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/lib/supabase/client";
import { ChevronLeft, Loader2, Check, Smartphone, Banknote, CreditCard, MapPin, Tag, X, Receipt, ArrowRight } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import Image from "next/image";
import { ADDRESS_SESSION_KEY } from "@/app/(public)/checkout/address/page";
import { RestaurantSettings } from "@/lib/haversine";
import { getDeliveryPricing, getDeliveryPricingFromRates, DeliveryRates, DEFAULT_DELIVERY_RATES } from "@/lib/deliveryPricing";
import { useRestaurantStatus } from "@/hooks/useRestaurantStatus";
import ClosedPopup from "@/components/restaurant/ClosedPopup";
import { trackPurchase } from "@/lib/gtag";

declare global { interface Window { Razorpay: any; } }

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

type PayMethod = "upi" | "cod" | "card";

const PAY_OPTIONS: { id: PayMethod; icon: any; label: string; desc: string }[] = [
  { id: "upi",  icon: Smartphone, label: "UPI",              desc: "Google Pay, PhonePe, Paytm & more" },
  { id: "card", icon: CreditCard, label: "Credit / Debit Card", desc: "Visa, Mastercard, RuPay"           },
  { id: "cod",  icon: Banknote,   label: "Cash on Delivery", desc: "Pay when your order arrives"         },
];

export default function CheckoutPage() {
  const router  = useRouter();
  const { user, loading: authLoading } = useAuthStore();
  const { items, subtotal, deliveryFee, total, clearCart } = useCartStore();

  const [payMethod,       setPayMethod]       = useState<PayMethod>("cod");  // default COD
  const [placing,         setPlacing]         = useState(false);
  const orderPlacedRef = useRef(false); // prevents redirect to /cart after clearCart()
  const [imgErrors,       setImgErrors]       = useState<Record<string, boolean>>({});
  const [deliveryAddress, setDeliveryAddress] = useState<any>(null);
  const [settings,        setSettings]        = useState<RestaurantSettings | null>(null);
  const [activeOffer,     setActiveOffer]     = useState<ActiveOffer | null>(null);
  const [showCodPopup,    setShowCodPopup]    = useState(false);
  const [checkoutStep,    setCheckoutStep]    = useState<"bill" | "payment">("bill");
  // Referral reward
  const [referralReward,  setReferralReward]  = useState<{ id: string; reward_amount: number } | null>(null);
  // Owner-configured delivery rates (loaded from restaurant-settings)
  const [deliveryRates,   setDeliveryRates]   = useState<DeliveryRates>(DEFAULT_DELIVERY_RATES);

  // ── Restaurant timing-aware open/closed status ────────────────────────────
  const {
    isOpen: restaurantIsOpen,
    isTemporarilyClosed,
    openingTimeFormatted,
    closingTimeFormatted,
  } = useRestaurantStatus();

  const sub   = subtotal();
  const fee   = deliveryFee();
  // Distance info for bill display — use owner-configured per-km rates
  const distKm = deliveryAddress?.delivery_distance_km ?? null;
  // Use owner-configured rates when address (and thus distance) is known
  const pricing = distKm
    ? getDeliveryPricingFromRates(distKm, sub, deliveryRates)
    : getDeliveryPricing(distKm, sub); // fallback before address selected

  // Offer discount calculated fresh from current offer state
  const offerDiscount = useMemo(() => activeOffer ? calcDiscount(activeOffer, sub) : 0, [activeOffer, sub]);
  // Referral reward amount (0 if none available)
  const referralDiscount = referralReward ? Number(referralReward.reward_amount) : 0;
  // Apply whichever discount is bigger (no stacking)
  const bestDiscount = Math.max(offerDiscount, referralDiscount);
  const activeDiscountSource: "offer" | "referral" | "none" =
    bestDiscount === 0 ? "none" : offerDiscount >= referralDiscount ? "offer" : "referral";
  // Use actual customer fee from pricing (handles free delivery), else fallback to cartStore fee
  const actualFee = pricing?.customerFee ?? fee;
  const grand = Math.max(0, sub + actualFee - bestDiscount);

  useEffect(() => {
    if (authLoading) return;
    if (!user)         { router.push("/auth/login");       return; }
    if (!items.length && !orderPlacedRef.current) { router.push("/cart"); return; }

    // If order was already placed, skip all address/session checks.
    // clearCart() causes items.length → 0 which re-triggers this effect,
    // but by then sessionStorage is already cleared — causing a false
    // "Please select address first" toast. Bail out early to prevent it.
    if (orderPlacedRef.current) return;

    // Read address selected at /checkout/address
    const stored = sessionStorage.getItem(ADDRESS_SESSION_KEY);
    if (!stored) {
      toast.error("Please select a delivery address first");
      router.push("/checkout/address");
      return;
    }
    try {
      const addr = JSON.parse(stored);
      setDeliveryAddress(addr);

      // Load settings for final validation + delivery rates
      fetch("/api/restaurant-settings")
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setSettings(data);
            // Load owner-configured delivery rates (with defaults if columns missing)
            setDeliveryRates({
              delivery_charge_per_km:    Number(data.delivery_charge_per_km    ?? 10),
              owner_contribution_per_km: Number(data.owner_contribution_per_km ?? 5),
              rider_payout_per_km:       Number(data.rider_payout_per_km       ?? 15),
              free_delivery_min_order:   Number(data.free_delivery_min_order   ?? 499),
            });
            // Use the Google driving distance already calculated when the address was confirmed.
            const storedDist = addr.delivery_distance_km;
            if (storedDist && storedDist > data.delivery_radius_km) {
              toast.error(`Sorry, delivery is only available within ${data.delivery_radius_km} KM. This address is outside our delivery area.`);
              router.push("/checkout/address");
            }
          }
        });

      // Fetch active offer
      fetch("/api/offers")
        .then(r => r.json())
        .then(d => setActiveOffer(d.offer ?? null))
        .catch(() => {});

      // Fetch best available referral reward
      fetch("/api/referral/my-referrals")
        .then(r => r.json())
        .then(d => { if (d.bestReward) setReferralReward(d.bestReward); })
        .catch(() => {});

      // COD popup will be shown when user navigates to payment step
    } catch { router.push("/checkout/address"); }
  }, [user, authLoading, items.length, router]);

  async function placeOrder() {
    if (!user) return;

    // PRIMARY CHECK: delivery_distance_km is set by confirmAndContinue only after
    // distance is calculated AND address is within delivery radius. If it is missing,
    // the customer bypassed the address validation flow — block the order.
    if (!deliveryAddress?.delivery_distance_km || deliveryAddress.delivery_distance_km <= 0) {
      toast.error("Delivery distance could not be verified. Please go back and select a valid delivery address.");
      return;
    }

    // SECONDARY CHECK: coordinates must be present for final server-side radius validation.
    if (!deliveryAddress?.latitude || !deliveryAddress?.longitude) {
      toast.error("Delivery address location could not be verified. Please go back and re-select your address.");
      return;
    }

    // Restaurant open/closed check (timing-aware: auto/manual/temporarily_closed)
    if (!restaurantIsOpen) {
      toast.error(
        isTemporarilyClosed
          ? "Restaurant is temporarily closed. Please try again later."
          : "Restaurant is currently closed. Please try again later.",
        { icon: "🔴" }
      );
      return;
    }

    // Final radius validation using the Google driving distance stored at address selection
    if (settings && deliveryAddress.delivery_distance_km) {
      if (deliveryAddress.delivery_distance_km > settings.delivery_radius_km) {
        toast.error(`Address is outside delivery radius (${settings.delivery_radius_km} KM max).`);
        return;
      }
    }

    setPlacing(true);

    try {
      // Ensure user row exists (FK safety)
      await supabase.from("users").upsert({
        id:    user.id,
        email: user.email ?? "",
        name:  user.name  ?? "Guest",
        role:  "customer",
      }, { onConflict: "id" });

      const method = payMethod === "upi" || payMethod === "card" ? "razorpay" : "cash_on_delivery";

      // Calculate final amounts — use bigger of offer or referral discount
      const discountAmt = bestDiscount;
      // Use actual customer delivery fee from pricing (handles free delivery)
      const actualPricingForOrder = getDeliveryPricingFromRates(deliveryAddress?.delivery_distance_km ?? null, sub, deliveryRates);
      const actualCustomerFee = actualPricingForOrder?.customerFee ?? fee;
      const finalTotal = Math.max(0, sub + actualCustomerFee - discountAmt);

      // Use the Google driving distance that was calculated (and stored) when the customer
      // confirmed their delivery address. This is the single source of truth for order records.
      const orderDistanceKm = deliveryAddress.delivery_distance_km ?? null;

      const pricingForOrder = getDeliveryPricingFromRates(orderDistanceKm, sub, deliveryRates);

      // Determine actual customer delivery charge (0 if free delivery)
      const customerDeliveryCharge = pricingForOrder?.customerFee ?? fee;
      const dynamicOwnerContribution = pricingForOrder?.ownerContribution ?? 0;

      // Create order
      const { data: order, error: orderErr } = await supabase.from("orders").insert({
        user_id:          user.id,
        status:           "pending",
        payment_method:   method,
        payment_status:   "pending",
        subtotal:         sub,
        delivery_fee:     customerDeliveryCharge, // ₹0 if free delivery, else distance-based
        rider_payout:       pricingForOrder?.riderPayout ?? null,
        owner_contribution: dynamicOwnerContribution,
        distance_range:     pricingForOrder?.rangeLabel ?? null,
        discount_amount:  discountAmt,
        total_amount:     finalTotal,
        estimated_time:   30,
        delivery_distance_km: orderDistanceKm,
        radius_validated: true,
        delivery_address: deliveryAddress
          ? {
              label:         deliveryAddress.label,
              address_line1: deliveryAddress.address_line1,
              address_line2: deliveryAddress.address_line2 ?? null,
              city:          deliveryAddress.city,
              state:         deliveryAddress.state,
              pincode:       deliveryAddress.pincode,
              // Verified coordinates — used by rider dashboard for GPS navigation
              latitude:      (deliveryAddress as any).latitude  ?? null,
              longitude:     (deliveryAddress as any).longitude ?? null,
            }
          : null,

      }).select("id,order_number").single();

      if (orderErr || !order) throw new Error(orderErr?.message ?? "Order failed");

      // Insert order items
      await supabase.from("order_items").insert(
        items.map((i) => ({
          order_id:     order.id,
          menu_item_id: i.menu_item.id,
          name:         i.menu_item.name,
          price:        i.menu_item.discounted_price ?? i.menu_item.price,
          quantity:     i.quantity,
          subtotal:     (i.menu_item.discounted_price ?? i.menu_item.price) * i.quantity,
        }))
      );

      // COD flow — use finalTotal (after best discount applied)
      if (method === "cash_on_delivery") {
        await supabase.from("payments").insert({ order_id: order.id, amount: finalTotal, method: "cash_on_delivery", status: "pending" });
        await fetch("/api/generate-otp", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.id }),
        });

        // Background push notification to owner (non-blocking)
        fetch("/api/push/send-to-owners", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ orderNumber: order.order_number, orderId: order.id }),
        }).catch(() => {});

        // Mark referral reward as used if it was applied
        if (activeDiscountSource === "referral" && referralReward) {
          fetch("/api/referral/use-reward", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rewardId: referralReward.id, orderId: order.id }),
          }).catch(() => {});
        }

        orderPlacedRef.current = true;
        // GA4: purchase — COD order confirmed in Supabase
        trackPurchase({
          orderId:     order.id,
          orderNumber: order.order_number,
          value:       finalTotal,
          deliveryFee: customerDeliveryCharge,
          discount:    discountAmt,
          items: items.map((i) => ({
            id:       i.id,
            name:     i.menu_item.name,
            price:    i.menu_item.discounted_price ?? i.menu_item.price,
            quantity: i.quantity,
          })),
        });
        clearCart();
        sessionStorage.removeItem(ADDRESS_SESSION_KEY);
        sessionStorage.setItem("cj_last_order_id", order.id);
        router.push(`/order-confirmed/${order.id}`);
        return;
      }

      // Razorpay flow — use finalTotal (after offer discount)
      // Background push to owner (non-blocking)
      fetch("/api/push/send-to-owners", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ orderNumber: order.order_number, orderId: order.id }),
      }).catch(() => {});

      const res  = await fetch("/api/razorpay/create-order", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Math.round(finalTotal * 100), orderId: order.id }),
      });
      const json = await res.json();

      // Razorpay not configured → fallback to COD
      if (res.status === 503 || json.error === "RAZORPAY_NOT_CONFIGURED") {
        await supabase.from("orders").update({ payment_method: "cash_on_delivery" }).eq("id", order.id);
        await supabase.from("payments").insert({ order_id: order.id, amount: finalTotal, method: "cash_on_delivery", status: "pending" });
        await fetch("/api/generate-otp", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.id }),
        });
        orderPlacedRef.current = true;
        // GA4: purchase — Razorpay fallback COD order confirmed
        trackPurchase({
          orderId:     order.id,
          orderNumber: order.order_number,
          value:       finalTotal,
          deliveryFee: customerDeliveryCharge,
          discount:    discountAmt,
          items: items.map((i) => ({
            id:       i.id,
            name:     i.menu_item.name,
            price:    i.menu_item.discounted_price ?? i.menu_item.price,
            quantity: i.quantity,
          })),
        });
        clearCart();
        sessionStorage.removeItem(ADDRESS_SESSION_KEY);
        sessionStorage.setItem("cj_last_order_id", order.id);
        toast("Razorpay not set up — COD applied ✅");
        router.push(`/order-confirmed/${order.id}`);
        return;
      }

      if (!res.ok || !json.razorpayOrderId) throw new Error(json.error ?? "Payment error");

      if (!window.Razorpay) {
        await new Promise<void>((resolve) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.onload = () => resolve();
          document.body.appendChild(s);
        });
      }

      new window.Razorpay({
        key:         process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount:      Math.round(finalTotal * 100),
        currency:    "INR",
        name:        "Royal Zaika",
        description: `Order #${order.order_number}`,
        order_id:    json.razorpayOrderId,
        prefill:     { name: user.name, email: user.email ?? "" },
        theme:       { color: "#f97316" },
        handler: async (response: any) => {
          await supabase.from("payments").insert({
            order_id:            order.id,
            razorpay_order_id:   json.razorpayOrderId,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature:  response.razorpay_signature,
            amount: finalTotal, method: "razorpay", status: "paid",
          });
          await supabase.from("orders").update({ payment_status: "paid", status: "confirmed" }).eq("id", order.id);
          await fetch("/api/generate-otp", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: order.id }),
          });
          // Mark referral reward as used if it was applied
          if (activeDiscountSource === "referral" && referralReward) {
            fetch("/api/referral/use-reward", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rewardId: referralReward.id, orderId: order.id }),
            }).catch(() => {});
          }
          orderPlacedRef.current = true;
          // GA4: purchase — Razorpay payment verified + order confirmed in Supabase
          trackPurchase({
            orderId:     order.id,
            orderNumber: order.order_number,
            value:       finalTotal,
            deliveryFee: customerDeliveryCharge,
            discount:    discountAmt,
            items: items.map((i) => ({
              id:       i.id,
              name:     i.menu_item.name,
              price:    i.menu_item.discounted_price ?? i.menu_item.price,
              quantity: i.quantity,
            })),
          });
          clearCart();
          sessionStorage.removeItem(ADDRESS_SESSION_KEY);
          sessionStorage.setItem("cj_last_order_id", order.id);
          router.push(`/order-confirmed/${order.id}`);
        },
        modal: { ondismiss: () => { toast.error("Payment cancelled"); setPlacing(false); } },
      }).open();

    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
      setPlacing(false);
    }
  }

  if (authLoading || !user || !deliveryAddress) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={32} className="animate-spin text-orange-500" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-10">

      {/* ── COD-Only Popup (shows once per checkout session) ── */}
      {showCodPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: "#1a1a2e", border: "1px solid rgba(249,115,22,0.3)", boxShadow: "0 0 40px rgba(249,115,22,0.15)" }}>
            <div className="p-6 text-center">
              <div className="text-5xl mb-3">💵</div>
              <h3 className="font-black text-xl text-white mb-2">Cash on Delivery Only</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Currently, only <strong className="text-orange-400">Cash on Delivery (COD)</strong> is available.
                Online payment options will be available soon.
              </p>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setShowCodPopup(false)}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg,#f97316,#dc2626)" }}>
                OK, Got it
              </button>
              <button onClick={() => setShowCodPopup(false)}
                className="w-10 flex items-center justify-center rounded-xl text-gray-500 hover:text-white border transition-all"
                style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="font-bold text-2xl text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
            {checkoutStep === "bill" ? "Bill Summary" : "Payment"}
          </h1>
          <p className="text-gray-500 text-sm">
            {checkoutStep === "bill" ? "Step 4 of 5 — Review your bill" : "Step 5 of 5 — Choose how to pay"}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1.5 mb-8 overflow-x-auto no-scrollbar pb-1">
        {["Menu", "Cart", "Address", "Bill", "Payment"].map((step, i) => {
          const billIdx = 3;
          const payIdx  = 4;
          const currentIdx = checkoutStep === "bill" ? billIdx : payIdx;
          const isDone     = i < currentIdx;
          const isActive   = i === currentIdx;
          return (
            <div key={step} className="flex items-center gap-1.5 shrink-0">
              <div className={cn("flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap",
                isDone  ? "bg-green-500/15 text-green-400"
              : isActive ? "bg-orange-500 text-white"
              :           "bg-white/5 text-gray-500")}>
                {isDone ? <Check size={11} /> : null}
                {step}
              </div>
              {i < 4 && <div className="w-4 h-px bg-white/10 shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Delivery address summary */}
      {deliveryAddress && (
        <div className="rounded-2xl p-3 mb-5 flex items-center gap-3"
          style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)" }}>
          <MapPin size={15} className="text-orange-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-orange-400 font-semibold">Delivering to</p>
            <p className="text-sm text-white truncate">
              {deliveryAddress.address_line1}, {deliveryAddress.city} — {deliveryAddress.pincode}
            </p>
          </div>
          <button onClick={() => router.push("/checkout/address")}
            className="text-xs text-gray-500 hover:text-orange-400 shrink-0 transition-colors">
            Change
          </button>
        </div>
      )}

      {/* ═══ BILL SUMMARY STEP ═══ */}
      {checkoutStep === "bill" && (
        <>
          {/* Detailed Bill */}
          <div className="rounded-2xl p-5 mb-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
              <Receipt size={18} className="text-orange-400" />
              <p className="text-base font-bold text-white">Your Bill</p>
              <span className="ml-auto text-xs text-gray-500">{items.length} item{items.length > 1 ? "s" : ""}</span>
            </div>

            {/* Item list */}
            <div className="space-y-2.5 mb-4 max-h-52 overflow-y-auto">
              {items.map(({ id, menu_item, quantity }) => {
                const price = menu_item.discounted_price ?? menu_item.price;
                return (
                  <div key={id} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-800">
                      {menu_item.image_url && !imgErrors[id] ? (
                        <Image src={menu_item.image_url} alt={menu_item.name} width={40} height={40}
                          className="object-cover w-full h-full"
                          onError={() => setImgErrors((p) => ({ ...p, [id]: true }))} />
                      ) : <div className="w-full h-full flex items-center justify-center text-lg">🍽️</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{menu_item.name}</p>
                      <p className="text-xs text-gray-500">{formatPrice(price)} × {quantity}</p>
                    </div>
                    <span className="text-sm text-white font-semibold">{formatPrice(price * quantity)}</span>
                  </div>
                );
              })}
            </div>

            {/* Divider */}
            <div className="h-px w-full mb-3" style={{ background: "rgba(255,255,255,0.08)" }} />

            {/* Subtotal */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Items Total</span>
                <span className="text-white font-medium">{formatPrice(sub)}</span>
              </div>

              {/* Restaurant Packaging Charge */}
              <div className="flex justify-between text-gray-400">
                <span>Restaurant Packaging Charge</span>
                <span className="text-green-400 font-medium">₹0</span>
              </div>

              {/* Delivery Partner Fee with distance info */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-gray-400">
                  <MapPin size={13} className="text-orange-400" />
                  <span>Delivery Partner Fee</span>
                  {pricing && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 font-semibold">
                      {pricing.rangeLabel}
                    </span>
                  )}
                </div>
                <span className={pricing?.isFreeDelivery ? "text-green-400 font-bold" : fee === 0 ? "text-green-400 font-semibold" : "text-white font-medium"}>
                  {pricing?.isFreeDelivery ? "FREE 🎉" : fee === 0 ? "FREE" : formatPrice(fee)}
                </span>
              </div>

              {/* Platform Fee */}
              <div className="flex justify-between text-gray-400">
                <span>Platform Fee</span>
                <span className="text-green-400 font-medium">₹0</span>
              </div>

              {/* GST / Tax */}
              <div className="flex justify-between text-gray-400">
                <span>GST &amp; Taxes</span>
                <span className="text-green-400 font-medium">₹0</span>
              </div>

              {/* Free Delivery Banner */}
              {pricing?.isFreeDelivery && (
                <div className="flex items-center gap-2 py-2 px-3 rounded-xl"
                  style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <span className="text-green-400 font-bold text-xs">🎉 Free Delivery Unlocked!</span>
                  <span className="text-green-400/70 text-xs ml-auto">Orders above ₹499</span>
                </div>
              )}

              {/* Nudge: show how close to free delivery */}
              {!pricing?.isFreeDelivery && sub > 0 && sub < 499 && (
                <div className="flex items-center gap-2 py-2 px-3 rounded-xl"
                  style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)" }}>
                  <span className="text-orange-400 text-xs">
                    🛵 Add <strong>₹{Math.ceil(499 - sub)}</strong> more to get <strong>FREE delivery!</strong>
                  </span>
                </div>
              )}

              {/* Discount Row — shows whichever source is bigger */}
              {activeDiscountSource === "offer" && offerDiscount > 0 && (
                <div className="flex justify-between items-center py-2 px-3 rounded-xl"
                  style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <span className="flex items-center gap-1.5 text-green-400 font-semibold text-xs">
                    <Tag size={12} /> {activeOffer?.title ?? "Offer Applied"}
                  </span>
                  <span className="text-green-400 font-bold">−{formatPrice(offerDiscount)}</span>
                </div>
              )}
              {activeDiscountSource === "referral" && referralDiscount > 0 && (
                <div className="flex justify-between items-center py-2 px-3 rounded-xl"
                  style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.3)" }}>
                  <span className="flex items-center gap-1.5 text-orange-400 font-semibold text-xs">
                    🎁 Referral Reward Applied
                  </span>
                  <span className="text-orange-400 font-bold">−{formatPrice(referralDiscount)}</span>
                </div>
              )}
              {/* Show both available but only bigger applied */}
              {offerDiscount > 0 && referralDiscount > 0 && offerDiscount > referralDiscount && (
                <p className="text-xs text-gray-500 px-1">
                  🎁 Referral reward (₹{referralDiscount}) available — offer discount is bigger and applied instead
                </p>
              )}
              {offerDiscount > 0 && referralDiscount > 0 && referralDiscount > offerDiscount && (
                <p className="text-xs text-gray-500 px-1">
                  🏷️ Offer discount (₹{offerDiscount}) available — referral reward is bigger and applied instead
                </p>
              )}
            </div>

            {/* Grand Total */}
            <div className="h-px w-full mt-3 mb-3" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div className="flex justify-between items-center">
              <span className="text-base font-bold text-white">Total Payable</span>
              <span className="text-lg font-black text-orange-400">{formatPrice(grand)}</span>
            </div>

            {/* You Saved */}
            {offerDiscount > 0 && (
              <p className="text-center text-xs font-bold text-green-400 mt-2">
                🎉 You save {formatPrice(offerDiscount)} with this offer!
              </p>
            )}
          </div>

          {/* Continue to Payment Button */}
          <button
            onClick={() => {
              setCheckoutStep("payment");
              // Show COD-only popup once per checkout session — only on payment step
              const popupShown = sessionStorage.getItem("cod_popup_shown");
              if (!popupShown) {
                setShowCodPopup(true);
                sessionStorage.setItem("cod_popup_shown", "1");
              }
            }}
            disabled={!restaurantIsOpen || !deliveryAddress?.delivery_distance_km}
            className="w-full flex items-center justify-center gap-3 py-4 text-base rounded-2xl font-bold text-white transition-all disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#f97316,#dc2626)" }}>
            {!restaurantIsOpen ? (
              <>{isTemporarilyClosed ? "🔴 Temporarily Closed" : "🔴 Restaurant Closed"}</>
            ) : !deliveryAddress?.delivery_distance_km ? (
              <>⚠️ Address Not Verified</>
            ) : (
              <>Continue to Payment <ArrowRight size={18} /></>
            )}
          </button>

          <p className="text-center text-xs text-gray-600 mt-3">
            Review your bill above, then proceed to select payment method.
          </p>
        </>
      )}

      {/* ═══ PAYMENT STEP ═══ */}
      {checkoutStep === "payment" && (
        <>
      {/* Order summary (compact) */}
      <div className="rounded-2xl p-4 mb-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-sm font-semibold text-white mb-3">Order Summary ({items.length} items)</p>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {items.map(({ id, menu_item, quantity }) => (
            <div key={id} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-800">
                {menu_item.image_url && !imgErrors[id] ? (
                  <Image src={menu_item.image_url} alt={menu_item.name} width={40} height={40}
                    className="object-cover w-full h-full"
                    onError={() => setImgErrors((p) => ({ ...p, [id]: true }))} />
                ) : <div className="w-full h-full flex items-center justify-center text-lg">🍽️</div>}
              </div>
              <p className="flex-1 text-sm text-gray-300 truncate">{menu_item.name}</p>
              <span className="text-xs text-gray-500">×{quantity}</span>
              <span className="text-sm text-white font-medium">
                {formatPrice((menu_item.discounted_price ?? menu_item.price) * quantity)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 pt-3 space-y-1.5 text-sm border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <div className="flex justify-between text-gray-400"><span>Subtotal</span><span className="text-white">{formatPrice(sub)}</span></div>
          <div className="flex justify-between text-gray-400">
            <span>Delivery</span>
            <span className={fee === 0 ? "text-green-400" : "text-white"}>{fee === 0 ? "FREE" : formatPrice(fee)}</span>
          </div>

          {/* Offer Discount Row */}
          {offerDiscount > 0 && (
            <div className="flex justify-between items-center py-1.5 px-3 rounded-xl"
              style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <span className="flex items-center gap-1.5 text-green-400 font-semibold text-xs">
                <Tag size={12} /> {activeOffer?.title ?? "Offer"}
              </span>
              <span className="text-green-400 font-bold">−{formatPrice(offerDiscount)}</span>
            </div>
          )}

          <div className="flex justify-between font-bold pt-1.5 border-t text-base"
            style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <span className="text-white">Total</span>
            <span className="text-orange-400">{formatPrice(grand)}</span>
          </div>

          {/* You Saved line */}
          {offerDiscount > 0 && (
            <p className="text-center text-xs font-bold text-green-400">
              🎉 You save {formatPrice(offerDiscount)} with this offer!
            </p>
          )}
        </div>
      </div>

      {/* Payment options — COD enabled, others visible but disabled (coming soon) */}
      <div className="mb-6">
        <p className="text-sm font-semibold text-white mb-1">Select Payment Method</p>
        <p className="text-xs text-gray-500 mb-3">Only Cash on Delivery is available right now</p>
        <div className="space-y-3">
          {PAY_OPTIONS.map(({ id, icon: Icon, label, desc }) => {
            const isCod     = id === "cod";
            const isSelected = payMethod === id && isCod;
            return (
              <div key={id}
                onClick={() => { if (isCod) setPayMethod("cod"); }}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all relative",
                  isCod ? "cursor-pointer" : "cursor-not-allowed opacity-50",
                  isSelected
                    ? "border-orange-500 bg-orange-500/8"
                    : "border-transparent"
                )}
                style={!isSelected ? { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" } : {}}>

                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                  isSelected ? "bg-orange-500/20" : "bg-white/5")}>
                  <Icon size={20} className={isSelected ? "text-orange-400" : "text-gray-500"} />
                </div>

                <div className="flex-1">
                  <p className={cn("font-semibold text-sm", isSelected ? "text-white" : "text-gray-400")}>{label}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{desc}</p>
                </div>

                <div className="flex items-center gap-2">
                  {!isCod && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(107,114,128,0.15)", border: "1px solid rgba(107,114,128,0.2)", color: "#6b7280" }}>
                      Coming Soon
                    </span>
                  )}
                  {isCod && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e" }}>
                      Available
                    </span>
                  )}
                  <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                    isSelected ? "border-orange-500 bg-orange-500" : "border-gray-600")}>
                    {isSelected && <Check size={11} className="text-white" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Temporarily Closed Popup — shown once per session */}
      <ClosedPopup isTemporarilyClosed={isTemporarilyClosed} />

      {/* Restaurant Closed Warning — timing-aware */}
      {!restaurantIsOpen && (
        <div className="mb-4 p-4 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
          <p className="text-sm text-red-400 font-bold flex items-center gap-2">
            🔴 {isTemporarilyClosed ? "Restaurant Temporarily Closed" : "Restaurant is Currently Closed"}
          </p>
          <p className="text-xs text-red-400/80 mt-1">
            {isTemporarilyClosed
              ? "The restaurant is temporarily closed and not accepting new orders."
              : `Ordering is available during ${openingTimeFormatted} – ${closingTimeFormatted}.`}
          </p>
        </div>
      )}

      {/* Distance warning — show if address has no coordinates */}
      {deliveryAddress && (!deliveryAddress.latitude || !deliveryAddress.longitude) && (
        <div className="mb-4 p-3 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <p className="text-sm text-red-400 font-semibold flex items-center gap-2">
            <MapPin size={14} /> Cannot Place Order
          </p>
          <p className="text-xs text-red-400/80 mt-1">
            Delivery distance could not be verified for this address. Please go back and select a valid address with a detected location.
          </p>
          <button onClick={() => router.push("/checkout/address")}
            className="mt-2 text-xs text-orange-400 underline">
            ← Change Address
          </button>
        </div>
      )}

      {/* Place Order */}
      <button onClick={placeOrder}
        disabled={placing
          || !deliveryAddress?.delivery_distance_km
          || !restaurantIsOpen}
        className="w-full btn-primary flex items-center justify-center gap-3 py-4 text-base rounded-2xl disabled:opacity-70">
        {placing ? (
          <><Loader2 size={20} className="animate-spin" /> Processing...</>
        ) : !restaurantIsOpen ? (
          <>{isTemporarilyClosed ? "🔴 Temporarily Closed" : "🔴 Restaurant Closed"}</>
        ) : !deliveryAddress?.delivery_distance_km ? (
          <>⚠️ Address Not Verified</>
        ) : (
          <><Check size={18} /> Place Order · {formatPrice(grand)}</>
        )}
      </button>

      <div className="flex items-center gap-3 mt-3">
        <button onClick={() => setCheckoutStep("bill")}
          className="text-xs text-gray-500 hover:text-orange-400 transition-colors">
          ← Back to Bill
        </button>
      </div>

      <p className="text-center text-xs text-gray-600 mt-3">
        🔒 Secure payment. Your order will be prepared immediately after confirmation.
      </p>
      </> /* end payment step */
      )}
    </div>
  );
}

