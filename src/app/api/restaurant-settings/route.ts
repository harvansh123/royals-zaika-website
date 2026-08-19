import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Compute open/closed server-side for the GET response (uses IST timezone)
function computeIsOpen(data: any): boolean {
  const mode = data.status_mode ?? "auto";
  if (mode === "temporarily_closed") return false;
  if (mode === "manual_open") return true;

  const opening = data.opening_time ?? "09:00";
  const closing  = data.closing_time  ?? "23:00";

  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [oh, om] = opening.split(":").map(Number);
  const [ch, cm] = closing.split(":").map(Number);

  return currentMinutes >= (oh * 60 + om) && currentMinutes < (ch * 60 + cm);
}

// Delivery rate defaults (matches DEFAULT_DELIVERY_RATES in deliveryPricing.ts)
const RATE_DEFAULTS = {
  delivery_charge_per_km:    10,
  owner_contribution_per_km: 5,
  rider_payout_per_km:       15,
  free_delivery_min_order:   499,
};

// GET — Public read (customer validation + owner display)
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("restaurant_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !data) {
    const defaults = {
      id: 1,
      restaurant_name: "Royal Zaika",
      restaurant_lat: 25.393867,
      restaurant_lng: 81.861200,
      delivery_radius_km: 5.0,
      is_open: true,
      opening_time: "09:00",
      closing_time: "23:00",
      status_mode: "auto",
      updated_at: new Date().toISOString(),
      ...RATE_DEFAULTS,
    };
    return NextResponse.json({ ...defaults, is_currently_open: true });
  }

  // Merge defaults for any missing columns (safe for incremental migration)
  const merged = {
    opening_time: "09:00",
    closing_time: "23:00",
    status_mode: "auto",
    is_open: true,
    ...RATE_DEFAULTS,
    ...data,
  };

  return NextResponse.json(
    {
      ...merged,
      is_currently_open: computeIsOpen(merged),
    },
    {
      headers: {
        // No caching — owner must see their saved settings immediately.
        "Cache-Control": "no-store, no-cache",
      },
    }
  );
}

// PUT — Owner only: update delivery settings (lat, lng, radius, name)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurant_lat, restaurant_lng, delivery_radius_km, restaurant_name } = body;

    if (
      typeof delivery_radius_km !== "number" || delivery_radius_km <= 0 ||
      typeof restaurant_lat !== "number" || typeof restaurant_lng !== "number"
    ) {
      return NextResponse.json({ error: "Invalid settings data" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("restaurant_settings")
      .upsert({
        id: 1,
        restaurant_name: restaurant_name ?? "Royal Zaika",
        restaurant_lat,
        restaurant_lng,
        delivery_radius_km,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH — Owner only: update timing, mode, is_open toggle, OR delivery rates
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      is_open, opening_time, closing_time, status_mode,
      // Delivery rate fields
      delivery_charge_per_km, owner_contribution_per_km,
      rider_payout_per_km, free_delivery_min_order,
    } = body;

    // Build update payload — only include provided fields
    const update: Record<string, any> = { updated_at: new Date().toISOString() };

    // Timing / open-close fields (unchanged)
    if (typeof is_open === "boolean")      update.is_open      = is_open;
    if (typeof opening_time === "string")  update.opening_time = opening_time;
    if (typeof closing_time  === "string") update.closing_time  = closing_time;
    if (["auto", "manual_open", "temporarily_closed"].includes(status_mode)) {
      update.status_mode = status_mode;
    }

    // Delivery rate fields — validate: must be a non-negative number
    const rateFields = {
      delivery_charge_per_km,
      owner_contribution_per_km,
      rider_payout_per_km,
      free_delivery_min_order,
    };
    for (const [key, val] of Object.entries(rateFields)) {
      if (val !== undefined) {
        const n = Number(val);
        if (isNaN(n) || n < 0) {
          return NextResponse.json(
            { error: `Invalid value for ${key}: must be a non-negative number` },
            { status: 400 }
          );
        }
        update[key] = n;
      }
    }

    if (Object.keys(update).length === 1) {
      return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("restaurant_settings")
      .upsert({ id: 1, ...update }, { onConflict: "id" })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const merged = {
      opening_time: "09:00",
      closing_time: "23:00",
      status_mode: "auto",
      is_open: true,
      ...RATE_DEFAULTS,
      ...data,
    };
    return NextResponse.json(
      { ...merged, is_currently_open: computeIsOpen(merged) },
      { headers: { "Cache-Control": "no-store, no-cache" } }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

