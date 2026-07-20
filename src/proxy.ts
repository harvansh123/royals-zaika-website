import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

// Service-role client: bypasses ALL RLS policies — safe to use server-side only
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function handler(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Helper: fetch role using service-role client (bypasses RLS infinite recursion)
  async function getUserRole(userId: string): Promise<string> {
    const { data } = await getAdminClient()
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();
    return data?.role ?? "customer";
  }

  const { pathname } = request.nextUrl;

  // ── Add Cache-Control: no-store to ALL protected pages ────────────────
  // This prevents browsers from storing these pages in the Back-Forward
  // Cache (bfcache). Without this, pressing Back after logout restores a
  // cached version of the protected page without re-running auth checks.
  const protectedPrefixes = [
    "/admin", "/owner", "/delivery",
    "/profile", "/orders", "/cart", "/checkout",
    "/track", "/review",
  ];
  const isProtectedPage = protectedPrefixes.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (isProtectedPage) {
    supabaseResponse.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    );
    supabaseResponse.headers.set("Pragma", "no-cache");
    supabaseResponse.headers.set("Expires", "0");
  }

  // ── Protect admin routes ──────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (!user) return NextResponse.redirect(new URL("/auth/login", request.url));
    const role = await getUserRole(user.id);
    if (role !== "admin") return NextResponse.redirect(new URL("/", request.url));
  }

  // ── Protect owner routes ──────────────────────────────────────────────
  if (pathname.startsWith("/owner")) {
    if (!user) return NextResponse.redirect(new URL("/auth/login", request.url));
    const role = await getUserRole(user.id);
    if (!["restaurant_owner", "admin"].includes(role)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // ── Protect delivery routes ───────────────────────────────────────────
  if (pathname.startsWith("/delivery")) {
    if (!user) return NextResponse.redirect(new URL("/auth/login", request.url));
    const role = await getUserRole(user.id);
    if (!["delivery", "admin"].includes(role)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // ── Protect customer routes ───────────────────────────────────────────
  // /profile, /orders, /cart, /checkout, /track, /review
  const customerProtected = ["/profile", "/orders", "/cart", "/checkout", "/track", "/review"];
  if (customerProtected.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!user) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Redirect logged-in users away from login page → correct dashboard ─
  if (pathname.startsWith("/auth/login") && user) {
    const role = await getUserRole(user.id);
    if (role === "admin")            return NextResponse.redirect(new URL("/admin",    request.url));
    if (role === "restaurant_owner") return NextResponse.redirect(new URL("/owner",    request.url));
    if (role === "delivery")         return NextResponse.redirect(new URL("/delivery", request.url));
    return NextResponse.redirect(new URL("/menu", request.url));
  }

  return supabaseResponse;
}

export { handler as proxy };
export default handler;

export const config = {
  matcher: [
    // Staff dashboards
    "/admin/:path*",
    "/owner/:path*",
    "/delivery/:path*",
    // Customer protected pages
    "/profile/:path*",
    "/orders/:path*",
    "/cart/:path*",
    "/checkout/:path*",
    "/track/:path*",
    "/review/:path*",
    // Auth redirect
    "/auth/login",
  ],
};
