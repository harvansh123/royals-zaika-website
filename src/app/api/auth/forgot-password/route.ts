import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Rate limiting (in-memory, resets on cold start) ──────────────────
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(phone: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(phone);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    rateLimitMap.set(phone, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count++;
  return true;
}

function normalizePhone(phone: string): string {
  let d = phone.replace(/[\s\-().]/g, "");
  if (d.startsWith("+91"))    d = d.slice(3);
  else if (d.startsWith("0091")) d = d.slice(4);
  else if (d.startsWith("0"))    d = d.slice(1);
  return d;
}

function getBaseUrl(req: NextRequest): string {
  const origin = req.headers.get("origin");
  if (origin) return origin;
  const host = req.headers.get("host") ?? "royals-zaika-website.vercel.app";
  return `https://${host}`;
}

export async function POST(req: NextRequest) {
  try {
    const { identifier, method, value } = await req.json();

    if (!identifier || !method || !value) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (method !== "email" && method !== "pin") {
      return NextResponse.json({ error: "Invalid method" }, { status: 400 });
    }

    const phone = normalizePhone(String(identifier));
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ error: "Invalid mobile number" }, { status: 400 });
    }

    if (!checkRateLimit(phone)) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again in 15 minutes." },
        { status: 429 }
      );
    }

    // Lookup user by phone (10-digit format)
    const { data: u } = await adminClient
      .from("users")
      .select("id, name, email, role, recovery_email, recovery_email_verified, recovery_pin_hash")
      .eq("phone", phone)
      .maybeSingle();

    // Generic success for security (never reveal if user exists for email method)
    const genericEmailSuccess = NextResponse.json({
      success: true,
      message: "If an account is found with matching details, a reset link has been sent.",
    });

    if (!u) {
      if (method === "email") return genericEmailSuccess;
      return NextResponse.json({ error: "No account found with this mobile number." }, { status: 404 });
    }

    // ── Generate reset token helper ────────────────────────────────
    async function generateAndStoreToken() {
      const token = crypto.randomBytes(32).toString("hex");
      const hash  = crypto.createHash("sha256").update(token).digest("hex");
      const exp   = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1hr
      await adminClient.from("users").update({
        reset_token_hash: hash,
        reset_token_expires_at: exp,
      }).eq("id", u!.id);
      return token;
    }

    // ── PIN method ────────────────────────────────────────────────
    if (method === "pin") {
      if (!u.recovery_pin_hash) {
        return NextResponse.json(
          { error: "Recovery PIN not set on this account. Please use Email recovery." },
          { status: 400 }
        );
      }
      const pinStr = String(value).trim();
      if (!/^\d{4}$/.test(pinStr)) {
        return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 });
      }
      const ok = await bcrypt.compare(pinStr, u.recovery_pin_hash);
      if (!ok) {
        return NextResponse.json({ error: "Incorrect PIN. Please try again." }, { status: 400 });
      }
      const token = await generateAndStoreToken();
      return NextResponse.json({ success: true, token });
    }

    // ── Email method ──────────────────────────────────────────────
    const inputEmail = String(value).toLowerCase().trim();
    let validEmail: string | null = null;

    // Check custom recovery_email (all roles)
    if (u.recovery_email_verified && u.recovery_email) {
      if (u.recovery_email.toLowerCase() === inputEmail) validEmail = u.recovery_email;
    }

    // For owner/rider: also accept their Supabase auth email directly
    if (!validEmail && (u.role === "restaurant_owner" || u.role === "delivery")) {
      if (u.email && u.email.toLowerCase() === inputEmail && !u.email.endsWith("@royalzaika.customer")) {
        validEmail = u.email;
      }
    }

    if (!validEmail) return genericEmailSuccess;

    const token   = await generateAndStoreToken();
    const baseUrl = getBaseUrl(req);
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

    await sendPasswordResetEmail({ to: validEmail, resetUrl, name: u.name ?? "User" });

    return genericEmailSuccess;
  } catch (err: any) {
    console.error("forgot-password error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
