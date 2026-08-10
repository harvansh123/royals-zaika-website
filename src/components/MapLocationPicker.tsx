"use client";
/**
 * MapLocationPicker
 * ─────────────────
 * A full-screen modal that lets the customer drag a marker to their exact
 * delivery location. The final marker latitude/longitude is the single
 * source of truth — Nominatim is called ONLY to produce a readable address
 * string and NEVER overwrites the marker coordinates.
 *
 * Props:
 *   initialLat / initialLng — starting marker position (fresh GPS coordinates)
 *   onConfirm(lat, lng, addr) — called when customer taps "Confirm Location"
 *   onClose() — called when customer cancels
 */

import { useCallback, useRef, useState, useEffect } from "react";
import { GoogleMap, useLoadScript, Marker } from "@react-google-maps/api";
import { Loader2, X, CheckCircle, MapPin } from "lucide-react";

const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

const MAP_CONTAINER_STYLE = {
  width:  "100%",
  height: "100%",
};

interface PartialAddr {
  address_line1: string;
  address_line2: string | null;
  city:          string;
  state:         string;
  pincode:       string;
}

interface MapLocationPickerProps {
  initialLat: number;
  initialLng: number;
  /** GPS accuracy in metres from pos.coords.accuracy — used to show low-accuracy warning */
  accuracy?:  number;
  onConfirm:  (lat: number, lng: number, addr: PartialAddr) => void;
  onClose:    () => void;
}

