import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToSubscription, PushPayload } from "@/lib/webpush";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/push/send-to-rider
 * Sends a Web Push notification to a specific rider's devices.
 * Called internally after a rider is assigned to an order.
 *
 * Body: { riderId: string, orderNumber?: string, orderId?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { riderId, orderNumber, orderId } = await req.json();

    if (!riderId) {
      return NextResponse.json({ error: "riderId is required" }, { status: 400 });
    }

    // Fetch all push subscriptions for this rider
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("user_id", riderId);

    if (!subs || subs.length === 0) {
      console.log(`[/api/push/send-to-rider] No subscriptions for rider ${riderId}`);
      return NextResponse.json({ sent: 0, note: "No subscriptions for this rider" });
    }

    const payload: PushPayload = {
      title: "📦 New Delivery Assigned!",
      body:  orderNumber
        ? `Order #${orderNumber} has been assigned to you. Open your dashboard.`
        : "You have a new order to pick up. Open your dashboard.",
      url:   "/delivery",
      tag:   "new-assignment",
      icon:  "/icons/icon-192x192.png",
    };

    let sent = 0;
    const expiredIds: string[] = [];

    for (const sub of subs) {
      const ok = await sendPushToSubscription(sub.subscription, payload);
      if (ok) {
        sent++;
      } else {
        expiredIds.push(sub.id);
      }
    }

    // Clean up expired subscriptions
    if (expiredIds.length > 0) {
      await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .in("id", expiredIds);
    }

    console.log(`[/api/push/send-to-rider] Sent ${sent}/${subs.length} pushes to rider ${riderId}`);
    return NextResponse.json({ sent });
  } catch (err: any) {
    console.error("[/api/push/send-to-rider] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
