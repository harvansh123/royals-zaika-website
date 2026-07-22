import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS entirely so owner can see all orders + items
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit  = parseInt(searchParams.get("limit")  ?? "100");
    const status = searchParams.get("status"); // optional filter

    let query = supabaseAdmin
      .from("orders")
      .select("*, order_items(name, quantity, price, subtotal), users(name, phone, email, completed_orders)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Owner orders API error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ orders: data ?? [] });
  } catch (err: any) {
    console.error("Owner orders API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
