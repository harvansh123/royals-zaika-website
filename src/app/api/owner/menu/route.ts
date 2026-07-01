import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: List all menu items + categories
export async function GET() {
  const [{ data: items, error: itemErr }, { data: cats }] = await Promise.all([
    supabaseAdmin.from("menu_items").select("*").order("sort_order"),
    supabaseAdmin.from("categories").select("id, name").eq("is_active", true).order("sort_order"),
  ]);

  if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });
  return NextResponse.json({ items: items ?? [], categories: cats ?? [] });
}

// ── Slug helpers ─────────────────────────────────────────────────────────────

/** Convert any string to a URL-safe slug:
 *  "Paneer Butter Masala!" → "paneer-butter-masala"
 */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")   // remove special chars except spaces & hyphens
    .replace(/\s+/g, "-")            // spaces → hyphens
    .replace(/-+/g, "-")             // collapse multiple hyphens
    .replace(/^-|-$/g, "");          // trim leading/trailing hyphens
}

/** Return a slug that doesn't exist yet in menu_items.
 *  If "paneer-burger" exists, tries "paneer-burger-1", "paneer-burger-2", …
 */
async function uniqueSlug(base: string): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("menu_items")
    .select("slug")
    .like("slug", `${base}%`);

  const taken = new Set((existing ?? []).map((r: any) => r.slug));
  if (!taken.has(base)) return base;

  let counter = 1;
  while (taken.has(`${base}-${counter}`)) counter++;
  return `${base}-${counter}`;
}

// POST: Add new menu item (bypasses RLS using service role)
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    if (!payload.name || !payload.price) {
      return NextResponse.json({ error: "Name and price are required" }, { status: 400 });
    }
    if (!payload.category_id) {
      return NextResponse.json({ error: "Please select a category" }, { status: 400 });
    }

    // Generate a unique slug from the item name
    const slug = await uniqueSlug(toSlug(payload.name));

    const { data, error } = await supabaseAdmin
      .from("menu_items")
      .insert({
        name:             payload.name,
        slug,                                                              // ← always set
        description:      payload.description || null,
        price:            parseFloat(payload.price),
        discounted_price: payload.discounted_price ? parseFloat(payload.discounted_price) : null,
        is_veg:           payload.is_veg ?? true,
        is_featured:      payload.is_featured ?? false,
        is_bestseller:    payload.is_bestseller ?? false,
        category_id:      payload.category_id || null,
        image_url:        payload.image_url || null,
        is_available:     true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}



// PATCH: Update existing menu item
export async function PATCH(req: NextRequest) {
  try {
    const { id, ...payload } = await req.json();
    if (!id) return NextResponse.json({ error: "Item ID required" }, { status: 400 });

    const updateData: any = {};
    if (payload.name !== undefined)             updateData.name             = payload.name;
    if (payload.description !== undefined)      updateData.description      = payload.description || null;
    if (payload.price !== undefined)            updateData.price            = parseFloat(payload.price);
    if (payload.discounted_price !== undefined) updateData.discounted_price = payload.discounted_price ? parseFloat(payload.discounted_price) : null;
    if (payload.is_veg !== undefined)           updateData.is_veg           = payload.is_veg;
    if (payload.is_featured !== undefined)      updateData.is_featured      = payload.is_featured;
    if (payload.is_bestseller !== undefined)    updateData.is_bestseller    = payload.is_bestseller;
    if (payload.category_id !== undefined)      updateData.category_id      = payload.category_id || null;
    if (payload.image_url !== undefined)        updateData.image_url        = payload.image_url || null;
    if (payload.is_available !== undefined)     updateData.is_available     = payload.is_available;

    const { data, error } = await supabaseAdmin
      .from("menu_items")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}

// DELETE: Remove a menu item
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Item ID required" }, { status: 400 });

    const { error } = await supabaseAdmin.from("menu_items").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}
