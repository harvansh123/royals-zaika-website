import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/auth/store-phone
 * Body: { userId: string, phone: string }
 *
 * Called immediately after supabase.auth.signUp() succeeds.
 * Stores the validated phone number in the users table using service-role
 * to bypass RLS. Also enforces uniqueness — rejects duplicate phone numbers.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, phone } = await req.json();

    if (!userId || !phone) {
      return NextResponse.json({ error: "userId and phone required" }, { status: 400 });
    }

    // Normalise phone
    let digits = phone.replace(/[\s\-().]/g, "");
    if (digits.startsWith("+91"))    digits = digits.slice(3);
    else if (digits.startsWith("0091")) digits = digits.slice(4);
    else if (digits.startsWith("0"))    digits = digits.slice(1);

    if (!/^[6-9]\d{9}$/.test(digits)) {
      return NextResponse.json({ error: "Invalid Indian mobile number" }, { status: 400 });
    }

    // Uniqueness check — reject if another user already has this phone
    const { data: existing } = await adminClient
      .from("users")
      .select("id")
      .eq("phone", digits)
      .neq("id", userId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "This mobile number is already registered with another account" },
        { status: 409 }
      );
    }

    // Upsert phone — the row may or may not exist yet depending on trigger timing
    const { error } = await adminClient
      .from("users")
      .update({ phone: digits })
      .eq("id", userId);

    if (error) {
      console.error("[/api/auth/store-phone] Error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}
