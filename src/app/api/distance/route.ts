import { NextRequest, NextResponse } from "next/server";
import { haversineKm } from "@/lib/haversine";

const GMAPS_KEY  = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const KEY_IS_SET = !!GMAPS_KEY && GMAPS_KEY !== "your_google_maps_api_key_here";

// ── In-memory cache (per Lambda warm instance) ─────────────────────────────
// Key → { distanceKm, expiresAt }
// Rounding to 3 decimal places ≈ 100 m precision — maximises cache hits
// while keeping results accurate enough for delivery pricing tiers.
const cache = new Map<string, { distanceKm: number; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — road distances are stable

function makeCacheKey(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): string {
  return `${lat1.toFixed(3)},${lng1.toFixed(3)}->${lat2.toFixed(3)},${lng2.toFixed(3)}`;
}

function readCache(key: string): number | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.distanceKm;
}

function writeCache(key: string, distanceKm: number) {
  cache.set(key, { distanceKm, expiresAt: Date.now() + CACHE_TTL_MS });
  // Evict stale entries when cache grows large (keeps memory bounded)
  if (cache.size > 2000) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (now > v.expiresAt) cache.delete(k);
    }
  }
}

// ── POST /api/distance ────────────────────────────────────────────────────
// Body: { originLat, originLng, destLat, destLng }
// Returns: { distanceKm: number, source: "google" | "haversine" | "cache" }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { originLat, originLng, destLat, destLng } = body;

    if (
      typeof originLat !== "number" || typeof originLng !== "number" ||
      typeof destLat   !== "number" || typeof destLng   !== "number"
    ) {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
    }

    const key    = makeCacheKey(originLat, originLng, destLat, destLng);
    const cached = readCache(key);
    if (cached !== null) {
      return NextResponse.json({ distanceKm: cached, source: "cache" });
    }

    // ── Google Maps Routes API v2 ────────────────────────────────────────
    if (KEY_IS_SET) {
      try {
        const response = await fetch(
          "https://routes.googleapis.com/directions/v2:computeRoutes",
          {
            method:  "POST",
            headers: {
              "Content-Type":    "application/json",
              "X-Goog-Api-Key":  GMAPS_KEY,
              // Only request the field we need — minimises response size & billing unit
              "X-Goog-FieldMask": "routes.distanceMeters",
            },
            body: JSON.stringify({
              origin: {
                location: { latLng: { latitude: originLat, longitude: originLng } },
              },
              destination: {
                location: { latLng: { latitude: destLat, longitude: destLng } },
              },
              travelMode:        "DRIVE",
              routingPreference: "TRAFFIC_UNAWARE", // no real-time traffic = cheaper + faster
            }),
          }
        );

        if (response.ok) {
          const data           = await response.json();
          const distanceMeters = data?.routes?.[0]?.distanceMeters;

          if (typeof distanceMeters === "number" && distanceMeters > 0) {
            const distanceKm = parseFloat((distanceMeters / 1000).toFixed(2));
            writeCache(key, distanceKm);
            return NextResponse.json({ distanceKm, source: "google" });
          }
        } else {
          // Log non-OK responses to help diagnose API key / billing issues
          const errText = await response.text().catch(() => "");
          console.error("[/api/distance] Google Routes API error:", response.status, errText);
        }
      } catch (googleErr) {
        // Network error or timeout — fall through to haversine
        console.error("[/api/distance] Google Routes API fetch failed:", googleErr);
      }
    }

    // ── Fallback: Haversine straight-line distance ───────────────────────
    const distanceKm = haversineKm(originLat, originLng, destLat, destLng);
    // Don't cache haversine results — we want to retry Google next time
    return NextResponse.json({ distanceKm, source: "haversine" });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
