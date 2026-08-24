import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const supabaseAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user: authUser } } = await supabaseAnon.auth.getUser(token);
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: u } = await adminClient
      .from("users")
      .select("role, email, recovery_pin_hash, recovery_email, recovery_email_verified")
      .eq("id", authUser.id)
      .maybeSingle();

    if (!u) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const hasPIN = !!u.recovery_pin_hash;

    // For owner/rider: their login email is always "valid" for recovery (auto-verified)
    const isOwnerOrRider = u.role === "restaurant_owner" || u.role === "delivery";
    const loginEmailIsReal = u.email && !u.email.endsWith("@royalzaika.customer");
    const hasVerifiedEmail =
      u.recovery_email_verified
      || (isOwnerOrRider && loginEmailIsReal);

    return NextResponse.json({
      hasPIN,
      hasRecoveryEmail: !!(u.recovery_email_verified && u.recovery_email) || (isOwnerOrRider && loginEmailIsReal),
      emailVerified: hasVerifiedEmail,
      recoveryEmail: u.recovery_email ?? null,
    });
  } catch (err: any) {
    console.error("recovery-status error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
