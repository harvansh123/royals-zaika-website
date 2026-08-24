import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { sendOTPEmail } from "@/lib/email";

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

    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const trimmed = email.trim().toLowerCase();
    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }
    // Reject fake auto-generated customer emails
    if (trimmed.endsWith("@royalzaika.customer")) {
      return NextResponse.json({ error: "Please enter a real email address" }, { status: 400 });
    }

    // Generate 6-digit OTP
    const otp     = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const exp     = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Fetch user name
    const { data: userData } = await adminClient
      .from("users")
      .select("name")
      .eq("id", authUser.id)
      .maybeSingle();

    // Store email + OTP (not yet verified)
    await adminClient.from("users").update({
      recovery_email: trimmed,
      recovery_email_verified: false,
      recovery_otp_hash: otpHash,
      recovery_otp_expires_at: exp,
    }).eq("id", authUser.id);

    await sendOTPEmail({ to: trimmed, otp, name: userData?.name ?? "User" });

    return NextResponse.json({ success: true, message: "OTP sent to your email." });
  } catch (err: any) {
    console.error("link-recovery-email error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
