"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

export function AuthRedirect() {
  const { user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Only redirect if they are exactly on the home page (/)
    if (pathname === "/" && user) {
      if (user.role === "restaurant_owner") {
        router.push("/owner");
      } else if (user.role === "admin") {
        router.push("/admin");
      } else if (user.role === "delivery") {
        router.push("/delivery");
      }
    }
  }, [user, pathname, router]);

  return null;
}
