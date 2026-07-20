"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

export type StatusMode = "auto" | "manual_open" | "temporarily_closed";

export interface RestaurantTimingSettings {
  opening_time: string;   // "HH:MM" 24-hour
  closing_time: string;   // "HH:MM" 24-hour
  status_mode: StatusMode;
  is_open: boolean;
  updated_at: string;
}

export interface UseRestaurantStatusReturn {
  isOpen: boolean;
  isTemporarilyClosed: boolean;
  statusMode: StatusMode;
  openingTime: string;
  closingTime: string;
  openingTimeFormatted: string;
  closingTimeFormatted: string;
  settings: RestaurantTimingSettings | null;
  loading: boolean;
  refetch: () => void;
}

export function formatTime(time: string): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

export function computeIsOpen(settings: RestaurantTimingSettings): boolean {
  const mode = settings.status_mode ?? "auto";
  if (mode === "temporarily_closed") return false;
  if (mode === "manual_open") return true;

  // Auto mode — compare current local time against opening/closing
  const opening = settings.opening_time ?? "09:00";
  const closing  = settings.closing_time  ?? "23:00";

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [oh, om] = opening.split(":").map(Number);
  const [ch, cm] = closing.split(":").map(Number);
  const openMinutes  = oh * 60 + om;
  const closeMinutes = ch * 60 + cm;

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

export function useRestaurantStatus(): UseRestaurantStatusReturn {
  const [settings, setSettings] = useState<RestaurantTimingSettings | null>(null);
  const [loading,  setLoading]  = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/restaurant-settings", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setSettings(data as RestaurantTimingSettings);
      }
    } catch {
      // Network error — assume open as safe default
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();

    // ── Supabase Realtime — instant owner→customer status broadcast ─────
    const channel = supabase
      .channel("restaurant_status_watch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "restaurant_settings", filter: "id=eq.1" },
        (payload) => {
          if (payload.new) {
            setSettings((prev) => ({ ...(prev ?? {} as any), ...(payload.new as any) }));
          }
        }
      )
      .subscribe();

    // Re-evaluate every 60 s in auto mode (time changes but DB doesn't)
    const ticker = setInterval(() => {
      setSettings((prev) => (prev ? { ...prev } : prev));
    }, 60_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(ticker);
    };
  }, [fetchSettings]);

  const defaultSettings: RestaurantTimingSettings = {
    opening_time: "09:00",
    closing_time: "23:00",
    status_mode: "auto",
    is_open: true,
    updated_at: new Date().toISOString(),
  };

  const effective = settings ?? defaultSettings;
  const isOpen  = computeIsOpen(effective);
  const mode    = (effective.status_mode ?? "auto") as StatusMode;
  const opening = effective.opening_time ?? "09:00";
  const closing  = effective.closing_time  ?? "23:00";

  return {
    isOpen,
    isTemporarilyClosed: mode === "temporarily_closed",
    statusMode: mode,
    openingTime: opening,
    closingTime: closing,
    openingTimeFormatted: formatTime(opening),
    closingTimeFormatted: formatTime(closing),
    settings,
    loading,
    refetch: fetchSettings,
  };
}
