import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — Public read (customer validation + owner display)
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("restaurant_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !data) {
    // Return safe defaults if table doesn't exist yet
    return NextResponse.json({
      id: 1,
      restaurant_name: "Chaurasia Ji",
      restaurant_lat: 25.3176,
      restaurant_lng: 82.9739,
      delivery_radius_km: 5.0,
      is_open: true,
      updated_at: new Date().toISOString(),
    });
  }
  // Ensure is_open defaults to true if column not yet added via migration
  return NextResponse.json({ is_open: true, ...data });
}

// PUT — Owner only: update delivery settings (lat, lng, radius, name)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurant_lat, restaurant_lng, delivery_radius_km, restaurant_name } = body;

    // Basic validation
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
        restaurant_name: restaurant_name ?? "Chaurasia Ji",
        restaurant_lat,
        restaurant_lng,
        delivery_radius_km,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH — Owner only: toggle restaurant online/offline status
export async function PATCH(req: NextRequest) {
  try {
    const { is_open } = await req.json();
    if (typeof is_open !== "boolean") {
      return NextResponse.json({ error: "is_open must be a boolean" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("restaurant_settings")
      .upsert({
        id: 1,
        is_open,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, is_open: data.is_open ?? is_open });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
