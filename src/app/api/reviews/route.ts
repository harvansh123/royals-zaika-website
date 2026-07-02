import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getSupabaseUser() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

// GET /api/reviews?orderId=  → check if reviewed + get review data
// GET /api/reviews?menuItemId=&page=&sort=  → paginated reviews for menu item
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId    = searchParams.get("orderId");
  const menuItemId = searchParams.get("menuItemId");
  const page       = parseInt(searchParams.get("page") ?? "1");
  const sort       = searchParams.get("sort") ?? "latest"; // latest | highest | lowest | helpful
  const limit      = 10;
  const offset     = (page - 1) * limit;

  // ── By orderId: fetch the review for a specific order ──
  if (orderId) {
    const { data, error } = await supabaseAdmin
      .from("order_reviews")
      .select(`
        *,
        users ( name, avatar_url ),
        review_item_ratings (
          id, menu_item_id, order_item_id, rating, comment,
          menu_items ( name, image_url )
        )
      `)
      .eq("order_id", orderId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ review: data });
  }

  // ── By menuItemId: paginated reviews for menu item ──
  if (menuItemId) {
    let orderBy: { column: string; ascending: boolean } = { column: "created_at", ascending: false };
    if (sort === "highest") orderBy = { column: "overall_rating", ascending: false };
    if (sort === "lowest")  orderBy = { column: "overall_rating", ascending: true };
    if (sort === "helpful") orderBy = { column: "helpful_count",  ascending: false };

    // Get reviews that include this menu_item_id in their item ratings
    const { data: itemRatings, error: irErr } = await supabaseAdmin
      .from("review_item_ratings")
      .select("review_id")
      .eq("menu_item_id", menuItemId);

    if (irErr) return NextResponse.json({ error: irErr.message }, { status: 500 });

    const reviewIds = [...new Set((itemRatings ?? []).map((r) => r.review_id))];

    if (reviewIds.length === 0) {
      return NextResponse.json({ reviews: [], total: 0, stats: { avg: 0, count: 0, distribution: {} } });
    }

    // Count total
    const { count } = await supabaseAdmin
      .from("order_reviews")
      .select("id", { count: "exact", head: true })
      .in("id", reviewIds);

    // Get paginated reviews
    const { data: reviews, error: rErr } = await supabaseAdmin
      .from("order_reviews")
      .select(`
        *,
        users ( name, avatar_url ),
        review_item_ratings (
          id, menu_item_id, rating, comment,
          menu_items ( name, image_url )
        )
      `)
      .in("id", reviewIds)
      .order(orderBy.column, { ascending: orderBy.ascending })
      .range(offset, offset + limit - 1);

    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

    // Compute distribution from ALL reviews (not just this page)
    const { data: allRatings } = await supabaseAdmin
      .from("review_item_ratings")
      .select("rating")
      .eq("menu_item_id", menuItemId);

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;
    (allRatings ?? []).forEach((r) => {
      distribution[r.rating] = (distribution[r.rating] ?? 0) + 1;
      totalRating += r.rating;
    });
    const totalCount = (allRatings ?? []).length;
    const avg = totalCount > 0 ? Math.round((totalRating / totalCount) * 10) / 10 : 0;

    return NextResponse.json({
      reviews: reviews ?? [],
      total: count ?? 0,
      stats: { avg, count: totalCount, distribution },
    });
  }

  return NextResponse.json({ error: "Provide orderId or menuItemId" }, { status: 400 });
}

// POST /api/reviews  → create full review (order-level + item ratings)
export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseUser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      order_id,
      overall_rating,
      food_quality_rating,
      taste_rating,
      packaging_rating,
      delivery_rating,
      comment,
      photos,
      item_ratings, // Array<{ menu_item_id, order_item_id, rating, comment }>
    } = body;

    if (!order_id || !overall_rating) {
      return NextResponse.json({ error: "order_id and overall_rating are required" }, { status: 400 });
    }

    // Verify order is delivered and belongs to this user
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, status, user_id")
      .eq("id", order_id)
      .eq("user_id", user.id)
      .single();

    if (orderErr || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.status !== "delivered") return NextResponse.json({ error: "Can only review delivered orders" }, { status: 400 });

    // Check for duplicate
    const { data: existing } = await supabaseAdmin
      .from("order_reviews")
      .select("id")
      .eq("order_id", order_id)
      .maybeSingle();
    if (existing) return NextResponse.json({ error: "You have already reviewed this order" }, { status: 409 });

    // Validate comment length
    if (comment && (comment.length < 10 || comment.length > 1000)) {
      return NextResponse.json({ error: "Comment must be 10–1000 characters" }, { status: 400 });
    }

    // Insert order review
    const { data: review, error: reviewErr } = await supabaseAdmin
      .from("order_reviews")
      .insert({
        user_id: user.id,
        order_id,
        overall_rating,
        food_quality_rating: food_quality_rating || null,
        taste_rating:        taste_rating        || null,
        packaging_rating:    packaging_rating    || null,
        delivery_rating:     delivery_rating     || null,
        comment:             comment             || null,
        photos:              photos              ?? [],
      })
      .select()
      .single();

    if (reviewErr) return NextResponse.json({ error: reviewErr.message }, { status: 500 });

    // Insert item ratings
    if (item_ratings && Array.isArray(item_ratings) && item_ratings.length > 0) {
      const itemRows = item_ratings
        .filter((ir: any) => ir.menu_item_id && ir.rating >= 1 && ir.rating <= 5)
        .map((ir: any) => ({
          review_id:    review.id,
          menu_item_id: ir.menu_item_id,
          order_item_id: ir.order_item_id || null,
          rating:       ir.rating,
          comment:      ir.comment || null,
        }));

      if (itemRows.length > 0) {
        const { error: irErr } = await supabaseAdmin
          .from("review_item_ratings")
          .insert(itemRows);
        if (irErr) console.error("Item ratings insert error:", irErr);
      }
    }

    return NextResponse.json({ review }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
