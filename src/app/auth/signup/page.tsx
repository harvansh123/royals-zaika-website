"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Mail, Phone, Eye, EyeOff, ArrowRight, User } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { validateIndianPhone, normalizePhone } from "@/lib/utils";

export default function SignUpPage() {
  const router  = useRouter();
  const [form, setForm] = useState({
    name: "", email: "", phone: "", password: "", confirmPassword: "",
  });
  const [showPass, setShowPass]       = useState(false);
  const [showConfPass, setShowConfPass] = useState(false);
  const [loading, setLoading]         = useState(false);

  const update = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function handleGoogleSignup() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?role=customer` },
    });
    if (error) { toast.error(error.message); setLoading(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim())  { toast.error("Full name is required"); return; }
    if (!form.email.trim()) { toast.error("Email address is required"); return; }
    if (!form.phone.trim()) { toast.error("Mobile number is required"); return; }
    if (!validateIndianPhone(form.phone)) {
      toast.error("Enter a valid 10-digit Indian mobile number (starting with 6–9)");
      return;
    }
    if (form.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (form.password !== form.confirmPassword) { toast.error("Passwords do not match"); return; }

    setLoading(true);
    try {
      const cleanPhone = normalizePhone(form.phone);

      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: { full_name: form.name.trim(), phone: cleanPhone, role: "customer" },
        },
      });
      if (error) throw error;

      // Persist phone in users table via service-role API
      if (data.user?.id) {
        const res = await fetch("/api/auth/store-phone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: data.user.id, phone: cleanPhone }),
        });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error ?? "Account created but mobile number could not be saved — update it from Profile.");
          router.push("/auth/login");
          return;
        }
      }

      toast.success("Account created! You can now sign in 🎉");
      router.push("/auth/login");
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16" style={{ background: "var(--bg-primary)" }}>
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-orange-500/8 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-2">
            <div className="w-16 h-16 gradient-brand rounded-2xl flex items-center justify-center text-3xl shadow-brand">
              🍱
            </div>
            <p className="font-bold text-xl text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>Chaurasia Ji</p>
          </Link>
          <h1 className="font-bold text-2xl text-white mt-4 mb-1">Create Account</h1>
          <p className="text-gray-500 text-sm">Join us and order your favourite food</p>
        </div>

        <div className="rounded-3xl p-6" style={{ background: "var(--bg-glass)", border: "1px solid var(--border)", backdropFilter: "blur(12px)" }}>

          {/* Google */}
          <button onClick={handleGoogleSignup} disabled={loading}
            className="w-full flex items-center justify-center gap-3 font-medium py-3 rounded-xl transition-all mb-5 disabled:opacity-50"
            style={{ background: "var(--bg-glass)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
              <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
              <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
              <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span className="text-xs text-gray-500">or sign up with email</span>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div className="relative">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="text" value={form.name} onChange={(e) => update("name", e.target.value)}
                placeholder="Full Name" required className="input-field pl-11" />
            </div>

            {/* Email */}
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)}
                placeholder="Email Address" required className="input-field pl-11" />
            </div>

            {/* Mobile Number */}
            <div className="relative">
              <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)}
                placeholder="Mobile Number (e.g. 9876543210)" required maxLength={13}
                className="input-field pl-11" />
              {form.phone && !validateIndianPhone(form.phone) && (
                <p className="text-xs text-red-400 mt-1 ml-1">Enter a valid 10-digit Indian mobile number</p>
              )}
            </div>

            {/* Password */}
            <div className="relative">
              <input type={showPass ? "text" : "password"} value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="Password (min. 6 characters)" required minLength={6} className="input-field pr-11" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Confirm Password */}
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
