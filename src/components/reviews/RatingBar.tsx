"use client";
import { cn } from "@/lib/utils";

interface RatingBarProps {
  distribution: Record<number, number>;
  total: number;
  className?: string;
}

export default function RatingBar({ distribution, total, className }: RatingBarProps) {
  if (total === 0) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      {[5, 4, 3, 2, 1].map((star) => {
        const count = distribution[star] ?? 0;
        const pct   = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={star} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-4 text-right shrink-0">{star}</span>
            <span className="text-yellow-400 text-xs shrink-0">★</span>
            <div className="flex-1 h-2 rounded-full overflow-hidden"
              style={{ background: "var(--bg-secondary, #f1f5f9)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width:      `${pct}%`,
                  background: star >= 4 ? "#22c55e" : star === 3 ? "#f59e0b" : "#ef4444",
                }}
              />
            </div>
            <span className="text-xs text-gray-500 w-7 shrink-0">{count}</span>
          </div>
        );
      })}
    </div>
  );
}
