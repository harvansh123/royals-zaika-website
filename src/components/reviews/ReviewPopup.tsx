"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Star, Clock } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

const LOCAL_KEY = (orderId: string) => `rp_${orderId}`;

export default function ReviewPopup() {
  const { user } = useAuthStore();
  const router   = useRouter();
  const [pendingOrder, setPendingOrder] = useState<any>(null);
  const [visible,      setVisible]      = useState(false);

  const checkPending = useCallback(async () => {
    if (!user || user.role !== "customer") return;

    try {
      const res  = await fetch("/api/reviews/pending", { credentials: "include" });
      const json = await res.json();
      if (!json.pendingOrder) return;

      const order = json.pendingOrder;
      const key   = LOCAL_KEY(order.id);
      const stored = localStorage.getItem(key);

      if (stored === "done") return; // already reviewed

      if (stored?.startsWith("later_")) {
        const ts = parseInt(stored.replace("later_", ""));
        if (Date.now() - ts < 24 * 60 * 60 * 1000) return; // within 24h
      }

      // Show popup
      setPendingOrder(order);
      setVisible(true);
    } catch {
      // silently fail — never break the UX
    }
  }, [user]);

  useEffect(() => {
    // Delay slightly so the page content loads first
    const t = setTimeout(checkPending, 2500);
    return () => clearTimeout(t);
  }, [checkPending]);

  function handleClose() {
    setVisible(false);
    // No localStorage entry → will show again next session
  }

  function handleRemindLater() {
    if (!pendingOrder) return;
    localStorage.setItem(LOCAL_KEY(pendingOrder.id), `later_${Date.now()}`);
    setVisible(false);
  }

  function handleWriteReview() {
    if (!pendingOrder) return;
    localStorage.setItem(LOCAL_KEY(pendingOrder.id), "opened"); // clear when submitted
    router.push(`/review/${pendingOrder.id}`);
    setVisible(false);
  }

  if (!visible || !pendingOrder) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl p-6 shadow-2xl"
        style={{
          background: "var(--card-bg, #fff)",
          border: "1px solid var(--border, #e5e7eb)",
          animation: "scaleIn 0.25s ease-out",
        }}
      >
        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:opacity-70"
          style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg"
            style={{ background: "linear-gradient(135deg,#f97316,#dc2626)" }}
          >
            ⭐
          </div>
        </div>

        {/* Title */}
        <h2
          className="text-xl font-bold text-center mb-2"
          style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-primary)" }}
        >
          How was your food?
        </h2>

        {/* Stars decoration */}
        <div className="flex justify-center gap-1 mb-3">
          {[1,2,3,4,5].map((s) => (
            <Star key={s} size={20} className="text-yellow-400 fill-yellow-400" />
          ))}
        </div>

        {/* Message */}
        <p className="text-sm text-center leading-relaxed mb-5"
          style={{ color: "var(--text-secondary)" }}>
          We'd love to hear your feedback. Your review helps us improve and helps other customers choose the best dishes.
        </p>

        {/* Order info */}
        <div
          className="rounded-xl px-4 py-2.5 mb-5 text-center"
          style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}
        >
          <p className="text-xs font-semibold text-orange-500">
            Order #{pendingOrder.order_number}
          </p>
        </div>

        {/* Primary CTA */}
        <button
          onClick={handleWriteReview}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white mb-3 transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg,#f97316,#dc2626)" }}
        >
          <Star size={16} /> Write Review
        </button>

        {/* Secondary: Remind Me Later */}
        <button
          onClick={handleRemindLater}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-medium transition-colors hover:opacity-70"
          style={{ color: "var(--text-secondary)", background: "var(--bg-secondary)" }}
        >
          <Clock size={14} /> Remind Me Later
        </button>
      </div>

      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
