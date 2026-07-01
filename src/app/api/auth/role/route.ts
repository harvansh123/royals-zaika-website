import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Service-role client: bypasses ALL RLS policies → always gets the real role
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedRole = searchParams.get("role");

    // 1. Verify the caller is actually authenticated (uses anon + session cookie)
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
      return NextResponse.json({ role: null }, { status: 401 });
    }

    // 2. Fetch full profile using service-role client (no RLS, no recursion)
    const { data: profile, error: profileErr } = await adminClient
      .from("users")
      .select("id, name, email, phone, avatar_url, role, is_active, created_at, updated_at")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr) {
      console.error("[/api/auth/role] DB error:", profileErr.message);
    }

    if (profile) {
      return NextResponse.json({ profile });
    }

    // 3. Row doesn't exist yet — create it with role from signup metadata or requested role
    const metaRole = user.user_metadata?.role ?? requestedRole ?? "customer";
    const validRoles = ["customer", "delivery", "restaurant_owner", "admin"];
    const safeRole = validRoles.includes(metaRole) ? metaRole : "customer";

    const { data: inserted } = await adminClient
      .from("users")
      .upsert(
        {
          id:    user.id,
          email: user.email ?? "",
          name:  user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "User",
          role:  safeRole,
          phone: user.phone ?? null,
        },
        { onConflict: "id", ignoreDuplicates: true }
      )
      .select("id, name, email, phone, avatar_url, role, is_active, created_at, updated_at")
      .maybeSingle();

    if (inserted) {
      return NextResponse.json({ profile: inserted });
    }

    // 4. Last resort: re-fetch after upsert
    const { data: refetched } = await adminClient
      .from("users")
      .select("id, name, email, phone, avatar_url, role, is_active, created_at, updated_at")
      .eq("id", user.id)
      .maybeSingle();

    if (refetched) {
      return NextResponse.json({ profile: refetched });
    }

    // 5. Absolute fallback — build from auth metadata
    return NextResponse.json({
      profile: {
        id:         user.id,
        email:      user.email ?? "",
        name:       user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User",
        phone:      user.phone ?? null,
        avatar_url: user.user_metadata?.avatar_url ?? null,
        role:       safeRole,
        is_active:  true,
        created_at: user.created_at,
        updated_at: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error("[/api/auth/role] Unexpected error:", err.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
