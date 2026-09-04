import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code        = searchParams.get("code");
  const roleParam   = searchParams.get("role");  // "customer" | "owner"
  const refCode     = searchParams.get("ref");   // referral code from share link

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

        const isNewUser = !dbRole;
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

          // Link referral for brand-new Google OAuth users only
          if (refCode && safeRole === "customer") {
            try {
              const { createClient: createAdmin } = await import("@supabase/supabase-js");
              const adminSB = createAdmin(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
              );
              const code2 = refCode.trim().toUpperCase();
              const { data: referrer } = await adminSB.from("users").select("id").eq("referral_code", code2).maybeSingle();
              if (referrer && referrer.id !== user.id) {
                const { data: settings } = await adminSB.from("referral_settings").select("is_enabled,max_referrals").eq("id",1).single();
                if (settings?.is_enabled) {
                  const { count } = await adminSB.from("referrals").select("*",{count:"exact",head:true}).eq("referrer_id",referrer.id).eq("status","completed");
                  if ((count ?? 0) < (settings.max_referrals ?? 10)) {
                    await adminSB.from("referrals").insert({ referrer_id: referrer.id, referred_id: user.id, referral_code: code2, status: "pending" });
                  }
                }
              }
            } catch { /* silent */ }
          }
          
          dbRole = safeRole;
        }

      // Role-based redirect
      if (dbRole === "admin") return NextResponse.redirect(`${origin}/admin`);
      if (dbRole === "restaurant_owner") return NextResponse.redirect(`${origin}/owner/orders`);
      if (dbRole === "delivery") return NextResponse.redirect(`${origin}/delivery`);
      // Default: customer → menu
      return NextResponse.redirect(`${origin}/menu`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=OAuthFailed`);
}
