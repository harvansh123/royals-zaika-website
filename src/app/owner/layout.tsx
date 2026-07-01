"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { LayoutDashboard, ShoppingBag, UtensilsCrossed, LogOut, UserCircle, HelpCircle, MapPin, Users, Tag, Bell, BellOff } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import {
  startLoopingAlarm,
  stopCurrentAlarm,
  requestNotificationPermission,
  showBrowserNotification,
} from "@/lib/alarm";

const tabs = [
  { href: "/owner",          icon: LayoutDashboard, label: "Dashboard" },
  { href: "/owner/orders",   icon: ShoppingBag,     label: "Orders"    },
  { href: "/owner/menu",     icon: UtensilsCrossed, label: "Menu"      },
  { href: "/owner/offers",   icon: Tag,             label: "Offers"    },
  { href: "/owner/riders",   icon: Users,           label: "Riders"    },
  { href: "/owner/support",  icon: HelpCircle,      label: "Support"   },
  { href: "/owner/delivery-settings", icon: MapPin, label: "Delivery"  },
  { href: "/owner/profile",  icon: UserCircle,      label: "Profile"   },
];

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  // ── Alarm state ────────────────────────────────────────────────────
  // newOrderNums: list of order_number strings that have not been acknowledged
  const [newOrderNums, setNewOrderNums] = useState<string[]>([]);
  const stopAlarmRef  = useRef<(() => void) | null>(null);
  const hasShownPermRef = useRef(false);

  // Stop alarm + clear banner
  const dismissAlarm = useCallback(() => {
    stopCurrentAlarm();
    stopAlarmRef.current = null;
    setNewOrderNums([]);
  }, []);

  // Auto-dismiss when owner navigates to Orders page (they'll see the orders)
  useEffect(() => {
    if (pathname === "/owner/orders" || pathname.startsWith("/owner/orders/")) {
      dismissAlarm();
    }
  }, [pathname, dismissAlarm]);

  // ── Supabase Realtime — new pending orders ─────────────────────────
  useEffect(() => {
    // Request notification permission once
    if (!hasShownPermRef.current) {
      hasShownPermRef.current = true;
      requestNotificationPermission().catch(() => {});
    }

    const channel = supabase
      .channel("owner-layout-alarm")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const newOrder = payload.new as { order_number?: string; status?: string };

          // Ring for any new order (customer always places pending orders)
          const num = newOrder.order_number ?? "New";

          setNewOrderNums((prev) => [...prev, `#${num}`]);

          // Start/continue looping alarm
          if (!stopAlarmRef.current) {
            const stopFn = startLoopingAlarm();
            stopAlarmRef.current = stopFn;
          }

          // Browser notification (works even if tab is in background)
          showBrowserNotification(
            "🔔 New Order Received!",
            `Order #${num} is waiting for your confirmation.`
          );
        }
      )
      .subscribe((status) => {
        if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          // Supabase auto-reconnects; channel will resubscribe automatically
          console.warn("[owner-layout-alarm] channel status:", status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
      // Stop alarm on layout unmount (owner signed out etc.)
      stopCurrentAlarm();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function signOut() {
    await supabase.auth.signOut();
    stopCurrentAlarm();
    toast.success("Signed out");
    router.push("/auth/login");
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>

      {/* ── New Order Alarm Banner ─────────────────────────────────────
           Appears at the very top (below the fixed header) when new orders
           arrive. Stays until the owner dismisses or navigates to /owner/orders.
      ─────────────────────────────────────────────────────────────── */}
      {newOrderNums.length > 0 && (
        <div
          className="fixed top-14 left-0 right-0 z-[60] flex items-center justify-between gap-4 px-5 py-3"
          style={{
            background:   "linear-gradient(135deg, #dc2626, #b91c1c)",
            boxShadow:    "0 4px 24px rgba(220,38,38,0.5)",
            animation:    "pulse 1s ease-in-out infinite",
          }}
        >
          {/* Pulsing bell icon */}
          <div className="flex items-center gap-3">
            <span className="text-2xl" style={{ animation: "bounce 0.5s infinite alternate" }}>🔔</span>
            <div>
              <p className="font-black text-white text-sm md:text-base">
                {newOrderNums.length === 1
                  ? `New Order ${newOrderNums[0]}!`
                  : `${newOrderNums.length} New Orders!`} — Needs Your Action
              </p>
              {newOrderNums.length > 1 && (
                <p className="text-red-200 text-xs">{newOrderNums.join(", ")}</p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { router.push("/owner/orders"); dismissAlarm(); }}
              className="px-4 py-2 rounded-xl text-sm font-bold text-red-700 transition-all hover:opacity-90"
              style={{ background: "white" }}
            >
              View Orders
            </button>
            <button
              onClick={dismissAlarm}
              title="Dismiss alarm"
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all"
            >
              <BellOff size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── Top Header ───────────────────────────────────────────────── */}
      <header
        className="fixed left-0 right-0 z-50 flex items-center justify-between px-5 h-14"
        style={{
          top:          newOrderNums.length > 0 ? 0 : 0, // header stays at 0
          background:   "var(--nav-bg)",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 gradient-brand rounded-lg flex items-center justify-center text-lg">👨‍🍳</div>
          <div>
            <p className="font-bold text-sm leading-none" style={{ color: "var(--text-primary)" }}>Chaurasia Ji</p>
            <p className="text-[10px] text-orange-500 leading-none">Owner Panel</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Compact bell indicator in header when alarm is active */}
          {newOrderNums.length > 0 && (
            <button
              onClick={() => { router.push("/owner/orders"); dismissAlarm(); }}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg text-white"
              style={{ background: "rgba(220,38,38,0.9)" }}
            >
              <Bell size={14} />
              {newOrderNums.length} New
            </button>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-all"
            style={{ color: "var(--text-secondary)" }}
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </header>

      {/* ── Desktop Sidebar ───────────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col fixed top-14 left-0 bottom-0 w-56 pt-6 px-3"
        style={{ background: "var(--bg-secondary)", borderRight: "1px solid var(--border)" }}
      >
        <p className="text-xs uppercase tracking-widest px-3 mb-3" style={{ color: "var(--text-muted)" }}>Navigation</p>
        <nav className="flex flex-col gap-1">
          {tabs.map(({ href, icon: Icon, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all", active ? "text-white" : "")}
                style={active
                  ? { background: "linear-gradient(135deg,#f97316,#dc2626)" }
                  : { color: "var(--text-secondary)" }}
              >
                <Icon size={18} />
                {label}
                {/* Badge on Orders tab when alarm is active */}
                {label === "Orders" && newOrderNums.length > 0 && (
                  <span className="ml-auto text-[10px] font-black px-1.5 py-0.5 rounded-full text-white"
                    style={{ background: "#dc2626" }}>
                    {newOrderNums.length}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* ── Main Content ──────────────────────────────────────────────── */}
      {/* Push content down when alarm banner is visible */}
      <main
        className="pt-14 md:pl-56 pb-24 md:pb-8 min-h-screen transition-all"
        style={{ paddingTop: newOrderNums.length > 0 ? "calc(3.5rem + 52px)" : "3.5rem" }}
      >
        {children}
      </main>

      {/* ── Mobile Bottom Tab Bar ─────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 flex z-50"
        style={{ background: "var(--nav-bg)", borderTop: "1px solid var(--border)", backdropFilter: "blur(12px)" }}
      >
        {tabs.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all relative">
              <Icon size={22} style={{ color: active ? "#f97316" : "var(--text-muted)" }} />
              <span className="text-[10px] font-medium" style={{ color: active ? "#f97316" : "var(--text-muted)" }}>{label}</span>
              {/* Red dot on Orders tab */}
              {label === "Orders" && newOrderNums.length > 0 && (
                <span className="absolute top-2 right-1/4 w-2 h-2 rounded-full bg-red-500" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* CSS keyframes for banner pulse animation */}
      <style>{`
        @keyframes banner-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}
