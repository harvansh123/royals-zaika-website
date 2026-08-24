"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Phone, Mail, Lock, ArrowLeft, ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

type Step = "phone" | "method" | "email-input" | "pin-input" | "email-sent";

function ForgotPasswordContent() {
  const router = useRouter();
  const params = useSearchParams();
  const roleParam = params.get("role") ?? "customer";

  const [step, setStep]       = useState<Step>("phone");
  const [phone, setPhone]     = useState("");
  const [method, setMethod]   = useState<"email" | "pin" | null>(null);
  const [emailVal, setEmailVal] = useState("");
  const [pin, setPin]         = useState("");
  const [loading, setLoading] = useState(false);

  const roleLabel = roleParam === "owner" ? "Owner" : roleParam === "rider" ? "Rider" : "Customer";
  const loginHref = `/auth/login`;

  async function handlePhoneNext() {
    const digits = phone.replace(/[\s\-().]/g, "").replace(/^(\+91|0091|0)/, "");
    if (!/^[6-9]\d{9}$/.test(digits)) {
      toast.error("Enter a valid 10-digit Indian mobile number");
      return;
    }
    setStep("method");
  }

  async function handleEmailSubmit() {
    if (!emailVal.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal.trim())) {
      toast.error("Enter a valid email address");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: phone, method: "email", value: emailVal.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Something went wrong"); return; }
      setStep("email-sent");
    } catch { toast.error("Network error. Please try again."); }
    finally { setLoading(false); }
  }

  async function handlePinSubmit() {
    if (!/^\d{4}$/.test(pin)) { toast.error("Enter a 4-digit PIN"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: phone, method: "pin", value: pin }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Incorrect PIN"); return; }
      // PIN correct → redirect to reset page with token
      router.push(`/auth/reset-password?token=${data.token}`);
    } catch { toast.error("Network error. Please try again."); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "var(--bg-primary)" }}>
      <div className="w-full max-w-md">
        {/* Back link */}
        <Link href={loginHref} className="inline-flex items-center gap-2 text-sm mb-8 hover:opacity-80 transition-opacity"
          style={{ color: "var(--text-muted)" }}>
          <ArrowLeft size={16} /> Back to Login
        </Link>

        <div className="rounded-2xl p-7 shadow-xl"
          style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>

          {/* Header */}
          <div className="text-center mb-7">
            <div className="w-14 h-14 gradient-brand rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">🔐</div>
            <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>Forgot Password?</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{roleLabel} Account Recovery</p>
          </div>

          {/* ── Step: Phone ─────────────────────────────────── */}
          {step === "phone" && (
            <div className="space-y-5">
              <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
                Apna registered mobile number enter karein
              </p>
              <div className="relative">
                <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-orange-400" />
                <input
                  type="tel" placeholder="10-digit mobile number" value={phone}
                  onChange={e => setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30"
                  style={{ background: "var(--input-bg)", border: "1.5px solid var(--border)", color: "var(--text-primary)" }}
                  onKeyDown={e => e.key === "Enter" && handlePhoneNext()}
                />
              </div>
              <button onClick={handlePhoneNext}
                className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 gradient-brand hover:opacity-90 transition-opacity">
                Continue <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* ── Step: Method Selection ───────────────────────── */}
          {step === "method" && (
            <div className="space-y-4">
              <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
                Recovery method choose karein
              </p>
              <button onClick={() => { setMethod("email"); setStep("email-input"); }}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all hover:border-orange-400"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Mail size={20} className="text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>📧 Verified Email</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {roleParam === "customer" ? "Linked recovery email pe reset link bhejein" : "Login email pe reset link bhejein"}
                  </p>
                </div>
              </button>
              <button onClick={() => { setMethod("pin"); setStep("pin-input"); }}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all hover:border-orange-400"
                style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <Lock size={20} className="text-green-600" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>🔢 Recovery PIN</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Profile mein set kiya hua 4-digit PIN use karein
                  </p>
                </div>
              </button>
              <button onClick={() => setStep("phone")} className="w-full text-sm text-center mt-2 hover:opacity-70 transition-opacity"
                style={{ color: "var(--text-muted)" }}>← Back</button>
            </div>
          )}

          {/* ── Step: Email Input ───────────────────────────── */}
          {step === "email-input" && (
            <div className="space-y-5">
              <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
                {roleParam === "customer"
                  ? "Apna linked recovery email enter karein"
                  : "Apna login email address enter karein"}
              </p>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400" />
                <input type="email" placeholder="you@example.com" value={emailVal}
                  onChange={e => setEmailVal(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30"
                  style={{ background: "var(--input-bg)", border: "1.5px solid var(--border)", color: "var(--text-primary)" }}
                  onKeyDown={e => e.key === "Enter" && handleEmailSubmit()}
                />
              </div>
              <button onClick={handleEmailSubmit} disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 gradient-brand hover:opacity-90 transition-opacity disabled:opacity-60">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <><Mail size={16} /> Send Reset Link</>}
              </button>
              <button onClick={() => setStep("method")} className="w-full text-sm text-center hover:opacity-70 transition-opacity"
                style={{ color: "var(--text-muted)" }}>← Back</button>
            </div>
          )}

          {/* ── Step: PIN Input ─────────────────────────────── */}
          {step === "pin-input" && (
            <div className="space-y-5">
              <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
                Apna 4-digit Recovery PIN enter karein
              </p>
              <input type="password" inputMode="numeric" maxLength={4} placeholder="• • • •"
                value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full text-center py-4 rounded-xl text-2xl font-black tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-orange-400/30"
                style={{ background: "var(--input-bg)", border: "1.5px solid var(--border)", color: "var(--text-primary)" }}
                onKeyDown={e => e.key === "Enter" && handlePinSubmit()}
              />
              <button onClick={handlePinSubmit} disabled={loading || pin.length !== 4}
                className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 gradient-brand hover:opacity-90 transition-opacity disabled:opacity-60">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <><Lock size={16} /> Verify PIN</>}
              </button>
              <button onClick={() => setStep("method")} className="w-full text-sm text-center hover:opacity-70 transition-opacity"
                style={{ color: "var(--text-muted)" }}>← Back</button>
            </div>
          )}

          {/* ── Step: Email Sent ────────────────────────────── */}
          {step === "email-sent" && (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-black mb-2" style={{ color: "var(--text-primary)" }}>Check Your Email!</h2>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Agar aapka account mila aur email match kiya, to reset link bhej diya gaya hai.
                  Link <strong>1 ghante</strong> mein expire ho jayega.
                </p>
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Email nahi mili? Spam/Junk folder check karein.
              </p>
              <Link href={loginHref}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white gradient-brand hover:opacity-90 transition-opacity">
                Back to Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <Loader2 size={32} className="animate-spin text-orange-500" />
      </div>
    }>
      <ForgotPasswordContent />
    </Suspense>
  );
}
