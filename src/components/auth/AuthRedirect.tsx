"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

export function AuthRedirect() {
  const { user, loading } = useAuthStore();
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/" || loading) return;

    // 1. Logged-in special roles → their dashboards
    if (user) {
      if (user.role === "restaurant_owner") { router.push("/owner");    return; }
      if (user.role === "admin")            { router.push("/admin");    return; }
      if (user.role === "delivery")         { router.push("/delivery"); return; }
      // logged-in customer → fall through to QR check
    }

    // 2. QR detection via HTTP Referer
    //    QR scan (phone camera) → referrer is empty or external
    //    Internal nav (back button, logo click) → referrer = this site
    //    → no internal referrer = QR/cold open = redirect to /menu
    const isInternalNav = document.referrer.startsWith(window.location.origin);
    if (!isInternalNav) {
      router.replace("/menu");   // replace (not push) — back button won't loop back to /
    }
  }, [user, loading, pathname, router]);

  return null;
}
