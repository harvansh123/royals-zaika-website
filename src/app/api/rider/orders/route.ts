import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Service-role client bypasses ALL RLS policies.
// Required because the anon-key query cascade-fails:
//   delivery_tracking → orders → users (customer info)
// The rider has no policy to read OTHER users (customers).
// PostgREST uses INNER JOIN for m2o relations, so when the users
// join is blocked → orders row is dropped → delivery_tracking row
// is dropped → data = [] even when assigned rows exist in the DB.
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/rider/orders
 * Returns all active (non-delivered) orders assigned to the authenticated rider.
 * Data shape matches what delivery/page.tsx expects:
 *   [{ id, status, updated_at, orders: { ..., order_items: [...], users: {...} } }]
 */
export async function GET(_req: NextRequest) {
  try {
    // 1. Verify the caller is authenticated
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify caller has delivery role
    const { data: profile } = await adminClient
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "delivery") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. Fetch active assigned orders for this rider using service-role.
    //    This bypasses the RLS cascade failure caused by delivery_tracking
    //    → orders → users (customer) being blocked by the users table policy.
    const { data: trackingRows, error } = await adminClient
      .from("delivery_tracking")
      .select(`
        id,
        status,
        updated_at,
        order_id,
        orders (
          id,
          order_number,
          total_amount,
          payment_method,
          created_at,
          delivery_address,
          rider_payout,
          delivery_distance_km,
          special_instructions,
          delivery_distance_km,
          status,
          order_items ( name, quantity, price ),
          users ( name, phone, email )
        )
      `)
      .eq("partner_id", user.id)
      .neq("status", "delivered")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[/api/rider/orders] Query error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ orders: trackingRows ?? [] });
  } catch (err: any) {
    console.error("[/api/rider/orders] Unexpected error:", err.message);
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}

/**
 * PATCH /api/rider/orders
 * Body: { trackingId: string, orderId: string, trackingStatus: string, orderStatus: string }
 *
 * Updates delivery_tracking.status AND orders.status using service-role client.
 * Direct anon-key updates fail silently (RLS blocks delivery_tracking writes)
 * which caused a false "Failed to update status" toast even when the DB row
 * was actually updated. Using service-role here eliminates that RLS issue.
 */
export async function PATCH(req: NextRequest) {
  try {
    // 1. Verify caller is authenticated
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify delivery role
    const { data: profile } = await adminClient
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "delivery") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. Parse body
    const { trackingId, orderId, trackingStatus, orderStatus } = await req.json();
    if (!trackingId || !orderId || !trackingStatus || !orderStatus) {
      return NextResponse.json({ error: "trackingId, orderId, trackingStatus, orderStatus required" }, { status: 400 });
    }

    console.log("[/api/rider/orders PATCH] Updating:", { trackingId, orderId, trackingStatus, orderStatus, riderId: user.id });

    // 4. Verify this tracking row belongs to the authenticated rider (security check)
    const { data: tracking } = await adminClient
      .from("delivery_tracking")
      .select("id, partner_id")
      .eq("id", trackingId)
      .maybeSingle();

    if (!tracking) {
      return NextResponse.json({ error: "Tracking record not found" }, { status: 404 });
    }
    if (tracking.partner_id !== user.id) {
      return NextResponse.json({ error: "Forbidden — this order is not assigned to you" }, { status: 403 });
    }

    // 5. Update delivery_tracking using service-role (bypasses RLS)
    const { error: trackErr } = await adminClient
      .from("delivery_tracking")
      .update({ status: trackingStatus, updated_at: new Date().toISOString() })
      .eq("id", trackingId);

    if (trackErr) {
      console.error("[/api/rider/orders PATCH] delivery_tracking update error:", trackErr.message);
      return NextResponse.json({ error: "Failed to update delivery tracking: " + trackErr.message }, { status: 500 });
    }

    // 6. Update orders.status using service-role
    const { error: orderErr } = await adminClient
      .from("orders")
      .update({ status: orderStatus })
      .eq("id", orderId);

    if (orderErr) {
      console.error("[/api/rider/orders PATCH] orders update error:", orderErr.message);
      return NextResponse.json({ error: "Failed to update order status: " + orderErr.message }, { status: 500 });
    }

    // 7. COD payment auto-mark — runs ONLY when the order is delivered
    if (orderStatus === "delivered") {
      try {
        // Fetch the payment method and payout details for this order
        const { data: orderRow } = await adminClient
          .from("orders")
          .select("payment_method, payment_status, rider_payout, delivery_distance_km, distance_range")
          .eq("id", orderId)
          .maybeSingle();

        if (orderRow?.payment_method === "cash_on_delivery" && orderRow.payment_status !== "paid") {
          console.log("[/api/rider/orders PATCH] COD order delivered — marking payment as paid:", orderId);

          // Update orders.payment_status
          const { error: payStatusErr } = await adminClient
            .from("orders")
            .update({ payment_status: "paid" })
            .eq("id", orderId);

          if (payStatusErr) {
            console.error("[/api/rider/orders PATCH] COD orders.payment_status update error:", payStatusErr.message);
          }

          // Update payments table row for this order
          const { error: payTableErr } = await adminClient
            .from("payments")
            .update({ status: "paid" })
            .eq("order_id", orderId)
            .eq("method", "cash_on_delivery");

          if (payTableErr) {
            console.error("[/api/rider/orders PATCH] COD payments.status update error:", payTableErr.message);
          }

          console.log("[/api/rider/orders PATCH] COD payment marked as paid for order:", orderId);
        } else {
          console.log("[/api/rider/orders PATCH] Non-COD or already paid — skipping payment auto-update:", {
            method: orderRow?.payment_method,
            status: orderRow?.payment_status,
          });
        }
      } catch (payErr: any) {
        // Non-fatal — delivery is confirmed; log and continue
        console.error("[/api/rider/orders PATCH] COD payment auto-update unexpected error:", payErr.message);
      }

      // 8. Log Rider Earnings (only if rider_payout exists)
      try {
        const { data: orderRow } = await adminClient
          .from("orders")
          .select("rider_payout, delivery_distance_km, distance_range")
          .eq("id", orderId)
          .maybeSingle();

        if (orderRow?.rider_payout) {
          const { error: earnErr } = await adminClient
            .from("rider_earnings")
            .upsert({
              order_id:       orderId,
              partner_id:     user.id,
              payout_amount:  orderRow.rider_payout,
              distance_km:    orderRow.delivery_distance_km,
              distance_range: orderRow.distance_range,
              earned_at:      new Date().toISOString()
            }, { onConflict: "order_id" }); // idempotent insertion

          if (earnErr) {
            console.error("[/api/rider/orders PATCH] Failed to insert rider_earnings:", earnErr.message);
          } else {
            console.log("[/api/rider/orders PATCH] Rider earnings saved for order:", orderId);
          }
        }
      } catch (earnErr: any) {
        console.error("[/api/rider/orders PATCH] Rider earnings unexpected error:", earnErr.message);
      }
    }

    console.log("[/api/rider/orders PATCH] Success:", { trackingStatus, orderStatus });
    return NextResponse.json({ success: true, trackingStatus, orderStatus });
  } catch (err: any) {
    console.error("[/api/rider/orders PATCH] Unexpected error:", err.message);
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}

