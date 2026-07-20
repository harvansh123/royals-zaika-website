"use client";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  User, Phone, Mail, Save, Loader2, Package,
  ChevronRight, LogOut, LayoutDashboard, ChefHat,
  MapPin, Plus, Trash2, Navigation, Star, Home, Briefcase,
  Lock, Eye, EyeOff, ExternalLink
} from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { Order, Address } from "@/lib/database.types";
import { formatPrice, formatDate, ORDER_STATUS_CONFIG, validateIndianPhone } from "@/lib/utils";
import { cn } from "@/lib/utils";
import SupportTicketModal from "@/components/support/SupportTicketModal";
import TicketHistoryList from "@/components/support/TicketHistoryList";
import { HelpCircle } from "lucide-react";
import { performSignOut } from "@/lib/sign-out";

type Tab = "profile" | "orders" | "addresses" | "password" | "support";

const LABEL_ICONS: Record<string, React.ReactNode> = {
  Home:  <Home size={14} />,
  Work:  <Briefcase size={14} />,
  Other: <MapPin size={14} />,
};

export default function ProfilePage() {
  const { user, setUser, loading: authLoading } = useAuthStore();
  const router = useRouter();

  const [tab, setTab]                 = useState<Tab>("profile");
  const [saving, setSaving]           = useState(false);
  const [signingOut, setSigningOut]   = useState(false);
  const [orders, setOrders]           = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [addresses, setAddresses]     = useState<Address[]>([]);
  const [addrLoading, setAddrLoading] = useState(false);
  const [locating, setLocating]       = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm]               = useState({ name: "", phone: "", email: "" });
  const [newPass, setNewPass]         = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfPass, setShowConfPass] = useState(false);
  const [savingPass, setSavingPass]   = useState(false);
  const [newAddr, setNewAddr]         = useState({
    label: "Home", address_line1: "", address_line2: "",
    city: "Varanasi", state: "Uttar Pradesh", pincode: "",
    latitude: null as number | null, longitude: null as number | null,
  });
  const [showSupportModal, setShowSupportModal] = useState(false);

  // Redirect only after auth has fully loaded
  useEffect(() => {
    if (!authLoading && !user) router.push("/auth/login");
    if (user) setForm({ name: user.name ?? "", phone: user.phone ?? "", email: user.email ?? "" });
  }, [user, authLoading]);

  // Load orders
  useEffect(() => {
    if (tab === "orders" && user) {
      setOrdersLoading(true);
      supabase.from("orders").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(20)
        .then(({ data }) => { setOrders(data ?? []); setOrdersLoading(false); });
    }
  }, [tab, user]);

  // Load addresses
  useEffect(() => {
    if (tab === "addresses" && user) {
      setAddrLoading(true);
      supabase.from("addresses").select("*").eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .then(({ data }) => { setAddresses(data ?? []); setAddrLoading(false); });
    }
  }, [tab, user]);

  async function handleSave() {
    if (!user) return;
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    // Validate phone if provided
    if (form.phone.trim() && !validateIndianPhone(form.phone)) {
      toast.error("Enter a valid 10-digit Indian mobile number (starting with 6–9)");
      return;
    }
    setSaving(true);
    try {
      const res  = await fetch("/api/customer/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: form.name.trim(), phone: form.phone.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to update profile");
      } else {
        setUser({ ...user, ...json.user });
        toast.success("Profile updated! ✅");
      }
    } catch {
      toast.error("Network error. Please try again.");
    }
    setSaving(false);
  }

  // ── Change Password ───────────────────────────────────────────────────
  async function handleChangePassword() {
    if (!newPass) { toast.error("Enter a new password"); return; }
    if (newPass.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (newPass !== confirmPass) { toast.error("Passwords don't match"); return; }
    setSavingPass(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) toast.error(error.message);
    else {
      setNewPass(""); setConfirmPass("");
      toast.success("Password changed! 🔐");
    }
    setSavingPass(false);
  }

  // ── Sign Out ────────────────────────────────────────────────────────────────────
  async function handleSignOut() {
    setSigningOut(true);
    toast.success("Signed out successfully");
    setUser(null);
    await performSignOut();
  }

  // ── Use Current Location ─────────────────────────────────────────────
  async function handleUseLocation() {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by your browser");
      return;
    }
    setLocating(true);
    toast.loading("Getting your location...", { id: "location" });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          // Reverse geocode using OpenStreetMap Nominatim (free, no API key)
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
            { headers: { "Accept-Language": "en" } }
          );
          const geo = await res.json();
          const a   = geo.address ?? {};

          setNewAddr((prev) => ({
            ...prev,
            address_line1: [a.road, a.neighbourhood, a.suburb].filter(Boolean).join(", ") || geo.display_name?.split(",")[0] || "",
            address_line2: a.village || a.town || "",
            city:    a.city || a.county || a.state_district || "Varanasi",
            state:   a.state || "Uttar Pradesh",
            pincode: a.postcode || "",
            latitude,
            longitude,
          }));
          setShowAddForm(true);
          toast.success("Location detected! Please verify the address.", { id: "location" });
        } catch {
          toast.error("Could not fetch address. Fill manually.", { id: "location" });
          setNewAddr((prev) => ({ ...prev, latitude, longitude }));
          setShowAddForm(true);
        }
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        toast.dismiss("location");
        if (err.code === 1) toast.error("Location permission denied. Please allow access in browser settings.");
        else toast.error("Could not get location. Please enter address manually.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // ── Save New Address ─────────────────────────────────────────────────
  async function handleSaveAddress() {
    if (!user) return;
    if (!newAddr.address_line1.trim()) { toast.error("Please enter address line 1"); return; }
    if (!newAddr.pincode.trim())       { toast.error("Please enter pincode"); return; }

    const { data, error } = await supabase.from("addresses").insert({
      user_id:       user.id,
      label:         newAddr.label,
      address_line1: newAddr.address_line1.trim(),
      address_line2: newAddr.address_line2.trim() || null,
      city:          newAddr.city.trim(),
      state:         newAddr.state.trim(),
      pincode:       newAddr.pincode.trim(),
      latitude:      newAddr.latitude,
      longitude:     newAddr.longitude,
      is_default:    addresses.length === 0,
    } as any).select().single();

    if (error) { toast.error("Failed to save address"); return; }
    setAddresses((prev) => [data, ...prev]);
    setShowAddForm(false);
    setNewAddr({ label: "Home", address_line1: "", address_line2: "", city: "Varanasi", state: "Uttar Pradesh", pincode: "", latitude: null, longitude: null });
    toast.success("Address saved! 📍");
  }

  // ── Delete Address ───────────────────────────────────────────────────
  async function handleDeleteAddress(id: string) {
    const { error } = await supabase.from("addresses").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { setAddresses((prev) => prev.filter((a) => a.id !== id)); toast.success("Address removed"); }
  }

  // ── Set Default Address ──────────────────────────────────────────────
  async function handleSetDefault(id: string) {
    if (!user) return;
    // Remove default from all
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
    // Set default on selected
    await supabase.from("addresses").update({ is_default: true }).eq("id", id);
    setAddresses((prev) => prev.map((a) => ({ ...a, is_default: a.id === id })));
    toast.success("Default address updated!");
  }

  // ── Loading Guard ────────────────────────────────────────────────────
  if (authLoading || !user) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={36} className="animate-spin text-orange-500" />
    </div>
  );

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "profile",   label: "Profile",   icon: <User size={15} /> },
    { id: "orders",    label: "Orders",    icon: <Package size={15} /> },
    { id: "addresses", label: "Addresses", icon: <MapPin size={15} /> },
    { id: "support",   label: "Support",   icon: <HelpCircle size={15} /> },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-28">

      {/* ── Header Card ── */}
      <div className="rounded-2xl p-5 mb-5 flex items-center gap-4"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
        <div className="w-16 h-16 gradient-brand rounded-2xl flex items-center justify-center text-2xl font-black shadow-brand flex-shrink-0">
          {user.name?.[0]?.toUpperCase() ?? "U"}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg truncate" style={{ color: "var(--text-primary)", fontFamily: "'Outfit',sans-serif" }}>
            {user.name || "My Profile"}
          </h1>
          <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>{user.email}</p>
          <span className="inline-block mt-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize"
            style={{ background: "rgba(249,115,22,0.15)", color: "#f97316" }}>
            {user.role === "restaurant_owner" ? "🍴 Restaurant Owner" : user.role === "admin" ? "⚡ Admin" : "🧑 Customer"}
          </span>
        </div>
        {/* Prominent Sign Out button — always visible in header */}
        <button onClick={handleSignOut} disabled={signingOut}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-50 shrink-0"
          style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
          {signingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
          <span className="hidden sm:inline">{signingOut ? "Signing out..." : "Sign Out"}</span>
        </button>
      </div>

      {/* ── Owner / Admin Quick Link ── */}
      {(user.role === "restaurant_owner" || user.role === "admin") && (
        <Link href={user.role === "restaurant_owner" ? "/owner" : "/admin"}
          className="flex items-center justify-between px-5 py-3.5 rounded-2xl mb-4 transition-all group"
          style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)" }}>
          <div className="flex items-center gap-3">
            {user.role === "restaurant_owner"
              ? <ChefHat size={18} className="text-orange-500" />
              : <LayoutDashboard size={18} className="text-orange-500" />}
            <div>
              <p className="font-semibold text-sm text-orange-500">
                {user.role === "restaurant_owner" ? "Owner Dashboard" : "Admin Panel"}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Manage orders, menu &amp; more</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-orange-400 group-hover:translate-x-1 transition-transform" />
        </Link>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 rounded-xl mb-5 overflow-x-auto no-scrollbar" style={{ background: "var(--bg-secondary)" }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap min-w-[60px]"
            style={tab === t.id
              ? { background: "var(--card-bg)", color: "#f97316", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }
              : { color: "var(--text-muted)" }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════ TAB: PROFILE ══ */}
      {tab === "profile" && (
        <div className="rounded-2xl p-4 sm:p-6 space-y-4" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
          <h3 className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Personal Details</h3>

          <div>
            <label className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>Full Name</label>
            <div className="relative">
              <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="input-field pl-11" placeholder="Your full name" />
            </div>
          </div>

          <div>
            <label className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>Mobile Number</label>
            <div className="relative">
              <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="input-field pl-11" placeholder="e.g. 9876543210" type="tel" maxLength={13} />
            </div>
            {form.phone.trim() && !validateIndianPhone(form.phone) && (
              <p className="text-xs text-red-400 mt-1 ml-1">Enter a valid 10-digit Indian mobile number</p>
            )}
          </div>

          <div>
            <label className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>Email (read-only)</label>
            <div className="relative">
              <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input value={form.email} readOnly className="input-field pl-11 opacity-50 cursor-not-allowed" />
            </div>
          </div>

          <button onClick={handleSave} disabled={saving}
            className="btn-primary flex items-center justify-center gap-2 w-full py-3">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════ TAB: ORDERS ══ */}
      {tab === "orders" && (
        <div>
          {ordersLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={32} className="animate-spin text-orange-500" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-14 rounded-2xl" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
              <Package size={44} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
              <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No orders yet</p>
              <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>Place your first order!</p>
              <Link href="/menu" className="btn-primary inline-block px-8 py-2.5">Order Now</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const cfg = ORDER_STATUS_CONFIG[order.status];
                return (
                  <Link key={order.id} href={`/track/${order.id}`}
                    className="flex items-center justify-between px-5 py-4 rounded-2xl group transition-all"
                    style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{cfg.icon}</span>
                      <div>
                        <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>#{order.order_number}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{formatDate(order.created_at)}</p>
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 inline-block", cfg.color)}>
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-orange-500">{formatPrice(order.total_amount)}</span>
                      <div className="flex items-center gap-1">
                        <ExternalLink size={12} style={{ color: "var(--text-muted)" }} />
                        <ChevronRight size={15} style={{ color: "var(--text-muted)" }} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: ADDRESSES ══ */}
      {tab === "addresses" && (
        <div className="space-y-4">

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleUseLocation} disabled={locating}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
              style={{ background: "rgba(249,115,22,0.12)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)" }}>
              {locating ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
              {locating ? "Locating..." : "Use My Location"}
            </button>
            <button onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              <Plus size={16} /> Add Address
            </button>
          </div>

          {/* Add Address Form */}
          {showAddForm && (
            <div className="rounded-2xl p-5 space-y-3 animate-slide-bottom"
              style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
              <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>New Address</h3>

              {/* Label selector */}
              <div className="flex gap-2">
                {["Home", "Work", "Other"].map((l) => (
                  <button key={l} onClick={() => setNewAddr((p) => ({ ...p, label: l }))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={newAddr.label === l
                      ? { background: "rgba(249,115,22,0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)" }
                      : { background: "var(--bg-secondary)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                    {LABEL_ICONS[l]} {l}
                  </button>
                ))}
              </div>

              <input placeholder="Address Line 1 *" className="input-field"
                value={newAddr.address_line1}
                onChange={(e) => setNewAddr((p) => ({ ...p, address_line1: e.target.value }))} />

              <input placeholder="Landmark / Area (optional)" className="input-field"
                value={newAddr.address_line2}
                onChange={(e) => setNewAddr((p) => ({ ...p, address_line2: e.target.value }))} />

              <div className="grid grid-cols-2 gap-3">
                <input placeholder="City *" className="input-field"
                  value={newAddr.city}
                  onChange={(e) => setNewAddr((p) => ({ ...p, city: e.target.value }))} />
                <input placeholder="Pincode *" className="input-field" maxLength={6}
                  value={newAddr.pincode}
                  onChange={(e) => setNewAddr((p) => ({ ...p, pincode: e.target.value }))} />
              </div>

              {newAddr.latitude && (
                <p className="text-xs flex items-center gap-1" style={{ color: "#22c55e" }}>
                  <Navigation size={12} /> Location coordinates saved
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={handleSaveAddress}
                  className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
                  <Save size={15} /> Save Address
                </button>
                <button onClick={() => setShowAddForm(false)}
                  className="flex-1 py-2.5 text-sm rounded-xl font-medium transition-all"
                  style={{ background: "var(--bg-secondary)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Saved Addresses List */}
          {addrLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={28} className="animate-spin text-orange-500" />
            </div>
          ) : addresses.length === 0 && !showAddForm ? (
            <div className="text-center py-12 rounded-2xl" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
              <MapPin size={40} className="mx-auto mb-3 text-orange-500 opacity-40" />
              <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No saved addresses</p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Add an address to speed up checkout</p>
            </div>
          ) : (
            <div className="space-y-3">
              {addresses.map((addr) => (
                <div key={addr.id} className="rounded-2xl p-4"
                  style={{ background: "var(--card-bg)", border: `1px solid ${addr.is_default ? "rgba(249,115,22,0.4)" : "var(--border)"}` }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: addr.is_default ? "rgba(249,115,22,0.15)" : "var(--bg-secondary)" }}>
                        <span style={{ color: addr.is_default ? "#f97316" : "var(--text-muted)" }}>
                          {LABEL_ICONS[addr.label] ?? <MapPin size={14} />}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{addr.label}</p>
                          {addr.is_default && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(249,115,22,0.15)", color: "#f97316" }}>
                              ★ Default
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{addr.address_line1}</p>
                        {addr.address_line2 && (
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{addr.address_line2}</p>
                        )}
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {addr.city}, {addr.state} — {addr.pincode}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 flex-shrink-0">
                      {!addr.is_default && (
                        <button onClick={() => handleSetDefault(addr.id)}
                          title="Set as default"
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-orange-500/10"
                          style={{ color: "var(--text-muted)" }}>
                          <Star size={14} />
                        </button>
                      )}
                      <button onClick={() => handleDeleteAddress(addr.id)}
                        title="Delete address"
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-red-500/10"
                        style={{ color: "var(--text-muted)" }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: CHANGE PASSWORD ══ */}
      {tab === "password" && (
        <div className="rounded-2xl p-6 space-y-4" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Lock size={16} style={{ color: "var(--text-muted)" }} />
            <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Change Password</h3>
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Use at least 6 characters for a strong password.</p>

          {/* New Password */}
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>New Password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                type={showNewPass ? "text" : "password"}
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Minimum 6 characters"
                className="input-field pl-11 pr-11"
              />
              <button type="button"
                onClick={() => setShowNewPass((p) => !p)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}>
                {showNewPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>Confirm Password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                type={showConfPass ? "text" : "password"}
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="Re-enter new password"
                className="input-field pl-11 pr-11"
                style={{
                  border: confirmPass && confirmPass !== newPass
                    ? "1px solid #ef4444"
                    : confirmPass && confirmPass === newPass
                      ? "1px solid #22c55e"
                      : undefined
                }}
              />
              <button type="button"
                onClick={() => setShowConfPass((p) => !p)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}>
                {showConfPass ? <EyeOff size={15} /> : <Eye size={15} />}
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
            onClick={handleChangePassword}
            disabled={savingPass || !newPass || !confirmPass || newPass !== confirmPass || newPass.length < 6}
            className="btn-primary flex items-center justify-center gap-2 w-full py-3 disabled:opacity-50">
            {savingPass ? <><Loader2 size={16} className="animate-spin" /> Changing...</> : <><Lock size={16} /> Change Password</>}
          </button>
        </div>
      )}

      {/* ══ TAB: HELP & SUPPORT ══ */}
      {tab === "support" && (
        <div className="space-y-4">
          <div className="rounded-2xl p-5" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>Help & Support</h3>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Facing an issue? We're here to help.</p>
              </div>
              <button onClick={() => setShowSupportModal(true)}
                className="btn-primary flex items-center gap-2 py-2 px-4 text-sm rounded-xl">
                <HelpCircle size={15} /> Get Help
              </button>
            </div>
            
            <div className="mt-6">
              <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>My Support Tickets</h4>
              <TicketHistoryList userType="customer" />
            </div>
          </div>
        </div>
      )}

      {/* ── Sign Out Button ── */}
      <button onClick={handleSignOut} disabled={signingOut}
        className="w-full flex items-center justify-center gap-2 mt-6 py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
        style={{ border: "1px solid rgba(239,68,68,0.4)", color: "#ef4444", background: "rgba(239,68,68,0.05)" }}>
        {signingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
        {signingOut ? "Signing out..." : "Sign Out"}
      </button>
      <SupportTicketModal 
        isOpen={showSupportModal} 
        onClose={() => setShowSupportModal(false)}
        userType="customer"
        defaultName={user.name || ""}
        defaultEmail={user.email || ""}
        defaultPhone={user.phone || ""}
      />
    </div>
  );
}
