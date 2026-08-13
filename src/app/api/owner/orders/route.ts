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
    const limit  = parseInt(searchParams.get("limit")  ?? "200");
    const status = searchParams.get("status"); // optional filter
    const date   = searchParams.get("date");   // "today" | "all" | "YYYY-MM-DD"

    let query = supabaseAdmin
      .from("orders")
      .select("*, order_items(name, quantity, price, subtotal), users(name, phone, email, completed_orders)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // Date filter
    if (!date || date === "today") {
      // Default: only today's orders (midnight IST → UTC)
      const now = new Date();
      // IST = UTC+5:30 → midnight IST = 18:30 UTC previous day
      const istOffset = 5.5 * 60 * 60 * 1000;
      const todayIST  = new Date(Math.floor((now.getTime() + istOffset) / 86400000) * 86400000 - istOffset);
      query = query.gte("created_at", todayIST.toISOString());
    } else if (date && date !== "all") {
      // Specific date "YYYY-MM-DD" in IST
      const [y, m, d] = date.split("-").map(Number);
      // Midnight IST for that date
      const istOffset  = 5.5 * 60 * 60 * 1000;
      const startIST   = new Date(Date.UTC(y, m - 1, d) - istOffset);
      const endIST     = new Date(startIST.getTime() + 86400000);
      query = query.gte("created_at", startIST.toISOString()).lt("created_at", endIST.toISOString());
    }
    // date === "all" → no date filter

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
