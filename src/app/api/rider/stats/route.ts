import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface DailyRecord {
  date: string;          // "YYYY-MM-DD"
  deliveries: number;
  distanceKm: number;
}

export interface RiderStatsResponse {
  todayDeliveries: number;
  todayDistanceKm: number;
  weekDistanceKm: number;
  monthDistanceKm: number;
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  history: DailyRecord[];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const riderId = searchParams.get("riderId");

    if (!riderId) {
      return NextResponse.json({ error: "riderId is required" }, { status: 400 });
    }

    // Fetch all delivered tracking records for this rider.
    // ROOT CAUSE FIX: delivery_address JSON in orders does NOT contain lat/lng coords
    // (only label, address_line1, city, state, pincode are stored).
    // The validated one-way distance is already saved in orders.delivery_distance_km
    // at order placement time. Use that directly instead of recalculating from coords.
    const { data: records, error } = await supabaseAdmin
      .from("delivery_tracking")
      .select(`
        id,
        updated_at,
        orders (
          id,
          delivery_distance_km
        )
      `)
      .eq("partner_id", riderId)
      .eq("status", "delivered")
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by date and sum distance per day
    const byDate: Record<string, { deliveries: number; distanceKm: number }> = {};

    for (const rec of records ?? []) {
      const order = (rec as any).orders;

      // Parse date (use locale "en-CA" → "YYYY-MM-DD")
      const dateStr = new Date(rec.updated_at)
        .toLocaleDateString("en-CA");

      if (!byDate[dateStr]) {
        byDate[dateStr] = { deliveries: 0, distanceKm: 0 };
      }

      byDate[dateStr].deliveries += 1;

      // Use the pre-validated delivery_distance_km from the order.
      // Multiply by 2 for round-trip (restaurant → customer → restaurant).
      const oneWayKm = parseFloat(order?.delivery_distance_km ?? 0) || 0;
      if (oneWayKm > 0) {
        byDate[dateStr].distanceKm += Math.round(oneWayKm * 2 * 100) / 100;
      }
    }

    // Build history array sorted newest first
    const history: DailyRecord[] = Object.entries(byDate)
      .map(([date, v]) => ({
        date,
        deliveries: v.deliveries,
        distanceKm: Math.round(v.distanceKm * 10) / 10,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    // Today's date string
    const todayStr = new Date().toLocaleDateString("en-CA");

    // Current week start (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);

    // Current month start
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let todayDeliveries = 0;
    let todayDistanceKm = 0;
    let weekDistanceKm  = 0;
    let monthDistanceKm = 0;

    for (const h of history) {
      const d = new Date(h.date + "T00:00:00");
      if (h.date === todayStr) {
        todayDeliveries = h.deliveries;
        todayDistanceKm = h.distanceKm;
      }
      if (d >= weekStart)  weekDistanceKm  += h.distanceKm;
      if (d >= monthStart) monthDistanceKm += h.distanceKm;
    }

    // ── Fetch Rider Earnings ──────────────────────────────────────
    let todayEarnings = 0;
    let weekEarnings  = 0;
    let monthEarnings = 0;

    const { data: earningsData } = await supabaseAdmin
      .from("rider_earnings")
      .select("payout_amount, earned_at")
      .eq("partner_id", riderId)
      .gte("earned_at", monthStart.toISOString());

    for (const e of earningsData ?? []) {
      const amount = parseFloat(e.payout_amount);
      const earnedAt = new Date(e.earned_at);
      const dateStr = earnedAt.toLocaleDateString("en-CA");

      if (dateStr === todayStr) todayEarnings += amount;
      if (earnedAt >= weekStart)  weekEarnings  += amount;
      if (earnedAt >= monthStart) monthEarnings += amount;
    }

    const resp: RiderStatsResponse = {
      todayDeliveries,
      todayDistanceKm:  Math.round(todayDistanceKm  * 10) / 10,
      weekDistanceKm:   Math.round(weekDistanceKm   * 10) / 10,
      monthDistanceKm:  Math.round(monthDistanceKm  * 10) / 10,
      todayEarnings:    Math.round(todayEarnings),
      weekEarnings:     Math.round(weekEarnings),
      monthEarnings:    Math.round(monthEarnings),
      history: history.slice(0, 60), // last 60 days
    };

    return NextResponse.json(resp);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
