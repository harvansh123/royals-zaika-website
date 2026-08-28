"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Mail, Phone, Eye, EyeOff, ArrowRight, ChefHat, ShoppingBag } from "lucide-react";
import toast from "react-hot-toast";
import { cn, validateIndianPhone, normalizePhone } from "@/lib/utils";

// Rejects after `ms` milliseconds — prevents infinite "Please wait..." hangs
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() =>
      reject(new Error(`${label} timed out. Please check your connection and try again.`)),
      ms
    );
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

type Role = "customer" | "owner" | "rider";
type Mode = "login" | "signup";

export default function AuthPage() {
  const [role, setRole]         = useState<Role | null>(null);
  const [mode, setMode]         = useState<Mode>("login");
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfPass, setShowConfPass] = useState(false);
  const [form, setForm] = useState({
    name: "", identifier: "", phone: "", password: "", confirmPassword: "",
  });

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
        // ── Signup validation ──────────────────────────────────────────
        if (!form.name.trim()) throw new Error("Full name is required");
        if (!form.phone.trim()) throw new Error("Mobile number is required");
        if (!validateIndianPhone(form.phone)) {
          throw new Error("Enter a valid 10-digit Indian mobile number (starting with 6–9)");
        }
        if (form.password.length < 6) throw new Error("Password must be at least 6 characters");
        if (form.password !== form.confirmPassword) throw new Error("Passwords do not match");

        const cleanPhone = normalizePhone(form.phone);
        // Auto-generate email from phone — customer doesn't need to enter email
        const autoEmail = `${cleanPhone.replace("+", "")}@royalzaika.customer`;

        const { data, error } = await supabase.auth.signUp({
          email: autoEmail,
          password: form.password,
          options: {
            data: {
              full_name: form.name.trim(),
              phone:     cleanPhone,
              role: role === "owner" ? "restaurant_owner" : role === "rider" ? "delivery" : "customer",
            },
          },
        });
        if (error) throw error;

        // Store phone via service-role API (bypasses RLS; also enforces uniqueness)
        if (data.user?.id) {
          const res = await fetch("/api/auth/store-phone", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: data.user.id, phone: cleanPhone }),
          });
          const json = await res.json();
          if (!res.ok) {
            toast.error(json.error ?? "Account created but mobile number could not be saved. Update it from Profile.");
            setMode("login");
            setLoading(false);
            return;
          }
        }

        toast.success("Account created! You can now sign in 🎉");
        setMode("login");

      } else {
        // ── Login ─────────────────────────────────────────────────────────
        const id = form.identifier.trim();
        let emailToUse = id;

        if (!id.includes("@")) {
          // Treat as mobile number → look up email
          if (!validateIndianPhone(id)) {
            throw new Error("Enter a valid email address or 10-digit mobile number");
          }
          // withTimeout prevents an infinite hang if the API is unreachable
          const res = await withTimeout(
            fetch("/api/auth/phone-lookup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ phone: id }),
            }),
            12000,
            "Phone lookup"
          );
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "No account found with this mobile number");
          emailToUse = json.email;
        }

        // withTimeout ensures signInWithPassword never hangs forever.
        // Without this, a slow Supabase Auth response leaves the button
        // permanently stuck on "Please wait..."
        const { error } = await withTimeout(
          supabase.auth.signInWithPassword({ email: emailToUse, password: form.password }),
          12000,
          "Sign in"
        );
        if (error) throw error;

        toast.success("Welcome back! 👋");

        // Hard navigation — AuthProvider on the target page picks up the session.
        // Role from the user-selected button is used to pick the correct dashboard.
        // The actual DB role is enforced by each dashboard page itself.
        if (role === "owner")  { window.location.href = "/owner";    return; }
        if (role === "rider")  { window.location.href = "/delivery"; return; }
        window.location.href = "/menu";
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10 sm:py-14"
        style={{ background: "var(--bg-primary)" }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/8 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-red-500/6 rounded-full blur-[100px]" />
        </div>

        {/* Container: narrower on mobile, wider on sm+ so 3 cols have breathing room */}
        <div className="relative w-full max-w-sm sm:max-w-xl text-center">

          {/* Logo */}
          <div className="w-16 sm:w-20 h-16 sm:h-20 gradient-brand rounded-3xl flex items-center justify-center text-3xl sm:text-4xl mx-auto mb-5 sm:mb-6 shadow-brand">
            🍱
          </div>
          <h1 className="font-bold text-2xl sm:text-3xl mb-2"
            style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-primary)" }}>
            Royals Zaika
          </h1>
          <p className="mb-8 sm:mb-10" style={{ color: "var(--text-secondary)" }}>
            Authentic Indian Cuisine — Who are you?
          </p>

          {/* ── Three equal role cards ─────────────────────────────────────
               Mobile  : 1 column — each card is full-width, stacked
               sm (640px+): 3 equal columns side by side
               All cards share identical padding, icon size, text, hover/active
          ─────────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Customer Card */}
            <button
              onClick={() => setRole("customer")}
              className="group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "var(--bg-glass)", border: "1px solid var(--border)" }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "rgba(249,115,22,0.04)" }} />
              <div className="w-12 h-12 bg-orange-500/15 rounded-2xl flex items-center justify-center mb-4">
                <ShoppingBag size={24} className="text-orange-500" />
              </div>
              <p className="font-bold text-base mb-1" style={{ color: "var(--text-primary)" }}>I'm a Customer</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Order food online</p>
              <div className="absolute bottom-4 right-4 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                style={{ background: "#f97316" }}>
                <ArrowRight size={12} className="text-white" />
              </div>
            </button>

            {/* Owner Card */}
            <button
              onClick={() => setRole("owner")}
              className="group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "var(--bg-glass)", border: "1px solid var(--border)" }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "rgba(249,115,22,0.04)" }} />
              <div className="w-12 h-12 bg-orange-500/15 rounded-2xl flex items-center justify-center mb-4">
                <ChefHat size={24} className="text-orange-500" />
              </div>
              <p className="font-bold text-base mb-1" style={{ color: "var(--text-primary)" }}>Restaurant Owner</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Manage your restaurant</p>
              <div className="absolute bottom-4 right-4 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                style={{ background: "#f97316" }}>
                <ArrowRight size={12} className="text-white" />
              </div>
            </button>

            {/* Rider Card — now identical structure to the two above */}
            <button
              onClick={() => setRole("rider")}
              className="group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "var(--bg-glass)", border: "1px solid var(--border)" }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "rgba(249,115,22,0.04)" }} />
              <div className="w-12 h-12 bg-blue-500/15 rounded-2xl flex items-center justify-center mb-4 text-2xl leading-none">
                🛵
              </div>
              <p className="font-bold text-base mb-1" style={{ color: "var(--text-primary)" }}>Delivery Partner</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Pick up &amp; deliver orders</p>
              <div className="absolute bottom-4 right-4 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                style={{ background: "#f97316" }}>
                <ArrowRight size={12} className="text-white" />
              </div>
            </button>

          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Auth Form ───────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center px-3 sm:px-4 py-10 sm:py-12" style={{ background: "var(--bg-primary)" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-orange-500/8 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Back + Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <button onClick={() => setRole(null)} className="text-sm mb-5 sm:mb-6 flex items-center gap-1 mx-auto transition-colors" style={{ color: "var(--text-secondary)" }}>
            ← Back
          </button>
          <div className="w-14 sm:w-16 h-14 sm:h-16 gradient-brand rounded-2xl flex items-center justify-center text-2xl sm:text-3xl mx-auto mb-3 sm:mb-4 shadow-brand">
            {role === "owner" ? "👨‍🍳" : role === "rider" ? "🛵" : "🍱"}
          </div>
          <h1 className="font-bold text-xl sm:text-2xl" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-primary)" }}>
            {role === "owner" ? "Restaurant Owner Login" : role === "rider" ? "Delivery Partner Login" : "Welcome Back!"}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {role === "owner" ? "Manage your menu & orders" : role === "rider" ? "View & update your deliveries" : "Sign in to place your order"}
          </p>
        </div>

        <div className="rounded-3xl p-5 sm:p-7" style={{ background: "var(--bg-glass)", border: "1px solid var(--border)", backdropFilter: "blur(12px)" }}>
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


          {/* Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {/* Name — signup only */}
            {mode === "signup" && (
              <input
                type="text"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Full Name"
                required
                className="input-field"
              />
            )}

            {/* Email / Identifier — shown only in login mode (signup uses phone for auto-email) */}
            {mode === "login" && (
              <div className="relative">
                {!form.identifier.includes("@") && form.identifier.length > 0
                  ? <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                  : <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                }
                <input
                  type="text"
                  value={form.identifier}
                  onChange={(e) => update("identifier", e.target.value)}
                  placeholder={role === "customer" ? "Enter your mobile number" : "Email or Mobile Number"}
                  required
                  autoComplete="username"
                  className="input-field pl-11"
                />
              </div>
            )}

            {/* Phone — signup only */}
            {mode === "signup" && (
              <div className="relative">
                <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="Mobile Number (e.g. 9876543210)"
                  required
                  maxLength={13}
                  className="input-field pl-11"
                />
                {form.phone && !validateIndianPhone(form.phone) && (
                  <p className="text-xs text-red-400 mt-1 ml-1">Enter a valid 10-digit Indian mobile number</p>
                )}
              </div>
            )}

            {/* Password */}
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="Password"
                required
                minLength={6}
                className="input-field pr-11"
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Forgot Password — login mode only */}
            {mode === "login" && (
              <div className="text-right -mt-1">
                <a
                  href={`/auth/forgot-password?role=${role ?? "customer"}`}
                  className="text-xs font-semibold hover:underline transition-all"
                  style={{ color: "var(--text-muted)" }}
                >
                  Forgot Password?
                </a>
              </div>
            )}

            {/* Confirm Password — signup only */}
            {mode === "signup" && (
              <div className="relative">
                <input
                  type={showConfPass ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={(e) => update("confirmPassword", e.target.value)}
                  placeholder="Confirm Password"
                  required
                  minLength={6}
                  className="input-field pr-11"
                />
                <button type="button" onClick={() => setShowConfPass(!showConfPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                  {showConfPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <p className="text-xs text-red-400 mt-1 ml-1">Passwords do not match</p>
                )}
              </div>
            )}

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

