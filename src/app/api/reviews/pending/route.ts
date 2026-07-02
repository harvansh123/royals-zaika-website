import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/reviews/pending
// Returns the first unreviewed delivered order for the logged-in customer
// Used by the ReviewPopup to decide whether to show the prompt
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ pendingOrder: null });

    // Get recent delivered orders for this user (last 30 days)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, created_at, total_amount")
      .eq("user_id", user.id)
      .eq("status", "delivered")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!orders || orders.length === 0) return NextResponse.json({ pendingOrder: null });

    // Find first one without a review
    for (const order of orders) {
      const { data: review } = await supabaseAdmin
        .from("order_reviews")
        .select("id")
        .eq("order_id", order.id)
        .maybeSingle();

      if (!review) {
        return NextResponse.json({ pendingOrder: order });
      }
    }

    return NextResponse.json({ pendingOrder: null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
