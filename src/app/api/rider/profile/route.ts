import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/rider/profile
 * Returns the delivery_partners row for the authenticated rider (service role).
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: partner, error: partnerErr } = await adminClient
      .from("delivery_partners")
      .select("id, name, phone, vehicle_type, vehicle_number, is_available, account_status, suspension_end, total_deliveries")
      .eq("id", user.id)
      .maybeSingle();

    if (partnerErr) {
      console.error("[/api/rider/profile GET] DB error:", partnerErr.message);
      return NextResponse.json({ error: partnerErr.message }, { status: 500 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [{ count: totalDelivered }, { count: todayDelivered }] = await Promise.all([
      adminClient.from("delivery_tracking").select("id", { count: "exact", head: true })
        .eq("partner_id", user.id).eq("status", "delivered"),
      adminClient.from("delivery_tracking").select("id", { count: "exact", head: true })
        .eq("partner_id", user.id).eq("status", "delivered")
        .gte("updated_at", today.toISOString()),
    ]);

    return NextResponse.json({
      partner:        partner ?? null,
      totalDelivered: totalDelivered ?? 0,
      todayDelivered: todayDelivered ?? 0,
    });
  } catch (err: any) {
    console.error("[/api/rider/profile GET] Unexpected error:", err.message);
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}

/**
 * PATCH /api/rider/profile
 * Body: { name?, phone?, avatar_url?, vehicle_type?, vehicle_number? }
 *
 * Updates users + delivery_partners tables via service role.
 * Direct anon-key updates fail due to RLS recursion (get_user_role → users → recursion).
 */
export async function PATCH(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Update users table fields
    const userUpdate: Record<string, any> = {};
    if (typeof body.name       === "string") userUpdate.name       = body.name.trim() || null;
    if (typeof body.phone      === "string") userUpdate.phone      = body.phone.trim() || null;
    if (typeof body.avatar_url === "string") userUpdate.avatar_url = body.avatar_url || null;

    if (Object.keys(userUpdate).length > 0) {
      const { error: userErr } = await adminClient
        .from("users")
        .update(userUpdate)
        .eq("id", user.id);
      if (userErr) {
        console.error("[/api/rider/profile PATCH] users update error:", userErr.message);
        return NextResponse.json({ error: userErr.message }, { status: 500 });
      }
    }

    // Update delivery_partners table fields
    const partnerUpdate: Record<string, any> = {};
    if (typeof body.name           === "string") partnerUpdate.name           = body.name.trim() || null;
    if (typeof body.phone          === "string") partnerUpdate.phone          = body.phone.trim() || null;
    if (typeof body.vehicle_type   === "string") partnerUpdate.vehicle_type   = body.vehicle_type.trim() || null;
    if (typeof body.vehicle_number === "string") partnerUpdate.vehicle_number = body.vehicle_number.trim().toUpperCase() || null;

    if (Object.keys(partnerUpdate).length > 0) {
      const { error: partnerErr } = await adminClient
        .from("delivery_partners")
        .update(partnerUpdate)
        .eq("id", user.id);
      if (partnerErr) {
        console.error("[/api/rider/profile PATCH] delivery_partners update error:", partnerErr.message);
        return NextResponse.json({ error: partnerErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[/api/rider/profile PATCH] Unexpected error:", err.message);
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}

