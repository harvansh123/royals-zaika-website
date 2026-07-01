import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Public GET — returns the single highest-priority active offer for today
export async function GET() {
  try {
    const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"

    const { data, error } = await supabaseAdmin
      .from("offers")
      .select("*")
      .eq("is_active", true)
      .lte("start_date", today)
      .gte("end_date", today)
      .order("priority", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ offer: null });
    return NextResponse.json({ offer: data ?? null });
  } catch {
    return NextResponse.json({ offer: null });
  }
}
