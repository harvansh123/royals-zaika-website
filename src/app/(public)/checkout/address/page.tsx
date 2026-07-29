"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useCartStore } from "@/stores/cartStore";
import { supabase } from "@/lib/supabase/client";
import {
  MapPin, Plus, Loader2, CheckCircle, Trash2, Navigation,
  Home, Briefcase, Tag, ChevronLeft, ChevronRight, Check,
  Eye, AlertCircle, WifiOff, XCircle, Route
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { RestaurantSettings } from "@/lib/haversine";
import { getRouteDistanceKm } from "@/lib/routeDistance";

// ── Session-storage key ──────────────────────────────────────────
export const ADDRESS_SESSION_KEY = "cj_delivery_address";

// ── Types ────────────────────────────────────────────────────────
interface Address {
  id:            string;
  label:         string;
  address_line1: string;
  address_line2: string | null;
  city:          string;
  state:         string;
  pincode:       string;
  latitude:      number | null;
  longitude:     number | null;
  is_default:    boolean;
}

type Tab = "saved" | "new" | "gps";

const LABEL_OPTIONS = ["Home", "Work", "Other"];
function LabelIcon({ label }: { label: string }) {
  if (label === "Home") return <Home size={13} />;
  if (label === "Work") return <Briefcase size={13} />;
  return <Tag size={13} />;
}

type GpsStep = "idle" | "requesting" | "fetching" | "done" | "error" | "blocked";

// ── Multi-strategy geocoder (most precise → least precise) ──────────────
// Indian addresses are often non-standard; we try progressively simpler
// queries so that at minimum the pincode gives an area-level location.
async function tryMultiStrategyGeocode(
  line1: string,
  city: string,
  state: string,
  pincode: string
): Promise<{ lat: number; lng: number; accuracy: "precise" | "area" | "pincode" } | null> {
  const nominatim = async (q: string) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=in&limit=1&addressdetails=1`,
        { headers: { "User-Agent": "RoyalZaika-FoodApp/1.0", "Accept-Language": "en" } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return null;
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (isNaN(lat) || isNaN(lng)) return null;
      return { lat, lng };
    } catch { return null; }
  };

  const pin  = pincode.trim();
  const cty  = city.trim();
  const st   = state.trim();
  const l1   = line1.trim();

  // Strategy 1 — full address (most precise)
  if (l1 && cty && st && pin) {
    const r = await nominatim(`${l1}, ${cty}, ${st} ${pin}, India`);
    if (r) return { ...r, accuracy: "precise" };
  }

  // Strategy 2 — street/locality + city + pincode (skip house number junk)
  // Extract just the locality part (everything after first comma if any)
  const localityPart = l1.includes(",") ? l1.split(",").slice(1).join(",").trim() : l1;
  if (localityPart && cty && pin) {
    const r = await nominatim(`${localityPart}, ${cty}, ${st}, India`);
    if (r) return { ...r, accuracy: "precise" };
  }

  // Strategy 3 — city + state + pincode (area-level)
  if (cty && st && pin) {
    const r = await nominatim(`${cty}, ${st} ${pin}, India`);
    if (r) return { ...r, accuracy: "area" };
  }

  // Strategy 4 — pincode + state only (postal area fallback)
  if (pin && pin.length === 6) {
    const r = await nominatim(`${pin}, ${st}, India`);
    if (r) return { ...r, accuracy: "pincode" };
  }

  // Strategy 5 — pincode only
  if (pin && pin.length === 6) {
    const r = await nominatim(`${pin} India`);
    if (r) return { ...r, accuracy: "pincode" };
  }

  return null;
}

export default function CheckoutAddressPage() {
  const router             = useRouter();
  const { user, loading: authLoading } = useAuthStore();
  const { items, setDeliveryDistance } = useCartStore();

  const [settings, setSettings] = useState<RestaurantSettings | null>(null);

  // ── Address list ─────────────────────────────────────────────
  const [addresses,    setAddresses]    = useState<Address[]>([]);
  const [loadingAddrs, setLoadingAddrs] = useState(true);
  const [activeTab,    setActiveTab]    = useState<Tab>("saved");
  const [selectedAddr, setSelectedAddr] = useState<Address | null>(null);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [manualUnlocked, setManualUnlocked] = useState(false); // GPS is default; manual unlocked on demand

  // ── Form (new / edit) ────────────────────────────────────────
  const [editMode,  setEditMode]  = useState(false);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [label,     setLabel]     = useState("Home");
  const [line1,     setLine1]     = useState("");
  const [line2,     setLine2]     = useState("");
  const [city,      setCity]      = useState("");
  const [stateName, setStateName] = useState("");
  const [pincode,   setPincode]   = useState("");
  const [savingNew, setSavingNew] = useState(false);

  // ── GPS ──────────────────────────────────────────────────────
  const [gpsStep,    setGpsStep]    = useState<GpsStep>("idle");
  const [gpsError,   setGpsError]   = useState("");
  const [gpsDebug,   setGpsDebug]   = useState("");
  const [gpsRaw,     setGpsRaw]     = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAddr,    setGpsAddr]    = useState<Partial<Address> | null>(null);
  const [gpsSaving,  setGpsSaving]  = useState(false);
  const [showDebug,  setShowDebug]  = useState(false);
  const [recheckMsg, setRecheckMsg] = useState("");

  // ── Delivery Validation ──────────────────────────────────────
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [isDeliverable, setIsDeliverable] = useState(false);
  const [geocodingAddr, setGeocodingAddr] = useState(false); // auto-geocoding address without coords

  // ── Guards ───────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user)         { router.replace("/auth/login"); return; }
    if (!items.length) { router.replace("/cart");       return; }
  }, [user, authLoading, items.length, router]);

  // Fetch Delivery Settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/restaurant-settings");
        if (res.ok) {
          setSettings(await res.json());
        }
      } catch (err) {}
    }
    loadSettings();
  }, []);

  // Recalculate Distance when Address or Settings changes (for addresses WITH coordinates)
  // Uses Google Maps Routes API (driving distance) with haversine fallback.
  useEffect(() => {
    if (!selectedAddr || !settings) {
      setDistanceKm(null);
      setDeliveryDistance(null);
      setIsDeliverable(false);
      return;
    }
    if (selectedAddr.latitude && selectedAddr.longitude) {
      let cancelled = false;
      setGeocodingAddr(true);
      getRouteDistanceKm(
        settings.restaurant_lat, settings.restaurant_lng,
        selectedAddr.latitude,    selectedAddr.longitude
      ).then(dist => {
        if (cancelled) return;
        setDistanceKm(dist);
        setDeliveryDistance(dist);
        setIsDeliverable(dist <= settings.delivery_radius_km);
      }).catch(() => {
        // getRouteDistanceKm already has internal fallback; this branch is unreachable
      }).finally(() => {
        if (!cancelled) setGeocodingAddr(false);
      });
      return () => { cancelled = true; };
    } else {
      // No coordinates — auto-geocoding effect below will handle it
      setDistanceKm(null);
      setDeliveryDistance(null);
      setIsDeliverable(false);
    }
  }, [selectedAddr, settings]);

  // Auto-geocode a selected address that has no stored coordinates.
  // After Nominatim resolves lat/lng → calls Google Routes API for driving distance.
  useEffect(() => {
    if (!selectedAddr || selectedAddr.latitude || !settings) {
      setGeocodingAddr(false);
      return;
    }
    let cancelled = false;
    setGeocodingAddr(true);

    async function geocodeAndCalcDistance() {
      const result = await tryMultiStrategyGeocode(
        selectedAddr!.address_line1,
        selectedAddr!.city,
        selectedAddr!.state,
        selectedAddr!.pincode
      );
      if (cancelled || !result) return;
      const { lat, lng } = result;
      // Google driving distance (with haversine fallback inside getRouteDistanceKm)
      const dist = await getRouteDistanceKm(
        settings!.restaurant_lat, settings!.restaurant_lng, lat, lng
      );
      if (cancelled) return;
      setDistanceKm(dist);
      setDeliveryDistance(dist);
      setIsDeliverable(dist <= settings!.delivery_radius_km);
      // Update selectedAddr with resolved coordinates so confirmAndContinue works
      setSelectedAddr(prev => prev ? { ...prev, latitude: lat, longitude: lng } : prev);
      // Silently persist coordinates to DB so next selection is instant
      supabase.from("addresses").update({ latitude: lat, longitude: lng }).eq("id", selectedAddr!.id);
    }

    geocodeAndCalcDistance()
      .catch(() => { /* all strategies failed — distanceKm stays null */ })
      .finally(() => { if (!cancelled) setGeocodingAddr(false); });

    return () => { cancelled = true; };
  }, [selectedAddr?.id, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load saved addresses ─────────────────────────────────────
  const loadAddresses = useCallback(async () => {
    if (!user) return;
    setLoadingAddrs(true);
    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at",  { ascending: false });

    if (!error && data) {
      setAddresses(data as Address[]);
      // Preserve selection if it still exists, else pick default
      if (selectedAddr) {
        const stillExists = data.find((a: any) => a.id === selectedAddr.id);
        if (!stillExists) {
          const def = (data as Address[]).find((a) => a.is_default);
          setSelectedAddr(def || null);
        }
      } else {
        const def = (data as Address[]).find((a) => a.is_default);
        if (def) setSelectedAddr(def);
      }
    }
    setLoadingAddrs(false);
  }, [user, selectedAddr]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  useEffect(() => {
    if (!loadingAddrs && addresses.length === 0) setActiveTab("gps"); // GPS is default for new users
  }, [loadingAddrs, addresses.length]);

  function confirmAndContinue(addr: Address) {
    // Distance calculation is MANDATORY — cannot proceed without it.
    if (distanceKm === null) {
      if (geocodingAddr) {
        toast.error("Please wait — we are verifying your address location...");
      } else {
        toast.error(
          "We couldn't locate your address on the map. Please check your pincode and city, or use the GPS tab to detect your location automatically.",
          { duration: 7000 }
        );
      }
      return;
    }
    if (!isDeliverable) {
      toast.error(`Sorry, delivery is available only within ${settings?.delivery_radius_km} KM of our restaurant.`);
      return;
    }
    // Store the address along with calculated distance so checkout page can validate
    sessionStorage.setItem(ADDRESS_SESSION_KEY, JSON.stringify({ ...addr, delivery_distance_km: distanceKm }));
    router.push("/checkout");
  }

  async function deleteAddress(id: string) {
    setDeletingId(id);
    const { error } = await supabase.from("addresses").delete().eq("id", id);
    if (error) { toast.error("Could not delete address"); }
    else {
      toast.success("Address deleted");
      if (selectedAddr?.id === id) setSelectedAddr(null);
      await loadAddresses();
    }
    setDeletingId(null);
  }

  async function setDefault(id: string) {
    if (!user) return;
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
    await supabase.from("addresses").update({ is_default: true  }).eq("id", id);
    await loadAddresses();
  }

  function startEdit(a: Address) {
    setEditMode(true); setEditId(a.id);
    setLabel(a.label); setLine1(a.address_line1);
    setLine2(a.address_line2 ?? ""); setCity(a.city);
    setStateName(a.state); setPincode(a.pincode);
    setActiveTab("new");
  }

  function resetForm() {
    setEditMode(false); setEditId(null);
    setLabel("Home"); setLine1(""); setLine2("");
    setCity(""); setStateName(""); setPincode("");
  }

  async function saveAddress() {
    if (!user) return;
    if (!line1.trim() || !city.trim() || !stateName.trim() || !pincode.trim()) {
      toast.error("Please fill House/Street, City, State and Pincode");
      return;
    }
    if (pincode.trim().length !== 6 || !/^\d+$/.test(pincode.trim())) {
      toast.error("Please enter a valid 6-digit pincode");
      return;
    }
    setSavingNew(true);

    // ── Multi-strategy geocoding (best-effort — never blocks save) ─────────
    // We try from most-precise to least-precise. Even a pincode-level match
    // is enough to verify the delivery zone and calculate distance.
    const geocodeResult = await tryMultiStrategyGeocode(
      line1, city, stateName, pincode
    );

    const lat = geocodeResult?.lat ?? null;
    const lng = geocodeResult?.lng ?? null;

    // Pick a user-friendly save message based on geocoding accuracy
    const successMsg =
      !geocodeResult            ? "Address saved! We'll verify delivery distance when you select it. ✅" :
      geocodeResult.accuracy === "precise" ? "Address verified & saved ✅" :
      geocodeResult.accuracy === "area"    ? "Address saved ✅ (matched to your area)" :
                                             "Address saved ✅ (matched to your pincode area)";

    const isFirst = addresses.length === 0;
    let savedAddr: Address | null = null;

    if (editMode && editId) {
      const { data, error } = await supabase.from("addresses")
        .update({
          label, address_line1: line1.trim(),
          address_line2: line2.trim() || null,
          city: city.trim(), state: stateName.trim(), pincode: pincode.trim(),
          latitude: lat, longitude: lng,
        })
        .eq("id", editId).select("*").single();
      if (error) { toast.error("Update failed: " + error.message); }
      else {
        savedAddr = data as Address;
        geocodeResult ? toast.success(successMsg) : toast(successMsg, { icon: "⚠️" });
      }
    } else {
      const { data, error } = await supabase.from("addresses").insert({
        user_id: user.id, label,
        address_line1: line1.trim(),
        address_line2: line2.trim() || null,
        city: city.trim(), state: stateName.trim(), pincode: pincode.trim(),
        latitude: lat, longitude: lng,
        is_default: isFirst,
      }).select("*").single();
      if (error) { toast.error("Save failed: " + error.message); }
      else {
        savedAddr = data as Address;
        geocodeResult ? toast.success(successMsg) : toast(successMsg, { icon: "⚠️" });
      }
    }

    setSavingNew(false);
    if (savedAddr) {
      resetForm();
      await loadAddresses();
      setSelectedAddr(savedAddr);
      setActiveTab("saved");
    }
  }

  async function fetchGpsLocation() {
    setGpsStep("requesting");
    setGpsError("");
    setGpsDebug("");
    setGpsAddr(null);
    setGpsRaw(null);
    setShowDebug(false);

    if (typeof window !== "undefined" && !window.isSecureContext) {
      const proto = window.location.protocol;
      const host  = window.location.hostname;
      setGpsStep("error");
      setGpsDebug(`isSecureContext=false | protocol=${proto} | hostname=${host}`);
      setGpsError(
        `GPS is blocked because this page is on ${proto}//${host} (not HTTPS).\n\n` +
        `Solutions:\n` +
        `• Open http://localhost:3000 in your browser (instead of the network IP)\n` +
        `• Or deploy to HTTPS to enable GPS on any device\n` +
        `• Or enter your address manually below`
      );
      return;
    }

    if (!("geolocation" in navigator)) {
      setGpsStep("error");
      setGpsDebug("navigator.geolocation=undefined");
      setGpsError("Your browser doesn't support location services. Please use Chrome, Firefox, Edge or Safari and try again.");
      return;
    }

    if ("permissions" in navigator) {
      try {
        const perm = await (navigator as any).permissions.query({ name: "geolocation" });
        setGpsDebug(`permissions.state=${perm.state}`);
        if (perm.state === "denied") {
          setGpsStep("blocked");
          return;
        }
      } catch {
        setGpsDebug(`permissions.query failed — proceeding`);
      }
    }

    const geocode = async (lat: number, lng: number) => {
      setGpsRaw({ lat, lng });
      setGpsStep("fetching");
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { "Accept-Language": "en", "User-Agent": "RoyalZaika-FoodApp/1.0" } }
      );
      if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
      const data = await res.json();
      const a    = data.address ?? {};
      const parts = [a.house_number, a.road, a.neighbourhood, a.suburb, a.village].filter(Boolean);
      return {
        label:         "Current Location",
        address_line1: parts.join(", ") || data.display_name?.split(",")[0] || "Detected Location",
        address_line2: a.quarter || null,
        city:          a.city || a.town || a.county || a.state_district || "",
        state:         a.state || "",
        pincode:       a.postcode || "",
      } as Partial<Address>;
    };

    let phase2Tried = false;

    const onSuccess = async (pos: GeolocationPosition) => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      setGpsDebug((d) => `${d ? d + " | " : ""}lat=${lat.toFixed(6)} lng=${lng.toFixed(6)} acc=${accuracy.toFixed(0)}m`);
      try {
        const addr = await geocode(lat, lng);
        setGpsAddr(addr);
        setGpsStep("done");
      } catch (e: any) {
        setGpsDebug((d) => `${d} | geocode_err=${e.message}`);
        setGpsStep("error");
        setGpsError(
          `Location detected (${lat.toFixed(5)}, ${lng.toFixed(5)}) but address lookup failed.\n\n` +
          `Tap "Fill Manually" to enter your address — we'll pre-fill what we know.`
        );
        setLine1(`Near ${lat.toFixed(4)}, ${lng.toFixed(4)}`); setCity(""); setStateName(""); setPincode("");
      }
    };

    const onError = (err: GeolocationPositionError) => {
      const codeNames: Record<number, string> = { 1: "PERMISSION_DENIED", 2: "POSITION_UNAVAILABLE", 3: "TIMEOUT" };
      const codeName = codeNames[err.code] ?? `UNKNOWN_${err.code}`;
      setGpsDebug((d) => `${d ? d + " | " : ""}error=${codeName}(${err.code}) msg=${err.message}`);

      if (!phase2Tried && (err.code === 3 || err.code === 2)) {
        phase2Tried = true;
        setGpsDebug((d) => `${d} | retrying_phase2`);
        navigator.geolocation.getCurrentPosition(onSuccess, onFinalError,
          { timeout: 18000, maximumAge: 0, enableHighAccuracy: true });
        return;
      }
      onFinalError(err);
    };

    const onFinalError = (err: GeolocationPositionError) => {
      setGpsStep("error");
      const msgs: Record<number, string> = {
        1: "Location permission was denied by the browser.\n\nHow to fix:\n• Chrome/Edge: Click 🔒 in the address bar → Site settings → Location → Allow → Reload\n• Firefox: Click 🔒 → Permissions → Location → Allow → Reload\n• Safari: Settings → Websites → Location → Allow for this site → Reload\n\nOr enter your address manually using the 'Add New' tab.",
        2: "Your location could not be determined (Position Unavailable).\n\nTry these steps:\n• Move near a window or go outdoors for better GPS signal\n• Enable WiFi — it improves location accuracy even without connecting\n• Check that Location Services are enabled in device Settings\n• Reload the page and try again",
        3: "Location request timed out.\n\nTry these steps:\n• Move to an area with better signal\n• Check your internet connection\n• Reload the page and try again",
      };
      setGpsError(msgs[err.code] ?? `Location failed — error code ${err.code}: ${err.message}`);
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError,
      { timeout: 10000, maximumAge: 30000, enableHighAccuracy: false });
  }

  async function saveGpsAddress() {
    if (!user || !gpsAddr) return;
    if (!gpsAddr.city || !gpsAddr.state) {
      toast.error("Could not resolve full address. Please fill in manually.");
      setLine1(gpsAddr.address_line1 ?? ""); setCity(gpsAddr.city ?? "");
      setStateName(gpsAddr.state ?? ""); setPincode(gpsAddr.pincode ?? "");
      setActiveTab("new");
      return;
    }
    setGpsSaving(true);
    const isFirst = addresses.length === 0;
    const { data, error } = await supabase.from("addresses").insert({
      user_id:       user.id,
      label:         "Current Location",
      address_line1: gpsAddr.address_line1 ?? "GPS Location",
      address_line2: gpsAddr.address_line2 ?? null,
      city:          gpsAddr.city,
      state:         gpsAddr.state,
      pincode:       gpsAddr.pincode ?? "",
      latitude:      gpsRaw?.lat ?? null,
      longitude:     gpsRaw?.lng ?? null,
      is_default:    isFirst,
    }).select("*").single();

    if (error) {
      toast.error("Save failed: " + error.message);
    } else {
      toast.success("Location saved ✅");
      const saved = data as Address;
      await loadAddresses();
      setSelectedAddr(saved);
      setActiveTab("saved");
      setGpsStep("idle"); setGpsAddr(null); setGpsRaw(null);
    }
    setGpsSaving(false);
  }

  async function recheckPermission() {
    if (!("permissions" in navigator)) {
      setGpsStep("idle");
      setTimeout(fetchGpsLocation, 100);
      return;
    }
    setRecheckMsg("Checking...");
    let attempts = 0;
    const maxAttempts = 20;
    const timer = setInterval(async () => {
      attempts++;
      try {
        const perm = await (navigator as any).permissions.query({ name: "geolocation" });
        if (perm.state !== "denied") {
          clearInterval(timer);
          setRecheckMsg("");
          setGpsStep("idle");
          setTimeout(fetchGpsLocation, 100);
        } else {
          setRecheckMsg(`Still blocked — checking again... (${attempts}/${maxAttempts})`);
        }
      } catch { clearInterval(timer); setRecheckMsg(""); }
      if (attempts >= maxAttempts) {
        clearInterval(timer);
        setRecheckMsg("Still blocked. Please follow the steps above and reload the page.");
      }
    }, 1500);
  }

  if (authLoading || !user) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={32} className="animate-spin text-orange-500" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-10">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/cart")}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors shrink-0">
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="font-bold text-xl sm:text-2xl text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Delivery Address
          </h1>
          <p className="text-gray-500 text-sm">Step 2 of 3 — Where should we deliver?</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-7 overflow-x-auto no-scrollbar pb-1">
        {["Menu", "Cart", "Address", "Payment"].map((step, i) => (
          <div key={step} className="flex items-center gap-1.5 shrink-0">
            <div className={cn("flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap",
              i < 2  ? "bg-green-500/15 text-green-400" :
              i === 2 ? "bg-orange-500 text-white" :
                        "bg-white/5 text-gray-600")}>
              {i < 2 && <Check size={10} />}
              {step}
            </div>
            {i < 3 && <div className="w-4 h-px bg-white/10 shrink-0" />}
          </div>
        ))}
      </div>

      {selectedAddr && (
        <div className="mb-5 rounded-2xl p-4 flex items-start gap-3"
          style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
          <CheckCircle size={18} className="text-green-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-400 mb-0.5">Delivering to:</p>
            <p className="text-sm text-white font-medium">{selectedAddr.address_line1}</p>
            {selectedAddr.address_line2 && <p className="text-xs text-gray-500">{selectedAddr.address_line2}</p>}
            <p className="text-xs text-gray-500">{selectedAddr.city}, {selectedAddr.state} — {selectedAddr.pincode}</p>
          </div>
          <button onClick={() => setSelectedAddr(null)}
            className="text-xs text-gray-500 hover:text-orange-400 transition-colors shrink-0">
            Change
          </button>
        </div>
      )}

      <div className="flex rounded-2xl overflow-hidden mb-5"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        {([
          { id: "saved" as Tab, label: "Saved",    icon: "📋" },
          { id: "gps"   as Tab, label: "Use GPS ★", icon: "📍", highlight: true },
          { id: "new"   as Tab, label: "Manual 🔒",  icon: "➕" },
        ]).map(({ id, label, icon, highlight }) => (
          <button key={id}
            onClick={() => {
              setActiveTab(id);
              if (id === "new") { resetForm(); /* keep manualUnlocked as-is */ }
              if (id === "gps") { setGpsStep("idle"); setGpsError(""); setGpsAddr(null); }
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-all"
            style={{
              color:        activeTab === id ? (highlight ? "#22c55e" : "#f97316") : "#6b7280",
              background:   activeTab === id ? (highlight ? "rgba(34,197,94,0.08)" : "rgba(249,115,22,0.08)") : "transparent",
              borderBottom: activeTab === id ? (highlight ? "2px solid #22c55e" : "2px solid #f97316") : "2px solid transparent",
              opacity:      id === "new" && !manualUnlocked ? 0.55 : 1,
            }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {activeTab === "saved" && (
        <div className="space-y-3 mb-5">
          {loadingAddrs ? (
            <div className="flex items-center justify-center py-12 text-gray-500 gap-2">
              <Loader2 size={18} className="animate-spin" /> Loading addresses...
            </div>
          ) : addresses.length === 0 ? (
            <div className="text-center py-12">
              <MapPin size={40} className="text-gray-700 mx-auto mb-3" />
              <p className="text-gray-400 font-semibold mb-1">No saved addresses</p>
              <p className="text-gray-600 text-sm mb-4">Use GPS to quickly add your location</p>
              <button onClick={() => { setActiveTab("gps"); setGpsStep("idle"); setGpsError(""); setGpsAddr(null); }}
                className="text-green-400 text-sm font-semibold hover:text-green-300 transition-colors">
                📍 Use GPS Location
              </button>
            </div>
          ) : (
            addresses.map((addr) => {
              const isSel = selectedAddr?.id === addr.id;
              return (
                <div key={addr.id} onClick={() => setSelectedAddr(addr)}
                  className="rounded-2xl p-4 cursor-pointer transition-all"
                  style={{
                    background: isSel ? "rgba(249,115,22,0.08)" : "rgba(255,255,255,0.03)",
                    border:     isSel ? "1.5px solid rgba(249,115,22,0.5)" : "1px solid rgba(255,255,255,0.07)",
                  }}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                      style={{ borderColor: isSel ? "#f97316" : "#374151", background: isSel ? "#f97316" : "transparent" }}>
                      {isSel && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="flex items-center gap-1 text-xs font-bold text-orange-400">
                          <LabelIcon label={addr.label} /> {addr.label}
                        </span>
                        {addr.is_default && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                            style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
                            Default
                          </span>
                        )}
                        {!addr.latitude && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold border border-red-500/30 text-red-400 bg-red-500/10">
                            Location Missing
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-white font-medium">{addr.address_line1}</p>
                      {addr.address_line2 && <p className="text-xs text-gray-500">{addr.address_line2}</p>}
                      <p className="text-xs text-gray-500 mt-0.5">
                        {addr.city}, {addr.state} — {addr.pincode}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-3 pt-3"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <button onClick={(e) => { e.stopPropagation(); startEdit(addr); }}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                      ✏️ Edit
                    </button>
                    {!addr.is_default && (
                      <button onClick={(e) => { e.stopPropagation(); setDefault(addr.id); }}
                        className="text-xs text-gray-500 hover:text-green-400 transition-colors">
                        ⭐ Set Default
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); deleteAddress(addr.id); }}
                      disabled={deletingId === addr.id}
                      className="ml-auto text-xs text-gray-600 hover:text-red-400 transition-colors disabled:opacity-50">
                      {deletingId === addr.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <Trash2 size={12} />}
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {addresses.length > 0 && (
            <button onClick={() => { setActiveTab("gps"); setGpsStep("idle"); setGpsError(""); setGpsAddr(null); }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm text-gray-400 hover:text-green-400 transition-colors"
              style={{ border: "1px dashed rgba(255,255,255,0.1)" }}>
              📍 Add Another via GPS
            </button>
          )}
        </div>
      )}

      {activeTab === "new" && (
        <div className="space-y-4 mb-5">

          {/* GPS Recommendation Lock Screen — shown until user explicitly unlocks */}
          {!manualUnlocked && !editMode && (
            <div className="rounded-2xl p-6 text-center"
              style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}>
                <span className="text-3xl">📍</span>
              </div>
              <p className="text-white font-bold text-base mb-1">GPS se location dena zyada asaan hai!</p>
              <p className="text-gray-400 text-sm mb-1 px-4">
                Aapko kuch type nahi karna padega — GPS automatically aapka exact address detect kar leta hai.
              </p>
              <p className="text-gray-600 text-xs mb-6 px-4">
                Works on Chrome, Safari, Firefox — sirf ek tap mein!
              </p>
              <button
                onClick={() => { setActiveTab("gps"); setGpsStep("idle"); setGpsError(""); setGpsAddr(null); }}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white mb-4"
                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
                📍 Use GPS Location (Recommended)
              </button>
              <button
                onClick={() => setManualUnlocked(true)}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors underline underline-offset-2">
                Address manually type karna hai? Click here
              </button>
            </div>
          )}

          {/* Manual form — shown only when editMode OR user explicitly unlocked */}
          {(manualUnlocked || editMode) && (
            <>
          {editMode && (
            <div className="flex items-center gap-2 text-xs text-orange-400 bg-orange-500/10 px-3 py-2 rounded-xl">
              <AlertCircle size={13} /> Editing address: {label}
            </div>
          )}
          {!editMode && manualUnlocked && (
            <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 px-3 py-2 rounded-xl">
              <AlertCircle size={13} /> Manual entry — GPS use karna zyada accurate hai
              <button onClick={() => { setActiveTab("gps"); setGpsStep("idle"); setGpsError(""); setGpsAddr(null); }}
                className="ml-auto text-green-400 font-semibold hover:text-green-300 underline text-xs">Use GPS</button>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 mb-2 block">Address Label</label>
            <div className="flex gap-2">
              {LABEL_OPTIONS.map((l) => (
                <button key={l} onClick={() => setLabel(l)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: label === l ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
                    border:     label === l ? "1.5px solid rgba(249,115,22,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    color:      label === l ? "#f97316" : "#6b7280",
                  }}>
                  <LabelIcon label={l} /> {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">
              House / Flat / Street <span className="text-red-400">*</span>
            </label>
            <input value={line1} onChange={(e) => setLine1(e.target.value)}
              placeholder="e.g. 42, Shivam Nagar, MG Road"
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/50" />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">
              Landmark <span className="text-gray-600">(optional)</span>
            </label>
            <input value={line2} onChange={(e) => setLine2(e.target.value)}
              placeholder="e.g. Near Big Bazaar"
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/50" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">City <span className="text-red-400">*</span></label>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Prayagraj"
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/50" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">State <span className="text-red-400">*</span></label>
              <input value={stateName} onChange={(e) => setStateName(e.target.value)} placeholder="e.g. UP"
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/50" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Pincode <span className="text-red-400">*</span></label>
            <input value={pincode} onChange={(e) => setPincode(e.target.value)} maxLength={6}
              placeholder="e.g. 211001"
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/50" />
          </div>

          <div className="flex gap-3 pt-1">
            {editMode && (
              <button onClick={() => { resetForm(); setActiveTab("saved"); }}
                className="px-4 py-3 rounded-xl text-sm text-gray-400 hover:text-white border border-white/10 transition-all">
                Cancel
              </button>
            )}
            <button onClick={saveAddress} disabled={savingNew}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white gradient-brand transition-all hover:opacity-90 disabled:opacity-60">
              {savingNew ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
            {savingNew ? "Saving address..." : editMode ? "Update Address" : "Save & Select"}
            </button>
          </div>
          {/* Verification note */}
          <p className="text-xs text-center" style={{ color: "#6b7280" }}>
            🔍 We'll try to match your address on the map. If your exact street isn't found, we'll use your pincode to estimate the delivery zone.
          </p>
          </>
          )}
        </div>
      )}

      {activeTab === "gps" && (
        <div className="mb-5">
          {gpsStep === "idle" && (
            <div className="text-center py-10">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.2)" }}>
                <Navigation size={28} className="text-orange-400" />
              </div>
              <p className="text-white font-semibold mb-1">Use Your Current Location</p>
              <p className="text-gray-500 text-sm mb-1 px-6">
                Tap below to detect your GPS location. Your browser will ask for permission.
              </p>
              <p className="text-gray-600 text-xs mb-6 px-6">
                Works on Chrome, Safari, Firefox — requires HTTPS or localhost
              </p>
              <button onClick={fetchGpsLocation}
                className="mx-auto flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-white gradient-brand transition-all hover:opacity-90">
                <Navigation size={16} /> Detect My Location
              </button>
            </div>
          )}

          {gpsStep === "blocked" && (
            <div className="space-y-4">
              <div className="rounded-2xl p-5"
                style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)" }}>
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-2xl">🔒</span>
                  <div>
                    <p className="text-sm font-bold text-amber-400 mb-1">Location Permission is Blocked</p>
                    <p className="text-xs text-gray-400">
                      Your browser has this site's location permission set to <strong className="text-red-400">Block</strong>.
                      You need to change it to <strong className="text-green-400">Allow</strong> in browser settings.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      browser: "Chrome / Edge",
                      emoji: "🌐",
                      steps: [
                        "Click the 🔒 lock icon in the address bar (left of the URL)",
                        'Click "Site settings" or "Permissions for this site"',
                        'Find "Location" → Change from Block to Allow',
                        "Click ↺ Reload this page",
                      ],
                    },
                    {
                      browser: "Firefox",
                      emoji: "🦊",
                      steps: [
                        "Click the 🔒 lock icon → click the arrow ›",
                        'Click "More information" → go to Permissions tab',
                        'Find "Access Your Location" → uncheck Use Default → select Allow',
                        "Reload the page",
                      ],
                    },
                    {
                      browser: "Safari (iPhone / Mac)",
                      emoji: "🍎",
                      steps: [
                        "Go to Settings → Privacy & Security → Location Services",
                        "Find Safari → set to Allow While Using App",
                        "Return to this page and tap Detect Location again",
                      ],
                    },
                  ].map(({ browser, emoji, steps }) => (
                    <details key={browser} className="rounded-xl overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <summary className="px-4 py-3 text-sm font-semibold text-white cursor-pointer select-none">
                        {emoji} {browser}
                      </summary>
                      <ol className="px-4 pb-3 space-y-1.5 list-none">
                        {steps.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                            <span className="w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5"
                              style={{ background: "rgba(249,115,22,0.2)", color: "#f97316" }}>
                              {i + 1}
                            </span>
                            {s}
                          </li>
                        ))}
                      </ol>
                    </details>
                  ))}
                </div>
              </div>

              <p className="text-xs text-gray-500 text-center">
                After changing the setting above, click the button below — no page reload needed:
              </p>
              <button onClick={recheckPermission}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white gradient-brand transition-all hover:opacity-90">
                <Navigation size={16} /> I've Allowed It — Re-check Permission
              </button>
              {recheckMsg && (
                <p className="text-center text-xs text-gray-500">{recheckMsg}</p>
              )}

              <button onClick={() => { setActiveTab("new"); resetForm(); }}
                className="w-full py-3 rounded-xl text-sm text-gray-400 hover:text-white border border-white/10 transition-all">
                Enter Address Manually Instead
              </button>
            </div>
          )}

          {gpsStep === "requesting" && (
            <div className="text-center py-10">
              <Loader2 size={36} className="animate-spin text-orange-400 mx-auto mb-4" />
              <p className="text-white font-semibold mb-1">Waiting for Permission...</p>
              <p className="text-gray-500 text-sm px-6">
                Please click <strong className="text-white">Allow</strong> when your browser asks for location access
              </p>
            </div>
          )}

          {gpsStep === "fetching" && (
            <div className="text-center py-10">
              <Loader2 size={36} className="animate-spin text-blue-400 mx-auto mb-4" />
              <p className="text-white font-semibold mb-1">Converting to Address...</p>
              <p className="text-gray-500 text-sm">
                Got your coordinates ({gpsRaw?.lat.toFixed(4)}, {gpsRaw?.lng.toFixed(4)}) — looking up address...
              </p>
            </div>
          )}

          {gpsStep === "error" && (
            <div className="space-y-4">
              <div className="rounded-2xl p-4"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <div className="flex items-start gap-3">
                  <WifiOff size={18} className="text-red-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-400 mb-2">Location Failed</p>
                    {gpsError.split("\n").map((line, i) => (
                      line === "" ? <br key={i} /> :
                      <p key={i} className={`text-sm ${
                        line.startsWith("•") ? "text-gray-400 pl-2" :
                        ["Solutions:","How to fix:","Try these steps:","How to unblock:"].some(h => line.startsWith(h))
                          ? "text-gray-500 font-semibold mt-1" : "text-gray-300"
                      }`}>{line}</p>
                    ))}
                  </div>
                </div>
              </div>

              {gpsDebug && (
                <div>
                  <button onClick={() => setShowDebug((p) => !p)}
                    className="text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1 transition-colors">
                    🔧 {showDebug ? "Hide" : "Show"} technical details
                  </button>
                  {showDebug && (
                    <div className="mt-2 px-3 py-2 rounded-xl text-xs font-mono text-gray-500 break-all"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      {gpsDebug}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setGpsStep("idle"); setGpsError(""); setGpsDebug(""); }}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border border-white/10 text-gray-300 hover:text-white transition-all">
                  Try Again
                </button>
                <button onClick={() => { setActiveTab("new"); resetForm(); }}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white gradient-brand transition-all hover:opacity-90">
                  Enter Manually
                </button>
              </div>
            </div>
          )}

          {gpsStep === "done" && gpsAddr && (
            <div className="space-y-4">
              <div className="rounded-2xl p-4"
                style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
                <div className="flex items-start gap-3">
                  <CheckCircle size={18} className="text-green-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-green-400 mb-1">📍 Location Detected</p>
                    <p className="text-sm text-white font-medium">{gpsAddr.address_line1}</p>
                    {gpsAddr.address_line2 && <p className="text-xs text-gray-500">{gpsAddr.address_line2}</p>}
                    <p className="text-xs text-gray-500 mt-0.5">
                      {gpsAddr.city}, {gpsAddr.state} {gpsAddr.pincode}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Coordinates: {gpsRaw?.lat.toFixed(6)}, {gpsRaw?.lng.toFixed(6)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setGpsStep("idle"); setGpsAddr(null); setGpsRaw(null); }}
                  className="px-4 py-3 rounded-xl text-sm text-gray-400 hover:text-white border border-white/10 transition-all">
                  Retry
                </button>
                <button onClick={() => {
                    setLine1(gpsAddr.address_line1 ?? ""); setLine2(gpsAddr.address_line2 ?? "");
                    setCity(gpsAddr.city ?? ""); setStateName(gpsAddr.state ?? "");
                    setPincode(gpsAddr.pincode ?? ""); setLabel("Current Location");
                    setActiveTab("new");
                  }}
                  className="px-4 py-3 rounded-xl text-sm text-gray-400 hover:text-white border border-white/10 transition-all">
                  Edit Details
                </button>
                <button onClick={saveGpsAddress} disabled={gpsSaving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white gradient-brand transition-all hover:opacity-90 disabled:opacity-60">
                  {gpsSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  {gpsSaving ? "Saving..." : "Use This Location"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Delivery Radius Validation Status ───────────────────────── */}
      <div className="mt-4">
        {selectedAddr && distanceKm !== null && settings && (
          <div className={cn("mb-3 p-3 rounded-xl border flex flex-col gap-1", 
            isDeliverable ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"
          )}>
             <p className={cn("text-sm font-bold flex items-center gap-2", 
               isDeliverable ? "text-green-400" : "text-red-400"
             )}>
               <Route size={16} /> Distance from Restaurant: {distanceKm} KM
             </p>
             <p className={cn("text-xs font-medium flex items-center gap-1.5", 
               isDeliverable ? "text-green-400/80" : "text-red-400/80"
             )}>
               {isDeliverable ? <CheckCircle size={14} /> : <XCircle size={14} />}
               {isDeliverable ? "Delivery Available!" : `Sorry, we only deliver within ${settings.delivery_radius_km} KM`}
             </p>
          </div>
        )}

        {/* Show geocoding progress when auto-resolving coordinates */}
        {selectedAddr && !selectedAddr.latitude && geocodingAddr && (
          <div className="mb-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30">
             <p className="text-sm font-bold text-blue-400 flex items-center gap-2">
               <Loader2 size={16} className="animate-spin" /> Calculating distance...
             </p>
             <p className="text-xs text-blue-400/80 mt-1">
               Locating your address — this takes a moment.
             </p>
          </div>
        )}

        {/* Show warning when geocoding finished but coords still unavailable — order CANNOT proceed */}
        {selectedAddr && !geocodingAddr && distanceKm === null && (
          <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
             <p className="text-sm font-bold text-red-400 flex items-center gap-2">
               <XCircle size={16} /> Distance Could Not Be Calculated
             </p>
             <p className="text-xs text-red-400/80 mt-1">
               Cannot place order without distance verification. Please edit the address with a valid pincode, or use GPS to detect your location.
             </p>
          </div>
        )}

        {/* canProceed: ONLY when distance is known AND within delivery radius */}
        {(() => {
          const canProceed = !!selectedAddr && !geocodingAddr && isDeliverable && distanceKm !== null;
          return (
            <button
              onClick={() => {
                if (!selectedAddr) {
                  toast.error("Please select or add a delivery address before proceeding to payment.");
                  return;
                }
                confirmAndContinue(selectedAddr);
              }}
              disabled={!canProceed}
              className={cn(
                "w-full flex items-center justify-between py-4 px-6 text-base rounded-2xl font-bold transition-all",
                canProceed
                  ? "btn-primary"
                  : "cursor-not-allowed opacity-50 bg-white/5 border border-white/10 text-gray-500"
              )}
            >
              <span>
                {canProceed
                  ? `Deliver to ${selectedAddr!.city} (${distanceKm} KM)`
                  : geocodingAddr
                    ? "Calculating distance..."
                    : distanceKm !== null && !isDeliverable
                      ? "Outside Delivery Range"
                      : distanceKm === null && selectedAddr
                        ? "Distance Not Calculated"
                        : "Select a Delivery Address"}
              </span>
              <div className="flex items-center gap-2">
                {canProceed && <CheckCircle size={16} />}
                {geocodingAddr && <Loader2 size={16} className="animate-spin" />}
                <ChevronRight size={18} />
              </div>
            </button>
          );
        })()}
        {!selectedAddr && (
          <p className="text-center text-xs text-gray-600 mt-2">
            You must select or add a delivery address to proceed
          </p>
        )}
      </div>
    </div>
  );
}
