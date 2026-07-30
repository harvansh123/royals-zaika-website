"use client";
import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabase/client";
import { Order, OrderItem } from "@/lib/database.types";
import { formatPrice, formatDate, ORDER_STATUS_CONFIG } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Phone, MapPin, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

type OrderWithItems = Order & { order_items: (OrderItem & { menu_items?: { name: string; image_url?: string } | null })[] } & { cancellation_reason?: string | null; cancelled_at?: string | null; };

// Customer-facing 4-step tracking flow
// (confirmed is skipped since owner auto-jumps to preparing)
const TRACKING_STEPS: { statuses: string[]; label: string; icon: string; desc: string }[] = [
  { statuses: ["pending"],                           label: "Order Placed",      icon: "🧾", desc: "We received your order" },
  { statuses: ["confirmed", "preparing"],            label: "Cooking",           icon: "👨‍🍳", desc: "Your food is being prepared" },
  { statuses: ["ready", "picked_up", "out_for_delivery"], label: "Out for Delivery", icon: "🛵", desc: "On the way to you" },
  { statuses: ["delivered"],                         label: "Delivered",          icon: "🎉", desc: "Enjoy your meal!" },
];

const STATUS_ORDER = ["pending", "confirmed", "preparing", "ready", "picked_up", "out_for_delivery", "delivered"];

function getStepIndex(status: string) {
  for (let i = 0; i < TRACKING_STEPS.length; i++) {
    if (TRACKING_STEPS[i].statuses.includes(status)) return i;
  }
  return 0;
}

