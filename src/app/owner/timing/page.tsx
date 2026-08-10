"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { Clock, Save, Loader2, RefreshCw, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "next/navigation";
import { formatTime, computeIsOpen, StatusMode, RestaurantTimingSettings } from "@/hooks/useRestaurantStatus";

type Mode = StatusMode;

const MODE_OPTIONS: { value: Mode; label: string; desc: string; color: string }[] = [
  { value: "auto",               label: "🕐 Auto",               desc: "Automatically open/closed based on the time you set below.", color: "#f97316" },
  { value: "manual_open",        label: "🟢 Open Manually",       desc: "Force restaurant to appear OPEN regardless of timing.",      color: "#22c55e" },
  { value: "temporarily_closed", label: "🔴 Temporarily Closed",  desc: "Force restaurant CLOSED immediately. Blocks all new orders.", color: "#ef4444" },
];

export default function OwnerTimingPage() {
  const { user, loading: authLoading } = useAuthStore();
  const router = useRouter();

  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [settings,  setSettings]  = useState<RestaurantTimingSettings | null>(null);

  const [openingTime, setOpeningTime] = useState("09:00");
  const [closingTime,  setClosingTime]  = useState("23:00");
  const [statusMode,  setStatusMode]  = useState<Mode>("auto");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== "restaurant_owner") router.replace("/auth/login");
  }, [user, authLoading, router]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/restaurant-settings", { cache: "no-store" });
      if (res.ok) {
        const data: RestaurantTimingSettings = await res.json();
        setSettings(data);
        setOpeningTime(data.opening_time ?? "09:00");
        setClosingTime(data.closing_time  ?? "23:00");
        setStatusMode((data.status_mode ?? "auto") as Mode);
      }
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();

    // Realtime — watch for changes (e.g. another admin tab or same tab after save)
    // NOTE: server-side filter "id=eq.1" is removed because it can silently fail
    // for integer-type primary key columns in some Supabase configs.
    // We filter client-side instead — equally correct and always reliable.
    const channel = supabase
      .channel("owner_timing_watch")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "restaurant_settings" },
        (payload) => {
          const row = payload.new as any;
          if (row && (row.id === 1 || row.id === "1")) {
            setSettings((prev) => ({ ...(prev ?? {} as any), ...row }));
            setOpeningTime(row.opening_time ?? "09:00");
            setClosingTime(row.closing_time  ?? "23:00");
            setStatusMode((row.status_mode ?? "auto") as Mode);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchSettings]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/restaurant-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opening_time: openingTime, closing_time: closingTime, status_mode: statusMode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      // Update from server response first (fastest)
      setSettings((prev) => ({ ...(prev ?? {} as any), ...json }));
      toast.success("Timing settings saved! ✅");
      // Re-fetch to confirm DB state (catches any edge-cache discrepancy)
      await fetchSettings();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={32} className="animate-spin text-orange-500" />
    </div>
  );

  const isCurrentlyOpen = settings ? computeIsOpen({ ...settings, opening_time: openingTime, closing_time: closingTime, status_mode: statusMode }) : true;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-primary)" }}>
            Restaurant Timing &amp; Status
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Control when customers can place orders
          </p>
        </div>
        <button
          onClick={async () => { setIsRefreshing(true); await fetchSettings(); setIsRefreshing(false); }}
          disabled={isRefreshing}
          className="p-2 rounded-xl transition hover:opacity-70" title="Refresh"
          style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
          <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} style={{ color: "var(--text-muted)" }} />
        </button>
      </div>

      {/* ── Current Status Card ─────────────────────────────────────── */}
      <div className="rounded-2xl p-5 flex items-center gap-4"
        style={{ background: isCurrentlyOpen ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${isCurrentlyOpen ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}` }}>
        <div className={`w-4 h-4 rounded-full animate-pulse shrink-0 ${isCurrentlyOpen ? "bg-green-500" : "bg-red-500"}`} />
        <div className="flex-1">
          <p className="font-bold text-base" style={{ color: isCurrentlyOpen ? "#22c55e" : "#ef4444" }}>
            {statusMode === "temporarily_closed" ? "Temporarily Closed" : isCurrentlyOpen ? "Currently Open" : "Currently Closed"}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Mode: {MODE_OPTIONS.find((m) => m.value === statusMode)?.label} &nbsp;·&nbsp;
            Hours: {formatTime(openingTime)} – {formatTime(closingTime)}
          </p>
          {settings?.updated_at && (
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Last updated: {new Date(settings.updated_at).toLocaleString("en-IN")}
            </p>
          )}
        </div>
        <CheckCircle size={22} style={{ color: isCurrentlyOpen ? "#22c55e" : "#ef4444" }} />
      </div>

      {/* ── Mode Selector ───────────────────────────────────────────── */}
      <div className="rounded-2xl p-5 space-y-3"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
        <h2 className="font-semibold text-sm uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          Restaurant Mode
        </h2>
        {MODE_OPTIONS.map((opt) => (
          <label key={opt.value}
            className="flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all"
            style={{
              background: statusMode === opt.value ? `${opt.color}15` : "transparent",
              border: `1px solid ${statusMode === opt.value ? opt.color + "50" : "var(--border)"}`,
            }}>
            <input
              type="radio"
              name="status_mode"
              value={opt.value}
              checked={statusMode === opt.value}
              onChange={() => setStatusMode(opt.value)}
              className="mt-1 shrink-0"
            />
            <div>
              <p className="font-semibold text-sm" style={{ color: statusMode === opt.value ? opt.color : "var(--text-primary)" }}>
                {opt.label}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{opt.desc}</p>
            </div>
          </label>
        ))}
      </div>

      {/* ── Business Hours ───────────────────────────────────────────── */}
      <div className="rounded-2xl p-5 space-y-4"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)", opacity: statusMode !== "auto" ? 0.5 : 1 }}>
        <div className="flex items-center gap-2">
          <Clock size={16} style={{ color: "var(--text-muted)" }} />
          <h2 className="font-semibold text-sm uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Business Hours (Auto Mode only)
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
              Opening Time
            </label>
            <input
              type="time"
              value={openingTime}
              onChange={(e) => setOpeningTime(e.target.value)}
              disabled={statusMode !== "auto"}
              className="input-field w-full"
            />
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{formatTime(openingTime)}</p>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
              Closing Time
            </label>
            <input
              type="time"
              value={closingTime}
              onChange={(e) => setClosingTime(e.target.value)}
              disabled={statusMode !== "auto"}
              className="input-field w-full"
            />
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{formatTime(closingTime)}</p>
          </div>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          ℹ️ Times use your device&apos;s local timezone. Customers see status based on IST.
        </p>
      </div>

      {/* ── Save Button ─────────────────────────────────────────────── */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
        style={{ background: "linear-gradient(135deg,#f97316,#dc2626)" }}
      >
        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
        {saving ? "Saving..." : "Save Timing Settings"}
      </button>

    </div>
  );
}
