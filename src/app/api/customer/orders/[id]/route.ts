import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/customer/orders/[id]
 *
 * Returns a single order with all joined data (order_items + menu_items)
 * for the authenticated customer using service role.
 *
 * Ownership check: verifies order.user_id === auth.uid() before returning.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // 2. Fetch order with items via service role
    const { data: order, error } = await adminClient
      .from("orders")
      .select("*, order_items(*, menu_items(name, image_url))")
      .eq("id", id)
      .single();

    if (error) {
      console.error("[/api/customer/orders/[id] GET] error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // 3. Ownership check — only the order's owner can view it
    if (order.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ order });
  } catch (err: any) {
    console.error("[/api/customer/orders/[id] GET] unexpected:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
