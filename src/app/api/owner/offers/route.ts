import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Owner: GET all offers
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("offers")
    .select("*")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ offers: data ?? [] });
}

// Owner: POST create offer
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, error } = await supabaseAdmin
      .from("offers")
      .insert({
        title:               body.title,
        description:         body.description ?? null,
        discount_type:       body.discount_type,
        discount_value:      Number(body.discount_value),
        min_order_amount:    Number(body.min_order_amount ?? 0),
        max_discount_amount: body.max_discount_amount ? Number(body.max_discount_amount) : null,
        start_date:          body.start_date,
        end_date:            body.end_date,
        is_active:           body.is_active ?? true,
        priority:            Number(body.priority ?? 0),
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ offer: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
