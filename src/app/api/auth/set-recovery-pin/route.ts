import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

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

    const { action, pin } = await req.json();

    if (!action || !["set", "change", "remove"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (action === "remove") {
      await adminClient.from("users")
        .update({ recovery_pin_hash: null })
        .eq("id", authUser.id);
      return NextResponse.json({ success: true, message: "Recovery PIN removed." });
    }

    // set or change
    const pinStr = String(pin ?? "").trim();
    if (!/^\d{4}$/.test(pinStr)) {
      return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 });
    }

    const hash = await bcrypt.hash(pinStr, 10);
    await adminClient.from("users")
      .update({ recovery_pin_hash: hash })
      .eq("id", authUser.id);

    return NextResponse.json({ success: true, message: action === "set" ? "Recovery PIN set." : "Recovery PIN updated." });
  } catch (err: any) {
    console.error("set-recovery-pin error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
