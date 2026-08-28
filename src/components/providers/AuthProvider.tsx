"use client";
import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import type { Session } from "@supabase/supabase-js";
import type { User } from "@/lib/database.types";
import { trackUserRole, clearUserRole } from "@/lib/gtag";

// Safely parse role from user_metadata (set during signUp options.data)
function roleFromMetadata(metadata: Record<string, any>): string | null {
  const r = metadata?.role ?? metadata?.full_role ?? null;
  // Accept the raw values stored during signUp
  if (r === "restaurant_owner" || r === "delivery" || r === "admin" || r === "customer") return r;
  return null;
}

// Build a guaranteed user from session data (fallback if DB fails)
// IMPORTANT: reads role from metadata — never hardsodes "customer"
function buildFallbackUser(session: Session): User {
  const au = session.user;
  const metaRole = roleFromMetadata(au.user_metadata ?? {});
  return {
    id:            au.id,
    email:         au.email ?? "",
    name:          au.user_metadata?.full_name
                   ?? au.user_metadata?.name
                   ?? au.email?.split("@")[0]
                   ?? "User",
    phone:         au.phone ?? null,
    avatar_url:    au.user_metadata?.avatar_url ?? null,
    role:          (metaRole ?? "customer") as User["role"],
    is_active:     true,
    referral_code: null,
    created_at:    au.created_at ?? new Date().toISOString(),
    updated_at:    new Date().toISOString(),
  };
}

/**
 * PERFORMANCE: cache the last resolved user profile by user ID.
 * This avoids re-fetching /api/auth/role on every TOKEN_REFRESHED event
 * (which Supabase fires every ~hour). The cache is invalidated when the
 * user ID changes (different user signs in) or on sign-out.
 */
const profileCache = new Map<string, { user: User; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Try to fetch/create DB profile via server-side API (bypasses RLS infinite recursion).
// Falls back to session metadata if API is unavailable.
async function resolveUser(session: Session): Promise<User> {
  const userId = session.user.id;

  // Return cached profile if it's still fresh
  const cached = profileCache.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.user;
  }

  try {
    // Send Bearer token so the API works immediately on fresh login
    // (Vercel edge cookies may not propagate instantly after signInWithPassword)
    const token = session.access_token;
    const res = await fetch("/api/auth/role", {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.ok) {
      const { profile } = await res.json();
      if (profile) {
        profileCache.set(userId, { user: profile as User, ts: Date.now() });
        return profile as User;
      }
    }
  } catch {
    // Network error — fall through to metadata fallback
  }

  const fallback = buildFallbackUser(session);
  profileCache.set(userId, { user: fallback, ts: Date.now() });
  return fallback;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore();
  // Track whether the component is still mounted to avoid stale state updates
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    // ── Safety timeout: if nothing responds in 2 s, stop loading ──────
    const safetyTimer = setTimeout(() => {
      if (!cancelledRef.current) setLoading(false);
    }, 2000);

    // ── Initial session check ──────────────────────────────────────────
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (cancelledRef.current) return;
        if (session) {
          const user = await resolveUser(session);
          if (!cancelledRef.current) {
            setUser(user);
            clearUserRole();                          // always clear stale role first
            trackUserRole(user.role as any);          // GA4: set correct role from DB
          }
        } else {
          if (!cancelledRef.current) setUser(null);
        }
      })
      .catch(() => {
        if (!cancelledRef.current) setUser(null);
      })
      .finally(() => {
        clearTimeout(safetyTimer);
        if (!cancelledRef.current) setLoading(false);
      });

    // ── Realtime auth state changes ────────────────────────────────────
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelledRef.current) return;

      // On sign-out, clear profile cache for the departing user
      if (event === "SIGNED_OUT") {
        profileCache.clear();
        if (!cancelledRef.current) setUser(null);
        if (!cancelledRef.current) clearUserRole();       // GA4: clear role on logout
        if (!cancelledRef.current) setLoading(false);
        return;
      }

      if (session) {
        const user = await resolveUser(session);
        if (!cancelledRef.current) {
          setUser(user);
          clearUserRole();                          // always clear stale role first
          trackUserRole(user.role as any);          // GA4: update role on auth state change
        }
      } else {
        if (!cancelledRef.current) setUser(null);
      }
      if (!cancelledRef.current) setLoading(false);
    });

    // ── bfcache safety net ─────────────────────────────────────────────
    // When the browser restores a page from Back-Forward Cache (bfcache),
    // React effects do NOT re-run. This pageshow listener fires on every
    // bfcache restore. If the session is gone (user logged out in another
    // tab, or this page was cached before logout), redirect to login.
    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return; // not a bfcache restore, skip
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          window.location.replace("/auth/login");
        }
      });
    };
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      cancelledRef.current = true;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [setUser, setLoading]);

  return <>{children}</>;
}
