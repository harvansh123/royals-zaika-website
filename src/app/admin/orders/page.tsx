"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { formatPrice, formatDate, playAlarmSound } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Search, Loader2, ChevronDown, Bell, Check, X,
  Truck, Package, Phone, User, Clock, RefreshCw, UserCheck
} from "lucide-react";
import toast from "react-hot-toast";

// ── Status workflow ──────────────────────────────────────────────────
const STATUS_FLOW: Record<string, { next: string; label: string; color: string }> = {
  pending:          { next: "confirmed",        label: "✅ Accept",           color: "bg-green-600 hover:bg-green-500 text-white" },
  confirmed:        { next: "preparing",        label: "👨‍🍳 Start Preparing",  color: "bg-blue-600 hover:bg-blue-500 text-white"  },
  preparing:        { next: "ready",            label: "🔔 Mark Ready",       color: "bg-yellow-500 hover:bg-yellow-400 text-black" },
  ready:            { next: "out_for_delivery", label: "🛵 Assign Rider",     color: "bg-orange-600 hover:bg-orange-500 text-white" },
  out_for_delivery: { next: "delivered",        label: "✔ Mark Delivered",   color: "bg-emerald-600 hover:bg-emerald-500 text-white" },
};

const ALL_STATUSES = ["pending","confirmed","preparing","ready","out_for_delivery","delivered","cancelled"];
const STATUS_LABELS: Record<string, string> = {
  pending: "New", confirmed: "Accepted", preparing: "Preparing",
  ready: "Ready", out_for_delivery: "Out for Delivery", delivered: "Delivered", cancelled: "Cancelled",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  confirmed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  preparing: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  ready: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  out_for_delivery: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  delivered: "bg-green-500/15 text-green-400 border-green-500/30",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
};
const STATUS_ICONS: Record<string, string> = {
  pending: "🆕", confirmed: "✅", preparing: "👨‍🍳",
  ready: "🔔", out_for_delivery: "🛵", delivered: "🎉", cancelled: "❌",
};

