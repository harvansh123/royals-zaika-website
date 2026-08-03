import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/rider/reject-order
 * Body: { trackingId, orderId, reason }
 *
 * Rider rejects an assigned order BEFORE pickup.
 * Flow:
 *  1. Authenticate + verify delivery role
 *  2. Verify order is assigned to this rider (status = "assigned")
 *  3. Delete delivery_tracking row → order becomes unassigned
 *  4. Set order status back to "ready" → owner can reassign
 *  5. Notify owner via notifications table (type = rider_rejected_order)
 *     → GlobalAlarmProvider triggers alarm on owner dashboard
 *  6. Send Web Push to owner (works even if tab is closed)
 *  7. Log in rider_audit_logs
 */
export async function POST(req: NextRequest) {
  try {
    // ── 1. Authenticate ──────────────────────────────────────────────
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ── 2. Verify delivery role ──────────────────────────────────────
    const { data: profile } = await adminClient
      .from("users")
      .select("role, name")
      .eq("id", user.id)
      .single();
    if (!profile || profile.role !== "delivery") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── 3. Parse body ────────────────────────────────────────────────
    const { trackingId, orderId, reason } = await req.json();
    if (!trackingId || !orderId || !reason?.trim()) {
      return NextResponse.json({ error: "trackingId, orderId, and reason are required" }, { status: 400 });
    }

    // ── 4. Verify ownership + "assigned" status ──────────────────────
    const { data: tracking } = await adminClient
      .from("delivery_tracking")
      .select("id, partner_id, status, orders(order_number)")
      .eq("id", trackingId)
      .maybeSingle();

    if (!tracking) return NextResponse.json({ error: "Tracking record not found" }, { status: 404 });
    if (tracking.partner_id !== user.id) {
      return NextResponse.json({ error: "Forbidden — order not assigned to you" }, { status: 403 });
    }
    if (tracking.status !== "assigned") {
      return NextResponse.json({
        error: "Order can only be rejected before pickup (status must be 'assigned')"
      }, { status: 400 });
    }

    const orderNumber = (tracking.orders as any)?.order_number ?? "";
    const riderName   = profile.name ?? "Rider";

    // ── 5. Delete delivery_tracking row → order becomes unassigned ───
    await adminClient
      .from("delivery_tracking")
      .delete()
      .eq("id", trackingId);

    // ── 6. Set order status back to "ready" so owner can reassign ───
    await adminClient
      .from("orders")
      .update({ status: "ready" })
      .eq("id", orderId);

    // ── 7. Find owner user_id ────────────────────────────────────────
    const { data: ownerRow } = await adminClient
      .from("users")
      .select("id")
      .in("role", ["restaurant_owner", "admin"])
      .limit(1)
      .maybeSingle();

    // ── 8. Notify owner via notifications table ──────────────────────
    // GlobalAlarmProvider listens to notifications INSERT and fires alarm
    if (ownerRow?.id) {
      await adminClient.from("notifications").insert({
        user_id: ownerRow.id,
        title:   "⚠️ Rider ne Order Reject kiya!",
        message: `${riderName} ne order #${orderNumber} reject kar diya. Reason: ${reason.trim()}. Kripya dusre rider ko assign karein.`,
        type:    "rider_rejected_order",
        data:    {
          order_id:     orderId,
          order_number: orderNumber,
          reason:       reason.trim(),
          rider_name:   riderName,
          rider_id:     user.id,
        },
      });

      // ── 9. Web Push to owner (non-fatal) ──────────────────────────
      try {
        const { data: ownerSubs } = await adminClient
          .from("push_subscriptions")
          .select("id, subscription")
          .eq("user_id", ownerRow.id);

        if (ownerSubs?.length) {
          const { sendPushToSubscription } = await import("@/lib/webpush");
          const expiredIds: string[] = [];
          for (const sub of ownerSubs) {
            const ok = await sendPushToSubscription(sub.subscription, {
              title: "⚠️ Rider ne Order Reject kiya!",
              body:  `${riderName} ne order #${orderNumber} reject kiya. Reason: ${reason.trim()}. Reassign karein.`,
              url:   "/owner/orders",
              tag:   "rider-rejected",
              icon:  "/icons/icon-192x192.png",
            });
            if (!ok) expiredIds.push(sub.id);
          }
          if (expiredIds.length) {
            await adminClient.from("push_subscriptions").delete().in("id", expiredIds);
          }
        }
      } catch (pushErr: any) {
        console.warn("[reject-order] Push to owner failed (non-fatal):", pushErr.message);
      }
    }

    // ── 10. Audit log ────────────────────────────────────────────────
    await adminClient.from("rider_audit_logs").insert({
      rider_id:   user.id,
      action:     "order_rejected_by_rider",
      reason:     reason.trim(),
      metadata:   { order_id: orderId, order_number: orderNumber },
    });

    console.log(`[reject-order] ${riderName} rejected order #${orderNumber}. Reason: ${reason.trim()}`);
    return NextResponse.json({ success: true, orderNumber });

  } catch (err: any) {
    console.error("[reject-order] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
