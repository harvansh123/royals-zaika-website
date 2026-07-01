"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Mail, Eye, EyeOff, ArrowRight, ChefHat, ShoppingBag } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

type Role = "customer" | "owner" | "rider";
type Mode = "login" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const [role, setRole]         = useState<Role | null>(null);
  const [mode, setMode]         = useState<Mode>("login");
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm]         = useState({ name: "", email: "", password: "" });

  function update(key: string, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleGoogleLogin() {
    setLoading(true);
    const targetRole = role === "owner" ? "restaurant_owner" : role === "rider" ? "delivery" : "customer";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?role=${targetRole}` },
    });
    if (error) { toast.error(error.message); setLoading(false); }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { data: { full_name: form.name, role: role === "owner" ? "restaurant_owner" : role === "rider" ? "delivery" : "customer" } },
        });
        if (error) throw error;
        toast.success("Account created! Check your email to confirm.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email, password: form.password,
        });
        if (error) throw error;
        // Fetch role via server-side API (bypasses RLS infinite recursion)
        toast.success("Welcome back! 👋");
        try {
          const res = await fetch("/api/auth/role", { credentials: "include" });
          if (res.ok) {
            const { profile } = await res.json();
            const userRole = profile?.role;
            if (userRole === "admin")            { router.push("/admin");    router.refresh(); return; }
            if (userRole === "restaurant_owner") { router.push("/owner");    router.refresh(); return; }
            if (userRole === "delivery")         { router.push("/delivery"); router.refresh(); return; }
          }
        } catch { /* fall through */ }
        router.push("/menu");
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 1: Role Selection ──────────────────────────────────────────
  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "var(--bg-primary)" }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/8 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-red-500/6 rounded-full blur-[100px]" />
        </div>

        <div className="relative w-full max-w-md text-center">
          {/* Logo */}
          <div className="w-20 h-20 gradient-brand rounded-3xl flex items-center justify-center text-4xl mx-auto mb-6 shadow-brand">
            🍱
          </div>
          <h1 className="font-bold text-3xl mb-2" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-primary)" }}>
            Chaurasia Ji
          </h1>
          <p className="mb-10" style={{ color: "var(--text-secondary)" }}>Authentic Indian Cuisine — Who are you?</p>

          <div className="grid grid-cols-2 gap-4">
            {/* Customer Card */}
            <button
              onClick={() => setRole("customer")}
              className="group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "var(--bg-glass)", border: "1px solid var(--border)" }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(249,115,22,0.04)" }} />
              <div className="w-12 h-12 bg-orange-500/15 rounded-2xl flex items-center justify-center mb-4">
                <ShoppingBag size={24} className="text-orange-500" />
              </div>
              <p className="font-bold text-lg mb-1" style={{ color: "var(--text-primary)" }}>I'm a Customer</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Order food online</p>
              <div className="absolute bottom-4 right-4 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all" style={{ background: "#f97316" }}>
                <ArrowRight size={12} className="text-white" />
              </div>
            </button>

            {/* Owner Card */}
            <button
              onClick={() => setRole("owner")}
              className="group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "var(--bg-glass)", border: "1px solid var(--border)" }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(249,115,22,0.04)" }} />
              <div className="w-12 h-12 bg-orange-500/15 rounded-2xl flex items-center justify-center mb-4">
                <ChefHat size={24} className="text-orange-500" />
              </div>
              <p className="font-bold text-lg mb-1" style={{ color: "var(--text-primary)" }}>Restaurant Owner</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Manage your restaurant</p>
              <div className="absolute bottom-4 right-4 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all" style={{ background: "#f97316" }}>
                <ArrowRight size={12} className="text-white" />
              </div>
            </button>
          </div>

          {/* Rider Card — full width below */}
          <button
            onClick={() => setRole("rider")}
            className="group relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] flex items-center gap-4 mt-1"
            style={{ background: "var(--bg-glass)", border: "1px solid var(--border)" }}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(249,115,22,0.04)" }} />
            <div className="w-12 h-12 bg-blue-500/15 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl">🛵</div>
            <div>
              <p className="font-bold text-lg mb-0.5" style={{ color: "var(--text-primary)" }}>Delivery Partner</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Pick up & deliver orders</p>
            </div>
            <div className="ml-auto w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all" style={{ background: "#f97316" }}>
              <ArrowRight size={12} className="text-white" />
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Auth Form ───────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "var(--bg-primary)" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-orange-500/8 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Back + Logo */}
        <div className="text-center mb-8">
          <button onClick={() => setRole(null)} className="text-sm mb-6 flex items-center gap-1 mx-auto transition-colors" style={{ color: "var(--text-secondary)" }}>
            ← Back
          </button>
          <div className="w-16 h-16 gradient-brand rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-brand">
            {role === "owner" ? "👨‍🍳" : role === "rider" ? "🛵" : "🍱"}
          </div>
          <h1 className="font-bold text-2xl" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-primary)" }}>
            {role === "owner" ? "Restaurant Owner Login" : role === "rider" ? "Delivery Partner Login" : "Welcome Back!"}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {role === "owner" ? "Manage your menu & orders" : role === "rider" ? "View & update your deliveries" : "Sign in to place your order"}
          </p>
        </div>

        <div className="rounded-3xl p-7" style={{ background: "var(--bg-glass)", border: "1px solid var(--border)", backdropFilter: "blur(12px)" }}>
          {/* Mode Tabs — customers get signup/login; owners & riders get login only */}
          {role === "customer" && (
            <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: "var(--bg-glass)" }}>
              {(["login", "signup"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize",
                    mode === m ? "text-white shadow" : ""
                  )}
                  style={mode === m ? { background: "linear-gradient(135deg,#f97316,#dc2626)" } : { color: "var(--text-secondary)" }}
                >
                  {m === "login" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>
          )}

          {/* Google Login — customers only */}
          {role === "customer" && (
            <>
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 font-medium py-3 rounded-xl transition-all mb-5 disabled:opacity-50"
                style={{ background: "var(--bg-glass)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              >
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
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>or</span>
                <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              </div>
            </>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === "signup" && (
              <input type="text" value={form.name} onChange={(e) => update("name", e.target.value)}
                placeholder="Full Name" required className="input-field" />
            )}
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)}
                placeholder="Email Address" required className="input-field pl-11" />
            </div>
            <div className="relative">
              <input type={showPass ? "text" : "password"} value={form.password} onChange={(e) => update("password", e.target.value)}
                placeholder="Password" required minLength={6} className="input-field pr-11" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          {role === "customer" && (
            <p className="text-center text-sm mt-5" style={{ color: "var(--text-secondary)" }}>
              {mode === "login" ? "New here? " : "Already have an account? "}
              <button onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="text-orange-500 font-medium hover:underline">
                {mode === "login" ? "Create Account" : "Sign In"}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
