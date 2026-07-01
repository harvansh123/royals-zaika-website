import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Service-role client: bypasses ALL RLS policies including the recursive admin check
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * PATCH /api/rider/status
 * Body: { isAvailable: boolean }
 *
 * Updates the delivery_partners.is_available field for the currently
 * authenticated rider using the service-role client so RLS infinite
 * recursion (caused by the admin policy calling get_user_role) never
 * blocks a legitimate rider update.
 */
export async function PATCH(req: NextRequest) {
  try {
    // 1. Verify the caller is actually authenticated
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

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify caller has the delivery role (extra safety check)
    const { data: profile } = await adminClient
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["delivery", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. Parse request body
    const { isAvailable } = await req.json();
    if (typeof isAvailable !== "boolean") {
      return NextResponse.json({ error: "isAvailable (boolean) is required" }, { status: 400 });
    }

    // 4. Update using service-role client — bypasses RLS completely
    const { error: updateErr } = await adminClient
      .from("delivery_partners")
      .update({ is_available: isAvailable })
      .eq("id", user.id);

    if (updateErr) {
      console.error("[/api/rider/status] Update error:", updateErr.message);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      riderId: user.id,
      isAvailable,
      status: isAvailable ? "online" : "offline",
    });
  } catch (err: any) {
    console.error("[/api/rider/status] Unexpected error:", err.message);
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}
