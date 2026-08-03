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
 * Body: { trackingId, orderId, reason, forceWithSuspension? }
 *
 * Rider rejects an assigned order BEFORE pickup.
 *
 * Penalty Policy:
 *  - 1st rejection today     → Normal rejection, no penalty
 *  - 2nd+ rejection today    → Returns { requiresWarning: true } UNLESS forceWithSuspension = true
 *  - forceWithSuspension=true → Rejection proceeds + account suspended for 2 days
 *
 * Flow:
 *  1. Authenticate + verify delivery role
 *  2. Verify order is assigned to this rider (status = "assigned")
 *  3. Count today's rejections from rider_audit_logs
 *  4. If 2nd+ AND !forceWithSuspension → return warning (no DB changes yet)
 *  5. Delete delivery_tracking row → order becomes unassigned
 *  6. Set order status back to "ready" → owner can reassign
 *  7. If 2nd+ rejection (forceWithSuspension=true) → suspend account for 2 days
 *  8. Notify owner via notifications table + Web Push
 *  9. Audit log
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
    const { trackingId, orderId, reason, forceWithSuspension = false } = await req.json();
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

    // ── 5. Count today's rejections ─────────────────────────────────
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: todayRejectionCount } = await adminClient
      .from("rider_audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("rider_id", user.id)
      .eq("action", "order_rejected_by_rider")
      .gte("created_at", todayStart.toISOString());

    const isSecondRejection = (todayRejectionCount ?? 0) >= 1;

    // ── 6. If 2nd+ rejection, require warning confirmation first ─────
    if (isSecondRejection && !forceWithSuspension) {
      return NextResponse.json({
        requiresWarning:    true,
        todayRejectionCount: todayRejectionCount,
      });
    }

    // ── 7. Delete delivery_tracking row → order becomes unassigned ───
    await adminClient
      .from("delivery_tracking")
      .delete()
      .eq("id", trackingId);

    // ── 8. Set order status back to "ready" so owner can reassign ───
    await adminClient
      .from("orders")
      .update({ status: "ready" })
      .eq("id", orderId);

    // ── 9. Suspend account if 2nd+ rejection (forceWithSuspension) ──
    let suspended = false;
    let suspendedUntil: string | null = null;

    if (isSecondRejection && forceWithSuspension) {
      const suspendEnd = new Date();
      suspendEnd.setDate(suspendEnd.getDate() + 2); // 2 days from now
      suspendedUntil = suspendEnd.toISOString();

      await adminClient
        .from("delivery_partners")
        .update({
          account_status: "suspended",
          suspension_end: suspendedUntil,
          is_available:   false,
        })
        .eq("id", user.id);

      suspended = true;
      console.log(`[reject-order] Rider ${riderName} suspended until ${suspendedUntil} (2nd rejection today)`);
    }

    // ── 10. Find owner to notify ─────────────────────────────────────
    const { data: ownerRow } = await adminClient
      .from("users")
      .select("id")
      .in("role", ["restaurant_owner", "admin"])
      .limit(1)
      .maybeSingle();

    // ── 11. Insert notification for owner (triggers GlobalAlarmProvider) ──
    if (ownerRow?.id) {
      const suspendNote = suspended
        ? ` Rider ko 2 din ke liye suspend kar diya gaya hai.`
        : "";

      await adminClient.from("notifications").insert({
        user_id: ownerRow.id,
        title:   "⚠️ Rider ne Order Reject kiya!",
        message: `${riderName} ne order #${orderNumber} reject kar diya. Reason: ${reason.trim()}.${suspendNote} Kripya dusre rider ko assign karein.`,
        type:    "rider_rejected_order",
        data:    {
          order_id:     orderId,
          order_number: orderNumber,
          reason:       reason.trim(),
          rider_name:   riderName,
          rider_id:     user.id,
          suspended,
          suspended_until: suspendedUntil,
        },
      });

      // ── 12. Web Push to owner (non-fatal) ────────────────────────
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
              body:  `${riderName} ne order #${orderNumber} reject kiya. Reason: ${reason.trim()}${suspended ? " (Rider suspended)" : ""}`,
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

    // ── 13. Audit log ────────────────────────────────────────────────
    await adminClient.from("rider_audit_logs").insert({
      rider_id:   user.id,
      action:     "order_rejected_by_rider",
      reason:     reason.trim(),
      metadata:   {
        order_id:        orderId,
        order_number:    orderNumber,
        suspended,
        suspended_until: suspendedUntil,
        today_rejection_count: (todayRejectionCount ?? 0) + 1,
      },
    });

    // If suspended, also log separate suspension audit entry
    if (suspended) {
      await adminClient.from("rider_audit_logs").insert({
        rider_id:   user.id,
        action:     "rider_suspended_for_rejection",
        reason:     `2nd order rejection today. Auto-suspended for 2 days.`,
        metadata:   {
          suspended_until:    suspendedUntil,
          trigger_order_id:   orderId,
          trigger_order_num:  orderNumber,
        },
      });
    }

    console.log(`[reject-order] ${riderName} rejected order #${orderNumber}. Reason: ${reason.trim()}. Suspended: ${suspended}`);
    return NextResponse.json({
      success:        true,
      orderNumber,
      suspended,
      suspendedUntil,
    });

  } catch (err: any) {
    console.error("[reject-order] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
