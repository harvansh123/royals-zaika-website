import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O,0,I,1 (confusing)
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return "ZAIKA" + suffix;
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Check if code already exists
    const { data: profile } = await adminClient
      .from("users")
      .select("referral_code")
      .eq("id", user.id)
      .single();

    if (profile?.referral_code) {
      return NextResponse.json({ code: profile.referral_code });
    }

    // Generate unique code (retry up to 5 times on collision)
    let code = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      code = generateCode();
      const { data: existing } = await adminClient
        .from("users")
        .select("id")
        .eq("referral_code", code)
        .maybeSingle();
      if (!existing) break;
    }

    const { error } = await adminClient
      .from("users")
      .update({ referral_code: code })
      .eq("id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ code });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
