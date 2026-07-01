"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import type { Session } from "@supabase/supabase-js";
import type { User } from "@/lib/database.types";

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
    id:         au.id,
    email:      au.email ?? "",
    name:       au.user_metadata?.full_name
                ?? au.user_metadata?.name
                ?? au.email?.split("@")[0]
                ?? "User",
    phone:      au.phone ?? null,
    avatar_url: au.user_metadata?.avatar_url ?? null,
    role:       (metaRole ?? "customer") as User["role"],
    is_active:  true,
    created_at: au.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// Try to fetch/create DB profile via server-side API (bypasses RLS infinite recursion).
// Falls back to session metadata if API is unavailable.
async function resolveUser(session: Session): Promise<User> {
  const au = session.user;

  try {
    const res = await fetch("/api/auth/role", { credentials: "include" });
    if (res.ok) {
      const { profile } = await res.json();
      if (profile) return profile as User;
    }
  } catch {
    // Network error — fall through to metadata fallback
  }

  return buildFallbackUser(session);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    // ── Safety timeout: if nothing responds in 5 s, stop loading ──────
    const safetyTimer = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 5000);

    // ── Initial session check ──────────────────────────────────────────
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (cancelled) return;
        if (session) {
          const user = await resolveUser(session);
          if (!cancelled) setUser(user);
        } else {
          if (!cancelled) setUser(null);
        }
      })
      .catch(() => {
        // Supabase unreachable — still stop loading
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        clearTimeout(safetyTimer);
        if (!cancelled) setLoading(false);
      });

    // ── Realtime auth state changes ────────────────────────────────────
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;
      if (session) {
        const user = await resolveUser(session);
        if (!cancelled) setUser(user);
      } else {
        if (!cancelled) setUser(null);
      }
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [setUser, setLoading]);

  return <>{children}</>;
}
