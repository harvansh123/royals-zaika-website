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
 * Saves a Web Push subscription for the authenticated user.
 * Called by the browser after notification permission is granted.
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

    if (!subscription?.endpoint) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const userAgent = req.headers.get("user-agent") || null;
    const endpoint  = subscription.endpoint as string;

    // Delete any old record with this exact endpoint (clean upsert)
    await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("subscription->>endpoint", endpoint);

    // Insert fresh
    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .insert({
        user_id:      user.id,
        subscription: subscription,
        user_agent:   userAgent,
      });

    if (error) {
      console.error("[/api/push/subscribe] Insert error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("[/api/push/subscribe] Saved subscription for user:", user.id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[/api/push/subscribe] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/push/subscribe
 * Removes push subscription(s) for the authenticated user.
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

    const { endpoint } = await req.json().catch(() => ({}));

    if (!endpoint) {
      // Delete ALL subscriptions for this user (logout scenario)
      await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id);
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
