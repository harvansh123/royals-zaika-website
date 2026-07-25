import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToSubscription, PushPayload } from "@/lib/webpush";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/push/send-to-owners
 * Sends a Web Push notification to all owner/admin push subscriptions.
 * Called internally after a new order is placed (from checkout/page.tsx).
 *
 * Body: { orderNumber: string, orderId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { orderNumber, orderId } = await req.json();

    // Find all owner/admin user IDs
    const { data: owners } = await supabaseAdmin
      .from("users")
      .select("id")
      .in("role", ["restaurant_owner", "admin"]);

    if (!owners || owners.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    const ownerIds = owners.map((o: any) => o.id);

    // Fetch all push subscriptions for owners
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, subscription")
      .in("user_id", ownerIds);

    if (!subs || subs.length === 0) {
      return NextResponse.json({ sent: 0, note: "No owner subscriptions found" });
    }

    const payload: PushPayload = {
      title: "🔔 New Order Received!",
      body:  `Order #${orderNumber} is waiting for your confirmation.`,
      url:   "/owner/orders",
      tag:   "new-order",
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

    console.log(`[/api/push/send-to-owners] Sent ${sent}/${subs.length} pushes for order #${orderNumber}`);
    return NextResponse.json({ sent });
  } catch (err: any) {
    console.error("[/api/push/send-to-owners] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
