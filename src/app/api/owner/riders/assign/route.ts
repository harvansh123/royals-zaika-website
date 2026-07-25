import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // Update order status to 'confirmed' if still pending
    await supabaseAdmin
      .from("orders")
      .update({ status: "confirmed" })
      .eq("id", orderId)
      .eq("status", "pending");

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

      await fetch(`${baseUrl}/api/push/send-to-rider`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          riderId,
          orderNumber: orderRow?.order_number,
          orderId,
        }),
      });
    } catch (pushErr: any) {
      console.error("[assign] Push to rider failed (non-fatal):", pushErr.message);
    }

    // Audit log on previous rider if reassigned
    if (previousRiderId && previousRiderId !== riderId) {
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
