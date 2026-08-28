import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ── Read role from JWT user_metadata — no DB call ─────────────────────────────
// Falls back gracefully for users who registered before role-metadata was added.
function getRoleFromJWT(user: any): string | null {
  const meta = user?.user_metadata ?? {};
  const r = meta.role ?? meta.full_role ?? null;
  if (r === "restaurant_owner" || r === "admin" || r === "delivery" || r === "customer") return r;
  return null; // null = unknown, let the page handle it
}

export async function middleware(request: NextRequest) {
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

  // ── getSession() reads JWT from cookie locally — ZERO network calls ──────────
  // Unlike getUser(), getSession() does NOT call Supabase Auth server.
  // This is safe for Edge middleware (avoids 504 MIDDLEWARE_INVOCATION_TIMEOUT).
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  const { pathname } = request.nextUrl;

  // ── Unauthenticated → redirect to login ──────────────────────────────────────
  const authRequired = [
    "/admin", "/owner", "/delivery",
    "/profile", "/orders", "/cart", "/checkout", "/track", "/review",
  ];
  const needsAuth = authRequired.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (needsAuth && !user) {
    const loginUrl = new URL("/auth/login", request.url);
    if (!pathname.startsWith("/admin") && !pathname.startsWith("/owner") && !pathname.startsWith("/delivery")) {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // ── /admin and /owner and /delivery role guard ────────────────────────────────
  // Only enforce role if it IS known from JWT metadata.
  // If metadata is missing (old user), let the page itself handle it —
  // avoids wrongly redirecting existing owners/riders to homepage.
  if (user && pathname.startsWith("/admin")) {
    const role = getRoleFromJWT(user);
    if (role !== null && role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }
  if (user && pathname.startsWith("/owner")) {
    const role = getRoleFromJWT(user);
    if (role !== null && !["restaurant_owner", "admin"].includes(role)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }
  if (user && pathname.startsWith("/delivery")) {
    const role = getRoleFromJWT(user);
    if (role !== null && !["delivery", "admin"].includes(role)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // ── Cache-Control: no-store on protected pages ───────────────────────────────
  if (needsAuth) {
    supabaseResponse.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    supabaseResponse.headers.set("Pragma", "no-cache");
    supabaseResponse.headers.set("Expires", "0");
  }

  // ── Redirect already-logged-in users away from /auth/login ───────────────────
  if (pathname.startsWith("/auth/login") && user) {
    const role = getRoleFromJWT(user);
    // If role is known from JWT → direct to dashboard
    if (role === "admin")            return NextResponse.redirect(new URL("/admin",    request.url));
    if (role === "restaurant_owner") return NextResponse.redirect(new URL("/owner",    request.url));
    if (role === "delivery")         return NextResponse.redirect(new URL("/delivery", request.url));
    // Unknown role or customer → go to menu
    return NextResponse.redirect(new URL("/menu", request.url));
  }

  // ── Redirect staff from '/' to their dashboard ───────────────────────────────
  if (pathname === "/") {
    const viewPublic = request.nextUrl.searchParams.get("view") === "public";
    if (user && !viewPublic) {
      const role = getRoleFromJWT(user);
      if (role === "restaurant_owner") return NextResponse.redirect(new URL("/owner",    request.url));
      if (role === "admin")            return NextResponse.redirect(new URL("/admin",    request.url));
      if (role === "delivery")         return NextResponse.redirect(new URL("/delivery", request.url));
    }
  }

  return supabaseResponse;
}

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
