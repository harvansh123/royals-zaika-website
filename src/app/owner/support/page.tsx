"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  Loader2, Search, Ticket as TicketIcon, Clock, CheckCircle2,
  XCircle, ChevronDown, ChevronUp, Archive, RotateCcw,
  RefreshCw, AlertCircle, Paperclip
} from "lucide-react";
import toast from "react-hot-toast";
import { format, formatDistanceToNow, differenceInHours } from "date-fns";

type Ticket = {
  id: string;
  user_id: string;
  user_type: string;
  name: string;
  email: string;
  phone: string;
  category: string;
  description: string;
  audio_url: string | null;
  status: string;
  created_at: string;
  is_archived: boolean;
  archived_at: string | null;
  attachments: string[];
};

const ARCHIVE_AFTER_HOURS = 48;

// ── Helpers (outside component) ──────────────────────────────────────
function getStatusStyle(status: string) {
  switch (status) {
    case "Open":        return "text-orange-400 bg-orange-400/10 border-orange-400/20";
    case "In Progress": return "text-blue-400 bg-blue-400/10 border-blue-400/20";
    case "Resolved":    return "text-green-400 bg-green-400/10 border-green-400/20";
    case "Closed":      return "text-gray-400 bg-gray-400/10 border-gray-400/20";
    default:            return "text-white bg-white/10 border-white/20";
  }
}

function getUserTypeBadge(type: string) {
  switch (type) {
    case "customer": return "bg-blue-500/15 text-blue-400";
    case "rider":    return "bg-purple-500/15 text-purple-400";
    default:         return "bg-orange-500/15 text-orange-400";
  }
}

// ── TicketCard Component (outside main component) ──────────────────────
interface TicketCardProps {
  ticket: Ticket;
  isArchived: boolean;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  updatingId: string | null;
  restoringId: string | null;
  onUpdateStatus: (id: string, status: string) => void;
  onRestore: (id: string) => void;
}

