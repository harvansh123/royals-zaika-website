import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json({ error: "Missing token or password" }, { status: 400 });
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    // Hash the incoming token and look up user
    const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");

    const { data: u } = await adminClient
      .from("users")
      .select("id, reset_token_hash, reset_token_expires_at")
      .eq("reset_token_hash", tokenHash)
      .maybeSingle();

    if (!u) {
      return NextResponse.json(
        { error: "Invalid or expired reset link. Please request a new one." },
        { status: 400 }
      );
    }

    // Check expiry
    if (!u.reset_token_expires_at || new Date(u.reset_token_expires_at) < new Date()) {
      // Clear stale token
      await adminClient.from("users").update({
        reset_token_hash: null,
        reset_token_expires_at: null,
      }).eq("id", u.id);
      return NextResponse.json(
        { error: "Reset link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Update password via admin SDK
    const { error: pwErr } = await adminClient.auth.admin.updateUserById(u.id, {
      password: newPassword,
    });

    if (pwErr) {
      console.error("Password update error:", pwErr);
      return NextResponse.json({ error: "Failed to update password. Please try again." }, { status: 500 });
    }

    // Clear token (one-time use)
    await adminClient.from("users").update({
      reset_token_hash: null,
      reset_token_expires_at: null,
    }).eq("id", u.id);

    return NextResponse.json({ success: true, message: "Password updated successfully." });
  } catch (err: any) {
    console.error("reset-password error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
