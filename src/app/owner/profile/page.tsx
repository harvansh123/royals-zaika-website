"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "next/navigation";
import {
  User, Mail, Phone, MapPin, Clock, Camera, Lock,
  Save, Loader2, Eye, EyeOff, Store, CheckCircle
} from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";
import SupportTicketModal from "@/components/support/SupportTicketModal";
import TicketHistoryList from "@/components/support/TicketHistoryList";
import { HelpCircle } from "lucide-react";

const RESTAURANT_KEY = "chaurasia_restaurant_settings";

type RestaurantSettings = {
  restaurant_name: string;
  restaurant_logo: string;
  restaurant_address: string;
  business_hours: string;
};

const DEFAULT_HOURS = "Mon–Sun: 9:00 AM – 10:00 PM";

function loadRestaurantSettings(): RestaurantSettings {
  if (typeof window === "undefined") return { restaurant_name: "", restaurant_logo: "", restaurant_address: "", business_hours: DEFAULT_HOURS };
  try {
    const saved = localStorage.getItem(RESTAURANT_KEY);
    return saved ? JSON.parse(saved) : { restaurant_name: "Chaurasia Ji", restaurant_logo: "", restaurant_address: "", business_hours: DEFAULT_HOURS };
  } catch { return { restaurant_name: "Chaurasia Ji", restaurant_logo: "", restaurant_address: "", business_hours: DEFAULT_HOURS }; }
}

