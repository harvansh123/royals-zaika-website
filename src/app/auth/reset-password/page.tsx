"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff, CheckCircle, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

function ResetPasswordContent() {
  const router  = useRouter();
  const params  = useSearchParams();
  const token   = params.get("token") ?? "";

  const [newPass,     setNewPass]     = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [success,     setSuccess]     = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg-primary)" }}>
        <div className="text-center space-y-4">
          <p className="text-4xl">❌</p>
          <h2 className="text-xl font-black" style={{ color: "var(--text-primary)" }}>Invalid Link</h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Yeh reset link invalid hai. Phir se Forgot Password use karein.
          </p>
          <Link href="/auth/forgot-password"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white gradient-brand">
            Try Again
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit() {
    if (newPass.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (newPass !== confirmPass) { toast.error("Passwords do not match"); return; }

    setLoading(true);
    try {
      const res  = await fetch("/api/auth/reset-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, newPassword: newPass }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to reset password"); return; }
      setSuccess(true);
      setTimeout(() => router.push("/auth/login"), 3000);
    } catch { toast.error("Network error. Please try again."); }
    finally   { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "var(--bg-primary)" }}>
      <div className="w-full max-w-md">
        <Link href="/auth/login" className="inline-flex items-center gap-2 text-sm mb-8 hover:opacity-80"
          style={{ color: "var(--text-muted)" }}>
          <ArrowLeft size={16} /> Back to Login
        </Link>

        <div className="rounded-2xl p-7 shadow-xl"
          style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>

          {success ? (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <h2 className="text-xl font-black" style={{ color: "var(--text-primary)" }}>Password Updated! 🎉</h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Aapka password successfully reset ho gaya. Ab aap naye password se login kar sakte hain.
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Login page par redirect ho raha hai...</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-7">
                <div className="w-14 h-14 gradient-brand rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">🔑</div>
                <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>Set New Password</h1>
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                  Apna naya password enter karein
                </p>
              </div>

              <div className="space-y-4">
                {/* New Password */}
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-orange-400" />
                  <input
                    type={showNew ? "text" : "password"}
                    placeholder="New Password (min. 6 characters)"
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    className="w-full pl-10 pr-11 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30"
                    style={{ background: "var(--input-bg)", border: "1.5px solid var(--border)", color: "var(--text-primary)" }}
                  />
                  <button type="button" onClick={() => setShowNew(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Confirm Password */}
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-orange-400" />
                  <input
                    type={showConfirm ? "text" : "password"}
                    placeholder="Confirm New Password"
                    value={confirmPass}
                    onChange={e => setConfirmPass(e.target.value)}
                    className="w-full pl-10 pr-11 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30"
                    style={{ background: "var(--input-bg)", border: "1.5px solid var(--border)", color: "var(--text-primary)" }}
                    onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Strength hint */}
                {newPass.length > 0 && (
                  <p className={`text-xs ${newPass.length >= 6 ? "text-green-500" : "text-orange-400"}`}>
                    {newPass.length >= 8 ? "✅ Strong password" : newPass.length >= 6 ? "⚠️ Acceptable (6+ chars)" : "❌ Too short (min 6)"}
                  </p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={loading || newPass.length < 6 || newPass !== confirmPass}
                  className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 gradient-brand hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <><Lock size={16} /> Reset Password</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <Loader2 size={32} className="animate-spin text-orange-500" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
