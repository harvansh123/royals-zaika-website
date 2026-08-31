import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS so we can update both tables
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: NextRequest) {
  try {
    const { orderId, orderNumber } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const now = new Date().toISOString();

    // ── 1. Update orders.status = "delivered" ──────────────────────────
    const { error: orderErr } = await adminClient
      .from("orders")
      .update({ status: "delivered" })
      .eq("id", orderId);

    if (orderErr) {
      console.error("[deliver] orders update error:", orderErr.message);
      return NextResponse.json({ error: orderErr.message }, { status: 500 });
    }

    // ── 2. Update delivery_tracking.status = "delivered" ───────────────
    // This triggers the rider's Supabase Realtime subscription so their
    // dashboard updates immediately and they become free for new orders.
    const { data: trackingRow, error: trackingFetchErr } = await adminClient
      .from("delivery_tracking")
      .select("id, assigned_at, partner_id")
      .eq("order_id", orderId)
      .neq("status", "delivered") // only update if not already delivered
      .maybeSingle();

    if (trackingFetchErr) {
      // Non-fatal — order is already marked delivered in orders table
      console.error("[deliver] delivery_tracking fetch error:", trackingFetchErr.message);
      return NextResponse.json({ ok: true, trackingUpdated: false });
    }

    if (trackingRow) {
      // Calculate delivery duration in minutes (assigned_at → now)
      let durationMinutes: number | null = null;
      if (trackingRow.assigned_at) {
        const diffMs = new Date(now).getTime() - new Date(trackingRow.assigned_at).getTime();
        durationMinutes = Math.round(diffMs / 60000);
      }

      const { error: trackingUpdateErr } = await adminClient
        .from("delivery_tracking")
        .update({
          status:                    "delivered",
          delivered_at:              now,
          ...(durationMinutes !== null && { delivery_duration_minutes: durationMinutes }),
        })
        .eq("id", trackingRow.id);

      if (trackingUpdateErr) {
        console.error("[deliver] delivery_tracking update error:", trackingUpdateErr.message);
        // Non-fatal — orders table is updated; return partial success
        return NextResponse.json({ ok: true, trackingUpdated: false });
      }

      // ── 3. Increment rider's total_deliveries count ─────────────────
      if (trackingRow.partner_id) {
        await adminClient.rpc("increment_rider_deliveries", {
          rider_id: trackingRow.partner_id,
        }).catch(() => {
          // If RPC doesn't exist, do it manually
          adminClient
            .from("delivery_partners")
            .select("total_deliveries")
            .eq("id", trackingRow.partner_id)
            .single()
            .then(({ data }) => {
              if (data) {
                adminClient
                  .from("delivery_partners")
                  .update({ total_deliveries: (data.total_deliveries ?? 0) + 1 })
                  .eq("id", trackingRow.partner_id)
                  .then(() => {});
              }
            });
        });
      }

      return NextResponse.json({ ok: true, trackingUpdated: true, durationMinutes });
    }

    // No active tracking row found — order might be direct (no rider)
    return NextResponse.json({ ok: true, trackingUpdated: false });
  } catch (err: any) {
    console.error("[deliver] Unexpected error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
