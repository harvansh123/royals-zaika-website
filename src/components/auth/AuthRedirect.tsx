"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

export function AuthRedirect() {
  const { user, loading } = useAuthStore();
  const router   = useRouter();
  const pathname = usePathname();
  // stays true while we are loading OR actively redirecting a staff user
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (pathname !== "/") return;
    if (loading) return;         // still fetching role — wait
    if (!user) return;           // not logged in — show homepage normally

    // Staff roles → redirect to their dashboard, keep overlay visible
    if (user.role === "restaurant_owner") { setRedirecting(true); router.replace("/owner");    return; }
    if (user.role === "admin")            { setRedirecting(true); router.replace("/admin");    return; }
    if (user.role === "delivery")         { setRedirecting(true); router.replace("/delivery"); return; }
    // customer → fall through, overlay hides, homepage shows
  }, [user, loading, pathname, router]);

  // Show full-screen overlay on "/" while auth is loading OR redirect is in progress.
  // Covers the homepage so it never flashes during the DB role fetch.
  if (pathname === "/" && (loading || redirecting)) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "var(--bg-primary, #09090b)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        {/* Spinner */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: "3px solid rgba(249,115,22,0.18)",
            borderTopColor: "#f97316",
            animation: "rz-spin 0.75s linear infinite",
          }}
        />
        {/* Branding */}
        <p
          style={{
            color: "#6b7280",
            fontSize: 13,
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: "0.02em",
          }}
        >
          Royals Zaika
        </p>
        <style>{`@keyframes rz-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return null;
}
