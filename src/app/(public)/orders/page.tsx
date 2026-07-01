"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Order } from "@/lib/database.types";
import { formatPrice, formatDate, ORDER_STATUS_CONFIG } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuthStore();
  const router   = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/auth/login"); return; }

    // Use service-role API — direct anon-key supabase queries on orders trigger
    // order_items RLS which recursively re-evaluates orders policies (including
    // "Admins view all orders" → get_user_role() → possible recursion → data=null).
    fetch("/api/customer/orders", { credentials: "same-origin" })
      .then((r) => r.json())
      .then(({ orders }) => { setOrders(orders ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user, authLoading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={36} className="animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-24">
      <h1 className="font-display font-bold text-3xl text-white mb-8">My Orders</h1>

      {orders.length === 0 ? (
        <div className="text-center py-24">
          <ShoppingBag size={56} className="text-gray-700 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No orders yet</h3>
          <p className="text-gray-500 mb-6">Place your first order and it will appear here</p>
          <Link href="/menu" className="btn-primary inline-block px-8">Order Now</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const cfg = ORDER_STATUS_CONFIG[order.status];
            return (
              <Link
                key={order.id}
                href={`/track/${order.id}`}
                className="glass hover:border-brand/20 rounded-2xl p-5 flex items-center justify-between group transition-all block"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg">{cfg.icon}</span>
                    <div>
                      <p className="font-semibold text-white text-sm">#{order.order_number}</p>
                      <p className="text-xs text-gray-500">{formatDate(order.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={cn("badge text-[10px]", cfg.color)}>{cfg.label}</span>
                    <span className="text-sm font-bold text-brand">{formatPrice(order.total_amount)}</span>
                    <span className="text-xs text-gray-500 capitalize">{order.payment_method === "cash_on_delivery" ? "COD" : "Online"}</span>
                    {order.status === "cancelled" && (
                      <span className="text-[10px] text-red-400">Cancelled</span>
                    )}
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-600 group-hover:text-brand transition-colors" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
