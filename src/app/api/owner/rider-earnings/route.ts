import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "all"; // 'today', 'week', 'month', 'all'
    const riderId = searchParams.get("riderId");

    let query = supabaseAdmin
      .from("rider_earnings")
      .select(`
        id,
        payout_amount,
        distance_km,
        distance_range,
        earned_at,
        order_id,
        orders ( order_number, total_amount ),
        users:partner_id ( name, phone )
      `)
      .order("earned_at", { ascending: false });

    if (riderId) {
      query = query.eq("partner_id", riderId);
    }

    if (period !== "all") {
      const now = new Date();
      let startDateStr = "";
      if (period === "today") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        startDateStr = today.toISOString();
      } else if (period === "week") {
        const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - dayOfWeek);
        weekStart.setHours(0, 0, 0, 0);
        startDateStr = weekStart.toISOString();
      } else if (period === "month") {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        startDateStr = monthStart.toISOString();
      }
      if (startDateStr) {
        query = query.gte("earned_at", startDateStr);
      }
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
