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
