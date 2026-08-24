"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "next/navigation";
import {
  User, Phone, Mail, Camera, Lock, Save, Loader2,
  Eye, EyeOff, ChevronLeft, CheckCircle, Bike, Hash, Clock,
  WifiOff, Wifi, TrendingUp, Calendar, RefreshCw, HelpCircle, LogOut, Shield,
} from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";
import Link from "next/link";
import SupportTicketModal from "@/components/support/SupportTicketModal";
import TicketHistoryList from "@/components/support/TicketHistoryList";
import { performSignOut } from "@/lib/sign-out";
import type { RiderStatsResponse, DailyRecord } from "@/app/api/rider/stats/route";

// ── Shared input style ────────────────────────────────────────────────
const inputCls = "w-full rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-400/20 transition-all";
const inputStyle = {
  background: "var(--input-bg)",
  border: "1.5px solid var(--border)",
  color: "var(--text-primary)",
};

/** Returns true if the current local time falls within the shift window. Handles overnight shifts. */
function isWithinShift(start: string, end: string): boolean {
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  return s < e ? cur >= s && cur < e : cur >= s || cur < e;
}

/** Returns true if today's date (YYYY-MM-DD) falls within the leave range (inclusive). */
function isOnLeave(start: string, end: string): boolean {
  if (!start || !end) return false;
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
  return today >= start && today <= end;
}

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

  // ── Security section state ─────────────────────────────────────────
  const [secStatus, setSecStatus]     = useState<{ hasPIN: boolean; hasRecoveryEmail: boolean; recoveryEmail: string | null } | null>(null);
  const [secLoading, setSecLoading]   = useState(false);
  const [secOpen, setSecOpen]         = useState(false);
  const [pinMode, setPinMode]         = useState<"view" | "set" | "change">("view");
  const [pinInput, setPinInput]       = useState("");
  const [pinConfirm, setPinConfirm]   = useState("");
  const [savingPin, setSavingPin]     = useState(false);
  const [emailMode, setEmailMode]     = useState<"view" | "link" | "otp">("view");
  const [emailInput, setEmailInput]   = useState("");
  const [otpInput, setOtpInput]       = useState("");
  const [sendingOtp, setSendingOtp]   = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // ── Shift timing ──────────────────────────────────────────────────
  const [shiftEnabled, setShiftEnabled] = useState(false);
  const [shiftStart,   setShiftStart]   = useState("09:00");
  const [shiftEnd,     setShiftEnd]     = useState("21:00");
  const [savingShift,  setSavingShift]  = useState(false);

  // ── Leave / Days off ────────────────────────────────────────
  const [leaveStart,  setLeaveStart]  = useState("");
  const [leaveEnd,    setLeaveEnd]    = useState("");
  const [savingLeave, setSavingLeave] = useState(false);

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

    // Load shift settings from localStorage
    setShiftEnabled(localStorage.getItem("rider_shift_enabled") === "true");
    setShiftStart(localStorage.getItem("rider_shift_start") || "09:00");
    setShiftEnd(localStorage.getItem("rider_shift_end")   || "21:00");
    setLeaveStart(localStorage.getItem("rider_leave_start") || "");
    setLeaveEnd(localStorage.getItem("rider_leave_end")   || "");

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

  function saveShiftSettings() {
    localStorage.setItem("rider_shift_enabled", String(shiftEnabled));
    localStorage.setItem("rider_shift_start",   shiftStart);
    localStorage.setItem("rider_shift_end",     shiftEnd);
    setSavingShift(true);
    setTimeout(() => setSavingShift(false), 800);
    toast.success("Shift timing saved! ⏰");
  }

  function saveLeaveSettings() {
    if (!leaveStart || !leaveEnd) { toast.error("Please select both start and end dates"); return; }
    if (leaveStart > leaveEnd)    { toast.error("End date must be on or after start date"); return; }
    localStorage.setItem("rider_leave_start", leaveStart);
    localStorage.setItem("rider_leave_end",   leaveEnd);
    setSavingLeave(true);
    setTimeout(() => setSavingLeave(false), 800);
    toast.success("Leave scheduled! You will stay offline during this period 🗓️");
  }

  function cancelLeave() {
    localStorage.removeItem("rider_leave_start");
    localStorage.removeItem("rider_leave_end");
    setLeaveStart("");
    setLeaveEnd("");
    toast.success("Leave cancelled ✅");
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
    toast.success("Signed out successfully");
    await performSignOut();
  }

  // ── Security helpers ───────────────────────────────────────────────
  async function fetchSecStatus() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    setSecLoading(true);
    try {
      const res = await fetch("/api/auth/recovery-status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) { const d = await res.json(); setSecStatus(d); }
    } catch { /* silent */ }
    setSecLoading(false);
  }

  async function handleSavePin() {
    if (!/^\d{4}$/.test(pinInput)) { toast.error("PIN must be 4 digits"); return; }
    if (pinInput !== pinConfirm) { toast.error("PINs do not match"); return; }
    setSavingPin(true);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch("/api/auth/set-recovery-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: secStatus?.hasPIN ? "change" : "set", pin: pinInput }),
      });
      const d = await res.json();
      if (!res.ok) toast.error(d.error ?? "Failed");
      else { toast.success(d.message); setPinMode("view"); setPinInput(""); setPinConfirm(""); fetchSecStatus(); }
    } catch { toast.error("Network error"); }
    setSavingPin(false);
  }

  async function handleRemovePin() {
    if (!confirm("Recovery PIN remove karna chahte ho?")) return;
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch("/api/auth/set-recovery-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: "remove" }),
      });
      const d = await res.json();
      if (!res.ok) toast.error(d.error ?? "Failed");
      else { toast.success("Recovery PIN removed"); fetchSecStatus(); }
    } catch { toast.error("Network error"); }
  }

  async function handleSendOtp() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) { toast.error("Valid email enter karein"); return; }
    setSendingOtp(true);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch("/api/auth/link-recovery-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email: emailInput }),
      });
      const d = await res.json();
      if (!res.ok) toast.error(d.error ?? "Failed");
      else { toast.success("OTP sent!"); setEmailMode("otp"); }
    } catch { toast.error("Network error"); }
    setSendingOtp(false);
  }

  async function handleVerifyOtp() {
    if (!otpInput.trim()) { toast.error("OTP enter karein"); return; }
    setVerifyingOtp(true);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch("/api/auth/verify-recovery-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ otp: otpInput }),
      });
      const d = await res.json();
      if (!res.ok) toast.error(d.error ?? "Incorrect OTP");
      else { toast.success("Email verified! ✅"); setEmailMode("view"); setOtpInput(""); fetchSecStatus(); }
    } catch { toast.error("Network error"); }
    setVerifyingOtp(false);
  }

  // ── Auto-schedule: go online at shift start, offline at shift end ──
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!shiftEnabled || !user) return;
    let prevWithin: boolean | null = null;

    async function forceStatus(online: boolean) {
      try {
        await fetch("/api/rider/status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ isAvailable: online }),
        });
        setRiderStatus(online ? "online" : "offline");
        riderStatusRef.current = online ? "online" : "offline";
        toast.success(
          online ? "Shift started — You are Online 🟢" : "Shift ended — You are Offline 🔴",
          { duration: 4000 }
        );
      } catch { /* non-critical */ }
    }

    function tick() {
      const within = isWithinShift(shiftStart, shiftEnd);
      if (prevWithin !== null) {
        // Only go online at shift start if NOT on leave
        if (within && !prevWithin && !isOnLeave(leaveStart, leaveEnd))  forceStatus(true);  // shift started
        if (!within && prevWithin)  forceStatus(false);  // shift ended
      }
      prevWithin = within;
    }

    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftEnabled, shiftStart, shiftEnd, leaveStart, leaveEnd, user]);

  // ── Leave auto-offline: keep rider offline during leave period ────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user) return;

    async function checkLeave() {
      if (isOnLeave(leaveStart, leaveEnd) && riderStatusRef.current === "online") {
        try {
          await fetch("/api/rider/status", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ isAvailable: false }),
          });
          setRiderStatus("offline");
          riderStatusRef.current = "offline";
          toast("You are on leave — set to Offline 🗓️", { icon: "🛑", duration: 4000 });
        } catch { /* non-critical */ }
      }
    }

    checkLeave(); // immediate check on mount / leave change
    const timer = setInterval(checkLeave, 60_000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaveStart, leaveEnd, user]);

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

      {/* ── Shift Timing ─────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden mb-4" style={sectionStyle}>
        <div className="px-6 py-4 flex items-center justify-between" style={sectionHeaderStyle}>
          <p className="font-bold text-base flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Clock size={16} className="text-orange-500" /> My Shift Timing
          </p>
          {/* Toggle switch */}
          <button
            onClick={() => setShiftEnabled(p => !p)}
            title={shiftEnabled ? "Disable auto-schedule" : "Enable auto-schedule"}
            className={`relative w-12 h-6 rounded-full transition-all duration-300 ${shiftEnabled ? "bg-green-500" : "bg-gray-400"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${shiftEnabled ? "translate-x-6" : "translate-x-0"}`} />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {shiftEnabled
              ? "Auto-schedule is ON. You will go online at shift start and offline when shift ends."
              : "Enable auto-schedule to automatically manage your online/offline status."}
          </p>
          <div className={`space-y-4 transition-opacity duration-300 ${shiftEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                  <Clock size={13} /> Shift Start
                </label>
                <input type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)}
                  className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                  <Clock size={13} /> Shift End
                </label>
                <input type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)}
                  className={inputCls} style={inputStyle} />
              </div>
            </div>
            {shiftEnabled && (
              <div className="rounded-xl p-4 flex items-start gap-3"
                style={{
                  background: isWithinShift(shiftStart, shiftEnd) ? "rgba(22,163,74,0.08)" : "rgba(249,115,22,0.08)",
                  border: `1px solid ${isWithinShift(shiftStart, shiftEnd) ? "rgba(22,163,74,0.25)" : "rgba(249,115,22,0.25)"}`
                }}>
                <Clock size={16} className={`shrink-0 mt-0.5 ${isWithinShift(shiftStart, shiftEnd) ? "text-green-500" : "text-orange-500"}`} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {isWithinShift(shiftStart, shiftEnd) ? "🟢 Shift is Active Right Now" : "⏳ Outside Shift Hours"}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {shiftStart} – {shiftEnd} · You can still go offline manually anytime during shift
                  </p>
                </div>
              </div>
            )}
          </div>
          <button onClick={saveShiftSettings} disabled={savingShift}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-bold text-white gradient-brand transition-all hover:opacity-90 disabled:opacity-60">
            {savingShift ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {savingShift ? "Saving..." : "Save Shift Settings"}
          </button>
        </div>
      </div>

      {/* ── Days Off / Leave ──────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden mb-4" style={sectionStyle}>
        <div className="px-6 py-4 flex items-center gap-3" style={sectionHeaderStyle}>
          <Calendar size={16} className="text-purple-500" />
          <p className="font-bold text-base" style={{ color: "var(--text-primary)" }}>Days Off / Leave</p>
          {isOnLeave(leaveStart, leaveEnd) && (
            <span className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
              🛑 On Leave
            </span>
          )}
        </div>
        <div className="p-6 space-y-5">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Select a date range for your days off. You will be automatically kept offline during this period.
          </p>

          {/* Active leave warning */}
          {isOnLeave(leaveStart, leaveEnd) && (
            <div className="rounded-xl p-4 flex items-start justify-between gap-3"
              style={{ background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.25)" }}>
              <div className="flex items-start gap-3">
                <span className="text-xl">🛑</span>
                <div>
                  <p className="text-sm font-semibold text-red-500">Leave Active</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {new Date(leaveStart + "T12:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    {" → "}
                    {new Date(leaveEnd + "T12:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
              <button onClick={cancelLeave}
                className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                style={{ background: "rgba(220,38,38,0.12)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.3)" }}>
                Cancel Leave
              </button>
            </div>
          )}

          {/* Date pickers */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                <Calendar size={13} /> Leave Start
              </label>
              <input type="date" value={leaveStart}
                min={new Date().toLocaleDateString("en-CA")}
                onChange={(e) => setLeaveStart(e.target.value)}
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                <Calendar size={13} /> Leave End
              </label>
              <input type="date" value={leaveEnd}
                min={leaveStart || new Date().toLocaleDateString("en-CA")}
                onChange={(e) => setLeaveEnd(e.target.value)}
                className={inputCls} style={inputStyle} />
            </div>
          </div>

          <button onClick={saveLeaveSettings} disabled={savingLeave || !leaveStart || !leaveEnd}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
            {savingLeave ? <Loader2 size={18} className="animate-spin" /> : <Calendar size={18} />}
            {savingLeave ? "Saving..." : "Set Days Off"}
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

      {/* ── Account Security ─────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden mb-5" style={sectionStyle}>
        <button
          onClick={() => { setSecOpen(o => !o); if (!secStatus) fetchSecStatus(); }}
          className="w-full px-6 py-4 flex items-center justify-between"
          style={sectionHeaderStyle}
        >
          <p className="font-bold text-base flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Shield size={16} className="text-green-500" /> Account Security
            {secStatus && (secStatus.hasPIN && secStatus.hasRecoveryEmail)
              ? <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">✅ Secured</span>
              : secStatus
              ? <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">⚠️ Incomplete</span>
              : null}
          </p>
          <span style={{ color: "var(--text-muted)", fontSize: 18 }}>{secOpen ? "▲" : "▼"}</span>
        </button>

        {secOpen && (
          <div className="px-6 pb-6 space-y-5">
            {secLoading ? (
              <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-orange-400" /></div>
            ) : (
              <>
                {/* Owner/Rider: show their login email as default */}
                <div className="rounded-xl p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-3 mb-3">
                    <Mail size={16} className="text-blue-500" />
                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Recovery Email</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>Reset link isi email pe aayega</p>
                    </div>
                    {secStatus?.hasRecoveryEmail && <CheckCircle size={16} className="text-green-500" />}
                  </div>
                  <p className="text-xs px-3 py-2 rounded-lg mb-3 bg-blue-50 text-blue-700 border border-blue-100">
                    ℹ️ Aapka login email ({email}) automatically recovery ke liye available hai.
                    Aap chahen to alag email bhi set kar sakte hain.
                  </p>
                  {secStatus?.recoveryEmail && emailMode === "view" && (
                    <p className="text-xs px-3 py-2 rounded-lg mb-3" style={{ background: "var(--card-bg)", color: "var(--text-secondary)" }}>
                      📧 Custom: {secStatus.recoveryEmail}
                    </p>
                  )}
                  {emailMode === "view" && (
                    <button onClick={() => { setEmailMode("link"); setEmailInput(secStatus?.recoveryEmail ?? ""); }}
                      className="text-xs font-semibold px-3 py-2 rounded-lg transition-all"
                      style={{ background: "var(--card-bg)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                      {secStatus?.recoveryEmail ? "Change Custom Email" : "Set Custom Recovery Email"}
                    </button>
                  )}
                  {emailMode === "link" && (
                    <div className="space-y-2">
                      <input type="email" placeholder="you@example.com" value={emailInput}
                        onChange={e => setEmailInput(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none"
                        style={{ background: "var(--card-bg)", border: "1.5px solid var(--border)", color: "var(--text-primary)" }} />
                      <div className="flex gap-2">
                        <button onClick={handleSendOtp} disabled={sendingOtp}
                          className="flex-1 py-2 rounded-lg font-bold text-xs text-white gradient-brand disabled:opacity-60 flex items-center justify-center gap-1">
                          {sendingOtp ? <Loader2 size={12} className="animate-spin" /> : "Send OTP"}
                        </button>
                        <button onClick={() => setEmailMode("view")} className="px-3 py-2 rounded-lg text-xs"
                          style={{ background: "var(--card-bg)", color: "var(--text-muted)" }}>Cancel</button>
                      </div>
                    </div>
                  )}
                  {emailMode === "otp" && (
                    <div className="space-y-2">
                      <p className="text-xs text-green-600">✅ OTP bhej diya — email check karein</p>
                      <input type="text" inputMode="numeric" placeholder="6-digit OTP" maxLength={6} value={otpInput}
                        onChange={e => setOtpInput(e.target.value.replace(/\D/g,"").slice(0,6))}
                        className="w-full px-3 py-2.5 rounded-xl text-sm text-center tracking-widest font-bold focus:outline-none"
                        style={{ background: "var(--card-bg)", border: "1.5px solid var(--border)", color: "var(--text-primary)" }} />
                      <div className="flex gap-2">
                        <button onClick={handleVerifyOtp} disabled={verifyingOtp || otpInput.length < 6}
                          className="flex-1 py-2 rounded-lg font-bold text-xs text-white gradient-brand disabled:opacity-60 flex items-center justify-center gap-1">
                          {verifyingOtp ? <Loader2 size={12} className="animate-spin" /> : "Verify"}
                        </button>
                        <button onClick={() => { setEmailMode("link"); setOtpInput(""); }}
                          className="px-3 py-2 rounded-lg text-xs" style={{ background: "var(--card-bg)", color: "var(--text-muted)" }}>
                          Resend
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Recovery PIN */}
                <div className="rounded-xl p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-3 mb-3">
                    <Lock size={16} className="text-green-500" />
                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Recovery PIN</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>4-digit PIN se password reset karein</p>
                    </div>
                    {secStatus?.hasPIN && <CheckCircle size={16} className="text-green-500" />}
                  </div>
                  {!secStatus?.hasPIN && pinMode === "view" && (
                    <p className="text-xs mb-3 px-3 py-2 rounded-lg bg-orange-50 text-orange-700 border border-orange-100">⚠️ PIN set nahi hai</p>
                  )}
                  {pinMode === "view" && (
                    <div className="flex gap-2">
                      <button onClick={() => { setPinMode(secStatus?.hasPIN ? "change" : "set"); setPinInput(""); setPinConfirm(""); }}
                        className="text-xs font-semibold px-3 py-2 rounded-lg"
                        style={{ background: "var(--card-bg)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                        {secStatus?.hasPIN ? "Change PIN" : "Set PIN"}
                      </button>
                      {secStatus?.hasPIN && (
                        <button onClick={handleRemovePin} className="text-xs font-semibold px-3 py-2 rounded-lg text-red-500"
                          style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>Remove</button>
                      )}
                    </div>
                  )}
                  {(pinMode === "set" || pinMode === "change") && (
                    <div className="space-y-2">
                      <input type="password" inputMode="numeric" placeholder="New 4-digit PIN" maxLength={4}
                        value={pinInput} onChange={e => setPinInput(e.target.value.replace(/\D/g,"").slice(0,4))}
                        className="w-full text-center py-3 rounded-xl text-xl font-black tracking-[0.5em] focus:outline-none"
                        style={{ background: "var(--card-bg)", border: "1.5px solid var(--border)", color: "var(--text-primary)" }} />
                      <input type="password" inputMode="numeric" placeholder="Confirm PIN" maxLength={4}
                        value={pinConfirm} onChange={e => setPinConfirm(e.target.value.replace(/\D/g,"").slice(0,4))}
                        className="w-full text-center py-3 rounded-xl text-xl font-black tracking-[0.5em] focus:outline-none"
                        style={{ background: "var(--card-bg)", border: "1.5px solid var(--border)", color: "var(--text-primary)" }} />
                      <div className="flex gap-2">
                        <button onClick={handleSavePin} disabled={savingPin || pinInput.length < 4}
                          className="flex-1 py-2 rounded-lg font-bold text-xs text-white gradient-brand disabled:opacity-60 flex items-center justify-center gap-1">
                          {savingPin ? <Loader2 size={12} className="animate-spin" /> : "Save PIN"}
                        </button>
                        <button onClick={() => setPinMode("view")}
                          className="px-3 py-2 rounded-lg text-xs" style={{ background: "var(--card-bg)", color: "var(--text-muted)" }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
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
