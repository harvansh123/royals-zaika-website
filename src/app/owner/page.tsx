"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { formatPrice, playAlarmSound } from "@/lib/utils";
import Link from "next/link";
import {
  ShoppingBag, TrendingUp, Clock, CheckCircle,
  AlertTriangle, Bell, ArrowRight, Check, X, Loader2,
  ChevronDown, User, Phone, Receipt, WifiOff, Wifi
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { useRestaurantStatus } from "@/hooks/useRestaurantStatus";

type Stats = {
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  completedOrders: number;
  outOfStockItems: number;
};

// FIX 1: Extended type to include order_items and users
type OrderItem = { name: string; quantity: number; price: number; subtotal: number };
type RecentOrder = {
  id: string; order_number: string; status: string;
  total_amount: number; subtotal: number; delivery_fee: number;
  created_at: string; payment_method: string;
  order_items?: OrderItem[];
  users?: { name: string | null; phone: string | null } | null;
};

export default function OwnerDashboard() {
  const [stats, setStats]   = useState<Stats>({ todayOrders: 0, todayRevenue: 0, pendingOrders: 0, completedOrders: 0, outOfStockItems: 0 });
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  // Track which order is expanded
  const [expanded, setExpanded] = useState<string | null>(null);
  // Restaurant Online/Offline using unified hook
  const { isOpen, isTemporarilyClosed, refetch } = useRestaurantStatus();
  const [togglingStatus, setTogglingStatus] = useState(false);

  useEffect(() => {
    loadDashboard();

    // Realtime — new orders
    const channel = supabase.channel("owner-dashboard")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, async (payload) => {
        const newOrder = payload.new as RecentOrder;
        // FIX 1: Use service-role API → order_items always visible regardless of RLS
        const res = await fetch(`/api/owner/orders?limit=10&date=today`);
        const json = await res.json();
        if (json.orders) setOrders(json.orders.slice(0, 10));
        setStats((prev) => ({ ...prev, todayOrders: prev.todayOrders + 1, pendingOrders: prev.pendingOrders + 1, todayRevenue: prev.todayRevenue + newOrder.total_amount }));
        playAlarmSound();
        toast.custom((t) => (
          <div className={cn("flex items-center gap-3 px-5 py-4 rounded-2xl shadow-brand", t.visible ? "animate-slide-bottom" : "opacity-0")}
            style={{ background: "var(--card-bg)", border: "1px solid rgba(249,115,22,0.4)" }}>
            <span className="text-2xl animate-bounce">🔔</span>
            <div>
              <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>New Order!</p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>#{newOrder.order_number} · {formatPrice(newOrder.total_amount)}</p>
            </div>
            <Link href="/owner/orders" className="btn-primary py-1.5 px-3 text-xs ml-1">View</Link>
          </div>
        ), { duration: 8000, position: "top-right" });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, async (payload) => {
        // FIX 1: Use service-role API so order_items stay intact after status update
        const updatedId = (payload.new as RecentOrder).id;
        const res = await fetch(`/api/owner/orders?limit=10&date=today`);
        const json = await res.json();
        if (json.orders) {
          const refreshed = json.orders.find((o: RecentOrder) => o.id === updatedId);
          if (refreshed) setOrders((prev) => prev.map((o) => o.id === updatedId ? refreshed : o));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);


  // ── Toggle Restaurant Open/Closed ────────────────────────────────────
  async function toggleRestaurantStatus() {
    setTogglingStatus(true);
    // If it's currently open (via auto or manual), we close it temporarily.
    // If it's currently closed, we set it back to auto (or manual_open if they are overriding hours, but auto is standard)
    const newStatusMode = isOpen ? "temporarily_closed" : "auto";
    
    try {
      const res  = await fetch("/api/restaurant-settings", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status_mode: newStatusMode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update status");
      
      // Force refresh of the hook
      refetch();
      
      toast.success(!isOpen ? "🟢 Restaurant is now OPEN" : "🔴 Restaurant is now CLOSED");
    } catch (err: any) {
      toast.error("Status update failed: " + err.message);
    }
    setTogglingStatus(false);
  }

  async function loadDashboard() {
    setLoading(true);
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [{ data: todayOrders }, ordersRes, { data: outOfStock }] = await Promise.all([
      supabase.from("orders").select("total_amount, status").gte("created_at", today.toISOString()),
      // FIX 1: Use server-side API so service role bypasses RLS → order_items always visible
      // Only fetch today's orders for the dashboard recent list
      fetch("/api/owner/orders?limit=10&date=today").then(r => r.json()),
      supabase.from("menu_items").select("id", { count: "exact", head: true }).eq("is_available", false),
    ]);

    setStats({
      todayOrders:    todayOrders?.length ?? 0,
      todayRevenue:   todayOrders?.reduce((s, o) => s + o.total_amount, 0) ?? 0,
      pendingOrders:  todayOrders?.filter((o) => o.status === "pending").length ?? 0,
      completedOrders: todayOrders?.filter((o) => o.status === "delivered").length ?? 0,
      outOfStockItems: (outOfStock as any)?.count ?? 0,
    });
    setOrders(ordersRes.orders ?? []);
    setLoading(false);
  }

  async function updateStatus(orderId: string, status: string) {
    // CHANGE 2: When confirming an order, auto-jump to "preparing" (Cooking)
    const finalStatus = status === "confirmed" ? "preparing" : status;

    // ── "delivered": use dedicated API that updates BOTH orders + delivery_tracking ──
    // This triggers the rider's Realtime subscription so they see it immediately.
    if (finalStatus === "delivered") {
      try {
        const res = await fetch("/api/owner/orders/deliver", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        if (!res.ok) {
          const j = await res.json();
          throw new Error(j.error ?? "Failed to mark delivered");
        }
        setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: "delivered" } : o));
        setStats((prev) => ({ ...prev, completedOrders: prev.completedOrders + 1, pendingOrders: Math.max(0, prev.pendingOrders - 1) }));
        toast.success("Order delivered! 🎉");
      } catch (err: any) {
        toast.error(err.message ?? "Failed to update");
      }
      return;
    }

    const { error } = await supabase.from("orders").update({ status: finalStatus }).eq("id", orderId);
    if (error) { toast.error("Failed to update"); return; }
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: finalStatus } : o));
    setStats((prev) => ({
      ...prev,
      pendingOrders: finalStatus !== "pending" ? Math.max(0, prev.pendingOrders - 1) : prev.pendingOrders,
      completedOrders: finalStatus === "delivered" ? prev.completedOrders + 1 : prev.completedOrders,
    }));
    const msg = finalStatus === "preparing" ? "✅ Confirmed & Cooking started!" : `Order ${finalStatus}`;
    toast.success(msg);
  }



  const statCards = [
    { label: "Today's Orders",    value: stats.todayOrders,                icon: <ShoppingBag size={22} />,   color: "#3b82f6" },
    { label: "Today's Revenue",   value: formatPrice(stats.todayRevenue),  icon: <TrendingUp size={22} />,    color: "#22c55e" },
    { label: "Pending Orders",    value: stats.pendingOrders,              icon: <Clock size={22} />,         color: "#f59e0b" },
    { label: "Completed Today",   value: stats.completedOrders,            icon: <CheckCircle size={22} />,   color: "#8b5cf6" },
    { label: "Out of Stock",      value: stats.outOfStockItems,            icon: <AlertTriangle size={22} />, color: "#ef4444" },
  ];

  const statusConfig: Record<string, { label: string; color: string }> = {
    pending:     { label: "Pending",    color: "#f59e0b" },
    confirmed:   { label: "Confirmed",  color: "#3b82f6" },
    preparing:   { label: "Preparing",  color: "#8b5cf6" },
    ready:       { label: "Ready",      color: "#22c55e" },
    delivered:   { label: "Delivered",  color: "#10b981" },
    cancelled:   { label: "Cancelled",  color: "#ef4444" },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-orange-500 mx-auto mb-3" />
          <p style={{ color: "var(--text-secondary)" }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 md:p-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-bold text-xl sm:text-2xl md:text-3xl" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-primary)" }}>
            Dashboard 👋
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        {stats.pendingOrders > 0 && (
          <Link href="/owner/orders"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold animate-pulse shrink-0"
            style={{ background: "rgba(249,115,22,0.12)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)" }}>
            <Bell size={16} /> {stats.pendingOrders} Pending
          </Link>
        )}
      </div>

      {/* Restaurant Online/Offline Toggle */}
      <div className="mb-6 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3"
        style={{
          background: isOpen ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)",
          border: `1px solid ${isOpen ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
        }}>
        <div className="min-w-0">
          <p className="font-bold text-base flex items-center gap-2"
            style={{ color: isOpen ? "#22c55e" : "#ef4444" }}>
            {isOpen ? <Wifi size={18} /> : <WifiOff size={18} />}
            Restaurant {isOpen ? "Open 🟢" : "Closed 🔴"}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {isOpen
              ? "Customers can place orders normally."
              : isTemporarilyClosed 
                ? "You have temporarily paused new orders."
                : "Restaurant is closed as per your business hours."}
          </p>
        </div>
        <button onClick={toggleRestaurantStatus} disabled={togglingStatus}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60 shrink-0",
            isOpen
              ? "bg-red-500 text-white hover:bg-red-600"
              : "bg-green-500 text-white hover:bg-green-600"
          )}>
          {togglingStatus
            ? <Loader2 size={14} className="animate-spin" />
            : isOpen ? <WifiOff size={14} /> : <Wifi size={14} />}
          {togglingStatus ? "Updating..." : isOpen ? "Close Restaurant" : "Open Restaurant"}
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {statCards.map(({ label, value, icon, color }) => (
          <div key={label} className="owner-stat-card">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}18`, color }}>
              {icon}
            </div>
            <p className="font-bold text-xl mb-0.5" style={{ color: "var(--text-primary)" }}>{value}</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Aaj ke Orders */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="font-bold" style={{ color: "var(--text-primary)" }}>📅 Aaj ke Orders</h2>
          <Link href="/owner/orders" className="flex items-center gap-1 text-sm text-orange-500 hover:underline">
            Saare dekho <ArrowRight size={14} />
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag size={40} className="mx-auto mb-3 opacity-20" style={{ color: "var(--text-muted)" }} />
            <p style={{ color: "var(--text-secondary)" }}>Aaj abhi tak koi order nahi aaya</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {orders.slice(0, 8).map((order) => {
              const cfg   = statusConfig[order.status] ?? { label: order.status, color: "#9ca3af" };
              const isExp = expanded === order.id;
              return (
                <div key={order.id}>
                  {/* ── Order Row ── */}
                  <div
                    className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => setExpanded(isExp ? null : order.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>#{order.order_number}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${cfg.color}18`, color: cfg.color }}>
                          {cfg.label}
                        </span>
                        {order.users?.name && (
                          <span className="text-[11px] hidden sm:inline" style={{ color: "var(--text-muted)" }}>
                            · {order.users.name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {new Date(order.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        {order.order_items && order.order_items.length > 0 && (
                          <span className="ml-2 text-orange-400/70">
                            {order.order_items.length} item{order.order_items.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </p>
                    </div>
                    <p className="font-bold text-sm text-orange-500 mr-2">{formatPrice(order.total_amount)}</p>

                    {/* Action buttons (stop propagation so they don't toggle expand) */}
                    <div className="flex gap-1.5 items-center" onClick={(e) => e.stopPropagation()}>
                      {order.status === "pending" && (
                        <>
                          <button onClick={() => updateStatus(order.id, "confirmed")}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                            style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }} title="Accept">
                            <Check size={14} />
                          </button>
                          <button onClick={() => updateStatus(order.id, "cancelled")}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                            style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }} title="Reject">
                            <X size={14} />
                          </button>
                        </>
                      )}
                      {order.status === "confirmed" && (
                        <button onClick={() => updateStatus(order.id, "preparing")}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                          style={{ background: "rgba(249,115,22,0.12)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)" }}>
                          Start Cooking
                        </button>
                      )}
                    </div>

                    <ChevronDown size={15}
                      className={cn("flex-shrink-0 transition-transform", isExp && "rotate-180")}
                      style={{ color: "var(--text-muted)" }} />
                  </div>

                  {/* ── FIX 1: Expanded Order Details with Items ── */}
                  {isExp && (
                    <div className="px-5 pb-4" style={{ borderTop: "1px solid var(--border)", background: "rgba(255,255,255,0.01)" }}>

                      {/* Customer info */}
                      {order.users && (
                        <div className="flex items-center gap-3 mt-3 mb-3">
                          <div className="w-8 h-8 rounded-xl gradient-brand flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                            {order.users.name?.[0]?.toUpperCase() ?? "?"}
                          </div>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{order.users.name ?? "—"}</p>
                            {order.users.phone && (
                              <a href={`tel:${order.users.phone}`} className="text-xs text-orange-400 hover:underline flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <Phone size={10} /> {order.users.phone}
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Items table */}
                      {order.order_items && order.order_items.length > 0 ? (
                        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                          {/* Header */}
                          <div className="grid grid-cols-12 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
                            style={{ background: "rgba(249,115,22,0.08)", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                            <span className="col-span-5">Item</span>
                            <span className="col-span-2 text-center">Qty</span>
                            <span className="col-span-2 text-right">Price</span>
                            <span className="col-span-3 text-right">Total</span>
                          </div>
                          {/* Rows */}
                          {order.order_items.map((item, i) => (
                            <div key={i}
                              className="grid grid-cols-12 px-3 py-2.5 text-sm items-center"
                              style={{ borderBottom: i < order.order_items!.length - 1 ? "1px solid var(--border)" : undefined }}>
                              <span className="col-span-5 font-medium truncate pr-2" style={{ color: "var(--text-primary)" }}>{item.name}</span>
                              <span className="col-span-2 text-center font-bold text-orange-400">×{item.quantity}</span>
                              <span className="col-span-2 text-right text-xs" style={{ color: "var(--text-muted)" }}>{formatPrice(item.price)}</span>
                              <span className="col-span-3 text-right font-semibold" style={{ color: "var(--text-primary)" }}>
                                {formatPrice(item.subtotal ?? item.price * item.quantity)}
                              </span>
                            </div>
                          ))}
                          {/* Totals footer */}
                          <div className="px-3 py-2 text-xs space-y-1" style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid var(--border)" }}>
                            {(order.delivery_fee ?? 0) > 0 && (
                              <div className="flex justify-between" style={{ color: "var(--text-muted)" }}>
                                <span>Delivery Fee</span>
                                <span>{formatPrice(order.delivery_fee)}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-bold text-sm pt-1" style={{ borderTop: "1px solid var(--border)", color: "var(--text-primary)" }}>
                              <span>Total</span>
                              <span className="text-orange-500">{formatPrice(order.total_amount)}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs py-3 text-center" style={{ color: "var(--text-muted)" }}>No item details available</p>
                      )}

                      {/* Link to full details */}
                      <Link href="/owner/orders"
                        className="mt-3 flex items-center justify-center gap-1.5 text-xs text-orange-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}>
                        <Receipt size={12} /> View full order details →
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