export default function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router  = useRouter();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [otp, setOtp]         = useState<string | null>(null);

  async function loadOrder() {
    // Use service-role API — direct anon-key query on orders triggers order_items
    // RLS which recursively re-evaluates orders policies ("Admins view all orders"
    // calls get_user_role()) → possible recursion → data=null → "Order not found".
    try {
      const res = await fetch(`/api/customer/orders/${id}`, { credentials: "same-origin" });
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json();
      setOrder(json.order as OrderWithItems);
    } catch (err) {
      console.error("[track] loadOrder error:", err);
    }
    setLoading(false);
  }

  // Fetch OTP from notifications — SELECT works for own user (customer)
  async function fetchOtp() {
    const { data: notifs } = await supabase
      .from("notifications")
      .select("data")
      .eq("type", "delivery_otp")
      .order("created_at", { ascending: false });
    const notif = (notifs ?? []).find((n: any) => n.data?.order_id === id);
    if (notif?.data?.otp && !notif?.data?.used) {
      setOtp(notif.data.otp);
      return true; // found
    }
    return false;
  }

  useEffect(() => {
    loadOrder();

    // Poll for OTP — retry every 2s for up to 10s (OTP API may save slightly after redirect)
    fetchOtp().then((found) => {
      if (found) return;
      let attempts = 0;
      const interval = setInterval(async () => {
        if (attempts >= 5) { clearInterval(interval); return; }
        attempts++;
        const found = await fetchOtp();
        if (found) clearInterval(interval);
      }, 2000);
    });

    // Realtime subscription for live status updates
    const channel = supabase
      .channel(`order-track-${id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "orders",
        filter: `id=eq.${id}`,
      }, () => {
        // Re-fetch the full order so tracking timeline updates correctly.
        // We cannot rely solely on payload.new because Supabase Realtime
        // only sends changed columns unless REPLICA IDENTITY FULL is set.
        loadOrder();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={36} className="animate-spin text-orange-500" />
    </div>
  );

  if (!order) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="text-5xl">🔍</div>
      <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Order not found</p>
      <Link href="/orders" className="btn-primary px-6 py-2.5">Back to Orders</Link>
    </div>
  );

  const currentIdx   = getStepIndex(order.status);
  const isCancelled  = order.status === "cancelled";
  const cfg          = ORDER_STATUS_CONFIG[order.status] ?? { label: order.status, color: "text-gray-400 bg-gray-400/10", icon: "📋" };
  const deliveryAddr = order.delivery_address as Record<string, string>;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-28">

      {/* Back Button */}
      <button onClick={() => router.back()}
        className="flex items-center gap-2 mb-6 text-sm transition-colors"
        style={{ color: "var(--text-secondary)" }}>
        <ChevronLeft size={18} /> Back to Orders
      </button>

      {/* Order Header */}
      <div className="rounded-2xl p-5 mb-5" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-bold text-lg" style={{ color: "var(--text-primary)", fontFamily: "'Outfit',sans-serif" }}>
              #{order.order_number}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{formatDate(order.created_at)}</p>
          </div>
          <span className={cn("text-xs font-bold px-3 py-1.5 rounded-full", cfg.color)}>
            {cfg.icon} {cfg.label}
          </span>
        </div>
        <div className="flex gap-4 text-sm">
          <span style={{ color: "var(--text-muted)" }}>Total: <strong className="text-orange-500">{formatPrice(order.total_amount)}</strong></span>
          <span style={{ color: "var(--text-muted)" }}>
            Payment: <strong style={{ color: "var(--text-primary)" }}>{order.payment_method === "cash_on_delivery" ? "COD" : "Online"}</strong>
          </span>
        </div>
      </div>

      {/* Tracking Timeline */}
      {!isCancelled ? (
        <div className="rounded-2xl p-5 mb-5" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
          <h2 className="font-bold text-base mb-5" style={{ color: "var(--text-primary)" }}>Order Status</h2>

          {/* Progress Bar */}
          <div className="relative mb-8">
            <div className="absolute top-4 left-4 right-4 h-1 rounded-full" style={{ background: "var(--border)" }} />
            <div
              className="absolute top-4 left-4 h-1 rounded-full transition-all duration-700"
              style={{
                background: "linear-gradient(90deg,#f97316,#dc2626)",
                width: `${Math.min((currentIdx / (TRACKING_STEPS.length - 1)) * 100, 100)}%`,
                right: "1rem",
                maxWidth: "calc(100% - 2rem)",
              }}
            />
            <div className="relative flex justify-between">
              {TRACKING_STEPS.map((step, idx) => {
                const done    = idx <= currentIdx;
                const current = idx === currentIdx;
                return (
                  <div key={step.statuses[0]} className="flex flex-col items-center gap-1.5" style={{ width: "25%" }}>
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-sm transition-all duration-500 z-10",
                      done ? "shadow-brand" : ""
                    )}
                      style={{
                        background: done ? "linear-gradient(135deg,#f97316,#dc2626)" : "var(--bg-secondary)",
                        border: `2px solid ${done ? "#f97316" : "var(--border)"}`,
                        transform: current ? "scale(1.2)" : "scale(1)",
                      }}>
                      {done ? <span className="text-sm">{step.icon}</span> : <span className="text-xs" style={{ color: "var(--text-muted)" }}>{idx + 1}</span>}
                    </div>
                    <span className="text-[9px] text-center leading-tight"
                      style={{ color: done ? "#f97316" : "var(--text-muted)", fontWeight: done ? 600 : 400 }}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current Step Info */}
          <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}>
            <div className="text-3xl">{TRACKING_STEPS[currentIdx]?.icon}</div>
            <div>
              <p className="font-bold text-orange-500">{TRACKING_STEPS[currentIdx]?.label}</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{TRACKING_STEPS[currentIdx]?.desc}</p>
              {order.estimated_time && order.status !== "delivered" && (
                <p className="text-xs mt-1 font-medium" style={{ color: "var(--text-muted)" }}>
                  ⏱ Est. {order.estimated_time} minutes
                </p>
              )}
            </div>
          </div>

          {/* Step List */}
          <div className="mt-5 space-y-3">
            {TRACKING_STEPS.map((step, idx) => {
              const done    = idx <= currentIdx;
              const current = idx === currentIdx;
              return (
                <div key={step.statuses[0]} className={cn("flex items-center gap-4 py-3 px-3 rounded-xl transition-all",
                  current && "bg-orange-500/5")}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                    style={{
                      background: done ? "linear-gradient(135deg,#f97316,#dc2626)" : "var(--bg-secondary)",
                      opacity: done ? 1 : 0.35,
                    }}>
                    {step.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: done ? "var(--text-primary)" : "var(--text-muted)" }}>
                      {step.label}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{step.desc}</p>
                  </div>
                  {current && <span className="text-xs font-bold text-orange-500 animate-pulse">Now</span>}
                  {done && !current && <span className="text-green-500 text-sm">✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-6 mb-5" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="text-3xl">❌</div>
            <div>
              <p className="font-bold text-red-400 text-lg">Order Cancelled</p>
              {order.cancelled_at && (
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Cancelled on {formatDate(order.cancelled_at)}
                </p>
              )}
            </div>
          </div>
          {order.cancellation_reason ? (
            <div className="rounded-xl p-3 mt-2" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <p className="text-xs font-semibold text-red-400 mb-1">Cancellation Reason:</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{order.cancellation_reason}</p>
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>This order was cancelled. Contact support if needed.</p>
          )}
        </div>
      )}

      {/* ── FIX 2: OTP Card — shown from order placement until delivered ── */}
      {otp && order.status !== "delivered" && order.status !== "cancelled" && (
        <div className="rounded-2xl p-5 mb-5"
          style={{ background: "rgba(99,102,241,0.1)", border: "2px solid rgba(99,102,241,0.4)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Shield size={20} className="text-indigo-400" />
            <p className="font-bold text-indigo-400">Your Delivery OTP</p>
          </div>
          {/* Large OTP digits */}
          <div className="flex justify-center gap-2 mb-4">
            {otp.split("").map((digit, i) => (
              <div key={i}
                className="w-11 h-14 rounded-xl flex items-center justify-center font-black text-2xl text-white"
                style={{ background: "rgba(99,102,241,0.25)", border: "1px solid rgba(99,102,241,0.5)" }}>
                {digit}
              </div>
            ))}
          </div>
          {/* Instruction */}
          <div className="rounded-xl px-4 py-3" style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}>
            <p className="text-xs leading-relaxed text-center" style={{ color: "var(--text-secondary)" }}>
              🔐 <strong className="text-indigo-300">This OTP must be shared with the delivery rider at the time of delivery.</strong>{" "}
              The order will be marked as delivered only after successful OTP verification.
            </p>
          </div>
        </div>
      )}

      {/* Delivered — OTP used */}
      {order.status === "delivered" && (
        <div className="rounded-xl px-4 py-3 mb-5 flex items-center gap-2"
          style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
          <span className="text-green-400 text-lg">✅</span>
          <p className="text-xs text-green-400 font-medium">OTP verified — Order successfully delivered!</p>
        </div>
      )}

      {/* Order Items */}
      <div className="rounded-2xl p-5 mb-5" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
        <h2 className="font-bold text-base mb-4" style={{ color: "var(--text-primary)" }}>Order Items</h2>
        <div className="space-y-3">
          {order.order_items?.map((item) => (
            <div key={item.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center text-xs font-bold text-white">
                  {item.quantity}×
                </div>
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {item.name}
                </span>
              </div>
              <span className="text-sm font-bold text-orange-500">{formatPrice(item.subtotal)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex justify-between text-sm" style={{ color: "var(--text-secondary)" }}>
            <span>Subtotal</span><span>{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm" style={{ color: "var(--text-secondary)" }}>
            <span>Delivery Fee</span><span>{formatPrice(order.delivery_fee)}</span>
          </div>
          {order.discount_amount > 0 && (
            <div className="flex justify-between text-sm text-green-500">
              <span>Discount</span><span>-{formatPrice(order.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold" style={{ color: "var(--text-primary)" }}>
            <span>Total</span><span className="text-orange-500">{formatPrice(order.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* Delivery Address */}
      {deliveryAddr && (
        <div className="rounded-2xl p-5" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={16} className="text-orange-500" />
            <h2 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>Delivery Address</h2>
          </div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {deliveryAddr.address_line1}
            {deliveryAddr.address_line2 ? `, ${deliveryAddr.address_line2}` : ""}
          </p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {deliveryAddr.city}, {deliveryAddr.state} - {deliveryAddr.pincode}
          </p>
        </div>
      )}
    </div>
  );
}
