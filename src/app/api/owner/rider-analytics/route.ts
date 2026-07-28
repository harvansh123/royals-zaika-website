import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/owner/rider-analytics
 * Returns delivery time analytics for the owner dashboard:
 * - Overall: today/week/month avg delivery time, total delivered orders
 * - Per-rider: avg delivery time, total deliveries
 * - Recent delivered orders with full timing details
 */
export async function GET() {
  try {
    // Fetch all delivered tracking records with timing + rider info
    const { data: records, error } = await supabaseAdmin
      .from("delivery_tracking")
      .select(`
        id,
        partner_id,
        pickup_time,
        delivery_time,
        delivery_duration_minutes,
        delivery_distance_km,
        updated_at,
        orders (
          id,
          order_number,
          delivery_distance_km
        ),
        delivery_partners (
          id,
          users ( id, name )
        )
      `)
      .eq("status", "delivered")
      .order("delivery_time", { ascending: false, nullsFirst: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Date boundaries (IST-adjusted via locale)
    const now       = new Date();
    const todayStr  = now.toLocaleDateString("en-CA");
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Overall analytics accumulators
    let todayDurSum = 0; let todayDurCount = 0;
    let weekDurSum  = 0; let weekDurCount  = 0;
    let monthDurSum = 0; let monthDurCount = 0;
    let totalDelivered = 0;

    // Per-rider analytics: riderId → { name, durationSum, durationCount, totalDeliveries }
    const riderMap: Record<string, {
      name: string;
      durationSum: number;
      durationCount: number;
      totalDeliveries: number;
    }> = {};

    // Recent orders for display (last 50)
    const recentOrders: any[] = [];

    for (const rec of records ?? []) {
      totalDelivered++;

      const order   = (rec as any).orders;
      const partner = (rec as any).delivery_partners;
      const riderName: string = partner?.users?.name ?? "Unknown Rider";
      const riderId: string = rec.partner_id;

      // Per-rider accumulation
      if (!riderMap[riderId]) {
        riderMap[riderId] = { name: riderName, durationSum: 0, durationCount: 0, totalDeliveries: 0 };
      }
      riderMap[riderId].totalDeliveries++;

      const durationMin = rec.delivery_duration_minutes
        ? parseFloat(rec.delivery_duration_minutes)
        : null;

      const deliveryDate = rec.delivery_time
        ? new Date(rec.delivery_time)
        : new Date(rec.updated_at);
      const dateLbl = deliveryDate.toLocaleDateString("en-CA");

      if (durationMin !== null && durationMin > 0) {
        // Per-rider
        riderMap[riderId].durationSum   += durationMin;
        riderMap[riderId].durationCount += 1;

        // Overall
        if (dateLbl === todayStr) { todayDurSum += durationMin; todayDurCount++; }
        if (deliveryDate >= weekStart)  { weekDurSum  += durationMin; weekDurCount++;  }
        if (deliveryDate >= monthStart) { monthDurSum += durationMin; monthDurCount++; }
      }

      // Collect recent orders
      if (recentOrders.length < 50) {
        const distKm = rec.delivery_distance_km
          ? parseFloat(rec.delivery_distance_km)
          : (order?.delivery_distance_km ? parseFloat(order.delivery_distance_km) : null);

        recentOrders.push({
          id:              rec.id,
          order_number:    order?.order_number ?? null,
          rider_id:        riderId,
          rider_name:      riderName,
          pickup_time:     rec.pickup_time    ?? null,
          delivery_time:   rec.delivery_time  ?? null,
          duration_minutes: durationMin,
          distance_km:     distKm,
          delivered_at:    rec.delivery_time ?? rec.updated_at,
        });
      }
    }

    // Build per-rider summary
    const avg = (sum: number, count: number) =>
      count > 0 ? Math.round((sum / count) * 10) / 10 : null;

    const riderAnalytics = Object.entries(riderMap).map(([id, r]) => ({
      rider_id:       id,
      rider_name:     r.name,
      total_deliveries: r.totalDeliveries,
      avg_duration_minutes: avg(r.durationSum, r.durationCount),
    }));

    return NextResponse.json({
      overall: {
        totalDelivered,
        todayAvgMinutes:  avg(todayDurSum, todayDurCount),
        weekAvgMinutes:   avg(weekDurSum,  weekDurCount),
        monthAvgMinutes:  avg(monthDurSum, monthDurCount),
      },
      riderAnalytics,
      recentOrders,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
