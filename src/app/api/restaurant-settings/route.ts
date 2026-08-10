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
    };
    return NextResponse.json({ ...defaults, is_currently_open: true });
  }

  // Merge defaults for any missing columns (safe for incremental migration)
  const merged = {
    opening_time: "09:00",
    closing_time: "23:00",
    status_mode: "auto",
    is_open: true,
    ...data,
  };

  return NextResponse.json(
    {
      ...merged,
      is_currently_open: computeIsOpen(merged),
    },
    {
      headers: {
        // Cache for 60s at the edge; serve stale for 5 min while revalidating.
        // Realtime subscription pushes instant updates to clients when owner
        // changes settings, so staleness is not a practical problem.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
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

// PATCH — Owner only: update timing, mode, or legacy is_open toggle
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { is_open, opening_time, closing_time, status_mode } = body;

    // Build update payload — only include provided fields
    const update: Record<string, any> = { updated_at: new Date().toISOString() };

    if (typeof is_open === "boolean")      update.is_open      = is_open;
    if (typeof opening_time === "string")  update.opening_time = opening_time;
    if (typeof closing_time  === "string") update.closing_time  = closing_time;
    if (["auto", "manual_open", "temporarily_closed"].includes(status_mode)) {
      update.status_mode = status_mode;
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
      ...data,
    };
    return NextResponse.json({ ...merged, is_currently_open: computeIsOpen(merged) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

