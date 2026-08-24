import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAuthUser(req: NextRequest) {
  const supabaseAnon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabaseAnon.auth.getUser(token);
  return user ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { otp } = await req.json();
    if (!otp) {
      return NextResponse.json({ error: "OTP is required" }, { status: 400 });
    }

    const otpHash = crypto.createHash("sha256").update(String(otp).trim()).digest("hex");

    const { data: u } = await adminClient
      .from("users")
      .select("id, recovery_otp_hash, recovery_otp_expires_at")
      .eq("id", authUser.id)
      .maybeSingle();

    if (!u || !u.recovery_otp_hash) {
      return NextResponse.json({ error: "No pending OTP. Please request a new one." }, { status: 400 });
    }

    if (new Date(u.recovery_otp_expires_at) < new Date()) {
      await adminClient.from("users").update({ recovery_otp_hash: null, recovery_otp_expires_at: null }).eq("id", authUser.id);
      return NextResponse.json({ error: "OTP has expired. Please request a new one." }, { status: 400 });
    }

    if (otpHash !== u.recovery_otp_hash) {
      return NextResponse.json({ error: "Incorrect OTP. Please try again." }, { status: 400 });
    }

    // Mark verified and clear OTP
    await adminClient.from("users").update({
      recovery_email_verified: true,
      recovery_otp_hash: null,
      recovery_otp_expires_at: null,
    }).eq("id", authUser.id);

    return NextResponse.json({ success: true, message: "Recovery email verified successfully." });
  } catch (err: any) {
    console.error("verify-recovery-email error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
