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
  isAudioUnlocked,
} from "@/lib/alarm";
import { BellOff, Volume2, VolumeX } from "lucide-react";

// ── Web Push Helpers ──────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function registerServiceWorkerAndSubscribe(userId: string): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return; // Not supported
  }
  try {
    // Register SW
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    // Request notification permission
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return;

    // Get existing subscription OR create a new one
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: VAPID_PUBLIC_KEY,
      });
    }

    // ALWAYS save subscription to server (upsert) — even if sub already existed.
    // This re-registers the subscription if the DB row was accidentally deleted,
    // ensuring every browser/device receives push notifications.
    await fetch("/api/push/subscribe", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ subscription: sub.toJSON() }),
    });
  } catch (err) {
    console.error("[SW] Push subscription failed:", err);
  }
}

export function GlobalAlarmProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();

  // For Owner
  const [newOrderNums, setNewOrderNums] = useState<string[]>([]);
  // For Owner — rider rejection alerts
  const [riderRejections, setRiderRejections] = useState<Array<{
    orderNumber: string; riderName: string; reason: string; orderId: string;
  }>>([]);
  // For Rider
  const [riderAlarmActive, setRiderAlarmActive] = useState(false);
  // For Customer
  const [cancelledOrder, setCancelledOrder] = useState<{ orderNumber: string; reason: string | null } | null>(null);

  const stopAlarmRef = useRef<(() => void) | null>(null);
  const hasShownPermRef = useRef(false);

  // Track whether audio has been unlocked by user interaction
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundJustEnabled, setSoundJustEnabled] = useState(false);

  // Poll every 500ms to detect when audio gets unlocked (e.g. by global touch listener)
  useEffect(() => {
    if (soundEnabled) return;
    const isOwner = user?.role === "restaurant_owner" || user?.role === "admin";
    if (!isOwner) return;
    const id = setInterval(() => {
      if (isAudioUnlocked()) {
        setSoundEnabled(true);
        setSoundJustEnabled(true);
        setTimeout(() => setSoundJustEnabled(false), 2500);
        clearInterval(id);
      }
    }, 500);
    return () => clearInterval(id);
  }, [soundEnabled, user?.role]);

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

  // ── Register Service Worker on page load (no login needed) ──────────────
  // SW must be registered unconditionally so Chrome can offer PWA install
  // to any visitor — logged in or not.
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Silent fail — push notifications won't work but app still runs
      });
    }
  }, []);

  useEffect(() => {
    if (!user) return; // Wait until user is resolved

    if (!hasShownPermRef.current) {
      hasShownPermRef.current = true;
      // Push notification subscription (needs login for userId)
      registerServiceWorkerAndSubscribe(user.id).catch(() => {
        requestNotificationPermission().catch(() => {});
      });
    }

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let notifChannel: ReturnType<typeof supabase.channel> | null = null;

    if (user.role === "restaurant_owner" || user.role === "admin") {
      // ── Owner Alarm — new orders ─────────────────────
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
        // ── Stop alarm when order is accepted on ANY device ──────────
        // When any owner device accepts an order, its status changes in DB.
        // This UPDATE fires on ALL connected owner devices via Supabase realtime,
        // so the alarm stops everywhere — not just on the device that clicked Accept.
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders" },
          (payload) => {
            const updated = payload.new as { order_number?: string; status?: string };
            const oldRow  = payload.old as { status?: string };

            // Only act when order moves OUT of "pending"
            if (oldRow.status !== "pending" || updated.status === "pending") return;

            const orderTag = `#${updated.order_number ?? ""}`;

            setNewOrderNums((prev) => {
              const next = prev.filter((n) => n !== orderTag);
              // If no more unaccepted orders → stop alarm on this device too
              if (next.length === 0) {
                stopCurrentAlarm();
                stopAlarmRef.current = null;
              }
              return next;
            });
          }
        )
        .subscribe();

      // ── Owner Alarm — rider rejection notifications ───
      notifChannel = supabase
        .channel(`owner-rider-reject-${user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          (payload) => {
            const notif = payload.new as any;
            if (notif.type !== "rider_rejected_order") return;
            setRiderRejections((prev) => [...prev, {
              orderNumber: notif.data?.order_number ?? "",
              riderName:   notif.data?.rider_name   ?? "Rider",
              reason:      notif.data?.reason        ?? "",
              orderId:     notif.data?.order_id      ?? "",
            }]);
            if (!stopAlarmRef.current) {
              const stopFn = startLoopingAlarm();
              stopAlarmRef.current = stopFn;
            }
            showBrowserNotification(
              "⚠️ Rider ne Order Reject kiya!",
              notif.message ?? `Order #${notif.data?.order_number} reject hua. Reassign karein.`
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
    } else if (user.role === "customer") {
      // ── Customer Alarm ──────────────────────────────────
      channel = supabase
        .channel("global-customer-alarm")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
          (payload) => {
            const oldRecord = payload.old as { status?: string };
            const newRecord = payload.new as { status?: string; order_number?: string; cancellation_reason?: string };
            
            if (newRecord.status === "cancelled" && oldRecord.status !== "cancelled") {
              setCancelledOrder({
                orderNumber: newRecord.order_number ?? "Unknown",
                reason: newRecord.cancellation_reason ?? "No reason provided",
              });
              
              showBrowserNotification(
                "❌ Order Cancelled",
                `Your order #${newRecord.order_number ?? ""} has been cancelled. Reason: ${newRecord.cancellation_reason || "Not specified."}`
              );
            }
          }
        )
        .subscribe();
    }

    // ── Listen for Service Worker Messages ──────────────────────────
    // SW will postMessage if a push arrives while app is open in bg tab
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "PUSH_ALARM") {
        if (!stopAlarmRef.current) {
          const stopFn = startLoopingAlarm();
          stopAlarmRef.current = stopFn;
        }

        // Also update banner state if possible
        if (user.role === "restaurant_owner" || user.role === "admin") {
          setNewOrderNums((prev) => [...prev, "New"]);
        } else if (user.role === "delivery") {
          setRiderAlarmActive(true);
        }
      }
    };
    if (typeof navigator !== "undefined" && navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener("message", handleMessage);
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (notifChannel) {
        supabase.removeChannel(notifChannel);
      }
      if (typeof navigator !== "undefined" && navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener("message", handleMessage);
      }
      stopCurrentAlarm();
    };
  }, [user]);

  return (
    <>
      {children}

      {/* ── Owner: Sound Status Banner ──────────────────────────────────────
          Before enable : orange pulsing pill — "Tap to Enable Alarm Sound"
          After enable  : green pill — "✅ Alarm Sound ON!" shown for 2.5s  */}
      {(user?.role === "restaurant_owner" || user?.role === "admin") &&
        (pathname.startsWith("/owner") || pathname.startsWith("/admin")) && (
        <>
          {!soundEnabled && (
            <div
              onClick={() => {
                setTimeout(() => {
                  setSoundEnabled(isAudioUnlocked());
                  if (isAudioUnlocked()) {
                    setSoundJustEnabled(true);
                    setTimeout(() => setSoundJustEnabled(false), 2500);
                  }
                }, 400);
              }}
              className="fixed bottom-24 left-1/2 z-[9998] cursor-pointer select-none"
              style={{
                transform: "translateX(-50%)",
                background: "linear-gradient(135deg,#f97316,#ea580c)",
                color: "#fff",
                borderRadius: "999px",
                padding: "10px 20px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                fontWeight: 700,
                boxShadow: "0 4px 20px rgba(249,115,22,0.5)",
                whiteSpace: "nowrap",
                animation: "pulse 2s ease-in-out infinite",
              }}
            >
              <VolumeX size={16} />
              Tap to Enable Alarm Sound
            </div>
          )}
          {soundJustEnabled && (
            <div
              className="fixed bottom-24 left-1/2 z-[9998] select-none pointer-events-none"
              style={{
                transform: "translateX(-50%)",
                background: "linear-gradient(135deg,#16a34a,#15803d)",
                color: "#fff",
                borderRadius: "999px",
                padding: "10px 20px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                fontWeight: 700,
                boxShadow: "0 4px 20px rgba(22,163,74,0.5)",
                whiteSpace: "nowrap",
              }}
            >
              <Volume2 size={16} />
              ✅ Alarm Sound ON!
            </div>
          )}
        </>
      )}

      {/* ── Owner Banner — New Orders ───────────────────── */}
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

      {/* ── Owner Banner — Rider Rejection Alert ─────────── */}
      {riderRejections.length > 0 && (
        <div
          className="fixed left-0 right-0 z-[9998] flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5"
          style={{
            top: newOrderNums.length > 0 ? "7rem" : "3.5rem",
            background: "linear-gradient(135deg, #d97706, #b45309)",
            boxShadow: "0 4px 24px rgba(180,83,9,0.5)",
            animation: "pulse 1s ease-in-out infinite",
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0" style={{ animation: "bounce 0.5s infinite alternate" }}>⚠️</span>
            <div className="min-w-0">
              <p className="font-black text-white text-xs sm:text-sm leading-tight">
                {riderRejections.length === 1
                  ? `${riderRejections[0].riderName} ne Order #${riderRejections[0].orderNumber} reject kiya!`
                  : `${riderRejections.length} orders rider ne reject kiye!`}
              </p>
              <p className="text-amber-200 text-[10px] truncate max-w-[180px] sm:max-w-xs">
                Reason: {riderRejections[riderRejections.length - 1]?.reason}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => { router.push("/owner/orders"); setRiderRejections([]); stopCurrentAlarm(); if (stopAlarmRef.current) stopAlarmRef.current = null; }}
              className="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold text-amber-800 transition-all hover:opacity-90 whitespace-nowrap"
              style={{ background: "white" }}
            >
              Reassign Rider
            </button>
            <button
              onClick={() => { setRiderRejections([]); stopCurrentAlarm(); if (stopAlarmRef.current) stopAlarmRef.current = null; }}
              title="Dismiss"
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

      {/* ── Customer Cancellation Modal ────────────────────────────────── */}
      {cancelledOrder && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                ❌
              </div>
              <h2 className="text-xl font-black text-slate-800 mb-2">Order Cancelled</h2>
              <p className="text-sm font-medium text-slate-500 mb-4">
                Your order <span className="text-slate-800 font-bold">#{cancelledOrder.orderNumber}</span> has been cancelled by the restaurant.
              </p>
              
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-left mb-6">
                <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">Reason</p>
                <p className="text-sm text-red-900 font-medium">
                  {cancelledOrder.reason || "Not specified by the restaurant."}
                </p>
              </div>

              <button
                onClick={() => setCancelledOrder(null)}
                className="w-full font-bold py-3 rounded-xl transition-colors"
                style={{ background: "#1e293b", color: "#ffffff" }}
              >
                OK, got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
