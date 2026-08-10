import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/menu
 * Public endpoint — no auth required.
 *
 * Returns all available menu items + active categories using the
 * service-role client which bypasses RLS entirely.
 *
 * WHY: Direct supabase.from("menu_items").select() with the anon key
 * goes through RLS policies. The "Owners can manage menu items" policy
 * calls get_user_role() which may still cause recursion if the SQL fix
 * hasn't been applied, causing the query to fail silently (menuItems=null)
 * → customer sees an empty menu page.
 */
export async function GET() {
  try {
    const [
      { data: items,      error: itemErr },
      { data: categories, error: catErr  },
    ] = await Promise.all([
      adminClient
        .from("menu_items")
        .select(
          "id,name,slug,description,image_url,price,discounted_price," +
          "is_veg,is_bestseller,is_featured,rating,preparation_time," +
          "spice_level,category_id,is_available,sort_order"
        )
        .eq("is_available", true)
        .order("sort_order"),
      adminClient
        .from("categories")
        .select("id,name,slug,icon,sort_order")
        .eq("is_active", true)
        .order("sort_order"),
    ]);

    if (itemErr) {
      console.error("[/api/menu] menu_items error:", itemErr.message);
      return NextResponse.json({ error: itemErr.message }, { status: 500 });
    }
    if (catErr) {
      console.error("[/api/menu] categories error:", catErr.message);
      return NextResponse.json({ error: catErr.message }, { status: 500 });
    }

    return NextResponse.json(
      { items: items ?? [], categories: categories ?? [] },
      {
        headers: {
          // 30s fresh cache — menu rarely changes mid-session.
          // Realtime in menu page busts sessionStorage cache on any menu_items change.
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      }
    );
  } catch (err: any) {
    console.error("[/api/menu] Unexpected error:", err.message);
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}
