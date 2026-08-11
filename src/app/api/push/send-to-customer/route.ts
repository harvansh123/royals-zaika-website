import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToSubscription, PushPayload } from "@/lib/webpush";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/push/send-to-customer
 * Sends a Web Push notification to the customer who placed an order,
 * informing them of their order status change.
 *
 * Body: {
 *   orderId:     string   — order UUID
 *   status:      string   — new status (preparing, ready, picked_up, delivered, cancelled, etc.)
 *   orderNumber?: string  — human-readable order number e.g. "1042"
 *   riderName?:  string   — rider name (used for out-for-delivery message)
 *   reason?:     string   — cancellation reason
 * }
 */

// Status → notification content map
function getPayload(
  status: string,
  orderNumber: string,
  riderName?: string,
  reason?: string
): PushPayload | null {
  const tag = `order-status-${orderNumber}`;
  const url = "/";   // takes customer to home/order tracking

  switch (status) {
    case "confirmed":
    case "preparing":
      return {
        title: "✅ Order Accept Ho Gaya!",
        body:  `Order #${orderNumber} confirm ho gaya. Aapka khana ban raha hai 🍳`,
        url,
        tag,
        icon: "/icons/icon-192x192.png",
      };

    case "ready":
      return {
        title: "📦 Khana Ready!",
        body:  `Order #${orderNumber} pack ho gaya. Rider assign ho raha hai...`,
        url,
        tag,
        icon: "/icons/icon-192x192.png",
      };

    case "picked_up":
    case "out_for_delivery":
      return {
        title: "🛵 Rider On The Way!",
        body:  riderName
          ? `${riderName} aapka order #${orderNumber} deliver karne aa raha hai!`
          : `Order #${orderNumber} aapke ghar ki taraf aa raha hai!`,
        url,
        tag,
        icon: "/icons/icon-192x192.png",
      };

    case "delivered":
      return {
        title: "🎉 Order Deliver Ho Gaya!",
        body:  `Order #${orderNumber} successfully deliver ho gaya. Enjoy your meal! 😊`,
        url,
        tag,
        icon: "/icons/icon-192x192.png",
      };

    case "cancelled":
      return {
        title: "❌ Order Cancel Ho Gaya",
        body:  reason
          ? `Order #${orderNumber} cancel ho gaya. Reason: ${reason}`
          : `Order #${orderNumber} cancel ho gaya. Sorry for the inconvenience.`,
        url,
        tag,
        icon: "/icons/icon-192x192.png",
      };

    default:
      return null; // Unknown status — do not notify
  }
}

export async function POST(req: NextRequest) {
  try {
    const { orderId, status, orderNumber, riderName, reason } = await req.json();

    if (!orderId || !status) {
      return NextResponse.json({ error: "orderId and status are required" }, { status: 400 });
    }

    // 1. Find the customer (user_id) for this order
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("user_id, order_number")
      .eq("id", orderId)
      .single();

    if (orderErr || !order?.user_id) {
      console.warn(`[send-to-customer] Order ${orderId} not found or no user_id`);
      return NextResponse.json({ sent: 0, note: "Order not found" });
    }

    const customerId   = order.user_id;
    const displayNumber = orderNumber ?? order.order_number ?? orderId.slice(0, 8);

    // 2. Build notification payload for this status
    const payload = getPayload(status, displayNumber, riderName, reason);
    if (!payload) {
      console.log(`[send-to-customer] No notification defined for status "${status}" — skipping`);
      return NextResponse.json({ sent: 0, note: `No notification for status ${status}` });
    }

    // 3. Fetch all push subscriptions for this customer
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("user_id", customerId);

    if (!subs || subs.length === 0) {
      console.log(`[send-to-customer] No push subscriptions for customer ${customerId}`);
      return NextResponse.json({ sent: 0, note: "Customer has no push subscriptions" });
    }

    // 4. Send to all customer devices
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

    // 5. Clean up expired subscriptions
    if (expiredIds.length > 0) {
      await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .in("id", expiredIds);
    }

    console.log(
      `[send-to-customer] order=${displayNumber} status=${status} sent=${sent}/${subs.length}`
    );
    return NextResponse.json({ sent });
  } catch (err: any) {
    console.error("[send-to-customer] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
