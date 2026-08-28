import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ── Read role purely from JWT metadata — ZERO DB calls ───────────────────────
// Supabase sets user_metadata.role during signUp (options.data.role).
// Google OAuth sets it in the callback. This is always present in the JWT
// so we never need a DB round-trip inside Edge middleware.
function getRoleFromUser(user: any): string {
  const meta = user?.user_metadata ?? {};
  const r = meta.role ?? meta.full_role ?? null;
  if (r === "restaurant_owner" || r === "admin" || r === "delivery" || r === "customer") return r;
  // Fallback: inspect email pattern for legacy customers
  if (user?.email?.endsWith("@royalzaika.customer")) return "customer";
  return "customer";
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

  // getUser() only validates the JWT — no external DB call, safe in Edge
  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // ── Redirect staff from '/' directly to their dashboard ──────────────────
  if (pathname === "/") {
    const viewPublic = request.nextUrl.searchParams.get("view") === "public";
    if (user && !viewPublic) {
      const role = getRoleFromUser(user);
      if (role === "restaurant_owner") return NextResponse.redirect(new URL("/owner",    request.url));
      if (role === "admin")            return NextResponse.redirect(new URL("/admin",    request.url));
      if (role === "delivery")         return NextResponse.redirect(new URL("/delivery", request.url));
    }
  }

  // ── Cache-Control: no-store on protected pages (bfcache fix) ─────────────
  const protectedPrefixes = [
    "/admin", "/owner", "/delivery",
    "/profile", "/orders", "/cart", "/checkout",
    "/track", "/review",
  ];
  const isProtectedPage = protectedPrefixes.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (isProtectedPage) {
    supabaseResponse.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    supabaseResponse.headers.set("Pragma", "no-cache");
    supabaseResponse.headers.set("Expires", "0");
  }

  // ── Protect admin routes ──────────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (!user) return NextResponse.redirect(new URL("/auth/login", request.url));
    const role = getRoleFromUser(user);
    if (role !== "admin") return NextResponse.redirect(new URL("/", request.url));
  }

  // ── Protect owner routes ──────────────────────────────────────────────────
  if (pathname.startsWith("/owner")) {
    if (!user) return NextResponse.redirect(new URL("/auth/login", request.url));
    const role = getRoleFromUser(user);
    if (!["restaurant_owner", "admin"].includes(role)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // ── Protect delivery routes ───────────────────────────────────────────────
  if (pathname.startsWith("/delivery")) {
    if (!user) return NextResponse.redirect(new URL("/auth/login", request.url));
    const role = getRoleFromUser(user);
    if (!["delivery", "admin"].includes(role)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // ── Protect customer routes ───────────────────────────────────────────────
  const customerProtected = ["/profile", "/orders", "/cart", "/checkout", "/track", "/review"];
  if (customerProtected.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!user) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Redirect already-logged-in users away from /auth/login ───────────────
  if (pathname.startsWith("/auth/login") && user) {
    const role = getRoleFromUser(user);
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
    "/",
    "/admin/:path*",
    "/owner/:path*",
    "/delivery/:path*",
    "/profile/:path*",
    "/orders/:path*",
    "/cart/:path*",
    "/checkout/:path*",
    "/track/:path*",
    "/review/:path*",
    "/auth/login",
  ],
};
