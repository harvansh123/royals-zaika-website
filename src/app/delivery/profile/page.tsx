"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "next/navigation";
import {
  User, Phone, Mail, Camera, Lock, Save, Loader2,
  Eye, EyeOff, ChevronLeft, CheckCircle, Bike, Hash,
  WifiOff, Wifi, TrendingUp, Calendar, RefreshCw, HelpCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";
import Link from "next/link";
import SupportTicketModal from "@/components/support/SupportTicketModal";
import TicketHistoryList from "@/components/support/TicketHistoryList";
import type { RiderStatsResponse, DailyRecord } from "@/app/api/rider/stats/route";

// ── Shared input style ────────────────────────────────────────────────
const inputCls = "w-full rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-400/20 transition-all";
const inputStyle = {
  background: "var(--input-bg)",
  border: "1.5px solid var(--border)",
  color: "var(--text-primary)",
};

export default function RiderProfilePage() {
  const { user, loading: authLoading, setUser } = useAuthStore();
  const router = useRouter();

  const [name,      setName]      = useState("");
  const [phone,     setPhone]     = useState("");
  const [email,     setEmail]     = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [vehicleType,   setVehicleType]   = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [riderStatus,   setRiderStatus]   = useState<"online" | "offline">("offline");

  const [totalDelivered, setTotalDelivered] = useState(0);
  const [todayDelivered, setTodayDelivered] = useState(0);
  const [riderStats, setRiderStats]         = useState<RiderStatsResponse | null>(null);
  const [statsLoading, setStatsLoading]     = useState(false);
  const [showHistory,   setShowHistory]     = useState(false);

  const [currentPass, setCurrentPass]   = useState("");
  const [newPass,     setNewPass]       = useState("");
  const [confirmPass, setConfirmPass]   = useState("");
  const [showCurrPass, setShowCurrPass] = useState(false);
  const [showNewPass,  setShowNewPass]  = useState(false);
  const [showConfPass, setShowConfPass] = useState(false);

  const [savingProfile,   setSavingProfile]   = useState(false);
  const [savingPassword,  setSavingPassword]  = useState(false);
  const [savingRider,     setSavingRider]     = useState(false);
  const [togglingStatus,  setTogglingStatus]  = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saved,           setSaved]           = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  const avatarRef = useRef<HTMLInputElement>(null);
  // Ref to prevent stale closure in toggleStatus
  const riderStatusRef = useRef<"online" | "offline">("offline");

  useEffect(() => {
    riderStatusRef.current = riderStatus;
  }, [riderStatus]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/auth/login"); return; }
    if (user.role !== "delivery") { router.push("/"); return; }

    setName(user.name   ?? "");
    setEmail(user.email ?? "");
    setPhone(user.phone ?? "");
    setAvatarUrl(user.avatar_url ?? "");

    loadRiderData();
    loadRiderStats();
  }, [user, authLoading]);

  async function loadRiderData() {
    if (!user) return;

    // Use server-side API (service role key) — bypasses RLS infinite recursion.
    // Direct supabase.from("delivery_partners").select() with anon key always
    // fails silently because the admin policy calls get_user_role() → recursive
    // loop → partner = null → riderStatus resets to "offline" default every load.
    try {
      const res  = await fetch("/api/rider/profile", { credentials: "include" });
      const json = await res.json();

      if (res.ok && json.partner) {
        const p = json.partner;
        setVehicleType(p.vehicle_type   ?? "");
        setVehicleNumber(p.vehicle_number ?? "");
        const status: "online" | "offline" = p.is_available ? "online" : "offline";
        setRiderStatus(status);
        riderStatusRef.current = status;   // keep ref in sync so toggleStatus reads correct value
      }

      if (res.ok) {
        setTotalDelivered(json.totalDelivered ?? 0);
        setTodayDelivered(json.todayDelivered ?? 0);
      }
    } catch {
      // Non-critical — page still renders even if profile fetch fails
    }
  }

  async function loadRiderStats() {
    if (!user) return;
    setStatsLoading(true);
    try {
      const res  = await fetch(`/api/rider/stats?riderId=${user.id}`);
      const json = await res.json();
      if (res.ok) setRiderStats(json as RiderStatsResponse);
    } catch { /* non-critical */ }
    setStatsLoading(false);
  }

  async function saveProfile() {
    if (!user || !name.trim()) { toast.error("Name is required"); return; }
    setSavingProfile(true);
    try {
      // Use service-role API — direct supabase.from("users").update() fails due to
      // RLS infinite recursion: get_user_role() queries users → triggers users policies → loop
      const res  = await fetch("/api/rider/profile", {
        method:      "PATCH",
        headers:     { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name:       name.trim(),
          phone:      phone.trim() || null,
          avatar_url: avatarUrl || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Failed to save: " + (json.error ?? "Please try again"));
      } else {
        setSaved(true); setTimeout(() => setSaved(false), 3000);
        toast.success("Profile saved! ✅");
        setUser({ ...user, name: name.trim(), phone: phone.trim() || null, avatar_url: avatarUrl || null } as any);
      }
    } catch {
      toast.error("Network error. Please try again.");
    }
    setSavingProfile(false);
  }

  async function saveRiderInfo() {
    if (!user) return;
    setSavingRider(true);
    try {
      // Use service-role API — direct anon-key update on delivery_partners fails
      // because the admin policy calls get_user_role() → RLS recursion on users table
      const res  = await fetch("/api/rider/profile", {
        method:      "PATCH",
        headers:     { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          vehicle_type:   vehicleType.trim() || null,
          vehicle_number: vehicleNumber.trim().toUpperCase() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Failed to save: " + (json.error ?? "Please try again"));
      } else {
        toast.success("Vehicle details updated! 🛵");
      }
    } catch {
      toast.error("Network error. Please try again.");
    }
    setSavingRider(false);
  }

  // ── FIXED: Online/Offline toggle — uses server-side API to bypass RLS recursion ──
  async function toggleStatus() {
    if (!user || togglingStatus) return;

    const oldStatus = riderStatusRef.current;           // capture current via ref
    const nextStatus: "online" | "offline" = oldStatus === "online" ? "offline" : "online";
    const isAvailable = nextStatus === "online";

    setTogglingStatus(true);
    setRiderStatus(nextStatus);                         // optimistic UI update

    try {
      const res = await fetch("/api/rider/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isAvailable }),
      });

      const json = await res.json();

      if (!res.ok) {
        setRiderStatus(oldStatus);                      // revert on failure
        toast.error("Failed to update status: " + (json.error ?? "Please try again."));
      } else {
        toast.success(nextStatus === "online" ? "You are now Online 🟢" : "You are now Offline 🔴");
      }
    } catch (err: any) {
      setRiderStatus(oldStatus);                        // revert on network error
      toast.error("Network error. Please try again.");
    }

    setTogglingStatus(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2MB"); return; }
    setUploadingAvatar(true);
    try {
      const ext  = file.name.split(".").pop();
      const path = `avatars/${user.id}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("avatars").upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      toast.success("Photo uploaded! Click Save Profile to apply.");
    } catch {
      toast.error("Upload failed. Paste a photo URL instead.");
    }
    setUploadingAvatar(false);
  }

  async function changePassword() {
    if (!currentPass)            { toast.error("Enter your current password"); return; }
    if (!newPass)                { toast.error("Enter a new password"); return; }
    if (newPass.length < 6)      { toast.error("New password must be at least 6 characters"); return; }
    if (newPass !== confirmPass) { toast.error("Passwords don't match"); return; }
    if (!user?.email)            { toast.error("User email not found"); return; }

    setSavingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:           user.email,
          currentPassword: currentPass,
          newPassword:     newPass,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to change password");
      } else {
        setCurrentPass(""); setNewPass(""); setConfirmPass("");
        toast.success("Password changed successfully! 🔐");
      }
    } catch {
      toast.error("Network error. Please try again.");
    }
    setSavingPassword(false);
  }

  async function handleSignOut() {
    setUser(null);
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  if (authLoading || !user) return (
    <div className="flex items-center justify-center h-screen" style={{ background: "var(--bg-primary)" }}>
      <Loader2 size={36} className="animate-spin text-orange-500" />
    </div>
  );

  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "R";
  const isOnline = riderStatus === "online";

  // ── Shared section card style ──────────────────────────────────────
  const sectionStyle = {
    background: "var(--card-bg)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
  };
  const sectionHeaderStyle = {
    borderBottom: "1px solid var(--border)",
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">

      {/* Back */}
      <Link href="/delivery"
        className="inline-flex items-center gap-1.5 mb-6 text-sm font-medium transition-colors"
        style={{ color: "var(--text-muted)" }}>
        <ChevronLeft size={16} /> Back to Dashboard
      </Link>

      {/* ── Header Card ─────────────────────────────────────────────── */}
      <div className="rounded-2xl p-6 mb-5"
        style={{ background: "linear-gradient(135deg,rgba(249,115,22,0.07),rgba(220,38,38,0.03))", border: "1px solid rgba(249,115,22,0.18)" }}>

        <div className="flex items-center gap-5 mb-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {avatarUrl ? (
              <div className="w-24 h-24 rounded-2xl overflow-hidden" style={{ border: "2px solid rgba(249,115,22,0.3)" }}>
                <Image src={avatarUrl} alt="Avatar" width={96} height={96} className="object-cover w-full h-full"
                  onError={() => setAvatarUrl("")} />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-2xl gradient-brand flex items-center justify-center text-3xl font-black text-white">
                {initials}
              </div>
            )}
            <button onClick={() => avatarRef.current?.click()} disabled={uploadingAvatar}
              className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full gradient-brand flex items-center justify-center shadow-lg border-2 border-white">
              {uploadingAvatar ? <Loader2 size={14} className="animate-spin text-white" /> : <Camera size={14} className="text-white" />}
            </button>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-2xl mb-0.5" style={{ fontFamily: "'Outfit',sans-serif", color: "var(--text-primary)" }}>
              {name || "Rider"}
            </h1>
            <p className="text-sm mb-2 truncate" style={{ color: "var(--text-muted)" }}>{email}</p>
            <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full font-semibold"
              style={{ background: "rgba(249,115,22,0.1)", color: "#f97316" }}>
              🛵 Delivery Rider
            </span>
          </div>
        </div>

        {/* ── Online/Offline Toggle — FIXED ── */}
        <button
          onClick={toggleStatus}
          disabled={togglingStatus}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-bold text-base transition-all disabled:opacity-70 active:scale-[0.99]"
          style={{
            background: isOnline
              ? "linear-gradient(135deg,rgba(22,163,74,0.12),rgba(22,163,74,0.06))"
              : "rgba(15,23,42,0.04)",
            border: isOnline ? "2px solid rgba(22,163,74,0.4)" : "2px solid var(--border)",
            color: isOnline ? "#16a34a" : "var(--text-muted)",
          }}
        >
          {togglingStatus
            ? <Loader2 size={20} className="animate-spin" />
            : isOnline ? <Wifi size={22} /> : <WifiOff size={22} />
          }
          <span className="text-base">
            {togglingStatus
              ? "Updating..."
              : isOnline ? "Online — Tap to go Offline" : "Offline — Tap to go Online"
            }
          </span>
          <span className={`w-3 h-3 rounded-full ${isOnline ? "bg-green-500 animate-pulse" : "bg-slate-300"}`} />
        </button>
      </div>

      {/* ── Quick Stats ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl p-5 text-center" style={sectionStyle}>
          <p className="text-3xl font-black text-orange-600 mb-1">{todayDelivered}</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Delivered Today</p>
        </div>
        <div className="rounded-xl p-5 text-center" style={sectionStyle}>
          <p className="text-3xl font-black text-green-600 mb-1">{totalDelivered}</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Total Completed</p>
        </div>
      </div>

      {/* ── Performance Stats ────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden mb-4" style={sectionStyle}>
        <div className="px-6 py-4 flex items-center justify-between" style={sectionHeaderStyle}>
          <p className="font-bold text-base flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <TrendingUp size={16} className="text-orange-500" /> Rider Performance
          </p>
          <button onClick={loadRiderStats} disabled={statsLoading}
            style={{ color: "var(--text-muted)" }}
            className="transition-colors hover:text-orange-500">
            <RefreshCw size={14} className={statsLoading ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="p-5">
          {statsLoading ? (
            <div className="flex items-center justify-center py-6 gap-2" style={{ color: "var(--text-muted)" }}>
              <Loader2 size={18} className="animate-spin" /> Loading stats...
            </div>
          ) : riderStats ? (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: "Today's Distance",   value: `${riderStats.todayDistanceKm} km`, icon: "📍", color: "text-blue-600" },
                  { label: "Today's Deliveries", value: riderStats.todayDeliveries,          icon: "✅", color: "text-green-600" },
                  { label: "This Week",           value: `${riderStats.weekDistanceKm} km`,  icon: "📅", color: "text-purple-600" },
                  { label: "This Month",          value: `${riderStats.monthDistanceKm} km`, icon: "🗓️", color: "text-orange-600" },
                ].map(({ label, value, icon, color }) => (
                  <div key={label} className="rounded-xl p-4 text-center"
                    style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                    <p className="text-lg mb-1">{icon}</p>
                    <p className={`font-black text-xl ${color}`}>{value}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
                  </div>
                ))}
              </div>

              <button onClick={() => setShowHistory((p) => !p)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  <Calendar size={14} className="text-orange-500" /> Delivery History ({riderStats.history.length} days)
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{showHistory ? "▲ Hide" : "▼ Show"}</span>
              </button>

              {showHistory && riderStats.history.length > 0 && (
                <div className="mt-3 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  <div className="grid grid-cols-3 px-4 py-2.5 text-xs font-bold uppercase tracking-wide"
                    style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
                    <span>Date</span>
                    <span className="text-center">Deliveries</span>
                    <span className="text-right">Distance</span>
                  </div>
                  {riderStats.history.map((h: DailyRecord, i: number) => {
                    const isToday = h.date === new Date().toLocaleDateString("en-CA");
                    return (
                      <div key={h.date}
                        className="grid grid-cols-3 px-4 py-3 text-sm"
                        style={{
                          background: isToday ? "rgba(249,115,22,0.04)" : i % 2 === 0 ? "transparent" : "rgba(15,23,42,0.02)",
                          borderBottom: i < riderStats.history.length - 1 ? "1px solid var(--border)" : "none",
                        }}>
                        <span className={isToday ? "font-bold text-orange-600" : ""} style={{ color: isToday ? undefined : "var(--text-secondary)" }}>
                          {isToday ? "Today" : new Date(h.date + "T12:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        </span>
                        <span className="text-center text-green-600 font-semibold">{h.deliveries}</span>
                        <span className="text-right text-blue-600 font-semibold">{h.distanceKm} km</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {showHistory && riderStats.history.length === 0 && (
                <p className="text-center text-sm py-4 mt-3" style={{ color: "var(--text-muted)" }}>No delivery history yet</p>
              )}
            </>
          ) : (
            <p className="text-center text-sm py-4" style={{ color: "var(--text-muted)" }}>Could not load stats. Tap refresh to retry.</p>
          )}
        </div>
      </div>

      {/* ── Personal Information ─────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden mb-4" style={sectionStyle}>
        <div className="px-6 py-4" style={sectionHeaderStyle}>
          <p className="font-bold text-base flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <User size={16} className="text-orange-500" /> Personal Information
          </p>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
              <User size={13} /> Full Name <span className="text-red-500">*</span>
            </label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Your full name" className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
              <Mail size={13} /> Email <span className="text-xs ml-1" style={{ color: "var(--text-muted)" }}>(read-only)</span>
            </label>
            <input type="email" value={email} readOnly
              className={inputCls} style={{ ...inputStyle, opacity: 0.6, cursor: "not-allowed" }} />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
              <Phone size={13} /> Phone Number
            </label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 XXXXX XXXXX" className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
              <Camera size={13} /> Profile Photo URL
            </label>
            <input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://... (or use camera icon above)"
              className={inputCls} style={inputStyle} />
          </div>
          <button onClick={saveProfile} disabled={savingProfile}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-bold text-white gradient-brand transition-all hover:opacity-90 disabled:opacity-60">
            {savingProfile ? <Loader2 size={18} className="animate-spin" /> : saved ? <CheckCircle size={18} /> : <Save size={18} />}
            {savingProfile ? "Saving..." : saved ? "Saved! ✅" : "Save Profile Changes"}
          </button>
        </div>
      </div>

      {/* ── Vehicle Details ──────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden mb-4" style={sectionStyle}>
        <div className="px-6 py-4" style={sectionHeaderStyle}>
          <p className="font-bold text-base flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Bike size={16} className="text-orange-500" /> Vehicle Details
          </p>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
              <Bike size={13} /> Vehicle Type
            </label>
            <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}
              className={inputCls} style={inputStyle}>
              <option value="">Select vehicle type</option>
              <option value="Motorcycle">Motorcycle</option>
              <option value="Scooter">Scooter</option>
              <option value="Bicycle">Bicycle</option>
              <option value="E-Bike">E-Bike</option>
              <option value="Car">Car</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
              <Hash size={13} /> Vehicle Number
            </label>
            <input type="text" value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
              placeholder="e.g. UP32AB1234"
              className={`${inputCls} font-mono tracking-wider`} style={inputStyle} />
          </div>
          <button onClick={saveRiderInfo} disabled={savingRider}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-bold text-white gradient-brand transition-all hover:opacity-90 disabled:opacity-60">
            {savingRider ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {savingRider ? "Saving..." : "Save Vehicle Details"}
          </button>
        </div>
      </div>

      {/* ── Change Password ──────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden mb-5" style={sectionStyle}>
        <div className="px-6 py-4" style={sectionHeaderStyle}>
          <p className="font-bold text-base flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Lock size={16} className="text-indigo-600" /> Change Password
          </p>
        </div>
        <div className="p-6 space-y-5">
          {[
            { label: "Current Password", val: currentPass, set: setCurrentPass, show: showCurrPass, toggle: () => setShowCurrPass(p => !p), placeholder: "Enter current password" },
            { label: "New Password",     val: newPass,     set: setNewPass,     show: showNewPass,  toggle: () => setShowNewPass(p => !p),  placeholder: "Minimum 6 characters" },
            { label: "Confirm Password", val: confirmPass, set: setConfirmPass, show: showConfPass, toggle: () => setShowConfPass(p => !p), placeholder: "Re-enter new password" },
          ].map(({ label, val, set, show, toggle, placeholder }) => (
            <div key={label}>
              <label className="text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                <Lock size={13} /> {label} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input type={show ? "text" : "password"} value={val}
                  onChange={(e) => set(e.target.value)} placeholder={placeholder}
                  className={`${inputCls} pr-12`}
                  style={label === "Confirm Password" && confirmPass
                    ? { ...inputStyle, border: `1.5px solid ${confirmPass !== newPass ? "#ef4444" : "#16a34a"}` }
                    : inputStyle}
                />
                <button type="button" onClick={toggle}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "var(--text-muted)" }}>
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {label === "Confirm Password" && confirmPass && confirmPass !== newPass && (
                <p className="text-sm mt-1.5 text-red-500">❌ Passwords don't match</p>
              )}
              {label === "Confirm Password" && confirmPass && confirmPass === newPass && newPass.length >= 6 && (
                <p className="text-sm mt-1.5 text-green-600">✓ Passwords match</p>
              )}
            </div>
          ))}

          <button onClick={changePassword}
            disabled={savingPassword || !currentPass || !newPass || !confirmPass || newPass !== confirmPass || newPass.length < 6}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-bold text-white disabled:opacity-40 transition-all"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
            {savingPassword ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
            {savingPassword ? "Verifying & Changing..." : "Change Password"}
          </button>
        </div>
      </div>

      {/* ── Help & Support ───────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden mb-5" style={sectionStyle}>
        <div className="px-6 py-4 flex items-center justify-between" style={sectionHeaderStyle}>
          <p className="font-bold text-base flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <HelpCircle size={16} className="text-orange-500" /> Help & Support
          </p>
          <button onClick={() => setShowSupportModal(true)}
            className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
            style={{ background: "var(--accent-peach)", color: "#f97316", border: "1px solid rgba(249,115,22,0.2)" }}>
            <HelpCircle size={14} /> Get Help
          </button>
        </div>
        <div className="p-6">
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>View your recent support requests below.</p>
          <TicketHistoryList userType="rider" />
        </div>
      </div>

      {/* ── Logout ──────────────────────────────────────────────────── */}
      <button onClick={handleSignOut}
        className="w-full py-4 rounded-xl text-base font-semibold transition-all"
        style={{ border: "1px solid rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.05)", color: "#dc2626" }}>
        🚪 Sign Out
      </button>

      <SupportTicketModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
        userType="rider"
        defaultName={user.name || ""}
        defaultEmail={user.email || ""}
        defaultPhone={user.phone || ""}
      />
    </div>
  );
}
