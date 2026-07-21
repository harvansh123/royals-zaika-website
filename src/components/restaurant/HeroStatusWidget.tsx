"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatTime, computeIsOpen, StatusMode, RestaurantTimingSettings } from "@/hooks/useRestaurantStatus";
import ClosedPopup from "@/components/restaurant/ClosedPopup";

interface Props {
  initialSettings: RestaurantTimingSettings;
}

/**
 * HeroStatusWidget — Client component embedded in the server-rendered homepage.
 * Handles realtime updates from Supabase and keeps status badge + button dynamic.
 */
export default function HeroStatusWidget({ initialSettings }: Props) {
  const [settings, setSettings] = useState<RestaurantTimingSettings>(initialSettings);
  // Re-compute every 60 s so auto mode reflects time changes
  const [, setTick] = useState(0);

  const isOpen = computeIsOpen(settings);
  const mode   = settings.status_mode as StatusMode;
  const isTemporarilyClosed = mode === "temporarily_closed";

  const openingFmt = formatTime(settings.opening_time ?? "09:00");
  const closingFmt  = formatTime(settings.closing_time  ?? "23:00");

  useEffect(() => {
    // Realtime subscription
    const channel = supabase
      .channel("hero_status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "restaurant_settings", filter: "id=eq.1" },
        (payload) => {
          if (payload.new) setSettings((prev) => ({ ...prev, ...(payload.new as any) }));
        }
      )
      .subscribe();

    // 60-second ticker for auto-mode re-evaluation
    const timer = setInterval(() => setTick((t) => t + 1), 60_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, []);

  const statusLabel = isTemporarilyClosed
    ? "🔴 Temporarily Closed"
    : isOpen
    ? "🟢 Open Now"
    : "🔴 Closed";

  return (
    <>
      {/* Popup for temporarily closed — shown once per session */}
      <ClosedPopup isTemporarilyClosed={isTemporarilyClosed} />

      {/* ── Status Badge ──────────────────────────────────────────────── */}
      <div
        className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full text-sm font-medium transition-all duration-500"
        style={{
          background: isOpen ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${isOpen ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
          color: isOpen ? "#4ade80" : "#f87171",
        }}
      >
        <span className="font-semibold">{statusLabel}</span>
        <span style={{ color: "rgba(255,255,255,0.4)" }}>·</span>
        <span style={{ color: "rgba(255,255,255,0.6)" }}>
          {openingFmt} – {closingFmt}
        </span>
      </div>

      {/* ── CTA Button — changes label based on open/closed state ────── */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/menu"
          className="inline-flex items-center justify-center gap-2 text-base py-3.5 px-8 rounded-xl font-bold text-white transition-all duration-300 hover:opacity-90"
          style={{
            background: isOpen
              ? "linear-gradient(135deg,#f97316,#dc2626)"
              : "linear-gradient(135deg,#ef4444,#991b1b)",
            opacity: isOpen ? 1 : 0.85,
          }}
        >
          {isOpen ? (
            <>Order Now <ArrowRight size={18} /></>
          ) : (
            <>View Menu <ArrowRight size={18} /></>
          )}
        </Link>
      </div>

    </>
  );
}
