import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ── Read role from JWT metadata ONLY — ZERO DB calls ─────────────────────────
// Role is stored in user_metadata during signUp (options.data.role).
// JWT validation via supabase.auth.getUser() is the only async call needed.
function getRoleFromUser(user: any): string {
  const meta = user?.user_metadata ?? {};
  const r = meta.role ?? meta.full_role ?? null;
  if (r === "restaurant_owner" || r === "admin" || r === "delivery" || r === "customer") return r;
  return "customer";
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

  // Validate JWT — no external DB call, safe for Edge runtime
  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // ── Redirect staff from '/' to their dashboard ───────────────────────────
  if (pathname === "/") {
    const viewPublic = request.nextUrl.searchParams.get("view") === "public";
    if (user && !viewPublic) {
      const role = getRoleFromUser(user);
      if (role === "restaurant_owner") return NextResponse.redirect(new URL("/owner",    request.url));
      if (role === "admin")            return NextResponse.redirect(new URL("/admin",    request.url));
      if (role === "delivery")         return NextResponse.redirect(new URL("/delivery", request.url));
    }
  }

  // ── Set no-cache headers on protected pages (prevents bfcache issues) ─────
  const protectedPrefixes = ["/admin", "/owner", "/delivery", "/profile", "/orders", "/cart", "/checkout", "/track", "/review"];
  if (protectedPrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    supabaseResponse.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    supabaseResponse.headers.set("Pragma", "no-cache");
    supabaseResponse.headers.set("Expires", "0");
  }

  // ── Protect /admin ────────────────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (!user) return NextResponse.redirect(new URL("/auth/login", request.url));
    if (getRoleFromUser(user) !== "admin") return NextResponse.redirect(new URL("/", request.url));
  }

  // ── Protect /owner ────────────────────────────────────────────────────────
  if (pathname.startsWith("/owner")) {
    if (!user) return NextResponse.redirect(new URL("/auth/login", request.url));
    if (!["restaurant_owner", "admin"].includes(getRoleFromUser(user))) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // ── Protect /delivery ─────────────────────────────────────────────────────
  if (pathname.startsWith("/delivery")) {
    if (!user) return NextResponse.redirect(new URL("/auth/login", request.url));
    if (!["delivery", "admin"].includes(getRoleFromUser(user))) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // ── Protect customer pages ────────────────────────────────────────────────
  const customerRoutes = ["/profile", "/orders", "/cart", "/checkout", "/track", "/review"];
  if (customerRoutes.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!user) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Redirect logged-in users away from /auth/login ────────────────────────
  if (pathname.startsWith("/auth/login") && user) {
    const role = getRoleFromUser(user);
    if (role === "admin")            return NextResponse.redirect(new URL("/admin",    request.url));
    if (role === "restaurant_owner") return NextResponse.redirect(new URL("/owner",    request.url));
    if (role === "delivery")         return NextResponse.redirect(new URL("/delivery", request.url));
    return NextResponse.redirect(new URL("/menu", request.url));
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
