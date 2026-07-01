import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/customer/orders
 *
 * Returns all orders for the authenticated customer using the service-role
 * client — bypasses RLS entirely.
 *
 * WHY: Direct anon-key queries on `orders` trigger `order_items` RLS which
 * does a subquery back into `orders`, re-evaluating all orders policies
 * including "Admins view all orders" which calls get_user_role() — potential
 * recursion causing data=null → customer sees empty order history.
 */
export async function GET() {
  try {
    // 1. Verify the caller is authenticated
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

    // 2. Fetch the customer's orders via service role (bypasses RLS)
    const { data, error } = await adminClient
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[/api/customer/orders GET] error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ orders: data ?? [] });
  } catch (err: any) {
    console.error("[/api/customer/orders GET] unexpected:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