export default function OwnerProfilePage() {
  const { user, loading: authLoading } = useAuthStore();
  const router = useRouter();

  // Personal info state
  const [name, setName]         = useState("");
  const [phone, setPhone]       = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [email, setEmail]       = useState("");

  // Restaurant info state
  const [restaurant, setRestaurant] = useState<RestaurantSettings>({
    restaurant_name: "", restaurant_logo: "", restaurant_address: "", business_hours: DEFAULT_HOURS,
  });

  // Password state
  const [currentPass, setCurrentPass]   = useState("");
  const [newPass, setNewPass]           = useState("");
  const [confirmPass, setConfirmPass]   = useState("");
  const [showPasses, setShowPasses]     = useState({ current: false, new: false, confirm: false });

  // UI state
  const [savingProfile, setSavingProfile]       = useState(false);
  const [savingRestaurant, setSavingRestaurant] = useState(false);
  const [savingPassword, setSavingPassword]     = useState(false);
  const [uploadingAvatar, setUploadingAvatar]   = useState(false);
  const [profileSaved, setProfileSaved]         = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/auth/login"); return; }
    if (user.role !== "restaurant_owner") { router.push("/"); return; }

    // Load owner info
    setName(user.name ?? "");
    setEmail(user.email ?? "");
    setPhone(user.phone ?? "");
    setAvatarUrl(user.avatar_url ?? "");

    // Load restaurant settings from localStorage
    setRestaurant(loadRestaurantSettings());
  }, [user, authLoading]);

  // ── Save Personal Info ───────────────────────────────────────────
  async function saveProfile() {
    if (!user) return;
    if (!name.trim()) { toast.error("Name is required"); return; }

    // Phone validation (if provided)
    if (phone.trim()) {
      let digits = phone.trim().replace(/[\s\-().]/g, "");
      if (digits.startsWith("+91"))    digits = digits.slice(3);
      else if (digits.startsWith("0091")) digits = digits.slice(4);
      else if (digits.startsWith("0"))    digits = digits.slice(1);
      if (!/^[6-9]\d{9}$/.test(digits)) {
        toast.error("Enter a valid 10-digit Indian mobile number (starting with 6–9)");
        return;
      }
    }

    setSavingProfile(true);
    // Use service-role API to avoid RLS recursion and get uniqueness check
    try {
      const res = await fetch("/api/customer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || "",
          avatar_url: avatarUrl.trim() || "",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to save profile");
      } else {
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 3000);
        toast.success("Profile saved! ✅");
      }
    } catch {
      toast.error("Network error. Please try again.");
    }
    setSavingProfile(false);
  }

  // ── Save Restaurant Settings ──────────────────────────────────────
  async function saveRestaurantSettings() {
    setSavingRestaurant(true);
    try {
      localStorage.setItem(RESTAURANT_KEY, JSON.stringify(restaurant));
      toast.success("Restaurant settings saved! 🍽️");
    } catch {
      toast.error("Failed to save settings");
    }
    setSavingRestaurant(false);
  }

  // ── Upload Avatar via Supabase Storage ────────────────────────────
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2MB"); return; }

    setUploadingAvatar(true);
    try {
      const ext  = file.name.split(".").pop();
      const path = `avatars/${user.id}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      toast.success("Photo uploaded!");
    } catch (err: any) {
      // Storage bucket may not exist — just allow URL entry
      toast.error("Upload failed. Please paste an image URL instead.");
    }
    setUploadingAvatar(false);
  }

  // ── Change Password ───────────────────────────────────────────────
  async function changePassword() {
    if (!newPass) { toast.error("Enter a new password"); return; }
    if (newPass.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (newPass !== confirmPass) { toast.error("Passwords don't match"); return; }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) {
      toast.error(error.message);
    } else {
      setCurrentPass(""); setNewPass(""); setConfirmPass("");
      toast.success("Password changed successfully! 🔐");
    }
    setSavingPassword(false);
  }

  if (authLoading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <Loader2 size={36} className="animate-spin text-orange-500" />
    </div>
  );

  const displayName = name || user?.name || "Owner";
  const initials = displayName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="p-5 md:p-8 max-w-2xl">
      <h1 className="font-bold text-2xl md:text-3xl mb-8"
        style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-primary)" }}>
        My Profile
      </h1>

      {/* ══ SECTION 1: Personal Info ══ */}
      <div className="rounded-2xl overflow-hidden mb-5"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Personal Information</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Your account details</p>
        </div>

        <div className="p-5">
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              {avatarUrl ? (
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-2"
                  style={{ borderColor: "var(--border)" }}>
                  <Image src={avatarUrl} alt="Avatar" width={80} height={80}
                    className="object-cover w-full h-full"
                    onError={() => setAvatarUrl("")} />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white"
                  style={{ background: "linear-gradient(135deg,#f97316,#dc2626)" }}>
                  {initials || "👨‍🍳"}
                </div>
              )}
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110"
                style={{ background: "linear-gradient(135deg,#f97316,#dc2626)" }}>
                {uploadingAvatar
                  ? <Loader2 size={13} className="animate-spin text-white" />
                  : <Camera size={13} className="text-white" />}
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                onChange={handleAvatarUpload} />
            </div>
            <div>
              <p className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>{displayName}</p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{email}</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Restaurant Owner</p>
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5"
                style={{ color: "var(--text-secondary)" }}>
                <User size={12} /> Full Name *
              </label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full px-4 py-2.5 rounded-xl text-sm transition-colors focus:outline-none"
                style={{ background: "var(--bg-glass)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5"
                style={{ color: "var(--text-secondary)" }}>
                <Mail size={12} /> Email Address
              </label>
              <input type="email" value={email} readOnly
                className="w-full px-4 py-2.5 rounded-xl text-sm cursor-not-allowed"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-muted)" }} />
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Email cannot be changed here</p>
            </div>

            {/* Phone */}
            <div>
              <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5"
                style={{ color: "var(--text-secondary)" }}>
                <Phone size={12} /> Phone Number
              </label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 XXXXX XXXXX"
                className="w-full px-4 py-2.5 rounded-xl text-sm transition-colors focus:outline-none"
                style={{ background: "var(--bg-glass)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>

            {/* Avatar URL (manual override) */}
            <div>
              <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5"
                style={{ color: "var(--text-secondary)" }}>
                <Camera size={12} /> Profile Photo URL (optional)
              </label>
              <input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/photo.jpg"
                className="w-full px-4 py-2.5 rounded-xl text-sm transition-colors focus:outline-none"
                style={{ background: "var(--bg-glass)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
          </div>

          <button onClick={saveProfile} disabled={savingProfile}
            className="mt-5 flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#f97316,#dc2626)" }}>
            {savingProfile
              ? <><Loader2 size={15} className="animate-spin" /> Saving...</>
              : profileSaved
                ? <><CheckCircle size={15} /> Saved!</>
                : <><Save size={15} /> Save Profile</>}
          </button>
        </div>
      </div>

      {/* ══ SECTION 2: Restaurant Settings ══ */}
      <div className="rounded-2xl overflow-hidden mb-5"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Restaurant Information</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Your restaurant's public details</p>
        </div>

        <div className="p-5 space-y-4">
          {/* Restaurant Name */}
          <div>
            <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5"
              style={{ color: "var(--text-secondary)" }}>
              <Store size={12} /> Restaurant Name
            </label>
            <input type="text"
              value={restaurant.restaurant_name}
              onChange={(e) => setRestaurant((p) => ({ ...p, restaurant_name: e.target.value }))}
              placeholder="e.g. Chaurasia Ji"
              className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none transition-colors"
              style={{ background: "var(--bg-glass)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>

          {/* Restaurant Logo URL */}
          <div>
            <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5"
              style={{ color: "var(--text-secondary)" }}>
              <Camera size={12} /> Restaurant Logo URL
            </label>
            <div className="flex gap-2">
              {restaurant.restaurant_logo && (
                <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0"
                  style={{ border: "1px solid var(--border)" }}>
                  <Image src={restaurant.restaurant_logo} alt="Logo" width={40} height={40}
                    className="object-cover w-full h-full"
                    onError={() => setRestaurant((p) => ({ ...p, restaurant_logo: "" }))} />
                </div>
              )}
              <input type="url"
                value={restaurant.restaurant_logo}
                onChange={(e) => setRestaurant((p) => ({ ...p, restaurant_logo: e.target.value }))}
                placeholder="https://example.com/logo.png"
                className="flex-1 px-4 py-2.5 rounded-xl text-sm focus:outline-none transition-colors"
                style={{ background: "var(--bg-glass)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
          </div>

          {/* Restaurant Address */}
          <div>
            <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5"
              style={{ color: "var(--text-secondary)" }}>
              <MapPin size={12} /> Restaurant Address
            </label>
            <textarea
              value={restaurant.restaurant_address}
              onChange={(e) => setRestaurant((p) => ({ ...p, restaurant_address: e.target.value }))}
              placeholder="123 Main Street, Varanasi, UP – 221001"
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none transition-colors resize-none"
              style={{ background: "var(--bg-glass)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>

          {/* Business Hours */}
          <div>
            <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5"
              style={{ color: "var(--text-secondary)" }}>
              <Clock size={12} /> Business Hours
            </label>
            <input type="text"
              value={restaurant.business_hours}
              onChange={(e) => setRestaurant((p) => ({ ...p, business_hours: e.target.value }))}
              placeholder="Mon–Sun: 9:00 AM – 10:00 PM"
              className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none transition-colors"
              style={{ background: "var(--bg-glass)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              e.g. "Mon–Fri: 10 AM – 9 PM, Sat–Sun: 11 AM – 10 PM"
            </p>
          </div>

          <button onClick={saveRestaurantSettings} disabled={savingRestaurant}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#f97316,#dc2626)" }}>
            {savingRestaurant
              ? <><Loader2 size={15} className="animate-spin" /> Saving...</>
              : <><Save size={15} /> Save Restaurant Info</>}
          </button>
        </div>
      </div>

      {/* ══ SECTION 3: Change Password ══ */}
      <div className="rounded-2xl overflow-hidden mb-8"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Change Password</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Use a strong password of at least 6 characters</p>
        </div>

        <div className="p-5 space-y-4">
          {/* New Password */}
          <div>
            <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5"
              style={{ color: "var(--text-secondary)" }}>
              <Lock size={12} /> New Password
            </label>
            <div className="relative">
              <input
                type={showPasses.new ? "text" : "password"}
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full px-4 py-2.5 pr-11 rounded-xl text-sm focus:outline-none transition-colors"
                style={{ background: "var(--bg-glass)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              <button type="button"
                onClick={() => setShowPasses((p) => ({ ...p, new: !p.new }))}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}>
                {showPasses.new ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5"
              style={{ color: "var(--text-secondary)" }}>
              <Lock size={12} /> Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showPasses.confirm ? "text" : "password"}
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-4 py-2.5 pr-11 rounded-xl text-sm focus:outline-none transition-colors"
                style={{
                  background: "var(--bg-glass)",
                  border: confirmPass && confirmPass !== newPass
                    ? "1px solid #ef4444"
                    : confirmPass && confirmPass === newPass
                      ? "1px solid #22c55e"
                      : "1px solid var(--border)",
                  color: "var(--text-primary)"
                }} />
              <button type="button"
                onClick={() => setShowPasses((p) => ({ ...p, confirm: !p.confirm }))}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}>
                {showPasses.confirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {confirmPass && confirmPass !== newPass && (
              <p className="text-xs mt-1 text-red-400">Passwords don't match</p>
            )}
            {confirmPass && confirmPass === newPass && newPass.length >= 6 && (
              <p className="text-xs mt-1 text-green-400">✓ Passwords match</p>
            )}
          </div>

          <button
            onClick={changePassword}
            disabled={savingPassword || !newPass || !confirmPass || newPass !== confirmPass}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
            {savingPassword
              ? <><Loader2 size={15} className="animate-spin" /> Changing...</>
              : <><Lock size={15} /> Change Password</>}
          </button>
        </div>
      </div>

      {/* ══ SECTION 4: Help & Support ══ */}
      <div className="rounded-2xl overflow-hidden mb-8"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Help & Support</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Get help or track your requests</p>
          </div>
          <button onClick={() => setShowSupportModal(true)}
            className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
            style={{ background: "rgba(249,115,22,0.15)", color: "#f97316" }}>
            <HelpCircle size={14} /> Get Help
          </button>
        </div>
        <div className="p-5">
          <TicketHistoryList userType="owner" />
        </div>
      </div>

      <SupportTicketModal 
        isOpen={showSupportModal} 
        onClose={() => setShowSupportModal(false)}
        userType="owner"
        defaultName={user?.name || ""}
        defaultEmail={user?.email || ""}
        defaultPhone={user?.phone || ""}
      />
    </div>
  );
}
