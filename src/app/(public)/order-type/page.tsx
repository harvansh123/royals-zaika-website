"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useOrderTypeStore, OrderType } from "@/stores/orderTypeStore";
import { Loader2 } from "lucide-react";

const OPTIONS: {
  type: OrderType;
  emoji: string;
  title: string;
  subtitle: string;
  accentColor: string;
  borderColor: string;
  bgColor: string;
}[] = [
  {
    type: "dine_in",
    emoji: "🍽️",
    title: "Dine-In",
    subtitle: "Eat comfortably at our restaurant",
    accentColor: "#a855f7",
    borderColor: "rgba(168,85,247,0.35)",
    bgColor: "rgba(168,85,247,0.07)",
  },
  {
    type: "takeaway",
    emoji: "🛍️",
    title: "Takeaway",
    subtitle: "Order now and collect from the restaurant",
    accentColor: "#3b82f6",
    borderColor: "rgba(59,130,246,0.35)",
    bgColor: "rgba(59,130,246,0.07)",
  },
  {
    type: "home_delivery",
    emoji: "🛵",
    title: "Home Delivery",
    subtitle: "Get your order delivered to your doorstep",
    accentColor: "#f97316",
    borderColor: "rgba(249,115,22,0.35)",
    bgColor: "rgba(249,115,22,0.07)",
  },
];

export default function OrderTypePage() {
  const router = useRouter();
  const { user, loading } = useAuthStore();
  const { orderType, setOrderType } = useOrderTypeStore();

  // Redirect non-customers away
  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/auth/login"); return; }
    if (user.role !== "customer") { router.replace("/"); return; }
  }, [user, loading, router]);

  function select(type: OrderType) {
    setOrderType(type);
    router.push("/menu");
  }

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={36} className="animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Header */}
      <div className="max-w-lg mx-auto w-full px-5 pt-14 pb-4">
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">🍴</div>
          <h1
            className="text-3xl font-black mb-2"
            style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-primary)" }}
          >
            How would you like
            <br />
            <span style={{ color: "#f97316" }}>to order?</span>
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Choose your preferred dining experience
          </p>
        </div>

        {/* Option Cards */}
        <div className="space-y-4">
          {OPTIONS.map((opt) => {
            const isSelected = orderType === opt.type;
            return (
              <button
                key={opt.type}
                onClick={() => select(opt.type)}
                className="w-full text-left rounded-2xl p-5 flex items-center gap-5 transition-all duration-200 active:scale-[0.98]"
                style={{
                  background: isSelected ? opt.bgColor : "var(--card-bg)",
                  border: `2px solid ${isSelected ? opt.accentColor : "var(--border)"}`,
                  boxShadow: isSelected ? `0 0 20px ${opt.borderColor}` : "none",
                }}
              >
                {/* Emoji */}
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 transition-all"
                  style={{
                    background: isSelected ? opt.bgColor : "rgba(255,255,255,0.04)",
                    border: `1px solid ${isSelected ? opt.borderColor : "var(--border)"}`,
                  }}
                >
                  {opt.emoji}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p
                    className="font-bold text-lg leading-tight"
                    style={{ color: isSelected ? opt.accentColor : "var(--text-primary)" }}
                  >
                    {opt.title}
                  </p>
                  <p
                    className="text-sm mt-0.5"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {opt.subtitle}
                  </p>
                </div>

                {/* Arrow / Check */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold transition-all"
                  style={{
                    background: isSelected ? opt.accentColor : "rgba(255,255,255,0.06)",
                    color: isSelected ? "#fff" : "var(--text-muted)",
                  }}
                >
                  {isSelected ? "✓" : "›"}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer hint */}
        <p
          className="text-center text-xs mt-8"
          style={{ color: "var(--text-muted)" }}
        >
          You can change this before placing your order
        </p>
      </div>
    </div>
  );
}
