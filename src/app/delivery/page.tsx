"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "next/navigation";
import { formatPrice, formatDate } from "@/lib/utils";
import {
  startLoopingAlarm,
  stopCurrentAlarm,
  requestNotificationPermission,
  showBrowserNotification,
} from "@/lib/alarm";
import {
  MapPin, Package, CheckCircle, Loader2, Navigation,
  Phone, RefreshCw, User, Copy, CreditCard, AlignLeft, Info, LogOut, BellOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  assigned:  "bg-blue-50 text-blue-700 border-blue-200",
  picked_up: "bg-orange-50 text-orange-700 border-orange-200",
  delivered: "bg-green-50 text-green-700 border-green-200",
};

export default function DeliveryDashboard() {
  const { user }  = useAuthStore();
  const router    = useRouter();
  const [orders, setOrders]         = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [todayCount, setTodayCount] = useState(0);
  const [todayKm, setTodayKm]       = useState<number | null>(null);

  // ── Rider alarm refs & state ──────────────────────────────────
  // stopRiderAlarmRef: holds stop fn for the current looping alarm
  const stopRiderAlarmRef = useRef<(() => void) | null>(null);
  // riderAlarmActive: controls the persistent alarm banner visibility
  const [riderAlarmActive, setRiderAlarmActive] = useState(false);
  const hasPermissionRef  = useRef(false);

  function dismissRiderAlarm() {
    stopCurrentAlarm();
    stopRiderAlarmRef.current = null;
    setRiderAlarmActive(false);
  }

  // OTP state per tracking-id
  const [otpInputs, setOtpInputs]   = useState<Record<string, string>>({});
  const [otpLoading, setOtpLoading] = useState<Record<string, boolean>>({});
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [isOnline, setIsOnline]           = useState<boolean>(false);
  const [signingOut, setSigningOut]       = useState(false);

  const fetchMyOrders = useCallback(async () => {
    if (!user) return;

    // FIX: Direct anon-key supabase query cascade-fails due to RLS.
    // The nested embed: delivery_tracking → orders → users(customer)
    // fails because the rider has NO policy to read other users (customers).
    // PostgREST uses INNER JOIN for m2o relations:
    //   users join blocked → orders row dropped → delivery_tracking row dropped → data=[]
    // Solution: use /api/rider/orders (service-role) which bypasses all RLS
    // and returns the same data shape the dashboard expects.
    try {
      const res  = await fetch("/api/rider/orders", { credentials: "include" });
      const json = await res.json();
      if (res.ok) {
        setOrders(json.orders ?? []);
      } else {
        console.error("[fetchMyOrders] API error:", json.error);
        setOrders([]);
      }
    } catch (err: any) {
      console.error("[fetchMyOrders] Network error:", err.message);
      setOrders([]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    if (user.role !== "delivery") { router.push("/"); return; }

    fetchMyOrders();
    fetchTodayCount();
    fetch(`/api/rider/stats?riderId=${user.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.todayDistanceKm !== undefined) setTodayKm(d.todayDistanceKm); })
      .catch(() => {});

    // Check account status and online status via service-role API (bypasses RLS recursion)
    (async () => {
      try {
        const res  = await fetch("/api/rider/profile", { credentials: "include" });
        const json = await res.json();
        if (res.ok && json.partner) {
          const p  = json.partner;
          // Actual online status from delivery_partners.is_available
          setIsOnline(!!p.is_available);
          const st = p.account_status ?? "active";
          if (st === "suspended" && p.suspension_end && new Date(p.suspension_end) <= new Date()) {
            setAccountStatus("active");
          } else {
            setAccountStatus(st);
          }
        }
      } catch {
        // ignore — non-critical
      }
    })();

    let watchId: number;
    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(async (pos) => {
        // Use fetch to server-side API so service role key bypasses RLS
        await fetch("/api/rider/location", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            latitude:  pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        }).catch(() => {/* non-critical — ignore location update failures */});
      }, undefined, { enableHighAccuracy: true });
    }

    const channel = supabase.channel(`rider-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "delivery_tracking",
        filter: `partner_id=eq.${user.id}`,
      }, () => {
        // ── Start looping alarm ──────────────────────────────────
        // Stop any existing alarm, then start a fresh looping one
        if (stopRiderAlarmRef.current) { stopRiderAlarmRef.current(); }
        const stopFn = startLoopingAlarm();
        stopRiderAlarmRef.current = stopFn;
        setRiderAlarmActive(true);

        // Browser notification (visible even when tab is in background)
        showBrowserNotification(
          "🛕 New Delivery Assigned!",
          "You have a new order to pick up. Open your dashboard to accept."
        );

        // Keep the existing toast for quick visual feedback on-screen
        toast.custom((t) => (
          <div className={cn(
            "flex items-center gap-4 px-5 py-4 rounded-2xl shadow-xl border",
            "bg-white border-orange-200",
            t.visible ? "" : "opacity-0"
          )}>
            <span className="text-3xl">📦</span>
            <div>
              <p className="font-bold text-slate-800 text-sm">New Order Assigned!</p>
              <p className="text-orange-500 text-xs">Check your dashboard and pick up</p>
            </div>
          </div>
        ), { duration: 8000, position: "top-center" });

        fetchMyOrders();
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "delivery_tracking",
        filter: `partner_id=eq.${user.id}`,
      }, fetchMyOrders)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      // Stop alarm if rider closes/leaves the page
      stopCurrentAlarm();
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [user, fetchMyOrders]);

  // Request notification permission once on mount
  useEffect(() => {
    if (!hasPermissionRef.current) {
      hasPermissionRef.current = true;
      requestNotificationPermission().catch(() => {});
    }
  }, []);

  async function fetchTodayCount() {
    if (!user) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("delivery_tracking")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", user.id)
      .eq("status", "delivered")
      .gte("updated_at", today.toISOString());
    setTodayCount(count ?? 0);
  }

  async function refreshKm() {
    if (!user) return;
    try {
      const res = await fetch(`/api/rider/stats?riderId=${user.id}`);
      const d   = await res.json();
      if (d.todayDistanceKm !== undefined) setTodayKm(d.todayDistanceKm);
    } catch { /* non-critical */ }
  }

  async function fullRefresh() {
    await Promise.all([fetchMyOrders(), fetchTodayCount(), refreshKm()]);
    toast.success("Refreshed! ✅", { duration: 1500 });
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      useAuthStore.getState().setUser(null);
      toast.success("Signed out successfully");
      router.push("/auth/login");
      router.refresh();
    } catch (err: any) {
      toast.error("Sign out failed: " + err.message);
      setSigningOut(false);
    }
  }

  async function updateDeliveryStatus(trackingId: string, orderId: string, newStatus: string, orderStatus: string) {
    console.log("[updateDeliveryStatus] Request:", { trackingId, orderId, newStatus, orderStatus });

    try {
      const res = await fetch("/api/rider/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          trackingId,
          orderId,
          trackingStatus: newStatus,
          orderStatus,
        }),
      });

      const json = await res.json();
      console.log("[updateDeliveryStatus] Response:", { ok: res.ok, status: res.status, json });

      if (!res.ok) {
        // Genuine failure — API returned an error
        console.error("[updateDeliveryStatus] Update failed:", json.error);
        toast.error("Failed to update status. Please try again.");
        return;
      }

      console.log("[updateDeliveryStatus] Success:", json);

      // ── Stop alarm when rider picks up or delivers ──────────────────
      if (newStatus === "picked_up" || newStatus === "delivered") {
        dismissRiderAlarm();
      }

      if (newStatus === "delivered") {
        setOrders((prev) => prev.filter((t) => t.id !== trackingId));
        setTodayCount((n) => n + 1);
        toast.success("Delivery completed! 🎉", { duration: 4000 });
        setTimeout(refreshKm, 2000);
      } else {
        setOrders((prev) => prev.map((t) => t.id === trackingId ? { ...t, status: newStatus } : t));
        toast.success(newStatus === "picked_up" ? "Order picked up! 📦" : "Status updated ✅");
      }
    } catch (err: any) {
      console.error("[updateDeliveryStatus] Network error:", err);
      toast.error("Network error. Please try again.");
    }
  }

  async function openGoogleMaps(addr: any) {
    if (!addr) { toast.error("No delivery address available"); return; }

    // Build destination — prefer coordinates (highest accuracy) over text address.
    // Note: delivery_address JSONB currently stores label/address_line1/city/state/pincode
    // without lat/lng. Coordinate branch is ready for future use if coords are added.
    let destination = "";
    if (addr.latitude && addr.longitude) {
      destination = `${addr.latitude},${addr.longitude}`;
    } else {
      const parts = [addr.address_line1, addr.address_line2, addr.city, addr.state, addr.pincode]
        .filter(Boolean);
      if (!parts.length) {
        toast.error("Delivery address is incomplete — cannot open navigation");
        return;
      }
      destination = encodeURIComponent(parts.join(", "));
    }

    // Try to get rider's current GPS as the origin so Google Maps auto-calculates
    // the route from the rider's live position. 3-second timeout — if GPS is
    // unavailable, Google Maps will use the device's last known location.
    let origin = "";
    if (typeof navigator !== "undefined" && navigator.geolocation && window.isSecureContext) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 3000,
            maximumAge: 30000,
            enableHighAccuracy: false,
          })
        );
        origin = `${pos.coords.latitude},${pos.coords.longitude}`;
      } catch {
        // GPS unavailable or denied — Google Maps will use device location automatically
      }
    }

    // CRITICAL FIX: `dir_action=navigate` opens Google Maps directly in turn-by-turn
    // navigation mode (shows the Start button immediately) instead of the plain
    // Directions preview. Works on Android, iOS (Google Maps app or browser), and desktop.
    let url = `https://www.google.com/maps/dir/?api=1`
      + `&destination=${destination}`
      + `&travelmode=driving`
      + `&dir_action=navigate`;         // ← This is the key fix

    if (origin) {
      url += `&origin=${origin}`;       // Rider's live GPS position as start point
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function verifyOtpAndDeliver(trackingId: string, orderId: string) {
    const enteredOtp = (otpInputs[trackingId] ?? "").trim();
    if (!enteredOtp || enteredOtp.length !== 6) {
      toast.error("Please enter the 6-digit OTP"); return;
    }
    setOtpLoading((p) => ({ ...p, [trackingId]: true }));
    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, enteredOtp }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "OTP verification failed");
        setOtpLoading((p) => ({ ...p, [trackingId]: false }));
        return;
      }
      await updateDeliveryStatus(trackingId, orderId, "delivered", "delivered");
      toast.success("✅ OTP verified! Delivery confirmed.", { duration: 5000 });
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setOtpLoading((p) => ({ ...p, [trackingId]: false }));
    }
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center gap-3" style={{ background: "var(--bg-primary)" }}>
      <Loader2 size={28} className="animate-spin text-orange-500" />
      <span style={{ color: "var(--text-secondary)" }}>Loading...</span>
    </div>
  );

  // Account status banners — shown at top but do NOT block existing functionality rendering
  const accountBanner = accountStatus === "blocked" ? (
    <div className="mb-4 rounded-2xl p-4 bg-red-50 border border-red-200">
      <p className="text-red-700 font-bold text-base flex items-center gap-2">🚫 Account Blocked</p>
      <p className="text-red-600 text-sm mt-1">Your rider account has been blocked by the restaurant administrator. Please contact support.</p>
    </div>
  ) : accountStatus === "disabled" ? (
    <div className="mb-4 rounded-2xl p-4 bg-orange-50 border border-orange-200">
      <p className="text-orange-700 font-bold text-base flex items-center gap-2">🔕 Account Disabled</p>
      <p className="text-orange-600 text-sm mt-1">Your account has been temporarily disabled. You cannot go online or receive orders. Please contact support.</p>
    </div>
  ) : accountStatus === "suspended" ? (
    <div className="mb-4 rounded-2xl p-4 bg-amber-50 border border-amber-200">
      <p className="text-amber-700 font-bold text-base flex items-center gap-2">⏸️ Account Suspended</p>
      <p className="text-amber-600 text-sm mt-1">Your account is suspended. You cannot go online or receive orders until suspension ends.</p>
    </div>
  ) : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">

      {/* ── Rider New-Order Alarm Banner ─────────────────────────────────
           Visible until rider clicks "Picked Up" or dismisses manually.
      ─────────────────────────────────────────────────────────────── */}
      {riderAlarmActive && (
        <div
          className="mb-4 rounded-2xl flex items-center justify-between gap-2 px-4 py-3"
          style={{
            background:  "linear-gradient(135deg, #b91c1c, #dc2626)",
            boxShadow:   "0 4px 20px rgba(220,38,38,0.45)",
            animation:   "pulse 0.8s ease-in-out infinite",
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl shrink-0">📦</span>
            <div className="min-w-0">
              <p className="font-black text-white text-sm">New Order Assigned!</p>
              <p className="text-red-200 text-xs">Pick up the order to stop this alarm</p>
            </div>
          </div>
          <button
            onClick={dismissRiderAlarm}
            title="Dismiss alarm"
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-sm font-bold text-white/80 hover:text-white hover:bg-white/10 transition-all shrink-0"
          >
            <BellOff size={15} />
          </button>
        </div>
      )}

      {/* Account Status Banner */}
      {accountBanner}

      {/* ── Header ── */}
      <div className="rounded-2xl p-4 sm:p-5 mb-5 flex items-center gap-3 sm:gap-4"
        style={{ background: "linear-gradient(135deg,rgba(249,115,22,0.08),rgba(220,38,38,0.04))", border: "1px solid rgba(249,115,22,0.18)" }}>
        <div className="w-10 h-10 sm:w-12 sm:h-12 gradient-brand rounded-xl flex items-center justify-center text-xl sm:text-2xl shadow-brand shrink-0">🛵</div>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg sm:text-xl" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-primary)" }}>
            Delivery Dashboard
          </h1>
          <p className="text-orange-500 text-sm truncate">{user?.name}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 sm:gap-2 shrink-0">
          <div className={`flex items-center gap-1.5 text-xs sm:text-sm font-medium ${isOnline ? "text-green-600" : "text-slate-500"}`}>
            <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-500 animate-pulse" : "bg-slate-400"}`} />
            {isOnline ? "Online" : "Offline"}
          </div>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{todayCount} today</p>
          <div className="flex items-center gap-2">
            <Link href="/delivery/profile"
              className="flex items-center gap-1 text-[10px] sm:text-xs text-orange-500 hover:text-orange-600 transition-colors font-medium">
              <User size={11} /> Profile
            </Link>
            <button onClick={handleSignOut} disabled={signingOut}
              className="flex items-center gap-1 text-[10px] sm:text-xs text-red-500 hover:text-red-600 transition-colors font-medium disabled:opacity-50">
              {signingOut ? <Loader2 size={11} className="animate-spin" /> : <LogOut size={11} />}
              {signingOut ? "..." : "Sign Out"}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        {[
          { label: "Active",   value: orders.length,                            color: "text-orange-600", icon: "📦" },
          { label: "Today",    value: todayCount,                               color: "text-green-600",  icon: "✅" },
          { label: "Distance", value: todayKm !== null ? `${todayKm} km` : "—", color: "text-blue-600",   icon: "📍" },
          { label: "Status",   value: isOnline ? "Online" : "Offline",          color: isOnline ? "text-teal-600" : "text-slate-500", icon: isOnline ? "🟢" : "🔴" },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="rounded-xl p-2.5 text-center"
            style={{ background: "var(--card-bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
            <p className="text-base mb-0.5">{icon}</p>
            <p className={cn("font-bold text-base", color)}>{value}</p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Refresh */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
          Active Orders {orders.length > 0 && <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>({orders.length})</span>}
        </h2>
        <button onClick={fullRefresh}
          className="flex items-center gap-1.5 text-xs transition-colors font-medium"
          style={{ color: "var(--text-muted)" }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-20 rounded-2xl"
          style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
          <Package size={48} className="text-slate-300 mx-auto mb-4" />
          <p className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>No active orders</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>New orders assigned to you will appear here instantly</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((tracking: any) => {
            const order = tracking.orders;
            const addr  = order?.delivery_address as any;

            return (
              <div key={tracking.id} className="rounded-2xl overflow-hidden"
                style={{ background: "var(--card-bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>

                {/* Card Header */}
                <div className="flex items-center gap-3 p-4"
                  style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                  <span className="text-xl">{tracking.status === "assigned" ? "📦" : "🛵"}</span>
                  <div className="flex-1">
                    <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>#{order?.order_number}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{formatDate(order?.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-orange-600">{formatPrice(order?.total_amount)}</p>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", STATUS_COLORS[tracking.status] ?? "bg-slate-100 text-slate-600 border-slate-200")}>
                      {tracking.status === "assigned" ? "Assigned" : tracking.status === "picked_up" ? "Picked Up" : tracking.status}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-5">
                  {/* Customer Section */}
                  <div className="rounded-xl border p-4 bg-orange-50/50 border-orange-100">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 gradient-brand rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0">
                        {order?.users?.name?.[0]?.toUpperCase() ?? "U"}
                      </div>
                      <div className="flex-1">
                        <p className="text-base font-bold text-slate-800">{order?.users?.name ?? "Customer"}</p>
                        
                        {/* Primary Phone */}
                        {order?.users?.phone && (
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                              <Phone size={14} className="text-orange-500" /> {order.users.phone}
                            </p>
                            <div className="flex items-center gap-2">
                              <a href={`tel:${order.users.phone}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white text-xs font-bold rounded-lg hover:bg-orange-600 transition-colors">
                                <Phone size={12} /> Call
                              </a>
                              <button onClick={() => { navigator.clipboard.writeText(order.users.phone); toast.success("Number copied!"); }}
                                className="flex items-center justify-center w-8 h-8 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
                                <Copy size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {/* Alternate Phone */}
                        {addr?.alt_phone && (
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                              <Phone size={12} className="text-slate-400" /> Alt: {addr.alt_phone}
                            </p>
                            <div className="flex items-center gap-2">
                              <a href={`tel:${addr.alt_phone}`} className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors">
                                <Phone size={10} /> Call Alt
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Delivery Address Section */}
                  <div className="rounded-xl overflow-hidden"
                    style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                          <MapPin size={16} className="text-orange-500" /> Delivery Address
                        </h3>
                        <button onClick={() => {
                          const fullAddress = `${addr?.address_line1}, ${addr?.city} ${addr?.pincode ? `- ${addr.pincode}` : ""} ${addr?.landmark ? `(Landmark: ${addr.landmark})` : ""}`;
                          navigator.clipboard.writeText(fullAddress); 
                          toast.success("Address copied!"); 
                        }}
                          className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700 bg-orange-50 px-2 py-1 rounded-md">
                          <Copy size={12} /> Copy
                        </button>
                      </div>
                      
                      <div className="ml-6 space-y-1">
                        <p className="text-sm font-medium text-slate-800 leading-snug">{addr?.address_line1 ?? "Address not provided"}</p>
                        {addr?.landmark && <p className="text-xs text-slate-600"><strong>Landmark:</strong> {addr.landmark}</p>}
                        <p className="text-xs text-slate-600">{addr?.city}{addr?.pincode ? ` – ${addr.pincode}` : ""}</p>
                        
                        {order?.delivery_distance_km != null && (
                          <p className="text-xs font-semibold text-blue-600 mt-2 inline-block bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            Est. Distance: {order.delivery_distance_km} km
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => openGoogleMaps(addr)}
                      className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-orange-600 transition-colors hover:bg-orange-50"
                      style={{ borderTop: "1px solid rgba(249,115,22,0.15)", background: "var(--accent-peach)" }}>
                      <Navigation size={15} /> 🗺️ Navigate with Google Maps
                    </button>
                  </div>

                  {/* Customer Instructions */}
                  {order?.special_instructions && (
                    <div className="rounded-xl p-3 bg-yellow-50 border border-yellow-200 flex gap-3 items-start">
                      <Info size={16} className="text-yellow-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-yellow-800 mb-0.5">Customer Instructions</p>
                        <p className="text-sm text-yellow-900">{order.special_instructions}</p>
                      </div>
                    </div>
                  )}

                  {/* Order Details & Items */}
                  <div className="rounded-xl p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between mb-3 border-b pb-2" style={{ borderColor: "var(--border)" }}>
                      <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                        <AlignLeft size={16} className="text-slate-500" /> Order Items
                      </h3>
                      <span className="text-xs font-semibold bg-slate-200 text-slate-700 px-2 py-0.5 rounded uppercase">
                        {order?.payment_method?.replace("_", " ")}
                      </span>
                    </div>
                    
                    <div className="space-y-2 mb-3">
                      {order?.order_items?.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between items-start text-sm">
                          <p style={{ color: "var(--text-primary)" }}>
                            <span className="font-medium">{item.quantity}x</span> {item.name}
                          </p>
                          <p className="font-medium" style={{ color: "var(--text-secondary)" }}>
                            {formatPrice(item.price * item.quantity)}
                          </p>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex justify-between items-center pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                      <p className="text-sm font-bold text-slate-600">Total Amount</p>
                      <p className="text-lg font-black text-orange-600">{formatPrice(order?.total_amount)}</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    {tracking.status === "assigned" && (
                      <button onClick={() => updateDeliveryStatus(tracking.id, order.id, "picked_up", "out_for_delivery")}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-orange-500 hover:bg-orange-600 text-white transition-colors shadow-sm">
                        <Package size={16} /> Picked Up
                      </button>
                    )}

                    {tracking.status === "picked_up" && (
                      <div className="flex-1 space-y-2">
                        <div className="rounded-xl p-3" style={{ background: "var(--accent-lavender)", border: "1px solid rgba(99,102,241,0.2)" }}>
                          <p className="text-xs font-bold text-indigo-700 mb-2">🔐 Enter Customer OTP to Deliver</p>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              maxLength={6}
                              placeholder="Enter 6-digit OTP"
                              value={otpInputs[tracking.id] ?? ""}
                              onChange={(e) => setOtpInputs((p) => ({ ...p, [tracking.id]: e.target.value.slice(0, 6) }))}
                              className="flex-1 rounded-xl px-3 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                              style={{ background: "white", border: "1.5px solid rgba(99,102,241,0.3)", color: "var(--text-primary)" }}
                            />
                            <button
                              onClick={() => verifyOtpAndDeliver(tracking.id, order.id)}
                              disabled={otpLoading[tracking.id]}
                              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-60">
                              {otpLoading[tracking.id]
                                ? <Loader2 size={15} className="animate-spin" />
                                : <CheckCircle size={15} />}
                              Verify
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
