"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { Loader2, MapPin, Save, Route, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

export default function DeliverySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  const [lat, setLat]       = useState("25.3176");
  const [lng, setLng]       = useState("82.9739");
  const [radius, setRadius] = useState("5.0");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/restaurant-settings");
        if (res.ok) {
          const data = await res.json();
          setLat(data.restaurant_lat?.toString() || "25.3176");
          setLng(data.restaurant_lng?.toString() || "82.9739");
          setRadius(data.delivery_radius_km?.toString() || "5.0");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function saveSettings() {
    setSaving(true);
    try {
      const res = await fetch("/api/restaurant-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_lat: parseFloat(lat),
          restaurant_lng: parseFloat(lng),
          delivery_radius_km: parseFloat(radius),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save settings");
      }
      toast.success("Delivery settings saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full pt-20">
        <Loader2 size={32} className="animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Route className="text-orange-500" />
          Delivery Settings
        </h1>
        <p className="text-gray-400 mt-1">Configure your restaurant location and delivery coverage area.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Restaurant Location */}
        <div className="rounded-2xl p-6" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <MapPin size={18} className="text-blue-500" />
            Restaurant Coordinates
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            These coordinates are used to calculate the delivery distance for all incoming orders.
          </p>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Latitude</label>
              <input
                type="number" step="0.0001"
                value={lat} onChange={(e) => setLat(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/50"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Longitude</label>
              <input
                type="number" step="0.0001"
                value={lng} onChange={(e) => setLng(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/50"
              />
            </div>
          </div>
        </div>

        {/* Delivery Radius */}
        <div className="rounded-2xl p-6 flex flex-col" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <Route size={18} className="text-green-500" />
            Maximum Delivery Radius
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Customers outside this distance will be automatically blocked from placing orders.
          </p>

          <div className="mb-6 flex-1">
            <label className="text-sm text-gray-400 mb-1 block">Radius in Kilometers (KM)</label>
            <input
              type="number" step="0.1" min="0.5"
              value={radius} onChange={(e) => setRadius(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/50"
            />
            
            <div className="flex flex-wrap gap-2 mt-3">
              {[1, 2, 3, 5, 7, 10].map(val => (
                <button
                  key={val}
                  onClick={() => setRadius(val.toString())}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    parseFloat(radius) === val 
                      ? "border-orange-500 bg-orange-500/10 text-orange-400" 
                      : "border-white/10 text-gray-400 hover:bg-white/5"
                  }`}
                >
                  {val} KM
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-4 bg-orange-500/10 border border-orange-500/20">
            <p className="text-xs text-orange-400 flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              Changes take effect immediately. Existing orders in progress are not affected.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-white gradient-brand transition-all hover:opacity-90 disabled:opacity-60"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? "Saving..." : "Save Delivery Settings"}
        </button>
      </div>
    </div>
  );
}
