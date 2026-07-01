import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

export function formatRelativeTime(dateStr: string) {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60)   return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function slugify(text: string) {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]+/g, "");
}

export const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending:          { label: "Order Placed",      color: "text-yellow-400 bg-yellow-400/10",  icon: "⏳" },
  confirmed:        { label: "Accepted",          color: "text-blue-400 bg-blue-400/10",      icon: "✅" },
  preparing:        { label: "Preparing",         color: "text-orange-400 bg-orange-400/10",  icon: "👨‍🍳" },
  ready:            { label: "Ready for Pickup",  color: "text-purple-400 bg-purple-400/10",  icon: "🔔" },
  out_for_delivery: { label: "Out for Delivery",  color: "text-cyan-400 bg-cyan-400/10",      icon: "🛵" },
  picked_up:        { label: "Out for Delivery",  color: "text-cyan-400 bg-cyan-400/10",      icon: "🛵" },
  delivered:        { label: "Delivered",         color: "text-green-500 bg-green-500/10",    icon: "🎉" },
  cancelled:        { label: "Cancelled",         color: "text-red-400 bg-red-400/10",        icon: "❌" },
};


export function playAlarmSound() {
  if (typeof window === "undefined") return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const beep = (freq: number, start: number, duration: number) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "square";
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };
    [0, 0.3, 0.6, 0.9, 1.2].forEach((t) => beep(880, t, 0.25));
  } catch {}
}

export function getSpiceLabel(level: number) {
  const labels = ["", "Mild", "Medium", "Spicy", "Very Spicy", "Extra Hot"];
  return labels[level] ?? "Mild";
}
