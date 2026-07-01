"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  Loader2, Ticket as TicketIcon, Clock, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Paperclip, AlertCircle, RefreshCw
} from "lucide-react";
import { format, formatDistanceToNow, differenceInHours } from "date-fns";

type Ticket = {
  id: string;
  category: string;
  status: string;
  created_at: string;
  description: string;
  attachments: string[] | null;
  phone: string;
  email: string;
};

const HIDE_AFTER_HOURS = 48;

export default function TicketHistoryList({ userType }: { userType: "customer" | "rider" | "owner" }) {
  const [tickets,    setTickets]    = useState<Ticket[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [userId,     setUserId]     = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);


  // ── Optimized query — no is_archived filter (avoids column-not-found errors)
  // The 48-hour cutoff on created_at is sufficient to show only recent tickets
  const loadTickets = useCallback(async (uid: string) => {
    setLoading(true);
    setError(null);

    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - HIDE_AFTER_HOURS);

    try {
      const { data, error: qErr } = await supabase
        .from("support_tickets")
        .select("id, category, status, created_at, description, attachments, phone, email")
        .eq("user_id", uid)
        .gte("created_at", cutoff.toISOString())
        .order("created_at", { ascending: false });

      if (qErr) {
        // Don't show error for column-not-found — just show empty state
        console.warn("TicketHistoryList query:", qErr.message);
        setTickets([]);
      } else {
        setTickets((data ?? []) as Ticket[]);
      }
    } catch (e) {
      console.warn("TicketHistoryList fetch failed:", e);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      // Use cached session — faster than getUser() API call
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;

      // CRITICAL: check cancelled after every await.
      // In React StrictMode the cleanup runs before this async function completes.
      // Without this check, both StrictMode invocations finish and create the same
      // channel name → "cannot add postgres_changes callbacks after subscribe()" error.
      if (cancelled || !uid) {
        setLoading(false);
        return;
      }

      setUserId(uid);
      await loadTickets(uid);

      if (cancelled) return;  // cleaned up while loading tickets

      // Register .on() handler BEFORE .subscribe() — correct Supabase realtime pattern
      channel = supabase
        .channel(`ticket_list_${uid}_${userType}`)
        .on(
          "postgres_changes",
          {
            event:  "UPDATE",
            schema: "public",
            table:  "support_tickets",
            filter: `user_id=eq.${uid}`,
          },
          (payload) => {
            setTickets(prev =>
              prev.map(t =>
                t.id === (payload.new as Ticket).id
                  ? { ...t, ...(payload.new as Ticket) }
                  : t
              )
            );
          }
        )
        .subscribe();
    }

    init();

    return () => {
      // Mark as cancelled so any in-flight init() won't create a channel
      cancelled = true;
      // Fully deregister the channel so a re-mount can subscribe fresh
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadTickets, userType]);

  // ── Status helpers ────────────────────────────────────────────────
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Open":        return { badge: "text-orange-600 bg-orange-50 border-orange-200",  dot: "bg-orange-500" };
      case "In Progress": return { badge: "text-blue-600 bg-blue-50 border-blue-200",        dot: "bg-blue-500 animate-pulse" };
      case "Resolved":    return { badge: "text-green-600 bg-green-50 border-green-200",     dot: "bg-green-500" };
      case "Closed":      return { badge: "text-slate-500 bg-slate-50 border-slate-200",     dot: "bg-slate-400" };
      default:            return { badge: "text-slate-600 bg-slate-50 border-slate-200",     dot: "bg-slate-400" };
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Open":        return <Clock size={13} />;
      case "In Progress": return <Loader2 size={13} className="animate-spin" />;
      case "Resolved":    return <CheckCircle2 size={13} />;
      case "Closed":      return <XCircle size={13} />;
      default:            return <TicketIcon size={13} />;
    }
  };

  const getTimeWarning = (createdAt: string) => {
    const hoursLeft = HIDE_AFTER_HOURS - differenceInHours(new Date(), new Date(createdAt));
    if (hoursLeft <= 0) return null;
    if (hoursLeft <= 6) return `Hides in ${hoursLeft}h`;
    return null;
  };

  // ── Loading state ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="animate-spin text-orange-500" size={22} />
        <span className="ml-2 text-sm" style={{ color: "var(--text-muted)" }}>Loading tickets...</span>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────
  if (tickets.length === 0) {
    return (
      <div className="text-center py-8 rounded-2xl" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
        <TicketIcon size={40} className="mx-auto mb-3 opacity-30" style={{ color: "var(--text-muted)" }} />
        <h3 className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No Active Support Tickets</h3>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Submit a ticket using the "Get Help" button above.</p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Tickets are visible for 48 hours after submission.</p>
      </div>
    );
  }

  // ── Ticket list ───────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Live indicator */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block" />
          Live — status updates automatically
        </p>
        <button
          onClick={() => userId && loadTickets(userId)}
          className="text-xs flex items-center gap-1 transition-colors hover:text-orange-500"
          style={{ color: "var(--text-muted)" }}
        >
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {tickets.map(ticket => {
        const style = getStatusStyle(ticket.status);
        const isExpanded = expandedId === ticket.id;
        const timeWarning = getTimeWarning(ticket.created_at);
        const hasAttachments = ticket.attachments && ticket.attachments.length > 0;

        return (
          <div
            key={ticket.id}
            className="rounded-2xl overflow-hidden transition-all"
            style={{ background: "var(--card-bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
          >
            {/* Card Header */}
            <div
              className="p-4 cursor-pointer transition-colors hover:bg-[var(--card-hover)]"
              onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{ticket.category}</p>
                    {hasAttachments && (
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: "var(--bg-secondary)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                        <Paperclip size={10} /> {ticket.attachments!.length}
                      </span>
                    )}
                    {timeWarning && (
                      <span className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        <AlertCircle size={10} /> {timeWarning}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-1 font-mono truncate" style={{ color: "var(--text-muted)" }}>
                    #{ticket.id.split("-")[0].toUpperCase()}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${style.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                    {getStatusIcon(ticket.status)}
                    {ticket.status}
                  </div>
                  {isExpanded
                    ? <ChevronUp size={15} style={{ color: "var(--text-muted)" }} />
                    : <ChevronDown size={15} style={{ color: "var(--text-muted)" }} />
                  }
                </div>
              </div>

              {/* Description preview */}
              {!isExpanded && (
                <p className="text-sm mt-2 line-clamp-1" style={{ color: "var(--text-muted)" }}>{ticket.description}</p>
              )}

              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                  <Clock size={11} />
                  {format(new Date(ticket.created_at), "MMM d, yyyy • h:mm a")}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  ({formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })})
                </span>
              </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-4 space-y-4" style={{ borderTop: "1px solid var(--border)" }}>
                {/* Description */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Description</p>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "var(--text-primary)" }}>{ticket.description}</p>
                </div>

                {/* Ticket Meta */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Ticket ID",       value: ticket.id.split("-")[0].toUpperCase(), mono: true },
                    { label: "Category",        value: ticket.category, highlight: true },
                    { label: "Submitted",       value: format(new Date(ticket.created_at), "MMM d, yyyy h:mm a") },
                    { label: "Current Status",  value: ticket.status, statusStyle: style },
                  ].map(({ label, value, mono, highlight, statusStyle }) => (
                    <div key={label} className="rounded-xl p-3" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
                      {statusStyle ? (
                        <div className={`flex items-center gap-1.5 text-xs font-semibold ${statusStyle.badge.split(" ")[0]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                          {value}
                        </div>
                      ) : (
                        <p className={`text-xs font-semibold ${mono ? "font-mono" : ""} ${highlight ? "text-orange-600" : ""}`}
                          style={{ color: highlight ? undefined : "var(--text-primary)" }}>
                          {value}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Attachments */}
                {hasAttachments && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                      Attachments ({ticket.attachments!.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {ticket.attachments!.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
                          style={{ background: "var(--accent-peach)", color: "#f97316", border: "1px solid rgba(249,115,22,0.2)" }}>
                          <Paperclip size={12} /> Attachment {i + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Auto-hide notice */}
                <div className="rounded-xl p-3" style={{ background: "var(--accent-peach)", border: "1px solid rgba(249,115,22,0.15)" }}>
                  <p className="text-xs text-orange-600">
                    ⏱ This ticket will be archived 48 hours after submission and removed from this view.
                    Your data is permanently saved in our system.
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
