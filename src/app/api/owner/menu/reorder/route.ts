import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: NextRequest) {
  try {
    const payload = await req.json();
    const { categories, items } = payload;

    if (!Array.isArray(categories) || !Array.isArray(items)) {
      return NextResponse.json({ error: "Invalid payload format" }, { status: 400 });
    }

    // Process categories
    const categoryPromises = categories.map((cat: { id: string; sort_order: number }) =>
      supabaseAdmin
        .from("categories")
        .update({ sort_order: cat.sort_order })
        .eq("id", cat.id)
    );

    // Process items
    const itemPromises = items.map((item: { id: string; sort_order: number; category_id?: string | null }) => {
      const updateData: any = { sort_order: item.sort_order };
      if (item.category_id !== undefined) {
        updateData.category_id = item.category_id;
      }
      return supabaseAdmin
        .from("menu_items")
        .update(updateData)
        .eq("id", item.id);
    });

    // Run all updates in parallel
    const results = await Promise.all([...categoryPromises, ...itemPromises]);

    // Check if any update failed
    const errors = results.filter((res) => res.error);
    if (errors.length > 0) {
      console.error("[Menu Reorder] Some updates failed:", errors);
      return NextResponse.json({ error: "Some updates failed to save." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Menu order saved successfully." });
  } catch (err: any) {
    console.error("[Menu Reorder] Unexpected error:", err);
    return NextResponse.json({ error: err.message ?? "Internal server error" }, { status: 500 });
  }
}
