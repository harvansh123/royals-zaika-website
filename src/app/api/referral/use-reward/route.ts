import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/referral/use-reward
 * Called after order is successfully placed and referral reward was applied.
 * Body: { rewardId: string, orderId: string }
 * Marks reward as "used" server-side. Validates the reward is still "unused".
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { rewardId, orderId } = await req.json();
    if (!rewardId || !orderId) {
      return NextResponse.json({ error: "rewardId and orderId required" }, { status: 400 });
    }

    // Verify this reward belongs to the authenticated user and is still unused
    const { data: reward } = await adminClient
      .from("referral_rewards")
      .select("id, referrer_id, status, expires_at, reward_amount")
      .eq("id", rewardId)
      .single();

    if (!reward) return NextResponse.json({ error: "Reward not found" }, { status: 404 });
    if (reward.referrer_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (reward.status !== "unused") return NextResponse.json({ error: "Reward already used or expired" }, { status: 409 });

    // Check expiry
    if (reward.expires_at && new Date(reward.expires_at) < new Date()) {
      await adminClient.from("referral_rewards").update({ status: "expired" }).eq("id", rewardId);
      return NextResponse.json({ error: "Reward has expired" }, { status: 409 });
    }

    // Mark as used
    const { error } = await adminClient
      .from("referral_rewards")
      .update({ status: "used", order_id: orderId })
      .eq("id", rewardId)
      .eq("status", "unused"); // extra guard

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
