import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/customer/rider-info?orderId=xxx
 *
 * Returns the assigned rider's contact details for an order.
 * Security: verifies the order belongs to the authenticated customer.
 * Uses service-role to join delivery_tracking → delivery_partners
 * (anon-key would fail RLS on delivery_partners).
 *
 * Returns { rider: null } when:
 *   - Order is not assigned yet (no delivery_tracking row)
 *   - Order is delivered / cancelled (rider info no longer relevant)
 *   - Order doesn't belong to this customer
 */
export async function GET(req: NextRequest) {
  try {
    const orderId = req.nextUrl.searchParams.get("orderId");
    if (!orderId) return NextResponse.json({ rider: null });

    // ── Auth: verify customer is logged in ───────────────────────
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ rider: null }, { status: 401 });

    // ── Security: verify order belongs to this customer ──────────
    const { data: order } = await adminClient
      .from("orders")
      .select("id, user_id, status")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!order) return NextResponse.json({ rider: null });

    // Don't expose rider info for delivered / cancelled orders
    if (["delivered", "cancelled"].includes(order.status)) {
      return NextResponse.json({ rider: null });
    }

    // ── Fetch active delivery_tracking for this order ────────────
    const { data: tracking } = await adminClient
      .from("delivery_tracking")
      .select("partner_id, status")
      .eq("order_id", orderId)
      .in("status", ["assigned", "picked_up"])
      .maybeSingle();

    if (!tracking?.partner_id) return NextResponse.json({ rider: null });

    // ── Fetch rider details from delivery_partners ───────────────
    const { data: partner } = await adminClient
      .from("delivery_partners")
      .select("name, phone, vehicle_type, vehicle_number")
      .eq("id", tracking.partner_id)
      .maybeSingle();

    if (!partner) return NextResponse.json({ rider: null });

    return NextResponse.json({
      rider: {
        name:            partner.name,
        phone:           partner.phone,
        vehicle_type:    partner.vehicle_type,
        vehicle_number:  partner.vehicle_number,
        tracking_status: tracking.status,
      },
    });
  } catch (err: any) {
    console.error("[customer/rider-info] Error:", err.message);
    return NextResponse.json({ rider: null }, { status: 500 });
  }
}
