"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { CheckCircle, Clock, ShoppingBag, Home, Shield } from "lucide-react";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";

interface Order {
  id: string;
  order_number: string;
  total_amount: number;
  payment_method: string;
  estimated_time: number;
  status: string;
  order_items: { name: string; quantity: number; price: number }[];
}

export default function OrderConfirmedPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [otp, setOtp]         = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("orders")
        .select("id,order_number,total_amount,payment_method,estimated_time,status,order_items(name,quantity,price)")
        .eq("id", id)
        .single();
      setOrder(data as Order);
      setLoading(false);
    }
    if (id) load();

    // Poll notifications for OTP (service-role API saves it, anon-key can read own notifications)
    async function fetchOtp() {
      const { data: notifs } = await supabase
        .from("notifications")
        .select("data")
        .eq("type", "delivery_otp")
        .order("created_at", { ascending: false });
      const notif = (notifs ?? []).find((n: any) => n.data?.order_id === id);
      if (notif?.data?.otp) setOtp(notif.data.otp);
    }

    fetchOtp();
    // Retry every 2s for up to 10s to catch OTP saved slightly after page load
    let attempts = 0;
    const interval = setInterval(async () => {
      if (attempts >= 5) { clearInterval(interval); return; }
      attempts++;
      await fetchOtp();
    }, 2000);

    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full gradient-brand animate-pulse" />
          <p className="text-gray-500">Confirming your order...</p>
        </div>
      </div>
    );
  }

  const estimatedMins = order?.estimated_time ?? 30;

  return (
    <div className="max-w-md mx-auto px-4 py-12 text-center">

      {/* Success Animation */}
      <div className="relative mb-8">
        <div className="w-28 h-28 mx-auto rounded-full flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,rgba(34,197,94,0.15),rgba(34,197,94,0.05))", border: "2px solid rgba(34,197,94,0.3)" }}>
          <CheckCircle size={56} className="text-green-400" />
        </div>
        <div className="absolute -top-2 -right-2 text-3xl animate-bounce">🎉</div>
        <div className="absolute -bottom-2 -left-4 text-2xl animate-bounce" style={{ animationDelay: "0.2s" }}>✨</div>
      </div>

      {/* Title */}
      <h1 className="font-black text-3xl text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
        Order Confirmed!
      </h1>
      <p className="text-gray-400 text-base mb-6">
        Your food is being prepared with love 🍛
      </p>

      {/* Order ID card */}
      <div className="rounded-2xl p-5 mb-5 text-left" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Order ID</p>
            <p className="font-bold text-white text-sm">#{order?.order_number ?? id?.toString().slice(0, 8).toUpperCase()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Amount</p>
            <p className="font-bold text-orange-400 text-sm">{formatPrice(order?.total_amount ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Payment</p>
            <p className="font-bold text-white text-sm capitalize">
              {order?.payment_method === "cash_on_delivery" ? "Cash on Delivery" : order?.payment_method === "razorpay" ? "Online Payment" : order?.payment_method ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-green-500/15 text-green-400">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              {order?.status === "confirmed" ? "Confirmed" : "Received"}
            </span>
          </div>
        </div>

        {/* Items */}
        {order?.order_items && order.order_items.length > 0 && (
          <div className="pt-4 border-t space-y-2" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Items Ordered</p>
            {order.order_items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-400">{item.name} × {item.quantity}</span>
                <span className="text-white">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main OTP Focus */}
      {otp ? (
        <div className="rounded-2xl p-6 mb-8 text-center"
          style={{ background: "linear-gradient(145deg, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0.05) 100%)", border: "2px solid rgba(99,102,241,0.5)", boxShadow: "0 8px 32px rgba(99,102,241,0.15)" }}>
          <div className="flex flex-col items-center justify-center gap-2 mb-5">
            <Shield size={28} className="text-indigo-400" />
            <h2 className="font-black text-xl text-indigo-400">Delivery OTP</h2>
          </div>
          
          <div className="flex justify-center gap-3 mb-6">
            {otp.split("").map((digit, i) => (
              <div key={i}
                className="w-14 h-16 rounded-xl flex items-center justify-center font-black text-4xl text-white shadow-lg"
                style={{ background: "rgba(99,102,241,0.4)", border: "1px solid rgba(99,102,241,0.8)" }}>
                {digit}
              </div>
            ))}
          </div>

          <div className="rounded-xl px-4 py-3" style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}>
            <p className="text-sm leading-relaxed text-center" style={{ color: "var(--text-secondary)" }}>
              <span className="text-lg">🔐</span> <strong className="text-indigo-300 block mb-1 text-base">Share this OTP with the delivery rider.</strong>
              Please keep this code handy. The rider will ask for it when they arrive with your order!
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-6 mb-8 text-center flex flex-col items-center justify-center gap-3"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.15)" }}>
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-sm text-gray-400">Generating your Delivery OTP...</p>
        </div>
      )}

      {/* Estimated time */}
      <div className="flex items-center justify-center gap-3 py-4 px-6 rounded-2xl mb-8"
        style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}>
        <Clock size={22} className="text-orange-400" />
        <div className="text-left">
          <p className="text-orange-400 font-bold text-lg">{estimatedMins}–{estimatedMins + 10} mins</p>
          <p className="text-gray-500 text-xs">Estimated preparation time</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {/* PRIMARY: Track Order */}
        <Link href={`/track/${order?.id ?? id}`}
          className="flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base transition-all btn-primary shadow-lg shadow-orange-500/20">
          🛵 Track Your Order
        </Link>
      </div>

      <p className="text-gray-600 text-xs mt-8">
        Thank you for ordering from Royal Zaika! 🙏<br />
        We'll have your food ready as soon as possible.
      </p>
    </div>
  );
}
