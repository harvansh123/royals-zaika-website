import { NextRequest, NextResponse } from "next/server";

const GMAPS_KEY  = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const KEY_IS_SET = !!GMAPS_KEY && GMAPS_KEY !== "your_google_maps_api_key_here";

/**
 * POST /api/reverse-geocode
 * Body: { lat: number, lng: number }
 *
 * Returns a properly formatted Indian address from GPS coordinates.
 * Uses Google Reverse Geocoding if available, falls back to Nominatim.
 *
 * Response: {
 *   address_line1, address_line2, city, state, pincode,
 *   source: "google" | "nominatim"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { lat, lng } = await req.json();
    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
    }

    // ── Strategy 1: Google Reverse Geocoding ────────────────────────
    if (KEY_IS_SET) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&region=in&language=en&key=${GMAPS_KEY}`;
        const res  = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json();
          if (data.status === "REQUEST_DENIED") {
            console.error("[reverse-geocode] ❌ Google Geocoding API not enabled — falling back to Nominatim");
          } else if (data.status === "OK" && data.results?.length) {
            const result = data.results[0];
            const comps  = result.address_components as any[] ?? [];

            const get = (...types: string[]) =>
              comps.find((c: any) => types.some((t) => c.types?.includes(t)))?.long_name ?? "";

            const houseNo    = get("street_number", "premise", "subpremise");
            const road       = get("route", "establishment");
            const suburb     = get("sublocality_level_2", "sublocality_level_3", "neighborhood");
            const sublocal   = get("sublocality_level_1", "sublocality");
            const city       = get("locality", "administrative_area_level_3", "administrative_area_level_2");
            const state      = get("administrative_area_level_1");
            const pincode    = get("postal_code");

            // Build line1: house + road + suburb (most specific part)
            const line1Parts = [houseNo, road, suburb].filter(Boolean);
            const line1 = line1Parts.length > 0
              ? line1Parts.join(", ")
              : sublocal || result.formatted_address?.split(",")[0] || "GPS Location";

            // line2: sublocality (area/colony)
            const line2 = sublocal && sublocal !== line1 ? sublocal : null;

            if (city && state) {
              return NextResponse.json({
                address_line1: line1,
                address_line2: line2,
                city,
                state,
                pincode,
                formatted: result.formatted_address,
                source: "google",
              });
            }
          }
        }
      } catch (e) {
        console.warn("[reverse-geocode] Google failed:", e);
      }
    }

    // ── Strategy 2: Nominatim fallback ──────────────────────────────
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: { "User-Agent": "RoyalZaika-FoodApp/1.0", "Accept-Language": "en" },
          signal: AbortSignal.timeout(5000),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const a    = data.address ?? {};

        const houseNo  = a.house_number  ?? "";
        const road     = a.road         ?? a.pedestrian ?? a.path ?? "";
        const suburb   = a.neighbourhood ?? a.suburb     ?? a.quarter ?? "";
        const sublocal = a.village       ?? "";
        const city     = a.city || a.town || a.county || "";
        const state    = a.state || "";
        const pincode  = a.postcode || "";

        const line1Parts = [houseNo, road, suburb].filter(Boolean);
        const line1 = line1Parts.length > 0
          ? line1Parts.join(", ")
          : sublocal || data.display_name?.split(",")[0] || "GPS Location";

        const line2 = sublocal && sublocal !== line1 ? sublocal : null;

        return NextResponse.json({
          address_line1: line1,
          address_line2: line2,
          city,
          state,
          pincode,
          formatted: data.display_name,
          source: "nominatim",
        });
      }
    } catch (e) {
      console.warn("[reverse-geocode] Nominatim failed:", e);
    }

    // ── All failed — return minimal result ───────────────────────────
    return NextResponse.json({
      address_line1: "GPS Location",
      address_line2: null,
      city: "",
      state: "",
      pincode: "",
      source: "failed",
    });
  } catch (e: any) {
    console.error("[reverse-geocode] Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
