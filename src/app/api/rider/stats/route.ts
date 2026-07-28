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
  // Delivery time analytics
  todayAvgMinutes: number | null;
  weekAvgMinutes: number | null;
  monthAvgMinutes: number | null;
  totalDeliveries: number;
  recentDeliveries: RecentDelivery[];
  history: DailyRecord[];
}

export interface RecentDelivery {
  id: string;
  pickup_time: string | null;
  delivery_time: string | null;
  delivery_duration_minutes: number | null;
  delivery_distance_km: number | null;
  order_number: string | null;
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
        pickup_time,
        delivery_time,
        delivery_duration_minutes,
        delivery_distance_km,
        orders (
          id,
          order_number,
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

    // Delivery time analytics accumulators
    let todayDurationSum = 0;   let todayDurationCount = 0;
    let weekDurationSum  = 0;   let weekDurationCount  = 0;
    let monthDurationSum = 0;   let monthDurationCount = 0;

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

    // Recent deliveries (last 20) for UI display
    const recentDeliveries: RecentDelivery[] = [];

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
      const oneWayKm = parseFloat(order?.delivery_distance_km ?? rec.delivery_distance_km ?? 0) || 0;
      if (oneWayKm > 0) {
        byDate[dateStr].distanceKm += Math.round(oneWayKm * 2 * 100) / 100;
      }

      // Delivery time analytics — only use records with a valid duration
      const durationMin = rec.delivery_duration_minutes
        ? parseFloat(rec.delivery_duration_minutes)
        : null;

      if (durationMin !== null && durationMin > 0) {
        const deliveryDate = rec.delivery_time
          ? new Date(rec.delivery_time)
          : new Date(rec.updated_at);
        const dateLbl = deliveryDate.toLocaleDateString("en-CA");

        if (dateLbl === todayStr) {
          todayDurationSum += durationMin;
          todayDurationCount += 1;
        }
        if (deliveryDate >= weekStart) {
          weekDurationSum += durationMin;
          weekDurationCount += 1;
        }
        if (deliveryDate >= monthStart) {
          monthDurationSum += durationMin;
          monthDurationCount += 1;
        }
      }

      // Collect recent deliveries for UI
      if (recentDeliveries.length < 20) {
        recentDeliveries.push({
          id:                        rec.id,
          pickup_time:               rec.pickup_time ?? null,
          delivery_time:             rec.delivery_time ?? null,
          delivery_duration_minutes: durationMin,
          delivery_distance_km:      rec.delivery_distance_km
            ? parseFloat(rec.delivery_distance_km)
            : (oneWayKm > 0 ? oneWayKm : null),
          order_number: order?.order_number ?? null,
        });
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

    // Helper: round average to 1 decimal, return null if no data
    const avg = (sum: number, count: number): number | null =>
      count > 0 ? Math.round((sum / count) * 10) / 10 : null;

    const resp: RiderStatsResponse = {
      todayDeliveries,
      todayDistanceKm:  Math.round(todayDistanceKm  * 10) / 10,
      weekDistanceKm:   Math.round(weekDistanceKm   * 10) / 10,
      monthDistanceKm:  Math.round(monthDistanceKm  * 10) / 10,
      todayEarnings:    Math.round(todayEarnings),
      weekEarnings:     Math.round(weekEarnings),
      monthEarnings:    Math.round(monthEarnings),
      // Delivery time analytics
      todayAvgMinutes:  avg(todayDurationSum,  todayDurationCount),
      weekAvgMinutes:   avg(weekDurationSum,   weekDurationCount),
      monthAvgMinutes:  avg(monthDurationSum,  monthDurationCount),
      totalDeliveries:  records?.length ?? 0,
      recentDeliveries,
      history: history.slice(0, 60), // last 60 days
    };

    return NextResponse.json(resp);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
