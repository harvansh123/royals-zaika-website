import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getOwner() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await adminClient.from("users").select("role").eq("id", user.id).single();
  if (!profile || !["restaurant_owner", "admin"].includes(profile.role)) return null;
  return user;
}

// GET /api/owner/referrals — full analytics
export async function GET() {
  try {
    const owner = await getOwner();
    if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [
      { data: settings },
      { data: referrals },
      { data: rewards },
    ] = await Promise.all([
      adminClient.from("referral_settings").select("*").eq("id", 1).single(),
      adminClient.from("referrals").select(`
        id, status, referral_code, completed_at, created_at, first_order_status, first_order_id,
        referrer:referrer_id ( id, name, email, phone ),
        referred:referred_id ( id, name, email, phone )
      `).order("created_at", { ascending: false }),
      adminClient.from("referral_rewards").select(`
        id, milestone, reward_amount, status, expires_at, created_at, order_id,
        referrer:referrer_id ( name, email )
      `).order("created_at", { ascending: false }),
    ]);

    // Aggregate stats
    const totalReferrals    = referrals?.length ?? 0;
    const completedReferrals = referrals?.filter((r: any) => r.status === "completed").length ?? 0;
    const pendingReferrals   = referrals?.filter((r: any) => r.status === "pending").length ?? 0;
    const rejectedReferrals  = referrals?.filter((r: any) => r.status === "revoked" || r.status === "rejected").length ?? 0;

    const totalRewardsIssued   = rewards?.reduce((s: number, r: any) => s + Number(r.reward_amount), 0) ?? 0;
    const totalRewardsRedeemed = rewards?.filter((r: any) => r.status === "used")
      .reduce((s: number, r: any) => s + Number(r.reward_amount), 0) ?? 0;

    // Mark expired (lazy)
    const now = new Date();
    if (rewards) {
      for (const r of rewards as any[]) {
        if (r.status === "unused" && r.expires_at && new Date(r.expires_at) < now) {
          await adminClient.from("referral_rewards").update({ status: "expired" }).eq("id", r.id);
          r.status = "expired";
        }
      }
    }

    // Customers who hit 10-referral cap
    const referrerCounts: Record<string, number> = {};
    referrals?.forEach((r: any) => {
      if (r.status === "completed") {
        referrerCounts[r.referrer?.id ?? ""] = (referrerCounts[r.referrer?.id ?? ""] ?? 0) + 1;
      }
    });
    const maxedOut = Object.entries(referrerCounts)
      .filter(([, c]) => c >= (settings?.max_referrals ?? 10))
      .map(([id]) => id);

    return NextResponse.json({
      settings,
      stats: { totalReferrals, completedReferrals, pendingReferrals, rejectedReferrals, totalRewardsIssued, totalRewardsRedeemed },
      referrals: referrals ?? [],
      rewards: rewards ?? [],
      maxedOutReferrers: maxedOut,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/owner/referrals — update settings OR revoke reward
// Body: { action: "update_settings", settings: {...} } | { action: "revoke_reward", rewardId: string }
export async function PATCH(req: NextRequest) {
  try {
    const owner = await getOwner();
    if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    if (body.action === "revoke_reward") {
      const { error } = await adminClient
        .from("referral_rewards")
        .update({ status: "revoked" })
        .eq("id", body.rewardId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (body.action === "update_settings") {
      const allowed = [
        "is_enabled", "max_referrals",
        "reward_milestone_1", "reward_amount_1",
        "reward_milestone_3", "reward_amount_3",
        "reward_milestone_5", "reward_amount_5",
        "reward_milestone_10", "reward_amount_10",
        "min_order_amount", "reward_expiry_days",
      ];
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      for (const key of allowed) {
        if (body.settings[key] !== undefined) updates[key] = body.settings[key];
      }
      const { error } = await adminClient.from("referral_settings").update(updates).eq("id", 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
