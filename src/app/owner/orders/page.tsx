"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/utils";
import {
  Check, X, ChevronDown, Loader2, Clock, Package,
  Bike, UserCheck, X as XIcon, User, Phone, MapPin,
  Calendar, Receipt, CreditCard, AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

// ── Types ────────────────────────────────────────────────────────────
type OrderItem = { name: string; quantity: number; price: number; subtotal: number };
type OrderUser = { name: string | null; phone: string | null; email: string | null };

type Order = {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number;
  created_at: string;
  payment_method: string;
  payment_status: string;
  special_instructions: string | null;
  delivery_address: any;
  order_items?: OrderItem[];
  users?: OrderUser | null;
};

type Rider = {
  id: string; name: string; phone: string;
  vehicle_type: string; is_available: boolean; total_deliveries: number;
};

type Filter = "all" | "pending" | "preparing" | "delivered" | "cancelled";

// ── Status config ─────────────────────────────────────────────────────
const STATUS_FLOW: Record<string, { next: string; label: string; color: string }[]> = {
  // CHANGE 2: Accept → auto-jump to "preparing" (Cooking)
  pending:          [{ next: "preparing",  label: "✅ Confirm & Start Cooking", color: "#22c55e" },
                     { next: "cancelled",  label: "❌ Reject",                   color: "#ef4444" }],
  confirmed:        [{ next: "preparing",  label: "🍳 Start Cooking",            color: "#f97316" }],
  preparing:        [{ next: "ready",      label: "✅ Mark Ready",               color: "#3b82f6" }],
  ready:            [],  // handled by Assign Rider modal
  out_for_delivery: [{ next: "delivered",  label: "✅ Delivered",                color: "#22c55e" }],
  picked_up:        [{ next: "delivered",  label: "✅ Delivered",                color: "#22c55e" }],
  delivered:        [],
  cancelled:        [],
};

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  pending:          { label: "Pending",          bg: "rgba(245,158,11,0.12)",  color: "#f59e0b" },
  confirmed:        { label: "Confirmed",         bg: "rgba(59,130,246,0.12)", color: "#3b82f6" },
  preparing:        { label: "Cooking 🍳",        bg: "rgba(139,92,246,0.12)", color: "#8b5cf6" },
  ready:            { label: "Ready to Dispatch", bg: "rgba(34,197,94,0.12)",  color: "#22c55e" },
  picked_up:        { label: "Out for Delivery",  bg: "rgba(249,115,22,0.12)", color: "#f97316" },
  out_for_delivery: { label: "Out for Delivery",  bg: "rgba(249,115,22,0.12)", color: "#f97316" },
  delivered:        { label: "Delivered",         bg: "rgba(16,185,129,0.12)", color: "#10b981" },
  cancelled:        { label: "Cancelled",         bg: "rgba(239,68,68,0.12)",  color: "#ef4444" },
};

