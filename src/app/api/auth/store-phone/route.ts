import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/auth/store-phone
 * Body: { userId: string, phone: string, referralCode?: string }
 * Stores phone, enforces uniqueness, and optionally links referral.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, phone, referralCode } = await req.json();

    if (!userId || !phone) {
      return NextResponse.json({ error: "userId and phone required" }, { status: 400 });
    }

    // Normalise phone
    let digits = phone.replace(/[\s\-().]/g, "");
    if (digits.startsWith("+91"))      digits = digits.slice(3);
    else if (digits.startsWith("0091")) digits = digits.slice(4);
    else if (digits.startsWith("0"))    digits = digits.slice(1);

    if (!/^[6-9]\d{9}$/.test(digits)) {
      return NextResponse.json({ error: "Invalid Indian mobile number" }, { status: 400 });
    }

    // Uniqueness check
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

    // Save phone
    const { error } = await adminClient
      .from("users")
      .update({ phone: digits })
      .eq("id", userId);

    if (error) {
      console.error("[/api/auth/store-phone] Error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // ── Referral linking (non-blocking — silently skip on any issue) ──────────
    if (referralCode && typeof referralCode === "string" && referralCode.trim()) {
      try {
        const code = referralCode.trim().toUpperCase();

        // Find referrer by code
        const { data: referrer } = await adminClient
          .from("users")
          .select("id")
          .eq("referral_code", code)
          .maybeSingle();

        if (referrer && referrer.id !== userId) {
          const { data: settings } = await adminClient
            .from("referral_settings")
            .select("is_enabled, max_referrals")
            .eq("id", 1)
            .single();

          if (settings?.is_enabled) {
            const { count: completedCount } = await adminClient
              .from("referrals")
              .select("*", { count: "exact", head: true })
              .eq("referrer_id", referrer.id)
              .eq("status", "completed");

            if ((completedCount ?? 0) < (settings.max_referrals ?? 10)) {
              await adminClient.from("referrals").insert({
                referrer_id:   referrer.id,
                referred_id:   userId,
                referral_code: code,
                status:        "pending",
              });
              // UNIQUE(referred_id) in DB prevents duplicates
            }
          }
        }
      } catch { /* referral is bonus — never block account creation */ }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}
