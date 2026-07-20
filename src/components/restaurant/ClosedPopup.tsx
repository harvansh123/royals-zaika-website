"use client";
import { useEffect, useState } from "react";

interface ClosedPopupProps {
  isTemporarilyClosed: boolean;
}

/**
 * ClosedPopup — shown ONCE per browser session when the restaurant is
 * temporarily closed. Uses sessionStorage to prevent showing again on
 * the same visit.
 */
export default function ClosedPopup({ isTemporarilyClosed }: ClosedPopupProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isTemporarilyClosed) return;
    const seen = sessionStorage.getItem("closed_popup_seen");
    if (!seen) {
      setShow(true);
    }
  }, [isTemporarilyClosed]);

  if (!show) return null;

  function dismiss() {
    sessionStorage.setItem("closed_popup_seen", "1");
    setShow(false);
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-200"
        style={{ background: "var(--card-bg)", border: "1px solid rgba(239,68,68,0.3)" }}
      >
        <div className="text-5xl mb-4">🔴</div>
        <h2
          className="text-xl font-bold mb-3"
          style={{ color: "var(--text-primary)", fontFamily: "'Outfit', sans-serif" }}
        >
          Restaurant Temporarily Closed
        </h2>
        <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
          We&apos;re sorry! The restaurant is temporarily closed and is not accepting
          orders at the moment. Please try again later.
        </p>
        <button
          onClick={dismiss}
          className="w-full py-3 px-6 rounded-xl font-semibold text-white transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)" }}
        >
          OK, Got It
        </button>
      </div>
    </div>
  );
}
