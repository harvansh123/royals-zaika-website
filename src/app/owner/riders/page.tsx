"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "next/navigation";
import {
  Users, Search, Filter, RefreshCw, Loader2, Bike,
  Wifi, WifiOff, CheckCircle, XCircle, AlertTriangle,
  Clock, Package, Star, ChevronRight, Phone, Mail,
  Eye, ShieldOff, ShieldCheck, ShieldAlert, Shield,
  TrendingUp, Calendar, ArrowUpRight
} from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";

type AccountStatus = "active" | "disabled" | "suspended" | "blocked";

type Rider = {
  id: string;
  name: string;
  phone: string;
  email: string;
  avatar_url: string | null;
  vehicle_type: string;
  vehicle_number: string;
  is_available: boolean;
  is_busy: boolean;
  total_deliveries: number;
  today_deliveries: number;
  today_earnings: number;
  rating: number;
  account_status: AccountStatus;
  suspension_end: string | null;
  suspension_reason: string | null;
  blocked_reason: string | null;
  joined_at: string;
  created_at: string;
};

type FilterStatus = "all" | AccountStatus | "online" | "offline";

const STATUS_CONFIG: Record<AccountStatus, { label: string; color: string; bg: string; border: string; icon: any }> = {
  active:    { label: "Active",    color: "text-green-600",  bg: "bg-green-50",  border: "border-green-200", icon: ShieldCheck  },
  disabled:  { label: "Disabled",  color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200",icon: ShieldOff    },
  suspended: { label: "Suspended", color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-200", icon: ShieldAlert  },
  blocked:   { label: "Blocked",   color: "text-red-600",    bg: "bg-red-50",    border: "border-red-200",   icon: Shield       },
};

export default function OwnerRidersPage() {
  const { user, loading: authLoading } = useAuthStore();
  const router = useRouter();

  const [riders,       setRiders]       = useState<Rider[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [searchQuery,  setSearchQuery]  = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");

  // Modal state
  const [actionModal,   setActionModal]   = useState<{ rider: Rider; type: "block" | "unblock" | "disable" | "activate" | "suspend" } | null>(null);
  const [actionReason,  setActionReason]  = useState("");
  const [suspendEnd,    setSuspendEnd]    = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== "restaurant_owner" && user.role !== "admin"))) {
      router.push("/auth/login");
    }
  }, [user, authLoading, router]);

  const loadRiders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/owner/riders?status=all");
      const json = await res.json();
      if (res.ok) setRiders(json.riders ?? []);
      else toast.error(json.error ?? "Failed to load riders");
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === "restaurant_owner" || user?.role === "admin") loadRiders();
  }, [user, loadRiders]);

  // ── Supabase Realtime — delivery_partners ───────────────────────────────
  // Subscribe once per mount. When any rider changes is_available or is_busy,
  // update that rider's row in-place — no full refetch, no page refresh needed.
  useEffect(() => {
    if (!user?.role || (user.role !== "restaurant_owner" && user.role !== "admin")) return;

    const channel = supabase
      .channel("owner_riders_availability")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "delivery_partners" },
        (payload) => {
          const updated = payload.new as any;
          if (!updated?.id) return;
          setRiders((prev) =>
            prev.map((r) =>
              r.id === updated.id
                ? {
                    ...r,
                    is_available: updated.is_available ?? r.is_available,
                    is_busy:      updated.is_busy      ?? r.is_busy,
                  }
                : r
            )
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.role]);

  // Filter + search
  const filteredRiders = riders.filter(r => {
    const matchSearch = !searchQuery ||
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.phone.includes(searchQuery) ||
      r.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.vehicle_number ?? "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchFilter =
      filterStatus === "all" ? true :
      filterStatus === "online" ? r.is_available && r.account_status === "active" :
      filterStatus === "offline" ? (!r.is_available || r.account_status !== "active") :
      r.account_status === filterStatus;

    return matchSearch && matchFilter;
  });

  // Summary counts
  const counts = {
    total:     riders.length,
    online:    riders.filter(r => r.is_available && r.account_status === "active").length,
    offline:   riders.filter(r => !r.is_available && r.account_status === "active").length,
    busy:      riders.filter(r => r.is_busy).length,
    active:    riders.filter(r => r.account_status === "active").length,
    disabled:  riders.filter(r => r.account_status === "disabled").length,
    suspended: riders.filter(r => r.account_status === "suspended").length,
    blocked:   riders.filter(r => r.account_status === "blocked").length,
  };

  async function performAction() {
    if (!actionModal || !user) return;
    setActionLoading(true);

    const { rider, type } = actionModal;

    const statusMap: Record<string, AccountStatus> = {
      block:    "blocked",
      unblock:  "active",
      disable:  "disabled",
      activate: "active",
      suspend:  "suspended",
    };

    try {
      const body: any = {
        account_status: statusMap[type],
        action:         type,
        owner_id:       user.id,
        owner_name:     user.name ?? "Owner",
        reason:         actionReason || undefined,
      };
      if (type === "suspend") {
        body.suspension_end    = suspendEnd || undefined;
        body.suspension_reason = actionReason || undefined;
      }

      const res = await fetch(`/api/owner/riders/${rider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error);

      toast.success(`Rider ${rider.name} — ${type} action applied ✅`);
      setActionModal(null);
      setActionReason("");
      setSuspendEnd("");
      loadRiders(true);
    } catch (e: any) {
      toast.error(e.message ?? "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  if (authLoading || !user) return (
    <div className="flex items-center justify-center h-screen" style={{ background: "var(--bg-primary)" }}>
      <Loader2 size={32} className="animate-spin text-orange-500" />
    </div>
  );

  const cardStyle = {
    background: "var(--card-bg)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
  };

  return (
    <div className="px-4 sm:px-6 py-6 pb-24 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2" style={{ fontFamily: "'Outfit',sans-serif", color: "var(--text-primary)" }}>
            <Users className="text-orange-500" size={26} /> Rider Management
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Monitor and control all delivery riders from one place</p>
        </div>
        <button onClick={() => loadRiders(true)} disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        {[
          { label: "Total",     value: counts.total,     color: "text-slate-600",  emoji: "👥" },
          { label: "Online",    value: counts.online,    color: "text-green-600",  emoji: "🟢" },
          { label: "Offline",   value: counts.offline,   color: "text-slate-500",  emoji: "⚫" },
          { label: "Busy",      value: counts.busy,      color: "text-blue-600",   emoji: "🚴" },
          { label: "Active",    value: counts.active,    color: "text-green-600",  emoji: "✅" },
          { label: "Disabled",  value: counts.disabled,  color: "text-orange-600", emoji: "🔕" },
          { label: "Suspended", value: counts.suspended, color: "text-amber-600",  emoji: "⏸️" },
          { label: "Blocked",   value: counts.blocked,   color: "text-red-600",    emoji: "🚫" },
        ].map(({ label, value, color, emoji }) => (
          <div key={label} className="rounded-2xl p-3 text-center" style={cardStyle}>
            <p className="text-lg mb-0.5">{emoji}</p>
            <p className={`text-xl font-black ${color}`}>{value}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, email, vehicle..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/20"
            style={{ background: "var(--input-bg)", border: "1.5px solid var(--border)", color: "var(--text-primary)" }}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
          {(["all","online","offline","active","disabled","suspended","blocked"] as FilterStatus[]).map(f => (
            <button key={f} onClick={() => setFilterStatus(f)}
              className={cn("px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all capitalize",
                filterStatus === f
                  ? "bg-orange-500 text-white border-orange-500"
                  : "border-transparent"
              )}
              style={filterStatus !== f ? { background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" } : {}}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Rider List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3" style={{ color: "var(--text-muted)" }}>
          <Loader2 size={24} className="animate-spin text-orange-500" /> Loading riders...
        </div>
      ) : filteredRiders.length === 0 ? (
        <div className="text-center py-20">
          <Users size={48} className="mx-auto mb-4 opacity-20" style={{ color: "var(--text-muted)" }} />
          <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No riders found</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {searchQuery ? "Try a different search term." : "No riders registered yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRiders.map(rider => {
            const sc = STATUS_CONFIG[rider.account_status];
            const StatusIcon = sc.icon;
            const isOnline = rider.is_available && rider.account_status === "active";
            const isSuspended = rider.account_status === "suspended";
            const isSuspendedActive = isSuspended && rider.suspension_end && new Date(rider.suspension_end) > new Date();

            return (
              <div key={rider.id} className="rounded-2xl overflow-hidden" style={cardStyle}>
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {rider.avatar_url ? (
                        <div className="w-14 h-14 rounded-xl overflow-hidden">
                          <Image src={rider.avatar_url} alt={rider.name} width={56} height={56} className="object-cover w-full h-full" />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-xl gradient-brand flex items-center justify-center text-xl font-black text-white">
                          {rider.name.charAt(0)}
                        </div>
                      )}
                      {/* Online dot */}
                      <span className={cn("absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white",
                        isOnline ? "bg-green-500" : "bg-slate-300")} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <h3 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>{rider.name}</h3>
                          <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>ID: {rider.id.substring(0, 8).toUpperCase()}</p>
                        </div>
                        {/* Account Status Badge */}
                        <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border", sc.color, sc.bg, sc.border)}>
                          <StatusIcon size={12} /> {sc.label}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <span className="flex items-center gap-1"><Phone size={11} /> {rider.phone}</span>
                        <span className="flex items-center gap-1"><Mail size={11} /> {rider.email}</span>
                        <span className="flex items-center gap-1"><Bike size={11} /> {rider.vehicle_type} · {rider.vehicle_number || "N/A"}</span>
                        <span className="flex items-center gap-1">
                          <Calendar size={11} /> Joined: {new Date(rider.joined_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      </div>

                      {/* Suspension info */}
                      {isSuspendedActive && (
                        <div className="mt-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
                          <Clock size={12} /> Suspended until {new Date(rider.suspension_end!).toLocaleDateString("en-IN")}
                          {rider.suspension_reason && <> — {rider.suspension_reason}</>}
                        </div>
                      )}
                      {rider.account_status === "blocked" && rider.blocked_reason && (
                        <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
                          <Shield size={12} /> {rider.blocked_reason}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-4 gap-2 mt-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                    <div className="text-center">
                      <p className="text-base font-black text-orange-500">{rider.today_deliveries}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Today</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-black text-emerald-600">₹{Math.round(rider.today_earnings ?? 0)}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Earnings</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Star size={12} className="text-yellow-500" />
                        <p className="text-base font-black" style={{ color: "var(--text-primary)" }}>{rider.rating.toFixed(1)}</p>
                      </div>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Rating</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {rider.is_busy
                          ? <><Package size={12} className="text-blue-500" /><p className="text-sm font-bold text-blue-600">Busy</p></>
                          : isOnline
                            ? <><Wifi size={12} className="text-green-500" /><p className="text-sm font-bold text-green-600">Online</p></>
                            : <><WifiOff size={12} style={{ color: "var(--text-muted)" }} /><p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>Offline</p></>
                        }
                      </div>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Status</p>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex flex-wrap gap-2 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                    <Link href={`/owner/riders/${rider.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                      <Eye size={12} /> View Profile
                    </Link>

                    {rider.account_status === "active" && (
                      <>
                        <button onClick={() => { setActionModal({ rider, type: "disable" }); setActionReason(""); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-orange-200 bg-orange-50 text-orange-600 transition-all hover:bg-orange-100">
                          <ShieldOff size={12} /> Disable
                        </button>
                        <button onClick={() => { setActionModal({ rider, type: "suspend" }); setActionReason(""); setSuspendEnd(""); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-200 bg-amber-50 text-amber-600 transition-all hover:bg-amber-100">
                          <ShieldAlert size={12} /> Suspend
                        </button>
                        <button onClick={() => { setActionModal({ rider, type: "block" }); setActionReason(""); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 bg-red-50 text-red-600 transition-all hover:bg-red-100">
                          <Shield size={12} /> Block
                        </button>
                      </>
                    )}

                    {(rider.account_status === "disabled" || rider.account_status === "suspended") && (
                      <button onClick={() => { setActionModal({ rider, type: "activate" }); setActionReason(""); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-green-200 bg-green-50 text-green-600 transition-all hover:bg-green-100">
                        <ShieldCheck size={12} /> Activate
                      </button>
                    )}

                    {rider.account_status === "blocked" && (
                      <button onClick={() => { setActionModal({ rider, type: "unblock" }); setActionReason(""); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-green-200 bg-green-50 text-green-600 transition-all hover:bg-green-100">
                        <CheckCircle size={12} /> Unblock
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Confirmation Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setActionModal(null)} />
          <div className="relative w-full max-w-md rounded-2xl p-6 z-10" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
            <h2 className="font-bold text-xl mb-1" style={{ color: "var(--text-primary)" }}>
              {actionModal.type === "block"    && "🚫 Block Rider"}
              {actionModal.type === "unblock"  && "✅ Unblock Rider"}
              {actionModal.type === "disable"  && "🔕 Disable Rider"}
              {actionModal.type === "activate" && "✅ Activate Rider"}
              {actionModal.type === "suspend"  && "⏸️ Suspend Rider"}
            </h2>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
              Rider: <strong style={{ color: "var(--text-primary)" }}>{actionModal.rider.name}</strong>
            </p>

            {actionModal.type === "suspend" && (
              <div className="mb-3">
                <label className="text-sm font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>
                  Suspension End Date <span className="text-red-500">*</span>
                </label>
                <input type="datetime-local" value={suspendEnd} onChange={e => setSuspendEnd(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/20"
                  style={{ background: "var(--input-bg)", border: "1.5px solid var(--border)", color: "var(--text-primary)" }} />
              </div>
            )}

            <div className="mb-4">
              <label className="text-sm font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>
                Reason {["block","suspend","disable"].includes(actionModal.type) ? <span className="text-red-500">*</span> : "(optional)"}
              </label>
              <textarea value={actionReason} onChange={e => setActionReason(e.target.value)} rows={3}
                placeholder={
                  actionModal.type === "block"   ? "Reason for blocking this rider..." :
                  actionModal.type === "suspend" ? "Reason for suspension..." :
                  actionModal.type === "disable" ? "Reason for disabling..." : "Optional note..."
                }
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/20 resize-none"
                style={{ background: "var(--input-bg)", border: "1.5px solid var(--border)", color: "var(--text-primary)" }} />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setActionModal(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                Cancel
              </button>
              <button onClick={performAction} disabled={actionLoading ||
                (["block","disable"].includes(actionModal.type) && !actionReason.trim()) ||
                (actionModal.type === "suspend" && (!actionReason.trim() || !suspendEnd))}
                className={cn("flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2",
                  ["block","disable","suspend"].includes(actionModal.type) ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
                )}>
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                {actionLoading ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
