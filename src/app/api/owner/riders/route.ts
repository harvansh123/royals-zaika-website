import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/owner/riders — list all riders with today stats
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status"); // filter: active|disabled|suspended|blocked|all

    // Fetch delivery_partners joined with users table
    let query = supabaseAdmin
      .from("delivery_partners")
      .select(`
        id, name, phone, vehicle_type, vehicle_number,
        is_available, total_deliveries, rating, created_at,
        account_status, suspension_end, suspension_reason, blocked_reason,
        users!inner(email, avatar_url, created_at, is_active)
      `)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("account_status", status);
    }

    const { data: partners, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // For each rider, get today's delivery count
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const riderIds = (partners ?? []).map((p: any) => p.id);

    // Get today's deliveries per rider
    const { data: todayDeliveries } = await supabaseAdmin
      .from("delivery_tracking")
      .select("partner_id")
      .in("partner_id", riderIds)
      .eq("status", "delivered")
      .gte("updated_at", todayStr);

    // Count per rider
    const todayMap: Record<string, number> = {};
    for (const d of todayDeliveries ?? []) {
      todayMap[d.partner_id] = (todayMap[d.partner_id] ?? 0) + 1;
    }

    // Get currently assigned (busy) riders
    const { data: busyRiders } = await supabaseAdmin
      .from("delivery_tracking")
      .select("partner_id")
      .in("status", ["assigned", "picked_up"]);

    const busySet = new Set((busyRiders ?? []).map((b: any) => b.partner_id));

    // Auto-restore suspended riders if suspension ended
    const now = new Date().toISOString();
    const suspendedToRestore = (partners ?? []).filter((p: any) =>
      p.account_status === "suspended" &&
      p.suspension_end &&
      p.suspension_end <= now
    );
    if (suspendedToRestore.length > 0) {
      await supabaseAdmin
        .from("delivery_partners")
        .update({ account_status: "active", suspension_end: null, suspension_reason: null })
        .in("id", suspendedToRestore.map((p: any) => p.id));
    }

    const riders = (partners ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      email: (p.users as any)?.email ?? "",
      avatar_url: (p.users as any)?.avatar_url ?? null,
      vehicle_type: p.vehicle_type,
      vehicle_number: p.vehicle_number,
      is_available: p.is_available,
      is_busy: busySet.has(p.id),
      total_deliveries: p.total_deliveries ?? 0,
      today_deliveries: todayMap[p.id] ?? 0,
      rating: p.rating ?? 5.0,
      account_status: suspendedToRestore.find((s: any) => s.id === p.id)
        ? "active"
        : p.account_status ?? "active",
      suspension_end: p.suspension_end,
      suspension_reason: p.suspension_reason,
      blocked_reason: p.blocked_reason,
      joined_at: (p.users as any)?.created_at ?? p.created_at,
      created_at: p.created_at,
    }));

    return NextResponse.json({ riders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
