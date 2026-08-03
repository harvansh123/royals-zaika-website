import { NextRequest, NextResponse } from "next/server";

const GMAPS_KEY  = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const KEY_IS_SET = !!GMAPS_KEY && GMAPS_KEY !== "your_google_maps_api_key_here";

// Google result types — precise street/landmark match
const PRECISE_TYPES = new Set([
  "street_address", "premise", "subpremise", "route",
  "establishment", "point_of_interest",
]);
// Google result types — acceptable area-level match
const AREA_TYPES = new Set([
  "sublocality_level_1", "sublocality_level_2", "sublocality_level_3",
  "sublocality", "neighborhood",
  "locality", "postal_code",
  "administrative_area_level_2", "administrative_area_level_3",
]);
// Too vague — reject
const REJECT_TYPES = new Set([
  "country", "administrative_area_level_1",
]);

// ── Google Geocoding API ─────────────────────────────────────────────────
async function googleGeocode(
  query: string
): Promise<{ lat: number; lng: number; accuracy: "precise" | "area" } | null> {
  if (!KEY_IS_SET) {
    console.warn("[geocode] Google Maps API key not set");
    return null;
  }
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=in&language=en&key=${GMAPS_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) {
      console.error(`[geocode] Google HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();

    // ─ Log exact status so Vercel logs show if API is disabled ─
    if (data.status !== "OK") {
      if (data.status === "REQUEST_DENIED") {
        console.error(
          "[geocode] ❌ Google Geocoding API REQUEST_DENIED — " +
          "Geocoding API is NOT enabled in your Google Cloud Console. " +
          "Enable it at: https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com — " +
          "Falling back to free APIs."
        );
      } else if (data.status === "OVER_DAILY_LIMIT" || data.status === "OVER_QUERY_LIMIT") {
        console.warn(`[geocode] ⚠️ Google quota exceeded: ${data.status}`);
      } else if (data.status === "ZERO_RESULTS") {
        // Normal — no match found for this query, try next strategy
      } else {
        console.warn(`[geocode] Google status: ${data.status} | query: ${query}`);
      }
      return null;
    }

    if (!data.results?.length) return null;

    const result = data.results[0];
    const types  = (result.types ?? []) as string[];
    const lat    = result.geometry?.location?.lat;
    const lng    = result.geometry?.location?.lng;
    if (typeof lat !== "number" || typeof lng !== "number") return null;

    // Reject country/state-level matches (too vague)
    if (types.every((t: string) => REJECT_TYPES.has(t))) return null;

    const isPrecise = types.some((t: string) => PRECISE_TYPES.has(t));
    if (isPrecise) return { lat, lng, accuracy: "precise" };

    const isArea = types.some((t: string) => AREA_TYPES.has(t));
    if (isArea) return { lat, lng, accuracy: "area" };

    // Unknown type but not explicitly vague — accept as area
    return { lat, lng, accuracy: "area" };
  } catch (e) {
    console.error("[geocode] Google fetch error:", e);
    return null;
  }
}

// ── India Post Pincode API ───────────────────────────────────────────────
// Free, no API key needed. Returns district/state for the pincode.
// Much more reliable for Indian pincodes than Nominatim text search.
async function getDistrictFromPincode(
  pincode: string
): Promise<{ district: string; state: string } | null> {
  if (!pincode || pincode.length !== 6) return null;
  try {
    const res = await fetch(
      `https://api.postalpincode.in/pincode/${pincode}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data[0]?.Status !== "Success") return null;
    const offices = data[0]?.PostOffice;
    if (!Array.isArray(offices) || !offices.length) return null;
    const district = offices[0]?.District ?? "";
    const state    = offices[0]?.State    ?? "";
    if (!district || !state) return null;
    return { district, state };
  } catch {
    return null;
  }
}

// ── Nominatim (OpenStreetMap) Geocoder ──────────────────────────────────
// Free fallback. Works best when given verified district/city names
// (from India Post API) rather than user-typed text.
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
 * Returns: { lat, lng, accuracy, source } or { lat: null, lng: null, accuracy: null }
 *
 * Priority order:
 *  1. Google Geocoding API — full address (most accurate, needs Geocoding API enabled)
 *  2. Google Geocoding API — city + state + pincode
 *  3. Nominatim — with verified district name from India Post Pincode API (reliable)
 *  4. Nominatim — full address text fallback
 *  5. Nominatim — city + state + pincode fallback
 *
 * Never returns pincode-only or country-level coordinates.
 *
 * ⚠️  To enable Google Geocoding (most accurate), go to:
 *     https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com
 *     and enable "Geocoding API" for your project.
 *     GPS addresses are always exact and don't need this API.
 */
export async function POST(req: NextRequest) {
  try {
    const body    = await req.json();
    const line1   = (body.line1   ?? "").toString().trim();
    const city    = (body.city    ?? "").toString().trim();
    const state   = (body.state   ?? "").toString().trim();
    const pincode = (body.pincode ?? "").toString().trim();

    // ── 1. Google: full address ──────────────────────────────────────────
    if (line1 && city && state && pincode) {
      const r = await googleGeocode(`${line1}, ${city}, ${state} ${pincode}, India`);
      if (r) return NextResponse.json({ ...r, source: "google" });
    }

    // ── 2. Google: locality part + city + pincode ────────────────────────
    const localityPart = line1.includes(",") ? line1.split(",").slice(1).join(",").trim() : line1;
    if (localityPart && city && state && pincode) {
      const r = await googleGeocode(`${localityPart}, ${city}, ${state} ${pincode}, India`);
      if (r) return NextResponse.json({ ...r, source: "google" });
    }

    // ── 3. Google: city + state + pincode ───────────────────────────────
    if (city && state && pincode) {
      const r = await googleGeocode(`${city}, ${state} ${pincode}, India`);
      if (r) return NextResponse.json({ ...r, accuracy: "area", source: "google" });
    }

    // ── 4. India Post Pincode API → Nominatim (reliable for Indian pincodes) ──
    // India Post gives verified district name → Nominatim search is more accurate
    if (pincode) {
      const pin = await getDistrictFromPincode(pincode);
      if (pin) {
        // Try with district name (verified) + area text
        const areaQuery = line1
          ? `${line1}, ${pin.district}, ${pin.state}, India`
          : `${pin.district}, ${pin.state}, India`;
        const r = await nominatimGeocode(areaQuery);
        if (r) return NextResponse.json({ ...r, accuracy: "area", source: "nominatim+pincode" });

        // Fallback to just district + state
        const r2 = await nominatimGeocode(`${pin.district}, ${pin.state}, India`);
        if (r2) return NextResponse.json({ ...r2, accuracy: "area", source: "nominatim+pincode" });
      }
    }

    // ── 5. Nominatim: full user-typed address fallback ───────────────────
    if (line1 && city && pincode) {
      const r = await nominatimGeocode(`${line1}, ${city}, ${state}, ${pincode}, India`);
      if (r) return NextResponse.json({ ...r, accuracy: "area", source: "nominatim" });
    }

    // ── 6. Nominatim: city + state + pincode fallback ────────────────────
    if (city && state && pincode) {
      const r = await nominatimGeocode(`${city}, ${state} ${pincode}, India`);
      if (r) return NextResponse.json({ ...r, accuracy: "area", source: "nominatim" });
    }

    // ── All strategies failed ────────────────────────────────────────────
    console.warn(`[geocode] All strategies failed for: line1="${line1}" city="${city}" pincode="${pincode}"`);
    return NextResponse.json({ lat: null, lng: null, accuracy: null, source: "failed" });

  } catch (e: any) {
    console.error("[geocode] Unexpected error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
