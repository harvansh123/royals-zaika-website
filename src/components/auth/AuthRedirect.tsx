"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

export function AuthRedirect() {
  const { user, loading } = useAuthStore();
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;
    if (loading) return; // wait for auth to resolve first

    // ── Logged-in special roles → send to their dashboards ──────────
    if (user) {
      if (user.role === "restaurant_owner") { router.push("/owner");    return; }
      if (user.role === "admin")            { router.push("/admin");    return; }
      if (user.role === "delivery")         { router.push("/delivery"); return; }
      // customers → fall through to QR check below
    }

    // ── QR detection via referrer ─────────────────────────────────────
    // QR scan from phone camera has no HTTP referrer.
    // Internal navigation (back button, clicking logo) has site referrer.
    // → If no internal referrer: send to /menu (QR flow).
    // → If internal referrer exists: show home page normally.
    const referrer     = document.referrer;
    const siteOrigin   = window.location.origin;
    const isInternal   = referrer.startsWith(siteOrigin);

    if (!isInternal) {
      router.push("/menu");
    }
  }, [user, loading, pathname, router]);

  return null;
}
