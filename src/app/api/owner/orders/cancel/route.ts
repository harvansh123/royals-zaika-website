import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * PATCH /api/owner/orders/cancel
 * Body: { orderId: string; reason: string }
 *
 * Cancels an order at any non-delivered stage.
 * - Verifies caller is restaurant_owner or admin
 * - Sets status=cancelled, saves cancellation_reason + cancelled_at
 * - Sends a notification to the customer
 * - Does NOT delete the order — full history is preserved
 */
export async function PATCH(req: NextRequest) {
  try {
    // 1. Verify caller is authenticated as owner/admin
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify caller role
    const { data: userRow } = await adminClient
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userRow || !["admin", "restaurant_owner"].includes(userRow.role)) {
      return NextResponse.json({ error: "Forbidden — owner only" }, { status: 403 });
    }

    // 3. Parse body
    const { orderId, reason } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }
    if (!reason || !reason.toString().trim()) {
      return NextResponse.json({ error: "Cancellation reason is required" }, { status: 400 });
    }

    // 4. Fetch the order to check it's not already delivered/cancelled
    const { data: order, error: fetchErr } = await adminClient
      .from("orders")
      .select("id, status, user_id, order_number")
      .eq("id", orderId)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status === "delivered") {
      return NextResponse.json({ error: "Delivered orders cannot be cancelled" }, { status: 400 });
    }

    if (order.status === "cancelled") {
      return NextResponse.json({ error: "Order is already cancelled" }, { status: 400 });
    }

    // 5. Cancel the order
    const cancelledAt = new Date().toISOString();
    const { error: updateErr } = await adminClient
      .from("orders")
      .update({
        status: "cancelled",
        cancellation_reason: reason.toString().trim(),
        cancelled_at: cancelledAt,
        updated_at: cancelledAt,
      })
      .eq("id", orderId);

    if (updateErr) {
      console.error("[cancel] update error:", updateErr.message);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // 6. Send notification to customer
    await adminClient.from("notifications").insert({
      user_id: order.user_id,
      title: `Order #${order.order_number} Cancelled`,
      message: `Your order has been cancelled. Reason: ${reason.toString().trim()}`,
      type: "order_cancelled",
      data: { order_id: orderId, reason: reason.toString().trim() },
      is_read: false,
    });

    return NextResponse.json({ success: true, orderId });
  } catch (err: any) {
    console.error("[/api/owner/orders/cancel] unexpected:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
