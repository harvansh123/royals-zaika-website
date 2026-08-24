"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Phone, Eye, EyeOff, ArrowRight, User, Gift } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { validateIndianPhone, normalizePhone } from "@/lib/utils";

function SignUpContent() {
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const [form, setForm] = useState({
    name: "", phone: "", password: "", confirmPassword: "", referralCode: "",
  });
  const [showPass, setShowPass]           = useState(false);
  const [showConfPass, setShowConfPass]   = useState(false);
  const [showReferral, setShowReferral]   = useState(false);
  const [loading, setLoading]             = useState(false);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) { setForm((p) => ({ ...p, referralCode: ref.toUpperCase() })); setShowReferral(true); }
  }, [searchParams]);

  const update = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim())  { toast.error("Full name is required"); return; }
    if (!form.phone.trim()) { toast.error("Mobile number is required"); return; }
    if (!validateIndianPhone(form.phone)) {
      toast.error("Enter a valid 10-digit Indian mobile number (starting with 6-9)");
      return;
    }
    if (form.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (form.password !== form.confirmPassword) { toast.error("Passwords do not match"); return; }

    setLoading(true);
    try {
      const cleanPhone = normalizePhone(form.phone);
      const autoEmail = `${cleanPhone.replace("+", "")}@royalzaika.customer`;

      const { data, error } = await supabase.auth.signUp({
        email: autoEmail,
        password: form.password,
        options: {
          data: { full_name: form.name.trim(), phone: cleanPhone, role: "customer" },
        },
      });
      if (error) throw error;

      if (data.user?.id) {
        const res = await fetch("/api/auth/store-phone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId:       data.user.id,
            phone:        cleanPhone,
            referralCode: form.referralCode.trim().toUpperCase() || null,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error ?? "Account created but mobile number could not be saved.");
          router.push("/auth/login");
          return;
        }
      }

      toast.success("Account created! You can now sign in");
      router.push("/auth/login");
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16" style={{ background: "var(--bg-primary)" }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-orange-500/8 rounded-full blur-[120px]" />
      </div>
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-2">
            <div className="w-16 h-16 gradient-brand rounded-2xl flex items-center justify-center text-3xl shadow-brand">
              🍱
            </div>
            <p className="font-bold text-xl text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>Royals Zaika</p>
          </Link>
          <h1 className="font-bold text-2xl text-white mt-4 mb-1">Create Account</h1>
          <p className="text-gray-500 text-sm">Join us and order your favourite food</p>
        </div>
        <div className="rounded-3xl p-6" style={{ background: "var(--bg-glass)", border: "1px solid var(--border)", backdropFilter: "blur(12px)" }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="text" value={form.name} onChange={(e) => update("name", e.target.value)}
                placeholder="Full Name" required className="input-field pl-11" />
            </div>
            <div className="relative">
              <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)}
                placeholder="Mobile Number (e.g. 9876543210)" required maxLength={13} className="input-field pl-11" />
              {form.phone && !validateIndianPhone(form.phone) && (
                <p className="text-xs text-red-400 mt-1 ml-1">Enter a valid 10-digit Indian mobile number</p>
              )}
            </div>
            <div className="relative">
              <input type={showPass ? "text" : "password"} value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="Password (min. 6 characters)" required minLength={6} className="input-field pr-11" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="relative">
              <input type={showConfPass ? "text" : "password"} value={form.confirmPassword}
                onChange={(e) => update("confirmPassword", e.target.value)}
                placeholder="Confirm Password" required minLength={6} className="input-field pr-11" />
              <button type="button" onClick={() => setShowConfPass(!showConfPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                {showConfPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="text-xs text-red-400 mt-1 ml-1">Passwords do not match</p>
              )}
            </div>
            <div>
              <button type="button" onClick={() => setShowReferral(!showReferral)}
                className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 mb-2">
                <Gift size={12} /> {showReferral ? "Hide" : "Have a referral code? Click here"}
              </button>
              {showReferral && (
                <div className="relative">
                  <Gift size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400" />
                  <input type="text" value={form.referralCode}
                    onChange={(e) => update("referralCode", e.target.value.toUpperCase())}
                    placeholder="Referral Code (e.g. ZAIKAB3F2X)"
                    maxLength={11} className="input-field pl-11 tracking-widest font-mono text-sm" />
                </div>
              )}
            </div>
            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3">
              {loading ? "Creating account..." : <><ArrowRight size={16} /> Create Account</>}
            </button>
          </form>
        </div>
        <p className="text-center text-sm text-gray-500 mt-5">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-orange-400 font-medium hover:text-orange-300">Sign In</Link>
        </p>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SignUpContent />
    </Suspense>
  );
}
