import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/auth/phone-lookup
 * Body: { phone: string }
 * Returns: { email: string } — email for that phone (used for mobile-number login)
 */
export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }

    // Normalise: strip +91, spaces, dashes; keep 10 digits
    let digits = phone.replace(/[\s\-().]/g, "");
    if (digits.startsWith("+91"))    digits = digits.slice(3);
    else if (digits.startsWith("0091")) digits = digits.slice(4);
    else if (digits.startsWith("0"))    digits = digits.slice(1);

    if (!/^[6-9]\d{9}$/.test(digits)) {
      return NextResponse.json({ error: "Invalid Indian mobile number" }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from("users")
      .select("email")
      .eq("phone", digits)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data?.email) {
      return NextResponse.json({ error: "No account found with this mobile number" }, { status: 404 });
    }

    return NextResponse.json({ email: data.email });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}
