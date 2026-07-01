import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const roleParam = searchParams.get("role"); // "customer" | "owner"

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet: any[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && user) {
      // Fetch role from users table
      let { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      let dbRole = profile?.role;

      // If user does not exist in DB yet (e.g. first-time Google Login)
      if (!dbRole) {
        const validRoles = ["customer", "delivery", "restaurant_owner", "admin"];
        const safeRole = validRoles.includes(roleParam ?? "") ? roleParam : "customer";
        
        const adminClient = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          {
            cookies: {
              getAll() { return cookieStore.getAll(); },
              setAll() {},
            }
          }
        );
        
        await adminClient.from("users").upsert({
          id: user.id,
          email: user.email ?? "",
          name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User",
          role: safeRole,
          phone: user.phone ?? null,
        });
        
        dbRole = safeRole;
      }

      // Role-based redirect
      if (dbRole === "admin") return NextResponse.redirect(`${origin}/admin`);
      if (dbRole === "restaurant_owner") return NextResponse.redirect(`${origin}/owner`);
      if (dbRole === "delivery") return NextResponse.redirect(`${origin}/delivery`);
      // Default: customer → menu
      return NextResponse.redirect(`${origin}/menu`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=OAuthFailed`);
}
