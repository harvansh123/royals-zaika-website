"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

export function AuthRedirect() {
  const { user, loading } = useAuthStore();
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/" || loading || !user) return;

    // Logged-in special roles → their dashboards
    if (user.role === "restaurant_owner") { router.push("/owner");    return; }
    if (user.role === "admin")            { router.push("/admin");    return; }
    if (user.role === "delivery")         { router.push("/delivery"); return; }
  }, [user, loading, pathname, router]);

  return null;
}