export default function OwnerOrdersPage() {
  const [orders, setOrders]         = useState<Order[]>([]);
  const [filter, setFilter]         = useState<Filter>("all");
  const [loading, setLoading]       = useState(true);
  const [expanded, setExpanded]     = useState<string | null>(null);

  // Assign rider modal
  const [assignModal, setAssignModal]     = useState<{ order: Order } | null>(null);
  const [riders, setRiders]               = useState<Rider[]>([]);
  const [ridersLoading, setRidersLoading] = useState(false);
  const [selectedRider, setSelectedRider] = useState<string | null>(null);
  const [assigning, setAssigning]         = useState(false);

  // Cancel order modal
  const [cancelModal, setCancelModal]     = useState<{ order: Order } | null>(null);
  const [cancelReason, setCancelReason]   = useState("");
  const [cancelling, setCancelling]       = useState(false);

  useEffect(() => {
    loadOrders();
    // Realtime — listen for any order changes
    const ch = supabase.channel("owner-orders-page")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (p) => {
        loadOrders(); // reload to get joined user data too
        toast.success(`🔔 New order #${(p.new as Order).order_number}!`);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, async (p) => {
        // FIX 1: Use service-role API so order_items are always included after update
        const updatedId = (p.new as Order).id;
        const res = await fetch(`/api/owner/orders?limit=100`);
        const json = await res.json();
        if (json.orders) {
          const refreshed = json.orders.find((o: Order) => o.id === updatedId);
          if (refreshed) setOrders((prev) => prev.map((o) => o.id === updatedId ? refreshed : o));
        }
      })
      .subscribe();

    // ── Realtime: delivery_partners ──────────────────────────────────
    // When a rider goes Online/Offline while the assign-modal is open,
    // add them to or remove them from the riders list immediately.
    const riderCh = supabase
      .channel("owner-orders-riders-status")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "delivery_partners" },
        (payload) => {
          const updated = payload.new as any;
          if (!updated?.id) return;

          const isNowOnline =
            updated.is_available === true && updated.account_status === "active";

          setRiders((prev) => {
            const exists = prev.some((r) => r.id === updated.id);

            if (isNowOnline && !exists) {
              // Rider just came online — add them to the list
              return [
                ...prev,
                {
                  id:                updated.id,
                  name:              updated.name              ?? "Unnamed",
                  phone:             updated.phone             ?? "—",
                  vehicle_type:      updated.vehicle_type      ?? "bike",
                  is_available:      true,
                  total_deliveries:  updated.total_deliveries  ?? 0,
                },
              ];
            }

            if (!isNowOnline && exists) {
              // Rider went offline — remove them from the list
              return prev.filter((r) => r.id !== updated.id);
            }

            // No change needed
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
      supabase.removeChannel(riderCh);
    };
  }, []);

  async function loadOrders() {
    setLoading(true);
    // FIX 1: Use service-role API so order_items are always visible (bypasses RLS)
    const res  = await fetch(`/api/owner/orders?limit=100`);
    const json = await res.json();
    setOrders(json.orders ?? []);
    setLoading(false);
  }

  // CHANGE 2: When accepting a pending order, auto-jump to "preparing" (Cooking)
  async function updateStatus(orderId: string, status: string) {
    // If accepting (going from pending to preparing), briefly record "confirmed" then move to preparing
    if (status === "preparing") {
      // One-shot: set directly to "preparing" so customer sees "Cooking" immediately
      const { error } = await supabase.from("orders").update({ status: "preparing" }).eq("id", orderId);
      if (error) { toast.error("Failed to update"); return; }
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: "preparing" } : o));
      toast.success("✅ Order confirmed & cooking started!");
      return;
    }

    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) { toast.error("Failed to update"); return; }
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
    const labels: Record<string, string> = {
      ready: "Order marked ready! 🔔",
      delivered: "Order delivered! 🎉",
      cancelled: "Order cancelled",
    };
    toast.success(labels[status] ?? "Status updated!");
  }

  async function handleCancelOrder() {
    if (!cancelModal) return;
    const reason = cancelReason.trim();
    if (!reason) { toast.error("Please enter a cancellation reason"); return; }
    setCancelling(true);
    try {
      const res  = await fetch("/api/owner/orders/cancel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: cancelModal.order.id, reason }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Cancel failed"); return; }
      setOrders((prev) =>
        prev.map((o) => o.id === cancelModal.order.id ? { ...o, status: "cancelled" } : o)
      );
      toast.success(`Order #${cancelModal.order.order_number} cancelled`);
      setCancelModal(null);
      setCancelReason("");
    } catch (err: any) {
      toast.error("Cancel failed: " + err.message);
    }
    setCancelling(false);
  }

  async function openAssignModal(order: Order) {

    setAssignModal({ order });
    setSelectedRider(null);
    setRidersLoading(true);

    // FIX: Direct supabase.from("users") with anon key → triggers "Admins view all users"
    // RLS policy → calls get_user_role() → queries users again → infinite recursion.
    // Solution: use the existing /api/owner/riders service-role endpoint which already
    // joins delivery_partners (for is_available) and filters correctly.
    try {
      const res  = await fetch("/api/owner/riders?status=all");
      const json = await res.json();

      if (!res.ok) {
        toast.error("Could not load riders: " + (json.error ?? "Unknown error"));
        setRiders([]);
      } else {
        // Only show riders who are Online (is_available=true) and have an active account
        const online = (json.riders ?? []).filter(
          (r: any) => r.is_available === true && r.account_status === "active"
        );
        setRiders(online.map((r: any) => ({
          id: r.id,
          name: r.name ?? "Unnamed",
          phone: r.phone ?? "—",
          vehicle_type: r.vehicle_type ?? "bike",
          is_available: r.is_available,
          total_deliveries: r.total_deliveries ?? 0,
        })));
      }
    } catch (err: any) {
      toast.error("Could not load riders: " + err.message);
      setRiders([]);
    }
    setRidersLoading(false);
  }

  async function handleAssignRider() {
    if (!assignModal || !selectedRider) return;
    setAssigning(true);
    try {
      const rider = riders.find((r) => r.id === selectedRider)!;

      // FIX: Direct anon-key supabase.from("delivery_tracking").insert() fails silently
      // due to RLS: "Delivery partners update tracking" policy only allows
      //   partner_id = auth.uid()  OR  get_user_role() = 'admin'
      // Owner has 'restaurant_owner' role — neither condition matches → INSERT blocked.
      // This means the rider NEVER receives the order in their dashboard.
      //
      // Solution: use the existing /api/owner/riders/assign service-role endpoint
      // which bypasses RLS entirely and correctly creates the delivery_tracking row.
      const res  = await fetch("/api/owner/riders/assign", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId:   assignModal.order.id,
          riderId:   selectedRider,
          ownerName: "Owner",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Assignment failed");

      // Optimistic UI update — mark as out-for-delivery
      setOrders((prev) => prev.map((o) =>
        o.id === assignModal.order.id ? { ...o, status: "picked_up" } : o
      ));
      toast.success(`✅ Order assigned to ${rider.name}!`);
      setAssignModal(null);
    } catch (err: any) {
      toast.error("Assignment failed: " + err.message);
    }
    setAssigning(false);
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "all",       label: "All" },
    { id: "pending",   label: "🕐 Pending" },
    { id: "preparing", label: "🍳 Cooking" },
    { id: "delivered", label: "✅ Done" },
    { id: "cancelled", label: "❌ Cancelled" },
  ];

  const pendingCount = orders.filter((o) => o.status === "pending").length;

  const filtered = filter === "all" ? orders : orders.filter((o) =>
    filter === "preparing"
      ? ["confirmed", "preparing", "ready", "out_for_delivery", "picked_up"].includes(o.status)
      : o.status === filter
  );

  return (
    <div className="p-5 md:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-bold text-2xl md:text-3xl" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-primary)" }}>
          Orders
        </h1>
        {pendingCount > 0 && (
          <span className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-xl animate-pulse"
            style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
            🕐 {pendingCount} Pending
          </span>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-6">
        {filters.map(({ id, label }) => (
          <button key={id} onClick={() => setFilter(id)}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={filter === id
              ? { background: "linear-gradient(135deg,#f97316,#dc2626)", color: "#fff" }
              : { background: "var(--bg-glass)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-orange-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Package size={48} className="mx-auto mb-4 opacity-20" style={{ color: "var(--text-muted)" }} />
          <p style={{ color: "var(--text-secondary)" }}>No orders here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const st      = STATUS_STYLE[order.status] ?? { label: order.status, bg: "rgba(156,163,175,0.12)", color: "#9ca3af" };
            const actions = STATUS_FLOW[order.status] ?? [];
            const isExp   = expanded === order.id;
            const addr    = order.delivery_address as any;

            return (
              <div key={order.id} className="rounded-2xl overflow-hidden transition-all"
                style={{
                  background: "var(--card-bg)",
                  border: order.status === "pending"
                    ? "1px solid rgba(245,158,11,0.4)"
                    : "1px solid var(--border)"
                }}>

                {/* ── Order Header Row ── */}
                <div className="flex items-center gap-3 px-5 py-4 cursor-pointer"
                  onClick={() => setExpanded(isExp ? null : order.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold" style={{ color: "var(--text-primary)" }}>
                        #{order.order_number}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                        style={{ background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                      {order.payment_method === "cash_on_delivery" && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}>
                          💵 COD
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      {/* CHANGE 1: Show customer name if available */}
                      {order.users?.name && (
                        <span className="flex items-center gap-1">
                          <User size={10} />{order.users.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(order.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                  <p className="font-bold text-orange-500">{formatPrice(order.total_amount)}</p>
                  <ChevronDown size={18}
                    className={cn("transition-transform flex-shrink-0", isExp && "rotate-180")}
                    style={{ color: "var(--text-muted)" }} />
                </div>

                {/* ── CHANGE 1: Full Expanded Details ── */}
                {isExp && (
                  <div style={{ borderTop: "1px solid var(--border)" }}>

                    {/* Customer Info Card */}
                    <div className="mx-5 mt-4 p-4 rounded-xl"
                      style={{ background: "var(--bg-glass)", border: "1px solid var(--border)" }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                        style={{ color: "var(--text-muted)" }}>Customer Details</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User size={14} style={{ color: "var(--text-muted)" }} />
                          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {order.users?.name ?? "—"}
                          </span>
                        </div>
                        {order.users?.phone && (
                          <div className="flex items-center gap-2">
                            <Phone size={14} style={{ color: "var(--text-muted)" }} />
                            <a href={`tel:${order.users.phone}`}
                              className="text-sm text-orange-500 hover:underline"
                              onClick={(e) => e.stopPropagation()}>
                              {order.users.phone}
                            </a>
                          </div>
                        )}
                        {addr && (
                          <div className="flex items-start gap-2">
                            <MapPin size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                              {addr.address_line1}
                              {addr.address_line2 ? `, ${addr.address_line2}` : ""}
                              {addr.city ? `, ${addr.city}` : ""}
                              {addr.pincode ? ` – ${addr.pincode}` : ""}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Order Meta */}
                    <div className="mx-5 mt-3 grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl text-xs" style={{ background: "var(--bg-glass)", border: "1px solid var(--border)" }}>
                        <p className="mb-1" style={{ color: "var(--text-muted)" }}>Order ID</p>
                        <p className="font-mono font-medium text-[11px]" style={{ color: "var(--text-primary)" }}>
                          {order.id.slice(0, 8).toUpperCase()}...
                        </p>
                      </div>
                      <div className="p-3 rounded-xl text-xs" style={{ background: "var(--bg-glass)", border: "1px solid var(--border)" }}>
                        <p className="mb-1" style={{ color: "var(--text-muted)" }}>Date & Time</p>
                        <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                          {new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}{" "}
                          {new Date(order.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>

                    {/* Items List */}
                    {order.order_items && order.order_items.length > 0 && (
                      <div className="mx-5 mt-3 p-4 rounded-xl"
                        style={{ background: "var(--bg-glass)", border: "1px solid var(--border)" }}>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                          style={{ color: "var(--text-muted)" }}>Items Ordered</p>
                        <div className="space-y-2">
                          {order.order_items.map((item, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-md text-xs font-bold flex items-center justify-center flex-shrink-0"
                                  style={{ background: "rgba(249,115,22,0.12)", color: "#f97316" }}>
                                  {item.quantity}
                                </span>
                                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                                  {item.name}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                  {formatPrice(item.subtotal ?? item.price * item.quantity)}
                                </span>
                                {item.quantity > 1 && (
                                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                                    {formatPrice(item.price)} × {item.quantity}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Special Instructions */}
                    {order.special_instructions && (
                      <div className="mx-5 mt-3 p-3 rounded-xl text-xs flex items-start gap-2"
                        style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)" }}>
                        <span>📝</span>
                        <span style={{ color: "var(--text-secondary)" }}>{order.special_instructions}</span>
                      </div>
                    )}

                    {/* Financial Breakdown */}
                    <div className="mx-5 mt-3 p-4 rounded-xl"
                      style={{ background: "var(--bg-glass)", border: "1px solid var(--border)" }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-3"
                        style={{ color: "var(--text-muted)" }}>Bill Summary</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span style={{ color: "var(--text-secondary)" }}>Subtotal</span>
                          <span style={{ color: "var(--text-primary)" }}>{formatPrice(order.subtotal ?? 0)}</span>
                        </div>
                        {(order.delivery_fee ?? 0) > 0 && (
                          <div className="flex justify-between">
                            <span style={{ color: "var(--text-secondary)" }}>Delivery Fee</span>
                            <span style={{ color: "var(--text-primary)" }}>{formatPrice(order.delivery_fee)}</span>
                          </div>
                        )}
                        {(order.discount_amount ?? 0) > 0 && (
                          <div className="flex justify-between">
                            <span style={{ color: "var(--text-secondary)" }}>Discount</span>
                            <span style={{ color: "#22c55e" }}>– {formatPrice(order.discount_amount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-2 font-bold"
                          style={{ borderTop: "1px solid var(--border)" }}>
                          <span style={{ color: "var(--text-primary)" }}>Total</span>
                          <span className="text-orange-500">{formatPrice(order.total_amount)}</span>
                        </div>
                        <div className="flex justify-between text-xs pt-1">
                          <span style={{ color: "var(--text-muted)" }}>Payment</span>
                          <span className="font-medium" style={{ color: "var(--text-secondary)" }}>
                            {order.payment_method === "cash_on_delivery" ? "💵 Cash on Delivery" : "💳 Online"}
                            {" · "}
                            <span style={{ color: order.payment_status === "paid" ? "#22c55e" : "#f59e0b" }}>
                              {order.payment_status === "paid" ? "Paid" : "Pending"}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Current Status Display */}
                    <div className="mx-5 mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl"
                      style={{ background: `${st.color}12`, border: `1px solid ${st.color}30` }}>
                      <div className="w-2 h-2 rounded-full" style={{ background: st.color }} />
                      <span className="text-xs font-semibold" style={{ color: st.color }}>
                        Current Status: {st.label}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="px-5 py-4 space-y-2">
                      {actions.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {actions.map(({ next, label, color }) => (
                            <button key={next}
                              onClick={() => updateStatus(order.id, next)}
                              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] text-white min-w-[120px]"
                              style={{ background: color }}>
                              {label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* READY → Assign Rider */}
                      {order.status === "ready" && (
                        <button onClick={() => openAssignModal(order)}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
                          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff" }}>
                          <Bike size={16} /> Assign Delivery Rider
                        </button>
                      )}

                      {/* Cancel Order — available at every stage before delivered */}
                      {order.status !== "delivered" && order.status !== "cancelled" && (
                        <button
                          onClick={() => { setCancelModal({ order }); setCancelReason(""); }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] mt-1"
                          style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
                          <AlertTriangle size={14} /> Cancel Order
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ ASSIGN RIDER MODAL (unchanged) ══ */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md rounded-3xl overflow-hidden"
            style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>

            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <h2 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>Assign Delivery Rider</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Order #{assignModal.order.order_number} · {formatPrice(assignModal.order.total_amount)}
                </p>
              </div>
              <button onClick={() => setAssignModal(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ color: "var(--text-muted)", background: "var(--bg-secondary)" }}>
                <XIcon size={16} />
              </button>
            </div>

            {assignModal.order.delivery_address && (
              <div className="mx-5 mt-4 p-3 rounded-xl text-xs flex items-start gap-2"
                style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "var(--text-secondary)" }}>
                <span className="text-base">📍</span>
                <span>
                  {(assignModal.order.delivery_address as any).address_line1},{" "}
                  {(assignModal.order.delivery_address as any).city} — {(assignModal.order.delivery_address as any).pincode}
                </span>
              </div>
            )}

            <div className="p-5">
              <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Available Riders
              </p>
              {ridersLoading ? (
                <div className="flex justify-center py-8"><Loader2 size={28} className="animate-spin text-orange-500" /></div>
              ) : riders.length === 0 ? (
                <div className="text-center py-8 rounded-2xl" style={{ background: "var(--bg-secondary)" }}>
                  <Bike size={36} className="mx-auto mb-2 opacity-30" style={{ color: "var(--text-muted)" }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>No riders available</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Add delivery partners from Admin → Users panel<br />and set their role to "delivery"
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {riders.map((rider) => (
                    <button key={rider.id} onClick={() => setSelectedRider(rider.id)}
                      className="w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all"
                      style={selectedRider === rider.id
                        ? { background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.4)" }
                        : { background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                        style={{ background: "rgba(99,102,241,0.1)" }}>🛵</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{rider.name}</p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>📞 {rider.phone}</p>
                      </div>
                      {selectedRider === rider.id && (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#6366f1" }}>
                          <Check size={11} className="text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {riders.length > 0 && (
                <button onClick={handleAssignRider} disabled={!selectedRider || assigning}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all mt-4 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff" }}>
                  {assigning
                    ? <><Loader2 size={16} className="animate-spin" /> Assigning...</>
                    : <><UserCheck size={16} /> Assign & Send Out for Delivery</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ CANCEL ORDER MODAL ══ */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md rounded-3xl overflow-hidden"
            style={{ background: "var(--card-bg)", border: "1px solid rgba(239,68,68,0.4)" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <h2 className="font-bold text-base text-red-400 flex items-center gap-2">
                  <AlertTriangle size={18} /> Cancel Order
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  #{cancelModal.order.order_number} · {formatPrice(cancelModal.order.total_amount)}
                </p>
              </div>
              <button onClick={() => { setCancelModal(null); setCancelReason(""); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ color: "var(--text-muted)", background: "var(--bg-secondary)" }}>
                <XIcon size={16} />
              </button>
            </div>

            {/* Current Status Warning */}
            <div className="mx-5 mt-4 p-3 rounded-xl text-xs flex items-center gap-2"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <span>⚠️</span>
              <span style={{ color: "var(--text-secondary)" }}>
                Current status: <strong className="text-red-400">{STATUS_STYLE[cancelModal.order.status]?.label ?? cancelModal.order.status}</strong>.{" "}
                This action cannot be undone.
              </span>
            </div>

            {/* Reason Input */}
            <div className="p-5">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: "var(--text-muted)" }}>
                Cancellation Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter reason for cancellation (required)..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl text-sm resize-none outline-none transition-all"
                style={{
                  background: "var(--bg-secondary)",
                  border: cancelReason.trim() ? "1px solid rgba(239,68,68,0.4)" : "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
              <p className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                This reason will be shown to the customer.
              </p>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => { setCancelModal(null); setCancelReason(""); }}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                  Keep Order
                </button>
                <button
                  onClick={handleCancelOrder}
                  disabled={!cancelReason.trim() || cancelling}
                  className="flex-1 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff" }}>
                  {cancelling
                    ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Cancelling...</span>
                    : "✅ Confirm Cancel"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
