import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/owner/riders/assign?orderId=xxx — fetch current assigned rider for an order
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId");
  if (!orderId) return NextResponse.json({ partner_id: null });
  const { data } = await supabaseAdmin
    .from("delivery_tracking")
    .select("partner_id")
    .eq("order_id", orderId)
    .maybeSingle();
  return NextResponse.json({ partner_id: data?.partner_id ?? null });
}

// POST /api/owner/riders/assign — manually assign/reassign order to a rider
export async function POST(req: NextRequest) {
  try {
    const { orderId, riderId, ownerName, reason } = await req.json();
    if (!orderId || !riderId) {
      return NextResponse.json({ error: "orderId and riderId are required" }, { status: 400 });
    }

    // Verify rider is active
    const { data: partner } = await supabaseAdmin
      .from("delivery_partners")
      .select("id, name, account_status, is_available")
      .eq("id", riderId)
      .single();

    if (!partner) return NextResponse.json({ error: "Rider not found" }, { status: 404 });

    if (["blocked", "disabled", "suspended"].includes(partner.account_status)) {
      return NextResponse.json({
        error: `Cannot assign order — rider is ${partner.account_status}`
      }, { status: 400 });
    }

    // ── Busy Check ──────────────────────────────────────────────────
    // A rider can only handle one active order at a time.
    // If they already have an assigned or picked_up delivery, block assignment.
    const { data: activeTracking } = await supabaseAdmin
      .from("delivery_tracking")
      .select("id, status, order_id, orders(order_number)")
      .eq("partner_id", riderId)
      .in("status", ["assigned", "picked_up"])
      .maybeSingle();

    // Allow re-assigning the SAME order to the same rider (no-op scenario)
    if (activeTracking && activeTracking.order_id !== orderId) {
      const activeOrderNum = (activeTracking.orders as any)?.order_number ?? activeTracking.order_id;
      return NextResponse.json({
        error: `rider_busy`,
        message: `⚠️ Yeh rider abhi busy hai! Order #${activeOrderNum} deliver kar raha hai. Jab deliver ho jaye tab assign karein.`,
        active_order: activeOrderNum,
      }, { status: 409 });
    }

    // Check if delivery_tracking row exists
    const { data: existing } = await supabaseAdmin
      .from("delivery_tracking")
      .select("id, partner_id")
      .eq("order_id", orderId)
      .maybeSingle();

    const previousRiderId = existing?.partner_id ?? null;

    if (existing) {
      // Reassign
      await supabaseAdmin
        .from("delivery_tracking")
        .update({ partner_id: riderId, status: "assigned", updated_at: new Date().toISOString() })
        .eq("order_id", orderId);
    } else {
      // New assignment
      await supabaseAdmin
        .from("delivery_tracking")
        .insert({ order_id: orderId, partner_id: riderId, status: "assigned" });
    }

    // Update order status upon assignment:
    // • pending → confirmed  (safety fallback — normally order is already past pending)
    // • ready   → out_for_delivery  (most common: rider assigned after food is ready)
    //   This UPDATE fires a Supabase Realtime event so the owner dashboard
    //   immediately fetches the real status and shows Delivered + Reassign buttons.
    await supabaseAdmin
      .from("orders")
      .update({ status: "confirmed" })
      .eq("id", orderId)
      .eq("status", "pending");

    await supabaseAdmin
      .from("orders")
      .update({ status: "out_for_delivery" })
      .eq("id", orderId)
      .eq("status", "ready");

    // Notify rider (in-app notification)
    await supabaseAdmin.from("notifications").insert({
      user_id: riderId,
      title:   "New Order Assigned",
      message: `You have been manually assigned a new order by ${ownerName ?? "the owner"}.`,
      type:    "info",
      data:    { order_id: orderId },
    });

    // Web Push to rider (background — works even when page is closed)
    try {
      const { data: orderRow } = await supabaseAdmin
        .from("orders")
        .select("order_number")
        .eq("id", orderId)
        .maybeSingle();

      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
        || process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`
        || "http://localhost:3000";

      // Notify rider
      await fetch(`${baseUrl}/api/push/send-to-rider`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          riderId,
          orderNumber: orderRow?.order_number,
          orderId,
        }),
      });

      // Notify customer — rider is on the way (non-fatal)
      const { data: riderRow } = await supabaseAdmin
        .from("delivery_partners")
        .select("name")
        .eq("id", riderId)
        .maybeSingle();

      await fetch(`${baseUrl}/api/push/send-to-customer`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          orderId,
          status:      "picked_up",
          orderNumber: orderRow?.order_number,
          riderName:   riderRow?.name ?? undefined,
        }),
      });
    } catch (pushErr: any) {
      console.error("[assign] Push notification failed (non-fatal):", pushErr.message);
    }

    // Audit log on previous rider if reassigned
    if (previousRiderId && previousRiderId !== riderId) {
      // Get order number for the notification message
      const { data: orderRow2 } = await supabaseAdmin
        .from("orders")
        .select("order_number")
        .eq("id", orderId)
        .maybeSingle();

      // ── Real-time alert on old rider's dashboard ────────────────
      // Rider dashboard listens to notifications table (type = order_reassigned_away)
      // and fires an alarm + blocking modal when this INSERT arrives.
      await supabaseAdmin.from("notifications").insert({
        user_id: previousRiderId,
        title:   "Order Reassigned",
        message: `Order #${orderRow2?.order_number ?? ""} has been reassigned to another rider. Reason: ${reason ?? "No reason provided"}`,
        type:    "order_reassigned_away",
        data: {
          order_id:     orderId,
          order_number: orderRow2?.order_number ?? "",
          reason:       reason ?? "No reason provided",
          owner_name:   ownerName ?? "Owner",
        },
      });

      await supabaseAdmin.from("rider_audit_logs").insert({
        rider_id:   previousRiderId,
        action:     "order_reassigned_away",
        reason:     reason ?? "Manual reassignment by owner",
        owner_name: ownerName ?? "Owner",
        metadata:   { order_id: orderId, new_rider_id: riderId },
      });
    }


    // Audit log on new rider
    await supabaseAdmin.from("rider_audit_logs").insert({
      rider_id:   riderId,
      action:     previousRiderId ? "order_reassigned_to" : "order_manually_assigned",
      reason:     reason ?? null,
      owner_name: ownerName ?? "Owner",
      metadata:   { order_id: orderId },
    });

    return NextResponse.json({ success: true, partner_name: partner.name });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
