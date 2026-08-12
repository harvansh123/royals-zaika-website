"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { LayoutDashboard, ShoppingBag, UtensilsCrossed, LogOut, UserCircle, HelpCircle, MapPin, Users, Tag, Bell, BellOff, Star, Clock, DollarSign, Home, Info, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { performSignOut } from "@/lib/sign-out";

const tabs = [
  { href: "/owner",          icon: LayoutDashboard, label: "Dashboard" },
  { href: "/owner/orders",   icon: ShoppingBag,     label: "Orders"    },
  { href: "/owner/menu",     icon: UtensilsCrossed, label: "Menu"      },
  { href: "/owner/offers",   icon: Tag,             label: "Offers"    },
  { href: "/owner/riders",   icon: Users,           label: "Riders"    },
  { href: "/owner/earnings", icon: DollarSign,      label: "Earnings"  },
  { href: "/owner/reviews",  icon: Star,            label: "Reviews"   },
  { href: "/owner/support",  icon: HelpCircle,      label: "Support"   },
  { href: "/owner/timing",   icon: Clock,           label: "Timing"    },
  { href: "/owner/delivery-settings", icon: MapPin, label: "Delivery"  },
  { href: "/owner/profile",  icon: UserCircle,      label: "Profile"   },
];

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  // ── Alarm state ────────────────────────────────────────────────────
  // Managed by GlobalAlarmProvider now

  async function signOut() {
    toast.success("Signed out");
    await performSignOut();
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>

      {/* ── Top Header ───────────────────────────────────────────────── */}
      <header
        className="fixed left-0 right-0 z-50 flex items-center justify-between px-5 h-14"
        style={{
          top:          0, // header stays at 0
          background:   "var(--nav-bg)",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 gradient-brand rounded-lg flex items-center justify-center text-lg">👨‍🍳</div>
          <div>
            <p className="font-bold text-sm leading-none" style={{ color: "var(--text-primary)" }}>Royal Zaika</p>
            <p className="text-[10px] text-orange-500 leading-none">Owner Panel</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
        className="hidden md:flex flex-col fixed top-14 left-0 bottom-0 w-56 pt-6 px-3 overflow-y-auto"
        style={{ background: "var(--bg-secondary)", borderRight: "1px solid var(--border)" }}
      >
        <p className="text-xs uppercase tracking-widest px-3 mb-3 flex-shrink-0" style={{ color: "var(--text-muted)" }}>Navigation</p>
        <nav className="flex flex-col gap-1 flex-shrink-0">
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
              </Link>
            );
          })}
        </nav>

        {/* Public Site Links */}
        <div className="mt-auto pt-4 pb-2 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-xs uppercase tracking-widest px-3 mb-2" style={{ color: "var(--text-muted)" }}>Public Site</p>
          <a href="/?view=public" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all hover:bg-white/5"
            style={{ color: "var(--text-secondary)" }}>
            <Home size={16} /> Home
            <ExternalLink size={11} className="ml-auto opacity-50" />
          </a>
          <a href="/about" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all hover:bg-white/5"
            style={{ color: "var(--text-secondary)" }}>
            <Info size={16} /> About
            <ExternalLink size={11} className="ml-auto opacity-50" />
          </a>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <main
        className="pt-14 md:pl-56 pb-24 md:pb-8 min-h-screen transition-all"
        style={{ paddingTop: "3.5rem" }}
      >
        {children}
      </main>

      {/* ── Mobile Bottom Tab Bar ─────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex overflow-x-auto no-scrollbar"
        style={{ background: "var(--nav-bg)", borderTop: "1px solid var(--border)", backdropFilter: "blur(12px)" }}
      >
        {tabs.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href}
              className="flex-shrink-0 flex flex-col items-center justify-center py-2.5 px-3 gap-0.5 transition-all relative min-w-[52px]"
            >
              <Icon size={20} style={{ color: active ? "#f97316" : "var(--text-muted)" }} />
              <span className="text-[9px] font-medium whitespace-nowrap" style={{ color: active ? "#f97316" : "var(--text-muted)" }}>{label}</span>
            </Link>
          );
        })}
        {/* Public Site links at end of mobile nav */}
        <a href="/?view=public" target="_blank" rel="noopener noreferrer"
          className="flex-shrink-0 flex flex-col items-center justify-center py-2.5 px-3 gap-0.5 min-w-[52px]"
        >
          <Home size={20} style={{ color: "var(--text-muted)" }} />
          <span className="text-[9px] font-medium whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Home</span>
        </a>
        <a href="/about" target="_blank" rel="noopener noreferrer"
          className="flex-shrink-0 flex flex-col items-center justify-center py-2.5 px-3 gap-0.5 min-w-[52px]"
        >
          <Info size={20} style={{ color: "var(--text-muted)" }} />
          <span className="text-[9px] font-medium whitespace-nowrap" style={{ color: "var(--text-muted)" }}>About</span>
        </a>
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

