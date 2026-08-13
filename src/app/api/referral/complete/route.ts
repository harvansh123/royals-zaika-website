import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/referral/complete
 * Called (background, fire-and-forget) when owner marks order as "delivered".
 * Body: { orderId: string }
 *
 * Logic:
 * 1. Find the order's user_id
 * 2. Check if that user is a pending referred user (first_order_id IS NULL)
 * 3. Mark referral as completed
 * 4. Count referrer's total completed referrals
 * 5. Issue milestone rewards that haven't been issued yet
 * DB UNIQUE INDEX on (referrer_id, milestone) prevents race-condition duplicates.
 */
export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

    // 1. Get the order
    const { data: order } = await adminClient
      .from("orders")
      .select("id, user_id, status")
      .eq("id", orderId)
      .single();

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.status !== "delivered") return NextResponse.json({ skipped: "not delivered" });

    // 2. Find pending referral for this user (first order only — first_order_id IS NULL)
    const { data: referral } = await adminClient
      .from("referrals")
      .select("id, referrer_id, status, first_order_id")
      .eq("referred_id", order.user_id)
      .eq("status", "pending")
      .is("first_order_id", null)
      .maybeSingle();

    if (!referral) return NextResponse.json({ skipped: "no pending referral" });

    // 3. Mark referral as completed
    const { error: refErr } = await adminClient
      .from("referrals")
      .update({
        status: "completed",
        first_order_id: orderId,
        first_order_status: "delivered",
        completed_at: new Date().toISOString(),
      })
      .eq("id", referral.id);

    if (refErr) return NextResponse.json({ error: refErr.message }, { status: 500 });

    // 4. Fetch settings and referrer's completed count
    const [{ data: settings }, { count: completedCount }] = await Promise.all([
      adminClient.from("referral_settings").select("*").eq("id", 1).single(),
      adminClient.from("referrals")
        .select("*", { count: "exact", head: true })
        .eq("referrer_id", referral.referrer_id)
        .eq("status", "completed"),
    ]);

    if (!settings) return NextResponse.json({ error: "No settings" }, { status: 500 });

    // 5. Check milestones and issue rewards that haven't been issued yet
    const milestones = [
      { count: settings.reward_milestone_1,  amount: settings.reward_amount_1,  num: 1  },
      { count: settings.reward_milestone_3,  amount: settings.reward_amount_3,  num: 3  },
      { count: settings.reward_milestone_5,  amount: settings.reward_amount_5,  num: 5  },
      { count: settings.reward_milestone_10, amount: settings.reward_amount_10, num: 10 },
    ];

    const totalCompleted = completedCount ?? 0;

    // Only issue rewards if within max_referrals limit
    if (totalCompleted <= settings.max_referrals) {
      const expiryDays = settings.reward_expiry_days ?? 90;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      for (const m of milestones) {
        if (totalCompleted >= m.count) {
          // upsert with ignoreDuplicates — UNIQUE INDEX on (referrer_id, milestone) prevents double-issue
          await adminClient.from("referral_rewards").upsert({
            referrer_id:   referral.referrer_id,
            referral_id:   referral.id,
            milestone:     m.num,
            reward_amount: m.amount,
            status:        "unused",
            expires_at:    expiresAt.toISOString(),
          }, { ignoreDuplicates: true, onConflict: "referrer_id, milestone" });
        }
      }
    }

    return NextResponse.json({ success: true, totalCompleted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
