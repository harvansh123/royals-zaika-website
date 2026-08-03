import { NextRequest, NextResponse } from "next/server";

const GMAPS_KEY  = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const KEY_IS_SET = !!GMAPS_KEY && GMAPS_KEY !== "your_google_maps_api_key_here";

// Google result types that indicate a precise street/area match
const PRECISE_TYPES = new Set([
  "street_address", "premise", "subpremise", "route",
  "establishment", "point_of_interest",
]);
// Google result types that indicate an area-level match (acceptable)
const AREA_TYPES = new Set([
  "sublocality_level_1", "sublocality_level_2", "sublocality_level_3",
  "sublocality", "neighborhood",
  "locality", "postal_code",
  "administrative_area_level_2", "administrative_area_level_3",
]);
// Types too vague to use for distance calculation
const REJECT_TYPES = new Set([
  "country", "administrative_area_level_1",
]);

/**
 * Calls Google Geocoding API and returns lat/lng with accuracy level.
 * Returns null if the result is too vague (country/state level only).
 */
async function googleGeocode(
  query: string
): Promise<{ lat: number; lng: number; accuracy: "precise" | "area" } | null> {
  if (!KEY_IS_SET) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=in&language=en&key=${GMAPS_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.length) return null;

    const result  = data.results[0];
    const types   = (result.types ?? []) as string[];
    const locLat  = result.geometry?.location?.lat;
    const locLng  = result.geometry?.location?.lng;
    if (typeof locLat !== "number" || typeof locLng !== "number") return null;

    // Reject if the only matched type is country or state level
    const isOnlyVague = types.every((t: string) => REJECT_TYPES.has(t));
    if (isOnlyVague) return null;

    // Determine accuracy
    const isPrecise = types.some((t: string) => PRECISE_TYPES.has(t));
    if (isPrecise) return { lat: locLat, lng: locLng, accuracy: "precise" };

    const isArea = types.some((t: string) => AREA_TYPES.has(t));
    if (isArea) return { lat: locLat, lng: locLng, accuracy: "area" };

    // Unknown type — treat as area if not explicitly vague
    return { lat: locLat, lng: locLng, accuracy: "area" };
  } catch {
    return null;
  }
}

/**
 * Nominatim (OpenStreetMap) geocoding — fallback when Google fails.
 * Returns area-level accuracy only (we don't trust pincode-only results).
 */
async function nominatimGeocode(
  query: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=1&addressdetails=1`,
      {
        headers: { "User-Agent": "RoyalZaika-FoodApp/1.0", "Accept-Language": "en" },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/**
 * POST /api/geocode
 * Body: { line1, city, state, pincode }
 * Returns: { lat, lng, accuracy: "precise" | "area" } or { lat: null, lng: null, accuracy: null }
 *
 * Strategy (most to least precise):
 *  1. Google: full address (line1 + city + state + pincode)
 *  2. Google: city + state + pincode (area-level)
 *  3. Nominatim: full address fallback
 *  4. Nominatim: city + state + pincode fallback
 *  5. Return null — caller should NOT save coordinates
 *
 * NOTE: Pincode-only coordinates are NEVER returned. If we can't get at least
 * city/area-level coordinates, we return null so the caller can prompt the user
 * to enter a more specific address.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const line1   = (body.line1   ?? "").toString().trim();
    const city    = (body.city    ?? "").toString().trim();
    const state   = (body.state   ?? "").toString().trim();
    const pincode = (body.pincode ?? "").toString().trim();

    // ── Strategy 1: Google — full address ───────────────────────────────
    if (line1 && city && state && pincode) {
      const r = await googleGeocode(`${line1}, ${city}, ${state} ${pincode}, India`);
      if (r) return NextResponse.json(r);
    }

    // ── Strategy 2: Google — locality + pincode (skip house number noise) ──
    // Extract locality part (everything after first comma, or full line1 if no comma)
    const localityPart = line1.includes(",") ? line1.split(",").slice(1).join(",").trim() : line1;
    if (localityPart && city && state && pincode) {
      const r = await googleGeocode(`${localityPart}, ${city}, ${state} ${pincode}, India`);
      if (r) return NextResponse.json(r);
    }

    // ── Strategy 3: Google — city + state + pincode only ────────────────
    if (city && state && pincode) {
      const r = await googleGeocode(`${city}, ${state} ${pincode}, India`);
      if (r) return NextResponse.json({ ...r, accuracy: "area" as const });
    }

    // ── Strategy 4: Google — city + state (no pincode) ──────────────────
    if (city && state) {
      const r = await googleGeocode(`${city}, ${state}, India`);
      if (r) return NextResponse.json({ ...r, accuracy: "area" as const });
    }

    // ── Strategy 5: Nominatim — full address fallback ───────────────────
    if (line1 && city && pincode) {
      const r = await nominatimGeocode(`${line1}, ${city}, ${state}, ${pincode}, India`);
      if (r) return NextResponse.json({ ...r, accuracy: "area" as const });
    }

    // ── Strategy 6: Nominatim — city + state + pincode fallback ─────────
    if (city && state && pincode) {
      const r = await nominatimGeocode(`${city}, ${state} ${pincode}, India`);
      if (r) return NextResponse.json({ ...r, accuracy: "area" as const });
    }

    // ── All strategies failed — do NOT return pincode-only coordinates ───
    return NextResponse.json({ lat: null, lng: null, accuracy: null });
  } catch (e: any) {
    console.error("[/api/geocode] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