// Reverse geocode via Nominatim — only used to build the readable address string.
// The returned lat/lng from Nominatim is intentionally IGNORED; only marker coords
// are used as coordinates.
async function reverseGeocode(lat: number, lng: number): Promise<PartialAddr> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { "Accept-Language": "en", "User-Agent": "RoyalZaika-FoodApp/1.0" } }
    );
    if (!res.ok) throw new Error("Nominatim failed");
    const data = await res.json();
    const a    = data.address ?? {};
    const parts = [a.house_number, a.road, a.neighbourhood, a.suburb, a.village].filter(Boolean);
    return {
      address_line1: parts.join(", ") || data.display_name?.split(",")[0] || "Pinned Location",
      address_line2: a.quarter || null,
      city:          a.city || a.town || a.county || a.state_district || "",
      state:         a.state || "",
      pincode:       a.postcode || "",
    };
  } catch {
    // If Nominatim fails, return a minimal address — coordinates are still correct.
    return {
      address_line1: `Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
      address_line2: null,
      city:          "",
      state:         "",
      pincode:       "",
    };
  }
}

export default function MapLocationPicker({
  initialLat,
  initialLng,
  accuracy,
  onConfirm,
  onClose,
}: MapLocationPickerProps) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GMAPS_KEY,
    // Only load what we need — keeps the bundle small
    libraries: [],
  });

  // markerPos is the ONLY source of truth for coordinates.
  // It is initialised from fresh GPS coordinates passed as props and
  // updated on every drag-end event. It is NEVER overwritten by geocoding.
  const [markerPos,   setMarkerPos]   = useState({ lat: initialLat, lng: initialLng });
  const [geocoding,   setGeocoding]   = useState(false);
  const [confirming,  setConfirming]  = useState(false);
  const [addrPreview, setAddrPreview] = useState<PartialAddr | null>(null);

  // Keep a ref for the address preview so the confirm handler can read
  // the latest value without capturing a stale closure.
  const addrPreviewRef = useRef<PartialAddr | null>(null);

  // geocode the initial position on mount to show an address preview.
  useEffect(() => {
    if (!isLoaded) return;
    setGeocoding(true);
    reverseGeocode(initialLat, initialLng).then((addr) => {
      setAddrPreview(addr);
      addrPreviewRef.current = addr;
      setGeocoding(false);
    });
  }, [isLoaded, initialLat, initialLng]);

  const mapRef = useRef<google.maps.Map | null>(null);
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Called every time the customer finishes dragging the marker.
  // markerPos is updated immediately (synchronously) so the confirm button
  // always reads the latest dragged coordinates — NOT geocoded coordinates.
  const onMarkerDragEnd = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    if (process.env.NODE_ENV !== "production")
      console.log(`[MapPicker] Marker dragged to: lat=${lat} lng=${lng}`);

    // Update marker coordinates synchronously BEFORE starting geocoding.
    setMarkerPos({ lat, lng });

    // Reverse-geocode only for the address label preview.
    // The resulting lat/lng from Nominatim is INTENTIONALLY DISCARDED.
    setGeocoding(true);
    reverseGeocode(lat, lng).then((addr) => {
      setAddrPreview(addr);
      addrPreviewRef.current = addr;
      setGeocoding(false);
    });
  }, []);

  // Confirm: use the MARKER coordinates, not geocoded coordinates.
  const handleConfirm = useCallback(async () => {
    setConfirming(true);

    // Read markerPos from state (latest drag position).
    // We pass the lat/lng separately so they are never confused with geocoded values.
    const lat  = markerPos.lat;
    const lng  = markerPos.lng;
    const addr = addrPreviewRef.current ?? await reverseGeocode(lat, lng);

    if (process.env.NODE_ENV !== "production") {
      console.log(`[MapPicker] Confirmed: lat=${lat} lng=${lng}`);
      console.log(`[MapPicker] Address text (from Nominatim): ${addr.address_line1}, ${addr.city}`);
      console.log(`[MapPicker] Note: address text is display-only; lat/lng above are the saved coords`);
    }

    onConfirm(lat, lng, addr);
    setConfirming(false);
  }, [markerPos, onConfirm]);

  // ── Error state ───────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
        <div className="rounded-2xl p-6 max-w-sm w-full text-center"
          style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
          <p className="text-red-400 font-semibold mb-2">Map could not load</p>
          <p className="text-gray-400 text-sm mb-4">
            Google Maps API error. Please use "Detect My Location" instead.
          </p>
          <button onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold">
            Close
          </button>
        </div>
      </div>
    );
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (!isLoaded) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={36} className="animate-spin text-orange-500" />
          <p className="text-white text-sm font-semibold">Loading map...</p>
        </div>
      </div>
    );
  }

  // ── Map UI ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#000" }}>

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ background: "var(--card-bg)", borderBottom: "1px solid var(--border)" }}>
        <button onClick={onClose}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
          <X size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm">Set Delivery Location</p>
          <p className="text-gray-500 text-xs">Drag the pin to your exact house/gate</p>
        </div>
      </div>

      {/* ── Map ── */}
      <div className="flex-1 relative">
        <GoogleMap
          mapContainerStyle={MAP_CONTAINER_STYLE}
          center={markerPos}
          zoom={18}
          onLoad={onMapLoad}
          options={{
            disableDefaultUI:     false,
            zoomControl:          true,
            mapTypeControl:       false,
            streetViewControl:    false,
            fullscreenControl:    false,
            clickableIcons:       false,
            gestureHandling:      "greedy",  // single-finger pan on mobile
          }}
        >
          <Marker
            position={markerPos}
            draggable={true}
            onDragEnd={onMarkerDragEnd}
            title="Drag to your exact location"
          />
        </GoogleMap>

        {/* ── Low-accuracy warning banner (shown INSIDE the map overlay) ──
             Visible when GPS accuracy is > 50m — i.e. position is likely from
             network/cell-tower, not GPS satellite.
             Customer must drag the pin to their exact location. */}
        {accuracy !== undefined && accuracy > 50 && (
          <div
            className="absolute top-3 left-3 right-3 z-20 flex items-start gap-2.5
              px-4 py-3 rounded-xl shadow-lg"
            style={{
              background:   "rgba(234,179,8,0.95)",
              border:       "2px solid #ca8a04",
              backdropFilter: "blur(4px)",
            }}
          >
            <span className="text-2xl leading-none mt-0.5" aria-hidden>⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-black font-extrabold text-sm leading-tight">
                GPS LOCATION LOW ACCURACY
              </p>
              <p className="text-black/80 text-xs mt-1 leading-snug">
                GPS detected ≈{Math.round(accuracy)}m radius — may not be exact.
                <span className="font-bold"> Drag the pin</span> to your exact house/gate.
              </p>
            </div>
          </div>
        )}

        {/* GPS accurate badge (shown when accuracy ≤ 50m) */}
        {accuracy !== undefined && accuracy <= 50 && (
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20
              flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ background: "rgba(34,197,94,0.9)", backdropFilter: "blur(4px)" }}
          >
            <span className="text-xs" aria-hidden>✅</span>
            <p className="text-black font-bold text-xs whitespace-nowrap">
              GPS Accurate ≈{Math.round(accuracy)}m — drag to adjust if needed
            </p>
          </div>
        )}

        {/* Coordinates badge — shows final marker position */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10
          px-3 py-1.5 rounded-full text-xs font-mono text-gray-300 pointer-events-none"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}>
          {markerPos.lat.toFixed(6)}, {markerPos.lng.toFixed(6)}
        </div>
      </div>

      {/* ── Bottom panel ── */}
      <div className="shrink-0 px-4 pb-6 pt-3 space-y-3"
        style={{ background: "var(--card-bg)", borderTop: "1px solid var(--border)" }}>

        {/* Address preview */}
        <div className="flex items-start gap-2.5 min-h-[44px]">
          <MapPin size={16} className="text-orange-500 mt-0.5 shrink-0" />
          {geocoding ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Loader2 size={14} className="animate-spin" />
              <span>Looking up address...</span>
            </div>
          ) : addrPreview ? (
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium leading-snug truncate">
                {addrPreview.address_line1}
              </p>
              <p className="text-gray-500 text-xs mt-0.5">
                {addrPreview.city}{addrPreview.pincode ? ` – ${addrPreview.pincode}` : ""}
              </p>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Drag the pin to your location</p>
          )}
        </div>

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={confirming || geocoding}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl
            text-base font-bold text-white transition-all hover:opacity-90 disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
        >
          {confirming
            ? <><Loader2 size={18} className="animate-spin" /> Saving...</>
            : <><CheckCircle size={18} /> ✅ Confirm This Location</>
          }
        </button>

        <p className="text-xs text-gray-600 text-center">
          Rider will deliver to the pinned location
        </p>
      </div>
    </div>
  );
}
