import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/reviews/[id]/helpful  → toggle helpful/not-helpful vote
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { is_helpful } = await req.json();

    if (typeof is_helpful !== "boolean") {
      return NextResponse.json({ error: "is_helpful (boolean) required" }, { status: 400 });
    }

    // Upsert vote (one vote per user per review)
    const { error } = await supabaseAdmin
      .from("review_helpful")
      .upsert({ review_id: id, user_id: user.id, is_helpful }, { onConflict: "review_id,user_id" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Fetch updated counts (trigger keeps these fresh)
    const { data: updated } = await supabaseAdmin
      .from("order_reviews")
      .select("helpful_count, not_helpful_count")
      .eq("id", id)
      .single();

    return NextResponse.json({ success: true, counts: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
