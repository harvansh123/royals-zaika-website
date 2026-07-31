"use client";
import { useState, useEffect, useRef, useCallback, type CSSProperties } from "react";
import {
  Loader2, MapPin, Save, Route, AlertCircle, Navigation,
  CheckCircle, Key, Info
} from "lucide-react";
import toast from "react-hot-toast";

// ── Google Maps ─────────────────────────────────────────────────────────────
// Loaded dynamically so SSR is never attempted
import {
  useJsApiLoader,
  GoogleMap,
  Marker,
  StandaloneSearchBox,
} from "@react-google-maps/api";

const GMAPS_KEY   = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const KEY_IS_SET  = !!GMAPS_KEY && GMAPS_KEY !== "your_google_maps_api_key_here";
const LIBRARIES: ("places")[] = ["places"];
const MAP_CONTAINER: CSSProperties = {
  width: "100%", height: "300px", borderRadius: "12px", overflow: "hidden",
};

// ── Types ────────────────────────────────────────────────────────────────────
interface LatLng { lat: number; lng: number; }

// ── Main Component ────────────────────────────────────────────────────────────
export default function DeliverySettingsPage() {
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [radius,     setRadius]     = useState("5.0");

  // Location state
  const [markerPos,  setMarkerPos]  = useState<LatLng>({ lat: 25.393867, lng: 81.861200 });
  const [mapCenter,  setMapCenter]  = useState<LatLng>({ lat: 25.393867, lng: 81.861200 });
  const [address,    setAddress]    = useState("");
  const [plusCode,   setPlusCode]   = useState("");
  const [geocoding,  setGeocoding]  = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [locationSaved, setLocationSaved] = useState(false);

  const searchBoxRef = useRef<google.maps.places.SearchBox | null>(null);
  const mapRef       = useRef<google.maps.Map | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // ── Load Google Maps JS ───────────────────────────────────────────────────
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: KEY_IS_SET ? GMAPS_KEY : "",
    libraries: LIBRARIES,
    id: "google-map-script",
  });

  // ── Load existing settings ────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/restaurant-settings");
        if (res.ok) {
          const data = await res.json();
          const lat  = parseFloat(data.restaurant_lat)  || 25.393867;
          const lng  = parseFloat(data.restaurant_lng)  || 81.861200;
          setMarkerPos({ lat, lng });
          setMapCenter({ lat, lng });
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

  // ── Auto reverse-geocode on initial load once Maps is ready ──────────────
  useEffect(() => {
    if (isLoaded && KEY_IS_SET && !address) {
      reverseGeocode(markerPos.lat, markerPos.lng);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // ── Reverse Geocoding via Google REST API ─────────────────────────────────
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    if (!KEY_IS_SET) return;
    setGeocoding(true);
    try {
      const res  = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GMAPS_KEY}`
      );
      const data = await res.json();
      if (data.status === "OK" && data.results?.length > 0) {
        setAddress(data.results[0].formatted_address ?? "");
        // Extract plus code if present
        const pcResult = data.results.find((r: any) => r.plus_code?.global_code);
        setPlusCode(pcResult?.plus_code?.global_code ?? data.plus_code?.global_code ?? "");
      }
    } catch { /* ignore */ }
    finally { setGeocoding(false); }
  }, []);

  // ── GPS Detect ────────────────────────────────────────────────────────────
  async function detectGpsLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("GPS not supported in this browser.");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMarkerPos({ lat, lng });
        setMapCenter({ lat, lng });
        mapRef.current?.panTo({ lat, lng });
        mapRef.current?.setZoom(19);
        reverseGeocode(lat, lng);
        setGpsLoading(false);
        setLocationSaved(false);
        toast.success("Location detected! Drag the marker to fine-tune exactly.");
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) {
          toast.error("GPS permission denied. Please allow location access or search manually.");
        } else {
          toast.error("Could not detect GPS. Please search your restaurant manually.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  // ── Marker drag end ───────────────────────────────────────────────────────
  const onMarkerDragEnd = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setMarkerPos({ lat, lng });
    setLocationSaved(false);
    reverseGeocode(lat, lng);
  }, [reverseGeocode]);

  // ── Places search ─────────────────────────────────────────────────────────
  const onPlacesChanged = useCallback(() => {
    const places = searchBoxRef.current?.getPlaces();
    if (!places || places.length === 0) return;
    const place = places[0];
    const loc   = place.geometry?.location;
    if (!loc) return;
    const lat = loc.lat();
    const lng = loc.lng();
    setMarkerPos({ lat, lng });
    setMapCenter({ lat, lng });
    mapRef.current?.panTo({ lat, lng });
    mapRef.current?.setZoom(19);
    setAddress(place.formatted_address ?? "");
    setLocationSaved(false);
    reverseGeocode(lat, lng);
  }, [reverseGeocode]);

  // ── Save ──────────────────────────────────────────────────────────────────
  async function saveSettings() {
    const latVal = markerPos.lat;
    const lngVal = markerPos.lng;

    if (isNaN(latVal) || isNaN(lngVal)) {
      toast.error("Invalid coordinates. Please detect location or search first.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/restaurant-settings", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_lat:     latVal,
          restaurant_lng:     lngVal,
          delivery_radius_km: parseFloat(radius),
        }),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      setLocationSaved(true);
      toast.success("Restaurant location & delivery settings saved! ✅");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  // ── Loading screen ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full pt-20">
        <Loader2 size={32} className="animate-spin text-orange-500" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto pb-24">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Route className="text-orange-500" />
          Delivery Settings
        </h1>
        <p className="text-gray-400 mt-1">
          Set your restaurant location and delivery coverage area.
        </p>
      </div>

      {/* ── API Key Missing Warning ─────────────────────────────────────────── */}
      {!KEY_IS_SET && (
        <div className="mb-6 rounded-2xl p-4 flex items-start gap-3"
          style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.3)" }}>
          <Key size={18} className="text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-400 font-semibold text-sm mb-0.5">Google Maps API Key Not Set</p>
            <p className="text-yellow-600 text-xs">
              Add your key in <code className="bg-black/30 px-1 py-0.5 rounded">.env.local</code> as{" "}
              <code className="bg-black/30 px-1 py-0.5 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to
              enable the interactive map. Until then, you can enter coordinates manually below.
            </p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">

        {/* ── Set Restaurant Location ─────────────────────────────────────── */}
        <div className="rounded-2xl p-6" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
            <MapPin size={18} className="text-blue-500" />
            Set Restaurant Location
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            This location is used for delivery distance, delivery charges, and rider navigation.
          </p>

          {/* GPS + Search Row */}
          <div className="flex flex-col gap-2 mb-4">
            <button
              onClick={detectGpsLocation}
              disabled={gpsLoading}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
              style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)", color: "#60a5fa" }}
            >
              {gpsLoading
                ? <Loader2 size={15} className="animate-spin" />
                : <Navigation size={15} />}
              {gpsLoading ? "Detecting location..." : "Use Current GPS Location"}
            </button>

            {/* Search Box (only when Maps is loaded) */}
            {KEY_IS_SET && isLoaded && (
              <StandaloneSearchBox
                onLoad={(ref) => { searchBoxRef.current = ref; }}
                onPlacesChanged={onPlacesChanged}
              >
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="🔍  Search restaurant location..."
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500/40"
                />
              </StandaloneSearchBox>
            )}
          </div>

          {/* Google Map */}
          {KEY_IS_SET ? (
            <>
              {loadError && (
                <div className="rounded-xl p-4 text-center mb-4"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                  <p className="text-red-400 text-sm">Map failed to load. Check your API key &amp; billing.</p>
                </div>
              )}
              {!isLoaded && !loadError && (
                <div className="flex items-center justify-center rounded-xl mb-4" style={{ ...MAP_CONTAINER, background: "rgba(255,255,255,0.03)" }}>
                  <Loader2 size={24} className="animate-spin text-orange-500" />
                </div>
              )}
              {isLoaded && !loadError && (
                <div className="mb-4 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                  <GoogleMap
                    mapContainerStyle={MAP_CONTAINER}
                    center={mapCenter}
                    zoom={17}
                    onLoad={(map) => { mapRef.current = map; }}
                    options={{
                      streetViewControl: false,
                      mapTypeControl: false,
                      fullscreenControl: true,
                      zoomControl: true,
                    }}
                  >
                    <Marker
                      position={markerPos}
                      draggable={true}
                      onDragEnd={onMarkerDragEnd}
                      title="Drag to set exact restaurant location"
                    />
                  </GoogleMap>
                </div>
              )}
              <p className="text-xs text-gray-600 mb-4 text-center">
                📌 Drag the marker to set the exact restaurant entrance / gate location
              </p>
            </>
          ) : (
            /* Fallback: manual lat/lng inputs when no API key */
            <div className="space-y-3 mb-4">
              <p className="text-xs text-gray-500 mb-2">Enter coordinates manually:</p>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Latitude</label>
                <input
                  type="number" step="0.0001"
                  value={markerPos.lat}
                  onChange={(e) => setMarkerPos(p => ({ ...p, lat: parseFloat(e.target.value) || p.lat }))}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Longitude</label>
                <input
                  type="number" step="0.0001"
                  value={markerPos.lng}
                  onChange={(e) => setMarkerPos(p => ({ ...p, lng: parseFloat(e.target.value) || p.lng }))}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/50"
                />
              </div>
            </div>
          )}

          {/* Location Info Panel */}
          <div className="rounded-xl p-4 space-y-2"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Location Info</span>
              {locationSaved && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <CheckCircle size={11} /> Saved
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-gray-600">Latitude</p>
                <p className="text-white font-mono font-semibold">{markerPos.lat.toFixed(6)}</p>
              </div>
              <div>
                <p className="text-gray-600">Longitude</p>
                <p className="text-white font-mono font-semibold">{markerPos.lng.toFixed(6)}</p>
              </div>
            </div>
            {geocoding ? (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Loader2 size={11} className="animate-spin" /> Fetching address...
              </div>
            ) : address ? (
              <div>
                <p className="text-gray-600 text-xs">Address</p>
                <p className="text-gray-300 text-xs leading-relaxed">{address}</p>
              </div>
            ) : null}
            {plusCode && (
              <div>
                <p className="text-gray-600 text-xs">Plus Code</p>
                <p className="text-gray-400 text-xs font-mono">{plusCode}</p>
              </div>
            )}
          </div>

          {/* Info note */}
          <div className="mt-3 flex items-start gap-2">
            <Info size={12} className="text-gray-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-gray-600">
              This location is the single source of truth for delivery distance, charges, radius
              validation, and rider navigation. Save immediately takes effect for all new orders.
            </p>
          </div>
        </div>

        {/* ── Delivery Radius ────────────────────────────────────────────── */}
        <div className="rounded-2xl p-6 flex flex-col"
          style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
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

      {/* ── Save Button ──────────────────────────────────────────────────── */}
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
