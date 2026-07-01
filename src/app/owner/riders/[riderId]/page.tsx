"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import {
  ChevronLeft, Loader2, User, Phone, Mail, Bike, Calendar,
  Package, TrendingUp, Star, ShieldCheck, ShieldOff, ShieldAlert,
  Shield, Clock, RefreshCw, FileText, CheckCircle, XCircle,
  Wifi, WifiOff, Hash, AlertTriangle
} from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type AccountStatus = "active" | "disabled" | "suspended" | "blocked";

type RiderDetail = {
  id: string; name: string; phone: string; email: string;
  avatar_url: string | null; vehicle_type: string; vehicle_number: string;
  is_available: boolean; total_deliveries: number; rating: number;
  account_status: AccountStatus; suspension_end: string | null;
  suspension_reason: string | null; blocked_reason: string | null;
  joined_at: string; created_at: string;
};

type Stats = {
  today: number; week: number; month: number;
  lifetime: number; total_assigned: number;
};

type AuditLog = {
  id: string; action: string; reason: string | null;
  owner_name: string | null; metadata: any; created_at: string;
};

const STATUS_CONFIG: Record<AccountStatus, { label: string; color: string; bg: string; border: string; icon: any }> = {
  active:    { label: "Active",    color: "text-green-600",  bg: "bg-green-50",  border: "border-green-200", icon: ShieldCheck  },
  disabled:  { label: "Disabled",  color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200",icon: ShieldOff    },
  suspended: { label: "Suspended", color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-200", icon: ShieldAlert  },
  blocked:   { label: "Blocked",   color: "text-red-600",    bg: "bg-red-50",    border: "border-red-200",   icon: Shield       },
};

const ACTION_LABELS: Record<string, string> = {
  block:                  "🚫 Blocked",
  unblock:                "✅ Unblocked",
  disable:                "🔕 Disabled",
  activate:               "✅ Activated",
  suspend:                "⏸️ Suspended",
  order_manually_assigned: "📦 Order Assigned",
  order_reassigned_to:    "🔄 Order Reassigned To",
  order_reassigned_away:  "🔄 Order Reassigned Away",
  status_changed_to_active:    "✅ Activated",
  status_changed_to_blocked:   "🚫 Blocked",
  status_changed_to_disabled:  "🔕 Disabled",
  status_changed_to_suspended: "⏸️ Suspended",
};

export default function RiderDetailPage() {
  const params   = useParams();
  const riderId  = params.riderId as string;
  const router   = useRouter();
  const { user, loading: authLoading } = useAuthStore();

  const [rider,     setRider]     = useState<RiderDetail | null>(null);
  const [stats,     setStats]     = useState<Stats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading,   setLoading]   = useState(true);

  // Action modal
  const [actionType,    setActionType]    = useState<string | null>(null);
  const [actionReason,  setActionReason]  = useState("");
  const [suspendEnd,    setSuspendEnd]    = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== "restaurant_owner" && user.role !== "admin"))) router.push("/auth/login");
  }, [user, authLoading, router]);

  async function loadData(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res  = await fetch(`/api/owner/riders/${riderId}`);
      const json = await res.json();
      if (res.ok) {
        setRider(json.rider);
        setStats(json.stats);
        setAuditLogs(json.audit_logs ?? []);
      } else {
        toast.error(json.error ?? "Failed to load rider");
      }
    } catch {
      toast.error("Network error");
    }
    setLoading(false);
  }

  useEffect(() => {
    if ((user?.role === "restaurant_owner" || user?.role === "admin") && riderId) loadData();
  }, [user, riderId]);

  async function performAction() {
    if (!rider || !user || !actionType) return;
    setActionLoading(true);

    const statusMap: Record<string, AccountStatus> = {
      block:    "blocked",
      unblock:  "active",
      disable:  "disabled",
      activate: "active",
      suspend:  "suspended",
    };

    try {
      const body: any = {
        account_status:    statusMap[actionType],
        action:            actionType,
        owner_id:          user.id,
        owner_name:        user.name ?? "Owner",
        reason:            actionReason || undefined,
        suspension_end:    actionType === "suspend" ? suspendEnd : undefined,
        suspension_reason: actionType === "suspend" ? actionReason : undefined,
      };

      const res  = await fetch(`/api/owner/riders/${rider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      toast.success(`Action applied ✅`);
      setActionType(null);
      setActionReason("");
      setSuspendEnd("");
      loadData(true);
    } catch (e: any) {
      toast.error(e.message ?? "Action failed");
    }
    setActionLoading(false);
  }

  if (authLoading || loading) return (
    <div className="flex items-center justify-center h-screen" style={{ background: "var(--bg-primary)" }}>
      <Loader2 size={32} className="animate-spin text-orange-500" />
    </div>
  );

  if (!rider) return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <AlertTriangle size={48} className="text-red-400" />
      <p style={{ color: "var(--text-primary)" }}>Rider not found.</p>
      <Link href="/owner/riders" className="btn-primary px-4 py-2 rounded-xl text-sm">← Back to Riders</Link>
    </div>
  );

  const sc = STATUS_CONFIG[rider.account_status];
  const StatusIcon = sc.icon;
  const isOnline = rider.is_available && rider.account_status === "active";

  const sectionStyle = {
    background: "var(--card-bg)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
      {/* Back */}
      <Link href="/owner/riders"
        className="inline-flex items-center gap-1.5 mb-5 text-sm font-medium transition-colors"
        style={{ color: "var(--text-muted)" }}>
        <ChevronLeft size={16} /> Back to Riders
      </Link>

      {/* Header Card */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: "linear-gradient(135deg,rgba(249,115,22,0.07),rgba(220,38,38,0.03))", border: "1px solid rgba(249,115,22,0.18)" }}>
        <div className="flex items-start gap-4">
          {/* Avatar */}
          {rider.avatar_url ? (
            <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0" style={{ border: "2px solid rgba(249,115,22,0.3)" }}>
              <Image src={rider.avatar_url} alt={rider.name} width={80} height={80} className="object-cover w-full h-full" />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-2xl gradient-brand flex items-center justify-center text-3xl font-black text-white flex-shrink-0">
              {rider.name.charAt(0)}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h1 className="font-bold text-2xl" style={{ fontFamily: "'Outfit',sans-serif", color: "var(--text-primary)" }}>
                  {rider.name}
                </h1>
                <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>ID: {rider.id}</p>
              </div>
              <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border", sc.color, sc.bg, sc.border)}>
                <StatusIcon size={14} /> {sc.label}
              </div>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              <span className="flex items-center gap-1"><Phone size={13} /> {rider.phone}</span>
              <span className="flex items-center gap-1"><Mail size={13} /> {rider.email}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              <span className="flex items-center gap-1"><Bike size={13} /> {rider.vehicle_type}</span>
              {rider.vehicle_number && <span className="flex items-center gap-1"><Hash size={13} /> {rider.vehicle_number}</span>}
              <span className="flex items-center gap-1"><Calendar size={13} /> Joined {new Date(rider.joined_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
            </div>

            {/* Online Badge */}
            <div className="mt-2 flex items-center gap-2">
              <span className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold",
                isOnline ? "bg-green-100 text-green-700 border border-green-300" : "bg-slate-100 text-slate-500 border border-slate-200"
              )}>
                {isOnline ? <><Wifi size={12} /> Online</> : <><WifiOff size={12} /> Offline</>}
              </span>
              <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                <Star size={12} className="text-yellow-500" /> {rider.rating.toFixed(1)} rating
              </span>
            </div>
          </div>
        </div>

        {/* Blocked / Suspended notice */}
        {rider.account_status === "blocked" && rider.blocked_reason && (
          <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            🚫 Blocked: {rider.blocked_reason}
          </div>
        )}
        {rider.account_status === "suspended" && rider.suspension_end && (
          <div className="mt-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            ⏸️ Suspended until {new Date(rider.suspension_end).toLocaleDateString("en-IN")}
            {rider.suspension_reason && <> — {rider.suspension_reason}</>}
          </div>
        )}
      </div>

      {/* Performance Stats */}
      <div className="rounded-2xl overflow-hidden mb-4" style={sectionStyle}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="font-bold text-base flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <TrendingUp size={16} className="text-orange-500" /> Performance Stats
          </p>
          <button onClick={() => loadData(true)} className="transition-colors hover:text-orange-500" style={{ color: "var(--text-muted)" }}>
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="p-5">
          {stats ? (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: "Today",    value: stats.today,          color: "text-orange-600", emoji: "📅" },
                { label: "This Week",value: stats.week,           color: "text-blue-600",   emoji: "📊" },
                { label: "Month",    value: stats.month,          color: "text-purple-600", emoji: "🗓️" },
                { label: "Lifetime", value: stats.lifetime,       color: "text-green-600",  emoji: "🏆" },
                { label: "Assigned", value: stats.total_assigned, color: "text-slate-600",  emoji: "📦" },
              ].map(({ label, value, color, emoji }) => (
                <div key={label} className="rounded-xl p-4 text-center" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                  <p className="text-lg mb-1">{emoji}</p>
                  <p className={`text-2xl font-black ${color}`}>{value}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm py-4" style={{ color: "var(--text-muted)" }}>No stats available</p>
          )}
        </div>
      </div>

      {/* Control Panel */}
      <div className="rounded-2xl overflow-hidden mb-4" style={sectionStyle}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="font-bold text-base flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Shield size={16} className="text-indigo-500" /> Account Controls
          </p>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-3">
            {rider.account_status === "active" && (
              <>
                <button onClick={() => { setActionType("disable"); setActionReason(""); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100 transition-all">
                  <ShieldOff size={15} /> Disable Account
                </button>
                <button onClick={() => { setActionType("suspend"); setActionReason(""); setSuspendEnd(""); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 transition-all">
                  <ShieldAlert size={15} /> Suspend Account
                </button>
                <button onClick={() => { setActionType("block"); setActionReason(""); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-all">
                  <Shield size={15} /> Block Rider
                </button>
              </>
            )}
            {(rider.account_status === "disabled" || rider.account_status === "suspended") && (
              <button onClick={() => { setActionType("activate"); setActionReason(""); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-green-200 bg-green-50 text-green-600 hover:bg-green-100 transition-all">
                <ShieldCheck size={15} /> Activate Account
              </button>
            )}
            {rider.account_status === "blocked" && (
              <button onClick={() => { setActionType("unblock"); setActionReason(""); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-green-200 bg-green-50 text-green-600 hover:bg-green-100 transition-all">
                <CheckCircle size={15} /> Unblock Rider
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Audit Log */}
      <div className="rounded-2xl overflow-hidden mb-4" style={sectionStyle}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="font-bold text-base flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <FileText size={16} className="text-blue-500" /> Activity & Audit Log
          </p>
        </div>
        <div className="p-5">
          {auditLogs.length === 0 ? (
            <p className="text-center text-sm py-6" style={{ color: "var(--text-muted)" }}>No activity recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {auditLogs.map(log => (
                <div key={log.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm"
                    style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                    {ACTION_LABELS[log.action]?.split(" ")[0] ?? "📋"}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {ACTION_LABELS[log.action] ?? log.action}
                    </p>
                    {log.reason && <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Reason: {log.reason}</p>}
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      By {log.owner_name ?? "Owner"} • {new Date(log.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Modal */}
      {actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setActionType(null)} />
          <div className="relative w-full max-w-md rounded-2xl p-6 z-10" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
            <h2 className="font-bold text-xl mb-1" style={{ color: "var(--text-primary)" }}>
              {actionType === "block"    && "🚫 Block Rider"}
              {actionType === "unblock"  && "✅ Unblock Rider"}
              {actionType === "disable"  && "🔕 Disable Rider"}
              {actionType === "activate" && "✅ Activate Rider"}
              {actionType === "suspend"  && "⏸️ Suspend Rider"}
            </h2>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
              Rider: <strong style={{ color: "var(--text-primary)" }}>{rider.name}</strong>
            </p>

            {actionType === "suspend" && (
              <div className="mb-3">
                <label className="text-sm font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>
                  Suspension End Date <span className="text-red-500">*</span>
                </label>
                <input type="datetime-local" value={suspendEnd} onChange={e => setSuspendEnd(e.target.value)}
                  className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                  style={{ background: "var(--input-bg)", border: "1.5px solid var(--border)", color: "var(--text-primary)" }} />
              </div>
            )}

            <div className="mb-4">
              <label className="text-sm font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>
                Reason {["block","suspend","disable"].includes(actionType) ? <span className="text-red-500">*</span> : "(optional)"}
              </label>
              <textarea value={actionReason} onChange={e => setActionReason(e.target.value)} rows={3}
                placeholder="Enter reason..."
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none resize-none"
                style={{ background: "var(--input-bg)", border: "1.5px solid var(--border)", color: "var(--text-primary)" }} />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setActionType(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                Cancel
              </button>
              <button onClick={performAction} disabled={actionLoading ||
                (["block","disable"].includes(actionType) && !actionReason.trim()) ||
                (actionType === "suspend" && (!actionReason.trim() || !suspendEnd))}
                className={cn("flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2 transition-all",
                  ["block","disable","suspend"].includes(actionType) ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
                )}>
                {actionLoading && <Loader2 size={16} className="animate-spin" />}
                {actionLoading ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
