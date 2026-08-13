import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return "ZAIKA" + suffix;
}

// GET /api/referral/my-referrals
// Returns: code, shareLink, stats, referrals[], bestReward
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch settings
    const { data: settings } = await adminClient
      .from("referral_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (!settings?.is_enabled) {
      return NextResponse.json({ enabled: false });
    }

    // Ensure user has a referral code
    let { data: profile } = await adminClient
      .from("users")
      .select("referral_code, name")
      .eq("id", user.id)
      .single();

    let code = profile?.referral_code;
    if (!code) {
      // Auto-generate
      for (let attempt = 0; attempt < 5; attempt++) {
        code = generateCode();
        const { data: existing } = await adminClient
          .from("users").select("id").eq("referral_code", code).maybeSingle();
        if (!existing) break;
      }
      await adminClient.from("users").update({ referral_code: code }).eq("id", user.id);
    }

    // Fetch referrals made by this user
    const { data: referrals } = await adminClient
      .from("referrals")
      .select(`
        id, status, referral_code, completed_at, created_at, first_order_status,
        referred:referred_id ( name, email, phone )
      `)
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false });

    // Fetch rewards
    const { data: rewards } = await adminClient
      .from("referral_rewards")
      .select("*")
      .eq("referrer_id", user.id)
      .order("milestone", { ascending: true });

    // Mark expired rewards
    const now = new Date();
    if (rewards) {
      for (const r of rewards) {
        if (r.status === "unused" && r.expires_at && new Date(r.expires_at) < now) {
          await adminClient
            .from("referral_rewards")
            .update({ status: "expired" })
            .eq("id", r.id);
          r.status = "expired";
        }
      }
    }

    // Best unused reward for checkout
    const bestReward = rewards
      ?.filter((r: any) => r.status === "unused")
      .sort((a: any, b: any) => b.reward_amount - a.reward_amount)[0] ?? null;

    const completedCount = referrals?.filter((r: any) => r.status === "completed").length ?? 0;
    const pendingCount   = referrals?.filter((r: any) => r.status === "pending").length ?? 0;
    const maxReached     = completedCount >= settings.max_referrals;

    const origin = new URL(request.url).origin;
    const shareLink = `${origin}/auth/signup?ref=${code}`;

    return NextResponse.json({
      enabled: true,
      code,
      shareLink,
      settings,
      stats: { completedCount, pendingCount, maxReached, maxReferrals: settings.max_referrals },
      referrals: referrals ?? [],
      rewards: rewards ?? [],
      bestReward,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
