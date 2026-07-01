import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * PATCH /api/customer/profile
 * Body: { name?: string, phone?: string, avatar_url?: string }
 *
 * Updates the authenticated customer's profile using service-role client.
 * Direct supabase.from("users").update() with anon key fails because
 * the "Admins can view all users" policy calls get_user_role() which
 * re-queries the users table → infinite recursion → update fails with
 * "Failed to update profile".
 */
export async function PATCH(req: NextRequest) {
  try {
    // 1. Verify the caller is authenticated
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

    // 2. Parse and validate body
    const body = await req.json();
    const updateData: Record<string, any> = {};
    if (typeof body.name       === "string") updateData.name       = body.name.trim();
    if (typeof body.phone      === "string") updateData.phone      = body.phone.trim() || null;
    if (typeof body.avatar_url === "string") updateData.avatar_url = body.avatar_url || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // 3. Update via service role — bypasses the RLS infinite recursion on users table
    const { data, error } = await adminClient
      .from("users")
      .update(updateData)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      console.error("[/api/customer/profile] Update error:", {
        message: error.message,
        code:    error.code,
        details: error.details,
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: data });
  } catch (err: any) {
    console.error("[/api/customer/profile] Unexpected error:", err.message);
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}
