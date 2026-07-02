"use client";
import { useState } from "react";
import Image from "next/image";
import { Star, ThumbsUp, ThumbsDown, Edit2, Trash2, MessageSquare, CheckCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import toast from "react-hot-toast";

interface ReviewCardProps {
  review: any;
  showItemRatings?: boolean;
  isOwner?: boolean;
  onDeleted?: (id: string) => void;
  onEdited?: (review: any) => void;
  className?: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function ReviewCard({
  review,
  showItemRatings = false,
  isOwner = false,
  onDeleted,
  onEdited,
  className,
}: ReviewCardProps) {
  const { user } = useAuthStore();
  const [replyText,    setReplyText]    = useState("");
  const [showReply,    setShowReply]    = useState(false);
  const [savingReply,  setSavingReply]  = useState(false);
  const [lightboxImg,  setLightboxImg]  = useState<string | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [helpfulLoading, setHelpfulLoading] = useState(false);

  const isOwnerOfReview = user?.id === review.user_id;
  const canEdit = isOwnerOfReview &&
    (Date.now() - new Date(review.created_at).getTime()) < 24 * 60 * 60 * 1000;

  const authorName = review.users?.name
    ? review.users.name.split(" ")[0]   // first name only
    : "Anonymous";

  async function handleHelpful(isHelpful: boolean) {
    if (!user) { toast.error("Please login to vote"); return; }
    setHelpfulLoading(true);
    try {
      const res = await fetch(`/api/reviews/${review.id}/helpful`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_helpful: isHelpful }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      // Update in-place via callback (parent should refetch)
      toast.success(isHelpful ? "Marked as helpful!" : "Marked as not helpful");
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    } finally {
      setHelpfulLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete your review? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/reviews/${review.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Review deleted");
      onDeleted?.(review.id);
    } catch (e: any) {
      toast.error(e.message ?? "Error deleting review");
    } finally {
      setDeleting(false);
    }
  }

  async function handleReply() {
    if (!replyText.trim()) { toast.error("Enter reply text"); return; }
    setSavingReply(true);
    try {
      const res = await fetch(`/api/reviews/${review.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: replyText }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("Reply posted!");
      setShowReply(false);
      setReplyText("");
      onEdited?.({ ...review, owner_reply: replyText, owner_replied_at: new Date().toISOString() });
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    } finally {
      setSavingReply(false);
    }
  }

  async function handleDeleteReply() {
    if (!confirm("Remove your reply?")) return;
    try {
      const res = await fetch(`/api/reviews/${review.id}/reply`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Reply removed");
      onEdited?.({ ...review, owner_reply: null, owner_replied_at: null });
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    }
  }

  return (
    <>
      <div
        className={cn(
          "rounded-2xl p-4 sm:p-5 transition-all",
          className
        )}
        style={{ background: "var(--card-bg, #fff)", border: "1px solid var(--border, #e5e7eb)" }}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold text-white shrink-0"
              style={{ background: "linear-gradient(135deg,#f97316,#dc2626)" }}
            >
              {authorName[0]?.toUpperCase() ?? "U"}
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                {authorName}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {formatDate(review.created_at)}
                </span>
                {review.is_edited && (
                  <span className="text-[10px] text-gray-400 italic">(edited)</span>
                )}
                {/* Verified badge */}
                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-green-600">
                  <CheckCircle size={10} /> Verified Purchase
                </span>
              </div>
            </div>
          </div>

          {/* Overall rating */}
          <div className="flex items-center gap-1 shrink-0">
            {[1,2,3,4,5].map((s) => (
              <Star key={s} size={13}
                className={cn(s <= review.overall_rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200")}
              />
            ))}
          </div>
        </div>

        {/* ── Category ratings ── */}
        {(review.food_quality_rating || review.taste_rating || review.packaging_rating || review.delivery_rating) && (
          <div className="flex flex-wrap gap-2 mb-3">
            {[
              { label: "Food Quality", val: review.food_quality_rating },
              { label: "Taste",        val: review.taste_rating },
              { label: "Packaging",    val: review.packaging_rating },
              { label: "Delivery",     val: review.delivery_rating },
            ].filter((c) => c.val).map((c) => (
              <span key={c.label}
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(249,115,22,0.08)", color: "var(--text-secondary)" }}
              >
                {c.label}: {[1,2,3,4,5].map((s) => (
                  <Star key={s} size={9}
                    className={cn(s <= (c.val ?? 0) ? "text-yellow-400 fill-yellow-400" : "text-gray-300")}
                  />
                ))}
              </span>
            ))}
          </div>
        )}

        {/* ── Comment ── */}
        {review.comment && (
          <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--text-secondary)" }}>
            {review.comment}
          </p>
        )}

        {/* ── Item ratings ── */}
        {showItemRatings && review.review_item_ratings?.length > 0 && (
          <div className="mt-3 mb-3 space-y-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Item Ratings
            </p>
            {review.review_item_ratings.map((ir: any) => (
              <div key={ir.id} className="flex items-center gap-2">
                <p className="text-xs font-medium flex-1 truncate" style={{ color: "var(--text-secondary)" }}>
                  {ir.menu_items?.name ?? "Item"}
                </p>
                <div className="flex">
                  {[1,2,3,4,5].map((s) => (
                    <Star key={s} size={11}
                      className={cn(s <= ir.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200")}
                    />
                  ))}
                </div>
                {ir.comment && (
                  <span className="text-[10px] text-gray-400 truncate max-w-[100px]">{ir.comment}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Photos ── */}
        {review.photos?.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-3">
            {review.photos.map((url: string, i: number) => (
              <button key={i} onClick={() => setLightboxImg(url)}
                className="w-16 h-16 rounded-xl overflow-hidden border-2 border-transparent hover:border-orange-400 transition-all">
                <Image src={url} alt={`Review photo ${i+1}`} width={64} height={64}
                  className="object-cover w-full h-full" />
              </button>
            ))}
          </div>
        )}

        {/* ── Helpful buttons ── */}
        <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleHelpful(true)}
              disabled={helpfulLoading || isOwnerOfReview}
              className="flex items-center gap-1.5 text-xs transition-colors hover:text-green-500 disabled:opacity-40"
              style={{ color: "var(--text-muted)" }}
            >
              <ThumbsUp size={13} /> Helpful ({review.helpful_count ?? 0})
            </button>
            <button
              onClick={() => handleHelpful(false)}
              disabled={helpfulLoading || isOwnerOfReview}
              className="flex items-center gap-1.5 text-xs transition-colors hover:text-red-400 disabled:opacity-40"
              style={{ color: "var(--text-muted)" }}
            >
              <ThumbsDown size={13} /> ({review.not_helpful_count ?? 0})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isOwner && !review.owner_reply && (
              <button onClick={() => setShowReply(!showReply)}
                className="flex items-center gap-1 text-xs font-medium text-orange-500 hover:text-orange-600 transition-colors">
                <MessageSquare size={13} /> Reply
              </button>
            )}
            {canEdit && (
              <button onClick={() => onEdited?.(review)}
                className="flex items-center gap-1 text-xs transition-colors hover:text-blue-400"
                style={{ color: "var(--text-muted)" }}>
                <Edit2 size={12} /> Edit
              </button>
            )}
            {isOwnerOfReview && (
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-1 text-xs transition-colors hover:text-red-500 disabled:opacity-40"
                style={{ color: "var(--text-muted)" }}>
                <Trash2 size={12} /> {deleting ? "Deleting…" : "Delete"}
              </button>
            )}
          </div>
        </div>

        {/* ── Owner reply ── */}
        {review.owner_reply && (
          <div className="mt-3 rounded-xl p-3"
            style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)" }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-bold text-orange-500">🍴 Owner Reply</p>
              {isOwner && (
                <button onClick={handleDeleteReply}
                  className="text-[10px] text-gray-400 hover:text-red-400 transition-colors">
                  Remove
                </button>
              )}
            </div>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{review.owner_reply}</p>
          </div>
        )}

        {/* ── Owner reply form ── */}
        {showReply && (
          <div className="mt-3">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a professional reply (max 500 chars)…"
              maxLength={500}
              rows={3}
              className="w-full text-sm rounded-xl p-3 resize-none outline-none focus:ring-2 focus:ring-orange-400"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
            <div className="flex items-center gap-2 mt-2">
              <button onClick={handleReply} disabled={savingReply}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#f97316,#dc2626)" }}>
                {savingReply ? "Posting…" : "Post Reply"}
              </button>
              <button onClick={() => { setShowReply(false); setReplyText(""); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ color: "var(--text-muted)", background: "var(--bg-secondary)" }}>
                Cancel
              </button>
              <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }}>
                {replyText.length}/500
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Lightbox ── */}
      {lightboxImg && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.9)" }}
          onClick={() => setLightboxImg(null)}>
          <button className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
            onClick={() => setLightboxImg(null)}>
            <X size={28} />
          </button>
          <Image src={lightboxImg} alt="Review photo" width={800} height={600}
            className="max-w-full max-h-[85vh] object-contain rounded-xl" />
        </div>
      )}
    </>
  );
}
