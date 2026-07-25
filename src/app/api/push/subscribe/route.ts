import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/push/subscribe
 * Saves or updates a Web Push subscription for the authenticated user.
 * Called by the browser when the user grants notification permission.
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { subscription } = body;

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: "Invalid subscription object" }, { status: 400 });
    }

    const userAgent = req.headers.get("user-agent") || null;

    // Upsert: one subscription per user per endpoint
    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert(
        {
          user_id:      user.id,
          subscription: subscription,
          user_agent:   userAgent,
        },
        {
          onConflict: "user_id,subscription->endpoint",
          ignoreDuplicates: false,
        }
      );

    if (error) {
      // If upsert fails (e.g. unique constraint not expressible), try insert
      await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("subscription->>endpoint", subscription.endpoint);

      await supabaseAdmin.from("push_subscriptions").insert({
        user_id:      user.id,
        subscription: subscription,
        user_agent:   userAgent,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[/api/push/subscribe] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/push/subscribe
 * Removes a push subscription (called on logout or permission revoke).
 */
export async function DELETE(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { endpoint } = await req.json();
    if (!endpoint) {
      // Delete all subscriptions for this user
      await supabaseAdmin.from("push_subscriptions").delete().eq("user_id", user.id);
    } else {
      await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("subscription->>endpoint", endpoint);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
