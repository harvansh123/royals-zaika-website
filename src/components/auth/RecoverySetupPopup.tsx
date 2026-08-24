"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/lib/supabase/client";
import { X, Shield, ArrowRight } from "lucide-react";
import Link from "next/link";

type Status = { hasPIN: boolean; hasRecoveryEmail: boolean; emailVerified: boolean } | null;

const SESSION_KEY = "rz_recovery_popup_dismissed";

export function RecoverySetupPopup() {
  const { user, loading } = useAuthStore();
  const [status,    setStatus]    = useState<Status>(null);
  const [visible,   setVisible]   = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    // Already dismissed this session
    if (sessionStorage.getItem(SESSION_KEY) === "true") return;

    async function check() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch("/api/auth/recovery-status", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const data: Status = await res.json();
        setStatus(data);
        // Show popup only if something is missing
        if (!data?.hasPIN || !data?.hasRecoveryEmail) {
          setVisible(true);
        }
      } catch { /* silent */ }
    }
    check();
  }, [user, loading]);

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, "true");
    setDismissed(true);
    setVisible(false);
  }

  if (!visible || dismissed || !status) return null;

  // Determine message
  const bothMissing   = !status.hasPIN && !status.hasRecoveryEmail;
  const onlyPINMissing  = status.hasRecoveryEmail && !status.hasPIN;
  const onlyEmailMissing = !status.hasRecoveryEmail && status.hasPIN;

  const message = bothMissing
    ? "Apne account ko secure rakhne ke liye apni email ID link & verify karein aur Recovery PIN bhi set kar lein. Isse aap future mein password easily reset kar sakenge. 🔐"
    : onlyPINMissing
    ? "Aapki email ID verified hai ✅. Account ko aur secure rakhne ke liye Recovery PIN bhi set kar lein."
    : "Aapka Recovery PIN set hai ✅. Account recovery ko aur secure banane ke liye apni email ID bhi link & verify kar lein.";

  const profileLink = "/profile?tab=security";

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:w-[360px] z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-2xl p-4 shadow-2xl"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center shrink-0 text-lg">🛡️</div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm mb-1" style={{ color: "var(--text-primary)" }}>
              Account Security Setup
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {message}
            </p>
            <div className="flex gap-2 mt-3">
              <Link href={profileLink} onClick={dismiss}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white gradient-brand hover:opacity-90 transition-opacity">
                Setup Now <ArrowRight size={12} />
              </Link>
              <button onClick={dismiss}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-70"
                style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
                Later
              </button>
            </div>
          </div>
          <button onClick={dismiss} className="shrink-0 mt-0.5 hover:opacity-70 transition-opacity"
            style={{ color: "var(--text-muted)" }}>
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
