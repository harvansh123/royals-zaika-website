import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Convert any string to a URL-safe slug */
function toSlugLocal(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function uniqueCategorySlugLocal(base: string): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("categories")
    .select("slug")
    .like("slug", `${base}%`);

  const taken = new Set((existing ?? []).map((r: any) => r.slug));
  if (!taken.has(base)) return base;

  let counter = 1;
  while (taken.has(`${base}-${counter}`)) counter++;
  return `${base}-${counter}`;
}

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();
    const slug = await uniqueCategorySlugLocal(toSlugLocal(trimmedName));

    const { data, error } = await supabaseAdmin
      .from("categories")
      .insert({
        name: trimmedName,
        slug,
        is_active: true,
        sort_order: 99, // default to end
      })
      .select("id, name")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ category: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}
