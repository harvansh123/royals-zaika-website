import { haversineKm } from "./haversine";

/**
 * Returns the actual road driving distance (km) between two lat/lng points.
 *
 * Strategy:
 *  1. Calls /api/distance which uses Google Maps Routes API v2.
 *  2. The server route has in-memory caching (1 hr TTL).
 *  3. If the Google API is unavailable the server automatically returns
 *     Haversine straight-line distance so orders never fail.
 *  4. If the fetch itself fails (network error, timeout) we fall back to
 *     Haversine on the client side as a last resort.
 *
 * All existing delivery pricing, radius validation, and order logic
 * continues to work unchanged — only the distance value improves.
 */
export async function getRouteDistanceKm(
  originLat: number,
  originLng: number,
  destLat:   number,
  destLng:   number
): Promise<number> {
  try {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 8000); // 8 s client timeout

    const res = await fetch("/api/distance", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ originLat, originLng, destLat, destLng }),
      signal:  controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`Distance API HTTP ${res.status}`);

    const json = await res.json();
    const km   = json?.distanceKm;
    if (typeof km !== "number" || km <= 0) throw new Error("Invalid distance in response");

    return km;
  } catch {
    // Last-resort client-side fallback — straight-line distance
    return haversineKm(originLat, originLng, destLat, destLng);
  }
}