export default function AdminOrdersPage() {
  const { user }  = useAuthStore();
  const router    = useRouter();
  const audioRef  = useRef<AudioContext | null>(null);

  const [orders, setOrders]           = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch]           = useState("");
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [riderModal, setRiderModal]   = useState<{ orderId: string; orderNum: string } | null>(null);
  const [riders, setRiders]           = useState<any[]>([]);
  const [ridersLoading, setRidersLoading] = useState(false);
  const [assigning, setAssigning]     = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    if (user.role !== "admin") { router.push("/"); return; }
    fetchOrders();

    // ── Supabase Realtime ───────────────────────────────────────────
    const channel = supabase.channel("admin-orders-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        const newOrder = payload.new as any;
        setOrders((prev) => [newOrder, ...prev]);
        setPendingCount((n) => n + 1);
        playAlarmSound();
        toast.custom((t) => (
          <div className={cn(
            "flex items-center gap-4 px-5 py-4 rounded-2xl shadow-2xl border",
            "bg-[#1a1a1a] border-orange-500/40",
            t.visible ? "animate-bounce-in" : "opacity-0"
          )}>
            <span className="text-3xl animate-bounce">🔔</span>
            <div>
              <p className="font-bold text-white text-sm">New Order!</p>
              <p className="text-orange-400 text-xs">#{newOrder.order_number} · {formatPrice(newOrder.total_amount)}</p>
            </div>
            <button onClick={() => { toast.dismiss(t.id); setExpandedId(newOrder.id); }}
              className="ml-2 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-bold">
              View
            </button>
          </div>
        ), { duration: 10000, position: "top-right" });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
        const updated = payload.new as any;
        setOrders((prev) => prev.map((o) => o.id === updated.id ? { ...o, ...updated } : o));
        setPendingCount((n) => updated.status !== "pending" ? Math.max(0, n - 1) : n);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select(`
        id, order_number, status, payment_method, payment_status,
        total_amount, subtotal, delivery_fee, created_at, estimated_time,
        special_instructions, delivery_address,
        order_items(id, name, quantity, price, subtotal),
        users(id, name, email, phone)
      `)
      .order("created_at", { ascending: false })
      .limit(100);
    const list = data ?? [];
    setOrders(list);
    setPendingCount(list.filter((o) => o.status === "pending").length);
    setLoading(false);
  }, []);

  // ── Update status ────────────────────────────────────────────────
  async function updateStatus(orderId: string, status: string) {
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) { toast.error("Failed to update status"); return; }
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
    if (status === "pending") setPendingCount((n) => n + 1);
    if (status !== "pending") setPendingCount((n) => Math.max(0, n - 1));
    toast.success(`Order → ${STATUS_LABELS[status] ?? status}`);
  }

  // ── Rider assignment ─────────────────────────────────────────────
  async function openRiderModal(orderId: string, orderNum: string) {
    setRiderModal({ orderId, orderNum });
    setRidersLoading(true);

    // Fetch delivery users
    const { data: deliveryUsers } = await supabase
      .from("users")
      .select("id, name, phone, email")
      .eq("role", "delivery")
      .eq("is_active", true);

    // For each rider get active delivery count
    const riderIds = (deliveryUsers ?? []).map((r) => r.id);
    let activeCounts: Record<string, number> = {};
    if (riderIds.length > 0) {
      const { data: activeTracking } = await supabase
        .from("delivery_tracking")
        .select("partner_id")
        .in("partner_id", riderIds)
        .not("status", "eq", "delivered");
      (activeTracking ?? []).forEach((t) => {
        activeCounts[t.partner_id] = (activeCounts[t.partner_id] ?? 0) + 1;
      });
    }

    const enriched = (deliveryUsers ?? []).map((r) => ({
      ...r,
      activeDeliveries: activeCounts[r.id] ?? 0,
      isAvailable: (activeCounts[r.id] ?? 0) === 0,
    }));

    setRiders(enriched);
    setRidersLoading(false);
  }

  async function assignRider(riderId: string, riderName: string) {
    if (!riderModal) return;
    setAssigning(riderId);
    try {
      // Create delivery_tracking record
      const { error: trackErr } = await supabase.from("delivery_tracking").insert({
        order_id:   riderModal.orderId,
        partner_id: riderId,
        status:     "assigned",
      });
      if (trackErr) throw trackErr;

      // Update order status
      await supabase.from("orders").update({ status: "out_for_delivery", rider_id: riderId }).eq("id", riderModal.orderId);
      setOrders((prev) => prev.map((o) => o.id === riderModal.orderId ? { ...o, status: "out_for_delivery" } : o));

      toast.success(`🛵 ${riderName} assigned!`);
      setRiderModal(null);
    } catch (err: any) {
      toast.error(err.message ?? "Assignment failed");
    } finally {
      setAssigning(null);
    }
  }

  // ── Filtered list ─────────────────────────────────────────────────
  const filtered = orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!o.order_number?.toLowerCase().includes(q) && !o.users?.name?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const statusCounts: Record<string, number> = {};
  orders.forEach((o) => { statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1; });

  if (loading) return (
    <div className="flex h-64 items-center justify-center gap-3">
      <Loader2 size={28} className="animate-spin text-orange-500" />
      <span className="text-gray-500">Loading orders...</span>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-bold text-2xl md:text-3xl text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Order Management
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{orders.length} total orders</p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
              <Bell size={15} className="text-yellow-400 animate-swing" />
              <span className="text-yellow-400 font-bold text-sm">{pendingCount} pending</span>
            </div>
          )}
          <button onClick={fetchOrders} className="p-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* ── Status Tabs ── */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4">
        <button onClick={() => setStatusFilter("all")}
          className={cn("shrink-0 px-4 py-2 rounded-xl text-sm font-medium border transition-all",
            statusFilter === "all" ? "border-orange-500 bg-orange-500/10 text-orange-400" : "border-white/10 text-gray-500 hover:text-white")}>
          All ({orders.length})
        </button>
        {ALL_STATUSES.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={cn("shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-all whitespace-nowrap",
              statusFilter === s ? "border-orange-500 bg-orange-500/10 text-orange-400" : "border-white/10 text-gray-500 hover:text-white")}>
            {STATUS_ICONS[s]} {STATUS_LABELS[s]}
            {(statusCounts[s] ?? 0) > 0 && (
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", s === "pending" ? "bg-yellow-500 text-black" : "bg-white/10 text-gray-300")}>
                {statusCounts[s]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Search ── */}
      <div className="relative mb-5">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order number or customer name..."
          className="w-full bg-white/4 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/40 transition-colors" />
      </div>

      {/* ── Orders List ── */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p>No orders found</p>
          </div>
        ) : filtered.map((order) => {
          const isExpanded = expandedId === order.id;
          const addr = order.delivery_address as any;
          const flow = STATUS_FLOW[order.status];

          return (
            <div key={order.id}
              className={cn("rounded-2xl overflow-hidden border transition-all",
                order.status === "pending"
                  ? "border-yellow-500/30 bg-yellow-500/3"
                  : "border-white/6 bg-white/2"
              )}>

              {/* ── Card Header ── */}
              <div className="flex items-center gap-3 p-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : order.id)}>

                <span className="text-2xl w-8 text-center shrink-0">{STATUS_ICONS[order.status]}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-bold text-white text-sm">#{order.order_number}</p>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", STATUS_COLORS[order.status])}>
                      {STATUS_LABELS[order.status]}
                    </span>
                    {order.payment_method === "cash_on_delivery" && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">COD</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><User size={11} />{order.users?.name ?? "Guest"}</span>
                    <span className="flex items-center gap-1"><Clock size={11} />{formatDate(order.created_at)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <p className="font-bold text-orange-400">{formatPrice(order.total_amount)}</p>

                  {/* Quick Accept/Reject for pending */}
                  {order.status === "pending" && (
                    <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => updateStatus(order.id, "confirmed")}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-colors">
                        <Check size={12} /> Accept
                      </button>
                      <button onClick={() => updateStatus(order.id, "cancelled")}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-xs font-bold transition-colors">
                        <X size={12} /> Reject
                      </button>
                    </div>
                  )}

                  <ChevronDown size={15} className={cn("text-gray-500 transition-transform", isExpanded && "rotate-180")} />
                </div>
              </div>

              {/* ── Expanded Details ── */}
              {isExpanded && (
                <div className="border-t border-white/6 p-4 space-y-5">

                  {/* Customer + Address */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 rounded-xl bg-white/3 border border-white/6">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Customer</p>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 gradient-brand rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0">
                          {order.users?.name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{order.users?.name ?? "—"}</p>
                          {order.users?.phone ? (
                            <a href={`tel:${order.users.phone}`} className="text-xs text-orange-400 flex items-center gap-1 hover:underline">
                              <Phone size={10} />{order.users.phone}
                            </a>
                          ) : <p className="text-xs text-gray-500">{order.users?.email ?? "—"}</p>}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white/3 border border-white/6">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Delivery Address</p>
                      <p className="text-sm text-white">{addr?.address_line1 ?? "—"}</p>
                      <p className="text-xs text-gray-400">{addr?.city}{addr?.pincode ? ` – ${addr.pincode}` : ""}</p>
                    </div>
                  </div>

                  {/* Items */}
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Items Ordered</p>
                    <div className="space-y-1.5">
                      {order.order_items?.map((item: any) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-gray-300">{item.name} <span className="text-gray-500">×{item.quantity}</span></span>
                          <span className="text-gray-400">{formatPrice(item.subtotal)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-bold pt-2 border-t border-white/6 mt-2">
                        <span className="text-white">Total</span>
                        <span className="text-orange-400">{formatPrice(order.total_amount)}</span>
                      </div>
                    </div>
                    {order.special_instructions && (
                      <p className="mt-3 text-xs text-yellow-300 bg-yellow-400/8 border border-yellow-400/15 rounded-lg px-3 py-2">
                        📝 {order.special_instructions}
                      </p>
                    )}
                  </div>

                  {/* Workflow Actions */}
                  {order.status !== "delivered" && order.status !== "cancelled" && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-white/6">

                      {/* Main next-step action */}
                      {flow && (
                        order.status === "ready" ? (
                          <button onClick={() => openRiderModal(order.id, order.order_number)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all bg-orange-600 hover:bg-orange-500 text-white">
                            <Truck size={15} /> Assign Rider
                          </button>
                        ) : (
                          <button onClick={() => updateStatus(order.id, flow.next)}
                            className={cn("flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all", flow.color)}>
                            {flow.label}
                          </button>
                        )
                      )}

                      {/* Cancel button (non-terminal states) */}
                      {!["delivered", "cancelled", "out_for_delivery"].includes(order.status) && (
                        <button onClick={() => updateStatus(order.id, "cancelled")}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                          <X size={14} /> Cancel
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ══════════════ RIDER ASSIGNMENT MODAL ══════════════ */}
      {riderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
          onClick={(e) => e.target === e.currentTarget && setRiderModal(null)}>

          <div className="w-full max-w-md rounded-3xl p-6"
            style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)" }}>

            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-xl text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  Assign Rider
                </h2>
                <p className="text-gray-500 text-sm">Order #{riderModal.orderNum}</p>
              </div>
              <button onClick={() => setRiderModal(null)} className="p-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/5">
                <X size={18} />
              </button>
            </div>

            {ridersLoading ? (
              <div className="flex items-center justify-center py-10 gap-3">
                <Loader2 size={22} className="animate-spin text-orange-500" />
                <span className="text-gray-500 text-sm">Loading riders...</span>
              </div>
            ) : riders.length === 0 ? (
              <div className="text-center py-10">
                <Truck size={36} className="mx-auto mb-3 text-gray-700" />
                <p className="text-white font-semibold mb-1">No riders found</p>
                <p className="text-gray-500 text-sm">Add delivery partners from Admin → Users panel and set their role to "delivery"</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {riders.map((rider) => (
                  <div key={rider.id}
                    className={cn("flex items-center gap-4 p-4 rounded-2xl border transition-all",
                      rider.isAvailable
                        ? "border-white/8 bg-white/3 hover:border-orange-500/30"
                        : "border-white/4 bg-white/1 opacity-60"
                    )}>

                    <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center text-white font-bold shrink-0">
                      {rider.name?.[0]?.toUpperCase() ?? "R"}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm">{rider.name}</p>
                      {rider.phone && (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Phone size={10} />{rider.phone}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full",
                          rider.isAvailable ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400")}>
                          {rider.isAvailable ? "● Available" : "● Busy"}
                        </span>
                        <span className="text-[10px] text-gray-600">{rider.activeDeliveries} active</span>
                      </div>
                    </div>

                    <button
                      onClick={() => rider.isAvailable && assignRider(rider.id, rider.name)}
                      disabled={!rider.isAvailable || assigning === rider.id}
                      className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                        rider.isAvailable
                          ? "bg-orange-600 hover:bg-orange-500 text-white"
                          : "bg-white/5 text-gray-600 cursor-not-allowed")}>
                      {assigning === rider.id ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={13} />}
                      {rider.isAvailable ? "Assign" : "Busy"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
