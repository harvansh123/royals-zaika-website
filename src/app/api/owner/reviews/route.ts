import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/owner/reviews  → All reviews + analytics for owner dashboard
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from("users").select("role").eq("id", user.id).single();
    if (!profile || !["restaurant_owner", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const filter = searchParams.get("filter") ?? "all"; // all | 5 | 4 | 3 | 2 | 1
    const page   = parseInt(searchParams.get("page") ?? "1");
    const limit  = 20;
    const offset = (page - 1) * limit;

    // ── All reviews with user & item data ──
    let query = supabaseAdmin
      .from("order_reviews")
      .select(`
        *,
        users ( id, name, email, avatar_url ),
        orders ( order_number, total_amount ),
        review_item_ratings (
          id, menu_item_id, rating, comment,
          menu_items ( id, name, image_url )
        )
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (filter !== "all") {
      query = query.eq("overall_rating", parseInt(filter));
    }
    if (search) {
      query = query.ilike("comment", `%${search}%`);
    }

    const { data: reviews, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // ── Analytics ──
    const { data: allReviews } = await supabaseAdmin
      .from("order_reviews")
      .select("overall_rating, created_at");

    const now = new Date();
    const todayStart  = new Date(now); todayStart.setHours(0,0,0,0);
    const weekStart   = new Date(now); weekStart.setDate(now.getDate() - 7);
    const monthStart  = new Date(now); monthStart.setDate(1); monthStart.setHours(0,0,0,0);

    const dist: Record<number, number> = { 1:0, 2:0, 3:0, 4:0, 5:0 };
    let totalRating = 0;
    let todayCount = 0, weekCount = 0, monthCount = 0;

    (allReviews ?? []).forEach((r) => {
      dist[r.overall_rating] = (dist[r.overall_rating] ?? 0) + 1;
      totalRating += r.overall_rating;
      const d = new Date(r.created_at);
      if (d >= todayStart) todayCount++;
      if (d >= weekStart)  weekCount++;
      if (d >= monthStart) monthCount++;
    });

    const totalCount = (allReviews ?? []).length;
    const avgRating  = totalCount > 0 ? Math.round((totalRating / totalCount) * 10) / 10 : 0;
    const satisfaction = totalCount > 0
      ? Math.round(((dist[4] + dist[5]) / totalCount) * 100)
      : 0;

    // ── Per-item stats ──
    const { data: itemStats } = await supabaseAdmin
      .from("menu_items")
      .select("id, name, image_url, rating, review_count")
      .gt("review_count", 0)
      .order("rating", { ascending: false });

    const topItems    = (itemStats ?? []).slice(0, 5);
    const bottomItems = [...(itemStats ?? [])].sort((a,b) => a.rating - b.rating).slice(0, 5);

    return NextResponse.json({
      reviews: reviews ?? [],
      total: count ?? 0,
      analytics: {
        avgRating,
        totalCount,
        todayCount,
        weekCount,
        monthCount,
        distribution: dist,
        satisfaction,
        topItems,
        bottomItems,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