function TicketCard({
  ticket, isArchived, expandedId, setExpandedId,
  updatingId, restoringId, onUpdateStatus, onRestore
}: TicketCardProps) {
  const isExpanded = expandedId === ticket.id;
  const statusStyle = getStatusStyle(ticket.status);
  const hasAttachments = ticket.attachments && ticket.attachments.length > 0;

  return (
    <div className="rounded-2xl overflow-hidden border" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
      {/* Card Header */}
      <div
        className="p-5 cursor-pointer hover:brightness-105 transition"
        onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getUserTypeBadge(ticket.user_type)}`}>
                {ticket.user_type}
              </span>
              <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                #{ticket.id.split("-")[0].toUpperCase()}
              </span>
              <span className="text-xs flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                <Clock size={11} />
                {format(new Date(ticket.created_at), "MMM d, h:mm a")}
              </span>
              {hasAttachments && (
                <span className="flex items-center gap-1 text-[10px] text-gray-400 bg-white/10 px-2 py-0.5 rounded-full">
                  <Paperclip size={10} /> {ticket.attachments.length}
                </span>
              )}
            </div>
            <h3 className="font-semibold text-sm mb-0.5" style={{ color: "var(--text-primary)" }}>{ticket.category}</h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {ticket.name} • {ticket.phone}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusStyle}`}>
              {ticket.status}
            </span>
            {isExpanded ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-4 border-t space-y-5" style={{ borderColor: "var(--border)" }}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left: Main content */}
            <div className="lg:col-span-2 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  Description
                </p>
                <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "var(--text-primary)" }}>
                  {ticket.description}
                </p>
              </div>

              {hasAttachments && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                    Attachments ({ticket.attachments.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ticket.attachments.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border hover:opacity-80 transition"
                        style={{ background: "var(--card-bg)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
                        <Paperclip size={12} className="text-orange-400" /> File {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {isArchived && ticket.archived_at && (
                <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3">
                  <p className="text-xs text-amber-400 flex items-center gap-2">
                    <Archive size={13} />
                    Archived {formatDistanceToNow(new Date(ticket.archived_at), { addSuffix: true })}
                    {" "}— All data preserved permanently.
                  </p>
                </div>
              )}
            </div>

            {/* Right: Actions */}
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  Contact
                </p>
                <div className="text-sm space-y-1">
                  <p className="font-medium" style={{ color: "var(--text-primary)" }}>{ticket.name}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{ticket.email}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{ticket.phone}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  {isArchived ? "Actions" : "Update Status"}
                </p>
                {!isArchived ? (
                  <div>
                    <select
                      value={ticket.status}
                      onChange={(e) => onUpdateStatus(ticket.id, e.target.value)}
                      disabled={updatingId === ticket.id}
                      className="w-full p-2.5 rounded-xl text-sm border focus:outline-none"
                      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                    >
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Closed">Closed</option>
                    </select>
                    {updatingId === ticket.id && (
                      <p className="flex items-center gap-1.5 text-xs text-orange-400 mt-2">
                        <Loader2 size={12} className="animate-spin" /> Updating...
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => onRestore(ticket.id)}
                    disabled={restoringId === ticket.id}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60 border"
                    style={{ background: "rgba(249,115,22,0.1)", color: "#f97316", borderColor: "rgba(249,115,22,0.3)" }}
                  >
                    {restoringId === ticket.id
                      ? <><Loader2 size={14} className="animate-spin" /> Restoring...</>
                      : <><RotateCcw size={14} /> Restore Ticket</>
                    }
                  </button>
                )}
              </div>

              <div className="rounded-xl p-3 space-y-1.5" style={{ background: "var(--bg-secondary)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Details
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Submitted: {format(new Date(ticket.created_at), "MMM d, yyyy h:mm a")}
                </p>
                <p className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>
                  Type: {ticket.user_type}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────
export default function OwnerSupportDashboard() {
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [activeTickets, setActiveTickets] = useState<Ticket[]>([]);
  const [activeLoading, setActiveLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("All");
  const [activeSearch, setActiveSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [archivedTickets, setArchivedTickets] = useState<Ticket[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedSearch, setArchivedSearch] = useState("");
  const [archivedFilterStatus, setArchivedFilterStatus] = useState("All");
  const [archivedFilterType, setArchivedFilterType] = useState("All");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadActiveTickets = useCallback(async () => {
    setActiveLoading(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("is_archived", false)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const now = new Date();
      const toArchive = data.filter(
        (t: Ticket) => differenceInHours(now, new Date(t.created_at)) >= ARCHIVE_AFTER_HOURS
      );
      if (toArchive.length > 0) {
        await supabase
          .from("support_tickets")
          .update({ is_archived: true, archived_at: now.toISOString() })
          .in("id", toArchive.map((t: Ticket) => t.id));
        setActiveTickets(
          data.filter((t: Ticket) => differenceInHours(now, new Date(t.created_at)) < ARCHIVE_AFTER_HOURS) as Ticket[]
        );
      } else {
        setActiveTickets(data as Ticket[]);
      }
    }
    setActiveLoading(false);
  }, []);

  const loadArchivedTickets = useCallback(async () => {
    setArchivedLoading(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("is_archived", true)
      .order("archived_at", { ascending: false });
    if (!error && data) setArchivedTickets(data as Ticket[]);
    setArchivedLoading(false);
  }, []);

  useEffect(() => {
    loadActiveTickets();
    const channel = supabase
      .channel("owner_support_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => {
        loadActiveTickets();
      })
      .subscribe();
    // FIXED: removeChannel() fully deregisters the channel from the Supabase client.
    // channel.unsubscribe() only pauses but leaves the channel registered, which
    // causes "cannot add postgres_changes callbacks after subscribe()" on re-mount.
    return () => { supabase.removeChannel(channel); };
  }, [loadActiveTickets]);

  useEffect(() => {
    if (activeTab === "archived") loadArchivedTickets();
  }, [activeTab, loadArchivedTickets]);

  async function handleUpdateStatus(id: string, newStatus: string) {
    setUpdatingId(id);
    const { error } = await supabase.from("support_tickets").update({ status: newStatus }).eq("id", id);
    if (!error) {
      setActiveTickets(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
      toast.success(`Status: "${newStatus}"`);
    } else {
      toast.error("Failed to update status");
    }
    setUpdatingId(null);
  }

  async function handleRestore(id: string) {
    setRestoringId(id);
    const { error } = await supabase
      .from("support_tickets")
      .update({ is_archived: false, archived_at: null })
      .eq("id", id);
    if (!error) {
      setArchivedTickets(prev => prev.filter(t => t.id !== id));
      toast.success("Ticket restored!");
      loadActiveTickets();
    } else {
      toast.error("Failed to restore ticket");
    }
    setRestoringId(null);
  }

  const filteredActive = activeTickets.filter(t => {
    if (filterStatus !== "All" && t.status !== filterStatus) return false;
    if (activeSearch) {
      const q = activeSearch.toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !t.id.toLowerCase().includes(q) && !t.category.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const filteredArchived = archivedTickets.filter(t => {
    if (archivedFilterStatus !== "All" && t.status !== archivedFilterStatus) return false;
    if (archivedFilterType !== "All" && t.user_type !== archivedFilterType) return false;
    if (archivedSearch) {
      const q = archivedSearch.toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !t.id.toLowerCase().includes(q) && !t.category.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const openCount = activeTickets.filter(t => t.status === "Open").length;
  const inProgressCount = activeTickets.filter(t => t.status === "In Progress").length;
  const resolvedCount = activeTickets.filter(t => t.status === "Resolved").length;

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-bold text-2xl md:text-3xl mb-1" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-primary)" }}>
            Support Tickets
          </h1>
          <p className="text-sm flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse inline-block" />
            Live — updates automatically
          </p>
        </div>
        <button
          onClick={async () => {
            setIsRefreshing(true);
            await loadActiveTickets();
            if (activeTab === "archived") await loadArchivedTickets();
            setIsRefreshing(false);
          }}
          disabled={isRefreshing}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl transition-all border hover:opacity-80"
          style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", borderColor: "var(--border)" }}
        >
          <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} /> {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Open",        count: openCount,        color: "text-orange-400", border: "border-orange-400/20", bg: "bg-orange-400/5" },
          { label: "In Progress", count: inProgressCount,  color: "text-blue-400",   border: "border-blue-400/20",   bg: "bg-blue-400/5"   },
          { label: "Resolved",    count: resolvedCount,    color: "text-green-400",  border: "border-green-400/20",  bg: "bg-green-400/5"  },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-4 text-center border ${s.border} ${s.bg}`}>
            <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: "var(--bg-secondary)" }}>
        {(["active", "archived"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all capitalize"
            style={activeTab === tab
              ? { background: "var(--card-bg)", color: "#f97316", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }
              : { color: "var(--text-muted)" }}
          >
            {tab === "active" ? <TicketIcon size={15} /> : <Archive size={15} />}
            {tab === "active" ? "Active" : "Archived"}
            {tab === "active" && activeTickets.length > 0 && (
              <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {activeTickets.length}
              </span>
            )}
            {tab === "archived" && archivedTickets.length > 0 && (
              <span className="bg-gray-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {archivedTickets.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Active Tab */}
      {activeTab === "active" && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text" placeholder="Search by name, ID, category..."
                value={activeSearch} onChange={(e) => setActiveSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border focus:outline-none"
                style={{ background: "var(--bg-glass)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2.5 rounded-xl text-sm border focus:outline-none"
              style={{ background: "var(--bg-glass)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
              <option value="All">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          {activeLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-orange-500" size={28} /></div>
          ) : filteredActive.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
              <TicketIcon size={44} className="mx-auto mb-4 opacity-30 text-gray-400" />
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>No Active Tickets</p>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                {activeSearch || filterStatus !== "All" ? "Try adjusting filters." : "All caught up!"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredActive.map(ticket => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  isArchived={false}
                  expandedId={expandedId}
                  setExpandedId={setExpandedId}
                  updatingId={updatingId}
                  restoringId={restoringId}
                  onUpdateStatus={handleUpdateStatus}
                  onRestore={handleRestore}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Archived Tab */}
      {activeTab === "archived" && (
        <>
          <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-4 mb-5 flex items-start gap-3">
            <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-400">Archived Tickets</p>
              <p className="text-xs text-amber-400/70 mt-0.5">
                Tickets older than 48h are archived automatically. All data is permanently saved. You can restore any ticket.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text" placeholder="Search archived tickets..."
                value={archivedSearch} onChange={(e) => setArchivedSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border focus:outline-none"
                style={{ background: "var(--bg-glass)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>
            <select value={archivedFilterStatus} onChange={(e) => setArchivedFilterStatus(e.target.value)}
              className="px-4 py-2.5 rounded-xl text-sm border focus:outline-none"
              style={{ background: "var(--bg-glass)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
              <option value="All">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
            <select value={archivedFilterType} onChange={(e) => setArchivedFilterType(e.target.value)}
              className="px-4 py-2.5 rounded-xl text-sm border focus:outline-none"
              style={{ background: "var(--bg-glass)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
              <option value="All">All Users</option>
              <option value="customer">Customer</option>
              <option value="rider">Rider</option>
              <option value="owner">Owner</option>
            </select>
          </div>

          {archivedLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-orange-500" size={28} /></div>
          ) : filteredArchived.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
              <Archive size={44} className="mx-auto mb-4 opacity-30 text-gray-400" />
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>No Archived Tickets</p>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                {archivedSearch || archivedFilterStatus !== "All" || archivedFilterType !== "All"
                  ? "Try adjusting filters."
                  : "Tickets older than 48 hours will appear here."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredArchived.map(ticket => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  isArchived={true}
                  expandedId={expandedId}
                  setExpandedId={setExpandedId}
                  updatingId={updatingId}
                  restoringId={restoringId}
                  onUpdateStatus={handleUpdateStatus}
                  onRestore={handleRestore}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
