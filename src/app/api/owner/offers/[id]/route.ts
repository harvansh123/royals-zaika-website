import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Owner: PATCH update offer (also used for enable/disable toggle)
// Next.js 16+: params is a Promise — must be awaited
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const update: Record<string, any> = { updated_at: new Date().toISOString() };

    if (body.title               !== undefined) update.title               = body.title;
    if (body.description         !== undefined) update.description         = body.description;
    if (body.discount_type       !== undefined) update.discount_type       = body.discount_type;
    if (body.discount_value      !== undefined) update.discount_value      = Number(body.discount_value);
    if (body.min_order_amount    !== undefined) update.min_order_amount    = Number(body.min_order_amount);
    if (body.max_discount_amount !== undefined) update.max_discount_amount = body.max_discount_amount ? Number(body.max_discount_amount) : null;
    if (body.start_date          !== undefined) update.start_date          = body.start_date;
    if (body.end_date            !== undefined) update.end_date            = body.end_date;
    if (body.is_active           !== undefined) update.is_active           = body.is_active;
    if (body.priority            !== undefined) update.priority            = Number(body.priority);

    const { data, error } = await supabaseAdmin
      .from("offers")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ offer: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Owner: DELETE offer
export async function DELETE(
  _: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { error } = await supabaseAdmin
    .from("offers")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
