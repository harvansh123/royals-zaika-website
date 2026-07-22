"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import {
  startLoopingAlarm,
  stopCurrentAlarm,
  requestNotificationPermission,
  showBrowserNotification,
} from "@/lib/alarm";
import { BellOff } from "lucide-react";

export function GlobalAlarmProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();

  // For Owner
  const [newOrderNums, setNewOrderNums] = useState<string[]>([]);
  // For Rider
  const [riderAlarmActive, setRiderAlarmActive] = useState(false);

  const stopAlarmRef = useRef<(() => void) | null>(null);
  const hasShownPermRef = useRef(false);

  // Stop alarm + clear state
  const dismissAlarm = useCallback(() => {
    stopCurrentAlarm();
    if (stopAlarmRef.current) {
      stopAlarmRef.current = null;
    }
    setNewOrderNums([]);
    setRiderAlarmActive(false);
  }, []);

  // Auto-dismiss if owner navigates to Orders page
  useEffect(() => {
    if (user?.role === "restaurant_owner" || user?.role === "admin") {
      if (pathname === "/owner/orders" || pathname.startsWith("/owner/orders/")) {
        dismissAlarm();
      }
    }
  }, [pathname, user?.role, dismissAlarm]);

  useEffect(() => {
    if (!user) return; // Wait until user is resolved

    if (!hasShownPermRef.current) {
      hasShownPermRef.current = true;
      requestNotificationPermission().catch(() => {});
    }

    let channel: ReturnType<typeof supabase.channel> | null = null;

    if (user.role === "restaurant_owner" || user.role === "admin") {
      // ── Owner Alarm ──────────────────────────────────
      channel = supabase
        .channel("global-owner-alarm")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "orders" },
          (payload) => {
            const newOrder = payload.new as { order_number?: string; status?: string };
            const num = newOrder.order_number ?? "New";

            setNewOrderNums((prev) => [...prev, `#${num}`]);

            if (!stopAlarmRef.current) {
              const stopFn = startLoopingAlarm();
              stopAlarmRef.current = stopFn;
            }

            showBrowserNotification(
              "🔔 New Order Received!",
              `Order #${num} is waiting for your confirmation.`
            );
          }
        )
        .subscribe();
    } else if (user.role === "delivery") {
      // ── Rider Alarm ──────────────────────────────────
      channel = supabase
        .channel("global-rider-alarm")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "delivery_tracking", filter: `partner_id=eq.${user.id}` },
          () => {
            if (stopAlarmRef.current) { stopAlarmRef.current(); }
            const stopFn = startLoopingAlarm();
            stopAlarmRef.current = stopFn;
            setRiderAlarmActive(true);

            showBrowserNotification(
              "🛕 New Delivery Assigned!",
              "You have a new order to pick up. Open your dashboard to accept."
            );
          }
        )
        .subscribe();
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      stopCurrentAlarm();
    };
  }, [user]);

  return (
    <>
      {children}
      
      {/* ── Owner Banner ────────────────────────────────── */}
      {newOrderNums.length > 0 && (
        <div
          className="fixed top-14 left-0 right-0 z-[9999] flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5"
          style={{
            background: "linear-gradient(135deg, #dc2626, #b91c1c)",
            boxShadow: "0 4px 24px rgba(220,38,38,0.5)",
            animation: "pulse 1s ease-in-out infinite",
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0" style={{ animation: "bounce 0.5s infinite alternate" }}>🔔</span>
            <div className="min-w-0">
              <p className="font-black text-white text-xs sm:text-sm leading-tight">
                {newOrderNums.length === 1
                  ? `Order ${newOrderNums[0]}!`
                  : `${newOrderNums.length} New Orders!`} — Action needed
              </p>
              {newOrderNums.length > 1 && (
                <p className="text-red-200 text-[10px] truncate max-w-[180px] sm:max-w-none">{newOrderNums.join(", ")}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => { router.push("/owner/orders"); dismissAlarm(); }}
              className="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold text-red-700 transition-all hover:opacity-90 whitespace-nowrap"
              style={{ background: "white" }}
            >
              View
            </button>
            <button
              onClick={dismissAlarm}
              title="Dismiss alarm"
              className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all"
            >
              <BellOff size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Rider Banner ────────────────────────────────── */}
      {riderAlarmActive && (
        <div
          className="fixed top-14 left-0 right-0 z-[9999] flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5"
          style={{
            background: "linear-gradient(135deg, #f97316, #ea580c)",
            boxShadow: "0 4px 24px rgba(234,88,12,0.5)",
            animation: "pulse 1s ease-in-out infinite",
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0" style={{ animation: "bounce 0.5s infinite alternate" }}>📦</span>
            <div className="min-w-0">
              <p className="font-black text-white text-xs sm:text-sm leading-tight">
                New Delivery Assigned!
              </p>
              <p className="text-orange-200 text-[10px]">Action needed</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => { router.push("/delivery"); dismissAlarm(); }}
              className="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold text-orange-700 transition-all hover:opacity-90 whitespace-nowrap"
              style={{ background: "white" }}
            >
              View
            </button>
            <button
              onClick={dismissAlarm}
              title="Dismiss alarm"
              className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all"
            >
              <BellOff size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
