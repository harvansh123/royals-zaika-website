import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUser() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
}

// PATCH /api/reviews/[id]  → edit review (within 24h)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await getUser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // Verify ownership & 24h window
    const { data: existing } = await supabaseAdmin
      .from("order_reviews")
      .select("id, user_id, created_at")
      .eq("id", id)
      .maybeSingle();

    if (!existing) return NextResponse.json({ error: "Review not found" }, { status: 404 });
    if (existing.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const ageMs = Date.now() - new Date(existing.created_at).getTime();
    if (ageMs > 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: "Reviews can only be edited within 24 hours" }, { status: 400 });
    }

    if (body.comment && (body.comment.length < 10 || body.comment.length > 1000)) {
      return NextResponse.json({ error: "Comment must be 10–1000 characters" }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {
      is_edited: true,
      edited_at: new Date().toISOString(),
    };
    const allowed = ["overall_rating","food_quality_rating","taste_rating","packaging_rating","delivery_rating","comment","photos"];
    for (const key of allowed) {
      if (key in body) updatePayload[key] = body[key];
    }

    const { data: updated, error } = await supabaseAdmin
      .from("order_reviews")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update item ratings if provided
    if (Array.isArray(body.item_ratings)) {
      for (const ir of body.item_ratings) {
        if (!ir.menu_item_id || !ir.rating) continue;
        await supabaseAdmin.from("review_item_ratings").upsert({
          review_id:    id,
          menu_item_id: ir.menu_item_id,
          order_item_id: ir.order_item_id || null,
          rating:       ir.rating,
          comment:      ir.comment || null,
        }, { onConflict: "review_id,menu_item_id" });
      }
    }

    return NextResponse.json({ review: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/reviews/[id]  → customer deletes own review
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await getUser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: existing } = await supabaseAdmin
      .from("order_reviews")
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle();

    if (!existing) return NextResponse.json({ error: "Review not found" }, { status: 404 });
    if (existing.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { error } = await supabaseAdmin
      .from("order_reviews")
      .delete()
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
